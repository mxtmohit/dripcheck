function ensureGeneratedSection() {
  if (!generatedSection) {
    const previewsRowEl = document.getElementById('previewsRow');
    if (!previewsRowEl) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'generatedSection';
    wrapper.innerHTML = `
      <div class="section-title">Generated Image</div>
      <div class="image-preview" style="position:relative;">
        <img id="generatedPreview" alt="No generated image" />
        <button id="downloadBtn" class="download-btn">Download</button>
      </div>
    `;
    previewsRowEl.appendChild(wrapper);
    // Refresh references
    generatedSection = wrapper;
    generatedPreview = wrapper.querySelector('#generatedPreview');
    generatedPreviewContainer = generatedPreview.parentElement;
    downloadBtn = wrapper.querySelector('#downloadBtn');
    // Bind download handler
    downloadBtn.addEventListener('click', () => {
      chrome.storage.local.get({ generatedImage: null }, ({ generatedImage }) => {
        if (generatedImage) {
          const arr = generatedImage.split(',');
          const mime = arr[0].match(/:(.*?);/)[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          const blob = new Blob([u8arr], { type: mime });
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
  }
}

function removeGeneratedSection() {
  if (generatedSection && generatedSection.parentElement) {
    generatedSection.parentElement.removeChild(generatedSection);
  }
  generatedSection = null;
  generatedPreview = null;
  generatedPreviewContainer = null;
  downloadBtn = null;
}
// Authentication elements
const authSection = document.getElementById("authSection");
const loginSection = document.getElementById("loginSection");
const mainSection = document.getElementById("mainSection");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authError = document.getElementById("authError");
const userName = document.getElementById("userName");
const tokenCount = document.getElementById("tokenCount");

// Main extension elements
const btn = document.getElementById("btn");
const file = document.getElementById("file");
const previewInfo = document.getElementById("previewInfo");
const imgPreview = document.getElementById("imgPreview");
const imgPreviewContainer = imgPreview ? imgPreview.parentElement : null;
const statusInfo = document.getElementById("statusInfo");
let generatedSection = document.getElementById("generatedSection");
let generatedPreview = document.getElementById("generatedPreview");
let generatedPreviewContainer = generatedPreview ? generatedPreview.parentElement : null;
let downloadBtn = document.getElementById("downloadBtn");
const couponSection = document.getElementById("couponSection");
const couponInput = document.getElementById("couponInput");
const redeemBtn = document.getElementById("redeemBtn");
const couponMessage = document.getElementById("couponMessage");
const refreshBtn = document.getElementById("refreshBtn");
const clearImagesBtn = document.getElementById("clearImagesBtn");
const fileLabel = document.getElementById("fileLabel");
const itemTypeInput = document.getElementById("itemTypeInput");
const previewsRow = document.getElementById("previewsRow");
// Feedback elements
const feedbackSection = document.getElementById('feedbackSection');
const feedbackType = document.getElementById('feedbackType');
const feedbackMessage = document.getElementById('feedbackMessage');
const sendFeedbackBtn = document.getElementById('sendFeedbackBtn');
const feedbackAlert = document.getElementById('feedbackAlert');

// Authentication functions
function showError(message) {
  if (authError) {
    authError.textContent = message;
    authError.classList.remove('hidden');
    setTimeout(() => {
      if (authError) authError.classList.add('hidden');
    }, 5000);
  }
}

function showAuthSection(user) {
  if (authSection) authSection.classList.remove('hidden');
  if (loginSection) loginSection.classList.add('hidden');
  if (mainSection) mainSection.classList.remove('hidden');
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  if (userName) userName.textContent = "user" || user.username;
  if (tokenCount) tokenCount.textContent = user.tokens || 0;
  
  // Show coupon section
  if (couponSection) couponSection.classList.remove('hidden');
  if (feedbackSection) feedbackSection.classList.remove('hidden');
  
  // Show logout button
  const bottomLogout = document.querySelector('.logout-section');
  if (bottomLogout) bottomLogout.classList.remove('hidden');
  
  // Show warning if user has no tokens
  if (user.tokens <= 0) {
    if (statusInfo) {
      statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
      statusInfo.style.color = "#dc2626";
    }
  } else {
    if (statusInfo) statusInfo.style.color = "#6b7280";
  }
}

function showLoginSection() {
  if (authSection) authSection.classList.add('hidden');
  if (loginSection) loginSection.classList.remove('hidden');
  if (mainSection) mainSection.classList.add('hidden');
  if (logoutBtn) logoutBtn.classList.add('hidden');
  // Legacy inputs may not exist in current UI; avoid touching non-existent fields
  if (emailInput && typeof emailInput.value !== 'undefined') emailInput.value = '';
  if (passwordInput && typeof passwordInput.value !== 'undefined') passwordInput.value = '';
  if (usernameInput && typeof usernameInput.value !== 'undefined') usernameInput.value = '';
  
  // Hide logout button
  const bottomLogout = document.querySelector('.logout-section');
  if (bottomLogout) bottomLogout.classList.add('hidden');
  if (feedbackSection) feedbackSection.classList.add('hidden');
}

async function login() {
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  
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
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : '';
  
  if (!email || !password || !username) {
    showError('Please fill in all fields');
    return;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }
  
  try {
    const response = await fetch(CONFIG.getApiUrl('REGISTER'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username })
    });
    // no-op: remove verbose logs in production
    
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
async function startGoogleSignIn() {
  try {
    // Show loading state on Google sign-in button
    if (googleSignInBtn) {
      googleSignInBtn.disabled = true;
      googleSignInBtn.textContent = 'Signing in…';
    }
    // Use Chrome Identity API to get Google access token
    const accessToken = await new Promise((resolve, reject) => {
      try {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          const err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            // Explicitly handle to avoid Unchecked runtime.lastError
            return reject(new Error(err.message || 'OAuth2 not granted'));
          }
          if (!token) {
            return reject(new Error('No token returned'));
          }
          resolve(token);
        });
      } catch (e) {
        reject(e);
      }
    });
    
    // Send the Google access token to backend for verification and user upsert
    const backendResp = await fetch(CONFIG.getApiUrl('GOOGLE_VERIFY'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });
    
    const data = await backendResp.json();
    if (!backendResp.ok) throw new Error(data.error || 'Backend verification failed');
    
    // Save auth token and user, update UI
    chrome.storage.local.set({ authToken: data.token, user: data.user });
    showAuthSection(data.user);
  } catch (err) {
    showError(err.message || 'Google sign-in failed');
  } finally {
    // Restore button state
    if (googleSignInBtn) {
      googleSignInBtn.disabled = false;
      googleSignInBtn.textContent = 'Continue with Google';
    }
  }
}

function logout() {
  // Clear all user-specific data from Chrome storage
  chrome.storage.local.remove([
    'authToken',
    'user',
    'userImage',
    'generatedImage',
    'itemType',
    'enabled'
  ], () => {
    // Attempt to revoke cached Google auth token(s) (best-effort)
    try {
      const tryRevoke = () => new Promise((resolve) => {
        try {
          chrome.identity.getAuthToken({ interactive: false }, (token) => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) {
              // Explicitly read lastError to avoid console noise
              return resolve(false);
            }
            if (token) {
              // Revoke at Google and clear the cache
              fetch(`https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`)
                .catch(() => {})
                .finally(() => {
                  chrome.identity.removeCachedAuthToken({ token }, () => resolve(true));
                });
            } else {
              resolve(false);
            }
          });
        } catch (_) {
          resolve(false);
        }
      });
      // Try a couple of times to ensure all cached tokens are cleared
      tryRevoke().then((hadToken) => {
        if (hadToken) {
          tryRevoke().finally(() => {});
        }
      });
    } catch (e) {
      // ignore
    }
    // Reset UI elements
    if (imgPreview) {
      imgPreview.src = '';
      imgPreview.alt = "No image selected";
    }
    if (previewInfo) previewInfo.textContent = "No image selected";
    if (statusInfo) {
      statusInfo.textContent = "📁 Upload an image to get started";
      statusInfo.style.color = "#6b7280";
    }
    removeGeneratedSection();
    if (couponSection) couponSection.classList.add('hidden');
    if (clearImagesBtn) clearImagesBtn.style.display = 'none';
    
    // Clear file input
    if (file) file.value = '';
    if (fileLabel) {
      fileLabel.textContent = '📁 Choose Image File';
      fileLabel.classList.remove('has-file');
    }
    
    // Show login section
    showLoginSection();
    
    console.log('User logged out - all data cleared from Chrome storage');
  });
}

async function redeemCoupon() {
  const couponCode = couponInput ? couponInput.value.trim() : '';
  
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
  if (couponMessage) {
    couponMessage.textContent = message;
    couponMessage.style.color = type === 'success' ? '#059669' : '#dc2626';
    setTimeout(() => {
      if (couponMessage) couponMessage.textContent = '';
    }, 5000);
  }
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
      if (userName) userName.textContent = updatedUser.username;
      if (tokenCount) tokenCount.textContent = newTokens;
      
      // Update status based on token count
      if (newTokens <= 0) {
        if (statusInfo) {
          statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
          statusInfo.style.color = "#dc2626";
        }
      } else {
        if (statusInfo) {
          statusInfo.textContent = "✅ Ready to replace images";
          statusInfo.style.color = "#6b7280";
        }
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
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.alt = "No image selected";
  }
  if (previewInfo) previewInfo.textContent = "No image selected";
  if (statusInfo) {
    statusInfo.textContent = "📁 Upload an image to get started";
    statusInfo.style.color = "#6b7280";
  }
  if (imgPreviewContainer) imgPreviewContainer.classList.remove('has-image');
  
  // Remove generated image section entirely
  removeGeneratedSection();
  
  // Hide clear button
  if (clearImagesBtn) clearImagesBtn.style.display = 'none';
  
  // Clear file input
  if (file) file.value = '';
  if (fileLabel) {
    fileLabel.textContent = '📁 Choose Image File';
    fileLabel.classList.remove('has-file');
  }
  
  // Clear item type input
  if (itemTypeInput) itemTypeInput.value = '';
  
  // Show success message
  showCouponMessage('✅ All images cleared', 'success');
}

// Update clear button visibility
function updateClearButtonVisibility() {
  chrome.storage.local.get(['userImage', 'generatedImage'], ({ userImage, generatedImage }) => {
    if (clearImagesBtn) {
      if (userImage || generatedImage) {
        clearImagesBtn.style.display = 'flex';
      } else {
        clearImagesBtn.style.display = 'none';
      }
    }
  });
}

function render(enabled) {
  if (btn) {
    if (enabled) {
      btn.textContent = "⏻";
      btn.classList.add("on");
      btn.classList.remove("off");
      btn.title = "Turn Off";
      btn.setAttribute('aria-label', 'Turn Off');
    } else {
      btn.textContent = "⏻";
      btn.classList.add("off");
      btn.classList.remove("on");
      btn.title = "Turn On";
      btn.setAttribute('aria-label', 'Turn On');
    }
  }
}

// Initialize popup
chrome.storage.local.get({ 
  enabled: true, 
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
    if (imgPreview) {
      imgPreview.src = userImage;
      imgPreview.alt = "Uploaded image";
    }
    if (previewInfo) previewInfo.textContent = "Using uploaded image";
    if (statusInfo) statusInfo.textContent = "✅ Ready to replace images";
    if (imgPreviewContainer) imgPreviewContainer.classList.add('has-image');
  } else {
    if (imgPreview) {
      imgPreview.src = '';
      imgPreview.alt = "No image selected";
    }
    if (previewInfo) previewInfo.textContent = "No image selected";
    if (statusInfo) statusInfo.textContent = "📁 Upload an image to get started";
    if (imgPreviewContainer) imgPreviewContainer.classList.remove('has-image');
  }
  
  // Update clear button visibility
  updateClearButtonVisibility();
  
  // Handle generated image preview
  if (generatedImage) {
    ensureGeneratedSection();
    if (generatedPreview) {
      generatedPreview.src = generatedImage;
      generatedPreview.alt = "Generated image";
    }
    if (statusInfo) statusInfo.textContent = "🎨 Generated image available";
    if (generatedPreviewContainer) generatedPreviewContainer.classList.add('has-image');
    if (previewsRow) previewsRow.classList.remove('single-preview');
    
    // Remove verbose image dimension logs for production
  } else {
    removeGeneratedSection();
    if (previewsRow) previewsRow.classList.add('single-preview');
  }
});

