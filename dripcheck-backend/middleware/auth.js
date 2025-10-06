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
    
    let { userId } = req.body;
    const clientIP = getClientIP(req);
    const userAgent = getUserAgent(req);

    // Basic security: Check if request comes from extension (User-Agent check)
    const isExtensionRequest = userAgent && (
      userAgent.includes('Chrome') || 
      userAgent.includes('Mozilla') ||
      userAgent.includes('DripCheck')
    );
    
    if (!isExtensionRequest) {
      console.log('DripCheck: Request not from browser extension:', userAgent);
      return res.status(403).json({ 
        error: 'Invalid request source',
        message: 'This API is only accessible from the DripCheck browser extension'
      });
    }

    console.log('DripCheck: Client IP:', clientIP);
    console.log('DripCheck: User Agent:', userAgent);

    // Try to find by provided userId (if any)
    let user = null;
    if (userId) {
      console.log('DripCheck: Looking for user with userId:', userId);
      user = await User.findOne({ userId });
    }

    // If no userId or user not found, try IP fallback (only if IP is known)
    if (!user && clientIP && clientIP !== 'unknown') {
      console.log('DripCheck: Falling back to IP lookup for user with IP:', clientIP);
      user = await User.findOne({
        $or: [
          { lastIpAddress: clientIP },
          { ipAddress: clientIP },
          { 'ipAddressHistory.ip': clientIP }
        ]
      });
      if (user) {
        console.log('DripCheck: Found existing user by IP:', clientIP, '->', user.userId);
        // Adopt server canonical userId
        userId = user.userId;
      }
    } else if (!user && (!clientIP || clientIP === 'unknown')) {
      console.log('DripCheck: No IP fallback available - IP is unknown');
    }
    
    if (!user) {
      console.log('DripCheck: User not found, creating new user');
      
      // Check IP user limit (max 3 users per IP)
      if (clientIP && clientIP !== 'unknown') {
        const usersFromSameIP = await User.countDocuments({
          $or: [
            { ipAddress: clientIP },
            { lastIpAddress: clientIP },
            { 'ipAddressHistory.ip': clientIP }
          ]
        });
        
        if (usersFromSameIP >= 3) {
          console.log(`DripCheck: IP limit reached for ${clientIP}: ${usersFromSameIP}/3 users`);
          return res.status(403).json({
            error: 'IP limit reached',
            message: 'Maximum 3 users allowed per IP address',
            currentCount: usersFromSameIP,
            maxAllowed: 3
          });
        }
        console.log(`DripCheck: IP user count check passed for ${clientIP}: ${usersFromSameIP}/3 users`);
      }

      // Try admin settings (optional). Proceed if unavailable.
      let freeTokenCheck = { shouldGive: false, tokens: 0, reason: 'settings unavailable' };
      try {
        const adminSettings = await AdminSettings.getSettings();
        freeTokenCheck = adminSettings.shouldGiveFreeTokens({ tokens: 0, hasReceivedFreeTokens: false });
      } catch (adminErr) {
        console.warn('DripCheck: Admin settings unavailable, proceeding without free tokens:', adminErr?.message || adminErr);
      }
      
      // Create new user
      // Ensure we have a userId (server-side generate if missing)
      if (!userId) {
        const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
        userId = `DC-${rand}`;
        console.log('DripCheck: Generated server-side userId:', userId);
      }

      user = new User({
        userId,
        username: 'User', // Default username - will be hidden until user sets their own
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
        console.log('DripCheck: User saved to MongoDB successfully');
      } catch (saveError) {
        console.error('DripCheck: Error saving new user:', saveError);
        console.error('DripCheck: Save error details:', saveError.message);
        console.error('DripCheck: User object:', user);
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
    console.error('DripCheck: Error details:', error?.message || error);
    // Fallback: try minimal identification to avoid blocking UX
    try {
      let { userId } = req.body || {};
      const clientIP = getClientIP(req);
      let user = null;
      if (userId) {
        user = await User.findOne({ userId });
      }
      if (!user && clientIP && clientIP !== 'unknown') {
        user = await User.findOne({
          $or: [
            { lastIpAddress: clientIP },
            { ipAddress: clientIP },
            { 'ipAddressHistory.ip': clientIP }
          ]
        });
      }
      if (!user) {
        if (!userId) {
          const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
          userId = `DC-${rand}`;
        }
        user = new User({
          userId,
          username: 'User', // Default username - will be hidden until user sets their own
          ipAddress: clientIP,
          lastIpAddress: clientIP,
          ipAddressHistory: clientIP && clientIP !== 'unknown' ? [{
            ip: clientIP,
            firstSeen: new Date(),
            lastSeen: new Date(),
            userAgent: getUserAgent(req)
          }] : []
        });
        try {
          await user.save();
        } catch (_) {}
      }
      req.user = user;
      return next();
    } catch (fallbackErr) {
      console.error('DripCheck: Fallback identification failed:', fallbackErr);
      return res.status(500).json({ error: 'User identification failed' });
    }
  }
};