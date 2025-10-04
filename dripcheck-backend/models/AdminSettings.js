import mongoose from 'mongoose';

const adminSettingsSchema = new mongoose.Schema({
  // Free tokens for new users
  freeTokensForNewUsers: {
    type: Number,
    default: 5,
    min: 0,
    max: 1000
  },
  
  // Enable/disable free tokens
  enableFreeTokens: {
    type: Boolean,
    default: true
  },
  
  // Welcome message for new users
  welcomeMessage: {
    type: String,
    default: 'Welcome to DripCheck! You have received free tokens to get started.'
  },
  
  // Additional settings
  maxFreeTokensPerUser: {
    type: Number,
    default: 10,
    min: 0,
    max: 1000
  },
  
  // IP restriction settings
  enableIPRestriction: {
    type: Boolean,
    default: false
  },
  
  maxUsersPerIP: {
    type: Number,
    default: 3,
    min: 1,
    max: 100
  },
  
  ipRestrictionMessage: {
    type: String,
    default: 'Maximum number of users allowed from this IP address has been reached.'
  },
  
  // Free token expiry (in days)
  freeTokenExpiryDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365
  },
  
  // Track when settings were last updated
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Track who updated the settings
  updatedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Static method to get or create the single instance
adminSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this();
    await settings.save();
  }
  return settings;
};

// Method to update settings
adminSettingsSchema.methods.updateSettings = async function(newSettings) {
  const allowedFields = [
    'freeTokensForNewUsers',
    'enableFreeTokens',
    'welcomeMessage',
    'maxFreeTokensPerUser',
    'freeTokenExpiryDays',
    'enableIPRestriction',
    'maxUsersPerIP',
    'ipRestrictionMessage',
    'updatedBy'
  ];
  
  allowedFields.forEach(field => {
    if (newSettings[field] !== undefined) {
      this[field] = newSettings[field];
    }
  });
  
  this.lastUpdated = new Date();
  await this.save();
  return this;
};

// Method to check if user should get free tokens
adminSettingsSchema.methods.shouldGiveFreeTokens = function(user) {
  // Check if free tokens are enabled
  if (!this.enableFreeTokens) {
    return { shouldGive: false, reason: 'Free tokens disabled by admin' };
  }
  
  // Check if user already has tokens (don't give free tokens to existing users)
  if (user.tokens > 0) {
    return { shouldGive: false, reason: 'User already has tokens' };
  }
  
  // Check if user has received free tokens before
  if (user.hasReceivedFreeTokens) {
    return { shouldGive: false, reason: 'User already received free tokens' };
  }
  
  return {
    shouldGive: true,
    tokens: this.freeTokensForNewUsers,
    message: this.welcomeMessage
  };
};

// Method to check IP restrictions
adminSettingsSchema.methods.checkIPRestriction = async function(ipAddress) {
  if (!this.enableIPRestriction) {
    return { allowed: true, reason: 'IP restriction disabled' };
  }
  
  // Import User model here to avoid circular dependency
  const User = mongoose.model('User');
  
  // Count users from this IP
  const userCount = await User.countDocuments({
    $or: [
      { ipAddress: ipAddress },
      { lastIpAddress: ipAddress }
    ]
  });
  
  if (userCount >= this.maxUsersPerIP) {
    return {
      allowed: false,
      reason: this.ipRestrictionMessage,
      currentCount: userCount,
      maxAllowed: this.maxUsersPerIP
    };
  }
  
  return {
    allowed: true,
    reason: 'IP address is within allowed limits',
    currentCount: userCount,
    maxAllowed: this.maxUsersPerIP
  };
};

export default mongoose.model('AdminSettings', adminSettingsSchema);
