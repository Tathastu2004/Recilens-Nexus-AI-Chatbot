import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name must be at least 1 character'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    role: {
      type: String,
      enum: {
        values: ["client", "admin", "super-admin"],
        message: 'Role must be either client, admin, or super-admin'
      },
      default: "client"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    profilePicture: {
      type: String,
      default: null
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system"
      },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true }
      }
    },
    lastLoginAt: {
      type: Date,
      default: Date.now
    },
    // Legacy fields for backward compatibility
    password: { type: String, select: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    passwordResetOtp: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false }
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpiry;
        delete ret.passwordResetOtp;
        delete ret.passwordResetExpiry;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// ✅ Indexes for better performance
userSchema.index({ clerkId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// ✅ Virtual for full display name
userSchema.virtual('displayName').get(function() {
  return this.name || this.email.split('@')[0];
});

// ✅ Pre-save middleware for data cleaning
userSchema.pre('save', function(next) {
  // Ensure email is lowercase and trimmed
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // Ensure name is trimmed
  if (this.name) {
    this.name = this.name.trim();
  }
  
  // Set default name if empty
  if (!this.name && this.email) {
    this.name = this.email.split('@')[0];
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

// ✅ Static method to find or create user from Clerk data
userSchema.statics.findOrCreateFromClerk = async function(clerkUserData) {
  const { id: clerkId, emailAddresses, firstName, lastName, username } = clerkUserData;
  
  // Extract email
  let email = '';
  if (emailAddresses && emailAddresses.length > 0) {
    const primaryEmail = emailAddresses.find(e => e.verification?.status === 'verified') 
      || emailAddresses[0];
    email = primaryEmail.emailAddress;
  }
  
  if (!email) {
    throw new Error('No valid email found in Clerk user data');
  }
  
  // Extract name
  let name = '';
  if (firstName || lastName) {
    name = `${firstName || ''} ${lastName || ''}`.trim();
  } else if (username) {
    name = username;
  } else {
    name = email.split('@')[0];
  }
  
  // Try to find existing user
  let user = await this.findOne({ 
    $or: [
      { clerkId },
      { email: email.toLowerCase() }
    ]
  });
  
  if (user) {
    // Update existing user
    user.clerkId = clerkId;
    user.email = email.toLowerCase();
    user.name = name;
    user.isEmailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }
  
  // Create new user
  user = new this({
    clerkId,
    email: email.toLowerCase(),
    name,
    role: 'client',
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: new Date()
  });
  
  await user.save();
  return user;
};

export default mongoose.model("User", userSchema);
