// Authentication elements
const authSection = document.getElementById("authSection");
const loginSection = document.getElementById("loginSection");
const mainSection = document.getElementById("mainSection");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authError = document.getElementById("authError");
const userName = document.getElementById("userName");
const tokenCount = document.getElementById("tokenCount");

// Main extension elements
const btn = document.getElementById("btn");
const file = document.getElementById("file");
const previewInfo = document.getElementById("previewInfo");
const imgPreview = document.getElementById("imgPreview");
const statusInfo = document.getElementById("statusInfo");
const generatedSection = document.getElementById("generatedSection");
const generatedPreview = document.getElementById("generatedPreview");
const downloadBtn = document.getElementById("downloadBtn");
const couponSection = document.getElementById("couponSection");
const couponInput = document.getElementById("couponInput");
const redeemBtn = document.getElementById("redeemBtn");
const couponMessage = document.getElementById("couponMessage");
const refreshBtn = document.getElementById("refreshBtn");
const clearImagesBtn = document.getElementById("clearImagesBtn");
const fileLabel = document.getElementById("fileLabel");
const itemTypeInput = document.getElementById("itemTypeInput");

// Authentication functions
function showError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
  setTimeout(() => {
    authError.classList.add('hidden');
  }, 5000);
}

function showAuthSection(user) {
  authSection.classList.remove('hidden');
  loginSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
  userName.textContent = user.username;
  tokenCount.textContent = user.tokens || 0;
  
  // Show coupon section
  couponSection.classList.remove('hidden');
  
  // Show logout button
  document.querySelector('.logout-section').classList.remove('hidden');
  
  // Show warning if user has no tokens
  if (user.tokens <= 0) {
    statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
    statusInfo.style.color = "#dc2626";
  } else {
    statusInfo.style.color = "#6b7280";
  }
}

function showLoginSection() {
  authSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
  emailInput.value = '';
  passwordInput.value = '';
  usernameInput.value = '';
  
  // Hide logout button
  document.querySelector('.logout-section').classList.add('hidden');
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }
  
  try {
    const response = await fetch(CONFIG.getApiUrl('LOGIN'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store token and user data
      chrome.storage.local.set({
        authToken: data.token,
        user: data.user
      });
      
      showAuthSection(data.user);
    } else {
      showError(data.error || 'Login failed');
    }
  } catch (error) {
    showError('Connection error. Make sure the server is running.');
  }
}

async function register() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const username = usernameInput.value.trim();
  
  if (!email || !password || !username) {
    showError('Please fill in all fields');
    return;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }
  
  try {
    console.log('Registering user:', { email, username });
    const response = await fetch(CONFIG.getApiUrl('REGISTER'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username })
    });
    console.log('Register response status:', response.status);
    
    const data = await response.json();
    
    if (response.ok) {
      // Store token and user data
      chrome.storage.local.set({
        authToken: data.token,
        user: data.user
      });
      
      showAuthSection(data.user);
    } else {
      showError(data.error || 'Registration failed');
    }
  } catch (error) {
    showError('Connection error. Make sure the server is running.');
  }
}

function logout() {
  // Clear all user-specific data from Chrome storage
  chrome.storage.local.remove([
    'authToken', 
    'user', 
    'userImage', 
    'generatedImage'
  ], () => {
    // Reset UI elements
    imgPreview.src = 'assets/placeholder.svg';
    imgPreview.alt = "No image selected";
    previewInfo.textContent = "No image selected";
    statusInfo.textContent = "📁 Upload an image to get started";
    statusInfo.style.color = "#6b7280";
    generatedSection.classList.add('hidden');
    couponSection.classList.add('hidden');
    clearImagesBtn.style.display = 'none';
    
    // Clear file input
    file.value = '';
    fileLabel.textContent = '📁 Choose Image File';
    fileLabel.classList.remove('has-file');
    
    // Show login section
    showLoginSection();
    
    console.log('User logged out - all data cleared from Chrome storage');
  });
}

async function redeemCoupon() {
  const couponCode = couponInput.value.trim();
  
  if (!couponCode) {
    showCouponMessage('Please enter a coupon code', 'error');
    return;
  }
  
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    if (!authToken) {
      showCouponMessage('Please login first', 'error');
      return;
    }
    
    const response = await fetch(CONFIG.getApiUrl('REDEEM_COUPON'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ couponCode })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showCouponMessage(`✅ ${data.message} (+${data.tokensAdded} tokens)`, 'success');
      couponInput.value = '';
      
      // Update user data
      const { user } = await chrome.storage.local.get(['user']);
      if (user) {
        user.tokens = data.newTokenBalance;
        chrome.storage.local.set({ user });
        tokenCount.textContent = user.tokens;
      }
      
      // Update status
      if (user.tokens > 0) {
        statusInfo.textContent = "✅ Ready to replace images";
        statusInfo.style.color = "#6b7280";
      }
    } else {
      showCouponMessage(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showCouponMessage('❌ Connection error', 'error');
  }
}

