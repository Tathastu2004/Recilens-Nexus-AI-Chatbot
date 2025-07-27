// Utility to debug authentication issues
export const debugAuth = () => {
  console.log('🔍 [AUTH DEBUG] Current authentication state:');
  
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'Missing');
  console.log('👤 User string:', userStr || 'Missing');
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      console.log('👤 Parsed user:', {
        hasId: !!user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        keys: Object.keys(user)
      });
    } catch (error) {
      console.error('❌ Error parsing user:', error);
    }
  }
  
  return {
    hasToken: !!token,
    hasUser: !!userStr,
    token: token ? `${token.substring(0, 20)}...` : null,
    user: userStr ? JSON.parse(userStr) : null
  };
};

// Add to window for debugging in console
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuth;
}