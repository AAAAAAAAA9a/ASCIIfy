/**
 * ASCIIfy - Capture Engine Module
 * Handles video/animation capture functionality
 */

const CaptureEngine = {
  core: null,
  state: {
    isCapturing: false,
    isPreviewPlaying: false,
    captureStartTime: 0,
    lastFrameTime: 0,
    lastCaptureTime: 0,
    loopDetected: false,
    animationFrame: null,
    previewAnimationFrame: null,
    captureProgressFill: null,
    captureProgressText: null,
    frameCounter: null,
    durationCounter: null,
    captureStatus: null,
    captureStatusIndicator: null,
    exportStatusEl: null,
    exportStatusIndicator: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    
    // Get DOM references
    this.state.captureProgressFill = document.getElementById('captureProgressFill');
    this.state.captureProgressText = document.getElementById('captureProgressText');
    this.state.frameCounter = document.getElementById('frameCounter');
    this.state.durationCounter = document.getElementById('durationCounter');
    this.state.captureStatus = document.getElementById('captureStatus');
    this.state.captureStatusIndicator = this.state.captureStatus?.querySelector('.status-indicator');
    this.state.exportStatusEl = document.getElementById('exportStatus');
    this.state.exportStatusIndicator = this.state.exportStatusEl?.querySelector('.status-indicator');
    
    // Set up event listeners for capture
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.startCapture());
    }
    
    if (stopCaptureBtn) {
      stopCaptureBtn.addEventListener('click', () => this.stopCapture());
    }
    
    // Set up event listeners for preview
    const playPreviewBtn = document.getElementById('playPreview');
    const stopPreviewBtn = document.getElementById('stopPreview');
    
    if (playPreviewBtn) {
      playPreviewBtn.addEventListener('click', () => this.startPreview());
    }
    
    if (stopPreviewBtn) {
      stopPreviewBtn.addEventListener('click', () => this.stopPreview());
    }
    
    // Set up FPS change event listener
    const fpsInput = document.getElementById('exportFPS');
    if (fpsInput) {
      // Listen for both input (while sliding/typing) and change (when finalized)
      ['input', 'change'].forEach(eventType => {
        fpsInput.addEventListener(eventType, () => {
          if (this.core.state.video && this.core.state.currentFileType === 'video') {
            this.updateFrameCountAndProgress();
          }
        });
      });
    }
    
    // Setup clear export frames button
    const clearExportFramesBtn = document.getElementById('clearExportFrames');
    if (clearExportFramesBtn) {
      clearExportFramesBtn.addEventListener('click', () => this.clearExportFrames());
    }
  },

  updateFrameCountAndProgress() {
    // Calculate frame count based on FPS and video duration
    const fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const video = this.core.state.video;
    if (!video) return;
    const duration = video.duration || 0;
    // Always include first and last frame
    const frameCount = duration > 0 ? Math.max(2, Math.round(duration * fps) + 1) : 0;
    // Update UI
    if (this.state.frameCounter) {
      this.state.frameCounter.textContent = `${frameCount} frames`;
    }
    if (this.state.captureProgressFill) {
      this.state.captureProgressFill.style.width = '0%';
    }
    if (this.state.captureProgressText) {
      this.state.captureProgressText.textContent = '0%';
    }
  },

    startPreview() {
    if (!this.core.state.video || this.core.state.currentFileType !== 'video') {
      this.core.showMessage('No video loaded. Please upload a video first.', 'error');
      return;
    }
    
    if (this.core.state.isPreviewPlaying) {
      this.stopPreview();
      return;
    }
    
    // Stop capture if in progress
    if (this.core.state.isPlaying) {
      this.stopCapture();
    }
    
    // Update UI
    const playBtn = document.getElementById('playPreview');
    const stopBtn = document.getElementById('stopPreview');
    
    playBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    
    // Check if looping is enabled
    const loopElement = document.getElementById('previewLoop');
    const shouldLoop = loopElement ? loopElement.checked : true;
    
    // Set video properties
    this.core.state.video.currentTime = 0;
    this.core.state.video.loop = shouldLoop;
    this.core.state.video.muted = true;
    
    // Start preview process
    this.core.state.isPreviewPlaying = true;
    
    this.core.showMessage('Playing live preview. Adjust settings to see changes in real-time.', 'info', 3000);
    
    this.core.state.video.play()
      .then(() => {
        this.previewVideoFrames(performance.now());
      })
      .catch(err => {
        console.error('Failed to play video for preview:', err);
        this.core.state.isPreviewPlaying = false;
        this.core.showMessage('Failed to start video playback. Please try again.', 'error');
        playBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      });
  },
  
  previewVideoFrames(timestamp) {
    if (!this.core.state.video || !this.core.state.isPreviewPlaying) return;
    
    const video = this.core.state.video;
    
    if (video.paused || video.ended) {
      // If video has ended and no looping
      if ((video.ended && !video.loop) || video.paused) {
        this.stopPreview();
        return;
      }
    }
    
    // Process current frame for display
    const ctx = this.core.state.videoContext;
    const canvas = this.core.state.videoCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const asciiFrame = MediaProcessor.processFrame(imageData);
    document.getElementById('ascii-art').textContent = asciiFrame;
    
    // Request next frame
    this.state.previewAnimationFrame = requestAnimationFrame((ts) => this.previewVideoFrames(ts));
  },
  
  stopPreview() {
    if (!this.core.state.isPreviewPlaying) return;
    
    this.core.state.isPreviewPlaying = false;
    
    if (this.state.previewAnimationFrame) {
      cancelAnimationFrame(this.state.previewAnimationFrame);
      this.state.previewAnimationFrame = null;
    }
    
    if (this.core.state.video) {
      this.core.state.video.pause();
    }
    
    // Update UI
    const playBtn = document.getElementById('playPreview');
    const stopBtn = document.getElementById('stopPreview');
    
    playBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    
    this.core.showMessage('Preview stopped.', 'info', 2000);
  },
  
  startCapture() {
    if (!this.core.state.video || this.core.state.currentFileType !== 'video') {
      this.core.showMessage('No video loaded. Please upload a video first.', 'error');
      return;
    }
    
    if (this.core.state.isPlaying) {
      this.stopCapture();
      return;
    }
    
    // Stop preview if running
    if (this.core.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    // Reset export frames array before capturing
    this.core.state.exportFrames = [];
    this.state.captureStartTime = Date.now();
    
    // Reset loop detection state
    this.state.lastCaptureTime = 0;
    this.state.loopDetected = false;
    
    // Update UI
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    const progressContainer = document.getElementById('captureProgress');
    
    captureBtn.style.display = 'none';
    stopCaptureBtn.style.display = 'block';
    progressContainer.style.display = 'block';
    this.state.frameCounter.textContent = '0 frames';
    this.state.durationCounter.textContent = '0.0s';
    
    // Update status indicators
    if (this.state.captureStatusIndicator) {
      this.state.captureStatusIndicator.className = 'status-indicator recording';
      this.state.captureStatus.querySelector('span').textContent = 'Capturing frames for export...';
    }
    
    // Set video to start
    this.core.state.video.currentTime = 0;
    this.core.state.video.loop = false; // Always capture exactly one loop
    
    // Start capture process
    this.core.state.isPlaying = true;
    
    const captureMessage = 'Capturing frames for export. Will automatically stop after one complete playthrough.';
    this.core.showMessage(captureMessage, 'info', 0);
    
    this.core.state.video.play()
      .then(() => {
        this.state.lastFrameTime = 0;
        this.captureVideoFrames(performance.now());
      })
      .catch(err => {
        console.error('Failed to play video for capture:', err);
        this.core.state.isPlaying = false;
        this.core.showMessage('Failed to start video playback. Please try again.', 'error');
        this.resetCaptureUI();
      });
  },
    captureVideoFrames(timestamp) {
    if (!this.core.state.video || !this.core.state.isPlaying) return;

    const video = this.core.state.video;

    if (video.paused || video.ended) {
      if (this.core.state.isPlaying) {
        if (video.ended) {
          // Video has ended naturally - complete the capture
          this.core.state.isPlaying = false;
          
          const capturedFrames = this.core.state.exportFrames.length;
          const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
          
          this.finalizeCaptureAndUpdateUI(capturedFrames, duration);
          return;
        }
      }
      return;
    }
    
    // Get target FPS from the export settings
    const exportFPS = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    // Calculate time between frames based on desired FPS
    const targetFrameInterval = 1000 / exportFPS;
    
    // Only capture a frame if enough time has passed since the last frame
    if (!timestamp || timestamp - this.state.lastFrameTime >= targetFrameInterval) {
      this.state.lastFrameTime = timestamp;
      
      // Store the current time for loop detection
      this.state.lastCaptureTime = video.currentTime;
      
      // Capture the current frame (true = for export)
      this.captureCurrentFrame(true);
      
      // Update progress UI
      this.updateCaptureProgress();
    }

    if (this.core.state.isPlaying) {
      this.state.animationFrame = requestAnimationFrame((ts) => this.captureVideoFrames(ts));
    }
  },
  
  finalizeCaptureAndUpdateUI(capturedFrames, duration) {
    this.resetCaptureUI();
    
    if (capturedFrames > 0) {
      // Set export frames available flag
      this.core.state.hasExportCapture = true;
      
      // Update export status
      if (this.state.exportStatusEl) {
        const statusIndicator = this.state.exportStatusIndicator;
        const statusText = this.state.exportStatusEl.querySelector('span');
        
        if (statusIndicator) statusIndicator.className = 'status-indicator ready';
        if (statusText) statusText.textContent = `${capturedFrames} frames captured for export (${duration}s)`;
      }
      
      // Enable export button
      document.getElementById('startExport').disabled = false;
      
      // Update capture status to "ready to export"
      if (this.state.captureStatusIndicator) {
        this.state.captureStatusIndicator.className = 'status-indicator ready';
        this.state.captureStatus.querySelector('span').textContent = 'Capture complete - ready for export';
      }
      
      this.core.showMessage(`Capture complete! ${capturedFrames} frames captured over ${duration}s.`, 'success');
    } else {
      this.core.showMessage('Capture failed. No frames were captured.', 'error');
      
      if (this.state.captureStatusIndicator) {
        this.state.captureStatusIndicator.className = 'status-indicator empty';
        this.state.captureStatus.querySelector('span').textContent = 'Capture failed - try again';
      }
    }
  },
  
  captureCurrentFrame(forExport = false) {
    const ctx = this.core.state.videoContext;
    const canvas = this.core.state.videoCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.core.state.video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const video = this.core.state.video;
    const position = video.currentTime / video.duration;
    const duration = video.duration || 0;
    const asciiFrame = MediaProcessor.processFrame(imageData);
    document.getElementById('ascii-art').textContent = asciiFrame;
    
    // Determine if this is the first or last frame for potential loop transition smoothing
    let frameType = "normal";
    if ((forExport && this.core.state.exportFrames.length === 0) || 
        (!forExport && this.core.state.frames.length === 0)) {
      frameType = "first";
    } else if (position > 0.95) {
      // Identify frames near the end of the animation
      frameType = "last";
    }
    
    // Store enhanced frame metadata with timestamp and frame type for better export accuracy
    const frameData = {
      content: asciiFrame,
      timestamp: video.currentTime,
      position: position,
      frameType: frameType
    };
    
    // Store frame in appropriate array
    const exportFPS = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const maxFrames = Math.min(3000, Math.round(duration * exportFPS) + 1);
    
    if (forExport) {
      // Store in export frames if capturing for export
      if (this.core.state.exportFrames.length < maxFrames) {
        this.core.state.exportFrames.push(frameData);
      }
    } else {
      // Store in preview frames array
      if (this.core.state.frames.length < maxFrames) {
        this.core.state.frames.push(frameData);
      }
    }
  },
  
  updateCaptureProgress() {
    if (!this.core.state.video) return;
    
    const video = this.core.state.video;
    const position = video.currentTime / video.duration;
    const progressPercent = (position * 100).toFixed(0);
    
    // Update captured frame count
    const capturedFrames = this.core.state.exportFrames.length;
    const fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    
    this.state.frameCounter.textContent = `${capturedFrames} frames`;
    this.state.durationCounter.textContent = `${video.currentTime.toFixed(1)}s / ${video.duration.toFixed(1)}s`;
    this.state.captureProgressFill.style.width = `${progressPercent}%`;
    this.state.captureProgressText.textContent = `${progressPercent}%`;
  },
  
  stopCapture() {
    if (!this.core.state.isPlaying) return;
    
    this.core.state.isPlaying = false;
    
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
      this.state.animationFrame = null;
    }
    
    if (this.core.state.video) {
      this.core.state.video.pause();
    }
    
    const capturedFrames = this.core.state.exportFrames.length;
    const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
    
    this.finalizeCaptureAndUpdateUI(capturedFrames, duration);
    
    // Process the current frame to show it in the UI
    if (this.core.state.currentMedia) {
      MediaProcessor.processMedia(this.core.state.currentMedia);
    }
  },
  
  clearExportFrames() {
    this.core.state.exportFrames = [];
    this.core.state.hasExportCapture = false;
    
    // Update UI
    document.getElementById('startExport').disabled = true;
    
    // Update export status
    if (this.state.exportStatusEl) {
      const statusIndicator = this.state.exportStatusIndicator;
      const statusText = this.state.exportStatusEl.querySelector('span');
      
      if (statusIndicator) statusIndicator.className = 'status-indicator empty';
      if (statusText) statusText.textContent = 'No animation captured for export yet';
    }
    
    // Update capture status
    if (this.state.captureStatusIndicator) {
      this.state.captureStatusIndicator.className = 'status-indicator';
      this.state.captureStatus.querySelector('span').textContent = 'Ready to capture';
    }
    
    this.core.showMessage('Export frames cleared. Capture a new animation when ready.', 'info');
  },
  
  resetCaptureUI() {
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    const progressContainer = document.getElementById('captureProgress');
    
    captureBtn.style.display = 'block';
    stopCaptureBtn.style.display = 'none';
    progressContainer.style.display = 'none';
  }
};