function showCouponMessage(message, type) {
  couponMessage.textContent = message;
  couponMessage.style.color = type === 'success' ? '#059669' : '#dc2626';
  setTimeout(() => {
    couponMessage.textContent = '';
  }, 5000);
}

// Refresh user data from server
async function refreshUserData(showFeedback = true) {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    if (!authToken) {
      if (showFeedback) {
        showCouponMessage('❌ Please login first', 'error');
      }
      return false;
    }
    
    // Show loading state
    if (showFeedback && refreshBtn) {
      refreshBtn.classList.add('loading');
    }
    
    const response = await fetch(CONFIG.getApiUrl('PROFILE'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const profileData = await response.json();
      const updatedUser = profileData.user;
      
      // Get current user data to compare
      const { user: currentUser } = await chrome.storage.local.get(['user']);
      const oldTokens = currentUser?.tokens || 0;
      const newTokens = updatedUser.tokens || 0;
      
      // Update stored user data
      chrome.storage.local.set({ user: updatedUser });
      
      // Update UI
      userName.textContent = updatedUser.username;
      tokenCount.textContent = newTokens;
      
      // Update status based on token count
      if (newTokens <= 0) {
        statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
        statusInfo.style.color = "#dc2626";
      } else {
        statusInfo.textContent = "✅ Ready to replace images";
        statusInfo.style.color = "#6b7280";
      }
      
      // Show feedback if tokens changed
      if (showFeedback && newTokens !== oldTokens) {
        const tokenDiff = newTokens - oldTokens;
        if (tokenDiff > 0) {
          showCouponMessage(`✅ Tokens updated! (+${tokenDiff} tokens)`, 'success');
        } else if (tokenDiff < 0) {
          showCouponMessage(`ℹ️ Tokens updated (${tokenDiff} tokens)`, 'success');
        }
      } else if (showFeedback) {
        showCouponMessage('✅ Token count refreshed', 'success');
      }
      
      return true;
    } else {
      if (showFeedback) {
        showCouponMessage('❌ Failed to refresh token count', 'error');
      }
      return false;
    }
  } catch (error) {
    console.error('Error refreshing user data:', error);
    if (showFeedback) {
      showCouponMessage('❌ Connection error', 'error');
    }
    return false;
  } finally {
    // Remove loading state
    if (refreshBtn) {
      refreshBtn.classList.remove('loading');
    }
  }
}

// Clear all images (uploaded and generated)
function clearAllImages() {
  // Clear from Chrome storage
  chrome.storage.local.remove(['userImage', 'generatedImage'], () => {
    console.log('All images cleared from storage');
  });
  
  // Reset UI elements
  imgPreview.src = 'assets/placeholder.svg';
  imgPreview.alt = "No image selected";
  previewInfo.textContent = "No image selected";
  statusInfo.textContent = "📁 Upload an image to get started";
  statusInfo.style.color = "#6b7280";
  
  // Hide generated image section
  generatedSection.classList.add('hidden');
  
  // Hide clear button
  clearImagesBtn.style.display = 'none';
  
  // Clear file input
  file.value = '';
  fileLabel.textContent = '📁 Choose Image File';
  fileLabel.classList.remove('has-file');
  
  // Clear item type input
  itemTypeInput.value = '';
  
  // Show success message
  showCouponMessage('✅ All images cleared', 'success');
}

// Update clear button visibility
function updateClearButtonVisibility() {
  chrome.storage.local.get(['userImage', 'generatedImage'], ({ userImage, generatedImage }) => {
    if (userImage || generatedImage) {
      clearImagesBtn.style.display = 'block';
    } else {
      clearImagesBtn.style.display = 'none';
    }
  });
}

function render(enabled) {
  if (enabled) {
    btn.textContent = "Turn Off";
    btn.classList.add("on");
    btn.classList.remove("off");
  } else {
    btn.textContent = "Turn On";
    btn.classList.add("off");
    btn.classList.remove("on");
  }
}

// Initialize popup
chrome.storage.local.get({ 
  enabled: false, 
  userImage: null, 
  generatedImage: null, 
  authToken: null, 
  user: null 
}, ({ enabled, userImage, generatedImage, authToken, user }) => {
  
  // Check authentication status
  if (authToken && user) {
    showAuthSection(user);
    // Auto-refresh user data when popup opens (silent refresh)
    refreshUserData(false);
  } else {
    showLoginSection();
  }
  
  render(enabled);
  
  // Handle uploaded image preview
  if (userImage) {
    imgPreview.src = userImage;
    imgPreview.alt = "Uploaded image";
    previewInfo.textContent = "Using uploaded image";
    statusInfo.textContent = "✅ Ready to replace images";
  } else {
    imgPreview.src = 'assets/placeholder.svg';
    imgPreview.alt = "No image selected";
    previewInfo.textContent = "No image selected";
    statusInfo.textContent = "📁 Upload an image to get started";
  }
  
  // Update clear button visibility
  updateClearButtonVisibility();
  
  // Handle generated image preview
  if (generatedImage) {
    generatedPreview.src = generatedImage;
    generatedPreview.alt = "Generated image";
    generatedSection.classList.remove('hidden');
    statusInfo.textContent = "🎨 Generated image available";
    
    // Add debug info for generated image dimensions
    generatedPreview.onload = function() {
      console.log('Generated image in popup dimensions:', this.naturalWidth, 'x', this.naturalHeight);
      console.log('Generated image aspect ratio:', (this.naturalWidth / this.naturalHeight).toFixed(2));
    };
  } else {
    generatedSection.classList.add('hidden');
  }
});

