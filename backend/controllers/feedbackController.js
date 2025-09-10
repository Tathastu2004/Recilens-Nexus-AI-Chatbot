import Feedback from '../models/feedback.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * ===============================
 *  CLIENT FEEDBACK FUNCTIONS
 * ===============================
 */

// Create new feedback
export const createFeedback = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user._id; // From Clerk attachUser middleware
    const userEmail = req.user.email;
    
    console.log('📤 [FEEDBACK] Creating feedback:', {
      userId,
      userEmail,
      subject,
      messageLength: message?.length
    });

    // Validation
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    if (subject.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Subject must be 100 characters or less'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message must be 1000 characters or less'
      });
    }

    // Create feedback
    const feedback = new Feedback({
      userId,
      email: userEmail,
      subject: subject.trim(),
      message: message.trim(),
      status: 'pending'
    });

    await feedback.save();

    console.log('✅ [FEEDBACK] Feedback created:', feedback._id);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: {
        _id: feedback._id,
        subject: feedback.subject,
        message: feedback.message,
        status: feedback.status,
        createdAt: feedback.createdAt
      }
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Create feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

// Get user's feedbacks
export const getUserFeedbacks = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id.toString();
    
    console.log('🔍 [FEEDBACK] Getting feedbacks for user:', {
      requestedUserId: userId,
      requestingUserId,
      userRole: req.user.role
    });

    // Check if user is requesting their own feedbacks or is admin
    const isOwnFeedbacks = userId === requestingUserId;
    const isAdmin = ['admin', 'super-admin'].includes(req.user.role);
    
    if (!isOwnFeedbacks && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own feedbacks'
      });
    }

    // ✅ Handle both ObjectId and string userId
    let queryUserId;
    try {
      queryUserId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId)
        : userId;
    } catch (error) {
      queryUserId = userId;
    }

    // ✅ Try both field names for backward compatibility
    const feedbacks = await Feedback.find({
      $or: [
        { userId: queryUserId },
        { user: queryUserId }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log('📥 [FEEDBACK] Found feedbacks:', feedbacks.length);

    res.json({
      success: true,
      feedbacks,
      count: feedbacks.length
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Get user feedbacks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
};

// Get user feedback stats
export const getUserFeedbackStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id.toString();
    
    // Check permissions
    const isOwnStats = userId === requestingUserId;
    const isAdmin = ['admin', 'super-admin'].includes(req.user.role);
    
    if (!isOwnStats && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own stats'
      });
    }

    // ✅ Handle both ObjectId and string userId
    let queryUserId;
    try {
      queryUserId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId)
        : userId;
    } catch (error) {
      queryUserId = userId;
    }

    // ✅ Aggregate stats with both field names
    const stats = await Feedback.aggregate([
      { 
        $match: { 
          $or: [
            { userId: queryUserId },
            { user: queryUserId }
          ]
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalFeedbacks = await Feedback.countDocuments({
      $or: [
        { userId: queryUserId },
        { user: queryUserId }
      ]
    });

    const repliedFeedbacks = await Feedback.countDocuments({ 
      $or: [
        { userId: queryUserId },
        { user: queryUserId }
      ],
      reply: { $exists: true, $ne: null, $ne: '' }
    });

    // Format stats
    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, { pending: 0, processed: 0, completed: 0 });

    const formattedStats = {
      total: totalFeedbacks,
      ...statusCounts,
      replied: repliedFeedbacks,
      unreplied: totalFeedbacks - repliedFeedbacks,
      percentages: {
        pending: totalFeedbacks > 0 ? Math.round((statusCounts.pending / totalFeedbacks) * 100) : 0,
        processed: totalFeedbacks > 0 ? Math.round((statusCounts.processed / totalFeedbacks) * 100) : 0,
        completed: totalFeedbacks > 0 ? Math.round((statusCounts.completed / totalFeedbacks) * 100) : 0,
        replied: totalFeedbacks > 0 ? Math.round((repliedFeedbacks / totalFeedbacks) * 100) : 0
      }
    };

    console.log('📊 [FEEDBACK] User stats:', formattedStats);

    res.json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

/**
 * ===============================
 *  ADMIN FEEDBACK FUNCTIONS
 * ===============================
 */

// Get all feedbacks (admin only)
export const getAllFeedbacks = async (req, res) => {
  try {
    console.log('📋 [FEEDBACK] Getting all feedbacks - Admin user:', req.user.email);

    // Check admin permissions
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status, limit = 50, page = 1 } = req.query;
    
    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Get feedbacks with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // ✅ Try to populate both field names and handle gracefully
    let feedbacks;
    try {
      // First try with userId field
      feedbacks = await Feedback.find(filter)
        .populate('userId', 'name email role')
        .populate('repliedBy', 'name email')
        .populate('completedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    } catch (populateError) {
      console.log('⚠️ [FEEDBACK] userId populate failed, trying user field:', populateError.message);
      
      // Fallback to user field
      try {
        feedbacks = await Feedback.find(filter)
          .populate('user', 'name email role')
          .populate('repliedBy', 'name email')
          .populate('completedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
      } catch (fallbackError) {
        console.log('⚠️ [FEEDBACK] user populate also failed, getting without populate:', fallbackError.message);
        
        // Last resort: get without populate
        feedbacks = await Feedback.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
      }
    }

    const total = await Feedback.countDocuments(filter);

    console.log('📥 [FEEDBACK] Admin feedbacks:', {
      count: feedbacks.length,
      total,
      page,
      limit
    });

    // ✅ Format response with user data (handle both field names)
    const formattedFeedbacks = feedbacks.map(feedback => {
      // Handle both userId and user fields
      const userInfo = feedback.userId || feedback.user;
      
      return {
        ...feedback,
        user: userInfo || { email: feedback.email || 'Unknown', name: 'Unknown User' },
        userInfo: userInfo ? {
          _id: userInfo._id,
          name: userInfo.name || 'Unknown',
          email: userInfo.email || feedback.email || 'Unknown',
          role: userInfo.role || 'client'
        } : {
          _id: null,
          name: 'Unknown User',
          email: feedback.email || 'Unknown',
          role: 'client'
        }
      };
    });

    res.json({
      success: true,
      feedbacks: formattedFeedbacks,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
        totalItems: total
      }
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Get all feedbacks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
};

// Reply to feedback (admin only)
export const replyToFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { replyMessage } = req.body;
    
    console.log('💬 [FEEDBACK] Admin replying to feedback:', {
      feedbackId,
      adminEmail: req.user.email,
      replyLength: replyMessage?.length
    });

    // Check admin permissions
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Validation
    if (!replyMessage || replyMessage.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    if (replyMessage.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reply message must be 1000 characters or less'
      });
    }

    // Update feedback
    const feedback = await Feedback.findByIdAndUpdate(
      feedbackId,
      {
        reply: replyMessage.trim(),
        status: 'processed',
        repliedBy: req.user._id,
        repliedAt: new Date()
      },
      { new: true }
    );

    // ✅ Try to populate user info
    let populatedFeedback = feedback;
    try {
      populatedFeedback = await feedback.populate('userId', 'name email');
    } catch (populateError) {
      try {
        populatedFeedback = await feedback.populate('user', 'name email');
      } catch (fallbackError) {
        console.log('⚠️ [FEEDBACK] Could not populate user info for reply');
      }
    }

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    console.log('✅ [FEEDBACK] Reply sent to feedback:', feedbackId);

    res.json({
      success: true,
      message: 'Reply sent successfully',
      feedback: populatedFeedback
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Reply to feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
      error: error.message
    });
  }
};

// Mark feedback as completed (admin only)
export const markFeedbackCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('✅ [FEEDBACK] Marking feedback as completed:', {
      feedbackId: id,
      adminEmail: req.user.email
    });

    // Check admin permissions
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Update feedback
    const feedback = await Feedback.findByIdAndUpdate(
      id,
      {
        status: 'completed',
        completedBy: req.user._id,
        completedAt: new Date()
      },
      { new: true }
    );

    // ✅ Try to populate user info
    let populatedFeedback = feedback;
    try {
      populatedFeedback = await feedback.populate('userId', 'name email');
    } catch (populateError) {
      try {
        populatedFeedback = await feedback.populate('user', 'name email');
      } catch (fallbackError) {
        console.log('⚠️ [FEEDBACK] Could not populate user info for completion');
      }
    }

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    console.log('✅ [FEEDBACK] Feedback marked as completed:', id);

    res.json({
      success: true,
      message: 'Feedback marked as completed',
      feedback: populatedFeedback
    });

  } catch (error) {
    console.error('❌ [FEEDBACK] Mark feedback completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark feedback as completed',
      error: error.message
    });
  }
};
