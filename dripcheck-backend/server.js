import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import mongoose from "mongoose";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import User from "./models/User.js";
import Coupon from "./models/Coupon.js";
import Feedback from "./models/Feedback.js";
import { authenticateToken, generateToken } from "./middleware/auth.js";

dotenv.config();

const app = express();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dripcheck')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));



// Initialize Gemini using the new SDK and standard API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
// Google OAuth helpers
function buildGoogleAuthUrl(redirectUri, state = '', nonce = '') {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token id_token',
    scope: 'openid email',
    prompt: 'consent',
    state,
    nonce
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Note: We do NOT decode/verify ID tokens locally. We verify identity by
// calling Google's UserInfo endpoint server-side using the client's access token.

// API to get Google auth URL
app.get('/api/google/auth-url', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth not configured' });
  const { redirectUri, state, nonce } = req.query;
  if (!redirectUri) return res.status(400).json({ error: 'redirectUri required' });
  const url = buildGoogleAuthUrl(redirectUri, state || '', nonce || '');
  res.json({ url });
});

// Verify Google user info and return our JWT
app.post('/api/google/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

    // Verify token server-side by calling Google userinfo
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!userInfoResp.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const userInfo = await userInfoResp.json();
    const email = userInfo.email;
    const googleId = userInfo.id;
    const name = userInfo.name;
    const picture = userInfo.picture;
    if (!email) return res.status(400).json({ error: 'Google account has no email' });

    const username = name || email.split('@')[0];

    // Upsert user by email
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ 
        username, 
        email, 
        password: Math.random().toString(36).slice(2),
        googleId: googleId || null
      });
      await user.save();
    } else if (!user.googleId && googleId) {
      user.googleId = googleId;
      await user.save();
    }

    // Issue our JWT
    const token = generateToken(user._id);
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        tokens: user.tokens 
      } 
    });
  } catch (err) {
    console.error('Google verify failed:', err);
    res.status(500).json({ error: 'Google auth failed' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'DripCheck Backend API', 
    version: '1.0.0',
    endpoints: {
      health: '/health',
      register: 'POST /api/register',
      login: 'POST /api/login',
      profile: 'GET /api/profile',
      generate: 'POST /generate',
      feedback: 'POST /api/feedback',
      googleAuthUrl: 'GET /api/google/auth-url?redirectUri=... (returns URL)',
      googleVerify: 'POST /api/google/verify'
    }
  });
});

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tokens: user.tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tokens: user.tokens,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});



