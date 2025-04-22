/**
 * ASCII Art Generator
 */

const AsciiGenerator = {
  state: {
    currentMedia: null,
    video: null,
    videoCanvas: null,
    videoContext: null,
    isPlaying: false,
    animationFrame: null,
    currentFileType: null,
    tempCanvas: null,
    tempCtx: null,
    originalCanvas: null,
    originalCtx: null,
    videoObjectURL: null,
    lastFrameTime: 0,
    cachedGradients: {},
    maxProcessingWidth: 500,
    frames: [],
    currentFrame: 0,
    frameWidth: 0,
    frameHeight: 0,
    loopEnabled: false,
  },init() {
    this.state.videoCanvas = document.getElementById('videoCanvas');
    if (!this.state.videoCanvas) {
      this.state.videoCanvas = document.createElement('canvas');
      this.state.videoCanvas.id = 'videoCanvas';
      this.state.videoCanvas.style.display = 'none';
      document.body.appendChild(this.state.videoCanvas);
    }
    this.state.videoContext = this.state.videoCanvas.getContext('2d', { willReadFrequently: true });
    
    this.state.tempCanvas = document.createElement('canvas');
    this.state.tempCtx = this.state.tempCanvas.getContext('2d', { willReadFrequently: true });
    
    this.state.originalCanvas = document.createElement('canvas');
    this.state.originalCtx = this.state.originalCanvas.getContext('2d', { willReadFrequently: true });
    
    this.setupMessageDisplay();
    this.setupAutomaticZoom();
    this.setupFileProcessing();
    this.setupControls();
    this.setupCollapsibleSections();
    this.loadDefaultImage();  
  },
    setupMessageDisplay() {
    this.showMessage = (message, type = 'info', duration = 4000) => {
      const notificationArea = document.getElementById('notificationArea');
      if (!notificationArea) return;
      
      notificationArea.textContent = message;
      notificationArea.className = `notification-area ${type}`;
      notificationArea.classList.add('visible');
      
      if (this._notificationTimeout) {
        clearTimeout(this._notificationTimeout);
      }
      
      if (duration > 0) {
        this._notificationTimeout = setTimeout(() => {
          notificationArea.classList.remove('visible');
          
          setTimeout(() => {
            if (notificationArea.classList.contains('visible') === false) {
              notificationArea.textContent = '';
            }
          }, 500);
        }, duration);
      }
      
      return notificationArea;
    };
  },
  setupAutomaticZoom() {
    const screenWidth = window.innerWidth;
    const mainContent = document.querySelector('.main-content');
    const availableWidth = mainContent ? mainContent.offsetWidth : (screenWidth * 0.6);
    
    const asciiWidthInput = document.getElementById('asciiWidth');
    const asciiWidth = asciiWidthInput ? parseInt(asciiWidthInput.value, 10) : 150;
    
    const optimalZoom = Math.floor((availableWidth / asciiWidth) * 85);
    
    const zoomInput = document.getElementById('zoom');
    if (zoomInput) {
      zoomInput.value = Math.max(50, Math.min(200, optimalZoom));
      
      const zoomVal = document.getElementById('zoomVal');
      if (zoomVal) {
        zoomVal.textContent = zoomInput.value;
      }
      
      const asciiArt = document.getElementById('ascii-art');
      if (asciiArt) {
        const baseFontSize = 16;
        const newFontSize = (baseFontSize * optimalZoom) / 100;
        asciiArt.style.fontSize = newFontSize + "px";
        asciiArt.style.lineHeight = newFontSize + "px";
      }
    }
    
    window.addEventListener('resize', () => this.setupAutomaticZoom());
    if (asciiWidthInput) {
      asciiWidthInput.addEventListener('change', () => this.setupAutomaticZoom());
    }
  },
  setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    
    collapsibles.forEach(collapsible => {
      const content = collapsible.nextElementSibling;
      if (collapsible.classList.contains('active')) {
        content.classList.add('show');
      }
      
      collapsible.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        
        if (content.classList.contains('show')) {
          content.classList.remove('show');
        } else {
          content.classList.add('show');
        }
      });
    });
  },
  setupFileProcessing() {
    const fileInput = document.getElementById('unifiedInput');
    const dropZone = document.querySelector('.unified-drop-zone');
    const videoControls = document.getElementById('videoControls');
    
    if (fileInput) {
      fileInput.style.position = 'absolute';
      fileInput.style.left = '-9999px';
      
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.processFile(file);
        }
      });
    }
    
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => {
        fileInput.click();
      });
      
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
          this.processFile(file);
        } else {
          this.showMessage('Please drop a valid image or video file.', 'error');
        }
      });
    }  
  },
    setupControls() {
    const playPauseBtn = document.getElementById('playPause');
    const restartBtn = document.getElementById('restart');
    const toggleLoopBtn = document.getElementById('toggleLoop');
    
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => this.toggleVideo());
    }
    
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restartVideo());
    }
    
    if (toggleLoopBtn) {
      toggleLoopBtn.textContent = 'Loop: OFF';
      toggleLoopBtn.classList.add('inactive');
      toggleLoopBtn.classList.remove('active');
      
      toggleLoopBtn.addEventListener('click', () => this.toggleLooping());
    }
    
    const controls = ['asciiWidth', 'brightness', 'contrast', 'blur', 'invert', 'ignoreWhite', 'zoom'];
    controls.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.updateSettings());
      }
    });
    
    const edgeToggle = document.getElementById('enableEdgeDetection');
    if (edgeToggle) {
      edgeToggle.addEventListener('change', () => {
        if (this.state.currentMedia) {
          this.processMedia(this.state.currentMedia);
        }
      });
    }
    
    const charsetSelect = document.getElementById('charset');
    if (charsetSelect) {
      charsetSelect.addEventListener('change', () => {
        if (this.state.currentMedia) {
          this.processMedia(this.state.currentMedia);
        }
      });
    }
    
    const themeSelector = document.getElementById('theme');
    if (themeSelector) {
      themeSelector.addEventListener('change', function() {
        const isLightMode = this.value === 'light';
        document.body.classList.toggle('light-mode', isLightMode);
      });
    }
    
    document.getElementById('reset')?.addEventListener('click', () => this.resetSettings());
    document.getElementById('clearWorkspace')?.addEventListener('click', () => this.clearWorkspace());
  },
  processFile(file) {
    this.cleanupMedia();
    this.state.frames = [];
    
    if (file.type.startsWith('image/')) {
      this.state.currentFileType = 'image';
      document.getElementById('videoControls').style.display = 'none';
      this.processImageFile(file);
      this.updateFileTypeIndicator('image');
    } else if (file.type.startsWith('video/')) {
      this.state.currentFileType = 'video';
      document.getElementById('videoControls').style.display = 'block';
      this.processVideoFile(file);
      this.updateFileTypeIndicator('video');
    } else {
      this.showMessage('Unsupported file type. Please upload an image or video.', 'error');
      return;
    }
    
    document.getElementById('startExport').disabled = false;
    document.getElementById('previewAnimation').disabled = false;
  },
  cleanupMedia() {
    if (this.state.video) {
      this.state.video.pause();
      this.state.video.removeAttribute('src');
      this.state.video.load();
      this.state.isPlaying = false;
    }
    
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
      this.state.animationFrame = null;
    }
    
    if (this.state.videoObjectURL) {
      URL.revokeObjectURL(this.state.videoObjectURL);
      this.state.videoObjectURL = null;
    }
    
    this.state.lastFrameTime = 0;
  },
  processImageFile(file) {
    this.showMessage('Processing image...', 'info', 0);
    
    const objectURL = URL.createObjectURL(file);
    
    const img = new Image();
    img.onload = () => {
      this.state.currentMedia = img;
      this.processMedia(img);
      this.updateFileTypeIndicator('image', `${img.width}x${img.height}`);
      
      URL.revokeObjectURL(objectURL);
    };
    img.onerror = () => {
      this.showMessage('Error loading image. Please try another file.', 'error');
      URL.revokeObjectURL(objectURL);
    };
    img.src = objectURL;
  },
    processVideoFile(file) {
    this.state.currentMedia = null;
    this.showMessage('Processing video...', 'info', 0);
    
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.loop = false;
    
    const videoURL = URL.createObjectURL(file);
    this.state.videoObjectURL = videoURL;
    video.src = videoURL;
    
    video.addEventListener('loadedmetadata', () => {
      const maxWidth = this.state.maxProcessingWidth;
      const aspectRatio = video.videoHeight / video.videoWidth;
      
      const optimizedWidth = Math.min(video.videoWidth, maxWidth);
      const optimizedHeight = Math.round(optimizedWidth * aspectRatio);
      
      this.state.videoCanvas.width = optimizedWidth;
      this.state.videoCanvas.height = optimizedHeight;
      this.state.video = video;
      this.state.currentMedia = video;
      
      this.showMessage('Video loaded. Press Play to start conversion.', 'success');
      
      this.updateFileTypeIndicator('video', `${video.videoWidth}x${video.videoHeight}, ${video.duration.toFixed(1)}s`);
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      this.showMessage('Error loading video. Please try another file.', 'error');
      if (this.state.videoObjectURL) {
        URL.revokeObjectURL(this.state.videoObjectURL);
        this.state.videoObjectURL = null;
      }
    });
  },
  toggleVideo() {
    if (!this.state.video || this.state.currentFileType !== 'video') {
      this.showMessage('No video loaded. Please upload a video first.', 'error');
      return;
    }
    
    if (this.state.isPlaying) {
      this.state.isPlaying = false;
      this.state.video.pause();
      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
        this.state.animationFrame = null;
      }
      document.getElementById('playPause').textContent = 'Play';
    } else {
      this.state.isPlaying = true;
      this.state.video.play()
        .then(() => {
          document.getElementById('playPause').textContent = 'Pause';
          this.state.lastFrameTime = 0; // Reset frame timing
          this.convertVideoToAscii(performance.now()); // Pass timestamp for frame timing
        })
        .catch(err => {
          console.error('Failed to play video:', err);
          this.state.isPlaying = false;
        });
    }
  },
  
  restartVideo() {
    if (!this.state.video || this.state.currentFileType !== 'video') return;
    
    // Reset video playback position
    this.state.video.currentTime = 0;
    
    // Reset frame timing
    this.state.lastFrameTime = 0;
    
    if (this.state.isPlaying) {
      this.state.video.play()
        .then(() => {
          if (!this.state.animationFrame) {
            // Pass timestamp for frame throttling
            this.convertVideoToAscii(performance.now());
          }
        })
        .catch(err => { /* Handle restart error */ });
    } else {
      this.showMessage('Video restarted. Press Play to begin conversion.', 'info');
    }
  },
  /**
   * Toggle video looping on/off
   */
  toggleLooping() {
    this.state.loopEnabled = !this.state.loopEnabled;
    
    // Update video element if it exists
    if (this.state.video) {
      this.state.video.loop = this.state.loopEnabled;
    }
    
    const toggleLoopBtn = document.getElementById('toggleLoop');
    if (toggleLoopBtn) {
      toggleLoopBtn.textContent = this.state.loopEnabled ? 'Loop: ON' : 'Loop: OFF';
      toggleLoopBtn.classList.toggle('inactive', !this.state.loopEnabled);
      toggleLoopBtn.classList.toggle('active', this.state.loopEnabled);
    }
    
    if (this.state.loopEnabled && this.state.video && 
        this.state.video.currentTime >= this.state.video.duration - 0.1) {
      this.state.video.currentTime = 0;
      if (this.state.isPlaying) {
        this.state.video.play();
      }
    }
    if (this.state.video) {
      if (this.state.frames.length > 0) {
        console.log(`Clearing ${this.state.frames.length} frames due to loop mode change`);
      }
      this.state.frames = [];
      
      if (this.state.loopEnabled) {
        this.showMessage('Loop enabled. Frames will be continuously collected until you manually stop.', 'info');
      } else {
        this.showMessage('Loop disabled. Video will play once and stop. Press Play to collect frames.', 'info');
      }
      
      if (!this.state.isPlaying) {
        setTimeout(() => {
          if (!this.state.isPlaying) {
            console.log("Video isn't playing. Press Play to begin collecting frames with new loop settings.");
          }
        }, 2000);
      }
    }
  },
  /**
   * Convert video to ASCII art frame by frame
   * @param {DOMHighResTimeStamp} timestamp - Current timestamp for animation
   */
  convertVideoToAscii(timestamp) {
    if (!this.state.video) return;

    if (this.state.video.paused || this.state.video.ended) {
      if (this.state.isPlaying) {
        if (this.state.video.ended) {
          if (this.state.loopEnabled) {
            this.state.video.currentTime = 0;
            this.state.video.play()
              .then(() => requestAnimationFrame((ts) => this.convertVideoToAscii(ts)))
              .catch(err => { console.error('Video playback error:', err); });
          } else {
            this.state.isPlaying = false;
            document.getElementById('playPause').textContent = 'Play';
            
            const asciiArt = document.getElementById('ascii-art');
            if (!asciiArt.textContent.includes('End of video')) {
              asciiArt.textContent += '\n\n[End of video reached - frames captured successfully]';
            }
            
            console.log(`Video playback complete. Total frames collected: ${this.state.frames.length}`);
            return;
          }
        } else {
          this.state.video.play()
            .then(() => requestAnimationFrame((ts) => this.convertVideoToAscii(ts)))
            .catch(err => { console.error('Video playback error:', err); });
        }
      }
      return;
    }
      const targetFrameInterval = 33;
    
    if (!timestamp || timestamp - this.state.lastFrameTime >= targetFrameInterval) {
      this.state.lastFrameTime = timestamp;
      
      const ctx = this.state.videoContext;
      const canvas = this.state.videoCanvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.state.video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const position = this.state.video.currentTime / this.state.video.duration;
      const asciiFrame = this.processFrame(imageData);
      document.getElementById('ascii-art').textContent = asciiFrame;
      
      const maxFrames = Math.min(1500, Math.ceil(this.state.video.duration * 30));
      
      if (this.state.frames.length < maxFrames) {
        this.state.frames.push(asciiFrame);
        if (this.state.frames.length % 30 === 0) {
          console.log(`Collecting frames: ${this.state.frames.length}/${maxFrames}`);
        }
      } else if (position < 0.1 && this.state.loopEnabled) {
        console.log("Max frames reached, maintaining current frame buffer.");
      }
      
      if (position > 0.95 && !this.state.loopEnabled) {
        const remainingTime = Math.round((this.state.video.duration - this.state.video.currentTime) * 10) / 10;
        console.log(`Video almost complete, ${remainingTime}s remaining. Frame count: ${this.state.frames.length}`);
      }
    }

    if (this.state.isPlaying) {
      this.state.animationFrame = requestAnimationFrame((ts) => this.convertVideoToAscii(ts));
    }
  },
    /**
   * Process a single video frame
   * @param {ImageData} imageData
   * @returns {string} ASCII representation of the frame
   */
  processFrame(imageData) {
    let asciiWidth = parseInt(document.getElementById('asciiWidth').value, 10);
    asciiWidth = Math.min(asciiWidth, this.state.maxProcessingWidth);
    
    const fontAspectRatio = 0.55;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    
    const asciiHeight = Math.floor((srcHeight / srcWidth) * asciiWidth * fontAspectRatio);
    
    this.state.frameWidth = asciiWidth;
    this.state.frameHeight = asciiHeight;
    
    const settings = {
      brightness: parseFloat(document.getElementById('brightness').value),
      contrast: parseFloat(document.getElementById('contrast').value),
      invert: document.getElementById('invert')?.checked || false,
      ignoreWhite: document.getElementById('ignoreWhite')?.checked || true,
      edgeDetection: document.getElementById('enableEdgeDetection')?.checked || false,
      charset: document.getElementById('charset')?.value || 'binary'
    };
    
    const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
    
    if (this.state.tempCanvas.width !== asciiWidth) this.state.tempCanvas.width = asciiWidth;
    if (this.state.tempCanvas.height !== asciiHeight) this.state.tempCanvas.height = asciiHeight;
    if (this.state.originalCanvas.width !== srcWidth) this.state.originalCanvas.width = srcWidth;
    if (this.state.originalCanvas.height !== srcHeight) this.state.originalCanvas.height = srcHeight;
      this.state.originalCtx.putImageData(imageData, 0, 0);
    this.state.tempCtx.drawImage(this.state.originalCanvas, 0, 0, asciiWidth, asciiHeight);
    
    const scaledImageData = this.state.tempCtx.getImageData(0, 0, asciiWidth, asciiHeight);
    const scaledPixels = scaledImageData.data;
    const pixelCount = scaledPixels.length / 4;
    
    const gray = new Array(pixelCount);
    for (let i = 0, j = 0; i < scaledPixels.length; i += 4, j++) {
      let lum = (0.299 * scaledPixels[i] + 0.587 * scaledPixels[i+1] + 0.114 * scaledPixels[i+2]) | 0;
      
      if (settings.invert) lum = 255 - lum;
      
      gray[j] = Math.max(0, Math.min(255, ((contrastFactor * (lum - 128)) + 128 + settings.brightness) | 0));
    }
    
    const processedGray = settings.edgeDetection ? 
      this.applyEdgeDetection(gray, asciiWidth, asciiHeight, 100) : gray;
    
    const asciiFrame = this.generateAsciiFromGray(
      processedGray, 
      asciiWidth, 
      asciiHeight, 
      settings.ignoreWhite, 
      settings.charset
    );
    
    return asciiFrame;
  },
    processMedia(media) {
    const settings = {
      charset: document.getElementById('charset')?.value || 'binary',
      width: parseInt(document.getElementById('asciiWidth').value, 10),
      brightness: parseFloat(document.getElementById('brightness').value),
      contrast: parseFloat(document.getElementById('contrast').value),
      blur: parseFloat(document.getElementById('blur').value),
      invert: document.getElementById('invert')?.checked || false,
      ignoreWhite: document.getElementById('ignoreWhite')?.checked || true,
      edgeDetection: document.getElementById('enableEdgeDetection')?.checked || false
    };
    
    const asciiWidth = Math.min(settings.width, this.state.maxProcessingWidth);
    
    const fontAspectRatio = 0.55;
    const asciiHeight = Math.round((media.height / media.width) * asciiWidth * fontAspectRatio);
    
    this.state.frameWidth = asciiWidth;
    this.state.frameHeight = asciiHeight;
    
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    canvas.width = asciiWidth;
    canvas.height = asciiHeight;
    ctx.filter = settings.blur > 0 ? `blur(${settings.blur}px)` : "none";
    ctx.drawImage(media, 0, 0, asciiWidth, asciiHeight);
    
    const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
    const data = imageData.data;
      const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
    
    const pixelCount = data.length / 4;
    const gray = new Array(pixelCount);
    const grayOriginal = settings.edgeDetection ? new Array(pixelCount) : null;
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      let lum = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) | 0;
      
      if (settings.invert) lum = 255 - lum;
      
      const adjusted = Math.max(0, Math.min(255, ((contrastFactor * (lum - 128)) + 128 + settings.brightness) | 0));
      
      gray[j] = adjusted;
      if (grayOriginal) grayOriginal[j] = adjusted;
    }
    
    const processedGray = settings.edgeDetection ? 
      this.applyEdgeDetection(gray, asciiWidth, asciiHeight, 100) : gray;
    
    const ascii = this.generateAsciiFromGray(
      processedGray, 
      asciiWidth, 
      asciiHeight, 
      settings.ignoreWhite, 
      settings.charset, 
      grayOriginal, 
      settings.edgeDetection
    );
    
    if (this.state.currentFileType === 'image') {
      this.state.frames = [ascii];
    }
    
    document.getElementById('ascii-art').textContent = ascii;
    
    return ascii;
  },
    /**
   * Maps grayscale values to ASCII characters
   * @param {number[]} gray - Grayscale pixel data
   * @param {number} width - Width in characters
   * @param {number} height - Height in characters
   * @param {boolean} ignoreWhite - Whether to ignore white pixels
   * @param {string} charset - 'binary' or 'blocks'
   * @param {number[]} grayOriginal - Original data for edge detection
   * @param {boolean} isEdgeDetection - Edge detection flag
   * @returns {string} ASCII art result
   */
  generateAsciiFromGray(gray, width, height, ignoreWhite, charset = 'binary', grayOriginal = null, isEdgeDetection = false) {
    charset = charset || 'binary';
    
    let gradient = this.state.cachedGradients[charset];
    if (!gradient) {
      gradient = charset === 'blocks' ? "█▓▒░ " : "10";
      this.state.cachedGradients[charset] = gradient;
    }
    
    const nLevels = gradient.length;
    const whiteCutoff = 250;
    
    let result = '';
    const sourceGray = grayOriginal || gray;
    const scaleFactor = (nLevels - 1) / 255;
    
    const stride = width;
    
    for (let y = 0; y < height; y++) {
      const rowOffset = y * stride;
      const rowEnd = rowOffset + width;
      
      for (let i = rowOffset; i < rowEnd; i++) {
        if (ignoreWhite && (isEdgeDetection ? sourceGray[i] >= whiteCutoff : gray[i] >= whiteCutoff)) {
          result += ' ';
          continue;
        }
        
        const level = (gray[i] * scaleFactor + 0.5) | 0;
        result += gradient[level >= nLevels ? nLevels - 1 : level];
      }
      
      if (y < height - 1) {
        result += '\n';
      }
    }
    
    return result;
  },
    /**
   * Applies Sobel edge detection to grayscale image data
   * @param {number[]} gray - Grayscale data
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {number} threshold - Detection sensitivity
   * @returns {number[]} Processed grayscale data
   */
  applyEdgeDetection(gray, width, height, threshold) {
    const size = width * height;
    const edges = new Array(size);
    
    const whitePixel = 255;
    edges.fill(whitePixel);
    
    const normFactor = 255 / 1442;
    
    for (let y = 1; y < height - 1; y++) {
      const rowIdx = y * width;
      const prevRowIdx = (y - 1) * width;
      const nextRowIdx = (y + 1) * width;
      
      for (let x = 1; x < width - 1; x++) {
        const a = gray[prevRowIdx + (x - 1)];
        const b = gray[prevRowIdx + x];
        const c = gray[prevRowIdx + (x + 1)];
        const d = gray[rowIdx + (x - 1)];
        const f = gray[rowIdx + (x + 1)];
        const g = gray[nextRowIdx + (x - 1)];
        const h = gray[nextRowIdx + x];
        const i = gray[nextRowIdx + (x + 1)];
        
        const Gx = (-a + c - 2 * d + 2 * f - g + i);
        const Gy = (-a - 2 * b - c + g + 2 * h + i);
        
        const absGx = Math.abs(Gx);
        const absGy = Math.abs(Gy);
        
        let magVal;
        if (absGx + absGy < 100) {
          magVal = 1.2 * (absGx + absGy);
        } else {
          magVal = Math.sqrt(Gx * Gx + Gy * Gy);
        }
        
        edges[rowIdx + x] = magVal * normFactor > threshold ? 0 : 255;
      }
    }
    
    return edges;
  },
    /**
   * Load the default image
   */
  loadDefaultImage() {
    const asciiArt = document.getElementById('ascii-art');
    asciiArt.textContent = "Loading default image...";
    
    const defaultImg = new Image();
    defaultImg.crossOrigin = "Anonymous"; 
    
    const loadingTimeout = setTimeout(() => {
      if (!defaultImg.complete) {
        asciiArt.textContent = "Please upload an image to begin.";
      }
    }, 3000);
    
    defaultImg.onload = () => {
      clearTimeout(loadingTimeout);
      
      this.state.currentMedia = defaultImg;
      this.state.currentFileType = 'image';
      this.processMedia(defaultImg);
      
      document.getElementById('startExport').disabled = false;
      document.getElementById('previewAnimation').disabled = false;
    };
    
    defaultImg.onerror = () => {
      clearTimeout(loadingTimeout);
      asciiArt.textContent = "Please upload an image to begin.";
    };
    
    defaultImg.src = "https://i.ibb.co/chHSSFQ/horse.png";
  },
    /**
   * Update UI settings indicators
   */
  updateSettings() {
    document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
    document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
    document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
    document.getElementById('blurVal').textContent = document.getElementById('blur').value;
    document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
    
    const zoomPercent = parseInt(document.getElementById('zoom').value, 10);
    const baseFontSize = 16;
    const newFontSize = (baseFontSize * zoomPercent) / 100;
    const asciiArt = document.getElementById('ascii-art');
    
    asciiArt.style.fontSize = newFontSize + "px";
    asciiArt.style.lineHeight = newFontSize + "px";
    
    clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      if (this.state.currentMedia) {
        if (this.state.currentFileType === 'image') {
          this.processMedia(this.state.currentMedia);
        }
      }
    }, 100);
  },
    /**
   * Reset all settings to default values
   */
  resetSettings() {
    document.getElementById('asciiWidth').value = 150;
    document.getElementById('brightness').value = 0;
    document.getElementById('contrast').value = 0;
    document.getElementById('blur').value = 0;
    document.getElementById('invert').checked = false;
    document.getElementById('ignoreWhite').checked = true;
    document.getElementById('zoom').value = 100;
    document.getElementById('charset').value = 'binary';
    
    const edgeToggle = document.getElementById('enableEdgeDetection');
    if (edgeToggle) edgeToggle.checked = false;
    
    this.updateSettings();
  },
    /**
   * Clear the entire workspace and start fresh
   */
  clearWorkspace() {
    if (confirm('Clear everything and start fresh?')) {
      if (this.state.isPlaying) {
        this.toggleVideo();
      }
      
      this.resetSettings();
      this.cleanupMedia();
      this.state.frames = [];
      this.state.currentMedia = null;
      this.state.currentFileType = null;
      
      document.getElementById('ascii-art').textContent = "Workspace cleared. Please upload an image or video to begin.";
      
      const existingIndicator = document.querySelector('.file-type-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      document.getElementById('videoControls').style.display = 'none';
      
      if (window.AsciiExporter) {
        AsciiExporter.clearPreview();
      }
    }
  },
  
  /**
   * Update file type indicator in the UI
   * @param {string} type
   * @param {string} details
   */
  updateFileTypeIndicator(type, details) {
    const existingIndicator = document.querySelector('.file-type-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = `file-type-indicator ${type}`;
    indicator.textContent = type.charAt(0).toUpperCase() + type.slice(1) + (details ? `: ${details}` : '');
    
    // Add to drop zone
    const dropZone = document.querySelector('.unified-drop-zone');
    if (dropZone) {
      dropZone.appendChild(indicator);
    }
  },
  
};

// Initialize when the page loads
window.addEventListener('load', () => {
  AsciiGenerator.init();
});

/**W
 * @param {Object} options - Configuration options
 * @param {string} options.selector - CSS selector for the container element
 * @param {string} options.videoSrc - Optional video source URL
 * @param {number} options.width - Character width (default: 100)
 * @param {boolean} options.edgeDetection - Enable edge detection (default: false)
 * @param {string} options.charset - Character set to use (default: 'binary')
 */
function setupAsciiBackground(options) {
  const config = {
    selector: '#ascii-background',
    width: 100,
    edgeDetection: false,
    charset: 'binary',
    ...options
  };
  
  document.getElementById('asciiWidth').value = config.width;
  document.getElementById('enableEdgeDetection').checked = config.edgeDetection;
  document.getElementById('charset').value = config.charset;
  
  if (config.videoSrc) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', config.videoSrc, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (this.status === 200) {
        const file = new File([this.response], 'background.mp4', { type: 'video/mp4' });
        AsciiGenerator.processFile(file);
        setTimeout(() => AsciiGenerator.toggleVideo(), 500);
      }
    };
    xhr.send();
  }
  
  return {
    play: () => AsciiGenerator.toggleVideo(),
    pause: () => {
      if (AsciiGenerator.state.isPlaying) {
        AsciiGenerator.toggleVideo();
      }
    },
    reset: () => AsciiGenerator.resetSettings()
  };
}
