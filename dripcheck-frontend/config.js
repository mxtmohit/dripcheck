// Configuration file for DripCheck extension
// This allows easy switching between local development and production environments

const CONFIG = {
  // Backend URL configuration
  // Change this to switch between local and hosted environments
  //BACKEND_URL: 'https://dripcheckbackend-gp37sv5b.b4a.run', // Production URL
  
  
  // Alternative configurations (uncomment to use):
  BACKEND_URL: 'http://localhost:3000', // Local development URL
  // BACKEND_URL: 'http://127.0.0.1:3000', // Alternative local URL
  
  // API endpoints (these will be constructed using BACKEND_URL)
  ENDPOINTS: {
    LOGIN: '/api/login',
    REGISTER: '/api/register',
    PROFILE: '/api/profile',
    FEEDBACK: '/api/feedback',
    REDEEM_COUPON: '/api/redeem-coupon',
    GENERATE: '/generate',
    GOOGLE_AUTH_URL: '/api/google/auth-url',
    GOOGLE_VERIFY: '/api/google/verify'
  },
  
  
  // Helper function to get full API URL
  getApiUrl: function(endpoint) {
    return this.BACKEND_URL + this.ENDPOINTS[endpoint];
  }
};

// Make CONFIG available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// For background scripts and other contexts
if (typeof globalThis !== 'undefined') {
  globalThis.CONFIG = CONFIG;
}
