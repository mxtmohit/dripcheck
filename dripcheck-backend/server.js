import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import mongoose from "mongoose";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import User from "./models/User.js";
import Coupon from "./models/Coupon.js";
import { authenticateToken, generateToken } from "./middleware/auth.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dripcheck', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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
      generate: 'POST /generate'
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



// Default item type if none specified
const DEFAULT_ITEM_TYPE = "item,items, accessory, clothing, shoes, hat, glasses, mask, etc.";



// Helper: fetch image and convert to base64

async function fetchImageAsBase64(url) {

// Check if it's a data URL (base64)

if (url.startsWith('data:')) {

// Extract base64 data from data URL

const base64Data = url.split(',')[1];

return base64Data;

}



// Otherwise, fetch from URL

const res = await fetch(url);

if (!res.ok) {

throw new Error(`Failed to fetch image: ${res.statusText}`);

}

const buffer = await res.arrayBuffer();

return Buffer.from(buffer).toString("base64");

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



// Convert images to base64

console.log("Fetching base image...");

const baseImage = await fetchImageAsBase64(baseUrl);

console.log("Fetching overlay image...");

const overlayImage = await fetchImageAsBase64(overlayUrl);



// Updated request to Gemini using the new API structure

console.log("Sending request to Gemini AI...");

const result = await ai.models.generateContent({

model: 'gemini-2.5-flash-image-preview',

contents: {

parts: [

{ inlineData: { mimeType: "image/jpeg", data: baseImage } },

{ inlineData: { mimeType: "image/jpeg", data: overlayImage } },

{
  text: `From the second image, take the ${finalItemType} and apply it to the person in the first image. 
Replace the person’s existing outfit with the new ${finalItemType}, ensuring no parts of the previous outfit remain visible. 
The ${finalItemType} must fit the body and pose naturally, with realistic draping, proportions, lighting, and shadows consistent with the first image’s environment. 
The result should be seamless, photorealistic, and free of visual artifacts. 
Maintain the same aspect ratio as the first input image, with no cropping.`
},

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

// Log the full response for debugging if no image is found

console.error("Gemini response did not contain an image:", JSON.stringify(result, null, 2));

return res.status(500).json({ error: "No image generated by Gemini" });

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

res.json({ generatedImage: `data:image/jpeg;base64,${imageBase64}` });

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

    // Add tokens to user
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { tokens: coupon.tokenAmount },
      $push: { usedCoupons: coupon._id }
    });

    // Mark coupon as used
    await coupon.use();

    res.json({
      message: 'Coupon redeemed successfully!',
      tokensAdded: coupon.tokenAmount,
      newTokenBalance: req.user.tokens + coupon.tokenAmount
    });

  } catch (error) {
    console.error('Coupon redemption error:', error);
    res.status(500).json({ error: 'Failed to redeem coupon' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))