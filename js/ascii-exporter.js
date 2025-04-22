const AsciiExporter = {
  state: {
    isPreviewPlaying: false,
    previewInterval: null,
    previewFrame: 0,
    previewButtonEl: null,
    stopPreviewButtonEl: null,
    asciiArtEl: null,
    exportInProgress: false,
    importedAnimation: null
  },
  
  init() {
    this.state.previewButtonEl = document.getElementById('previewAnimation');
    this.state.stopPreviewButtonEl = document.getElementById('stopPreview');
    this.state.asciiArtEl = document.getElementById('ascii-art');
    this.state.exportButtonEl = document.getElementById('startExport');
    this.state.exportProgressEl = document.getElementById('exportProgress');
    this.state.progressFillEl = document.getElementById('progressFill');
    this.state.progressTextEl = document.getElementById('progressText');
    
    this.state.exportButtonEl?.addEventListener('click', this.startExport.bind(this));
    this.state.previewButtonEl?.addEventListener('click', this.startPreview.bind(this));
    this.state.stopPreviewButtonEl?.addEventListener('click', this.stopPreview.bind(this));
    
    const importFileEl = document.getElementById('importFile');
    if (importFileEl) {
      importFileEl.addEventListener('change', this.handleImportAnimation.bind(this));
      
      const importDropZone = document.querySelector('.mini-drop-zone');
      if (importDropZone) {
        importDropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          importDropZone.classList.add('drag-over');
        });
        
        importDropZone.addEventListener('dragleave', () => {
          importDropZone.classList.remove('drag-over');
        });
        
        importDropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          importDropZone.classList.remove('drag-over');
          const file = e.dataTransfer.files[0];
          if (file) {
            this.handleImportFile(file);
          }
        });
        
        importDropZone.addEventListener('click', () => {
          importFileEl.click();
        });
      }
    }
  },

  showNotification(message, type = 'info', duration = 4000) {
    const notificationArea = document.getElementById('notificationArea');
    if (!notificationArea) return;
    
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.classList.add('visible');
    
    if (this._notificationTimeout) {
      clearTimeout(this._notificationTimeout);
    }
    
    this._notificationTimeout = setTimeout(() => {
      notificationArea.classList.remove('visible');
      
      setTimeout(() => {
        if (notificationArea.classList.contains('visible') === false) {
          notificationArea.textContent = '';
        }
      }, 500);
    }, duration);
    
    return notificationArea;
  },

  handleImportAnimation(e) {
    const file = e.target.files[0];
    if (file) {
      this.handleImportFile(file);
    }
  },
  
  handleImportFile(file) {
    this.clearPreview();
    
    if (!file.name.endsWith('.json') && !file.name.endsWith('.js')) {
      this.showNotification('Please select a valid JSON or JavaScript animation file', 'error');
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let animationData;
        
        if (file.name.endsWith('.json')) {
          animationData = JSON.parse(e.target.result);
        } else {
          const jsContent = e.target.result;
          const match = jsContent.match(/export\s+default\s+(\{[\s\S]*?\});/);
          if (match && match[1]) {
            animationData = JSON.parse(match[1]);
          } else {
            throw new Error('Could not extract animation data from JavaScript file');
          }
        }
        
        if (!animationData || !Array.isArray(animationData.frames) || !animationData.fps) {
          throw new Error('Invalid animation file format');
        }
        
        this.state.importedAnimation = animationData;
        
        this.state.previewButtonEl.disabled = false;
        
        document.getElementById('exportFPS').value = animationData.fps;
        
        this.showNotification(`Animation loaded successfully: ${animationData.frames.length} frames at ${animationData.fps} FPS`, 'success');
      } catch (err) {
        this.showNotification('Error loading animation file: ' + err.message, 'error');
      }
    };
    
    reader.onerror = () => {
      this.showNotification('Error reading the file', 'error');
    };
    
    reader.readAsText(file);
  },

  startPreview() {
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
      return;
    }
    
    let frames = null;
    let fps = 30;
    
    if (this.state.importedAnimation) {
      frames = this.state.importedAnimation.frames;
      fps = this.state.importedAnimation.fps;
    } else if (AsciiGenerator.state.frames && AsciiGenerator.state.frames.length > 0) {
      frames = AsciiGenerator.state.frames;
      fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    }
    
    if (!frames || frames.length === 0) {
      this.showNotification('No animation to preview. Please import an animation file or generate frames first.', 'error');
      return;
    }
    
    const frameInterval = 1000 / fps;
    
    this.state.asciiArtEl.textContent = '';
    
    this.state.previewButtonEl.disabled = true;
    this.state.stopPreviewButtonEl.disabled = false;
    this.state.stopPreviewButtonEl.style.display = 'inline-block';
    
    this.state.isPreviewPlaying = true;
    this.state.previewFrame = 0;
    
    if (AsciiGenerator.state.isPlaying) {
      AsciiGenerator.toggleVideo();
    }
    
    if (this.state.previewInterval) {
      cancelAnimationFrame(this.state.previewInterval);
    }
    
    this.showNotification(`Starting preview: ${frames.length} frames at ${fps} FPS`, 'info', 2000);
    
    let lastFrameTime = 0;
    
    const animate = (timestamp) => {
      if (!this.state.isPreviewPlaying) return;
      
      if (!lastFrameTime || timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
        this.state.asciiArtEl.textContent = frames[this.state.previewFrame];
        
        this.state.previewFrame = this.state.previewFrame + 1;
        
        if (this.state.previewFrame >= frames.length) {
          this.stopPreview();
          this.state.asciiArtEl.textContent += '\n\n[Preview complete - looping disabled]';
          return;
        }
      }
      
      this.state.previewInterval = requestAnimationFrame(animate);
    };
    
    this.state.previewInterval = requestAnimationFrame(animate);
  },
  
  stopPreview() {
    if (this.state.previewInterval) {
      cancelAnimationFrame(this.state.previewInterval);
      this.state.previewInterval = null;
    }
    
    this.state.isPreviewPlaying = false;
    
    this.state.previewButtonEl.disabled = false;
    this.state.stopPreviewButtonEl.disabled = true;
    this.state.stopPreviewButtonEl.style.display = 'none';
    
    if (AsciiGenerator.state.currentMedia) {
      AsciiGenerator.processMedia(AsciiGenerator.state.currentMedia);
    }
  },

  clearPreview() {
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    this.state.importedAnimation = null;
    
    if (!AsciiGenerator.state.frames || AsciiGenerator.state.frames.length === 0) {
      this.state.previewButtonEl.disabled = true;
    } else {
      this.state.previewButtonEl.disabled = false;
    }
    
    if (this.state.asciiArtEl && 
        (!AsciiGenerator.state.currentMedia || 
         AsciiGenerator.state.currentFileType !== 'image')) {
      this.state.asciiArtEl.textContent = '';
    }
  },

  startExport() {
    if (this.state.exportInProgress) {
      this.showNotification('Export already in progress', 'info');
      return;
    }
    
    if (AsciiGenerator.state.isPlaying) {
      AsciiGenerator.toggleVideo();
    }
    
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    const fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const format = document.getElementById('exportFormat').value;
    
    const frames = [...AsciiGenerator.state.frames];
    
    if (!frames || frames.length === 0) {
      this.showNotification('No frames available to export. Please process an image or video first', 'error');
      return;
    }
    
    this.state.exportProgressEl.style.display = 'block';
    this.state.progressFillEl.style.width = '0%';
    this.state.progressTextEl.textContent = `Preparing to export ${frames.length} frames...`;
    this.state.exportButtonEl.disabled = true;
    
    this.state.exportInProgress = true;
    
    this.showNotification(`Starting export of ${frames.length} frames at ${fps} FPS`, 'info');
      
    setTimeout(() => this.finalizeExport(fps, format, frames), 100);
  },
  
  finalizeExport(fps, format, frames) {
    this.state.progressFillEl.style.width = '100%';
    
    const adjustedFrames = this.adjustFramesByFps(frames, fps);
    this.state.progressTextEl.textContent = `Exporting ${adjustedFrames.length} frames at ${fps} FPS...`;
    
    setTimeout(() => {
      try {
        const exportData = {
          width: AsciiGenerator.state.frameWidth || 150,
          height: AsciiGenerator.state.frameHeight || 50,
          fps: fps,
          loop: true,
          frames: adjustedFrames,
          created: new Date().toISOString(),
          generatorVersion: '1.0',
          frameCount: adjustedFrames.length
        };
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileType = AsciiGenerator.state.currentFileType || 'ascii';
        
        const exportMode = document.getElementById('exportMode').value;        
        if (exportMode === 'separate') {
          this.exportFramesAsZip(adjustedFrames, fps, format, timestamp, fileType);
        } else {
          let exportContent, mimeType, extension;
          
          if (format === 'json') {
            exportContent = JSON.stringify(exportData);
            mimeType = 'application/json';
            extension = 'json';
          } else {
            exportContent = `export default ${JSON.stringify(exportData)};`;
            mimeType = 'text/javascript';
            extension = 'js';
          }
          
          const filename = `ascii-animation-${fileType}-${timestamp}.${extension}`;
          
          const blob = new Blob([exportContent], { type: mimeType });
          const url = URL.createObjectURL(blob);
          this.downloadFile(url, filename);
          
          setTimeout(() => {
            URL.revokeObjectURL(url);
            this.state.exportProgressEl.style.display = 'none';
            this.state.exportButtonEl.disabled = false;
            this.state.exportInProgress = false;
          }, 300);
        }
      } catch (err) {
        this.showNotification('Export failed: ' + err.message, 'error');
        
        this.state.exportProgressEl.style.display = 'none';
        this.state.exportButtonEl.disabled = false;
        this.state.exportInProgress = false;
      }
    }, 100);
  },

  exportFramesAsZip(frames, fps, format, timestamp, fileType) {
    const zip = new JSZip();
    
    const metadata = {
      width: AsciiGenerator.state.frameWidth || 150,
      height: AsciiGenerator.state.frameHeight || 50,
      fps: fps,
      frameCount: frames.length,
      created: new Date().toISOString(),
      generatorVersion: '1.0'
    };
    
    const metadataContent = JSON.stringify(metadata, null, 2);
    zip.file('metadata.json', metadataContent);
    
    frames.forEach((frame, index) => {
      const paddedIndex = String(index + 1).padStart(frames.length.toString().length, '0');
      
      const frameFilename = `frame_${paddedIndex}.txt`;
      
      zip.file(frameFilename, frame);
    });
    
    zip.generateAsync({ type: 'blob' })
      .then(blob => {
        const zipFilename = `ascii-frames-${fileType}-${timestamp}.zip`;
        
        const url = URL.createObjectURL(blob);
        this.downloadFile(url, zipFilename);
        
        this.showNotification(`Successfully exported ${frames.length} frames to ZIP file`, 'success');
        
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.state.exportProgressEl.style.display = 'none';
          this.state.exportButtonEl.disabled = false;
          this.state.exportInProgress = false;
        }, 300);
      })
      .catch(err => {
        this.showNotification('ZIP creation failed: ' + err.message, 'error');
        
        this.state.exportProgressEl.style.display = 'none';
        this.state.exportButtonEl.disabled = false;
        this.state.exportInProgress = false;
      });
  },

  downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  },

  adjustFramesByFps(frames, targetFps) {
    if (frames.length < 30 || targetFps >= 30) {
      return frames;
    }
    
    const ratio = targetFps / 30;
    const newLength = Math.max(2, Math.ceil(frames.length * ratio));
    
    this.showNotification(`Reducing frames from ${frames.length} to ${newLength} based on ${targetFps} FPS setting`, 'info', 3000);
    
    if (newLength > frames.length * 0.9) {
      return frames;
    }
    
    const adjustedFrames = [];
    for (let i = 0; i < newLength; i++) {
      const originalIndex = Math.min(Math.floor(i * frames.length / newLength), frames.length - 1);
      adjustedFrames.push(frames[originalIndex]);
    }
    
    return adjustedFrames;
  }
};

document.addEventListener('DOMContentLoaded', () => AsciiExporter.init());