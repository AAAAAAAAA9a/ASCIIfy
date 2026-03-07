const MediaProcessor = {
  core: null,
  charCache: new Map(),

  init(coreModule) {
    this.core = coreModule;
    this.loadDefaultImage();
  },

  updateVideoCanvasSize() {
    const video = this.core?.state?.video;
    const canvas = this.core?.state?.videoCanvas;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    const settings = UIManager.getSettings();
    const fontAspectRatio = 0.55;
    const asciiWidth = Math.min(settings.width, this.core.state.maxProcessingWidth);
    const asciiHeight = Math.round(
      (video.videoHeight / video.videoWidth) * asciiWidth * fontAspectRatio
    );

    if (canvas.width !== asciiWidth) canvas.width = asciiWidth;
    if (canvas.height !== asciiHeight) canvas.height = asciiHeight;

    this.core.state.frameWidth = asciiWidth;
    this.core.state.frameHeight = asciiHeight;
  },

  processFile(file) {
    this.core.cleanupMedia();
    this.pauseGif();
    this.core.state.gifFrames = [];
    this.core.state.currentGifFrameIndex = 0;
    this.core.state.currentMedia = null;
    this.core.state.exportFrames = [];

    if (file.type === "image/gif") {
      this.core.state.currentFileType = "gif";
      this.processGifFile(file);
    } else if (file.type.startsWith("image/")) {
      this.core.state.currentFileType = "image";
      UIManager.toggleContentState(true, false);
      this.processImageFile(file);
    } else if (
      file.type.startsWith("video/") ||
      file.name.match(/\.(mp4|webm|ogg|mov|avi)$/i)
    ) {
      this.core.state.currentFileType = "video";
      UIManager.toggleContentState(true, true);
      this.processVideoFile(file);
    } else {
      this.core.showMessage(
        "Unsupported file type. Please upload an image, GIF, or video.",
        "error"
      );
      return;
    }

    const startExportBtn = document.getElementById("startExport");
    if (startExportBtn) startExportBtn.disabled = false;
  },

  processGifFile(file) {
    this.core.showMessage("Parsing GIF frames...", "info", 0, true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target.result);
        const GifReader =
          (window.exports && window.exports.GifReader) ||
          window.GifReader ||
          (window.omggif && window.omggif.GifReader);

        if (!GifReader) {
          throw new Error("GIF library not loaded correctly. Please refresh the page.");
        }

        const gifReader = new GifReader(buffer);
        const width = gifReader.width;
        const height = gifReader.height;
        const frames = [];

        for (let i = 0; i < gifReader.numFrames(); i++) {
          const frameInfo = gifReader.frameInfo(i);
          const pixels = new Uint8ClampedArray(width * height * 4);
          gifReader.decodeAndBlitFrameRGBA(i, pixels);

          frames.push({
            data: new ImageData(pixels, width, height),
            delay: Math.max(frameInfo.delay * 10, 30),
          });
        }

        this.core.state.gifFrames = frames;
        this.core.state.currentGifFrameIndex = 0;
        this.core.state.currentFileType = "gif";

        if (!this.core.state.gifCanvas) {
          this.core.state.gifCanvas = document.createElement("canvas");
        }

        this.core.state.gifCanvas.width = width;
        this.core.state.gifCanvas.height = height;
        this.core.state.currentMedia = this.core.state.gifCanvas;

        this.core.showMessage(`GIF loaded: ${frames.length} frames`, "success");
        UIManager.toggleContentState(true, true);
        this.playGif();
      } catch (error) {
        console.error("Error parsing GIF:", error);
        this.core.showMessage(`Error parsing GIF: ${error.message}`, "error");
      }
    };

    reader.readAsArrayBuffer(file);
  },

  playGif() {
    if (this.core.state.gifFrames.length === 0) return;

    if (
      this.core.state.currentGifFrameIndex >=
      this.core.state.gifFrames.length - 1
    ) {
      this.core.state.currentGifFrameIndex = 0;
    }

    this.core.state.isGifPlaying = true;
    this.updatePlayPauseIcon(true);
    this.renderGifLoop();
  },

  pauseGif() {
    this.core.state.isGifPlaying = false;
    this.updatePlayPauseIcon(false);

    if (this.core.state.gifInterval) {
      clearTimeout(this.core.state.gifInterval);
      this.core.state.gifInterval = null;
    }
  },

  stopGif() {
    this.pauseGif();
    this.core.state.currentGifFrameIndex = 0;

    if (this.core.state.gifFrames.length > 0) {
      this.renderGifFrame(0);
    }
  },

  renderGifLoop() {
    if (!this.core.state.isGifPlaying) return;

    const frameIndex = this.core.state.currentGifFrameIndex;
    const frame = this.core.state.gifFrames[frameIndex];

    this.renderGifFrame(frameIndex);

    const frameCounter = document.getElementById("frameCounter");
    if (frameCounter) {
      frameCounter.textContent = `${frameIndex + 1}/${this.core.state.gifFrames.length}`;
    }

    const shouldLoop = document.getElementById("loopPlayback")?.checked ?? true;
    let nextIndex = frameIndex + 1;

    if (nextIndex >= this.core.state.gifFrames.length) {
      if (!shouldLoop) {
        this.pauseGif();
        this.core.state.currentGifFrameIndex =
          this.core.state.gifFrames.length - 1;
        return;
      }

      nextIndex = 0;
    }

    this.core.state.currentGifFrameIndex = nextIndex;
    this.core.state.gifInterval = setTimeout(() => {
      requestAnimationFrame(() => this.renderGifLoop());
    }, frame.delay);
  },

  renderGifFrame(index) {
    if (!this.core.state.gifFrames[index]) return;

    const frame = this.core.state.gifFrames[index];
    const ctx = this.core.state.gifCanvas.getContext("2d");
    ctx.putImageData(frame.data, 0, 0);
    this.core.state.currentMedia = this.core.state.gifCanvas;
    this.processMedia(this.core.state.gifCanvas);
  },

  updatePlayPauseIcon(isPlaying) {
    const btn = document.getElementById("playPauseButton");
    if (!btn) return;

    btn.innerHTML = isPlaying
      ? '<svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : '<svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  },

  processImageFile(file) {
    this.core.showMessage("Processing image...", "info", 0, true);

    const objectURL = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      this.core.state.currentMedia = img;
      this.processMedia(img);
      this.core.showMessage("Image loaded", "success");
      URL.revokeObjectURL(objectURL);
    };

    img.onerror = () => {
      this.core.showMessage("Error loading image. Please try another file.", "error");
      URL.revokeObjectURL(objectURL);
    };

    img.src = objectURL;
  },

  processVideoFile(file) {
    this.core.state.currentMedia = null;
    this.core.showMessage("Processing video...", "info", 0, true);

    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = false;
    video.loop = true;
    video.playsInline = true;

    const videoURL = URL.createObjectURL(file);
    this.core.state.videoObjectURL = videoURL;
    video.src = videoURL;

    const loadingTimeout = setTimeout(() => {
      if (video.readyState < 2) {
        this.core.showMessage("Video loading timeout. Please try another file.", "error");
        this.cleanupVideoResources(video, videoURL);
      }
    }, 30000);

    video.addEventListener("loadedmetadata", () => {
      clearTimeout(loadingTimeout);

      if (!video.videoWidth || !video.videoHeight) {
        this.core.showMessage("Invalid video dimensions.", "error");
        this.cleanupVideoResources(video, videoURL);
        return;
      }

      this.core.state.video = video;
      this.core.state.currentMedia = video;
      this.updateVideoCanvasSize();

      this.core.showMessage("Video loaded. Live preview starting...", "success");

      if (CaptureEngine && CaptureEngine.updateFrameCountAndProgress) {
        setTimeout(() => CaptureEngine.updateFrameCountAndProgress(), 100);
      }

      if (CaptureEngine && CaptureEngine.startPreview) {
        setTimeout(() => {
          CaptureEngine.startPreview();
        }, 300);
      }
    });

    video.addEventListener("ended", () => {
      this.core.state.isPlaying = false;

      if (CaptureEngine) {
        CaptureEngine.stopPreview();
        CaptureEngine.updatePlayButton(false);
      }
    });

    video.addEventListener("error", (e) => {
      clearTimeout(loadingTimeout);
      console.error("Video loading error:", e);
      this.core.showMessage("Error loading video. Format may not be supported.", "error");
      this.cleanupVideoResources(video, videoURL);
    });
  },

  cleanupVideoResources(videoElement, videoURL) {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
    }

    if (videoURL) URL.revokeObjectURL(videoURL);

    if (this.core.state.videoObjectURL) {
      URL.revokeObjectURL(this.core.state.videoObjectURL);
      this.core.state.videoObjectURL = null;
    }
  },

  processMedia(media) {
    try {
      const settings = UIManager.getSettings();

      if (!media || !media.width || !media.height) {
        if (!(media.videoWidth && media.videoHeight)) {
          throw new Error("Invalid media dimensions");
        }
      }

      const fontAspectRatio = 0.55;
      const asciiWidth = Math.min(settings.width, this.core.state.maxProcessingWidth);
      const mediaWidth = media.videoWidth || media.width;
      const mediaHeight = media.videoHeight || media.height;
      const asciiHeight = Math.round(
        (mediaHeight / mediaWidth) * asciiWidth * fontAspectRatio
      );

      this.core.state.frameWidth = asciiWidth;
      this.core.state.frameHeight = asciiHeight;

      const canvas = this.core.state.canvas;
      if (!canvas) throw new Error("Canvas element not found in core state");

      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (canvas.width !== asciiWidth || canvas.height !== asciiHeight) {
        canvas.width = asciiWidth;
        canvas.height = asciiHeight;
      }

      ctx.filter = settings.blur > 0 ? `blur(${settings.blur}px)` : "none";
      ctx.drawImage(media, 0, 0, asciiWidth, asciiHeight);

      const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
      const ascii = this.convertToAscii(imageData, settings);

      if (this.core.state.currentFileType === "image") {
        this.core.state.frames = [ascii];
      }

      document.getElementById("ascii-art").textContent = ascii;
      return ascii;
    } catch (error) {
      this.core.showMessage(`Error processing media: ${error.message}`, "error");
      return "";
    }
  },

  processFrame(imageData) {
    const settings = UIManager.getSettings();
    return this.convertToAscii(imageData, settings);
  },

  convertToAscii(imageData, settings) {
    const { width, height, data } = imageData;
    const pixelCount = width * height;
    const contrast = settings.contrast;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightness = settings.brightness;
    const gamma = settings.gamma || 1.0;
    const threshold = settings.threshold || 128;
    const gray = new Uint8Array(pixelCount);

    const rWeight = 0.299;
    const gWeight = 0.587;
    const bWeight = 0.114;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let lum = (rWeight * r + gWeight * g + bWeight * b) | 0;
      if (settings.invert) lum = 255 - lum;

      let adjusted = contrastFactor * (lum - 128) + 128 + brightness;
      if (gamma !== 1.0) {
        adjusted =
          255 *
          Math.pow(Math.max(0, Math.min(255, adjusted)) / 255, 1 / gamma);
      }

      adjusted = adjusted < 0 ? 0 : adjusted > 255 ? 255 : adjusted;
      gray[j] = adjusted | 0;
    }

    if (settings.dithering) {
      this.applyFloydSteinbergDithering(gray, width, height, settings.charset, threshold);
    }

    const processedGray = settings.edgeDetection
      ? this.applyEdgeDetection(gray, width, height, settings.edgeThreshold || 50)
      : gray;

    return this.mapPixelsToChars(
      processedGray,
      width,
      height,
      settings.ignoreWhite,
      settings.charset,
      threshold
    );
  },

  applyFloydSteinbergDithering(gray, width, height, charset, threshold) {
    let levels = 2;
    if (charset === "blocks") levels = 5;
    else if (charset === "standard") levels = 10;
    else if (charset === "simple") levels = 10;

    const step = 255 / (levels - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldPixel = gray[i];

        let newPixel;
        if (levels === 2) {
          newPixel = oldPixel < threshold ? 0 : 255;
        } else {
          newPixel = Math.round(oldPixel / step) * step;
        }

        gray[i] = newPixel;

        const quantError = oldPixel - newPixel;

        if (x + 1 < width) {
          gray[i + 1] = Math.min(
            255,
            Math.max(0, gray[i + 1] + (quantError * 7) / 16)
          );
        }
        if (x - 1 >= 0 && y + 1 < height) {
          gray[i + width - 1] = Math.min(
            255,
            Math.max(0, gray[i + width - 1] + (quantError * 3) / 16)
          );
        }
        if (y + 1 < height) {
          gray[i + width] = Math.min(
            255,
            Math.max(0, gray[i + width] + (quantError * 5) / 16)
          );
        }
        if (x + 1 < width && y + 1 < height) {
          gray[i + width + 1] = Math.min(
            255,
            Math.max(0, gray[i + width + 1] + quantError / 16)
          );
        }
      }
    }
  },

  mapPixelsToChars(gray, width, height, ignoreWhite, charset, threshold) {
    let gradient = this.core.state.cachedGradients[charset];

    if (!gradient) {
      switch (charset) {
        case "blocks":
          gradient = "\u2588\u2593\u2592\u2591 ";
          break;
        case "standard":
          gradient = "@%#*+=-:. ";
          break;
        case "simple":
          gradient = " .:-=+*#%@";
          break;
        case "binary":
        default:
          gradient = "10";
          break;
      }

      this.core.state.cachedGradients[charset] = gradient;
    }

    const nLevels = gradient.length;
    const scaleFactor = (nLevels - 1) / 255;
    const whiteCutoff = 250;
    const cacheKey = `${charset}_${ignoreWhite}_${nLevels}_${threshold}`;
    let charMapping = this.charCache.get(cacheKey);

    if (!charMapping) {
      charMapping = new Array(256);

      for (let i = 0; i < 256; i++) {
        if (ignoreWhite && i >= whiteCutoff) {
          charMapping[i] = " ";
        } else {
          let level;
          if (nLevels === 2) {
            level = i < threshold ? 0 : 1;
          } else {
            level = Math.min(
              nLevels - 1,
              Math.max(0, (i * scaleFactor + 0.5) | 0)
            );
          }

          charMapping[i] = gradient[level];
        }
      }

      this.charCache.set(cacheKey, charMapping);
    }

    const result = new Array(height);
    let offset = 0;

    for (let y = 0; y < height; y++) {
      let row = "";
      for (let x = 0; x < width; x++) {
        row += charMapping[gray[offset++]];
      }
      result[y] = row;
    }

    return result.join("\n");
  },

  applyEdgeDetection(gray, width, height, threshold) {
    const size = width * height;
    const edges = new Uint8Array(size);
    edges.fill(255);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const tl = gray[i - width - 1];
        const t = gray[i - width];
        const tr = gray[i - width + 1];
        const l = gray[i - 1];
        const r = gray[i + 1];
        const bl = gray[i + width - 1];
        const b = gray[i + width];
        const br = gray[i + width + 1];

        const gx = -tl + tr - 2 * l + 2 * r - bl + br;
        const gy = -tl - 2 * t - tr + bl + 2 * b + br;
        const mag = Math.sqrt(gx * gx + gy * gy);

        edges[i] = mag > threshold ? 0 : 255;
      }
    }

    return edges;
  },

  loadDefaultImage() {
    this.core.updateStatusMessage("Ready to process images and videos.");
  },
};
