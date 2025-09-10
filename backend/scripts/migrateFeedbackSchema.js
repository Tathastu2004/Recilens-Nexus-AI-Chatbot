import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrateFeedbackSchema = async () => {
  try {
    console.log('🔄 [MIGRATION] Starting feedback schema migration...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ [MIGRATION] Connected to MongoDB');

    const db = mongoose.connection.db;
    const feedbackCollection = db.collection('feedbacks');

    // Check if any documents have 'user' field instead of 'userId'
    const documentsWithUserField = await feedbackCollection.countDocuments({ 
      user: { $exists: true },
      userId: { $exists: false }
    });

    console.log(`📊 [MIGRATION] Found ${documentsWithUserField} documents to migrate`);

    if (documentsWithUserField > 0) {
      // Update documents: rename 'user' field to 'userId'
      const result = await feedbackCollection.updateMany(
        { user: { $exists: true }, userId: { $exists: false } },
        { $rename: { user: 'userId' } }
      );

      console.log(`✅ [MIGRATION] Updated ${result.modifiedCount} documents`);
    }

    // Add email field for documents that don't have it
    const User = (await import('../models/User.js')).default;
    const documentsWithoutEmail = await feedbackCollection.find({
      email: { $exists: false }
    }).toArray();

    if (documentsWithoutEmail.length > 0) {
      console.log(`📧 [MIGRATION] Adding email field to ${documentsWithoutEmail.length} documents...`);
      
      for (const feedback of documentsWithoutEmail) {
        try {
          const user = await User.findById(feedback.userId || feedback.user);
          if (user) {
            await feedbackCollection.updateOne(
              { _id: feedback._id },
              { $set: { email: user.email } }
            );
          }
        } catch (error) {
          console.error(`⚠️ [MIGRATION] Could not update email for feedback ${feedback._id}`);
        }
      }
    }

    console.log('✅ [MIGRATION] Feedback schema migration completed');
    process.exit(0);

  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateFeedbackSchema();
}

export default migrateFeedbackSchema;