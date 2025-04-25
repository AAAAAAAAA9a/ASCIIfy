const ExportManager = {
  core: null,
  state: {
    isPreviewPlaying: false,
    previewInterval: null,
    previewFrame: 0,
    previewButtonEl: null,
    stopPreviewButtonEl: null,
    loopPreviewEl: null,
    asciiArtEl: null,
    exportInProgress: false,
    importedAnimation: null,
    previewImportedButtonEl: null,
    stopImportedPreviewButtonEl: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    
    this.state.previewButtonEl = document.getElementById('previewAnimation');
    this.state.stopPreviewButtonEl = document.getElementById('stopPreview');
    this.state.loopPreviewEl = document.getElementById('loopPreview');
    this.state.asciiArtEl = document.getElementById('ascii-art');
    this.state.exportButtonEl = document.getElementById('startExport');
    this.state.exportProgressEl = document.getElementById('exportProgress');
    this.state.progressFillEl = document.getElementById('progressFill');
    this.state.progressTextEl = document.getElementById('progressText');

    // Add support for imported animation preview buttons
    this.state.previewImportedButtonEl = document.getElementById('previewImportedAnimation');
    this.state.stopImportedPreviewButtonEl = document.getElementById('stopImportedPreview');

    this.state.exportButtonEl?.addEventListener('click', this.startExport.bind(this));
    this.state.previewButtonEl?.addEventListener('click', this.startPreview.bind(this));
    this.state.stopPreviewButtonEl?.addEventListener('click', this.stopPreview.bind(this));

    // Add event listeners for imported animation preview
    this.state.previewImportedButtonEl?.addEventListener('click', this.startImportedPreview.bind(this));
    this.state.stopImportedPreviewButtonEl?.addEventListener('click', this.stopImportedPreview.bind(this));

    this.setupImport();
  },
  
  setupImport() {
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
  
  handleImportAnimation(e) {
    const file = e.target.files[0];
    if (file) {
      this.handleImportFile(file);
    }
  },
  
  handleImportFile(file) {
    this.clearPreview();
    
    if (!file.name.endsWith('.json') && !file.name.endsWith('.js')) {
      this.core.showMessage('Please select a valid JSON or JavaScript animation file', 'error');
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
        // Enable imported preview button
        if (this.state.previewImportedButtonEl) this.state.previewImportedButtonEl.disabled = false;
        if (this.state.stopImportedPreviewButtonEl) this.state.stopImportedPreviewButtonEl.disabled = false;
        document.getElementById('exportFPS').value = animationData.fps;
        this.core.showMessage(`Animation loaded successfully: ${animationData.frames.length} frames at ${animationData.fps} FPS`, 'success');
      } catch (err) {
        this.core.showMessage('Error loading animation file: ' + err.message, 'error');
      }
    };
    
    reader.onerror = () => {
      this.core.showMessage('Error reading the file', 'error');
    };
    
    reader.readAsText(file);
  },
  
  previewProcessedFrames(sourceFrames, fps) {
    if (!sourceFrames || sourceFrames.length === 0) {
      return [];
    }
    
    const hasMetadata = typeof sourceFrames[0] === 'object' && sourceFrames[0].content !== undefined;
    
    if (hasMetadata) {
      const sortedFrames = [...sourceFrames].sort((a, b) => {
        const timeDiff = a.timestamp - b.timestamp;
        return timeDiff === 0 ? 0 : timeDiff;
      });
      
      const adjustedFrames = this.adjustFramesByFps(sortedFrames, fps);
      
      return adjustedFrames.filter(frame => {
        return typeof frame === 'string' && frame.length > 0;
      });
    } else {
      const adjustedFrames = this.adjustFramesByFps([...sourceFrames], fps);
      
      return adjustedFrames.filter(frame => typeof frame === 'string' && frame.length > 0);
    }
  },
  
  startPreview() {
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
      return;
    }
    
    this.core.updateStatusMessage(`Processing frames for preview...`);
    
    let frames = null;
    let fps = 30;
    
    if (this.state.importedAnimation) {
      frames = this.state.importedAnimation.frames;
      fps = this.state.importedAnimation.fps;
    } else if (this.core.state.frames && this.core.state.frames.length > 0) {
      fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
      
      frames = this.previewProcessedFrames(this.core.state.frames, fps);
    }
    
    if (!frames || frames.length === 0) {
      this.core.showMessage('No animation to preview. Please import an animation file or generate frames first.', 'error');
      return;
    }
    
    const frameInterval = 1000 / fps;
    
    this.state.asciiArtEl.textContent = '';
    
    this.state.previewButtonEl.disabled = true;
    this.state.stopPreviewButtonEl.disabled = false;
    this.state.stopPreviewButtonEl.style.display = 'inline-block';
    
    this.state.isPreviewPlaying = true;
    this.state.previewFrame = 0;
    
    if (this.core.state.isPlaying && CaptureEngine) {
      CaptureEngine.stopCapture();
    }
    
    if (this.state.previewInterval) {
      cancelAnimationFrame(this.state.previewInterval);
    }
    
    const loopMode = this.state.loopPreviewEl && this.state.loopPreviewEl.checked ? "looping" : "single play";
    this.core.showMessage(`Starting preview: ${frames.length} frames at ${fps} FPS (${loopMode})`, 'info', 2000);
    this.core.updateStatusMessage(`Animation preview: ${loopMode} (${frames.length} frames at ${fps} FPS)`);
    
    let lastFrameTime = 0;
    
    const animate = (timestamp) => {
      if (!this.state.isPreviewPlaying) return;
      
      if (!lastFrameTime || timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
        this.state.asciiArtEl.textContent = frames[this.state.previewFrame];
        
        this.state.previewFrame = this.state.previewFrame + 1;
        
        if (this.state.previewFrame >= frames.length) {
          if (this.state.loopPreviewEl && this.state.loopPreviewEl.checked) {
            this.state.previewFrame = 0;
            this.core.updateStatusMessage(`Animation preview: looping (${frames.length} frames at ${fps} FPS)`);
          } else {
            this.stopPreview();
            this.core.updateStatusMessage('Preview complete - click Preview to replay');
            return;
          }
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
    
    if (this.core.state.currentMedia) {
      MediaProcessor.processMedia(this.core.state.currentMedia);
    }
  },
  
  clearPreview() {
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    this.state.importedAnimation = null;
    
    if (!this.core.state.frames || this.core.state.frames.length === 0) {
      this.state.previewButtonEl.disabled = true;
    } else {
      this.state.previewButtonEl.disabled = false;
    }
    
    if (this.state.asciiArtEl && 
        (!this.core.state.currentMedia || 
         this.core.state.currentFileType !== 'image')) {
      this.state.asciiArtEl.textContent = '';
      this.core.updateStatusMessage('Preview cleared.');
    }
  },
  
  startExport() {
    if (this.state.exportInProgress) {
      this.core.showMessage('Export already in progress', 'info');
      return;
    }
    
    if (this.core.state.isPlaying && CaptureEngine) {
      CaptureEngine.stopCapture();
    }
    
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
    }
    
    if (CaptureEngine && CaptureEngine.state.isPreviewPlaying) {
      CaptureEngine.stopPreview();
    }
    
    const fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const format = document.getElementById('exportFormat').value;
    
    const frames = [...this.core.state.exportFrames];
    
    if (!frames || frames.length === 0) {
      this.core.showMessage('No frames available to export. Please capture an animation first.', 'error');
      return;
    }
    
    this.state.exportProgressEl.style.display = 'block';
    this.state.progressFillEl.style.width = '0%';
    this.state.progressTextEl.textContent = `Preparing to export ${frames.length} frames...`;
    this.state.exportButtonEl.disabled = true;
    
    this.state.exportInProgress = true;
    
    this.core.showMessage(`Starting export of ${frames.length} frames at ${fps} FPS`, 'info');
      
    setTimeout(() => this.finalizeExport(fps, format, frames), 100);
  },
  
  finalizeExport(fps, format, frames) {
    if (!frames || frames.length === 0) {
      this.core.showMessage('Error: No frames to export', 'error');
      this.state.exportProgressEl.style.display = 'none';
      this.state.exportButtonEl.disabled = false;
      this.state.exportInProgress = false;
      return;
    }
    
    this.state.progressFillEl.style.width = '25%';
    this.state.progressTextEl.textContent = `Step 1/4: Preprocessing ${frames.length} frames...`;
    
    const hasMetadata = typeof frames[0] === 'object' && frames[0].content !== undefined;
    
    const useWebWorker = typeof Worker !== 'undefined' && frames.length > 500;
    let processedFrames = frames;
    
    const preprocessFrames = () => {
      return new Promise((resolve) => {
        if (hasMetadata) {
          processedFrames = [...frames].sort((a, b) => {
            const timeDiff = a.timestamp - b.timestamp;
            return timeDiff === 0 ? 0 : timeDiff;
          });
        }
        
        this.state.progressFillEl.style.width = '50%';
        this.state.progressTextEl.textContent = `Step 2/4: Adjusting frames for target FPS (${fps})...`;
        
        setTimeout(() => resolve(), 50);
      });
    };
    
    const adjustFrameRates = () => {
      return new Promise((resolve) => {
        const processInChunks = (processedFrames.length > 1000);
        
        if (processInChunks) {
          const chunkSize = 500;
          let adjustedFrames = [];
          
          const processChunk = (startIdx) => {
            const endIdx = Math.min(startIdx + chunkSize, processedFrames.length);
            const chunk = processedFrames.slice(startIdx, endIdx);
            
            const processedChunk = this.adjustFramesByFps(chunk, fps);
            
            const validChunk = processedChunk.filter(frame => typeof frame === 'string' && frame.trim() !== '');
            adjustedFrames = adjustedFrames.concat(validChunk);
            
            const progressPercent = 50 + Math.round((endIdx / processedFrames.length) * 25);
            this.state.progressFillEl.style.width = `${progressPercent}%`;
            this.state.progressTextEl.textContent = `Step 2/4: Adjusting frames for target FPS (${fps}) - processed ${endIdx}/${processedFrames.length}`;
            
            if (endIdx < processedFrames.length) {
              setTimeout(() => processChunk(endIdx), 0);
            } else {
              resolve(adjustedFrames);
            }
          };
          
          processChunk(0);
        } else {
          const adjustedFrames = this.adjustFramesByFps(processedFrames, fps);
          
          const validFrames = adjustedFrames.filter(frame => typeof frame === 'string' && frame.trim() !== '');
          
          resolve(validFrames);
        }
      });
    };
    
    const prepareExportData = (validFrames) => {
      return new Promise((resolve, reject) => {
        try {
          if (validFrames.length === 0) {
            throw new Error('No valid frames to export');
          }
          
          this.state.progressFillEl.style.width = '75%';
          this.state.progressTextEl.textContent = `Step 3/4: Formatting ${validFrames.length} frames for export...`;
          
          const exportData = {
            width: this.core.state.frameWidth || 150,
            height: this.core.state.frameHeight || 50,
            fps: fps,
            loop: true,
            frames: validFrames,
            created: new Date().toISOString(),
            generatorVersion: '1.2',
            frameCount: validFrames.length,
            duration: validFrames.length / fps
          };
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileType = this.core.state.currentFileType || 'ascii';
          
          setTimeout(() => resolve({ exportData, validFrames, timestamp, fileType }), 50);
        } catch (err) {
          reject(err);
        }
      });
    };
    
    const createExportFile = ({ exportData, validFrames, timestamp, fileType }) => {
      this.state.progressFillEl.style.width = '90%';
      this.state.progressTextEl.textContent = `Step 4/4: Creating output file...`;
      
      const exportMode = document.getElementById('exportMode').value;
      
      if (exportMode === 'separate') {
        this.exportFramesAsZip(validFrames, fps, format, timestamp, fileType);
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
        
        this.core.showMessage(`Successfully exported ${validFrames.length} frames at ${fps} FPS`, 'success');
        
        this.state.progressFillEl.style.width = '100%';
        this.state.progressTextEl.textContent = `Export complete!`;
        
        setTimeout(() => {
          URL.revokeObjectURL(url);
          setTimeout(() => {
            this.state.exportProgressEl.style.display = 'none';
            this.state.exportButtonEl.disabled = false;
            this.state.exportInProgress = false;
            
            exportContent = null;
            
            if (window.gc) window.gc();
          }, 500);
        }, 300);
      }
    };
    
    preprocessFrames()
      .then(adjustFrameRates)
      .then(prepareExportData)
      .then(createExportFile)
      .catch(err => {
        console.error('Export error:', err);
        this.core.showMessage('Export failed: ' + err.message, 'error');
        
        this.state.exportProgressEl.style.display = 'none';
        this.state.exportButtonEl.disabled = false;
        this.state.exportInProgress = false;
      });
  },
  
  exportFramesAsZip(frames, fps, format, timestamp, fileType) {
    if (typeof JSZip === 'undefined') {
      this.core.showMessage('JSZip library not loaded. ZIP export failed.', 'error');
      this.state.exportProgressEl.style.display = 'none';
      this.state.exportButtonEl.disabled = false;
      this.state.exportInProgress = false;
      return;
    }
    
    const zip = new JSZip();
    
    const metadata = {
      width: this.core.state.frameWidth || 150,
      height: this.core.state.frameHeight || 50,
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
        
        this.core.showMessage(`Successfully exported ${frames.length} frames to ZIP file`, 'success');
        
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.state.exportProgressEl.style.display = 'none';
          this.state.exportButtonEl.disabled = false;
          this.state.exportInProgress = false;
        }, 300);
      })
      .catch(err => {
        this.core.showMessage('ZIP creation failed: ' + err.message, 'error');
        
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
    if (!frames || !frames.length || !targetFps || targetFps <= 0) {
      console.warn('Invalid frames or targetFps provided to adjustFramesByFps');
      return frames;
    }
    
    const hasMetadata = frames.length > 0 && typeof frames[0] === 'object' && frames[0].content !== undefined;
    
    if (frames.length <= 5) {
      console.log(`Too few frames (${frames.length}) to adjust for FPS`);
      return hasMetadata ? frames.map(frame => frame.content) : frames;
    }
    
    const smoothLoopTransition = (frames) => {
      if (!hasMetadata || !frames[0].frameType) return frames;
      
      const firstFrames = frames.filter(f => f.frameType === "first");
      const lastFrames = frames.filter(f => f.frameType === "last");
      
      if (firstFrames.length === 0 || lastFrames.length === 0) return frames;
      
      const firstFrame = firstFrames[0];
      const lastFrames_sorted = [...lastFrames].sort((a, b) => b.position - a.position);
      const lastFrame = lastFrames_sorted[0];
      
      const isLastFrameRedundant = frames.length > 10 && lastFrame.position > 0.95;
      
      if (isLastFrameRedundant) {
        const lastFrameIndex = frames.findIndex(f => f === lastFrame);
        
        if (lastFrameIndex !== -1) {
          console.log('Removed redundant last frame for smoother loop transition');
          frames.splice(lastFrameIndex, 1);
        }
      }
      
      return frames;
    };
    
    let processedFrames = hasMetadata ? smoothLoopTransition([...frames]) : frames;
    
    let duration = 0;
    
    if (hasMetadata && processedFrames[0].timestamp !== undefined) {
      const firstFrame = processedFrames[0].timestamp;
      const lastFrame = processedFrames[processedFrames.length - 1].timestamp;
      duration = lastFrame - firstFrame;
      
      if (duration < 0.1 && processedFrames[processedFrames.length - 1].position) {
        const lastPosition = processedFrames[processedFrames.length - 1].position;
        if (lastPosition > 0) {
          duration = processedFrames[processedFrames.length - 1].timestamp / lastPosition;
        }
      }
    } else {
      duration = processedFrames.length / 30;
    }
    
    const newLength = Math.max(2, Math.round(duration * targetFps));
    
    this.state.progressTextEl.textContent = `Adjusting ${frames.length} frames to ${newLength} frames at ${targetFps} FPS...`;
    
    if (Math.abs(newLength - processedFrames.length) < 5) {
      console.log('Frame count is close to target, using original frames');
      return hasMetadata ? processedFrames.map(frame => frame.content) : processedFrames;
    }
    
    let adjustedFrames = new Array(newLength);
    
    let timestampLookup;
    if (hasMetadata) {
      timestampLookup = processedFrames.map(frame => frame.timestamp);
    }
    
    const findClosestFrameIndex = (targetTime) => {
      let low = 0;
      let high = timestampLookup.length - 1;
      
      if (targetTime <= timestampLookup[low]) return low;
      if (targetTime >= timestampLookup[high]) return high;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        
        if (targetTime === timestampLookup[mid]) return mid;
        
        if (targetTime < timestampLookup[mid]) {
          if (mid > 0 && targetTime > timestampLookup[mid - 1]) {
            return (timestampLookup[mid] - targetTime) < (targetTime - timestampLookup[mid - 1]) ? 
                   mid : mid - 1;
          }
          high = mid - 1;
        } else {
          if (mid < timestampLookup.length - 1 && targetTime < timestampLookup[mid + 1]) {
            return (targetTime - timestampLookup[mid]) < (timestampLookup[mid + 1] - targetTime) ? 
                   mid : mid + 1;
          }
          low = mid + 1;
        }
      }
      
      return low;
    };
    
    for (let i = 0; i < newLength; i++) {
      const position = i / (newLength - 1);
      let index;
      
      if (hasMetadata) {
        const targetTime = position * duration;
        index = findClosestFrameIndex(targetTime);
      } else {
        index = Math.min(Math.floor(position * (processedFrames.length - 1)), processedFrames.length - 1);
      }
      
      adjustedFrames[i] = hasMetadata ? processedFrames[index].content : processedFrames[index];
    }
    
    console.log(`Frame adjustment complete: ${frames.length} → ${adjustedFrames.length}`);
    return adjustedFrames;
  },

  // Add logic for previewing imported animation
  startImportedPreview() {
    if (!this.state.importedAnimation) {
      this.core.showMessage('No imported animation loaded.', 'error');
      return;
    }
    if (this.state.isPreviewPlaying) {
      this.stopImportedPreview();
      return;
    }
    const frames = this.state.importedAnimation.frames;
    const fps = this.state.importedAnimation.fps;
    if (!frames || frames.length === 0) {
      this.core.showMessage('No frames in imported animation.', 'error');
      return;
    }
    const frameInterval = 1000 / fps;
    this.state.asciiArtEl.textContent = '';
    this.state.previewImportedButtonEl.disabled = true;
    this.state.stopImportedPreviewButtonEl.disabled = false;
    this.state.stopImportedPreviewButtonEl.style.display = 'inline-block';
    this.state.isPreviewPlaying = true;
    this.state.previewFrame = 0;
    let lastFrameTime = 0;
    const animate = (timestamp) => {
      if (!this.state.isPreviewPlaying) return;
      if (!lastFrameTime || timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
        this.state.asciiArtEl.textContent = frames[this.state.previewFrame];
        this.state.previewFrame = this.state.previewFrame + 1;
        if (this.state.previewFrame >= frames.length) {
          this.stopImportedPreview();
          this.core.updateStatusMessage('Imported preview complete - click Preview to replay');
          return;
        }
      }
      this.state.previewInterval = requestAnimationFrame(animate);
    };
    this.state.previewInterval = requestAnimationFrame(animate);
    this.core.showMessage(`Previewing imported animation: ${frames.length} frames at ${fps} FPS`, 'info', 2000);
  },

  stopImportedPreview() {
    if (this.state.previewInterval) {
      cancelAnimationFrame(this.state.previewInterval);
      this.state.previewInterval = null;
    }
    this.state.isPreviewPlaying = false;
    if (this.state.previewImportedButtonEl) this.state.previewImportedButtonEl.disabled = false;
    if (this.state.stopImportedPreviewButtonEl) this.state.stopImportedPreviewButtonEl.disabled = true;
    if (this.state.stopImportedPreviewButtonEl) this.state.stopImportedPreviewButtonEl.style.display = 'none';
    if (this.core.state.currentMedia) {
      MediaProcessor.processMedia(this.core.state.currentMedia);
    }
  }
};