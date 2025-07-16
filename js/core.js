const ASCIIfy = {
  state: {
    currentMedia: null,
    video: null,
    videoCanvas: null,
    videoContext: null,
    isPlaying: false,
    isPreviewPlaying: false,
    currentFileType: null,
    frames: [],
    exportFrames: [],
    frameWidth: 0,
    frameHeight: 0,
    maxProcessingWidth: 500,
    cachedGradients: {},
    tempCanvas: document.createElement('canvas'),
    tempCtx: null,
    originalCanvas: document.createElement('canvas'),
    originalCtx: null,
    previewInterval: null,
    theme: 'dark',
    hasExportCapture: false
  },

  init() {
    this.setupCanvases();
    this.setupNotifications();
    if (MediaProcessor) MediaProcessor.init(this);
    if (UIManager) UIManager.init(this);
    if (CaptureEngine) CaptureEngine.init(this);
    if (ExportManager) ExportManager.init(this);
    
    const storedTheme = localStorage.getItem('asciiTheme');
    if (storedTheme) {
      this.setTheme(storedTheme);
    }
  },

  setupCanvases() {
    this.state.videoCanvas = document.getElementById('videoCanvas') || document.createElement('canvas');
    if (!this.state.videoCanvas.id) {
      this.state.videoCanvas.id = 'videoCanvas';
      this.state.videoCanvas.style.display = 'none';
      document.body.appendChild(this.state.videoCanvas);
    }
    
    this.state.videoContext = this.state.videoCanvas.getContext('2d', { willReadFrequently: true });
    this.state.tempCtx = this.state.tempCanvas.getContext('2d', { willReadFrequently: true });
    this.state.originalCtx = this.state.originalCanvas.getContext('2d', { willReadFrequently: true });
  },
  
  setupNotifications() {
    this.showMessage = (message, type = 'info', duration = 4000, showSpinner = false) => {
      const notificationArea = document.getElementById('notificationArea');
      if (!notificationArea) return;
      
      // Clear existing content
      notificationArea.innerHTML = '';
      
      // Add spinner if requested
      if (showSpinner) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        notificationArea.appendChild(spinner);
      }
      
      // Add message text
      const messageText = document.createElement('span');
      messageText.textContent = message;
      notificationArea.appendChild(messageText);
      
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
    
    this.updateStatusMessage = (message) => {
      const notificationArea = document.getElementById('notificationArea');
      if (notificationArea) {
        notificationArea.textContent = message;
        notificationArea.className = 'notification-area persistent visible';
      }
    };
  },
  
  setTheme(theme) {
    this.state.theme = theme;
    document.body.classList.toggle('light-mode', theme === 'light');
    localStorage.setItem('asciiTheme', theme);
  },
  
  clearWorkspace() {
    if (confirm('Clear everything and start fresh?')) {
      if (this.state.isPlaying && CaptureEngine) {
        CaptureEngine.stopCapture();
      }
      
      if (this.state.isPreviewPlaying && CaptureEngine) {
        CaptureEngine.stopPreview();
      }
      
      if (ExportManager && ExportManager.state.isPreviewPlaying) {
        ExportManager.stopPreview();
      }
      
      UIManager.resetSettings();
      
      this.cleanupMedia();
      this.state.frames = [];
      this.state.exportFrames = [];
      this.state.hasExportCapture = false;
      this.state.currentMedia = null;
      this.state.currentFileType = null;
      
      document.getElementById('ascii-art').textContent = "";
      this.updateStatusMessage("Workspace cleared. Please upload an image or video to begin.");
      
      const existingIndicator = document.querySelector('.file-type-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      document.getElementById('playbackControls').style.display = 'none';
      document.getElementById('startExport').disabled = true;
      
      if (CaptureEngine) {
        const captureStatus = document.getElementById('captureStatus');
        const exportStatus = document.getElementById('exportStatus');
        
        if (captureStatus) {
          const statusIndicator = captureStatus.querySelector('.status-indicator');
          if (statusIndicator) statusIndicator.className = 'status-indicator';
          captureStatus.querySelector('span').textContent = 'Ready to capture';
        }
        
        if (exportStatus) {
          const statusIndicator = exportStatus.querySelector('.status-indicator');
          if (statusIndicator) statusIndicator.className = 'status-indicator empty';
          exportStatus.querySelector('span').textContent = 'No animation captured for export yet';
        }
      }
      
      if (ExportManager) {
        ExportManager.clearPreview();
      }
    }
  },
  
  cleanupVideoResources() {
    if (this.state.video) {
      try {
        this.state.video.pause();
        this.state.video.currentTime = 0;
        this.state.video.removeAttribute('src');
        this.state.video.load();
        
        if (this.state.video.srcObject) {
          try {
            const tracks = this.state.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.state.video.srcObject = null;
          } catch (err) {
            console.warn('Error cleaning up video tracks:', err);
          }
        }
        
        this.state.isPlaying = false;
        this.state.isPreviewPlaying = false;
      } catch (err) {
        console.warn('Error during video element cleanup:', err);
      }
    }
    
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
      this.state.animationFrame = null;
    }
    
    if (CaptureEngine && CaptureEngine.state.previewAnimationFrame) {
      cancelAnimationFrame(CaptureEngine.state.previewAnimationFrame);
      CaptureEngine.state.previewAnimationFrame = null;
    }
    
    if (ExportManager && ExportManager.state.previewInterval) {
      cancelAnimationFrame(ExportManager.state.previewInterval);
      ExportManager.state.previewInterval = null;
    }
    
    if (this.state.videoObjectURL) {
      try {
        URL.revokeObjectURL(this.state.videoObjectURL);
        this.state.videoObjectURL = null;
      } catch (err) {
        console.warn('Error revoking object URL:', err);
      }
    }
    
    const canvasesToClear = [
      { ctx: this.state.videoContext, canvas: this.state.videoCanvas },
      { ctx: this.state.tempCtx, canvas: this.state.tempCanvas },
      { ctx: this.state.originalCtx, canvas: this.state.originalCanvas }
    ];
    
    canvasesToClear.forEach(item => {
      if (item.ctx && item.canvas) {
        try {
          item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
        } catch (err) {
          console.warn('Error clearing canvas:', err);
        }
      }
    });
    
    if (CaptureEngine) {
      if (CaptureEngine.state.isCapturing) {
        CaptureEngine.stopCapture();
      }
      if (CaptureEngine.state.isPreviewPlaying) {
        CaptureEngine.stopPreview();
      }
    }
    
    if (ExportManager && ExportManager.state.isPreviewPlaying) {
      ExportManager.stopPreview();
    }
    
    const timeoutsToCancel = ['_cleanupTimeout', '_processingTimeout', '_previewTimeout'];
    timeoutsToCancel.forEach(timeoutName => {
      if (this[timeoutName]) {
        clearTimeout(this[timeoutName]);
        this[timeoutName] = null;
      }
    });
    
    const videoControls = document.getElementById('playbackControls');
    if (videoControls) {
      videoControls.style.display = 'none';
    }
    
    if (window.gc) window.gc();
    
    if (MediaProcessor && MediaProcessor.charCache) {
      MediaProcessor.charCache.clear();
    }
    
    console.log('Video resources cleaned up successfully');
  },
  
  cleanupMedia() {
    this.cleanupVideoResources();
  }
};

window.addEventListener('load', () => ASCIIfy.init());