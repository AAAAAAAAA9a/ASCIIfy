# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ASCIIfy is a browser-based tool for converting images and videos into ASCII art with real-time preview and export functionality.

## Development Commands
- **Run locally**: Open `index.html` in a browser (no build step required)
- **Testing**: No formal test framework (manual testing via browser)
- **Linting**: No linting commands defined

## Code Style Guidelines
- **Formatting**: 2-space indentation, semicolons required
- **Modules**: Use object literal modules (e.g., `AsciiGenerator`, `AsciiExporter`)
- **State Management**: Store state in `state` property within module objects
- **Error Handling**: Use try/catch and display errors via `showNotification`
- **DOM Interaction**: Use getElementById/querySelector, add event listeners in init methods
- **Naming**: camelCase for variables/functions, UPPER_CASE for constants
- **Comments**: JSDoc for function documentation, code sections with /**/ comments
- **CSS**: Component-specific styles in separate files with descriptive class names