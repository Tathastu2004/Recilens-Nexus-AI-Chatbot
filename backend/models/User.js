import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    unique: true,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['client', 'admin', 'super-admin'],
    default: 'client'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ✅ PRE-SAVE MIDDLEWARE TO HANDLE SUPER ADMIN EMAIL
userSchema.pre('save', function(next) {
  // Automatically set super-admin role for the designated email
  if (this.email === 'apurvsrivastava1510@gmail.com') {
    this.role = 'super-admin';
  }
  next();
});

// ✅ STATIC METHOD TO CHECK ROLE PERMISSIONS
userSchema.statics.canManageRole = function(currentUserRole, targetRole) {
  const roleHierarchy = {
    'client': 0,
    'admin': 1,
    'super-admin': 2
  };

  const currentLevel = roleHierarchy[currentUserRole] || 0;
  const targetLevel = roleHierarchy[targetRole] || 0;

  // Super admin can manage everyone
  if (currentUserRole === 'super-admin') return true;
  
  // Admin can only manage clients
  if (currentUserRole === 'admin' && targetRole === 'client') return true;
  
  // No one else can manage roles
  return false;
};

// ✅ INSTANCE METHOD TO CHECK IF USER CAN BE MANAGED BY ANOTHER USER
userSchema.methods.canBeManagedBy = function(managerRole) {
  return User.canManageRole(managerRole, this.role);
};

const User = mongoose.model('User', userSchema);
export default User;
