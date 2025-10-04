import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import mongoose from "mongoose";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import dotenv from "dotenv";
import User from "./models/User.js";
import Coupon from "./models/Coupon.js";
import Feedback from "./models/Feedback.js";
import AdminSettings from "./models/AdminSettings.js";
import { identifyUser } from "./middleware/auth.js";
import { globalUsageCheck, recordAIUsage, recordAIFailure, setAIUsageData, setAIError } from "./middleware/globalUsageCheck.js";

dotenv.config();

const app = express();

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

// Test database connection
app.get('/test-db', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.json({ 
      status: 'OK', 
      userCount,
      message: 'Database connection working'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      message: 'Database connection failed'
    });
  }
});



// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'DripCheck Backend API', 
    version: '1.0.0',
    endpoints: {
      health: '/health',
      userData: 'POST /api/user-data',
      profile: 'POST /api/profile',
      generate: 'POST /generate',
      feedback: 'POST /api/feedback',
      redeemCoupon: 'POST /api/redeem-coupon'
    }
  });
});

// User Data Route
app.post('/api/user-data', identifyUser, async (req, res) => {
  try {
    res.json({
      username: req.user.username,
      tokens: req.user.tokens,
      userId: req.user.userId
    });
  } catch (error) {
    console.error('User data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.post('/api/profile', identifyUser, async (req, res) => {
  try {
    res.json({
      username: req.user.username,
      tokens: req.user.tokens,
      userId: req.user.userId
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});



// Submit feedback (question/suggestion/bug)
app.post('/api/feedback', identifyUser, async (req, res) => {
  try {
    const { type, message } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }
    const allowed = ['question', 'suggestion', 'bug', 'other'];
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }
    const feedback = new Feedback({
      userId: req.user.userId,
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



app.post("/generate", identifyUser, globalUsageCheck, async (req, res) => {
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
  let userMessage = "Image generation failed. The AI model did not return an image.";
  let statusCode = 500; // Default to Internal Server Error

  try {
    const candidate = result?.candidates?.[0];
    const promptFeedback = result?.promptFeedback;

    // Specific block reason (common for safety issues)
    if (promptFeedback?.blockReason) {
      userMessage = `Request blocked by the AI model. Reason: ${promptFeedback.blockReason}. Please try with different images.`;
      statusCode = 422; // Unprocessable Entity
    }
    // Candidate finish reason
    else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      userMessage = `Image generation stopped. Reason: ${candidate.finishReason}. Please try again with different images.`;
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
        userMessage = `The AI model provided a text response instead of an image. This may be due to image content restrictions. Please try with different images.`;
        statusCode = 422;
      }
    }
  } catch (parseError) {
    console.error("Error parsing Gemini failure response:", parseError);
  }

  // Keep detailed server-side logging for debugging
  console.error("Gemini returned no image. Full response:", JSON.stringify(result, null, 2));

  // Return user-friendly message
  return res.status(statusCode).json({ 
    error: "AI image generation failed", 
    details: userMessage,
    suggestion: "Please try with different images or contact support if the issue persists."
  });
  // --- END: MODIFIED ERROR HANDLING BLOCK ---
}



// Deduct one token from user
try {
  await User.findOneAndUpdate({ userId: req.user.userId }, {
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
// Record successful AI usage
const estimatedTokens = 15; // Estimate tokens used for image generation
setAIUsageData(req, estimatedTokens);
recordAIUsage(req, res, () => {
  res.json({ generatedImage: `data:${generatedMime};base64,${imageBase64}` });
  console.log("Image generated successfully, sending response to extension");
});

} catch (err) {
console.error("Error during image generation:", err);

// Record failed AI usage
setAIError(req, err.message);
recordAIFailure(req, res, () => {
  res.status(500).json({ error: "Failed to generate image", details: err.message });
});
}

});


// Coupon redemption endpoint
app.post('/api/redeem-coupon', identifyUser, async (req, res) => {
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
    const updatedUser = await User.findOneAndUpdate({ userId: req.user.userId }, {
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

// ==================== ADMIN SETTINGS ENDPOINTS ====================

// Get admin settings (for admin dashboard)
app.get('/api/admin/settings', async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

// Update admin settings (for admin dashboard)
app.put('/api/admin/settings', async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    const updatedSettings = await settings.updateSettings({
      ...req.body,
      updatedBy: 'admin' // You could get this from auth token
    });
    
    res.json({ 
      message: 'Admin settings updated successfully', 
      settings: updatedSettings 
    });
  } catch (error) {
    console.error('Admin settings update error:', error);
    res.status(500).json({ error: 'Failed to update admin settings' });
  }
});

// Get free token statistics
app.get('/api/admin/free-token-stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersWithFreeTokens = await User.countDocuments({ hasReceivedFreeTokens: true });
    const totalFreeTokensGiven = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$freeTokensReceived' } } }
    ]);
    
    const recentFreeTokenUsers = await User.find({ 
      hasReceivedFreeTokens: true 
    }).sort({ freeTokensReceivedAt: -1 }).limit(10).select('userId freeTokensReceived freeTokensReceivedAt');
    
    res.json({
      totalUsers,
      usersWithFreeTokens,
      totalFreeTokensGiven: totalFreeTokensGiven[0]?.total || 0,
      recentFreeTokenUsers
    });
  } catch (error) {
    console.error('Free token stats error:', error);
    res.status(500).json({ error: 'Failed to fetch free token statistics' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))