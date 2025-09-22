// Import configuration
importScripts('config.js');

// Create/remove context menu based on toggle
function refreshMenu(enabled) {
  chrome.contextMenus.removeAll(() => {
    if (enabled) {
      chrome.contextMenus.create({ id: "replaceImage", title: "Try-On this item", contexts: ["image"] });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ enabled: false }, ({ enabled }) => refreshMenu(enabled));
  });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    // Handle extension enable/disable
    if (changes.enabled) {
      refreshMenu(Boolean(changes.enabled.newValue));
    }
    
    // Handle user logout - clear any cached data
    if (changes.authToken && !changes.authToken.newValue) {
      console.log('User logged out - clearing cached data');
      // Clear any cached user-specific data
      chrome.storage.local.remove(['userImage', 'generatedImage'], () => {
        console.log('Cached user data cleared from background script');
      });
    }
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  if (info.menuItemId === "replaceImage") {
    console.log('Replace image clicked, starting process...');
    chrome.storage.local.get({ userImage: null, generatedImage: null, user: null, authToken: null, enabled: false }, ({ userImage, generatedImage, user, authToken, enabled }) => {
      // Always use the original uploaded image as base, never the generated image
      const imageToUse = userImage;
      
      console.log('Using base image:', userImage ? 'Original uploaded image' : 'None');
      console.log('Generated image available:', generatedImage ? 'Yes' : 'No');
      console.log('User tokens:', user?.tokens || 0);
      console.log('Auth token:', authToken ? 'Present' : 'Missing');
      console.log('Extension enabled:', enabled);
      
      // Check if extension is enabled
      if (!enabled) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Extension is disabled. Please enable it in the extension popup.")
        });
        return;
      }
      
      if (!imageToUse) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Please upload an image first in the extension popup")
        });
        return;
      }
      
      // Check if user is authenticated
      if (!authToken || !user) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            alert("Please login to use the extension. Open the extension popup to login.");
          }
        });
        return;
      }
      
      // Check if user has tokens
      if (user.tokens <= 0) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            alert("Can't generate - you have 0 tokens left!\n\nPlease purchase more tokens to continue using the extension.");
          }
        });
        return;
      }
      
      // Get the image URL from the right-clicked image
      const imageUrl = info.srcUrl || info.linkUrl;
      console.log('Using image URL:', imageUrl);
      
      if (!imageUrl) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            alert('Could not get image URL. Please try right-clicking directly on an image.');
          }
        });
        return;
      }
      
      // Show loading indicators (both image-based and top-right fallback)
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (imageUrl) => {
          // Add CSS animations first
          if (!document.getElementById('dripcheck-spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'dripcheck-spinner-styles';
            style.textContent = `
              @keyframes dripcheck-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes dripcheck-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `;
            document.head.appendChild(style);
          }
          
          // Create top-right fallback indicator (always show)
          const topRightIndicator = document.createElement('div');
          topRightIndicator.id = 'dripcheck-top-indicator';
          topRightIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 999999;
            box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
            animation: dripcheck-pulse 2s ease-in-out infinite;
          `;
          
          const spinnerIcon = document.createElement('div');
          spinnerIcon.style.cssText = `
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: dripcheck-spin 1s linear infinite;
          `;
          
          const text = document.createElement('span');
          text.textContent = 'DripCheck AI Generating...';
          
          topRightIndicator.appendChild(spinnerIcon);
          topRightIndicator.appendChild(text);
          document.body.appendChild(topRightIndicator);
          
          // Try to find and overlay spinner on the target image
          const imgs = document.querySelectorAll("img");
          let targetImg = null;
          
          // More robust image finding logic
          for (let img of imgs) {
            const imgSrc = img.src || img.currentSrc || img.getAttribute('src') || '';
            const imgSrcset = img.srcset || '';
            
            if (imgSrc === imageUrl || 
                img.currentSrc === imageUrl || 
                imgSrcset.includes(imageUrl) ||
                imgSrc.includes(imageUrl) ||
                imageUrl.includes(imgSrc) ||
                // Additional checks for different URL formats
                decodeURIComponent(imgSrc) === decodeURIComponent(imageUrl) ||
                imgSrc.replace(/[?#].*/, '') === imageUrl.replace(/[?#].*/, '')) {
              targetImg = img;
              break;
            }
          }
          
          if (targetImg) {
            console.log('Found target image, adding overlay spinner');
            
            // Store original image for restoration if needed
            targetImg.setAttribute('data-original-src', targetImg.src);
            
            // Create image overlay spinner
            const spinnerContainer = document.createElement('div');
            spinnerContainer.id = 'dripcheck-spinner-container';
            spinnerContainer.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: rgba(248, 250, 252, 0.95);
              backdrop-filter: blur(2px);
              z-index: 1000;
              border-radius: 4px;
            `;
            
            const spinner = document.createElement('div');
            spinner.style.cssText = `
              width: 32px;
              height: 32px;
              border: 3px solid #e2e8f0;
              border-top: 3px solid #3b82f6;
              border-radius: 50%;
              animation: dripcheck-spin 1s linear infinite;
              margin-bottom: 12px;
            `;
            
            const aiText = document.createElement('div');
            aiText.style.cssText = `
              color: #6b7280;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 13px;
              font-weight: 500;
            `;
            aiText.textContent = 'AI Generating...';
            
            spinnerContainer.appendChild(spinner);
            spinnerContainer.appendChild(aiText);
            
            // Make image container relative positioned for absolute spinner
            const imgParent = targetImg.parentElement;
            if (imgParent) {
              const computedStyle = window.getComputedStyle(imgParent);
              if (computedStyle.position === 'static') {
                imgParent.style.position = 'relative';
              }
            }
            
            // Add spinner overlay on top of image
            targetImg.setAttribute('data-spinner-active', 'true');
            targetImg.parentNode.appendChild(spinnerContainer);
          } else {
            console.log('Target image not found, using top-right indicator only');
          }
        },
        args: [imageUrl]
      });
      
      // Send to backend with URL instead of captured image data
      sendToBackendWithUrl(imageUrl, imageToUse, tab.id);
    });
  }
});

