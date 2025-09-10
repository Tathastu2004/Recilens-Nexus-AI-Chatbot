import { clerkClient } from '@clerk/clerk-sdk-node';
import User from '../models/User.js';

// ✅ CLERK AUTH MIDDLEWARE
export const requireAuth = async (req, res, next) => {
  try {
    console.log('🔐 [CLERK AUTH] Checking authentication...');
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [CLERK AUTH] No valid authorization header');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.substring(7);
    console.log('🎫 [CLERK AUTH] Token found, verifying...');

    try {
      const decoded = await clerkClient.verifyToken(token);
      console.log('✅ [CLERK AUTH] Token verified:', {
        userId: decoded.sub,
        sessionId: decoded.sid,
        exp: new Date(decoded.exp * 1000).toISOString()
      });

      req.auth = {
        userId: decoded.sub,
        sessionId: decoded.sid,
        sessionClaims: Object.keys(decoded)
      };

      next();
    } catch (verifyError) {
      console.error('❌ [CLERK AUTH] Token verification failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

  } catch (error) {
    console.error('❌ [CLERK AUTH] Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
};

// ✅ ATTACH USER MIDDLEWARE
export const attachUser = async (req, res, next) => {
  try {
    console.log('🔍 [CLERK AUTH] Attaching user...', {
      hasAuth: !!req.auth,
      userId: req.auth?.userId,
      sessionClaims: req.auth?.sessionClaims
    });

    if (!req.auth || !req.auth.userId) {
      console.log('❌ [CLERK AUTH] No auth data found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const clerkUserId = req.auth.userId;

    // Try to find existing user first
    let user = await User.findOne({ clerkId: clerkUserId });
    
    if (user) {
      console.log('✅ [CLERK AUTH] User found in database:', {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role
      });
      
      req.user = user;
      return next();
    }

    // User doesn't exist, fetch from Clerk and create
    console.log('👤 [CLERK AUTH] User not found, fetching from Clerk...');
    
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
      console.log('📥 [CLERK AUTH] Clerk user data:', {
        id: clerkUser.id,
        emailAddresses: clerkUser.emailAddresses?.map(e => ({ 
          email: e.emailAddress, 
          verified: e.verification?.status 
        })),
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        username: clerkUser.username
      });
    } catch (clerkError) {
      console.error('❌ [CLERK AUTH] Failed to fetch user from Clerk:', clerkError);
      return res.status(401).json({
        success: false,
        message: 'User not found in authentication service'
      });
    }

    // ✅ Enhanced email extraction with multiple fallback strategies
    let email = '';
    let name = '';

    // Strategy 1: Primary email address
    if (clerkUser.emailAddresses && clerkUser.emailAddresses.length > 0) {
      const primaryEmail = clerkUser.emailAddresses.find(e => e.verification?.status === 'verified') 
        || clerkUser.emailAddresses[0];
      email = primaryEmail.emailAddress;
      console.log('📧 [CLERK AUTH] Email found via emailAddresses:', email);
    }

    // Strategy 2: Direct email property (fallback)
    if (!email && clerkUser.email) {
      email = clerkUser.email;
      console.log('📧 [CLERK AUTH] Email found via direct property:', email);
    }

    // Strategy 3: External accounts (Google, etc.)
    if (!email && clerkUser.externalAccounts && clerkUser.externalAccounts.length > 0) {
      const externalAccount = clerkUser.externalAccounts[0];
      if (externalAccount.emailAddress) {
        email = externalAccount.emailAddress;
        console.log('📧 [CLERK AUTH] Email found via external account:', email);
      }
    }

    // Strategy 4: Username if it looks like an email
    if (!email && clerkUser.username && clerkUser.username.includes('@')) {
      email = clerkUser.username;
      console.log('📧 [CLERK AUTH] Email found via username:', email);
    }

    // Construct name
    if (clerkUser.firstName || clerkUser.lastName) {
      name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    } else if (clerkUser.username) {
      name = clerkUser.username;
    } else if (email) {
      name = email.split('@')[0]; // Use email prefix as fallback
    }

    console.log('🎭 [CLERK AUTH] Extracted user data:', {
      email,
      name,
      clerkId: clerkUserId
    });

    // ✅ Validate extracted data before creating user
    if (!email || email.trim() === '') {
      console.error('❌ [CLERK AUTH] No valid email found for user:', {
        clerkUserId,
        clerkUserData: {
          emailAddresses: clerkUser.emailAddresses,
          email: clerkUser.email,
          username: clerkUser.username,
          externalAccounts: clerkUser.externalAccounts?.map(acc => ({
            provider: acc.provider,
            emailAddress: acc.emailAddress
          }))
        }
      });
      
      return res.status(400).json({
        success: false,
        message: 'User email not available from authentication provider'
      });
    }

    // Create new user
    console.log('👤 [CLERK AUTH] Creating new user from Clerk data');
    
    user = new User({
      clerkId: clerkUserId,
      email: email.trim(),
      name: name.trim() || email.split('@')[0],
      role: 'client',
      isActive: true,
      isEmailVerified: true // Since it comes from Clerk, we assume it's verified
    });

    try {
      await user.save();
      console.log('✅ [CLERK AUTH] New user created:', {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (saveError) {
      console.error('❌ [CLERK AUTH] Error saving new user:', saveError);
      
      // Check if it's a duplicate email error
      if (saveError.code === 11000) {
        // Try to find the existing user with this email
        user = await User.findOne({ email: email.trim() });
        if (user) {
          // Update the existing user with Clerk ID
          user.clerkId = clerkUserId;
          await user.save();
          console.log('✅ [CLERK AUTH] Updated existing user with Clerk ID');
        }
      } else {
        throw saveError;
      }
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('❌ [CLERK AUTH] Error attaching user:', error);
    return res.status(500).json({
      success: false,
      message: 'User attachment error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ ADMIN MIDDLEWARE
export const requireAdmin = async (req, res, next) => {
  try {
    console.log('🛡️ [CLERK AUTH] Checking admin permissions...', {
      userRole: req.user?.role,
      userEmail: req.user?.email
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!['admin', 'super-admin'].includes(req.user.role)) {
      console.log('❌ [CLERK AUTH] Admin access denied for user:', req.user.email);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    console.log('✅ [CLERK AUTH] Admin access granted');
    next();
  } catch (error) {
    console.error('❌ [CLERK AUTH] Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check error'
    });
  }
};

// ✅ SUPER ADMIN MIDDLEWARE
export const requireSuperAdmin = async (req, res, next) => {
  try {
    console.log('🔒 [CLERK AUTH] Checking super admin permissions...', {
      userRole: req.user?.role,
      userEmail: req.user?.email
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'super-admin') {
      console.log('❌ [CLERK AUTH] Super admin access denied for user:', req.user.email);
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    console.log('✅ [CLERK AUTH] Super admin access granted');
    next();
  } catch (error) {
    console.error('❌ [CLERK AUTH] Super admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check error'
    });
  }
};

// ✅ ROLE MANAGEMENT PERMISSION MIDDLEWARE
export const requireRoleManagementPermission = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Super admin can manage anyone
    if (req.user.role === 'super-admin') {
      return next();
    }

    // Regular admin can only manage clients
    if (req.user.role === 'admin' && targetUser.role === 'client') {
      return next();
    }

    // Prevent managing the original super admin
    if (targetUser.email === 'apurvsrivastava1510@gmail.com' && req.user.email !== 'apurvsrivastava1510@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Cannot manage the original super admin'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for this operation'
    });
  } catch (error) {
    console.error('❌ [CLERK AUTH] Role management permission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check error'
    });
  }
};

// ✅ CLERK AUTH - STREAMING ENDPOINTS
export const clerkAuth = async (req, res, next) => {
  try {
    console.log('🔐 [CLERK AUTH] Processing request:', req.method, req.path);
    
    // ✅ EXTRACT TOKEN FROM HEADER OR QUERY PARAMS
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    // ✅ FOR STREAM ENDPOINTS, ALSO CHECK QUERY PARAMS
    if (!token && req.query.token) {
      token = req.query.token;
      console.log('🔐 [CLERK AUTH] Token found in query params for stream endpoint');
    }

    if (!token) {
      console.error('❌ [CLERK AUTH] No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // ✅ VERIFY TOKEN WITH CLERK
    try {
      console.log('🔐 [CLERK AUTH] Verifying token...');
      const decoded = await clerkClient.verifyToken(token);
      
      console.log('✅ [CLERK AUTH] Token verified successfully:', {
        userId: decoded.sub,
        issuedAt: new Date(decoded.iat * 1000).toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      });

      // ✅ ADD USER INFO TO REQUEST
      req.clerkUserId = decoded.sub;
      req.clerkUser = decoded;
      
      next();
    } catch (verifyError) {
      console.error('❌ [CLERK AUTH] Token verification failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

  } catch (error) {
    console.error('❌ [CLERK AUTH] Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
};

// ✅ OPTIONAL: ADMIN-SPECIFIC AUTH MIDDLEWARE
export const clerkAdminAuth = async (req, res, next) => {
  try {
    // First verify with Clerk
    await new Promise((resolve, reject) => {
      clerkAuth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Then check if user is admin (implement your admin check logic)
    const clerkUserId = req.clerkUserId;
    
    // You can implement additional admin checks here
    // For now, assuming all authenticated Clerk users are admins
    console.log('✅ [CLERK ADMIN AUTH] Admin access granted for user:', clerkUserId);
    
    next();
  } catch (error) {
    console.error('❌ [CLERK ADMIN AUTH] Admin authentication failed:', error);
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};