# DripCheck Backend Setup Guide

## Required Environment Variables

The backend requires the following environment variables to function properly:

```bash
# Google Gemini AI API Key (Required)
API_KEY=your_google_gemini_api_key_here

# MongoDB Connection String (Required)
MONGODB_URI=mongodb://localhost:27017/dripcheck
# OR for production:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dripcheck


# Optional: Port (defaults to 3000)
PORT=3000
```

## Setup Instructions

1. **Get Google Gemini API Key:**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Add it to your environment variables

2. **Set up MongoDB:**
   - Install MongoDB locally or use MongoDB Atlas
   - Update MONGODB_URI with your connection string


3. **Deploy the backend:**
   - Use the provided Dockerfile for containerized deployment
   - Or deploy directly to platforms like Railway, Render, or Heroku

## Testing the Backend

Once deployed, test the health endpoint:
```bash
curl https://your-backend-url.com/health
```

## Troubleshooting

- **AI Generation Fails**: Check if API_KEY is valid and has sufficient quota
- **Database Connection**: Verify MONGODB_URI is correct















