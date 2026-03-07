# ASCIIfy

ASCIIfy is a small browser app that turns images, GIFs, and videos into ASCII art in real time.

## What It Does

- Upload an image, GIF, or video from your browser
- Tune the output with width, zoom, brightness, contrast, blur, gamma, threshold, dithering, edge detection, invert, and white removal
- Switch between `binary`, `blocks`, `standard`, and `simple` character sets
- Preview video and GIF playback directly in the app
- Export output as:
  - `JSON`
  - `JS module`
  - `JPG`
  - `ZIP` with separate frames
- Import a previously exported JSON animation and play it back

## Run It

There is no build step.

Open `index.html` in a modern browser, or serve the folder with any simple static server if you prefer.

## Basic Use

1. Open the app.
2. Drop a file into the upload area.
3. Adjust the controls until the ASCII output looks right.
4. Export the result if you want to reuse it elsewhere.

For videos, the floating controls handle preview playback. For GIFs, the same area is used for play/pause and looping.

## Project Structure

- `index.html` - app shell
- `js/core.js` - shared app state and cleanup
- `js/media-processor.js` - file loading and ASCII conversion
- `js/capture-engine.js` - video/GIF frame capture and preview
- `js/export-manager.js` - export and JSON import
- `js/ui-manager.js` - UI wiring

## Notes

- Everything runs client-side in the browser.
- The page uses CDN-hosted libraries for ZIP, GIF, and PDF-related browser support.
