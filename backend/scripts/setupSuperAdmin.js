import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const setupSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    const superAdminEmail = 'apurvsrivastava1510@gmail.com';
    
    // Check if super admin already exists
    let superAdmin = await User.findOne({ email: superAdminEmail });
    
    if (superAdmin) {
      // Update existing user to super-admin
      superAdmin.role = 'super-admin';
      await superAdmin.save();
      console.log('✅ Updated existing user to super-admin:', superAdminEmail);
    } else {
      // Create new super admin user (will be synced when they first sign in with Clerk)
      superAdmin = await User.create({
        email: superAdminEmail,
        name: 'Apurv Srivastava',
        role: 'super-admin',
        isActive: true,
        clerkId: null // Will be updated when they sign in with Clerk
      });
      console.log('✅ Created new super-admin user:', superAdminEmail);
    }

    console.log('🎉 Super admin setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up super admin:', error);
    process.exit(1);
  }
};

setupSuperAdmin();