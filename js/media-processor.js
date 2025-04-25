/**
 * ASCIIfy - Media Processor Module
 * Handles processing of media files and ASCII conversion
 */

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
    img.onload = () => {
      this.core.state.currentMedia = img;
      this.processMedia(img);
      UIManager.updateFileTypeIndicator('image', `${img.width}x${img.height}`);
      
      URL.revokeObjectURL(objectURL);
    };
    img.onerror = () => {
      this.core.showMessage('Error loading image. Please try another file.', 'error');
      URL.revokeObjectURL(objectURL);
    };
    img.src = objectURL;
  },
  
  processVideoFile(file) {
    this.core.state.currentMedia = null;
    this.core.showMessage('Processing video...', 'info', 0);
    
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.loop = false;
    
    const videoURL = URL.createObjectURL(file);
    this.core.state.videoObjectURL = videoURL;
    video.src = videoURL;
    
    video.addEventListener('loadedmetadata', () => {
      const maxWidth = this.core.state.maxProcessingWidth;
      const aspectRatio = video.videoHeight / video.videoWidth;
      
      const optimizedWidth = Math.min(video.videoWidth, maxWidth);
      const optimizedHeight = Math.round(optimizedWidth * aspectRatio);
      
      this.core.state.videoCanvas.width = optimizedWidth;
      this.core.state.videoCanvas.height = optimizedHeight;
      this.core.state.video = video;
      this.core.state.currentMedia = video;
      
      this.core.showMessage('Video loaded. Live preview will start automatically.', 'success');
      
      UIManager.updateFileTypeIndicator('video', `${video.videoWidth}x${video.videoHeight}, ${video.duration.toFixed(1)}s`);
      
      // Update frame count and progress bar on load
      if (CaptureEngine && CaptureEngine.updateFrameCountAndProgress) {
        setTimeout(() => CaptureEngine.updateFrameCountAndProgress(), 100);
      }
      
      // Start automatic preview
      if (CaptureEngine && CaptureEngine.startPreview) {
        setTimeout(() => CaptureEngine.startPreview(), 300);
      }
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      this.core.showMessage('Error loading video. Please try another file.', 'error');
      if (this.core.state.videoObjectURL) {
        URL.revokeObjectURL(this.core.state.videoObjectURL);
        this.core.state.videoObjectURL = null;
      }
    });
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
    
    const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
    
    if (this.core.state.tempCanvas.width !== asciiWidth) this.core.state.tempCanvas.width = asciiWidth;
    if (this.core.state.tempCanvas.height !== asciiHeight) this.core.state.tempCanvas.height = asciiHeight;
    if (this.core.state.originalCanvas.width !== srcWidth) this.core.state.originalCanvas.width = srcWidth;
    if (this.core.state.originalCanvas.height !== srcHeight) this.core.state.originalCanvas.height = srcHeight;
    
    this.core.state.originalCtx.putImageData(imageData, 0, 0);
    this.core.state.tempCtx.drawImage(this.core.state.originalCanvas, 0, 0, asciiWidth, asciiHeight);
    
    const scaledImageData = this.core.state.tempCtx.getImageData(0, 0, asciiWidth, asciiHeight);
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
  
  generateAsciiFromGray(gray, width, height, ignoreWhite, charset = 'binary', grayOriginal = null, isEdgeDetection = false) {
    charset = charset || 'binary';
    
    let gradient = this.core.state.cachedGradients[charset];
    if (!gradient) {
      gradient = charset === 'blocks' ? "█▓▒░ " : "10";
      this.core.state.cachedGradients[charset] = gradient;
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