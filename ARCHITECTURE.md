# DripCheck - AI Image Replacer Architecture

## Project Overview

DripCheck is a Chrome extension that allows users to replace any image on a webpage with an AI-generated version that combines their uploaded image with the target image. The system consists of a Chrome extension frontend and a Node.js backend that uses Google's Gemini AI for image generation.

## Architecture Components

### 1. Chrome Extension Frontend (`dripchekc frontend/`)

#### **Manifest V3 Configuration** (`manifest.json`)
- **Purpose**: Defines the extension's permissions and structure
- **Key Permissions**:
  - `contextMenus`: Enables right-click context menu functionality
  - `scripting`: Allows injection of scripts into web pages
  - `activeTab`: Access to the current active tab
  - `storage`: Local storage for user data and settings
  - `host_permissions`: Access to all URLs for image replacement

#### **Background Script** (`background.js`)
- **Purpose**: Service worker that handles context menu creation and image processing requests
- **Key Functions**:
  - Creates/removes context menu based on extension toggle state
  - Handles right-click context menu events
  - Manages authentication state and token validation
  - Sends image processing requests to backend
  - Handles loading states and error management
  - Replaces images on web pages with AI-generated results

#### **Content Script** (`content.js`)
- **Purpose**: Injected into web pages to enable right-click functionality on protected images
- **Key Functions**:
  - Overrides context menu blocking on websites
  - Captures right-click events on images
  - Stores clicked image URLs for the extension to use
  - Handles various image types (img tags, background images, etc.)

#### **Popup Interface** (`popup.html` + `popup.js`)
- **Purpose**: Main user interface for the extension
- **Features**:
  - User authentication (login/register)
  - Image upload and preview
  - Extension enable/disable toggle
  - Token management display
  - Generated image preview and download
  - Real-time status updates

### 2. Backend Server (`dripcheck-backend/`)

#### **Main Server** (`server.js`)
- **Framework**: Express.js
- **Purpose**: RESTful API server handling authentication and AI image generation
- **Key Endpoints**:
  - `POST /api/register`: User registration
  - `POST /api/login`: User authentication
  - `GET /api/profile`: User profile and token information
  - `POST /generate`: AI image generation (protected route)

#### **Database Models** (`models/User.js`)
- **Framework**: Mongoose (MongoDB ODM)
- **Purpose**: User data management with authentication
- **Features**:
  - Password hashing with bcrypt
  - Token-based authentication
  - User profile management
  - Token balance tracking

#### **Authentication Middleware** (`middleware/auth.js`)
- **Framework**: JWT (jsonwebtoken)
- **Purpose**: Token-based authentication for protected routes
- **Features**:
  - JWT token verification
  - User session management
  - Token expiration handling

## Technology Stack

### Frontend (Chrome Extension)
- **Manifest V3**: Modern Chrome extension architecture
- **Vanilla JavaScript**: No external frameworks for lightweight performance
- **Chrome APIs**: 
  - `chrome.storage.local`: Data persistence
  - `chrome.contextMenus`: Right-click menu functionality
  - `chrome.scripting`: Dynamic script injection
  - `chrome.tabs`: Tab management

### Backend (Node.js Server)
- **Express.js**: Web framework for RESTful API
- **MongoDB + Mongoose**: Database and ODM for user data
- **JWT**: Token-based authentication
- **bcryptjs**: Password hashing
- **CORS**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **Google Gemini AI**: AI image generation service

## Data Flow Architecture

### 1. User Authentication Flow
```
User → Extension Popup → Backend API → MongoDB
     ← JWT Token ←      ← User Data ←
```

### 2. Image Generation Flow
```
User Uploads Image → Extension Storage
User Right-clicks Web Image → Content Script → Background Script
Background Script → Backend API → Gemini AI → Generated Image
Generated Image → Extension → Web Page Replacement
```

### 3. Extension Communication
```
Content Script ↔ Background Script ↔ Popup Script
     ↓                    ↓              ↓
Web Page DOM    Chrome Storage    User Interface
```