// Authentication event listeners
loginBtn.addEventListener("click", login);
registerBtn.addEventListener("click", register);
logoutBtn.addEventListener("click", logout);
refreshBtn.addEventListener("click", () => refreshUserData(true));
clearImagesBtn.addEventListener("click", clearAllImages);

// Coupon event listeners
redeemBtn.addEventListener("click", redeemCoupon);
couponInput.addEventListener("keypress", (e) => {
  if (e.key === 'Enter') redeemCoupon();
});

// Item type input listener
itemTypeInput.addEventListener("input", (e) => {
  const itemType = e.target.value.trim();
  if (itemType) {
    chrome.storage.local.set({ itemType: itemType });
    console.log('Item type saved:', itemType);
  } else {
    chrome.storage.local.remove(['itemType']);
    console.log('Item type cleared');
  }
});

// Show/hide username field for registration
registerBtn.addEventListener("mousedown", () => {
  usernameInput.classList.remove('hidden');
});

loginBtn.addEventListener("mousedown", () => {
  usernameInput.classList.add('hidden');
});

// Enter key support
emailInput.addEventListener("keypress", (e) => {
  if (e.key === 'Enter') login();
});

passwordInput.addEventListener("keypress", (e) => {
  if (e.key === 'Enter') login();
});

usernameInput.addEventListener("keypress", (e) => {
  if (e.key === 'Enter') register();
});

// Main extension event listeners
btn.addEventListener("click", () => {
  chrome.storage.local.get({ enabled: false }, ({ enabled }) => {
    const next = !enabled;
    chrome.storage.local.set({ enabled: next }, () => render(next));
  });
});

file.addEventListener("change", () => {
  const f = file.files && file.files[0];
  if (!f) {
    // Reset label if no file selected
    fileLabel.textContent = '📁 Choose Image File';
    fileLabel.classList.remove('has-file');
    return;
  }
  
  // Update label to show file is selected
  fileLabel.textContent = `✅ ${f.name}`;
  fileLabel.classList.add('has-file');
  
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    // Clear generated image when new image is uploaded
    chrome.storage.local.set({ userImage: dataUrl, generatedImage: null }, () => {
      imgPreview.src = dataUrl;
      imgPreview.alt = "Uploaded image";
      previewInfo.textContent = "Image saved (" + Math.round((f.size/1024)) + " KB)";
      statusInfo.textContent = "✅ Ready to replace images";
      generatedSection.classList.add('hidden');
      
      // Show clear button
      clearImagesBtn.style.display = 'block';
    });
  };
  reader.readAsDataURL(f);
});

// Download button functionality
downloadBtn.addEventListener("click", () => {
  chrome.storage.local.get({ generatedImage: null }, ({ generatedImage }) => {
    if (generatedImage) {
      // Convert data URL to blob
      const arr = generatedImage.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dripcheck-generated-image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
});

// Listen for storage changes to update generated image preview and user data
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    // Update generated image preview
    if (changes.generatedImage) {
      const generatedImage = changes.generatedImage.newValue;
      if (generatedImage) {
        generatedPreview.src = generatedImage;
        generatedPreview.alt = "Generated image";
        generatedSection.classList.remove('hidden');
        statusInfo.textContent = "🎨 Generated image available";
        statusInfo.style.color = "#6b7280";
        
        // Show clear button
        clearImagesBtn.style.display = 'block';
      } else {
        generatedSection.classList.add('hidden');
      }
    }
    
    // Update user data and token count
    if (changes.user) {
      const user = changes.user.newValue;
      if (user) {
        userName.textContent = user.username;
        tokenCount.textContent = user.tokens || 0;
        
        // Show warning if user has no tokens
        if (user.tokens <= 0) {
          statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
          statusInfo.style.color = "#dc2626";
        }
      }
    }
  }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Set initial placeholder image
  imgPreview.src = 'assets/placeholder.svg';
  imgPreview.alt = "No image selected";
  previewInfo.textContent = "No image selected";
  statusInfo.textContent = "📁 Upload an image to get started";
  statusInfo.style.color = "#6b7280";
  
  // Load saved item type
  chrome.storage.local.get(['itemType'], ({ itemType }) => {
    if (itemType) {
      itemTypeInput.value = itemType;
    }
  });
  
  // Update clear button visibility
  updateClearButtonVisibility();
});


