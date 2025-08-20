// feedbackController.js
import Feedback from "../models/feedback.js";
import transporter from "../config/nodemailer.js";

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
    const { user } = req.params;

    const feedbacks = await Feedback.find({ user }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    console.error("Error fetching user feedbacks:", error);
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