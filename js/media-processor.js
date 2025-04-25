const MediaProcessor = {
  core: null,
  
  init(coreModule) {
    this.core = coreModule;
    this.loadDefaultImage();
  },
  
  processFile(file) {
    this.core.cleanupMedia();
    this.core.state.frames = [];
    
    if (file.type.startsWith('image/')) {
      this.core.state.currentFileType = 'image';
      document.getElementById('videoControls').style.display = 'none';
      this.processImageFile(file);
      UIManager.updateFileTypeIndicator('image');
    } else if (file.type.startsWith('video/')) {
      this.core.state.currentFileType = 'video';
      document.getElementById('videoControls').style.display = 'block';
      this.processVideoFile(file);
      UIManager.updateFileTypeIndicator('video');
    } else {
      this.core.showMessage('Unsupported file type. Please upload an image or video.', 'error');
      return;
    }
    
    document.getElementById('startExport').disabled = false;
    document.getElementById('previewAnimation').disabled = false;
  },
  
  processImageFile(file) {
    this.core.showMessage('Processing image...', 'info', 0);
    
    const objectURL = URL.createObjectURL(file);
    
    const img = new Image();
    let revoked = false;
    
    const revokeURL = () => {
      if (!revoked) {
        URL.revokeObjectURL(objectURL);
        revoked = true;
      }
    };
    
    img.onload = () => {
      this.core.state.currentMedia = img;
      this.processMedia(img);
      UIManager.updateFileTypeIndicator('image', `${img.width}x${img.height}`);
      revokeURL();
    };
    
    img.onerror = () => {
      this.core.showMessage('Error loading image. Please try another file.', 'error');
      revokeURL();
    };
    
    setTimeout(revokeURL, 30000);
    
    img.src = objectURL;
  },
  
  processVideoFile(file) {
    this.core.state.currentMedia = null;
    this.core.showMessage('Processing video...', 'info', 0);
    
    if (!file.type.match(/^video\/(mp4|webm|ogg|mov|avi)$/) && 
        !file.name.match(/\.(mp4|webm|ogg|mov|avi)$/i)) {
      this.core.showMessage('Unsupported video format. Please use MP4, WebM, or OGG formats.', 'error');
      return;
    }
    
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.loop = false;
    
    const videoURL = URL.createObjectURL(file);
    this.core.state.videoObjectURL = videoURL;
    video.src = videoURL;
    
    const loadingTimeout = setTimeout(() => {
      if (!video.duration) {
        this.core.showMessage('Video loading timeout. Please try another file.', 'error');
        this.cleanupVideoResources(video, videoURL);
      }
    }, 30000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(loadingTimeout);
      
      if (!video.videoWidth || !video.videoHeight) {
        this.core.showMessage('Invalid video dimensions. Please try another file.', 'error');
        this.cleanupVideoResources(video, videoURL);
        return;
      }
      
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
      
      this.core.showMessage('Video loaded. Live preview will start automatically.', 'success');
      
      const duration = video.duration || 0;
      UIManager.updateFileTypeIndicator('video', `${video.videoWidth}x${video.videoHeight}, ${duration.toFixed(1)}s`);
      
      if (CaptureEngine && CaptureEngine.updateFrameCountAndProgress) {
        setTimeout(() => CaptureEngine.updateFrameCountAndProgress(), 100);
      }
      
      if (CaptureEngine && CaptureEngine.startPreview) {
        setTimeout(() => CaptureEngine.startPreview(), 300);
      }
    });
    
    video.addEventListener('error', (e) => {
      clearTimeout(loadingTimeout);
      console.error('Video loading error:', e);
      this.core.showMessage('Error loading video. Please try another file.', 'error');
      this.cleanupVideoResources(video, videoURL);
    });
  },
  
  cleanupVideoResources(videoElement, videoURL) {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }
    
    if (this.core.state.videoObjectURL) {
      URL.revokeObjectURL(this.core.state.videoObjectURL);
      this.core.state.videoObjectURL = null;
    }
  },
  
  processMedia(media) {
    const settings = UIManager.getSettings();
    
    const asciiWidth = Math.min(settings.width, this.core.state.maxProcessingWidth);
    
    const fontAspectRatio = 0.55;
    const asciiHeight = Math.round((media.height / media.width) * asciiWidth * fontAspectRatio);
    
    this.core.state.frameWidth = asciiWidth;
    this.core.state.frameHeight = asciiHeight;
    
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
    
    if (this.core.state.currentFileType === 'image') {
      this.core.state.frames = [ascii];
    }
    
    document.getElementById('ascii-art').textContent = ascii;
    
    return ascii;
  },
  
  processFrame(imageData) {
    const settings = UIManager.getSettings();
    let asciiWidth = settings.width;
    asciiWidth = Math.min(asciiWidth, this.core.state.maxProcessingWidth);
    
    const fontAspectRatio = 0.55;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    
    const asciiHeight = Math.floor((srcHeight / srcWidth) * asciiWidth * fontAspectRatio);
    
    this.core.state.frameWidth = asciiWidth;
    this.core.state.frameHeight = asciiHeight;
    
    if (!this._contrastFactor || this._lastContrastValue !== settings.contrast) {
      this._lastContrastValue = settings.contrast;
      this._contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
    }
    const contrastFactor = this._contrastFactor;
    
    if (this.core.state.tempCanvas.width !== asciiWidth) this.core.state.tempCanvas.width = asciiWidth;
    if (this.core.state.tempCanvas.height !== asciiHeight) this.core.state.tempCanvas.height = asciiHeight;
    if (this.core.state.originalCanvas.width !== srcWidth) this.core.state.originalCanvas.width = srcWidth;
    if (this.core.state.originalCanvas.height !== srcHeight) this.core.state.originalCanvas.height = srcHeight;
    
    this.core.state.originalCtx.putImageData(imageData, 0, 0);
    this.core.state.tempCtx.drawImage(this.core.state.originalCanvas, 0, 0, asciiWidth, asciiHeight);
    
    const scaledImageData = this.core.state.tempCtx.getImageData(0, 0, asciiWidth, asciiHeight);
    const scaledPixels = scaledImageData.data;
    const pixelCount = scaledPixels.length / 4;
    
    const gray = new Uint8Array(pixelCount);
    
    const rWeight = 0.299;
    const gWeight = 0.587;
    const bWeight = 0.114;
    
    const shouldInvert = settings.invert;
    const brightness = settings.brightness;
    
    for (let i = 0, j = 0; i < scaledPixels.length; i += 4, j++) {
      let lum = ((rWeight * scaledPixels[i]) + (gWeight * scaledPixels[i+1]) + (bWeight * scaledPixels[i+2])) | 0;
      
      if (shouldInvert) lum = 255 - lum;
      
      const adjusted = Math.max(0, Math.min(255, ((contrastFactor * (lum - 128)) + 128 + brightness) | 0));
      gray[j] = adjusted;
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
  
  charCache: new Map(),
  
  generateAsciiFromGray(gray, width, height, ignoreWhite, charset = 'binary', grayOriginal = null, isEdgeDetection = false) {
    charset = charset || 'binary';
    
    let gradient = this.core.state.cachedGradients[charset];
    if (!gradient) {
      gradient = charset === 'blocks' ? "█▓▒░ " : "10";
      this.core.state.cachedGradients[charset] = gradient;
    }
    
    const nLevels = gradient.length;
    const whiteCutoff = 250;
    const sourceGray = grayOriginal || gray;
    const scaleFactor = (nLevels - 1) / 255;
    
    const cacheKey = `${charset}_${whiteCutoff}_${ignoreWhite}_${isEdgeDetection}`;
    
    let charMapping = this.charCache.get(cacheKey);
    if (!charMapping) {
      charMapping = new Array(256);
      for (let i = 0; i < 256; i++) {
        if (ignoreWhite && i >= whiteCutoff) {
          charMapping[i] = ' ';
        } else {
          const level = Math.min(nLevels - 1, (i * scaleFactor + 0.5) | 0);
          charMapping[i] = gradient[level];
        }
      }
      this.charCache.set(cacheKey, charMapping);
    }
    
    const resultArray = new Array(height * (width + 1) - 1);
    let resultIndex = 0;
    
    const stride = width;
    
    for (let y = 0; y < height; y++) {
      const rowOffset = y * stride;
      const rowEnd = rowOffset + width;
      
      for (let i = rowOffset; i < rowEnd; i++) {
        resultArray[resultIndex++] = charMapping[isEdgeDetection ? sourceGray[i] : gray[i]];
      }
      
      if (y < height - 1) {
        resultArray[resultIndex++] = '\n';
      }
    }
    
    return resultArray.join('');
  },
  
  edgeCache: new Map(),
  
  applyEdgeDetection(gray, width, height, threshold) {
    const bufferHash = this._hashArrayBuffer(gray.buffer || gray);
    const cacheKey = `${bufferHash}_${width}_${height}_${threshold}`;
    
    if (this.edgeCache.has(cacheKey)) {
      return this.edgeCache.get(cacheKey);
    }
    
    const size = width * height;
    const edges = new Uint8Array(size);
    
    edges.fill(255);
    
    const normFactor = 255 / 1442;
    const normalizedThreshold = threshold / normFactor;
    
    const useParallel = size > 100000 && typeof SharedArrayBuffer !== 'undefined';
    
    if (useParallel && window.Worker) {
    }
    
    const canUseSIMD = typeof Float32Array.prototype.map === 'function';
    
    const widthMinus1 = width - 1;
    const heightMinus1 = height - 1;
    
    const sobelMultiplier = 2;
    
    for (let y = 1; y < heightMinus1; y++) {
      const rowIdx = y * width;
      const prevRowIdx = rowIdx - width;
      const nextRowIdx = rowIdx + width;
      
      const xLimit = widthMinus1 - 3;
      
      let x = 1;
      
      for (; x < xLimit; x += 4) {
        for (let i = 0; i < 4; i++) {
          const xPos = x + i;
          const idx = rowIdx + xPos;
          
          const topLeft = gray[prevRowIdx + (xPos - 1)];
          const top = gray[prevRowIdx + xPos];
          const topRight = gray[prevRowIdx + (xPos + 1)];
          const left = gray[rowIdx + (xPos - 1)];
          const right = gray[rowIdx + (xPos + 1)];
          const bottomLeft = gray[nextRowIdx + (xPos - 1)];
          const bottom = gray[nextRowIdx + xPos];
          const bottomRight = gray[nextRowIdx + (xPos + 1)];
          
          const Gx = (-topLeft + topRight - (left * sobelMultiplier) + (right * sobelMultiplier) - bottomLeft + bottomRight) | 0;
          const Gy = (-topLeft - (top * sobelMultiplier) - topRight + bottomLeft + (bottom * sobelMultiplier) + bottomRight) | 0;
          
          const absGx = Math.abs(Gx);
          const absGy = Math.abs(Gy);
          
          let magVal;
          if (absGx + absGy < 100) {
            magVal = ((absGx + absGy) * 1.2) | 0;
          } else {
            magVal = Math.sqrt(Gx * Gx + Gy * Gy);
          }
          
          edges[idx] = magVal > normalizedThreshold ? 0 : 255;
        }
      }
      
      for (; x < widthMinus1; x++) {
        const idx = rowIdx + x;
        
        const topLeft = gray[prevRowIdx + (x - 1)];
        const top = gray[prevRowIdx + x];
        const topRight = gray[prevRowIdx + (x + 1)];
        const left = gray[rowIdx + (x - 1)];
        const right = gray[rowIdx + (x + 1)];
        const bottomLeft = gray[nextRowIdx + (x - 1)];
        const bottom = gray[nextRowIdx + x];
        const bottomRight = gray[nextRowIdx + (x + 1)];
        
        const Gx = (-topLeft + topRight - (left * sobelMultiplier) + (right * sobelMultiplier) - bottomLeft + bottomRight) | 0;
        const Gy = (-topLeft - (top * sobelMultiplier) - topRight + bottomLeft + (bottom * sobelMultiplier) + bottomRight) | 0;
        
        const absGx = Math.abs(Gx);
        const absGy = Math.abs(Gy);
        
        let magVal;
        if (absGx + absGy < 100) {
          magVal = ((absGx + absGy) * 1.2) | 0;
        } else {
          magVal = Math.sqrt(Gx * Gx + Gy * Gy);
        }
        
        edges[idx] = magVal > normalizedThreshold ? 0 : 255;
      }
    }
    
    if (this.edgeCache.size > 10) {
      const firstKey = this.edgeCache.keys().next().value;
      this.edgeCache.delete(firstKey);
    }
    
    this.edgeCache.set(cacheKey, edges);
    
    return edges;
  },
  
  _hashArrayBuffer(buffer) {
    const data = new Uint8Array(buffer);
    const sampleSize = Math.min(data.length, 1000);
    const sampleStep = Math.max(1, Math.floor(data.length / sampleSize));
    
    let hash = 0;
    for (let i = 0; i < data.length; i += sampleStep) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return hash;
  },
  
  loadDefaultImage() {
    this.core.updateStatusMessage("Loading default image...");
    
    const defaultImg = new Image();
    defaultImg.crossOrigin = "Anonymous"; 
    
    const loadingTimeout = setTimeout(() => {
      if (!defaultImg.complete) {
        this.core.updateStatusMessage("Please upload an image to begin.");
      }
    }, 3000);
    
    defaultImg.onload = () => {
      clearTimeout(loadingTimeout);
      
      this.core.state.currentMedia = defaultImg;
      this.core.state.currentFileType = 'image';
      this.processMedia(defaultImg);
      this.core.updateStatusMessage("Default image loaded successfully.");
      
      document.getElementById('startExport').disabled = false;
      document.getElementById('previewAnimation').disabled = false;
    };
    
    defaultImg.onerror = () => {
      clearTimeout(loadingTimeout);
      this.core.updateStatusMessage("Please upload an image to begin.");
    };
    
    defaultImg.src = "https://i.ibb.co/chHSSFQ/horse.png";
  }
};