// Authentication event listeners
if (loginBtn) loginBtn.addEventListener("click", login);
if (registerBtn) registerBtn.addEventListener("click", register);
if (googleSignInBtn) googleSignInBtn.addEventListener('click', startGoogleSignIn);
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", () => refreshUserData(true));
if (clearImagesBtn) clearImagesBtn.addEventListener("click", clearAllImages);

// Coupon event listeners
if (redeemBtn) redeemBtn.addEventListener("click", redeemCoupon);
if (couponInput) {
  couponInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') redeemCoupon();
  });
}

// Submit feedback
async function submitFeedback() {
  const type = (feedbackType && feedbackType.value) || 'question';
  const message = (feedbackMessage && feedbackMessage.value.trim()) || '';
  if (!message) {
    if (feedbackAlert) {
      feedbackAlert.textContent = 'Please enter a message';
      feedbackAlert.style.color = '#dc2626';
      setTimeout(() => feedbackAlert.textContent = '', 4000);
    }
    return;
  }
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) {
      if (feedbackAlert) {
        feedbackAlert.textContent = 'Please login first';
        feedbackAlert.style.color = '#dc2626';
        setTimeout(() => feedbackAlert.textContent = '', 4000);
      }
      return;
    }
    const resp = await fetch(CONFIG.getApiUrl('FEEDBACK'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ type, message })
    });
    const data = await resp.json();
    if (resp.ok) {
      if (feedbackAlert) {
        feedbackAlert.textContent = '✅ Sent. Thank you!';
        feedbackAlert.style.color = '#059669';
        setTimeout(() => feedbackAlert.textContent = '', 4000);
      }
      if (feedbackMessage) feedbackMessage.value = '';
    } else {
      if (feedbackAlert) {
        feedbackAlert.textContent = `❌ ${data.error || 'Failed to send'}`;
        feedbackAlert.style.color = '#dc2626';
        setTimeout(() => feedbackAlert.textContent = '', 4000);
      }
    }
  } catch (e) {
    if (feedbackAlert) {
      feedbackAlert.textContent = '❌ Connection error';
      feedbackAlert.style.color = '#dc2626';
      setTimeout(() => feedbackAlert.textContent = '', 4000);
    }
  }
}

