import { clerkClient } from '@clerk/express';
import crypto from 'crypto';
import User from '../models/User.js';

// 🔐 Admin whitelist
const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

// ✅ WEBHOOK SIGNATURE VERIFICATION
const verifyWebhookSignature = (req) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not configured');
  }

  const signature = req.headers['clerk-signature'];
  if (!signature) {
    throw new Error('No signature provided');
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  const providedSignature = signature.split(',').find(part => 
    part.trim().startsWith('sha256=')
  )?.split('=')[1];

  if (expectedSignature !== providedSignature) {
    throw new Error('Invalid signature');
  }
};

// ✅ MAIN WEBHOOK HANDLER - SYNCS CLERK USERS WITH MONGODB
export const syncClerkUser = async (req, res) => {
  console.log('🔶 [WEBHOOK] Received:', req.body.type);

  try {
    // Verify webhook signature (optional but recommended)
    // verifyWebhookSignature(req);

    const { data, type } = req.body;
    
    if (type === 'user.created' || type === 'user.updated') {
      const clerkUser = data;
      const email = clerkUser.email_addresses[0]?.email_address;
      
      if (!email) {
        console.log('❌ [WEBHOOK] No email found for user');
        return res.status(400).json({ success: false, message: 'No email found' });
      }

      console.log('📧 [WEBHOOK] Processing user:', email);

      // Check if user already exists by Clerk ID
      let user = await User.findOne({ clerkUserId: clerkUser.id });
      
      if (!user) {
        // ✅ CHECK FOR EXISTING USER BY EMAIL (MIGRATION CASE)
        user = await User.findOne({ email: email.toLowerCase() });
        
        if (user) {
          // 🔗 LINK EXISTING USER TO CLERK
          console.log('🔄 [WEBHOOK] Linking existing user to Clerk:', email);
          user.clerkUserId = clerkUser.id;
          user.migratedToClerk = true;
          user.migrationDate = new Date();
          user.isVerified = true;
          
          // Update name and profile picture from Clerk
          const clerkName = `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim();
          if (clerkName && !user.name) {
            user.name = clerkName;
          }
          
          if (clerkUser.image_url && !user.profilePicture) {
            user.profilePicture = clerkUser.image_url;
          }
          
          // Preserve existing role or assign based on email
          if (!user.role || user.role === 'client') {
            user.role = allowedAdminEmails.includes(email) ? 'admin' : 'client';
          }
          
        } else {
          // 🆕 CREATE NEW USER
          console.log('🆕 [WEBHOOK] Creating new user:', email);
          const userRole = allowedAdminEmails.includes(email) ? 'admin' : 'client';
          
          user = new User({
            clerkUserId: clerkUser.id,
            name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() || 'User',
            email: email.toLowerCase(),
            role: userRole,
            isVerified: true,
            profilePicture: clerkUser.image_url || null,
            migratedToClerk: true,
            migrationDate: new Date()
          });
        }
      } else {
        // ✅ UPDATE EXISTING CLERK USER
        console.log('🔄 [WEBHOOK] Updating existing Clerk user:', email);
        user.name = `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() || user.name;
        user.email = email.toLowerCase();
        user.profilePicture = clerkUser.image_url || user.profilePicture;
        user.isVerified = true;
      }

      await user.save();
      
      console.log('✅ [WEBHOOK] User synced successfully:', {
        mongoId: user._id,
        clerkId: user.clerkUserId,
        email: user.email,
        role: user.role,
        isExisting: user.migratedToClerk
      });
    }

    if (type === 'user.deleted') {
      const clerkUser = data;
      console.log('🗑️ [WEBHOOK] User deleted in Clerk:', clerkUser.id);
      
      // Optionally soft delete or mark as inactive
      await User.findOneAndUpdate(
        { clerkUserId: clerkUser.id },
        { 
          isVerified: false, 
          deletedAt: new Date(),
          clerkUserId: null // Remove Clerk connection
        }
      );
      
      console.log('✅ [WEBHOOK] User marked as deleted');
    }

    res.status(200).json({ 
      success: true, 
      message: `Webhook ${type} processed successfully` 
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ GET USER PROFILE
export const getUserProfile = async (req, res) => {
  console.log('🔶 [PROFILE] Get profile request:', {
    userId: req.auth?.userId,
    timestamp: new Date().toISOString()
  });

  try {
    const user = req.user; // Set by attachUserMiddleware
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const responseData = {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture,
        clerkUserId: user.clerkUserId,
        migratedToClerk: user.migratedToClerk
      }
    };

    console.log('✅ [PROFILE] Sending profile response');
    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [PROFILE] Error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching profile' 
    });
  }
};

// ✅ UPDATE USER PROFILE
export const updateUserProfile = async (req, res) => {
  console.log('🔶 [PROFILE] Update profile request:', {
    userId: req.auth?.userId,
    body: req.body,
    file: req.file ? { originalname: req.file.originalname } : 'No file'
  });

  const { name, removePhoto } = req.body;
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update name
    if (name) user.name = name;

    // Handle photo removal
    if (removePhoto === true || removePhoto === 'true') {
      console.log('🗑️ [PROFILE] Removing profile photo');
      user.profilePicture = null;
    }

    // Handle photo upload
    if (req.file) {
      console.log('📸 [PROFILE] New photo uploaded');
      user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();

    // Optionally sync back to Clerk
    if (name && user.clerkUserId) {
      try {
        await clerkClient.users.updateUser(user.clerkUserId, {
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ')
        });
        console.log('✅ [PROFILE] Updated in Clerk as well');
      } catch (clerkError) {
        console.warn('⚠️ [PROFILE] Failed to update Clerk:', clerkError.message);
      }
    }

    const responseData = {
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [PROFILE] Profile updated successfully');
    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [PROFILE] Update error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating profile' 
    });
  }
};
