/**
 * ASCIIfy - Export Manager Module
 * Handles exporting, importing and previewing animations
 */

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
    importedAnimation: null
  },
  
  init(coreModule) {
    this.core = coreModule;
    
    // Get DOM references
    this.state.previewButtonEl = document.getElementById('previewAnimation');
    this.state.stopPreviewButtonEl = document.getElementById('stopPreview');
    this.state.loopPreviewEl = document.getElementById('loopPreview');
    this.state.asciiArtEl = document.getElementById('ascii-art');
    this.state.exportButtonEl = document.getElementById('startExport');
    this.state.exportProgressEl = document.getElementById('exportProgress');
    this.state.progressFillEl = document.getElementById('progressFill');
    this.state.progressTextEl = document.getElementById('progressText');
    
    // Set up event listeners
    this.state.exportButtonEl?.addEventListener('click', this.startExport.bind(this));
    this.state.previewButtonEl?.addEventListener('click', this.startPreview.bind(this));
    this.state.stopPreviewButtonEl?.addEventListener('click', this.stopPreview.bind(this));
    
    // Set up import functionality
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
        
        this.state.previewButtonEl.disabled = false;
        
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
    // Process frames the same way as they would be during export
    // This ensures preview matches export exactly
    const hasMetadata = sourceFrames.length > 0 && typeof sourceFrames[0] === 'object' && sourceFrames[0].content !== undefined;
    
    let processedFrames = [...sourceFrames];
    if (hasMetadata) {
      // Sort frames by timestamp if available to ensure proper sequence
      processedFrames = processedFrames.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Apply frame rate adjustment
    const adjustedFrames = this.adjustFramesByFps(processedFrames, fps);
    
    // Return only valid frames
    return adjustedFrames.filter(frame => typeof frame === 'string' && frame.trim() !== '');
  },
  
  startPreview() {
    if (this.state.isPreviewPlaying) {
      this.stopPreview();
      return;
    }
    
    // Show processing message
    this.core.updateStatusMessage(`Processing frames for preview...`);
    
    let frames = null;
    let fps = 30;
    
    if (this.state.importedAnimation) {
      frames = this.state.importedAnimation.frames;
      fps = this.state.importedAnimation.fps;
    } else if (this.core.state.frames && this.core.state.frames.length > 0) {
      fps = parseInt(document.getElementById('exportFPS').value, 10) || 30;
      
      // Process frames using the same method as export
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
          // Check if looping is enabled
          if (this.state.loopPreviewEl && this.state.loopPreviewEl.checked) {
            // Reset to beginning for looping
            this.state.previewFrame = 0;
            this.core.updateStatusMessage(`Animation preview: looping (${frames.length} frames at ${fps} FPS)`);
          } else {
            // Stop if looping is disabled
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
    
    // Stop any ongoing captures or previews
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
    
    // Use exportFrames for exporting instead of preview frames
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
    // Step 1: Preprocessing - 25%
    this.state.progressFillEl.style.width = '25%';
    this.state.progressTextEl.textContent = `Step 1/4: Preprocessing ${frames.length} frames...`;
    
    // Check if we're working with the new frame format (with metadata)
    const hasMetadata = frames.length > 0 && typeof frames[0] === 'object' && frames[0].content !== undefined;
    
    let processedFrames = frames;
    setTimeout(() => {
      if (hasMetadata) {
        // Sort frames by timestamp if available to ensure proper sequence
        processedFrames = [...frames].sort((a, b) => a.timestamp - b.timestamp);
      }
      
      // Step 2: Adjusting frames - 50%
      this.state.progressFillEl.style.width = '50%';
      this.state.progressTextEl.textContent = `Step 2/4: Adjusting frames for target FPS (${fps})...`;
      
      setTimeout(() => {
        // Adjust frames for the target FPS
        const adjustedFrames = this.adjustFramesByFps(processedFrames, fps);
        
        // Validate frames
        const validFrames = adjustedFrames.filter(frame => typeof frame === 'string' && frame.trim() !== '');
        
        if (validFrames.length === 0) {
          this.core.showMessage('Error: No valid frames to export', 'error');
          this.state.exportProgressEl.style.display = 'none';
          this.state.exportButtonEl.disabled = false;
          this.state.exportInProgress = false;
          return;
        }
        
        if (validFrames.length !== adjustedFrames.length) {
          this.core.showMessage(`Warning: Removed ${adjustedFrames.length - validFrames.length} invalid frames`, 'warning', 5000);
        }
        
        // Step 3: Formatting data - 75%
        this.state.progressFillEl.style.width = '75%';
        this.state.progressTextEl.textContent = `Step 3/4: Formatting ${validFrames.length} frames for export...`;
        
        setTimeout(() => {
          try {
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
            
            // Step 4: Creating output file - 90%
            this.state.progressFillEl.style.width = '90%';
            this.state.progressTextEl.textContent = `Step 4/4: Creating output file...`;
            
            setTimeout(() => {
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
                
                // Complete - 100%
                this.state.progressFillEl.style.width = '100%';
                this.state.progressTextEl.textContent = `Export complete!`;
                
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  setTimeout(() => {
                    this.state.exportProgressEl.style.display = 'none';
                    this.state.exportButtonEl.disabled = false;
                    this.state.exportInProgress = false;
                  }, 500);
                }, 300);
              }
            }, 200);
          } catch (err) {
            console.error('Export error:', err);
            this.core.showMessage('Export failed: ' + err.message, 'error');
            
            this.state.exportProgressEl.style.display = 'none';
            this.state.exportButtonEl.disabled = false;
            this.state.exportInProgress = false;
          }
        }, 200);
      }, 200);
    }, 200);
  },
  
  exportFramesAsZip(frames, fps, format, timestamp, fileType) {
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
    // If no frames are available or invalid targetFps, return original frames
    if (!frames || !frames.length || !targetFps || targetFps <= 0) {
      console.warn('Invalid frames or targetFps provided to adjustFramesByFps');
      return frames;
    }
    
    // Check if frames have timestamp information (from the new frame capture format)
    const hasMetadata = frames.length > 0 && typeof frames[0] === 'object' && frames[0].content !== undefined;
    
    // For small frame counts, return as is
    if (frames.length <= 5) {
      console.log(`Too few frames (${frames.length}) to adjust for FPS`);
      return hasMetadata ? frames.map(frame => frame.content) : frames;
    }
    
    const smoothLoopTransition = (frames) => {
      // Only apply if we have metadata with frameType
      if (!hasMetadata || !frames[0].frameType) return frames;
      
      // Find the first and last frames
      const firstFrames = frames.filter(f => f.frameType === "first");
      const lastFrames = frames.filter(f => f.frameType === "last");
      
      if (firstFrames.length === 0 || lastFrames.length === 0) return frames;
      
      // Get the first and last frames
      const firstFrame = firstFrames[0];
      const lastFrames_sorted = [...lastFrames].sort((a, b) => b.position - a.position);
      const lastFrame = lastFrames_sorted[0]; // Get the frame closest to the end

      // Check if the last frame and first frame are different
      // If they're the same or very similar, remove the duplicate
      const isLastFrameRedundant = frames.length > 10 && lastFrame.position > 0.95;
      
      if (isLastFrameRedundant) {
        // Find the index of the last frame
        const lastFrameIndex = frames.findIndex(f => f === lastFrame);
        
        // Instead of adding a transition frame, remove the last frame if it's too similar to first
        // This prevents the "duplicate first frame" issue at the end of animations
        if (lastFrameIndex !== -1) {
          console.log('Removed redundant last frame for smoother loop transition');
          frames.splice(lastFrameIndex, 1);
        }
      }
      
      return frames;
    };
    
    // Apply smooth transitions if needed
    let processedFrames = hasMetadata ? smoothLoopTransition([...frames]) : frames;
    
    // Calculate the proper number of frames for the target FPS
    // We use the actual duration if available from the timestamps
    let duration = 0;
    
    if (hasMetadata && processedFrames[0].timestamp !== undefined) {
      const firstFrame = processedFrames[0].timestamp;
      const lastFrame = processedFrames[processedFrames.length - 1].timestamp;
      duration = lastFrame - firstFrame;
      
      // If duration is very short or zero (can happen with loop detection),
      // use the video duration from the last frame position instead
      if (duration < 0.1 && processedFrames[processedFrames.length - 1].position) {
        const lastPosition = processedFrames[processedFrames.length - 1].position;
        if (lastPosition > 0) {
          // Estimate video duration based on the last frame position
          duration = processedFrames[processedFrames.length - 1].timestamp / lastPosition;
        }
      }
    } else {
      // Estimate duration based on standard 30fps
      duration = processedFrames.length / 30;
    }
    
    // Calculate the exact number of frames needed for the target FPS
    const newLength = Math.max(2, Math.round(duration * targetFps));
    
    this.state.progressTextEl.textContent = `Adjusting ${frames.length} frames to ${newLength} frames at ${targetFps} FPS...`;
    
    // If minimal change, return original frame content
    if (Math.abs(newLength - processedFrames.length) < 5) {
      console.log('Frame count is close to target, using original frames');
      return hasMetadata ? processedFrames.map(frame => frame.content) : processedFrames;
    }
    
    const adjustedFrames = [];
    
    // Interpolate frames evenly across the duration
    for (let i = 0; i < newLength; i++) {
      // Calculate the exact position in the source frames array
      const position = i / (newLength - 1);
      let index;
      
      if (hasMetadata) {
        // Use timestamp information for more accurate frame selection
        const targetTime = position * duration;
        // Find the frame with the closest timestamp
        index = 0;
        let closestDiff = Number.MAX_VALUE;
        
        for (let j = 0; j < processedFrames.length; j++) {
          const diff = Math.abs(processedFrames[j].timestamp - targetTime);
          if (diff < closestDiff) {
            closestDiff = diff;
            index = j;
          }
        }
      } else {
        // Simple position-based selection if no metadata
        index = Math.min(Math.floor(position * (processedFrames.length - 1)), processedFrames.length - 1);
      }
      
      const frame = hasMetadata ? processedFrames[index].content : processedFrames[index];
      adjustedFrames.push(frame);
    }
    
    console.log(`Frame adjustment complete: ${frames.length} → ${adjustedFrames.length}`);
    return adjustedFrames;
  }
};