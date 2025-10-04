import mongoose from 'mongoose';

const aiTokenLimitSchema = new mongoose.Schema({
  // Global settings
  globalDailyLimit: {
    type: Number,
    default: 1000, // Maximum AI tokens per day across all users
    min: 0
  },
  globalMonthlyLimit: {
    type: Number,
    default: 30000, // Maximum AI tokens per month across all users
    min: 0
  },
  
  // Per-user limits
  userDailyLimit: {
    type: Number,
    default: 50, // Maximum AI tokens per user per day
    min: 0
  },
  userMonthlyLimit: {
    type: Number,
    default: 500, // Maximum AI tokens per user per month
    min: 0
  },
  
  // Rate limiting
  requestsPerMinute: {
    type: Number,
    default: 10, // Max requests per minute per user
    min: 1
  },
  requestsPerHour: {
    type: Number,
    default: 100, // Max requests per hour per user
    min: 1
  },
  
  // Abuse prevention
  maxConsecutiveFailures: {
    type: Number,
    default: 5, // Max consecutive failed requests before temporary ban
    min: 1
  },
  banDurationMinutes: {
    type: Number,
    default: 30, // How long to ban users for abuse
    min: 1
  },
  
  // Emergency controls
  emergencyStop: {
    type: Boolean,
    default: false // Emergency stop all AI generation
  },
  emergencyReason: {
    type: String,
    default: ''
  },
  
  // Cost controls
  maxCostPerDay: {
    type: Number,
    default: 50.00, // Maximum cost in USD per day
    min: 0
  },
  costPerToken: {
    type: Number,
    default: 0.001, // Cost per AI token in USD
    min: 0
  },
  
  // Monitoring
  currentDailyUsage: {
    type: Number,
    default: 0
  },
  currentMonthlyUsage: {
    type: Number,
    default: 0
  },
  currentDailyCost: {
    type: Number,
    default: 0
  },
  
  // Alert thresholds
  usageAlertThreshold: {
    type: Number,
    default: 0.8, // Alert when 80% of daily limit is reached
    min: 0,
    max: 1
  },
  costAlertThreshold: {
    type: Number,
    default: 0.8, // Alert when 80% of daily cost limit is reached
    min: 0,
    max: 1
  },
  
  // Last reset dates
  lastDailyReset: {
    type: Date,
    default: Date.now
  },
  lastMonthlyReset: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to get or create the single instance
aiTokenLimitSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this();
    await settings.save();
  }
  return settings;
};

// Method to check if user can make a request
aiTokenLimitSchema.methods.canUserMakeRequest = async function(userId) {
  // Check emergency stop
  if (this.emergencyStop) {
    return { allowed: false, reason: 'Emergency stop activated: ' + this.emergencyReason };
  }
  
  // Check global daily limit
  if (this.currentDailyUsage >= this.globalDailyLimit) {
    return { allowed: false, reason: 'Global daily limit reached' };
  }
  
  // Check global monthly limit
  if (this.currentMonthlyUsage >= this.globalMonthlyLimit) {
    return { allowed: false, reason: 'Global monthly limit reached' };
  }
  
  // Check cost limits
  const estimatedCost = this.costPerToken;
  if (this.currentDailyCost + estimatedCost > this.maxCostPerDay) {
    return { allowed: false, reason: 'Daily cost limit would be exceeded' };
  }
  
  return { allowed: true };
};

// Method to record usage
aiTokenLimitSchema.methods.recordUsage = async function(tokensUsed, cost = null) {
  this.currentDailyUsage += tokensUsed;
  this.currentMonthlyUsage += tokensUsed;
  
  if (cost !== null) {
    this.currentDailyCost += cost;
  } else {
    this.currentDailyCost += tokensUsed * this.costPerToken;
  }
  
  await this.save();
};

// Method to reset daily counters
aiTokenLimitSchema.methods.resetDailyCounters = async function() {
  const now = new Date();
  const lastReset = new Date(this.lastDailyReset);
  
  // Check if it's a new day
  if (now.toDateString() !== lastReset.toDateString()) {
    this.currentDailyUsage = 0;
    this.currentDailyCost = 0;
    this.lastDailyReset = now;
    await this.save();
  }
};

// Method to reset monthly counters
aiTokenLimitSchema.methods.resetMonthlyCounters = async function() {
  const now = new Date();
  const lastReset = new Date(this.lastMonthlyReset);
  
  // Check if it's a new month
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.currentMonthlyUsage = 0;
    this.lastMonthlyReset = now;
    await this.save();
  }
};

export default mongoose.model('AITokenLimit', aiTokenLimitSchema);

