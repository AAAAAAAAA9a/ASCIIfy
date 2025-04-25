/**
 * ASCIIfy - Core Module
 * Central module containing shared state and initialization
 */

const ASCIIfy = {
  state: {
    currentMedia: null,
    video: null,
    videoCanvas: null,
    videoContext: null,
    isPlaying: false,
    currentFileType: null,
    frames: [],
    frameWidth: 0,
    frameHeight: 0,
    maxProcessingWidth: 500,
    cachedGradients: {},
    tempCanvas: document.createElement('canvas'),
    tempCtx: null,
    originalCanvas: document.createElement('canvas'),
    originalCtx: null,
    theme: 'dark'
  },

  init() {
    // Initialize core components
    this.setupCanvases();
    this.setupNotifications();    // Initialize other modules
    if (MediaProcessor) MediaProcessor.init(this);
    if (UIManager) UIManager.init(this);
    if (CaptureEngine) CaptureEngine.init(this);
    if (ExportManager) ExportManager.init(this);
    
    // Apply default theme
    const storedTheme = localStorage.getItem('asciiTheme');
    if (storedTheme) {
      this.setTheme(storedTheme);
    }
  },

  setupCanvases() {
    // Set up canvas elements used across modules
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
      
      UIManager.resetSettings();
      this.cleanupMedia();
      this.state.frames = [];
      this.state.currentMedia = null;
      this.state.currentFileType = null;
      
      document.getElementById('ascii-art').textContent = "";
      this.updateStatusMessage("Workspace cleared. Please upload an image or video to begin.");
      
      const existingIndicator = document.querySelector('.file-type-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      document.getElementById('videoControls').style.display = 'none';
      
      if (ExportManager) {
        ExportManager.clearPreview();
      }
    }
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
  }
};

// Initialize on window load
window.addEventListener('load', () => ASCIIfy.init());