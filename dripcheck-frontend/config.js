// Configuration file for DripCheck extension
// This allows easy switching between local development and production environments

const CONFIG = {
  // Backend URL configuration
  // Change this to switch between local and hosted environments
  //BACKEND_URL: 'https://dripcheckbackend-gp37sv5b.b4a.run', // Production URL
  BACKEND_URL: 'http://localhost:3000', // Local development URL
  
  // Alternative configurations (uncomment to use):
  // BACKEND_URL: 'http://localhost:3000', // Local development URL
  // BACKEND_URL: 'http://127.0.0.1:3000', // Alternative local URL
  
  // API endpoints (these will be constructed using BACKEND_URL)
  ENDPOINTS: {
    LOGIN: '/api/login',
    REGISTER: '/api/register',
    PROFILE: '/api/profile',
    REDEEM_COUPON: '/api/redeem-coupon',
    GENERATE: '/generate'
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

// Log configuration for debugging
console.log('DripCheck Config loaded:', {
  backendUrl: CONFIG.BACKEND_URL,
  endpoints: CONFIG.ENDPOINTS
});
