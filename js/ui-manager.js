/**
 * ASCIIfy - UI Manager Module
 * Handles UI elements, controls, and user interaction
 */

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
      // Initial zoom setup - only happens on first load
      const initialZoom = 100; // Default fixed zoom value
      zoomInput.value = initialZoom;
      
      const zoomVal = document.getElementById('zoomVal');
      if (zoomVal) {
        zoomVal.textContent = zoomInput.value;
      }
      
      // Apply the zoom to the ASCII art
      this.applyZoom(initialZoom);
    }
    
    // Only listen for window resize, not ASCII width changes
    window.addEventListener('resize', () => {
      // Just reapply the current zoom on resize, don't auto-calculate
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
    // Theme toggle
    const themeSelector = document.getElementById('theme');
    if (themeSelector) {
      themeSelector.addEventListener('change', () => {
        this.core.setTheme(themeSelector.value);
      });
    }
    
    // Control event listeners
    const controls = ['asciiWidth', 'brightness', 'contrast', 'blur', 'invert', 'ignoreWhite', 'zoom'];
    controls.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.updateSettings());
      }
    });
    
    // Edge detection toggle
    const edgeToggle = document.getElementById('enableEdgeDetection');
    if (edgeToggle) {
      edgeToggle.addEventListener('change', () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }
    
    // Character set selection
    const charsetSelect = document.getElementById('charset');
    if (charsetSelect) {
      charsetSelect.addEventListener('change', () => {
        if (this.core.state.currentMedia) {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      });
    }
    
    // Reset and clear buttons
    document.getElementById('reset')?.addEventListener('click', () => this.resetSettings());
    document.getElementById('clearWorkspace')?.addEventListener('click', () => this.core.clearWorkspace());
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
    // Update control value displays
    document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
    document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
    document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
    document.getElementById('blurVal').textContent = document.getElementById('blur').value;
    document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
    
    // Apply zoom setting
    const zoomPercent = parseInt(document.getElementById('zoom').value, 10);
    this.applyZoom(zoomPercent);
    
    // Schedule processing update with a short delay
    clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      if (this.core.state.currentMedia) {
        if (this.core.state.currentFileType === 'image') {
          MediaProcessor.processMedia(this.core.state.currentMedia);
        }
      }
    }, 100);
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
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = `file-type-indicator ${type}`;
    indicator.textContent = type.charAt(0).toUpperCase() + type.slice(1) + (details ? `: ${details}` : '');
    
    // Add to drop zone
    const dropZone = document.querySelector('.unified-drop-zone');
    if (dropZone) {
      dropZone.appendChild(indicator);
    }
  }
};