import User from '../models/User.js';

export const identifyUser = async (req, res, next) => {
  try {
    console.log('DripCheck: identifyUser middleware called');
    console.log('DripCheck: Request body:', req.body);
    
    const { userId } = req.body;

    if (!userId) {
      console.log('DripCheck: No userId provided in request body');
      return res.status(400).json({ error: 'User ID required' });
    }

    console.log('DripCheck: Looking for user with userId:', userId);

    // Find or create user based on userId only
    let user = await User.findOne({ userId });
    
    if (!user) {
      console.log('DripCheck: User not found, creating new user');
      // Create new user
      user = new User({
        userId,
        username: `User_${userId.substring(0, 8)}`
      });
      
      try {
        await user.save();
        console.log(`DripCheck: Created new user: ${userId}`);
      } catch (saveError) {
        console.error('DripCheck: Error saving new user:', saveError);
        throw saveError;
      }
    } else {
      console.log('DripCheck: User found, updating last active time');
      // Update last active time
      user.lastActive = new Date();
      
      try {
        await user.save();
        console.log('DripCheck: User updated successfully');
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