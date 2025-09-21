// Force right-click to work on protected images
(function() {
  'use strict';
  
  // Override context menu blocking
  document.addEventListener('contextmenu', function(e) {
    // Find the image element under the cursor
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const img = findImageElement(element);
    
    if (img) {
      // Store the clicked image URL for the extension to use
      const imageUrl = img.src || img.currentSrc || img.getAttribute('src');
      if (imageUrl && !imageUrl.startsWith('data:')) {
        window.lastClickedImageUrl = imageUrl;
        // Don't try to modify e.target - just stop propagation
        e.stopPropagation();
        return true;
      }
    }
  }, true);
  
  // Also handle mousedown to ensure right-click works
  document.addEventListener('mousedown', function(e) {
    if (e.button === 2) { // Right mouse button
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const img = findImageElement(element);
      
      if (img) {
        const imageUrl = img.src || img.currentSrc || img.getAttribute('src');
        if (imageUrl && !imageUrl.startsWith('data:')) {
          window.lastClickedImageUrl = imageUrl;
          // Don't try to modify e.target - just stop propagation
          e.stopPropagation();
        }
      }
    }
  }, true);
  
  // Find the actual image element, even if it's behind overlays
  function findImageElement(element) {
    if (!element) return null;
    
    // Check if current element is an image
    if (element.tagName === 'IMG') {
      return element;
    }
    
    // Check parent elements for images
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'IMG') {
        return parent;
      }
      parent = parent.parentElement;
    }
    
    // Check for images in the same container
    const container = element.closest('div, section, article, figure');
    if (container) {
      const img = container.querySelector('img');
      if (img) return img;
    }
    
    // Check for background images
    const style = window.getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      // Create a temporary img element to get the background image
      const tempImg = document.createElement('img');
      tempImg.style.position = 'absolute';
      tempImg.style.visibility = 'hidden';
      tempImg.style.pointerEvents = 'none';
      document.body.appendChild(tempImg);
      
      // Try to extract background image URL
      const bgImage = style.backgroundImage;
      const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (urlMatch) {
        tempImg.src = urlMatch[1];
        tempImg.onload = () => {
          document.body.removeChild(tempImg);
        };
        return tempImg;
      }
      document.body.removeChild(tempImg);
    }
    
    return null;
  }
  
  // Override any existing context menu prevention
  document.addEventListener('contextmenu', function(e) {
    const img = findImageElement(e.target);
    if (img) {
      // Allow the context menu to show
      e.stopImmediatePropagation();
      return true;
    }
  }, true);
  
})();