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
    
    this.state.captureProgressFill = document.getElementById('captureProgressFill');
    this.state.captureProgressText = document.getElementById('captureProgressText');
    this.state.frameCounter = document.getElementById('frameCounter');
    this.state.durationCounter = document.getElementById('durationCounter');
    this.state.captureStatus = document.getElementById('captureStatus');
    this.state.captureStatusIndicator = this.state.captureStatus?.querySelector('.status-indicator');
    this.state.exportStatusEl = document.getElementById('exportStatus');
    this.state.exportStatusIndicator = this.state.exportStatusEl?.querySelector('.status-indicator');
    
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.startCapture());
    }
    
    if (stopCaptureBtn) {
      stopCaptureBtn.addEventListener('click', () => this.stopCapture());
    }
    
    const playPauseBtn = document.getElementById('playPauseButton');
    const loopCheckbox = document.getElementById('loopPlayback');
    
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    }
    
    if (loopCheckbox) {
      loopCheckbox.addEventListener('change', () => {
        if (this.core.state.video) {
          this.core.state.video.loop = loopCheckbox.checked;
        }
      });
    }
    
    const fpsInput = document.getElementById('exportFPS');
    if (fpsInput) {
      ['input', 'change'].forEach(eventType => {
        fpsInput.addEventListener(eventType, () => {
          if (this.core.state.video && this.core.state.currentFileType === 'video') {
            this.updateFrameCountAndProgress();
          }
        });
      });
    }
    
    const clearExportFramesBtn = document.getElementById('clearExportFrames');
    if (clearExportFramesBtn) {
      clearExportFramesBtn.addEventListener('click', () => this.clearExportFrames());
    }
  },

  togglePlayPause() {
    if (!this.core.state.video || this.core.state.currentFileType !== 'video') {
      this.core.showMessage('No video loaded.', 'error');
      return;
    }
    
    const playPauseBtn = document.getElementById('playPauseButton');
    
    if (this.core.state.isPreviewPlaying) {
      // Currently playing, so pause
      this.stopPreview();
      playPauseBtn.textContent = 'Play';
    } else {
      // Currently paused, so play
      this.startPreview();
      playPauseBtn.textContent = 'Pause';
    }
  },

  updateFrameCountAndProgress() {
    const fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const video = this.core.state.video;
    if (!video) return;
    const duration = video.duration || 0;
    const frameCount = duration > 0 ? Math.max(2, Math.round(duration * fps) + 1) : 0;
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
    
    if (this.core.state.isPlaying) {
      this.stopCapture();
    }
    
    const playPauseBtn = document.getElementById('playPauseButton');
    if (playPauseBtn) {
      playPauseBtn.textContent = 'Pause';
    }
    
    const loopElement = document.getElementById('loopPlayback');
    const shouldLoop = loopElement ? loopElement.checked : true;
    
    this.core.state.video.currentTime = 0;
    this.core.state.video.loop = shouldLoop;
    this.core.state.video.muted = true;
    
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
        if (playPauseBtn) {
          playPauseBtn.textContent = 'Play';
        }
      });
  },
  
  previewVideoFrames(timestamp) {
    if (!this.core.state.video || !this.core.state.isPreviewPlaying) return;
    
    const video = this.core.state.video;
    const asciiArtElement = document.getElementById('ascii-art');
    
    if (!video.readyState >= 2) {
      this.state.previewAnimationFrame = requestAnimationFrame((ts) => this.previewVideoFrames(ts));
      return;
    }
    
    if (video.paused || video.ended) {
      if ((video.ended && !video.loop) || video.paused) {
        this.stopPreview();
        return;
      }
    }
    
    const now = timestamp || performance.now(); 
    
    
    if (this._lastPreviewRender && now - this._lastPreviewRender < 16) {
      this.state.previewAnimationFrame = requestAnimationFrame((ts) => this.previewVideoFrames(ts));
      return;
    }
    this._lastPreviewRender = now;
    
    const ctx = this.core.state.videoContext;
    const canvas = this.core.state.videoCanvas;
    
    if (!ctx || !canvas || !asciiArtElement) {
      this.state.previewAnimationFrame = requestAnimationFrame((ts) => this.previewVideoFrames(ts));
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const asciiFrame = MediaProcessor.processFrame(imageData);
    
    if (asciiFrame && asciiFrame.length > 0) {
      asciiArtElement.textContent = asciiFrame;
    }
    
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
    
    const playPauseBtn = document.getElementById('playPauseButton');
    if (playPauseBtn) {
      playPauseBtn.textContent = 'Play';
    }
    
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
    
    if (this.core.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    // Update play/pause button during capture
    const playPauseBtn = document.getElementById('playPauseButton');
    if (playPauseBtn) {
      playPauseBtn.textContent = 'Capturing...';
      playPauseBtn.disabled = true;
    }
    
    this.core.state.exportFrames = [];
    this.state.captureStartTime = Date.now();
    
    this.state.lastCaptureTime = 0;
    this.state.loopDetected = false;
    
    const captureBtn = document.getElementById('captureAnimation');
    const stopCaptureBtn = document.getElementById('stopCapture');
    const progressContainer = document.getElementById('captureProgress');
    
    captureBtn.style.display = 'none';
    stopCaptureBtn.style.display = 'block';
    progressContainer.style.display = 'block';
    this.state.frameCounter.textContent = '0 frames';
    this.state.durationCounter.textContent = '0.0s';
    
    if (this.state.captureStatusIndicator) {
      this.state.captureStatusIndicator.className = 'status-indicator recording';
      this.state.captureStatus.querySelector('span').textContent = 'Capturing frames for export...';
    }
    
    this.core.state.video.currentTime = 0;
    this.core.state.video.loop = false;
    
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

    if (!video.readyState >= 2) {
      this.state.animationFrame = requestAnimationFrame((ts) => this.captureVideoFrames(ts));
      return;
    }
    
    const MAX_FRAMES = 3000;
    if (this.core.state.exportFrames.length >= MAX_FRAMES) {
      this.core.state.isPlaying = false;
      const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
      this.core.showMessage(`Maximum frame limit (${MAX_FRAMES}) reached. Stopping capture.`, 'warning');
      this.finalizeCaptureAndUpdateUI(MAX_FRAMES, duration);
      return;
    }

    if (video.paused || video.ended) {
      if (this.core.state.isPlaying && video.ended) {
        this.core.state.isPlaying = false;
        
        const capturedFrames = this.core.state.exportFrames.length;
        const duration = ((Date.now() - this.state.captureStartTime) / 1000).toFixed(1);
        
        this.finalizeCaptureAndUpdateUI(capturedFrames, duration);
        return;
      }
      return;
    }
    
    if (!this._cachedFPS) {
      this._cachedFPS = parseInt(document.getElementById('exportFPS').value, 10) || 30;
      this._targetFrameInterval = 1000 / this._cachedFPS;
      
      if (video.duration) {
        const expectedFrames = Math.ceil(video.duration * this._cachedFPS);
        this._exportFrameIndex = 0;
        
        if (!this.core.state.exportFrames.length) {
          this.core.state.exportFrames = new Array(Math.min(expectedFrames, MAX_FRAMES));
        }
      }
    }
    
    const elapsed = timestamp - (this.state.lastFrameTime || 0);
    if (!this.state.lastFrameTime || elapsed >= this._targetFrameInterval) {
      const timeDrift = elapsed % this._targetFrameInterval;
      this.state.lastFrameTime = timestamp - timeDrift;
      
      this.state.lastCaptureTime = video.currentTime;
      
      const isNearEnd = video.duration > 0 && 
                        video.currentTime > 0 && 
                        (video.currentTime / video.duration) > 0.95;
      
      this.captureCurrentFrame(true);
      
      if (this._exportFrameIndex % 3 === 0) {
        this.updateCaptureProgress();
      }
      
      this._exportFrameIndex++;
      
      if (this._exportFrameIndex > 1000 && this._exportFrameIndex % 500 === 0) {
        if (window.gc) window.gc();
        
        if (window.performance && window.performance.memory) {
          const memoryInfo = window.performance.memory;
          const thresholdMB = 1500;
          
          if (memoryInfo.usedJSHeapSize > thresholdMB * 1024 * 1024) {
            console.warn('Memory usage high. Stopping capture to prevent crash.');
            this.core.showMessage('Memory usage high. Stopping capture to prevent crash.', 'warning');
            this.stopCapture();
            return;
          }
        }
      }
    }

    if (this.core.state.isPlaying) {
      this.state.animationFrame = requestAnimationFrame((ts) => this.captureVideoFrames(ts));
    }
  },
  
  finalizeCaptureAndUpdateUI(capturedFrames, duration) {
    this.resetCaptureUI();
    
    if (capturedFrames > 0) {
      this.core.state.hasExportCapture = true;
      
      if (this.state.exportStatusEl) {
        const statusIndicator = this.state.exportStatusIndicator;
        const statusText = this.state.exportStatusEl.querySelector('span');
        
        if (statusIndicator) statusIndicator.className = 'status-indicator ready';
        if (statusText) statusText.textContent = `${capturedFrames} frames captured for export (${duration}s)`;
      }
      
      document.getElementById('startExport').disabled = false;
      
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
    const asciiArtElement = document.getElementById('ascii-art');
    
    if (!ctx || !canvas || !this.core.state.video) return null;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw video frame for capture
    ctx.drawImage(this.core.state.video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const video = this.core.state.video;
    const duration = video.duration || 0;
    
    if (duration <= 0) return null;
    
    const position = video.currentTime / duration;
    
    const asciiFrame = MediaProcessor.processFrame(imageData);
    
    if (asciiArtElement) {
      asciiArtElement.textContent = asciiFrame;
    }
    
    let frameType = "normal";
    
    if ((forExport && this.core.state.exportFrames.length === 0) || 
        (!forExport && this.core.state.frames.length === 0)) {
      frameType = "first";
    } 
    else if (position > 0.95 || (duration > 0 && (duration - video.currentTime) < 0.1)) {
      frameType = "last";
    }
    
    const frameData = {
      content: asciiFrame,
      timestamp: video.currentTime,
      position: position,
      frameType: frameType,
      captureTime: Date.now()
    };
    
    const exportFPS = parseInt(document.getElementById('exportFPS')?.value, 10) || 30;
    const maxFrames = Math.min(3000, Math.round(duration * exportFPS) + 1);
    
    if (forExport) {
      if (this.core.state.exportFrames.length < maxFrames) {
        if (asciiFrame && asciiFrame.length > 0) {
          this.core.state.exportFrames.push(frameData);
        }
      }
    } else {
      if (this.core.state.frames.length < maxFrames) {
        if (asciiFrame && asciiFrame.length > 0) {
          this.core.state.frames.push(frameData);
        }
      }
    }
    
    return frameData;
  },
  
  updateCaptureProgress() {
    if (!this.core.state.video) return;
    
    const video = this.core.state.video;
    const duration = video.duration || 1;
    const currentTime = video.currentTime || 0;
    const position = currentTime / duration;
    const progressPercent = (position * 100).toFixed(0);
    
    const capturedFrames = this.core.state.exportFrames.length;
    const fps = parseInt(document.getElementById('exportFPS')?.value, 10) || 30;
    
    if (this.state.frameCounter) {
      this.state.frameCounter.textContent = `${capturedFrames} frames`;
    }
    
    if (this.state.durationCounter) {
      this.state.durationCounter.textContent = `${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s`;
    }
    
    if (this.state.captureProgressFill) {
      this.state.captureProgressFill.style.width = `${progressPercent}%`;
    }
    
    if (this.state.captureProgressText) {
      this.state.captureProgressText.textContent = `${progressPercent}%`;
    }
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
    
    if (this.core.state.currentMedia) {
      MediaProcessor.processMedia(this.core.state.currentMedia);
    }
  },
  
  clearExportFrames() {
    this.core.state.exportFrames = [];
    this.core.state.hasExportCapture = false;
    
    document.getElementById('startExport').disabled = true;
    
    if (this.state.exportStatusEl) {
      const statusIndicator = this.state.exportStatusIndicator;
      const statusText = this.state.exportStatusEl.querySelector('span');
      
      if (statusIndicator) statusIndicator.className = 'status-indicator empty';
      if (statusText) statusText.textContent = 'No animation captured for export yet';
    }
    
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
    const playPauseBtn = document.getElementById('playPauseButton');
    
    captureBtn.style.display = 'block';
    stopCaptureBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    
    // Reset play/pause button
    if (playPauseBtn) {
      playPauseBtn.textContent = 'Play';
      playPauseBtn.disabled = false;
    }
  }
};