const CaptureEngine = {
  core: null,
  state: {
    isPreviewPlaying: false,
    previewAnimationFrame: null,
    isProcessing: false,
  },

  init(coreModule) {
    this.core = coreModule;
    this.setupEventListeners();
  },

  setupEventListeners() {
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
    if (this.core.state.currentFileType !== "video") return;

    const video = this.core.state.video;
    if (!video) return;

    if (video.paused) {
      if (video.ended || video.currentTime >= video.duration) {
        video.currentTime = 0;
      }

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
      btn.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    } else {
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
        const video = this.core.state.video;
        const canvas = this.core.state.videoCanvas;
        const ctx = this.core.state.videoContext;

        if (video.videoWidth > 0 && canvas.width > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const ascii = MediaProcessor.processFrame(imageData);
          const output = document.getElementById("ascii-art");
          if (output) output.textContent = ascii;
          this.core.state.frameWidth = imageData.width;
          this.core.state.frameHeight = imageData.height;

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

  stopCapture() {
    const video = this.core.state.video;
    if (video) {
      video.pause();
      this.core.state.isPlaying = false;
    }

    this.stopPreview();
    this.updatePlayButton(false);
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

  async processVideo(targetFps, updateProgressCallback) {
    if (this.state.isProcessing) return;
    this.state.isProcessing = true;

    const video = this.core.state.video;
    if (!video) throw new Error("No video loaded");

    MediaProcessor.updateVideoCanvasSize();

    const duration = video.duration;
    const interval = 1 / targetFps;
    const frames = [];
    const totalFrames = Math.max(1, Math.floor(duration * targetFps));

    if (!video.paused) video.pause();
    this.stopPreview();

    try {
      for (let i = 0; i < totalFrames; i++) {
        const time = i * interval;

        await new Promise((resolve) => {
          if (Math.abs(video.currentTime - time) < 0.001) {
            resolve();
            return;
          }

          const onSeek = () => {
            video.removeEventListener("seeked", onSeek);
            resolve();
          };
          video.addEventListener("seeked", onSeek);
          video.currentTime = time;
        });

        const canvas = this.core.state.videoCanvas;
        const ctx = this.core.state.videoContext;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const ascii = MediaProcessor.processFrame(imageData);

        frames.push({
          timestamp: time * 1000,
          content: ascii,
        });

        if (updateProgressCallback) {
          updateProgressCallback(Math.round((i / totalFrames) * 100));
        }

        if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
      }

      if (updateProgressCallback) {
        updateProgressCallback(100);
      }
    } finally {
      this.state.isProcessing = false;
    }

    return frames;
  },

  async processGif(targetFps, updateProgressCallback) {
    const rawFrames = this.core.state.gifFrames;
    if (!rawFrames || rawFrames.length === 0)
      throw new Error("No GIF frames loaded");

    const processedFrames = [];
    const settings = UIManager.getSettings();
    const frameCache = new Array(rawFrames.length);
    const frameStartTimes = [];
    let totalDuration = 0;

    for (const frame of rawFrames) {
      frameStartTimes.push(totalDuration);
      totalDuration += frame.delay;
    }

    const interval = 1000 / targetFps;
    const totalFrames = Math.max(1, Math.ceil(totalDuration / interval));
    let sourceIndex = 0;

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = Math.min(i * interval, Math.max(0, totalDuration - 1));

      while (
        sourceIndex + 1 < rawFrames.length &&
        frameStartTimes[sourceIndex + 1] <= timestamp
      ) {
        sourceIndex++;
      }

      if (!frameCache[sourceIndex]) {
        frameCache[sourceIndex] = MediaProcessor.convertToAscii(
          rawFrames[sourceIndex].data,
          settings
        );
      }

      processedFrames.push({
        timestamp: Math.round(timestamp),
        content: frameCache[sourceIndex],
      });

      if (updateProgressCallback) {
        updateProgressCallback(Math.round((i / totalFrames) * 100));
      }

      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    if (updateProgressCallback) {
      updateProgressCallback(100);
    }

    return processedFrames;
  },
};
