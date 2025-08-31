import { Webhook } from 'svix';
import User from '../models/User.js';
import dotenv from 'dotenv'

dotenv.config();

export const handleClerkWebhook = async (req, res) => {
  const WEBHOOK_SECRET = 'whsec_uxl9/jCoCc49loPCzC/bG73JlgF9wuXg';

  if (!WEBHOOK_SECRET) {
    console.error('❌ [WEBHOOK] Missing CLERK_WEBHOOK_SECRET');
    throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable');
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
    evt = wh.verify(payload, headers);
  } catch (err) {
    console.error('❌ [WEBHOOK] Verification failed:', err.message);
    return res.status(400).json({
      success: false,
      message: 'Webhook verification failed'
    });
  }

  const { id, type, data } = evt;

  console.log(`📋 [WEBHOOK] Event ${id} with type ${type}`);
  console.log('📋 [WEBHOOK] Event data keys:', Object.keys(data));

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
        console.log(`⚠️ [WEBHOOK] Unhandled event type: ${type}`);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
};

const handleUserCreated = async (userData) => {
  try {
    console.log('👤 [WEBHOOK] Creating user:', {
      id: userData.id,
      email: userData.email_addresses?.[0]?.email_address,
      firstName: userData.first_name,
      lastName: userData.last_name
    });

    const existingUser = await User.findOne({ clerkId: userData.id });
    
    if (!existingUser) {
      const newUser = await User.create({
        clerkId: userData.id,
        email: userData.email_addresses[0]?.email_address || '',
        name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || '',
        profilePicture: userData.image_url || '',
        role: 'client',
        isActive: true
      });
      
      console.log('✅ [WEBHOOK] User created:', newUser._id);
    } else {
      console.log('⚠️ [WEBHOOK] User already exists:', existingUser._id);
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error creating user:', error);
    throw error;
  }
};

const handleUserUpdated = async (userData) => {
  try {
    const user = await User.findOne({ clerkId: userData.id });
    
    if (user) {
      user.email = userData.email_addresses[0]?.email_address || user.email;
      user.name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || user.name;
      user.profilePicture = userData.image_url || user.profilePicture;
      
      await user.save();
      console.log('✅ [WEBHOOK] User updated:', user._id);
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error updating user:', error);
    throw error;
  }
};

const handleUserDeleted = async (userData) => {
  try {
    const user = await User.findOne({ clerkId: userData.id });
    
    if (user) {
      user.isActive = false;
      await user.save();
      console.log('✅ [WEBHOOK] User deactivated:', user._id);
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error deleting user:', error);
    throw error;
  }
};