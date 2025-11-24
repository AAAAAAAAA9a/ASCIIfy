const ExportManager = {
  core: null,
  state: {
    previewInterval: null,
    isPreviewPlaying: false,
    importedAnimation: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    this.setupEventListeners();
  },
  
  setupEventListeners() {
    document.getElementById('startExport')?.addEventListener('click', () => this.startExportFlow());
    document.getElementById('previewAnimation')?.addEventListener('click', () => this.startPreview());
    document.getElementById('stopAnimationPreview')?.addEventListener('click', () => this.stopPreview());
    document.getElementById('clearExportFrames')?.addEventListener('click', () => this.clearExportFrames());
    
    // Import handling (if we re-enable it in UI)
    const importFile = document.getElementById('importFile');
    if (importFile) {
      importFile.addEventListener('change', (e) => this.handleImport(e));
    }
  },
  
  clearExportFrames() {
    if (confirm('Clear captured frames?')) {
      this.core.state.exportFrames = [];
      this.core.state.hasExportCapture = false;
      this.updateExportStatus();
      this.core.showMessage('Captured frames cleared.', 'info');
    }
  },
  
  updateExportStatus() {
    const statusEl = document.getElementById('exportStatus');
    const startExportBtn = document.getElementById('startExport');
    const previewBtn = document.getElementById('previewAnimation');
    const frameCount = this.core.state.exportFrames.length;
    
    if (statusEl) {
      const indicator = statusEl.querySelector('.status-indicator');
      const text = statusEl.querySelector('span');
      
      if (frameCount > 0) {
        if (indicator) indicator.className = 'status-indicator success';
        if (text) text.textContent = `${frameCount} frames ready`;
        if (startExportBtn) startExportBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
      } else {
        if (indicator) indicator.className = 'status-indicator empty';
        if (text) text.textContent = 'No capture data';
        if (startExportBtn) startExportBtn.disabled = true;
        if (previewBtn) previewBtn.disabled = true;
      }
    }
  },
  
  startExportFlow() {
    const frames = this.core.state.exportFrames;
    if (!frames || frames.length === 0) {
      this.core.showMessage('No frames to export. Capture video first.', 'error');
      return;
    }
    
    const fps = parseInt(document.getElementById('exportFPS').value) || 30;
    const format = document.getElementById('exportFormat').value;
    const mode = document.getElementById('exportMode').value;
    
    if (mode === 'preview') {
      this.startPreview();
      return;
    }
    
    this.finalizeExport(fps, format, frames, mode);
  },
  
  finalizeExport(targetFps, format, frames, mode) {
    const progressContainer = document.getElementById('exportProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressContainer) progressContainer.style.display = 'block';
    
    this.core.showMessage('Preparing export...', 'info', 0, true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        // 1. Resample frames if needed based on timestamps
        const adjustedFrames = this.resampleFrames(frames, targetFps);
        
        if (adjustedFrames.length === 0) {
          throw new Error('Frame adjustment resulted in 0 frames.');
        }
        
        // 2. Prepare data
        const exportData = {
          metadata: {
            fps: targetFps,
            frameCount: adjustedFrames.length,
            width: this.core.state.frameWidth,
            height: this.core.state.frameHeight,
            timestamp: new Date().toISOString(),
            generator: "ASCIIfy"
          },
          frames: adjustedFrames
        };
        
        // 3. Create file
        if (format === 'jpg') {
           // JPEG export logic (usually for single image, but could be ZIP of JPEGs)
           if (mode === 'separate') {
             this.createZipExport(adjustedFrames, exportData, 'jpg');
           } else {
             // For single file mode with JPG, we can only export the current frame or first frame
             // Or we could create a sprite sheet (out of scope for now)
             // Let's default to exporting the current view as JPG
             this.createImageExport(adjustedFrames, exportData, 'jpg', Date.now(), 'image');
           }
        } else if (mode === 'separate') {
          this.createZipExport(adjustedFrames, exportData, format);
        } else {
          this.createSingleFileExport(exportData, format);
        }
        
        if (progressContainer) progressContainer.style.display = 'none';
        this.core.showMessage('Export complete!', 'success');
        
      } catch (err) {
        console.error('Export failed:', err);
        this.core.showMessage('Export failed: ' + err.message, 'error');
        if (progressContainer) progressContainer.style.display = 'none';
      }
    }, 100);
  },
  
  resampleFrames(frames, targetFps) {
    if (frames.length < 2) return frames;
    
    const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
    const totalTargetFrames = Math.max(1, Math.floor((duration / 1000) * targetFps));
    const interval = duration / totalTargetFrames;
    
    const resampled = [];
    let currentTime = frames[0].timestamp;
    
    // Simple nearest neighbor interpolation based on time
    for (let i = 0; i < totalTargetFrames; i++) {
      const targetTime = frames[0].timestamp + (i * interval);
      
      // Find frame closest to targetTime
      let closestFrame = frames[0];
      let minDiff = Math.abs(targetTime - frames[0].timestamp);
      
      // Optimization: Start search from last found index could be better, but linear scan is fine for <1000 frames
      for (let j = 0; j < frames.length; j++) {
        const diff = Math.abs(targetTime - frames[j].timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frames[j];
        }
      }
      
      resampled.push(closestFrame.content);
    }
    
    return resampled;
  },
  
  createSingleFileExport(data, format) {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `ascii-animation.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else if (format === 'js') {
      content = `export const asciiAnimation = ${JSON.stringify(data, null, 2)};`;
      mimeType = 'text/javascript';
      filename = 'ascii-animation.js';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, filename);
    URL.revokeObjectURL(url);
  },
  
  createZipExport(frames, metadata, format) {
    const zip = new JSZip();
    const folder = zip.folder("frames");
    
    // Add metadata
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    
    frames.forEach((frameContent, index) => {
      const paddedIndex = String(index).padStart(4, '0');
      
      if (format === 'jpg') {
        // Convert ASCII to Image Blob
        // This is async, so we need to handle promises
        // For simplicity in this synchronous flow, we might skip this or handle it differently.
        // But since JSZip supports promises, we can do it.
        // However, drawing text to canvas for 100s of frames might be slow.
        // Let's warn user or implement a simple version.
        
        // For now, let's stick to text formats for ZIP unless requested.
        // If format is jpg, we need to render each frame.
        folder.file(`frame_${paddedIndex}.txt`, frameContent); // Fallback or text
      } else {
        folder.file(`frame_${paddedIndex}.${format === 'json' ? 'json' : 'txt'}`, 
          format === 'json' ? JSON.stringify({ content: frameContent }) : frameContent);
      }
    });
    
    zip.generateAsync({ type: "blob" }).then((content) => {
      const url = URL.createObjectURL(content);
      this.downloadFile(url, "ascii-frames.zip");
      URL.revokeObjectURL(url);
    });
  },
  
  createImageExport(frames, metadata, format, timestamp, fileType) {
    // Exports the current (last) frame as an image
    const asciiText = frames[frames.length - 1]; // Use last frame or current
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Measure text to size canvas
    const lines = asciiText.split('\n');
    const fontSize = 12;
    const lineHeight = 12;
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    
    const width = ctx.measureText(lines[0]).width + 40; // Padding
    const height = (lines.length * lineHeight) + 40;
    
    canvas.width = width;
    canvas.height = height;
    
    // Redraw with correct background
    ctx.fillStyle = '#0f0f0f'; // Dark bg
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = '#e8e8e8'; // Light text
    ctx.textBaseline = 'top';
    
    lines.forEach((line, i) => {
      ctx.fillText(line, 20, 20 + (i * lineHeight));
    });
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.downloadFile(url, `ascii-export-${timestamp}.jpg`);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);
  },
  
  downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  
  startPreview() {
    const frames = this.core.state.exportFrames;
    if (!frames || frames.length === 0) return;
    
    this.state.isPreviewPlaying = true;
    
    const previewBtn = document.getElementById('previewAnimation');
    const stopBtn = document.getElementById('stopAnimationPreview');
    if (previewBtn) previewBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.disabled = false;
    
    const fps = parseInt(document.getElementById('exportFPS').value) || 30;
    const interval = 1000 / fps;
    let frameIndex = 0;
    
    // Resample for preview to match target FPS
    const previewFrames = this.resampleFrames(frames, fps);
    
    this.state.previewInterval = setInterval(() => {
      if (frameIndex >= previewFrames.length) {
        frameIndex = 0; // Loop
      }
      
      document.getElementById('ascii-art').textContent = previewFrames[frameIndex];
      frameIndex++;
    }, interval);
  },
  
  stopPreview() {
    this.state.isPreviewPlaying = false;
    if (this.state.previewInterval) {
      clearInterval(this.state.previewInterval);
      this.state.previewInterval = null;
    }
    
    const previewBtn = document.getElementById('previewAnimation');
    const stopBtn = document.getElementById('stopAnimationPreview');
    if (previewBtn) previewBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
};