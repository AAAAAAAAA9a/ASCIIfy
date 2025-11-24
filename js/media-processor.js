const MediaProcessor = {
  core: null,
  
  // Cache for ASCII character mappings to improve performance
  charCache: new Map(),
  edgeCache: new Map(),
  
  init(coreModule) {
    this.core = coreModule;
    this.loadDefaultImage();
  },
  
  // =============================================================================
  // FILE PROCESSING ENTRY POINT
  // =============================================================================
  
  processFile(file) {
    console.log('Processing file:', file.name, 'Type:', file.type);
    this.core.cleanupMedia();
    this.core.state.frames = [];
    
    // Reset export state
    this.core.state.exportFrames = [];
    this.core.state.hasExportCapture = false;
    
    // Determine file type and process accordingly
    if (file.type === 'image/gif') {
      console.log('Processing GIF');
      this.processGifFile(file);
    } else if (file.type.startsWith('image/')) {
      console.log('Processing as image');
      this.core.state.currentFileType = 'image';
      
      // Update UI for image mode
      UIManager.toggleContentState(true, false);
      this.processImageFile(file);
      
    } else if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov|avi)$/i)) {
      console.log('Processing as video');
      this.core.state.currentFileType = 'video';
      
      // Update UI for video mode
      UIManager.toggleContentState(true, true);
      this.processVideoFile(file);
      
    } else {
      console.log('Unsupported file type:', file.type);
      this.core.showMessage('Unsupported file type. Please upload an image or video.', 'error');
      return;
    }
    
    // Enable export controls
    const startExportBtn = document.getElementById('startExport');
    if (startExportBtn) startExportBtn.disabled = false;
    
    const previewAnimBtn = document.getElementById('previewAnimation');
    if (previewAnimBtn) previewAnimBtn.disabled = false;
  },

  // =============================================================================
  // GIF PROCESSING
  // =============================================================================

  processGifFile(file) {
    this.core.showMessage('Parsing GIF frames...', 'info', 0, true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target.result);
        
        // Robust check for GifReader
        const GifReader = (window.exports && window.exports.GifReader) || window.GifReader || (window.omggif && window.omggif.GifReader);
        
        if (!GifReader) {
            console.error('GIF Library Debug:', { 
              exports: window.exports, 
              GifReader: window.GifReader,
              omggif: window.omggif 
            });
            throw new Error('GIF library not loaded correctly. Please refresh the page.');
        }

        const gifReader = new GifReader(buffer);
        
        const width = gifReader.width;
        const height = gifReader.height;
        const frames = [];
        
        // Extract all frames
        for (let i = 0; i < gifReader.numFrames(); i++) {
          const frameInfo = gifReader.frameInfo(i);
          const pixels = new Uint8ClampedArray(width * height * 4);
          gifReader.decodeAndBlitFrameRGBA(i, pixels);
          
          frames.push({
            data: new ImageData(pixels, width, height),
            delay: Math.max(frameInfo.delay * 10, 30) // Convert to ms, min 30ms
          });
        }
        
        this.core.state.gifFrames = frames;
        this.core.state.currentGifFrameIndex = 0;
        this.core.state.currentFileType = 'gif';
        
        // Create a buffer canvas for the GIF frames
        if (!this.core.state.gifCanvas) {
            this.core.state.gifCanvas = document.createElement('canvas');
        }
        this.core.state.gifCanvas.width = width;
        this.core.state.gifCanvas.height = height;
        
        this.core.showMessage(`GIF loaded: ${frames.length} frames`, 'success');
        
        // Show controls and start playing
        UIManager.toggleContentState(true, true); // Show controls (treat as video)
        this.playGif();
        
      } catch (error) {
        console.error('Error parsing GIF:', error);
        this.core.showMessage(`Error parsing GIF: ${error.message}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  playGif() {
    if (this.core.state.gifFrames.length === 0) return;
    
    this.core.state.isGifPlaying = true;
    this.updatePlayPauseIcon(true);
    this.renderGifLoop();
  },

  pauseGif() {
    this.core.state.isGifPlaying = false;
    this.updatePlayPauseIcon(false);
    if (this.core.state.gifInterval) {
      clearTimeout(this.core.state.gifInterval);
      this.core.state.gifInterval = null;
    }
  },

  stopGif() {
    this.pauseGif();
    this.core.state.currentGifFrameIndex = 0;
    if (this.core.state.gifFrames.length > 0) {
      this.renderGifFrame(0);
    }
  },

  renderGifLoop() {
    if (!this.core.state.isGifPlaying) return;

    const frameIndex = this.core.state.currentGifFrameIndex;
    const frame = this.core.state.gifFrames[frameIndex];
    
    this.renderGifFrame(frameIndex);
    
    // Update counters
    const frameCounter = document.getElementById('frameCounter');
    if (frameCounter) {
      frameCounter.textContent = `${frameIndex + 1}/${this.core.state.gifFrames.length}`;
    }

    // Schedule next frame
    this.core.state.currentGifFrameIndex = (frameIndex + 1) % this.core.state.gifFrames.length;
    
    this.core.state.gifInterval = setTimeout(() => {
      requestAnimationFrame(() => this.renderGifLoop());
    }, frame.delay);
  },

  renderGifFrame(index) {
      const frame = this.core.state.gifFrames[index];
      const ctx = this.core.state.gifCanvas.getContext('2d');
      ctx.putImageData(frame.data, 0, 0);
      this.processMedia(this.core.state.gifCanvas);
  },

  updatePlayPauseIcon(isPlaying) {
    const btn = document.getElementById('playPauseButton');
    if (!btn) return;
    
    btn.innerHTML = isPlaying 
      ? `<svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
      : `<svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
  },
  
  // =============================================================================
  // IMAGE PROCESSING
  // =============================================================================
  
  processImageFile(file) {
    this.core.showMessage('Processing image...', 'info', 0, true);
    
    const objectURL = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      this.core.state.currentMedia = img;
      this.processMedia(img);
      
      this.core.showMessage('Image loaded', 'success');
      
      // Clean up memory
      URL.revokeObjectURL(objectURL);
    };
    
    img.onerror = () => {
      this.core.showMessage('Error loading image. Please try another file.', 'error');
      URL.revokeObjectURL(objectURL);
    };
    
    img.src = objectURL;
  },
  
  // =============================================================================
  // VIDEO PROCESSING
  // =============================================================================
  
  processVideoFile(file) {
    this.core.state.currentMedia = null;
    this.core.showMessage('Processing video...', 'info', 0, true);
    
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.loop = true; // Default to loop for preview
    video.playsInline = true;
    
    const videoURL = URL.createObjectURL(file);
    this.core.state.videoObjectURL = videoURL;
    video.src = videoURL;
    
    // Safety timeout in case video never loads
    const loadingTimeout = setTimeout(() => {
      if (video.readyState < 2) {
        this.core.showMessage('Video loading timeout. Please try another file.', 'error');
        this.cleanupVideoResources(video, videoURL);
      }
    }, 30000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(loadingTimeout);
      
      if (!video.videoWidth || !video.videoHeight) {
        this.core.showMessage('Invalid video dimensions.', 'error');
        this.cleanupVideoResources(video, videoURL);
        return;
      }
      
      // Optimize canvas size for performance
      const maxWidth = this.core.state.maxProcessingWidth;
      const aspectRatio = video.videoHeight / video.videoWidth;
      const optimizedWidth = Math.min(video.videoWidth, maxWidth);
      const optimizedHeight = Math.round(optimizedWidth * aspectRatio);
      
      if (this.core.state.videoCanvas) {
        this.core.state.videoCanvas.width = optimizedWidth;
        this.core.state.videoCanvas.height = optimizedHeight;
      }
      
      this.core.state.video = video;
      this.core.state.currentMedia = video;
      
      this.core.showMessage('Video loaded. Live preview starting...', 'success');
      
      // Initialize counters
      if (CaptureEngine && CaptureEngine.updateFrameCountAndProgress) {
        setTimeout(() => CaptureEngine.updateFrameCountAndProgress(), 100);
      }
      
      // Start preview
      if (CaptureEngine && CaptureEngine.startPreview) {
        setTimeout(() => {
          CaptureEngine.startPreview();
        }, 300);
      }
    });
    
    video.addEventListener('error', (e) => {
      clearTimeout(loadingTimeout);
      console.error('Video loading error:', e);
      this.core.showMessage('Error loading video. Format may not be supported.', 'error');
      this.cleanupVideoResources(video, videoURL);
    });
  },
  
  cleanupVideoResources(videoElement, videoURL) {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    if (videoURL) URL.revokeObjectURL(videoURL);
    if (this.core.state.videoObjectURL) {
      URL.revokeObjectURL(this.core.state.videoObjectURL);
      this.core.state.videoObjectURL = null;
    }
  },
  
  // =============================================================================
  // MEDIA PROCESSING CORE
  // =============================================================================
  
  processMedia(media) {
    try {
      const settings = UIManager.getSettings();
      
      if (!media || !media.width || !media.height) {
        // For video elements, use videoWidth/videoHeight
        if (media.videoWidth && media.videoHeight) {
           // It's a video, but processMedia usually handles images or single frames.
           // If passed a video element directly, we might want to draw the current frame.
        } else {
           throw new Error('Invalid media dimensions');
        }
      }
      
      // Calculate dimensions
      // Font aspect ratio correction (courier/monospace is usually taller than wide)
      const FONT_ASPECT_RATIO = 0.55; 
      
      const asciiWidth = Math.min(settings.width, this.core.state.maxProcessingWidth);
      const mediaWidth = media.videoWidth || media.width;
      const mediaHeight = media.videoHeight || media.height;
      const asciiHeight = Math.round((mediaHeight / mediaWidth) * asciiWidth * FONT_ASPECT_RATIO);
      
      this.core.state.frameWidth = asciiWidth;
      this.core.state.frameHeight = asciiHeight;
      
      // Get canvas
      const canvas = document.getElementById('canvas');
      if (!canvas) throw new Error('Canvas element not found');
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Resize canvas
      if (canvas.width !== asciiWidth || canvas.height !== asciiHeight) {
        canvas.width = asciiWidth;
        canvas.height = asciiHeight;
      }
      
      // Apply blur if needed
      ctx.filter = settings.blur > 0 ? `blur(${settings.blur}px)` : "none";
      
      // Draw media to canvas
      ctx.drawImage(media, 0, 0, asciiWidth, asciiHeight);
      
      // Get pixel data
      const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
      
      // Process pixels to ASCII
      const ascii = this.convertToAscii(imageData, settings);
      
      // Update state
      if (this.core.state.currentFileType === 'image') {
        this.core.state.frames = [ascii];
      }
      
      // Update DOM
      document.getElementById('ascii-art').textContent = ascii;
      
      return ascii;
    } catch (error) {
      console.error('Error processing media:', error);
      this.core.showMessage(`Error processing media: ${error.message}`, 'error');
      return '';
    }
  },
  
  // Helper for video frames (avoids resizing canvas repeatedly if dimensions match)
  processFrame(imageData) {
    const settings = UIManager.getSettings();
    return this.convertToAscii(imageData, settings);
  },
  
  convertToAscii(imageData, settings) {
    const { width, height, data } = imageData;
    const pixelCount = width * height;
    
    // Pre-calculate contrast factor
    // Formula: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
    const contrast = settings.contrast;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightness = settings.brightness;
    
    // Grayscale buffer
    const gray = new Uint8Array(pixelCount);
    const grayOriginal = settings.edgeDetection ? new Uint8Array(pixelCount) : null;
    
    // Weights for RGB to Grayscale (Luma)
    const R_WEIGHT = 0.299;
    const G_WEIGHT = 0.587;
    const B_WEIGHT = 0.114;
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Calculate luminance
      let lum = (R_WEIGHT * r + G_WEIGHT * g + B_WEIGHT * b) | 0;
      
      // Invert if needed
      if (settings.invert) lum = 255 - lum;
      
      // Apply contrast and brightness
      // Formula: factor * (color - 128) + 128 + brightness
      let adjusted = (contrastFactor * (lum - 128) + 128 + brightness) | 0;
      
      // Clamp to 0-255
      adjusted = adjusted < 0 ? 0 : (adjusted > 255 ? 255 : adjusted);
      
      gray[j] = adjusted;
      if (grayOriginal) grayOriginal[j] = adjusted;
    }
    
    // Apply Edge Detection if enabled
    const processedGray = settings.edgeDetection ? 
      this.applyEdgeDetection(gray, width, height, 100) : gray;
    
    // Map pixels to characters
    return this.mapPixelsToChars(
      processedGray, 
      width, 
      height, 
      settings.ignoreWhite, 
      settings.charset, 
      grayOriginal, 
      settings.edgeDetection
    );
  },
  
  mapPixelsToChars(gray, width, height, ignoreWhite, charset, grayOriginal, isEdgeDetection) {
    // Get gradient string based on charset
    let gradient = this.core.state.cachedGradients[charset];
    if (!gradient) {
      switch(charset) {
        case 'blocks': gradient = "█▓▒░ "; break;
        case 'standard': gradient = "@%#*+=-:. "; break;
        case 'simple': gradient = " .:-=+*#%@"; break; // Reversed for light-on-dark usually
        case 'binary': default: gradient = "10"; break;
      }
      this.core.state.cachedGradients[charset] = gradient;
    }
    
    const nLevels = gradient.length;
    const scaleFactor = (nLevels - 1) / 255;
    const WHITE_CUTOFF = 250; // Threshold for "pure white" to be transparent/space
    
    // Cache mapping array for this specific configuration
    const cacheKey = `${charset}_${ignoreWhite}_${nLevels}`;
    let charMapping = this.charCache.get(cacheKey);
    
    if (!charMapping) {
      charMapping = new Array(256);
      for (let i = 0; i < 256; i++) {
        if (ignoreWhite && i >= WHITE_CUTOFF) {
          charMapping[i] = ' '; // Transparent/Space
        } else {
          // Map 0-255 to 0-(nLevels-1)
          const level = Math.min(nLevels - 1, Math.max(0, (i * scaleFactor + 0.5) | 0));
          charMapping[i] = gradient[level];
        }
      }
      this.charCache.set(cacheKey, charMapping);
    }
    
    // Build the ASCII string
    // We use a single array join for performance instead of string concatenation
    const result = new Array(height);
    const sourceGray = isEdgeDetection ? grayOriginal : gray; // Use original for color/intensity if needed, but here we map the processed gray
    
    // Actually, if edge detection is ON, 'gray' contains the edges (0 or 255).
    // If we want to mix edges with original image, logic would be more complex.
    // For now, we just map the 'gray' buffer which is either the adjusted image or the edge map.
    
    let offset = 0;
    for (let y = 0; y < height; y++) {
      let row = "";
      for (let x = 0; x < width; x++) {
        row += charMapping[gray[offset++]];
      }
      result[y] = row;
    }
    
    return result.join('\n');
  },
  
  applyEdgeDetection(gray, width, height, threshold) {
    // Simple Sobel operator or similar could go here.
    // For brevity and performance, using a simplified difference check.
    // (Reusing the logic from the original file but cleaned up)
    
    const size = width * height;
    const edges = new Uint8Array(size);
    edges.fill(255); // Default to white (no edge)
    
    // Sobel kernels
    // Gx = [-1 0 1]
    //      [-2 0 2]
    //      [-1 0 1]
    // Gy = [-1 -2 -1]
    //      [ 0  0  0]
    //      [ 1  2  1]
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        
        // Neighbors
        const tl = gray[i - width - 1];
        const t  = gray[i - width];
        const tr = gray[i - width + 1];
        const l  = gray[i - 1];
        const r  = gray[i + 1];
        const bl = gray[i + width - 1];
        const b  = gray[i + width];
        const br = gray[i + width + 1];
        
        const gx = (-tl + tr - 2*l + 2*r - bl + br);
        const gy = (-tl - 2*t - tr + bl + 2*b + br);
        
        const mag = Math.sqrt(gx*gx + gy*gy);
        
        // If magnitude > threshold, it's an edge (black=0), else white=255
        edges[i] = mag > threshold ? 0 : 255;
      }
    }
    
    return edges;
  },
  
  loadDefaultImage() {
    this.core.updateStatusMessage("Ready to process images and videos.");
  }
};