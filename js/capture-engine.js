/**
 * ASCIIfy - Capture Engine Module
 * Handles video/animation capture functionality
 */

const CaptureEngine = {
  core: null,
  state: {
    isCapturing: false,
    captureStartTime: 0,
    lastFrameTime: 0,
    animationFrame: null,
    captureProgressFill: null,
    captureProgressText: null,
    frameCounter: null,
    durationCounter: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    
    // Get DOM references
    this.state.captureProgressFill = document.getElementById('captureProgressFill');
    this.state.captureProgressText = document.getElementById('captureProgressText');
    this.state.frameCounter = document.getElementById('frameCounter');
    this.state.durationCounter = document.getElementById('durationCounter');
    
    // Set up event listeners
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.startCapture());
    }
    
    if (stopCaptureBtn) {
      stopCaptureBtn.addEventListener('click', () => this.stopCapture());
    }
    // FPS live update
    const fpsInput = document.getElementById('exportFPS');
    if (fpsInput) {
      fpsInput.addEventListener('input', () => {
        if (this.core.state.video && this.core.state.currentFileType === 'video') {
          this.updateFrameCountAndProgress();
        }
      });
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

    startCapture() {
    if (!this.core.state.video || this.core.state.currentFileType !== 'video') {
      this.core.showMessage('No video loaded. Please upload a video first.', 'error');
      return;
    }
    
    if (this.core.state.isPlaying) {
      this.stopCapture();
      return;
    }
    
    // Reset frames array before capturing
    this.core.state.frames = [];
    this.state.captureStartTime = Date.now();
    
    // Update UI
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    const progressContainer = document.getElementById('captureProgress');
    
    captureBtn.style.display = 'none';
    stopCaptureBtn.style.display = 'block';
    progressContainer.style.display = 'block';
    this.state.frameCounter.textContent = '0 frames';
    this.state.durationCounter.textContent = '0.0s';
    
    // Check if looping is enabled
    const loopElement = document.getElementById('loopCapture');
    const shouldLoop = loopElement && loopElement.checked;
    
    // Set video to start
    this.core.state.video.currentTime = 0;
    this.core.state.video.loop = shouldLoop;
    
    // Start capture process
    this.core.state.isPlaying = true;
    
    const captureMessage = shouldLoop 
      ? 'Capturing animation frames with looping enabled. Click "Stop Capture" when you have enough frames.' 
      : 'Capturing animation frames... The process will stop automatically at the end of the video.';
    
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

    const isLooping = this.core.state.video.loop;

    if (this.core.state.video.paused || this.core.state.video.ended) {
      if (this.core.state.isPlaying) {
        if (this.core.state.video.ended && !isLooping) {
          // Video has ended naturally and looping is disabled - complete the capture
          this.core.state.isPlaying = false;
          
          const capturedFrames = this.core.state.frames.length;
          const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
          
          this.resetCaptureUI();
          
          if (capturedFrames > 0) {
            this.core.showMessage(`Capture complete! ${capturedFrames} frames captured over ${duration}s.`, 'success');
            document.getElementById('startExport').disabled = false;
            document.getElementById('previewAnimation').disabled = false;
          } else {
            this.core.showMessage('Capture failed. No frames were captured.', 'error');
          }
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
      
      // Capture the current frame
      this.captureCurrentFrame();
      
      // Update progress UI
      this.updateCaptureProgress();
    }

    if (this.core.state.isPlaying) {
      this.state.animationFrame = requestAnimationFrame((ts) => this.captureVideoFrames(ts));
    }
  },
  
  captureCurrentFrame() {
    const ctx = this.core.state.videoContext;
    const canvas = this.core.state.videoCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.core.state.video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const position = this.core.state.video.currentTime / this.core.state.video.duration;
    const asciiFrame = MediaProcessor.processFrame(imageData);
    document.getElementById('ascii-art').textContent = asciiFrame;
    
    // Store frame metadata with timestamp for better export accuracy
    const frameData = {
      content: asciiFrame,
      timestamp: this.core.state.video.currentTime,
      position: position
    };
    // Always include first and last frame
    const exportFPS = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const duration = this.core.state.video.duration || 0;
    const maxFrames = Math.min(3000, Math.round(duration * exportFPS) + 1);
    if (this.core.state.frames.length < maxFrames) {
      this.core.state.frames.push(frameData);
    }
  },
  
  updateCaptureProgress() {
    if (!this.core.state.video) return;
    
    const position = this.core.state.video.currentTime / this.core.state.video.duration;
    const progressPercent = (position * 100).toFixed(0);
    
    this.state.frameCounter.textContent = `${this.core.state.frames.length} frames`;
    this.state.durationCounter.textContent = `${this.core.state.video.currentTime.toFixed(1)}s / ${this.core.state.video.duration.toFixed(1)}s`;
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
    
    this.resetCaptureUI();
    
    const capturedFrames = this.core.state.frames.length;
    const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
    
    if (capturedFrames > 0) {
      this.core.showMessage(`Capture stopped. ${capturedFrames} frames captured over ${duration}s.`, 'success');
      document.getElementById('startExport').disabled = false;
      document.getElementById('previewAnimation').disabled = false;
    } else {
      this.core.showMessage('Capture stopped. No frames were captured.', 'warning');
    }
    
    // Process the current frame to show it in the UI
    if (this.core.state.currentMedia) {
      MediaProcessor.processMedia(this.core.state.currentMedia);
    }
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