async function sendToBackendWithUrl(pageImageUrl, userImageDataUrl, tabId) {
  try {
    console.log('Sending to backend - Base image (uploaded):', userImageDataUrl.substring(0, 50) + '...');
    console.log('Overlay image (webpage URL):', pageImageUrl);
    
    // Get authentication token and item type
    const { authToken, itemType } = await chrome.storage.local.get(['authToken', 'itemType']);
    
    if (!authToken) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Remove all loading indicators
            const spinnerContainer = document.getElementById('dripcheck-spinner-container');
            if (spinnerContainer) {
              spinnerContainer.remove();
            }
            
            const topIndicator = document.getElementById('dripcheck-top-indicator');
            if (topIndicator) {
              topIndicator.remove();
            }
            
            // Clean up any position changes we made
            const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
            imgs.forEach(img => {
              const imgParent = img.parentElement;
              if (imgParent && imgParent.style.position === 'relative') {
                imgParent.style.position = '';
              }
              img.removeAttribute('data-spinner-active');
            });
            
            alert('Please login to use the extension. Open the extension popup to login.');
          }
        });
      return;
    }
    
    const response = await fetch(CONFIG.getApiUrl('GENERATE'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        baseUrl: userImageDataUrl,    // Your uploaded image (base64 data URL) - this is the base
        overlayUrl: pageImageUrl,     // The webpage image URL - this is the overlay
        itemType: itemType || null    // Optional item type override from user input
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        // Authentication error - user needs to login again
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Remove all loading indicators
            const spinnerContainer = document.getElementById('dripcheck-spinner-container');
            if (spinnerContainer) {
              spinnerContainer.remove();
            }
            
            const topIndicator = document.getElementById('dripcheck-top-indicator');
            if (topIndicator) {
              topIndicator.remove();
            }
            
            // Clean up any position changes we made
            const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
            imgs.forEach(img => {
              const imgParent = img.parentElement;
              if (imgParent && imgParent.style.position === 'relative') {
                imgParent.style.position = '';
              }
              img.removeAttribute('data-spinner-active');
            });
            
            alert('Session expired. Please login again in the extension popup.');
          }
        });
        
        // Clear authentication data
        chrome.storage.local.remove(['authToken', 'user'], () => {
          console.log('Authentication data cleared due to 401 error');
        });
        return;
      }
      if (response.status === 402) {
        // No tokens remaining
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Remove all loading indicators
            const spinnerContainer = document.getElementById('dripcheck-spinner-container');
            if (spinnerContainer) {
              spinnerContainer.remove();
            }
            
            const topIndicator = document.getElementById('dripcheck-top-indicator');
            if (topIndicator) {
              topIndicator.remove();
            }
            
            // Clean up any position changes we made
            const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
            imgs.forEach(img => {
              const imgParent = img.parentElement;
              if (imgParent && imgParent.style.position === 'relative') {
                imgParent.style.position = '';
              }
              img.removeAttribute('data-spinner-active');
            });
            
            alert('No tokens remaining! Please purchase more tokens to continue.');
          }
        });
        return;
      }
      throw new Error(errorData.error || `Backend error: ${response.status}`);
    }
    
    // Get the result from your backend
    const result = await response.json();
    
    if (!result.generatedImage) {
      throw new Error('No image generated by backend');
    }
    
    // Store the generated image for future use
    chrome.storage.local.set({ generatedImage: result.generatedImage }, () => {
      console.log('Generated image saved to storage');
    });
    
    // Refresh user token count
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      if (authToken) {
        const profileResponse = await fetch(CONFIG.getApiUrl('PROFILE'), {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          chrome.storage.local.set({ user: profileData.user });
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
    
    // Replace the image on the page
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (resultImageDataUrl, originalUrl) => {
        console.log('Starting image replacement process...');
        console.log('Looking for URL:', originalUrl);
        console.log('Stored URL:', window.lastClickedImageUrl);
        
        const imgs = document.querySelectorAll("img");
        console.log('Found', imgs.length, 'images on page');
        
        let targetImg = null;
        
        // Find the image that was right-clicked using the stored URL
        const clickedUrl = window.lastClickedImageUrl || originalUrl;
        console.log('Using clicked URL:', clickedUrl);
        
        for (let img of imgs) {
          console.log('Checking image:', img.src);
          if (img.src === clickedUrl || 
              img.currentSrc === clickedUrl || 
              img.srcset?.includes(clickedUrl) ||
              img.getAttribute('src') === clickedUrl ||
              img.src.includes(clickedUrl) ||
              clickedUrl.includes(img.src)) {
            targetImg = img;
            console.log('Found matching image!');
            break;
          }
        }
        
        if (targetImg) {
          console.log('Replacing image with generated result...');
          
          // Remove all loading indicators
          const spinnerContainer = document.getElementById('dripcheck-spinner-container');
          if (spinnerContainer) {
            spinnerContainer.remove();
          }
          
          const topIndicator = document.getElementById('dripcheck-top-indicator');
          if (topIndicator) {
            topIndicator.remove();
          }
          
          // Clean up any position changes we made
          const imgParent = targetImg.parentElement;
          if (imgParent && imgParent.style.position === 'relative') {
            // Only reset if we set it to relative
            imgParent.style.position = '';
          }
          
          // Show the image again
          targetImg.removeAttribute('data-spinner-active');
          
          // Prevent site-provided responsive sources from swapping our image
          targetImg.removeAttribute('srcset');
          targetImg.removeAttribute('sizes');
          
          // Store original dimensions to maintain aspect ratio
          const originalWidth = targetImg.naturalWidth || targetImg.width;
          const originalHeight = targetImg.naturalHeight || targetImg.height;
          
          // Create a temporary image to get the generated image dimensions
          const tempImg = new Image();
          tempImg.onload = function() {
            const generatedWidth = tempImg.naturalWidth;
            const generatedHeight = tempImg.naturalHeight;
            
            // Calculate aspect ratios
            const originalAspect = originalWidth / originalHeight;
            const generatedAspect = generatedWidth / generatedHeight;
            
            console.log('=== IMAGE REPLACEMENT DEBUG ===');
            console.log('Original image dimensions:', originalWidth, 'x', originalHeight);
            console.log('Original aspect ratio:', originalAspect.toFixed(2));
            console.log('Generated image dimensions:', generatedWidth, 'x', generatedHeight);
            console.log('Generated aspect ratio:', generatedAspect.toFixed(2));
            console.log('Target element current size:', targetImg.offsetWidth, 'x', targetImg.offsetHeight);
            console.log('Target element computed styles:', {
              width: window.getComputedStyle(targetImg).width,
              height: window.getComputedStyle(targetImg).height,
              objectFit: window.getComputedStyle(targetImg).objectFit
            });
            
            // Store the original container dimensions to preserve layout
            const originalContainerWidth = targetImg.offsetWidth;
            const originalContainerHeight = targetImg.offsetHeight;
            
            console.log('Original container size:', originalContainerWidth, 'x', originalContainerHeight);
            
            // Apply styles to fit within original bounds without cropping
            targetImg.style.setProperty('object-fit', 'contain', 'important');
            targetImg.style.setProperty('object-position', 'center center', 'important');
            
            // Keep the image within the original container bounds
            targetImg.style.setProperty('width', originalContainerWidth + 'px', 'important');
            targetImg.style.setProperty('height', originalContainerHeight + 'px', 'important');
            targetImg.style.setProperty('max-width', originalContainerWidth + 'px', 'important');
            targetImg.style.setProperty('max-height', originalContainerHeight + 'px', 'important');
            targetImg.style.setProperty('min-width', '0', 'important');
            targetImg.style.setProperty('min-height', '0', 'important');
            
            // Ensure the parent container maintains its original size
            const parent = targetImg.parentElement;
            if (parent) {
              // Don't change parent dimensions - keep original layout
              parent.style.setProperty('overflow', 'hidden', 'important');
              parent.style.setProperty('display', 'block', 'important');
            }
            
            console.log('Applied container-constrained sizing:', originalContainerWidth, 'x', originalContainerHeight);
            console.log('Generated image will fit within bounds using object-fit: contain');
            
            // Log final computed styles after our changes
            setTimeout(() => {
              console.log('Final computed styles after our changes:', {
                width: window.getComputedStyle(targetImg).width,
                height: window.getComputedStyle(targetImg).height,
                objectFit: window.getComputedStyle(targetImg).objectFit,
                objectPosition: window.getComputedStyle(targetImg).objectPosition
              });
              console.log('Final element size:', targetImg.offsetWidth, 'x', targetImg.offsetHeight);
              console.log('=== END DEBUG ===');
            }, 100);
          };
          tempImg.src = resultImageDataUrl;
          
          // Mark as replaced for future reference
          targetImg.setAttribute('data-replaced', 'true');
          // Set the AI-generated result image
          targetImg.src = resultImageDataUrl;
          console.log('Image replaced successfully with generated image');
        } else {
          console.error('Could not find target image to replace');
          console.log('Available image URLs:', Array.from(imgs).map(img => img.src));
        }
      },
      args: [result.generatedImage, pageImageUrl]
    });
    
    // Loading indicators are already removed in the image replacement function
    
  } catch (error) {
    console.error('Backend request failed:', error);
    
    // Remove loading indicator and show error
     chrome.scripting.executeScript({
       target: { tabId: tabId },
       func: (errorMsg) => {
         // Remove all loading indicators
         const spinnerContainer = document.getElementById('dripcheck-spinner-container');
         if (spinnerContainer) {
           spinnerContainer.remove();
         }
         
         const topIndicator = document.getElementById('dripcheck-top-indicator');
         if (topIndicator) {
           topIndicator.remove();
         }
         
         // Clean up any position changes we made
         const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
         imgs.forEach(img => {
           const imgParent = img.parentElement;
           if (imgParent && imgParent.style.position === 'relative') {
             imgParent.style.position = '';
           }
           img.removeAttribute('data-spinner-active');
         });
         
         alert('Failed to process image: ' + errorMsg);
       },
       args: [error.message]
     });
  }
}

function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

