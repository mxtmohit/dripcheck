import User from '../models/User.js';
import AdminSettings from '../models/AdminSettings.js';

// Helper function to get client IP address (IPv4)
const getClientIP = (req) => {
  // Try different headers in order of preference
  let ip = req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.headers['x-client-ip'] ||
           req.headers['cf-connecting-ip'] || // Cloudflare
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.ip;
  
  // If x-forwarded-for contains multiple IPs, get the first one (client IP)
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Remove IPv6 prefix if present (::ffff:)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Validate IPv4 format (basic check)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ip && ipv4Regex.test(ip)) {
    return ip;
  }
  
  return 'unknown';
};

// Helper function to get user agent
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

export const identifyUser = async (req, res, next) => {
  try {
    console.log('DripCheck: identifyUser middleware called');
    console.log('DripCheck: Request body:', req.body);
    
    const { userId } = req.body;
    const clientIP = getClientIP(req);
    const userAgent = getUserAgent(req);

    console.log('DripCheck: Client IP:', clientIP);
    console.log('DripCheck: User Agent:', userAgent);

    if (!userId) {
      console.log('DripCheck: No userId provided in request body');
      return res.status(400).json({ error: 'User ID required' });
    }

    console.log('DripCheck: Looking for user with userId:', userId);

    // Find or create user based on userId only
    let user = await User.findOne({ userId });
    
    if (!user) {
      console.log('DripCheck: User not found, creating new user');
      
      // Get admin settings for free tokens and IP restrictions
      const adminSettings = await AdminSettings.getSettings();
      
      // Check IP restrictions first
      const ipRestrictionCheck = await adminSettings.checkIPRestriction(clientIP);
      if (!ipRestrictionCheck.allowed) {
        console.log(`DripCheck: IP restriction triggered for IP ${clientIP}: ${ipRestrictionCheck.reason}`);
        return res.status(403).json({ 
          error: 'IP restriction triggered',
          message: ipRestrictionCheck.reason,
          currentCount: ipRestrictionCheck.currentCount,
          maxAllowed: ipRestrictionCheck.maxAllowed
        });
      }
      
      console.log(`DripCheck: IP restriction check passed for IP ${clientIP}: ${ipRestrictionCheck.currentCount}/${ipRestrictionCheck.maxAllowed} users`);
      
      const freeTokenCheck = adminSettings.shouldGiveFreeTokens({ tokens: 0, hasReceivedFreeTokens: false });
      
      // Create new user
      user = new User({
        userId,
        username: `User_${userId.substring(0, 8)}`,
        ipAddress: clientIP,
        lastIpAddress: clientIP,
        ipAddressHistory: [{
          ip: clientIP,
          firstSeen: new Date(),
          lastSeen: new Date(),
          userAgent: userAgent
        }]
      });
      
      // Give free tokens if enabled
      if (freeTokenCheck.shouldGive) {
        user.tokens = freeTokenCheck.tokens;
        user.hasReceivedFreeTokens = true;
        user.freeTokensReceived = freeTokenCheck.tokens;
        user.freeTokensReceivedAt = new Date();
        console.log(`DripCheck: Giving ${freeTokenCheck.tokens} free tokens to new user: ${userId}`);
        console.log(`DripCheck: Welcome message: ${freeTokenCheck.message}`);
      } else {
        console.log(`DripCheck: Not giving free tokens to new user: ${freeTokenCheck.reason}`);
      }
      
      try {
        await user.save();
        console.log(`DripCheck: Created new user: ${userId} with ${user.tokens} tokens`);
      } catch (saveError) {
        console.error('DripCheck: Error saving new user:', saveError);
        throw saveError;
      }
    } else {
      console.log('DripCheck: User found, updating last active time and IP');
      // Update last active time and IP address
      user.lastActive = new Date();
      user.lastIpAddress = clientIP;
      
      // Check if this IP is already in history
      const existingIpEntry = user.ipAddressHistory.find(entry => entry.ip === clientIP);
      if (existingIpEntry) {
        // Update existing IP entry
        existingIpEntry.lastSeen = new Date();
        existingIpEntry.userAgent = userAgent;
      } else {
        // Add new IP to history
        user.ipAddressHistory.push({
          ip: clientIP,
          firstSeen: new Date(),
          lastSeen: new Date(),
          userAgent: userAgent
        });
      }
      
      try {
        await user.save();
        console.log('DripCheck: User updated successfully with IP:', clientIP);
      } catch (saveError) {
        console.error('DripCheck: Error updating user:', saveError);
        throw saveError;
      }
    }

    console.log('DripCheck: User identified successfully:', user.userId);
    req.user = user;
    next();
  } catch (error) {
    console.error('DripCheck: User identification error:', error);
    console.error('DripCheck: Error details:', error.message);
    return res.status(500).json({ error: 'User identification failed' });
  }
};