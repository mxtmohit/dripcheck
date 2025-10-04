import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  tokensUsed: {
    type: Number,
    required: true,
    min: 0
  },
  cost: {
    type: Number,
    default: 0,
    min: 0
  },
  requestType: {
    type: String,
    enum: ['image_generation', 'api_call', 'other'],
    default: 'image_generation'
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: -1 });
aiUsageSchema.index({ ipAddress: 1, createdAt: -1 });

// Static method to get usage stats for a user
aiUsageSchema.statics.getUserStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId: userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: '$tokensUsed' },
        totalCost: { $sum: '$cost' },
        totalRequests: { $sum: 1 },
        successfulRequests: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        failedRequests: {
          $sum: { $cond: ['$success', 0, 1] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0
  };
};

// Static method to detect abuse patterns
aiUsageSchema.statics.detectAbuse = async function(userId, timeWindowMinutes = 60) {
  const startTime = new Date();
  startTime.setMinutes(startTime.getMinutes() - timeWindowMinutes);
  
  const recentUsage = await this.find({
    userId: userId,
    createdAt: { $gte: startTime }
  }).sort({ createdAt: -1 });
  
  const stats = {
    totalRequests: recentUsage.length,
    failedRequests: recentUsage.filter(u => !u.success).length,
    totalTokens: recentUsage.reduce((sum, u) => sum + u.tokensUsed, 0),
    consecutiveFailures: 0,
    isAbuse: false,
    abuseReasons: []
  };
  
  // Check for consecutive failures
  let consecutiveFailures = 0;
  for (const usage of recentUsage) {
    if (!usage.success) {
      consecutiveFailures++;
    } else {
      break;
    }
  }
  stats.consecutiveFailures = consecutiveFailures;
  
  // Abuse detection logic
  if (stats.totalRequests > 100) {
    stats.isAbuse = true;
    stats.abuseReasons.push('Too many requests in time window');
  }
  
  if (stats.consecutiveFailures > 5) {
    stats.isAbuse = true;
    stats.abuseReasons.push('Too many consecutive failures');
  }
  
  if (stats.totalTokens > 1000) {
    stats.isAbuse = true;
    stats.abuseReasons.push('Excessive token usage');
  }
  
  return stats;
};

export default mongoose.model('AIUsage', aiUsageSchema);

