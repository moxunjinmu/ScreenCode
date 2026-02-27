# ScreenCode

Screen capture and code extraction tool for isolated network environments.

## Features

- Video capture device enumeration and preview
- Global hotkey screenshot (Ctrl+Shift+S)
- Frame differential deduplication
- One-click code extraction via Claude 3.5 Sonnet API
- System tray integration

## Tech Stack

- **Runtime**: Electron 28
- **Build**: Electron Forge + Vite
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **State Management**: Zustand
- **Image Processing**: Sharp
- **AI**: Claude 3.5 Sonnet API

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package application
npm run package
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+S | Capture current frame |
| Ctrl+Shift+E | Extract code from frames |
| Ctrl+Shift+M | Open main window |

## Project Structure

```
ScreenCode/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts
│   ├── renderer/       # React frontend
│   └── shared/         # Shared types and constants
├── build/              # Build resources
└── ...config files
```

## Configuration

Set your Claude API key in the application settings or via environment variable:

```bash
ANTHROPIC_API_KEY=your-api-key-here
```

## License

MIT
