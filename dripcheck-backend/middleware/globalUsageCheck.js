import AITokenLimit from '../models/AITokenLimit.js';
import AIUsage from '../models/AIUsage.js';

// Rate limiting storage (in production, use Redis)
const userRequestCounts = new Map();
const userRequestTimes = new Map();

// Clean up old rate limiting data every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [userId, times] of userRequestTimes.entries()) {
    const filteredTimes = times.filter(time => time > oneHourAgo);
    if (filteredTimes.length === 0) {
      userRequestTimes.delete(userId);
      userRequestCounts.delete(userId);
    } else {
      userRequestTimes.set(userId, filteredTimes);
      userRequestCounts.set(userId, filteredTimes.length);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

export const globalUsageCheck = async (req, res, next) => {
  try {
    console.log('DripCheck: Global usage check middleware called');
    
    const { userId } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    if (!userId) {
      console.log('DripCheck: No userId provided for usage check');
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // Get AI token limits
    const limits = await AITokenLimit.getSettings();
    
    // Reset counters if needed (daily/monthly)
    await limits.resetDailyCounters();
    await limits.resetMonthlyCounters();
    
    // Check emergency stop
    if (limits.emergencyStop) {
      console.log('DripCheck: Emergency stop active, blocking request');
      return res.status(503).json({ 
        error: 'AI generation temporarily unavailable',
        reason: limits.emergencyReason || 'Emergency stop activated'
      });
    }
    
    // Check global limits
    const canRequest = await limits.canUserMakeRequest(userId);
    if (!canRequest.allowed) {
      console.log('DripCheck: Global limits exceeded:', canRequest.reason);
      return res.status(429).json({ 
        error: 'AI generation limit reached',
        reason: canRequest.reason
      });
    }
    
    // Rate limiting check
    const now = Date.now();
    const userTimes = userRequestTimes.get(userId) || [];
    const oneMinuteAgo = now - (60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Filter requests within time windows
    const recentMinuteRequests = userTimes.filter(time => time > oneMinuteAgo);
    const recentHourRequests = userTimes.filter(time => time > oneHourAgo);
    
    // Check rate limits
    if (recentMinuteRequests.length >= limits.requestsPerMinute) {
      console.log('DripCheck: Rate limit exceeded (per minute)');
      return res.status(429).json({ 
        error: 'Too many requests',
        reason: `Rate limit exceeded: ${limits.requestsPerMinute} requests per minute`
      });
    }
    
    if (recentHourRequests.length >= limits.requestsPerHour) {
      console.log('DripCheck: Rate limit exceeded (per hour)');
      return res.status(429).json({ 
        error: 'Too many requests',
        reason: `Rate limit exceeded: ${limits.requestsPerHour} requests per hour`
      });
    }
    
    // Check for abuse patterns
    const abuseDetection = await AIUsage.detectAbuse(userId);
    if (abuseDetection.isAbuse) {
      console.log('DripCheck: Abuse detected for user:', userId, abuseDetection.abuseReasons);
      return res.status(429).json({ 
        error: 'Suspicious activity detected',
        reason: `Abuse detected: ${abuseDetection.abuseReasons.join(', ')}`,
        abuseDetails: abuseDetection
      });
    }
    
    // Update rate limiting data
    userTimes.push(now);
    userRequestTimes.set(userId, userTimes);
    userRequestCounts.set(userId, userTimes.length);
    
    // Store request info for later usage recording
    req.aiRequestInfo = {
      userId,
      ipAddress,
      userAgent,
      timestamp: now,
      limits
    };
    
    console.log('DripCheck: Usage check passed for user:', userId);
    next();
    
  } catch (error) {
    console.error('DripCheck: Global usage check error:', error);
    // In case of error, allow the request but log it
    console.log('DripCheck: Usage check failed, allowing request with warning');
    next();
  }
};

// Middleware to record AI usage after successful request
export const recordAIUsage = async (req, res, next) => {
  try {
    // Only record if this was an AI request and we have the info
    if (req.aiRequestInfo && req.aiRequestInfo.limits) {
      const { userId, ipAddress, userAgent, timestamp, limits } = req.aiRequestInfo;
      
      // Calculate tokens used (this should be passed from the AI service)
      const tokensUsed = req.aiTokensUsed || 0;
      const cost = req.aiCost || (tokensUsed * limits.costPerToken);
      
      // Record usage in global limits
      await limits.recordUsage(tokensUsed, cost);
      
      // Create usage record
      await AIUsage.create({
        userId,
        tokensUsed,
        cost,
        requestType: 'image_generation',
        success: true,
        ipAddress,
        userAgent,
        metadata: {
          endpoint: req.path,
          method: req.method,
          timestamp
        }
      });
      
      console.log('DripCheck: AI usage recorded:', { userId, tokensUsed, cost });
    }
    
    next();
  } catch (error) {
    console.error('DripCheck: Error recording AI usage:', error);
    // Don't fail the request if usage recording fails
    next();
  }
};

// Middleware to record failed AI requests
export const recordAIFailure = async (req, res, next) => {
  try {
    if (req.aiRequestInfo && req.aiRequestInfo.limits) {
      const { userId, ipAddress, userAgent, timestamp } = req.aiRequestInfo;
      
      // Record failed request
      await AIUsage.create({
        userId,
        tokensUsed: 0,
        cost: 0,
        requestType: 'image_generation',
        success: false,
        errorMessage: req.errorMessage || 'Unknown error',
        ipAddress,
        userAgent,
        metadata: {
          endpoint: req.path,
          method: req.method,
          timestamp,
          error: req.errorMessage
        }
      });
      
      console.log('DripCheck: AI failure recorded for user:', userId);
    }
    
    next();
  } catch (error) {
    console.error('DripCheck: Error recording AI failure:', error);
    next();
  }
};

// Helper function to set AI usage data in request
export const setAIUsageData = (req, tokensUsed, cost = null) => {
  req.aiTokensUsed = tokensUsed;
  req.aiCost = cost;
};

// Helper function to set error message
export const setAIError = (req, errorMessage) => {
  req.errorMessage = errorMessage;
};

