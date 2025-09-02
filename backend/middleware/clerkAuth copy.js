import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { clerkClient } from '@clerk/clerk-sdk-node';
import User from '../models/User.js';

// ✅ ENHANCED CLERK AUTH MIDDLEWARE WITH BETTER ERROR HANDLING
export const requireAuth = ClerkExpressRequireAuth({
  onError: (error) => {
    console.error('❌ [CLERK AUTH] Authentication failed:', {
      message: error.message,
      status: error.status,
      code: error.code
    });
    return {
      status: 401,
      message: 'Authentication required'
    };
  }
});

// ✅ IMPROVED USER ATTACHMENT WITH DEBUGGING
export const attachUser = async (req, res, next) => {
  try {
    console.log('🔍 [CLERK AUTH] Attaching user...', {
      hasAuth: !!req.auth,
      userId: req.auth?.userId,
      sessionClaims: req.auth?.sessionClaims ? Object.keys(req.auth.sessionClaims) : null,
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'content-type': req.headers['content-type']
      }
    });

    if (!req.auth) {
      console.error('❌ [CLERK AUTH] No auth object found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - No auth object'
      });
    }

    if (!req.auth.userId) {
      console.error('❌ [CLERK AUTH] No user ID found in auth');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - No user ID'
      });
    }

    // Find user in database
    let user = await User.findOne({ clerkId: req.auth.userId });
    
    if (!user) {
      console.log('👤 [CLERK AUTH] User not found in DB, fetching from Clerk API...');

      try {
        const clerkUser = await clerkClient.users.getUser(req.auth.userId);
        
        console.log('📋 [CLERK API] User data:', {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName
        });

        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 
                    clerkUser.username || 'User';

        // Check for existing user with same email
        if (email) {
          const existingUser = await User.findOne({ email });
          if (existingUser && !existingUser.clerkId) {
            existingUser.clerkId = req.auth.userId;
            existingUser.name = name;
            existingUser.profilePicture = clerkUser.imageUrl || '';
            await existingUser.save();
            user = existingUser;
            console.log('✅ [CLERK AUTH] Updated existing user with Clerk ID');
          }
        }

        if (!user) {
          user = await User.create({
            clerkId: req.auth.userId,
            email: email,
            name,
            profilePicture: clerkUser.imageUrl || '',
            role: 'client',
            isActive: true
          });
          
          console.log('✅ [CLERK AUTH] New user created:', {
            _id: user._id,
            email: user.email,
            clerkId: user.clerkId
          });
        }

      } catch (clerkError) {
        console.error('❌ [CLERK API] Error fetching user:', clerkError);
        
        // Create minimal user if Clerk API fails
        user = await User.create({
          clerkId: req.auth.userId,
          name: 'User',
          role: 'client',
          isActive: true
        });
        
        console.log('⚠️ [CLERK AUTH] Created user with minimal data');
      }
    }

    req.user = user;
    req.userId = user._id;
    
    console.log('✅ [CLERK AUTH] User attached successfully:', {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    next();
  } catch (error) {
    console.error('❌ [CLERK AUTH] Error in attachUser:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required'
    });
  }
  next();
};