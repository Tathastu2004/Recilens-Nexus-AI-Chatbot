// scripts/migrateUsers.js
import 'dotenv/config'; // ✅ Load environment variables FIRST
import mongoose from 'mongoose';
import { clerkClient } from '@clerk/express';
import User from '../models/User.js';

const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

const migrateExistingUsers = async () => {
  try {
    // ✅ Debug: Check if environment variables are loaded
    console.log('🔍 Environment Check:');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'MISSING');
    console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Loaded' : 'MISSING');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY environment variable is required');
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📡 Connected to MongoDB for migration');

    // Find users without Clerk integration
    const usersToMigrate = await User.find({ 
      clerkUserId: { $exists: false },
      email: { $exists: true },
      isVerified: true
    });

    console.log(`🔄 Found ${usersToMigrate.length} users to potentially migrate`);

    if (usersToMigrate.length === 0) {
      console.log('✅ No users need migration');
      process.exit(0);
    }

    for (const user of usersToMigrate) {
      try {
        console.log(`🔍 Checking user: ${user.email}`);
        
        // Check if user exists in Clerk by email
        const clerkUsers = await clerkClient.users.getUserList({
          emailAddress: [user.email]
        });

        if (clerkUsers.length > 0) {
          const clerkUser = clerkUsers[0];
          console.log(`✅ Found Clerk user for ${user.email}, linking...`);
          
          // Update MongoDB user with Clerk ID
          user.clerkUserId = clerkUser.id;
          user.migratedToClerk = true;
          user.migrationDate = new Date();
          user.isVerified = true;
          
          // Update role if needed
          const userRole = allowedAdminEmails.includes(user.email) ? 'admin' : 'client';
          user.role = userRole;
          
          await user.save();
          console.log(`✅ Successfully migrated user: ${user.email} (Role: ${userRole})`);
        } else {
          console.log(`⚠️ No Clerk user found for: ${user.email}`);
          console.log('   → User needs to sign up with Clerk manually');
        }
      } catch (error) {
        console.error(`❌ Error migrating user ${user.email}:`, error.message);
      }
    }

    // Show migration summary
    const migratedCount = await User.countDocuments({ migratedToClerk: true });
    const totalCount = await User.countDocuments();
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${totalCount}`);
    console.log(`   Migrated to Clerk: ${migratedCount}`);
    console.log(`   Remaining: ${totalCount - migratedCount}`);
    
    console.log('\n✅ Migration completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
};

migrateExistingUsers();
