const CaptureEngine = {
  core: null,
  state: {

    isPreviewPlaying: false,
    previewAnimationFrame: null,
    isProcessing: false, // New flag to prevent concurrent exports
  },

  init(coreModule) {
    this.core = coreModule;
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Only playback controls here. Capture is now part of Export.
    document
      .getElementById("playPauseButton")
      ?.addEventListener("click", () => this.togglePlayback());

    const loopToggle = document.getElementById("loopPlayback");
    if (loopToggle) {
      loopToggle.addEventListener("change", (e) => {
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
      video
        .play()
        .then(() => {
          this.core.state.isPlaying = true;
          this.startPreview();
          this.updatePlayButton(true);
        })
        .catch((err) => console.error("Play failed:", err));
    } else {
      video.pause();
      this.core.state.isPlaying = false;
      this.stopPreview();
      this.updatePlayButton(false);
    }
  },

  updatePlayButton(isPlaying) {
    const btn = document.getElementById("playPauseButton");
    if (!btn) return;

    if (isPlaying) {
      // Pause Icon
      btn.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    } else {
      // Play Icon
      btn.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
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
      const counter = document.getElementById("durationCounter");
      if (counter) counter.textContent = `${time}s / ${duration}s`;
    }
  },

  updateFrameCountAndProgress() {
    this.updatePlaybackInfo();
  },

  // =========================================================================
  // OFFLINE PROCESSING (NEW)
  // =========================================================================

  async processVideo(targetFps, updateProgressCallback) {
    if (this.state.isProcessing) return;
    this.state.isProcessing = true;

    const video = this.core.state.video;
    if (!video) throw new Error("No video loaded");

    const duration = video.duration;
    const interval = 1 / targetFps;
    const frames = [];
    const totalFrames = Math.floor(duration * targetFps);

    // Pause playback during processing
    const wasPlaying = !video.paused;
    if (wasPlaying) video.pause();
    this.stopPreview();

    try {
      for (let i = 0; i < totalFrames; i++) {
        const time = i * interval;
        video.currentTime = time;

        // Wait for seek to complete
        await new Promise((resolve) => {
          const onSeek = () => {
            video.removeEventListener("seeked", onSeek);
            resolve();
          };
          video.addEventListener("seeked", onSeek);
        });

        // Capture frame
        const canvas = this.core.state.videoCanvas;
        const ctx = this.core.state.videoContext;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Convert to ASCII (using current settings)
        const ascii = MediaProcessor.processFrame(imageData);

        frames.push({
          timestamp: time * 1000,
          content: ascii,
        });

        if (updateProgressCallback) {
          updateProgressCallback(Math.round((i / totalFrames) * 100));
        }

        // Small delay to keep UI responsive
        if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      this.state.isProcessing = false;
      // Restore state mechanism if needed, or leave paused
      if (wasPlaying) {
        // Optional: Resume playback? Usually better to leave paused after export.
        // this.togglePlayback();
      }
    }

    return frames;
  },

  async processGif(updateProgressCallback) {
    // Gif frames are already decoded in core.state.gifFrames
    // We just need to convert them to ASCII using current settings
    const rawFrames = this.core.state.gifFrames;
    if (!rawFrames || rawFrames.length === 0)
      throw new Error("No GIF frames loaded");

    const processedFrames = [];
    const settings = UIManager.getSettings(); // Ensure we use latest settings

    // We need a canvas to putImageData to then getImageData back (or just pass wrapper)
    // MediaProcessor.convertToAscii takes imageData directly, so we can skip canvas draw!
    // Wait, MediaProcessor.convertToAscii splits logic. `processFrame` calls it.

    for (let i = 0; i < rawFrames.length; i++) {
      const frame = rawFrames[i];
      const ascii = MediaProcessor.convertToAscii(frame.data, settings);

      processedFrames.push({
        timestamp: i * frame.delay, // Approximate timestamp
        content: ascii,
      });

      if (updateProgressCallback) {
        updateProgressCallback(Math.round((i / rawFrames.length) * 100));
      }

      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    return processedFrames;
  },
};