if (sendFeedbackBtn) sendFeedbackBtn.addEventListener('click', submitFeedback);

// Legal links event listeners
const privacyPolicyLink = document.getElementById('privacyPolicyLink');
if (privacyPolicyLink) {
  privacyPolicyLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://mxtmohit.github.io/dripcheck/privacy-policy' });
  });
}

const termsOfServiceLink = document.getElementById('termsOfServiceLink');
if (termsOfServiceLink) {
  termsOfServiceLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://mxtmohit.github.io/dripcheck/terms-of-service' });
  });
}

// Item type input listener
if (itemTypeInput) {
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
}

// Show/hide username field for registration
// legacy handlers guarded (inputs removed from UI)
if (registerBtn) registerBtn.addEventListener("mousedown", () => {
  if (usernameInput) usernameInput.classList.remove('hidden');
});
if (loginBtn) loginBtn.addEventListener("mousedown", () => {
  if (usernameInput) usernameInput.classList.add('hidden');
});

// Enter key support
if (emailInput) emailInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') login(); });
if (passwordInput) passwordInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') login(); });
if (usernameInput) usernameInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') register(); });

// Main extension event listeners
if (btn) {
  btn.addEventListener("click", () => {
    chrome.storage.local.get({ enabled: false }, ({ enabled }) => {
      const next = !enabled;
      chrome.storage.local.set({ enabled: next }, () => {
        render(next);
        if (!next) {
          // When turning off, clear any loaders/overlays in active tab(s)
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const tab = tabs && tabs[0];
              if (tab && tab.id) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => {
                    const spinner = document.getElementById('dripcheck-spinner-container');
                    if (spinner) spinner.remove();
                    const topIndicator = document.getElementById('dripcheck-top-indicator');
                    if (topIndicator) topIndicator.remove();
                    const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
                    imgs.forEach(img => {
                      const p = img.parentElement;
                      if (p && p.style.position === 'relative') p.style.position = '';
                      img.removeAttribute('data-spinner-active');
                    });
                  }
                });
              }
            });
          } catch (_) {}
        }
      });
    });
  });
}

