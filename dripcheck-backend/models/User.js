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
  }]
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

export default mongoose.model('User', userSchema)