## Key Features Implementation

### 1. Right-Click Image Replacement
- **Content Script**: Captures right-click events on images
- **Background Script**: Processes the request and sends to backend
- **Backend**: Generates AI image using Gemini
- **Content Script**: Replaces original image with generated result

### 2. Authentication System
- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: bcrypt for secure password storage
- **Session Management**: Token-based user sessions
- **Token Balance**: User credit system for AI generation

### 3. Image Processing Pipeline
- **Base Image**: User's uploaded image (converted to base64)
- **Overlay Image**: Webpage image (fetched and converted to base64)
- **AI Generation**: Gemini processes both images to create realistic combination
- **Result**: Photorealistic image with proper lighting, shadows, and fit

### 4. Storage Management
- **Chrome Storage**: User data, authentication tokens, uploaded images
- **MongoDB**: User accounts, token balances, authentication data
- **Memory**: Temporary image processing and caching

## Security Considerations

### 1. Authentication Security
- JWT tokens with expiration
- Password hashing with salt
- Protected API routes
- Token validation middleware

### 2. Data Protection
- No sensitive data in client-side storage
- Secure API communication
- Input validation and sanitization
- Error handling without information leakage

### 3. Extension Security
- Manifest V3 security model
- Minimal permissions
- Content Security Policy compliance
- Secure script injection

## Development Setup

### Backend Dependencies
```json
{
  "express": "^4.19.2",           // Web framework
  "mongoose": "^8.0.3",           // MongoDB ODM
  "jsonwebtoken": "^9.0.2",       // JWT authentication
  "bcryptjs": "^2.4.3",           // Password hashing
  "cors": "^2.8.5",               // CORS handling
  "dotenv": "^16.4.5",            // Environment variables
  "@google/genai": "^1.20.0",     // Google Gemini AI
  "node-fetch": "^3.3.2"          // HTTP requests
}
```

### Environment Variables Required
```
MONGODB_URI=mongodb://localhost:27017/dripcheck
JWT_SECRET=your-secret-key
API_KEY=your-google-gemini-api-key
PORT=3000
```

## API Endpoints

### Authentication Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/profile` - Get user profile (protected)

### Image Generation Endpoint
- `POST /generate` - Generate AI image (protected)
  - Requires: Bearer token in Authorization header
  - Body: `{ baseUrl: string, overlayUrl: string }`
  - Returns: `{ generatedImage: string }` (base64 data URL)

## Extension Permissions Explained

- **contextMenus**: Enables right-click menu on images
- **scripting**: Injects content scripts and replaces images
- **activeTab**: Accesses current tab for image manipulation
- **storage**: Stores user data and settings locally
- **host_permissions**: Allows access to all websites for image replacement

## Error Handling

### Frontend Error Handling
- Network connection errors
- Authentication failures
- Image processing errors
- User input validation

### Backend Error Handling
- Database connection errors
- AI service failures
- Authentication errors
- Input validation errors

## Performance Considerations

### Frontend Optimization
- Minimal DOM manipulation
- Efficient image handling
- Lazy loading of generated images
- Optimized storage usage

### Backend Optimization
- Database indexing
- Image processing optimization
- Caching strategies
- Error rate limiting

## Future Enhancements

### Potential Improvements
- Image compression and optimization
- Batch processing capabilities
- Advanced AI model selection
- User preference settings
- Analytics and usage tracking
- Payment integration for token purchases

### Scalability Considerations
- Database sharding
- Load balancing
- CDN integration
- Microservices architecture
- Caching layers

## Conclusion

DripCheck represents a modern web application architecture combining Chrome extension technology with AI-powered image generation. The system demonstrates effective separation of concerns, secure authentication, and seamless user experience through careful integration of frontend and backend components.

The architecture supports real-time image replacement, user management, and AI processing while maintaining security, performance, and scalability considerations for future growth.

