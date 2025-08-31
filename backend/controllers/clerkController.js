import User from '../models/User.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';
import dotenv from 'dotenv';

dotenv.config();

// ✅ GET USER PROFILE
export const getUserProfile = async (req, res) => {
  try {
    console.log('📋 [CLERK CONTROLLER] Get profile request:', {
      userId: req.user?._id,
      clerkId: req.auth?.userId
    });

    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get latest info from Clerk and sync
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);
      
      // Update local user with latest Clerk data
      const isVerified = clerkUser.emailAddresses.some(email => 
        email.verification?.status === 'verified'
      );
      
      const email = clerkUser.primaryEmailAddressId ? 
        clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress : 
        user.email;
        
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 
                   clerkUser.username || user.name;

      // Update user if data changed
      let updated = false;
      if (user.email !== email) { user.email = email; updated = true; }
      if (user.name !== name) { user.name = name; updated = true; }
      if (user.profilePicture !== clerkUser.imageUrl) { 
        user.profilePicture = clerkUser.imageUrl; 
        updated = true; 
      }
      
      if (updated) {
        await user.save();
        console.log('🔄 [CLERK CONTROLLER] User data synced with Clerk');
      }

      res.json({
        success: true,
        user: {
          _id: user._id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          profilePicture: user.profilePicture,
          role: user.role,
          isActive: user.isActive,
          isVerified: isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (clerkError) {
      console.warn('⚠️ [CLERK CONTROLLER] Clerk API error, using DB data:', clerkError.message);
      
      res.json({
        success: true,
        user: {
          _id: user._id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          profilePicture: user.profilePicture,
          role: user.role,
          isActive: user.isActive,
          isVerified: true, // Assume verified if we can't check
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    }
  } catch (error) {
    console.error('❌ [CLERK CONTROLLER] Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// ✅ UPDATE USER PROFILE
export const updateUserProfile = async (req, res) => {
  try {
    console.log('📝 [CLERK CONTROLLER] Update profile request:', {
      userId: req.user?._id,
      body: req.body,
      hasFile: !!req.file
    });

    const { name } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate name
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty'
        });
      }
      user.name = name.trim();
    }

    // Handle profile picture upload
    if (req.file) {
      try {
        // Import cloudinary dynamically
        const { v2: cloudinary } = await import('cloudinary');
        
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'nexus_profile_pics',
          resource_type: 'image',
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' }
          ]
        });
        
        user.profilePicture = uploadResult.secure_url;
        
        // Clean up temp file
        const fs = await import('fs');
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        console.error('❌ [CLERK CONTROLLER] Photo upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload profile photo'
        });
      }
    }

    await user.save();

    // Also update Clerk user if name changed
    if (name !== undefined) {
      try {
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await clerkClient.users.updateUser(req.auth.userId, {
          firstName: firstName,
          lastName: lastName
        });
        console.log('✅ [CLERK CONTROLLER] Updated Clerk user name');
      } catch (clerkError) {
        console.warn('⚠️ [CLERK CONTROLLER] Failed to update Clerk user:', clerkError.message);
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role,
        isActive: user.isActive,
        isVerified: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [CLERK CONTROLLER] Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// ✅ DELETE PROFILE PHOTO
export const deleteProfilePhoto = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.profilePicture) {
      return res.status(404).json({
        success: false,
        message: 'No profile photo to delete'
      });
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (user.profilePicture.includes('cloudinary')) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        const publicId = user.profilePicture.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`nexus_profile_pics/${publicId}`);
      } catch (deleteError) {
        console.warn('⚠️ [CLERK CONTROLLER] Failed to delete from Cloudinary:', deleteError.message);
      }
    }

    user.profilePicture = '';
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
      user: {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role,
        isActive: user.isActive,
        isVerified: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [CLERK CONTROLLER] Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile photo'
    });
  }
};

// ✅ WEBHOOK HANDLER (reuse existing if working)
export const handleClerkWebhook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('❌ [WEBHOOK] Missing CLERK_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

  const headers = req.headers;
  const payload = req.body;

  console.log('📨 [WEBHOOK] Received webhook:', {
    headers: Object.keys(headers),
    bodyType: typeof payload,
    bodyLength: payload?.length
  });

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, {
      'svix-id': headers['svix-id'],
      'svix-timestamp': headers['svix-timestamp'],
      'svix-signature': headers['svix-signature'],
    });
  } catch (err) {
    console.error('❌ [WEBHOOK] Verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  const { id, type, data } = evt;
  console.log(`📋 [WEBHOOK] Event ${id} with type ${type}`);

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        console.log(`📋 [WEBHOOK] Unhandled event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ [WEBHOOK] Processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const handleUserCreated = async (userData) => {
  try {
    const email = userData.email_addresses?.[0]?.email_address;
    const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';

    const user = await User.create({
      clerkId: userData.id,
      email: email,
      name: name,
      profilePicture: userData.image_url || '',
      role: 'client',
      isActive: true
    });

    console.log('✅ [WEBHOOK] User created:', user._id);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️ [WEBHOOK] User already exists');
    } else {
      console.error('❌ [WEBHOOK] Error creating user:', error);
    }
  }
};

const handleUserUpdated = async (userData) => {
  try {
    const user = await User.findOne({ clerkId: userData.id });
    if (user) {
      const email = userData.email_addresses?.[0]?.email_address;
      const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();

      user.email = email || user.email;
      user.name = name || user.name;
      user.profilePicture = userData.image_url || user.profilePicture;
      
      await user.save();
      console.log('✅ [WEBHOOK] User updated:', user._id);
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error updating user:', error);
  }
};

const handleUserDeleted = async (userData) => {
  try {
    await User.findOneAndUpdate(
      { clerkId: userData.id },
      { isActive: false }
    );
    console.log('✅ [WEBHOOK] User deactivated:', userData.id);
  } catch (error) {
    console.error('❌ [WEBHOOK] Error deactivating user:', error);
  }
};