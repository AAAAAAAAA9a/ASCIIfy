# ASCIIfy

A browser-based tool for converting images and videos into ASCII art with real-time preview and export functionality.

## Features

- **Image & Video Processing**: Convert both images and videos to ASCII art
- **Real-time Controls**: Adjust contrast, brightness, edge detection, and more with immediate visual feedback
- **Export Options**: Save animations as JSON or JavaScript modules
- **Animation Preview**: Preview animations before export with playback controls
- **Dark/Light Mode**: Choose your preferred theme

## Getting Started

### Installation

This is a client-side web application with no server dependencies. To use it:

1. Clone or download this repository
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, etc. recommended)

No build steps or installation of dependencies required.

## How to Use

### Converting an Image

1. Open the application in your browser
2. Click on the upload area labeled "Drop image or video file here or click to browse"
3. Select an image file (.jpg, .png, .gif, etc.)
4. The image will be automatically converted to ASCII art
5. Use the controls in the "Adjustments" section to customize the appearance:
   - Adjust the output width
   - Modify brightness and contrast
   - Add blur effect
   - Apply edge detection
   - Invert colors
   - Choose character set (Binary or Blocks)
   - Adjust zoom level

### Converting a Video

1. Upload a video file (.mp4, .webm, etc.) using the same upload area
2. Use the video playback controls that appear:
   - Click "Play" to start processing the video
   - Use "Restart" to go back to the beginning
   - Toggle "Loop" to enable/disable video looping
3. While the video plays, each frame is converted to ASCII art in real-time
4. Adjust the same parameters as with images to customize the appearance

### Exporting Animations

1. After processing a video (or even a single image), go to the "Export Animation" section
2. Choose your desired frame rate (FPS)
3. Select the output format (JSON or JavaScript Module)
4. Choose between single file export or separate files (ZIP)
5. Click "Export Animation" to generate and download the file

### Importing and Previewing Animations

1. Go to the "Preview Animation" section
2. Drop a previously exported JSON or JavaScript file, or click to browse
3. Click "Preview" to play back the animation
4. The preview will run at the original FPS rate of the export

## Settings Explained

- **Output Width**: Controls how many characters wide the ASCII art will be
- **Brightness/Contrast**: Adjust the luminance of the resulting ASCII art
- **Blur**: Apply a blur effect before conversion (can help reduce noise)
- **Zoom**: Change the display size of the ASCII art without affecting the character count
- **Character Set**:
  - Binary: Uses "0" and "1" characters
  - Blocks: Uses block characters of varying density (█▓▒░ )
- **Edge Detection**: Detect and emphasize edges in the image
- **Invert Colors**: Reverse the brightness values
- **Ignore Pure White**: Replace white pixels with spaces for cleaner output

## Integration with Other Projects

You can integrate the ASCII animation output into other web projects:

```javascript
// Example of using the exported JavaScript module
import asciiAnimation from './path-to-exported-animation.js';

// Display in a pre element
const displayElement = document.getElementById('my-ascii-display');
let currentFrame = 0;

function renderFrame() {
  displayElement.textContent = asciiAnimation.frames[currentFrame];
  currentFrame = (currentFrame + 1) % asciiAnimation.frames.length;
  setTimeout(renderFrame, 1000 / asciiAnimation.fps);
}

renderFrame();
```

## Tips for Best Results

- Use high-contrast images for clearer ASCII output
- For videos, smaller dimensions and shorter clips will process faster
- Edge detection works well for line drawings or cartoons
- The "Blocks" character set often produces more detailed output than "Binary"
- Adjust the width to balance between detail and overall visibility

## License

This project is open source and available for personal and commercial use.
