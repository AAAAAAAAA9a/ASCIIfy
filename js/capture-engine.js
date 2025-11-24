const CaptureEngine = {
  core: null,
  state: {
    isCapturing: false,
    isPreviewPlaying: false,
    previewAnimationFrame: null,
    frameCount: 0,
    startTime: 0
  },
  
  init(coreModule) {
    this.core = coreModule;
    this.setupEventListeners();
  },
  
  setupEventListeners() {
    document.getElementById('playPauseButton')?.addEventListener('click', () => this.togglePlayback());
    document.getElementById('captureAnimation')?.addEventListener('click', () => this.startCapture());
    document.getElementById('stopCapture')?.addEventListener('click', () => this.stopCapture());
    
    const loopToggle = document.getElementById('loopPlayback');
    if (loopToggle) {
      loopToggle.addEventListener('change', (e) => {
        if (this.core.state.video) {
          this.core.state.video.loop = e.target.checked;
        }
      });
    }
  },
  
  togglePlayback() {
    const video = this.core.state.video;
    if (!video) return;
    
    if (video.paused) {
      video.play().then(() => {
        this.core.state.isPlaying = true;
        this.startPreview();
        this.updatePlayButton(true);
      }).catch(err => console.error("Play failed:", err));
    } else {
      video.pause();
      this.core.state.isPlaying = false;
      this.stopPreview();
      this.updatePlayButton(false);
    }
  },
  
  updatePlayButton(isPlaying) {
    const btn = document.getElementById('playPauseButton');
    if (!btn) return;
    
    if (isPlaying) {
      // Pause Icon
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    } else {
      // Play Icon
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
  },
  
  startPreview() {
    if (this.state.isPreviewPlaying) return;
    this.state.isPreviewPlaying = true;
    
    const loop = () => {
      if (!this.state.isPreviewPlaying) return;
      
      if (this.core.state.video && !this.core.state.video.paused) {
        // Draw video frame to canvas
        const video = this.core.state.video;
        const canvas = this.core.state.videoCanvas;
        const ctx = this.core.state.videoContext;
        
        if (video.videoWidth > 0 && canvas.width > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Process frame
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          MediaProcessor.processFrame(imageData);
          
          this.updatePlaybackInfo();
        }
      }
      
      this.state.previewAnimationFrame = requestAnimationFrame(loop);
    };
    
    loop();
  },
  
  stopPreview() {
    this.state.isPreviewPlaying = false;
    if (this.state.previewAnimationFrame) {
      cancelAnimationFrame(this.state.previewAnimationFrame);
      this.state.previewAnimationFrame = null;
    }
  },
  
  updatePlaybackInfo() {
    const video = this.core.state.video;
    if (video) {
      const time = video.currentTime.toFixed(1);
      const duration = video.duration.toFixed(1);
      document.getElementById('durationCounter').textContent = `${time}s / ${duration}s`;
    }
  },
  
  startCapture() {
    if (this.state.isCapturing) return;
    
    const video = this.core.state.video;
    if (!video) return;
    
    this.state.isCapturing = true;
    this.state.frameCount = 0;
    this.core.state.exportFrames = []; // Clear previous capture
    
    // UI Updates
    document.getElementById('captureAnimation').style.display = 'none';
    document.getElementById('stopCapture').style.display = 'inline-flex';
    document.getElementById('captureProgress').style.display = 'block';
    
    const statusEl = document.getElementById('captureStatus');
    if (statusEl) {
      statusEl.style.display = 'flex';
      statusEl.querySelector('span').textContent = 'Capturing...';
      statusEl.querySelector('.status-indicator').className = 'status-indicator recording';
    }
    
    // Reset video to start
    video.currentTime = 0;
    video.play();
    this.updatePlayButton(true);
    
    // Start capture loop
    this.captureLoop();
  },
  
  captureLoop() {
    if (!this.state.isCapturing) return;
    
    const video = this.core.state.video;
    
    if (video.ended) {
      this.stopCapture();
      return;
    }
    
    // Capture current frame
    const ascii = document.getElementById('ascii-art').textContent;
    if (ascii) {
      this.core.state.exportFrames.push({
        timestamp: video.currentTime * 1000, // ms
        content: ascii
      });
      this.state.frameCount++;
      
      // Update progress
      const percent = (video.currentTime / video.duration) * 100;
      document.getElementById('captureProgressFill').style.width = `${percent}%`;
      document.getElementById('frameCounter').textContent = `${this.state.frameCount} frames`;
    }
    
    requestAnimationFrame(() => this.captureLoop());
  },
  
  stopCapture() {
    this.state.isCapturing = false;
    
    const video = this.core.state.video;
    if (video) video.pause();
    this.updatePlayButton(false);
    
    // UI Updates
    document.getElementById('captureAnimation').style.display = 'inline-flex';
    document.getElementById('stopCapture').style.display = 'none';
    document.getElementById('captureProgress').style.display = 'none';
    
    const statusEl = document.getElementById('captureStatus');
    if (statusEl) {
      statusEl.querySelector('span').textContent = 'Capture Complete';
      statusEl.querySelector('.status-indicator').className = 'status-indicator success';
      setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
    
    this.core.showMessage(`Captured ${this.state.frameCount} frames. Ready to export.`, 'success');
    
    // Notify ExportManager
    if (ExportManager) {
      ExportManager.updateExportStatus();
    }
  },
  
  updateFrameCountAndProgress() {
    // Initial update
    this.updatePlaybackInfo();
  }
};