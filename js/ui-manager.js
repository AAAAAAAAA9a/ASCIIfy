const UIManager = {
  core: null,

  init(coreModule) {
    this.core = coreModule;
    this.setupAutomaticZoom();
    this.setupFileProcessing();
    this.setupControls();
  },

  setupAutomaticZoom() {
    const screenWidth = window.innerWidth;
    const mainContent = document.querySelector(".main-content");
    // Adjusted for new sidebar width (320px)
    const availableWidth = mainContent
      ? mainContent.offsetWidth
      : screenWidth - 320;

    const zoomInput = document.getElementById("zoom");
    if (zoomInput) {
      const initialZoom = 100;
      zoomInput.value = initialZoom;

      const zoomVal = document.getElementById("zoomVal");
      if (zoomVal) {
        zoomVal.textContent = zoomInput.value + "%";
      }

      this.applyZoom(initialZoom);
    }

    window.addEventListener("resize", () => {
      const zoomInput = document.getElementById("zoom");
      if (zoomInput) {
        const currentZoom = parseInt(zoomInput.value, 10);
        this.applyZoom(currentZoom);
      }
    });
  },

  applyZoom(zoomPercent) {
    const asciiArt = document.getElementById("ascii-art");
    if (asciiArt) {
      // Base font size for 100% zoom
      const baseFontSize = 8;
      const newFontSize = (baseFontSize * zoomPercent) / 100;
      asciiArt.style.fontSize = newFontSize + "px";
      asciiArt.style.lineHeight = newFontSize + "px";
    }
  },

  setupFileProcessing() {
    const fileInput = document.getElementById("unifiedInput");
    const dropZone = document.querySelector(".unified-drop-zone");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          MediaProcessor.processFile(file);
        }
      });
    }

    if (dropZone && fileInput) {
      // Handle click on the browse button inside drop zone
      const browseBtn = dropZone.querySelector("button");
      if (browseBtn) {
        browseBtn.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent double trigger if parent has listener
          fileInput.click();
        });
      }

      dropZone.addEventListener("click", () => {
        fileInput.click();
      });

      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      });

      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
      });

      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) {
          MediaProcessor.processFile(file);
        } else {
          this.core.showMessage(
            "Please drop a valid image or video file.",
            "error"
          );
        }
      });
    }
  },

  setupControls() {
    const controls = [
      "asciiWidth",
      "brightness",
      "contrast",
      "blur",
      "gamma",
      "threshold",
      "edgeThreshold",
      "invert",
      "ignoreWhite",
      "dithering",
      "zoom",
    ];
    controls.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener("input", () => this.updateSettings());
      }
    });

    const edgeToggle = document.getElementById("enableEdgeDetection");
    if (edgeToggle) {
      edgeToggle.addEventListener("change", () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }

    const charsetSelect = document.getElementById("charset");
    if (charsetSelect) {
      charsetSelect.addEventListener("change", () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }

    document
      .getElementById("reset")
      ?.addEventListener("click", () => this.resetSettings());
    document
      .getElementById("clearWorkspace")
      ?.addEventListener("click", () => this.core.clearWorkspace());

    // Playback Controls
    const playPauseBtn = document.getElementById('playPauseButton');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (this.core.state.currentFileType === 'video') {
          const video = this.core.state.video;
          if (video) {
            if (video.paused) {
              video.play();
              this.core.state.isPlaying = true;
            } else {
              video.pause();
              this.core.state.isPlaying = false;
            }
            // Icon update handled by CaptureEngine loop or we can force it here
            // But for now let's rely on the existing loop or add a helper
            const isPlaying = !video.paused;
            playPauseBtn.innerHTML = isPlaying 
              ? `<svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
              : `<svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
          }
        } else if (this.core.state.currentFileType === 'gif') {
          if (this.core.state.isGifPlaying) {
            MediaProcessor.pauseGif();
          } else {
            MediaProcessor.playGif();
          }
        }
      });
    }

    // Export buttons

  },

  updateSettings() {
    document.getElementById("asciiWidthVal").textContent =
      document.getElementById("asciiWidth").value;
    document.getElementById("brightnessVal").textContent =
      document.getElementById("brightness").value;
    document.getElementById("contrastVal").textContent =
      document.getElementById("contrast").value;
    document.getElementById("blurVal").textContent =
      document.getElementById("blur").value;
    document.getElementById("gammaVal").textContent =
      document.getElementById("gamma").value;
    document.getElementById("thresholdVal").textContent =
      document.getElementById("threshold").value;
    document.getElementById("edgeThresholdVal").textContent =
      document.getElementById("edgeThreshold").value;
    document.getElementById("zoomVal").textContent =
      document.getElementById("zoom").value + "%";

    const zoomPercent = parseInt(document.getElementById("zoom").value, 10);
    this.applyZoom(zoomPercent);

    clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      if (this.core.state.currentMedia) {
        if (this.core.state.currentFileType === "image") {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      }
    }, 50);
  },

  resetSettings() {
    document.getElementById("asciiWidth").value = 150;
    document.getElementById("brightness").value = 0;
    document.getElementById("contrast").value = 0;
    document.getElementById("blur").value = 0;
    document.getElementById("gamma").value = 1.0;
    document.getElementById("threshold").value = 128;
    document.getElementById("edgeThreshold").value = 50;
    document.getElementById("invert").checked = false;
    document.getElementById("ignoreWhite").checked = true;
    document.getElementById("dithering").checked = false;
    document.getElementById("zoom").value = 100;
    document.getElementById("charset").value = "binary";

    const edgeToggle = document.getElementById("enableEdgeDetection");
    if (edgeToggle) edgeToggle.checked = false;

    this.updateSettings();
  },

  getSettings() {
    return {
      charset: document.getElementById("charset")?.value || "binary",
      width: parseInt(document.getElementById("asciiWidth").value, 10),
      brightness: parseFloat(document.getElementById("brightness").value),
      contrast: parseFloat(document.getElementById("contrast").value),
      blur: parseFloat(document.getElementById("blur").value),
      gamma: parseFloat(document.getElementById("gamma").value),
      threshold: parseInt(document.getElementById("threshold").value, 10),
      edgeThreshold: parseInt(document.getElementById("edgeThreshold").value, 10),
      invert: document.getElementById("invert")?.checked || false,
      ignoreWhite: document.getElementById("ignoreWhite")?.checked || true,
      dithering: document.getElementById("dithering")?.checked || false,
      edgeDetection:
        document.getElementById("enableEdgeDetection")?.checked || false,
    };
  },

  toggleContentState(hasContent, isVideo = false) {
    const mainContent = document.querySelector(".main-content");
    const playbackControls = document.getElementById("playbackControls");

    if (hasContent) {
      mainContent.classList.add("has-content");
      if (isVideo) {
        mainContent.classList.add("has-video");
        if (playbackControls) playbackControls.style.display = "flex";
      } else {
        mainContent.classList.remove("has-video");
        if (playbackControls) playbackControls.style.display = "none";
      }
    } else {
      mainContent.classList.remove("has-content");
      mainContent.classList.remove("has-video");
      if (playbackControls) playbackControls.style.display = "none";
    }
  },

  updateFileTypeIndicator(type, details) {
    // No-op for now as UI handles it
  },
};
