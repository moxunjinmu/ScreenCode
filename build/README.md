# Build Resources

This directory contains build resources for ScreenCode.

## Required Files

For Windows builds:
- `icon.ico` - Application icon (256x256 or larger)

For macOS builds:
- `icon.icns` - Application icon

For Linux builds:
- `icon.png` - Application icon (512x512)

## Creating Icons

You can use tools like:
- [electron-icon-builder](https://github.com/nickolay/versionator)
- [png-to-ico](https://github.com/steambap/png-to-ico)
- ImageMagick: `convert icon.png -resize 256x256 icon.ico`

## Placeholder

Currently using placeholder icons. Replace with actual app icons before production build.
