# DripCheck Configuration Guide

This guide explains how to configure the DripCheck extension to work with different backend environments.

## Configuration File

The extension uses `config.js` to manage backend URLs and API endpoints. This allows you to easily switch between local development and production environments.

## Switching Environments

### For Production (Default)
The extension is currently configured to use the hosted backend:
```javascript
BACKEND_URL: 'https://dripcheckbackend-gp37sv5b.b4a.run'
```

### For Local Development
To test with your local backend, edit `config.js` and change the `BACKEND_URL`:

```javascript
// Comment out the production URL
// BACKEND_URL: 'https://dripcheckbackend-gp37sv5b.b4a.run', // Production URL

// Uncomment one of these local URLs:
BACKEND_URL: 'http://localhost:3000', // Local development URL
// BACKEND_URL: 'http://127.0.0.1:3000', // Alternative local URL
```

## API Endpoints

The configuration automatically constructs full API URLs using the base `BACKEND_URL`:

- **Login**: `/api/login`
- **Register**: `/api/register` 
- **Profile**: `/api/profile`
- **Redeem Coupon**: `/api/redeem-coupon`
- **Generate**: `/generate`

## How to Test

1. **Local Testing**:
   - Start your local backend server (usually on port 3000)
   - Edit `config.js` to use `http://localhost:3000`
   - Reload the extension in Chrome
   - Test the extension functionality

2. **Production Testing**:
   - Edit `config.js` to use the production URL
   - Reload the extension in Chrome
   - Test with the hosted backend

## Files Modified

The following files were updated to use the configuration:

- `config.js` - New configuration file
- `manifest.json` - Added config.js to content scripts
- `popup.html` - Added config.js script tag
- `background.js` - Updated to use CONFIG.getApiUrl()
- `popup.js` - Updated to use CONFIG.getApiUrl()

## Notes

- Always reload the extension in Chrome after changing the configuration
- Make sure your local backend is running before testing locally
- The configuration is loaded before other scripts to ensure it's available everywhere







