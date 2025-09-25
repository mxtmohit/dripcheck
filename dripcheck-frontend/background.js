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
  // Set default to enabled on first install
  chrome.storage.local.get({ enabled: true }, ({ enabled }) => refreshMenu(enabled));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    // Handle extension enable/disable
    if (changes.enabled) {
      const enabled = Boolean(changes.enabled.newValue);
      refreshMenu(enabled);
      if (!enabled) {
        // Remove any in-page indicators across all tabs when extension turned off
        try {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((t) => {
              if (!t.id) return;
              chrome.scripting.executeScript({
                target: { tabId: t.id },
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
            });
          });
        } catch (_) {}
      }
    }
    
    // Handle user logout - clear any cached data
    if (changes.authToken && !changes.authToken.newValue) {
      // Clear any cached user-specific data
      chrome.storage.local.remove(['userImage', 'generatedImage'], () => {});
    }
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "replaceImage") {
    chrome.storage.local.get({ userImage: null, generatedImage: null, user: null, authToken: null, enabled: false }, ({ userImage, generatedImage, user, authToken, enabled }) => {
      // Always use the original uploaded image as base, never the generated image
      const imageToUse = userImage;
      
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
          const existingTop = document.getElementById('dripcheck-top-indicator');
          if (existingTop) existingTop.remove();
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
          
          // Prefer the explicitly marked target if available
          let targetImg = document.querySelector('img[data-dripcheck-target="1"]');
          if (!targetImg) {
            // Fallback: match by URL heuristics
            targetImg = document.querySelector(`img[src="${imageUrl}"], img[src*="${imageUrl}"], img[data-src="${imageUrl}"]`) || 
                         document.querySelector(`img[src="${window.lastClickedImageUrl}"]`) ||
                         document.querySelector(`img[src*="${window.lastClickedImageUrl}"]`);
          }
          
          if (targetImg) {
            
            // Store original image for restoration if needed
            targetImg.setAttribute('data-original-src', targetImg.src);
            
            // Get image dimensions for better positioning
            const imgRect = targetImg.getBoundingClientRect();
            const imgParent = targetImg.parentElement;
            
            // Create image overlay spinner with improved positioning
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
              pointer-events: none;
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
              text-align: center;
            `;
            aiText.textContent = 'AI Generating...';
            
            spinnerContainer.appendChild(spinner);
            spinnerContainer.appendChild(aiText);
            
            // Enhanced parent positioning for Google Images and other complex layouts
            if (imgParent) {
              const computedStyle = window.getComputedStyle(imgParent);
              
              // For Google Images g-img elements and similar containers
              if (computedStyle.position === 'static') {
                imgParent.style.position = 'relative';
              }
              
              // Ensure the parent has proper dimensions
              if (imgParent.offsetWidth === 0 || imgParent.offsetHeight === 0) {
                imgParent.style.width = imgRect.width + 'px';
                imgParent.style.height = imgRect.height + 'px';
              }
              
              // Add spinner overlay on top of image
              targetImg.setAttribute('data-spinner-active', 'true');
              imgParent.appendChild(spinnerContainer);
              
            } else {
              // Fallback: add directly to image if no suitable parent
              targetImg.style.position = 'relative';
              targetImg.setAttribute('data-spinner-active', 'true');
              targetImg.appendChild(spinnerContainer);
            }
          } else {
            // no-op if target image not found; top-right indicator remains
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
      if (response.status === 422) {
        // Policy or unedited-image condition from backend
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (msg) => {
            const spinnerContainer = document.getElementById('dripcheck-spinner-container');
            if (spinnerContainer) spinnerContainer.remove();
            const topIndicator = document.getElementById('dripcheck-top-indicator');
            if (topIndicator) topIndicator.remove();
            const imgs = document.querySelectorAll('img[data-spinner-active="true"]');
            imgs.forEach(img => {
              const p = img.parentElement;
              if (p && p.style.position === 'relative') p.style.position = '';
              img.removeAttribute('data-spinner-active');
            });
            alert('Generation blocked: ' + (msg || 'Unprocessable Request'));
          },
          args: [errorData?.details || errorData?.error]
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
      // silent fail on refresh error in background
    }
    
    // Replace the image on the page
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (resultImageDataUrl, originalUrl) => {
        // Always attempt to remove loading indicators when backend completes
        const spinnerContainer = document.getElementById('dripcheck-spinner-container');
        if (spinnerContainer) {
          spinnerContainer.remove();
        }
        const topIndicator = document.getElementById('dripcheck-top-indicator');
        if (topIndicator) {
          topIndicator.remove();
        }
        const imgsActive = document.querySelectorAll('img[data-spinner-active="true"]');
        imgsActive.forEach(img => {
          const p = img.parentElement;
          if (p && p.style.position === 'relative') {
            p.style.position = '';
          }
          img.removeAttribute('data-spinner-active');
        });

        // Prefer the explicitly marked target if available
        let targetImg = document.querySelector('img[data-dripcheck-target="1"]');
        if (!targetImg) {
          // Fallback to URL-based selection
          const clickedUrl = window.lastClickedImageUrl || originalUrl;
          targetImg = document.querySelector(`img[src="${clickedUrl}"], img[src*="${clickedUrl}"], img[data-src="${clickedUrl}"]`) ||
                      document.querySelector(`img[src="${originalUrl}"], img[src*="${originalUrl}"], img[data-src="${originalUrl}"]`);
        }
        
        if (targetImg) {
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
          // Also attempt to clear picture sources to avoid site overrides
          const picture = targetImg.closest('picture');
          if (picture) {
            const sources = picture.querySelectorAll('source');
            sources.forEach(s => s.removeAttribute('srcset'));
          }
          
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
            
            // Store the original container dimensions to preserve layout
            const originalContainerWidth = targetImg.offsetWidth;
            const originalContainerHeight = targetImg.offsetHeight;
            
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
            
          };
          tempImg.src = resultImageDataUrl;
          
          // Clear explicit target marker if present
          try { targetImg.removeAttribute('data-dripcheck-target'); } catch (_) {}
          // Mark as replaced for future reference
          targetImg.setAttribute('data-replaced', 'true');
          // Set the AI-generated result image and enforce it temporarily
          const desiredSrc = resultImageDataUrl;
          targetImg.src = desiredSrc;
          const enforce = () => {
            // If any lazy loaders try to revert, clear again
            targetImg.removeAttribute('srcset');
            targetImg.removeAttribute('sizes');
            const pic = targetImg.closest('picture');
            if (pic) {
              pic.querySelectorAll('source').forEach(s => s.removeAttribute('srcset'));
            }
            if (targetImg.src !== desiredSrc) {
              targetImg.src = desiredSrc;
            }
          };
          targetImg.onload = enforce;
          // Observe for attribute changes for a short time to fight site scripts
          const observer = new MutationObserver(() => enforce());
          observer.observe(targetImg, { attributes: true, attributeFilter: ['src', 'srcset', 'sizes'] });
          setTimeout(() => {
            try { observer.disconnect(); } catch (_) {}
          }, 3000);
        } else {
          // silent fail if target image is not found
        }
      },
      args: [result.generatedImage, pageImageUrl]
    });
    
    // Loading indicators are already removed in the image replacement function
    
  } catch (error) {
    // silent in background; user-facing alerts already handled in content context
    
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

