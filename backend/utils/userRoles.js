// utils/userRoles.js - User role management utility
import { clerkClient } from '@clerk/express';

// 🔐 Whitelisted emails allowed to register as admin
const allowedAdminEmails = ['apurvsrivastava1510@gmail.com'];

// ✅ SET USER ROLE IN CLERK METADATA
export const setUserRole = async (clerkUserId, email) => {
  try {
    const userRole = allowedAdminEmails.includes(email) ? 'admin' : 'client';
    
    await clerkClient.users.updateUser(clerkUserId, {
      publicMetadata: {
        role: userRole
      }
    });
    
    console.log('✅ [USER ROLES] Role set for user:', { email, role: userRole });
    return userRole;
  } catch (error) {
    console.error('❌ [USER ROLES] Failed to set role:', error.message);
    return 'client'; // Default fallback
  }
};

// ✅ GET USER ROLE FROM CLERK
export const getUserRole = (clerkUser) => {
  return clerkUser?.publicMetadata?.role || 'client';
};

// ✅ CHECK IF USER IS ADMIN
export const isAdmin = (clerkUser) => {
  const role = getUserRole(clerkUser);
  return role === 'admin' || role === 'super-admin';
};

// ✅ CHECK IF USER IS CLIENT
export const isClient = (clerkUser) => {
  const role = getUserRole(clerkUser);
  return role === 'client';
};
