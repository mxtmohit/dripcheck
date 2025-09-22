# DripCheck Extension Assets

## Required Logo Files

Place your logo files in this `assets` folder with the following names:

### For the Popup Header:
- `logo.png` - Your main logo (32x32px recommended, will be auto-resized)

### For Extension Icons:
- `icon-16.png` - 16x16px (browser toolbar)
- `icon-32.png` - 32x32px (browser toolbar, context menus)
- `icon-48.png` - 48x48px (extension management page)
- `icon-128.png` - 128x128px (Chrome Web Store, extension details)

## Logo Guidelines

### Popup Logo (`logo.png`):
- **Size**: 32x32px (or larger, will be scaled down)
- **Format**: PNG with transparency
- **Style**: Simple, recognizable at small sizes
- **Background**: Transparent or matches your brand colors

### Extension Icons:
- **Sizes**: Exact sizes as specified above
- **Format**: PNG with transparency
- **Style**: Should work well at very small sizes (16px)
- **Consistency**: All sizes should look similar, just scaled

## Quick Setup

1. **Create your logo** in your preferred design tool
2. **Export as PNG** with transparency
3. **Resize** to the required dimensions
4. **Save** with the exact filenames listed above
5. **Place** all files in this `assets` folder

## Tips

- Use a simple, bold design that's readable at 16px
- Avoid fine details that disappear at small sizes
- Consider using your brand colors
- Test how it looks in the browser toolbar
- Make sure it stands out against different browser themes

## File Structure After Setup:
```
dripcheck-frontend/
├── assets/
│   ├── logo.png          ← Your main logo
│   ├── icon-16.png       ← 16x16 extension icon
│   ├── icon-32.png       ← 32x32 extension icon
│   ├── icon-48.png       ← 48x48 extension icon
│   ├── icon-128.png      ← 128x128 extension icon
│   └── README.md         ← This file
├── popup.html
├── popup.js
├── background.js
├── content.js
└── manifest.json
```