if (file) {
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) {
      // Reset label if no file selected
      if (fileLabel) {
        fileLabel.textContent = '📁 Choose Image File';
        fileLabel.classList.remove('has-file');
      }
      return;
    }
    
    // Update label to show file is selected
    if (fileLabel) {
      fileLabel.textContent = `✅ ${f.name}`;
      fileLabel.classList.add('has-file');
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Clear generated image when new image is uploaded
      chrome.storage.local.set({ userImage: dataUrl, generatedImage: null }, () => {
        if (imgPreview) {
          imgPreview.src = dataUrl;
          imgPreview.alt = "Uploaded image";
        }
        if (previewInfo) previewInfo.textContent = "Image saved (" + Math.round((f.size/1024)) + " KB)";
        if (statusInfo) statusInfo.textContent = "✅ Ready to replace images";
        if (generatedSection) generatedSection.classList.add('hidden');
        if (imgPreviewContainer) imgPreviewContainer.classList.add('has-image');
        if (generatedPreviewContainer) generatedPreviewContainer.classList.remove('has-image');
        
        // Show clear button
        if (clearImagesBtn) clearImagesBtn.style.display = 'flex';
      });
    };
    reader.readAsDataURL(f);
  });
}

// Download handler is attached when generated section is created dynamically

// Listen for storage changes to update generated image preview and user data
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    // Update generated image preview
    if (changes.generatedImage) {
      const generatedImage = changes.generatedImage.newValue;
      if (generatedImage) {
        if (generatedPreview) {
          generatedPreview.src = generatedImage;
          generatedPreview.alt = "Generated image";
        }
        if (generatedSection) generatedSection.classList.remove('hidden');
        if (statusInfo) {
          statusInfo.textContent = "🎨 Generated image available";
          statusInfo.style.color = "#6b7280";
        }
        if (generatedPreviewContainer) generatedPreviewContainer.classList.add('has-image');
        if (previewsRow) previewsRow.classList.remove('single-preview');
        // Show clear button
        if (clearImagesBtn) clearImagesBtn.style.display = 'flex';
      } else {
        if (generatedSection) generatedSection.classList.add('hidden');
        if (generatedPreviewContainer) generatedPreviewContainer.classList.remove('has-image');
        if (previewsRow) previewsRow.classList.add('single-preview');
      }
    }
    
    // Update user data and token count
    if (changes.user) {
      const user = changes.user.newValue;
      if (user) {
        if (userName) userName.textContent = user.username;
        if (tokenCount) tokenCount.textContent = user.tokens || 0;
        
        // Show warning if user has no tokens
        if (user.tokens <= 0) {
          if (statusInfo) {
            statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
            statusInfo.style.color = "#dc2626";
          }
        }
      }
    }
  }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Set initial state with CSS placeholder
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.alt = "No image selected";
  }
  if (previewInfo) previewInfo.textContent = "No image selected";
  if (statusInfo) {
    statusInfo.textContent = "📁 Upload an image to get started";
    statusInfo.style.color = "#6b7280";
  }
  if (imgPreviewContainer) imgPreviewContainer.classList.remove('has-image');
  
  // Load saved item type
  chrome.storage.local.get(['itemType'], ({ itemType }) => {
    if (itemType && itemTypeInput) {
      itemTypeInput.value = itemType;
    }
  });
  
  // Update clear button visibility
  updateClearButtonVisibility();
});


