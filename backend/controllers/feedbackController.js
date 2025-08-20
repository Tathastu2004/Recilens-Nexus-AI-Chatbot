// feedbackController.js
import Feedback from "../models/feedback.js";
import transporter from "../config/nodemailer.js";
import mongoose from "mongoose";
// ==============================
// CREATE NEW FEEDBACK (User Side)
// ==============================
export const createFeedback = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const user = req.user._id; // Use 'user' field to match schema

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required" });
    }

    const feedback = await Feedback.create({
      user, // This matches the schema field name 'user'
      subject,
      message,
      status: "pending",
    });

    res.status(201).json({ success: true, feedback });
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==============================
// GET USER'S FEEDBACKS (User Side)
// ==============================



export const getUserFeedbacks = async (req, res) => {
  try {
    console.log(req.params)
    const { userId} = req.params;
    
    console.log('🔍 [USER FEEDBACKS] Getting feedbacks for Id:', userId);
    
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    // Convert to ObjectId and find feedbacks
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const feedbacks = await Feedback.find({ user: userObjectId }).sort({ createdAt: -1 });
    
    console.log('📊 [USER FEEDBACKS] Found', feedbacks.length, 'feedbacks');
    
    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    console.error("❌ [USER FEEDBACKS] Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ==============================
// GET ALL FEEDBACKS (Admin Side)
// ==============================
export const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate('user', 'email').sort({ createdAt: -1 });

    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    console.error("Error fetching all feedbacks:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==============================
// ADMIN REPLY TO FEEDBACK
// ==============================
export const replyToFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { replyMessage } = req.body;

    const feedback = await Feedback.findById(feedbackId).populate('user', 'email');
    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    // Get email from populated user data
    const userEmail = feedback.user.email;

    // Send reply email
    const mailOptions = {
      from: process.env.EMAIL,
      to: userEmail,
      subject: `Reply to your feedback: ${feedback.subject}`,
      text: replyMessage,
    };

    await transporter.sendMail(mailOptions);

    // Update feedback with reply + status
    feedback.reply = replyMessage;
    feedback.status = "processed";
    await feedback.save();

    res.status(200).json({ success: true, message: "Reply sent successfully", feedback });
  } catch (error) {
    console.error("Error replying to feedback:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: mark feedback completed
export const markFeedbackCompleted = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id); // Use 'id' param as per routes
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    feedback.status = "completed";
    await feedback.save();

    res.json({ success: true, feedback });
  } catch (err) {
    console.error("Error marking feedback complete:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// ==============================
// GET USER'S FEEDBACK STATS (Corrected for 'user' field)
// ==============================
export const getUserFeedbackStats = async (req, res) => {
  try {
    const { userId } = req.params; // This comes from the route parameter
    
    console.log(`[FEEDBACK STATS] Getting stats for user: ${userId}`);
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    // ✅ CORRECTED: Use 'user' field (not 'userId') to match your schema
    const statusAggregation = await Feedback.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(userId) // ✅ 'user' field from schema
        } 
      },
      { 
        $group: { 
          _id: "$status", 
          count: { $sum: 1 } 
        } 
      }
    ]);

    // ✅ CORRECTED: Count feedbacks with replies using 'user' field
    const repliedCount = await Feedback.countDocuments({
      user: new mongoose.Types.ObjectId(userId), // ✅ 'user' field from schema
      reply: { $exists: true, $ne: null, $ne: "" }
    });

    // Initialize counts with default values
    const stats = {
      total: 0,
      pending: 0,
      processed: 0,
      completed: 0,
      replied: repliedCount
    };

    // Process the aggregation results
    let totalCount = 0;
    statusAggregation.forEach(item => {
      if (item._id && stats.hasOwnProperty(item._id)) {
        stats[item._id] = item.count;
        totalCount += item.count;
      }
    });

    stats.total = totalCount;
    stats.unreplied = totalCount - repliedCount;

    // Add percentages for better frontend display
    const percentages = {
      pending: totalCount > 0 ? Math.round((stats.pending / totalCount) * 100) : 0,
      processed: totalCount > 0 ? Math.round((stats.processed / totalCount) * 100) : 0,
      completed: totalCount > 0 ? Math.round((stats.completed / totalCount) * 100) : 0,
      replied: totalCount > 0 ? Math.round((stats.replied / totalCount) * 100) : 0
    };

    console.log(`[FEEDBACK STATS] Results for user ${userId}:`, stats);

    res.status(200).json({ 
      success: true, 
      stats: {
        ...stats,
        percentages
      },
      userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error fetching user feedback stats:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching feedback stats" 
    });
  }
};
