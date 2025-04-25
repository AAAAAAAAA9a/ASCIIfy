const UIManager = {
  core: null,
  
  init(coreModule) {
    this.core = coreModule;
    this.setupAutomaticZoom();
    this.setupFileProcessing();
    this.setupControls();
    this.setupCollapsibleSections();
  },
  
  setupAutomaticZoom() {
    const screenWidth = window.innerWidth;
    const mainContent = document.querySelector('.main-content');
    const availableWidth = mainContent ? mainContent.offsetWidth : (screenWidth * 0.6);
    
    const zoomInput = document.getElementById('zoom');
    if (zoomInput) {
      const initialZoom = 100;
      zoomInput.value = initialZoom;
      
      const zoomVal = document.getElementById('zoomVal');
      if (zoomVal) {
        zoomVal.textContent = zoomInput.value;
      }
      
      this.applyZoom(initialZoom);
    }
    
    window.addEventListener('resize', () => {
      const currentZoom = parseInt(document.getElementById('zoom').value, 10);
      this.applyZoom(currentZoom);
    });
  },
  
  applyZoom(zoomPercent) {
    const asciiArt = document.getElementById('ascii-art');
    if (asciiArt) {
      const baseFontSize = 16;
      const newFontSize = (baseFontSize * zoomPercent) / 100;
      asciiArt.style.fontSize = newFontSize + "px";
      asciiArt.style.lineHeight = newFontSize + "px";
    }
  },
  
  setupFileProcessing() {
    const fileInput = document.getElementById('unifiedInput');
    const dropZone = document.querySelector('.unified-drop-zone');
    
    if (fileInput) {
      fileInput.style.position = 'absolute';
      fileInput.style.left = '-9999px';
      
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          MediaProcessor.processFile(file);
        }
      });
    }
    
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => {
        fileInput.click();
      });
      
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
          MediaProcessor.processFile(file);
        } else {
          this.core.showMessage('Please drop a valid image or video file.', 'error');
        }
      });
    }
  },
  
  setupControls() {
    const themeSelector = document.getElementById('theme');
    if (themeSelector) {
      themeSelector.addEventListener('change', () => {
        this.core.setTheme(themeSelector.value);
      });
    }
    
    const controls = ['asciiWidth', 'brightness', 'contrast', 'blur', 'invert', 'ignoreWhite', 'zoom'];
    controls.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.updateSettings());
      }
    });
    
    const edgeToggle = document.getElementById('enableEdgeDetection');
    if (edgeToggle) {
      edgeToggle.addEventListener('change', () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }
    
    const charsetSelect = document.getElementById('charset');
    if (charsetSelect) {
      charsetSelect.addEventListener('change', () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }
    
    
    document.getElementById('reset')?.addEventListener('click', () => this.resetSettings());
    document.getElementById('clearWorkspace')?.addEventListener('click', () => this.core.clearWorkspace());
    
    const previewImportedBtn = document.getElementById('previewImportedAnimation');
    const stopImportedPreviewBtn = document.getElementById('stopImportedPreview');
    if (previewImportedBtn) previewImportedBtn.disabled = !ExportManager?.state?.importedAnimation;
    if (stopImportedPreviewBtn) stopImportedPreviewBtn.disabled = true;
  },
  
  setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    
    collapsibles.forEach(collapsible => {
      const content = collapsible.nextElementSibling;
      if (collapsible.classList.contains('active')) {
        content.classList.add('show');
      }
      
      collapsible.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        
        if (content.classList.contains('show')) {
          content.classList.remove('show');
        } else {
          content.classList.add('show');
        }
      });
    });
  },
  
  updateSettings() {
    document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
    document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
    document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
    document.getElementById('blurVal').textContent = document.getElementById('blur').value;
    document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
    
    const zoomPercent = parseInt(document.getElementById('zoom').value, 10);
    this.applyZoom(zoomPercent);
    
    this.updateSettingsImpactIndicators();
    
    clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      if (this.core.state.currentMedia) {
        if (this.core.state.currentFileType === 'image') {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      }
    }, 100);
  },
  
  updateSettingsImpactIndicators() {
    const settings = this.getSettings();
    
    const brightnessVal = document.getElementById('brightnessVal');
    if (brightnessVal) {
      if (Math.abs(settings.brightness) > 50) {
        brightnessVal.className = 'value-label high-impact';
      } else if (Math.abs(settings.brightness) > 20) {
        brightnessVal.className = 'value-label medium-impact';
      } else {
        brightnessVal.className = 'value-label';
      }
    }
    
    const contrastVal = document.getElementById('contrastVal');
    if (contrastVal) {
      if (Math.abs(settings.contrast) > 50) {
        contrastVal.className = 'value-label high-impact';
      } else if (Math.abs(settings.contrast) > 20) {
        contrastVal.className = 'value-label medium-impact';
      } else {
        contrastVal.className = 'value-label';
      }
    }
    
    const asciiWidthVal = document.getElementById('asciiWidthVal');
    if (asciiWidthVal) {
      if (settings.width > 300) {
        asciiWidthVal.title = 'High detail, larger file size';
        asciiWidthVal.className = 'value-label high-detail';
      } else if (settings.width < 80) {
        asciiWidthVal.title = 'Low detail, smaller file size';
        asciiWidthVal.className = 'value-label low-detail';
      } else {
        asciiWidthVal.title = 'Moderate detail';
        asciiWidthVal.className = 'value-label medium-detail';
      }
    }
    
    const exportFPS = parseInt(document.getElementById('exportFPS').value, 10) || 30;
    const fpsInput = document.getElementById('exportFPS');
    if (fpsInput) {
      if (exportFPS > 40) {
        fpsInput.title = 'High FPS - smoother animation but larger file size';
        fpsInput.className = 'high-fps';
      } else if (exportFPS < 15) {
        fpsInput.title = 'Low FPS - smaller file size but choppier animation';
        fpsInput.className = 'low-fps';
      } else {
        fpsInput.title = 'Standard FPS';
        fpsInput.className = '';
      }
    }
  },
  
  resetSettings() {
    document.getElementById('asciiWidth').value = 150;
    document.getElementById('brightness').value = 0;
    document.getElementById('contrast').value = 0;
    document.getElementById('blur').value = 0;
    document.getElementById('invert').checked = false;
    document.getElementById('ignoreWhite').checked = true;
    document.getElementById('zoom').value = 100;
    document.getElementById('charset').value = 'binary';
    
    const edgeToggle = document.getElementById('enableEdgeDetection');
    if (edgeToggle) edgeToggle.checked = false;
    
    this.updateSettings();
  },
  
  getSettings() {
    return {
      charset: document.getElementById('charset')?.value || 'binary',
      width: parseInt(document.getElementById('asciiWidth').value, 10),
      brightness: parseFloat(document.getElementById('brightness').value),
      contrast: parseFloat(document.getElementById('contrast').value),
      blur: parseFloat(document.getElementById('blur').value),
      invert: document.getElementById('invert')?.checked || false,
      ignoreWhite: document.getElementById('ignoreWhite')?.checked || true,
      edgeDetection: document.getElementById('enableEdgeDetection')?.checked || false
    };
  },
  
  updateFileTypeIndicator(type, details) {
    const existingIndicator = document.querySelector('.file-type-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.className = `file-type-indicator ${type}`;
    indicator.textContent = type.charAt(0).toUpperCase() + type.slice(1) + (details ? `: ${details}` : '');
    
    const dropZone = document.querySelector('.unified-drop-zone');
    if (dropZone) {
      dropZone.appendChild(indicator);
    }
  }
};