// Submit feedback (question/suggestion/bug)
app.post('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const { type, message } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }
    const allowed = ['question', 'suggestion', 'bug', 'other'];
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }
    const user = await User.findById(req.user._id);
    const feedback = new Feedback({
      userId: user._id,
      email: user.email || undefined,
      type,
      message
    });
    await feedback.save();
    res.status(201).json({ message: 'Feedback submitted' });
  } catch (error) {
    console.error('Feedback submit error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Default item type if none specified
const DEFAULT_ITEM_TYPE = "item, outfit, accessory, clothing, shoes, hat, glasses, mask, etc.";



// Helper: fetch image and convert to base64 WITH mime type
async function fetchImageAsBase64WithMime(url) {
  // Data URL (base64)
  if (url.startsWith('data:')) {
    const headerAndData = url.split(',');
    const header = headerAndData[0] || '';
    const base64Data = headerAndData[1] || '';
    const mimeMatch = header.match(/^data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    return { base64: base64Data, mime };
  }

  // Otherwise, fetch from URL
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = await res.arrayBuffer();
  return { base64: Buffer.from(buffer).toString("base64"), mime: contentType.split(';')[0] };
}



app.post("/generate", authenticateToken, async (req, res) => {
try {
  // Check if user has tokens
  if (req.user.tokens <= 0) {
    return res.status(402).json({ error: "No tokens remaining. Please purchase more tokens." });
  }

  console.log(`User ${req.user.username} has ${req.user.tokens} tokens, generating image...`);

const { baseUrl, overlayUrl, itemType } = req.body;

console.log("Base image type:", baseUrl.startsWith('data:') ? 'data URL' : 'URL');
console.log("Overlay image type:", overlayUrl.startsWith('data:') ? 'data URL' : 'URL');
console.log("Item type specified:", itemType || 'using default');

// Use user-specified item type or fall back to default
const finalItemType = itemType || DEFAULT_ITEM_TYPE;



if (!baseUrl || !overlayUrl) {

console.log("Missing required parameters");

return res.status(400).json({ error: "Missing base or overlay image URL" });

}



// Convert images to base64 with accurate mime types
console.log("Fetching base image...");
const { base64: baseImage, mime: baseMime } = await fetchImageAsBase64WithMime(baseUrl);

console.log("Fetching overlay image...");
const { base64: overlayImage, mime: overlayMime } = await fetchImageAsBase64WithMime(overlayUrl);



// Updated request to Gemini using the new API structure

const finalprompt = `From the second image, take the ${finalItemType} and make the person in the first image wear it. 
Replace the original ${finalItemType} completely so none of it remains visible. 
Ensure realistic fit, proportions, draping, lighting, and shadows consistent with the first image. 
The result must be seamless and photorealistic, without visual artifacts. 
Maintain the same aspect ratio as the first image with no cropping.`;

const finalprompt2 = `carefully and completely make person in 1st image wear ${finalItemType} from the second image, replace it completely,ensuring no parts of the previous remain visible anywhere.`

console.log("Sending request to Gemini AI...");

console.log("Sending request to Gemini AI...");

const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image-preview',
  contents: {
    parts: [
      { inlineData: { mimeType: baseMime || "image/jpeg", data: baseImage } },
      { inlineData: { mimeType: overlayMime || "image/jpeg", data: overlayImage } },
      { text: finalprompt2 }
    ],
  },
});

console.log("Gemini AI response received");



// Robustly extract image (base64) from the new response format

let imageBase64;

if (result.candidates && result.candidates.length > 0) {

for (const part of result.candidates[0].content.parts) {

if (part.inlineData) {

imageBase64 = part.inlineData.data;

break;

}

}

}





if (!imageBase64) {
  // --- START: MODIFIED ERROR HANDLING BLOCK ---
  let userMessage = "Image generation failed. The model did not return an image.";
  let statusCode = 500; // Default to Internal Server Error

  try {
    const candidate = result?.candidates?.[0];
    const promptFeedback = result?.promptFeedback;

    // Specific block reason (common for safety issues)
    if (promptFeedback?.blockReason) {
      userMessage = `Request blocked by the model. Reason: ${promptFeedback.blockReason}.`;
      statusCode = 422; // Unprocessable Entity
    }
    // Candidate finish reason
    else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      userMessage = `Image generation stopped. Reason: ${candidate.finishReason}.`;
      if (candidate.finishReason === 'SAFETY') {
        statusCode = 422;
      }
    }
    // Model returned text instead of image
    else {
      const textParts = candidate?.content?.parts
        ?.filter(p => typeof p.text === 'string' && p.text.trim())
        ?.map(p => p.text);
      if (textParts?.length > 0) {
        userMessage = `The model provided a text response instead of an image: "${textParts.join(' ')}"`;
        statusCode = 422;
      }
    }
  } catch (parseError) {
    console.error("Error parsing Gemini failure response:", parseError);
  }

  // Keep detailed server-side logging for debugging
  console.error("Gemini returned no image. Full response:", JSON.stringify(result, null, 2));

  // Return user-friendly message
  return res.status(statusCode).json({ error: "No image generated by Gemini", details: userMessage });
  // --- END: MODIFIED ERROR HANDLING BLOCK ---
}



// Deduct one token from user
try {
  await User.findByIdAndUpdate(req.user._id, {
    $inc: { tokens: -1 }
  });
  console.log(`User ${req.user.username} token deducted. Remaining tokens: ${req.user.tokens - 1}`);
} catch (userError) {
  console.error('Error updating user tokens:', userError);
  // Don't fail the request if token update fails
}

// Detect image mime type from magic bytes and construct proper data URL
// Guard: if model returned base image unchanged, treat as failure
try {
  if (imageBase64 === baseImage) {
    return res.status(422).json({
      error: 'Model returned unedited image',
      details: 'The generated image matches the uploaded image. Please try again with a different image or adjust the item selection.'
    });
  }
} catch (_) {}

let generatedMime = 'image/jpeg';
try {
  // PNG magic bytes start with iVBORw0, JPEG with /9j/
  if (imageBase64.startsWith('iVBORw0')) {
    generatedMime = 'image/png';
  } else if (imageBase64.startsWith('/9j/')) {
    generatedMime = 'image/jpeg';
  }
} catch (_) {}
res.json({ generatedImage: `data:${generatedMime};base64,${imageBase64}` });

console.log("Image generated successfully, sending response to extension");

} catch (err) {

console.error("Error during image generation:", err);

res.status(500).json({ error: "Failed to generate image", details: err.message });

}

});


// Coupon redemption endpoint
app.post('/api/redeem-coupon', authenticateToken, async (req, res) => {
  try {
    const { couponCode } = req.body;
    
    if (!couponCode) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    // Find the coupon
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return res.status(400).json({ error: 'Coupon has expired or reached maximum uses' });
    }

    // Check if user already used this coupon
    if (req.user.usedCoupons.includes(coupon._id.toString())) {
      return res.status(400).json({ error: 'You have already used this coupon' });
    }

    // Add tokens to user and return updated balance
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
      $inc: { tokens: coupon.tokenAmount },
      $push: { usedCoupons: coupon._id }
    }, { new: true });

    // Mark coupon as used
    await coupon.use();

    res.json({
      message: 'Coupon redeemed successfully!',
      tokensAdded: coupon.tokenAmount,
      newTokenBalance: updatedUser.tokens
    });

  } catch (error) {
    console.error('Coupon redemption error:', error);
    res.status(500).json({ error: 'Failed to redeem coupon' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))