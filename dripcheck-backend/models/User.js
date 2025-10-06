import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  username: {
    type: String,
    default: 'User',
    trim: true,
    maxlength: 30
  },
  tokens: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  usedCoupons: [{
    type: String,
    ref: 'Coupon'
  }],
  hasReceivedFreeTokens: {
    type: Boolean,
    default: false
  },
  freeTokensReceived: {
    type: Number,
    default: 0
  },
  freeTokensReceivedAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    default: null,
    trim: true
  },
  lastIpAddress: {
    type: String,
    default: null,
    trim: true
  },
  ipAddressHistory: [{
    ip: String,
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    userAgent: String
  }],
  
  // IP request tracking
  ipRequestCounts: {
    hourly: {
      type: Number,
      default: 0
    },
    daily: {
      type: Number,
      default: 0
    },
    lastHourReset: {
      type: Date,
      default: Date.now
    },
    lastDayReset: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Static method to get users by IP address
userSchema.statics.getUsersByIP = function(ipAddress) {
  return this.find({
    $or: [
      { ipAddress: ipAddress },
      { lastIpAddress: ipAddress },
      { 'ipAddressHistory.ip': ipAddress }
    ]
  });
};

// Static method to get IP statistics
userSchema.statics.getIPStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$lastIpAddress',
        userCount: { $sum: 1 },
        users: { $push: '$userId' },
        firstSeen: { $min: '$createdAt' },
        lastSeen: { $max: '$lastActive' }
      }
    },
    {
      $match: {
        _id: { $ne: null, $ne: 'unknown' }
      }
    },
    {
      $sort: { userCount: -1 }
    }
  ]);
};

// Instance method to check if IP is suspicious (multiple users from same IP)
userSchema.methods.isIPSuspicious = function() {
  return this.ipAddressHistory && this.ipAddressHistory.length > 3;
};

// Static method to check IP request limits
userSchema.statics.checkIPRequestLimits = async function(ipAddress, adminSettings) {
  if (!adminSettings.ipRequestLimits.enableIPLimits) {
    return { allowed: true, reason: 'IP limits disabled' };
  }
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Get all users from this IP
  const usersFromIP = await this.find({
    $or: [
      { ipAddress: ipAddress },
      { lastIpAddress: ipAddress },
      { 'ipAddressHistory.ip': ipAddress }
    ]
  });
  
  if (usersFromIP.length === 0) {
    return { allowed: true, reason: 'No users found for this IP' };
  }
  
  // Check hourly limits
  const hourlyRequests = usersFromIP.reduce((total, user) => {
    if (user.ipRequestCounts.lastHourReset < oneHourAgo) {
      return total; // Reset needed, don't count old requests
    }
    return total + (user.ipRequestCounts.hourly || 0);
  }, 0);
  
  if (hourlyRequests >= adminSettings.ipRequestLimits.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: 'Hourly request limit exceeded',
      currentCount: hourlyRequests,
      maxAllowed: adminSettings.ipRequestLimits.maxRequestsPerHour
    };
  }
  
  // Check daily limits
  const dailyRequests = usersFromIP.reduce((total, user) => {
    if (user.ipRequestCounts.lastDayReset < oneDayAgo) {
      return total; // Reset needed, don't count old requests
    }
    return total + (user.ipRequestCounts.daily || 0);
  }, 0);
  
  if (dailyRequests >= adminSettings.ipRequestLimits.maxRequestsPerDay) {
    return {
      allowed: false,
      reason: 'Daily request limit exceeded',
      currentCount: dailyRequests,
      maxAllowed: adminSettings.ipRequestLimits.maxRequestsPerDay
    };
  }
  
  return {
    allowed: true,
    reason: 'Within limits',
    hourlyCount: hourlyRequests,
    dailyCount: dailyRequests
  };
};

// Instance method to increment request count
userSchema.methods.incrementRequestCount = async function() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Reset hourly count if needed
  if (this.ipRequestCounts.lastHourReset < oneHourAgo) {
    this.ipRequestCounts.hourly = 0;
    this.ipRequestCounts.lastHourReset = now;
  }
  
  // Reset daily count if needed
  if (this.ipRequestCounts.lastDayReset < oneDayAgo) {
    this.ipRequestCounts.daily = 0;
    this.ipRequestCounts.lastDayReset = now;
  }
  
  // Increment counts
  this.ipRequestCounts.hourly += 1;
  this.ipRequestCounts.daily += 1;
  
  await this.save();
};

export default mongoose.model('User', userSchema)
