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

// Authentication functions
function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
  setTimeout(() => {
    authError.style.display = 'none';
  }, 5000);
}

function showAuthSection(user) {
  authSection.style.display = 'block';
  loginSection.style.display = 'none';
  mainSection.style.display = 'block';
  userName.textContent = user.username;
  tokenCount.textContent = user.tokens || 0;
  
  // Show warning if user has no tokens
  if (user.tokens <= 0) {
    statusInfo.textContent = "⚠️ No tokens remaining - purchase more to generate images";
    statusInfo.style.color = "#ef4444";
  } else {
    statusInfo.style.color = "#6b7280";
  }
}

function showLoginSection() {
  authSection.style.display = 'none';
  loginSection.style.display = 'block';
  mainSection.style.display = 'none';
  emailInput.value = '';
  passwordInput.value = '';
  usernameInput.value = '';
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3000/api/login', {
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
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username })
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
    imgPreview.removeAttribute('src');
    imgPreview.alt = "No image selected";
    previewInfo.textContent = "No image selected";
    statusInfo.textContent = "📁 Upload an image to get started";
    statusInfo.style.color = "#6b7280";
    generatedSection.style.display = "none";
    
    // Clear file input
    file.value = '';
    
    // Show login section
    showLoginSection();
    
    console.log('User logged out - all data cleared from Chrome storage');
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
    imgPreview.removeAttribute('src');
    imgPreview.alt = "No image selected";
    previewInfo.textContent = "No image selected";
    statusInfo.textContent = "📁 Upload an image to get started";
  }
  
  // Handle generated image preview
  if (generatedImage) {
    generatedPreview.src = generatedImage;
    generatedPreview.alt = "Generated image";
    generatedSection.style.display = "block";
    statusInfo.textContent = "🎨 Generated image available";
    
    // Add debug info for generated image dimensions
    generatedPreview.onload = function() {
      console.log('Generated image in popup dimensions:', this.naturalWidth, 'x', this.naturalHeight);
      console.log('Generated image aspect ratio:', (this.naturalWidth / this.naturalHeight).toFixed(2));
    };
  } else {
    generatedSection.style.display = "none";
  }
});

// Authentication event listeners
loginBtn.addEventListener("click", login);
registerBtn.addEventListener("click", register);
logoutBtn.addEventListener("click", logout);

// Show/hide username field for registration
registerBtn.addEventListener("mousedown", () => {
  usernameInput.style.display = 'block';
});

loginBtn.addEventListener("mousedown", () => {
  usernameInput.style.display = 'none';
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
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    // Clear generated image when new image is uploaded
    chrome.storage.local.set({ userImage: dataUrl, generatedImage: null }, () => {
      imgPreview.src = dataUrl;
      imgPreview.alt = "Uploaded image";
      previewInfo.textContent = "Image saved (" + Math.round((f.size/1024)) + " KB)";
      statusInfo.textContent = "✅ Ready to replace images";
      generatedSection.style.display = "none";
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
        generatedSection.style.display = "block";
        statusInfo.textContent = "🎨 Generated image available";
        statusInfo.style.color = "#6b7280";
      } else {
        generatedSection.style.display = "none";
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
          statusInfo.style.color = "#ef4444";
        }
      }
    }
  }
});


