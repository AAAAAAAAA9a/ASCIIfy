const ExportManager = {
  core: null,
  state: {
    isPreviewPlaying: false,
    importedAnimation: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    this.setupEventListeners();
  },
  
  setupEventListeners() {
    document.getElementById('startExport')?.addEventListener('click', () => this.startExportFlow());
    
    // Import JSON handling
    const importBtn = document.getElementById('importJson');
    const importInput = document.getElementById('importJsonInput');
    
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => this.handleJsonImport(e));
    }
    
    document.getElementById('stopAnimationPreview')?.addEventListener('click', () => this.stopPreview());
  },
  

  
  async startExportFlow() {
    const fps = parseInt(document.getElementById('exportFPS').value) || 30;
    const format = document.getElementById('exportFormat').value;
    const mode = document.getElementById('exportMode').value;
    
    const progressContainer = document.getElementById('exportProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }

    try {
        let frames = [];
        
        // 1. PROCESS / CAPTURE FRAMES
        this.core.showMessage('Processing frames...', 'info', 0, true);
        
        const onProgress = (percent) => {
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `${percent}%`;
        };

        if (this.core.state.currentFileType === 'video') {
            frames = await CaptureEngine.processVideo(fps, onProgress);
        } else if (this.core.state.currentFileType === 'gif') {
            frames = await CaptureEngine.processGif(onProgress);
        } else if (this.core.state.currentFileType === 'image') {
            // Single frame export
             const ascii = document.getElementById('ascii-art').textContent;
             frames = [{ timestamp: 0, content: ascii }];
             onProgress(100);
        } else {
            throw new Error("No media loaded to export");
        }
        
        // 2. FINALIZE (Save File)
        this.core.showMessage('Generating file...', 'info', 0, true);
        
        // Add small delay to let UI render text update
        await new Promise(r => setTimeout(r, 50));
        
        this.finalizeExport(fps, format, frames, mode);
        
    } catch (err) {
        console.error('Export Error:', err);
        this.core.showMessage(`Export Failed: ${err.message}`, 'error');
    } finally {
        if (progressContainer) progressContainer.style.display = 'none';
        // Resume playback if it was playing? handled in capture-engine
    }
  },
  
  finalizeExport(targetFps, format, frames, mode) {
    try {
        // Frames are already processed at target FPS (for video) or native FPS (for gif)
        // If GIF native FPS != Target FPS, we might simply accept the native frames 
        // OR resample. For now, let's keep it simple: Export what we captured.
        
        const exportData = {
          metadata: {
            fps: targetFps,
            frameCount: frames.length,
            width: this.core.state.frameWidth,
            height: this.core.state.frameHeight,
            timestamp: new Date().toISOString(),
            generator: "ASCIIfy"
          },
          frames: frames
        };
        
        if (format === 'jpg') {
           if (mode === 'separate') {
             this.createZipExport(frames, exportData, 'jpg');
           } else {
             this.createImageExport(frames, exportData, 'jpg', Date.now());
           }
        } else {
          this.createSingleFileExport(exportData, format);
          this.core.showMessage('Export complete!', 'success');
        }
        
        // Store frames for consistency
        this.core.state.exportFrames = frames;

    } catch (err) {
        throw err; // Re-throw to be caught by startExportFlow
    }
  },
  

  
  createSingleFileExport(data, format) {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `ascii-animation.${format}`;
    
    // Simplify structure for single file? 
    // Ideally we just dump the content array or the full object.
    
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
    
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    
    frames.forEach((frame, index) => {
      const paddedIndex = String(index).padStart(4, '0');
      const frameContent = frame.content;
      
      if (format === 'jpg') {
        // Would need async canvas rendering here.
        // For now, save as text with warning or implement simple sync canvas
        folder.file(`frame_${paddedIndex}.txt`, frameContent); 
      } else {
        folder.file(`frame_${paddedIndex}.${format === 'json' ? 'json' : 'txt'}`, 
          format === 'json' ? JSON.stringify({ content: frameContent, timestamp: frame.timestamp }) : frameContent);
      }
    });
    
    zip.generateAsync({ type: "blob" }).then((content) => {
      const url = URL.createObjectURL(content);
      this.downloadFile(url, "ascii-frames.zip");
      URL.revokeObjectURL(url);
    });
  },
  
  createImageExport(frames, metadata, format, timestamp) {
    const asciiText = frames[frames.length - 1].content; 
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const lines = asciiText.split('\n');
    const fontSize = 12;
    const lineHeight = 12;
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    
    const width = ctx.measureText(lines[0]).width + 40; 
    const height = (lines.length * lineHeight) + 40;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.fillStyle = '#0f0f0f'; 
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = '#e8e8e8'; 
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
  
  async handleJsonImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.frames || !Array.isArray(data.frames)) {
            throw new Error('Invalid JSON: missing "frames" array');
        }
        
        // Load frames into state
        this.core.state.exportFrames = data.frames;
        
        // Update FPS setting if available in metadata
        if (data.metadata && data.metadata.fps) {
            const fpsInput = document.getElementById('exportFPS');
            if (fpsInput) fpsInput.value = data.metadata.fps;
        }
        
        this.core.showMessage(`Imported ${data.frames.length} frames. Playing...`, 'success');
        
        // Show content and controls (treat as video playback)
        UIManager.toggleContentState(true, true);
        
        // Start playback
        this.startPreview();
        
    } catch (err) {
        console.error('Import Error:', err);
        this.core.showMessage(`Import Failed: ${err.message}`, 'error');
    } finally {
        event.target.value = ''; // Reset input
    }
  },

  startPreview() {
    const frames = this.core.state.exportFrames;
    if (!frames || frames.length === 0) return;
    
    this.stopPreview(); // Ensure clean start
    this.state.isPreviewPlaying = true;
    
    const importBtn = document.getElementById('importJson');
    const stopBtn = document.getElementById('stopAnimationPreview');
    if (importBtn) importBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.disabled = false;
    
    const fps = parseInt(document.getElementById('exportFPS').value) || 30;
    const interval = 1000 / fps;
    let frameIndex = 0;
    
    this.state.previewInterval = setInterval(() => {
      if (!this.state.isPreviewPlaying) return; 

      if (frameIndex >= frames.length) {
        const shouldLoop = document.getElementById('loopPlayback')?.checked ?? true;
        
        if (!shouldLoop) {
             this.stopPreview();
             return;
        }
        frameIndex = 0; // Loop
      }
      
      const frameContent = frames[frameIndex].content || frames[frameIndex]; // Handle object or potential raw string
      document.getElementById('ascii-art').textContent = frameContent;
      frameIndex++;
    }, interval);
  },
  
  stopPreview() {
    this.state.isPreviewPlaying = false;
    if (this.state.previewInterval) {
      clearInterval(this.state.previewInterval);
      this.state.previewInterval = null;
    }
    
    const importBtn = document.getElementById('importJson');
    const stopBtn = document.getElementById('stopAnimationPreview');
    if (importBtn) importBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
};