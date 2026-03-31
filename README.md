# ScreenCode

Screen capture and code extraction tool for isolated network environments.

## Features

### Core Features (MVP)
- **Global Hotkey Screenshot**: `Ctrl+Shift+S` to capture current frame
- **Ring Buffer Storage**: Stores up to 8 frames in memory
- **Image Compression**: Sharp-powered compression (1080p → 768px, JPEG Q=85)
- **One-click Code Extraction**: `Ctrl+Shift+E` with multi-frame structured Prompt → JSON output
- **Multi-Provider AI Routing**: Auto-routing to Anthropic / Zhipu / OpenRouter based on baseUrl
- **System Tray Integration**: Always-on tray with context menu
- **Toast Notifications**: 1.5s auto-dismiss notifications

### Enhanced Features (Phase 2)
- **Multi-turn AI Chat**: Conversational AI with image support (up to 4 images/message)
- **Session Management**: Create/switch/delete sessions with auto-generated titles
- **Fullscreen Preview Mode**: Immersive video preview layout
- **Region Capture Overlay**: Area screenshot tool
- **Frame Queue Interaction**: Click to select/deselect, hover to delete
- **Draggable Chat Panel**: Resizable width, auto-close when <200px
- **Real-time Config Push**: CONFIG_CHANGED IPC event for live updates

### Upcoming Features
- Real video capture device enumeration and streaming
- Pixel-level frame differential algorithm
- System tray status icons (green=connected/red=disconnected/yellow=processing)
- Streaming output (SSE)
- Local VLM routing (compliance mode)
- Audit logging + local sanitization layer

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Electron ^28 | Desktop app framework |
| Build | Electron Forge + Vite | Development & packaging |
| Frontend | React 18 + TypeScript | UI framework |
| State Management | Zustand | 5 stores (capture/frame/app/chat/ui) |
| Styling | TailwindCSS | Atomic CSS |
| Image Processing | Sharp | High-performance compression (65% token savings) |
| AI SDK | @anthropic-ai/sdk + openai | Dual SDK auto-routing |
| Config Storage | electron-store | Persistent config + IPC push |

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build

# Package application
npm run package
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Capture current frame to queue |
| `Ctrl+Shift+E` | Extract code from all frames |
| `Ctrl+Shift+M` | Open main window |

## Project Structure

```
ScreenCode/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point, window creation, shortcuts
│   │   ├── capture/    # Video capture (TODO: real implementation)
│   │   ├── processor/  # Frame processing (ringBuffer, frameDiff, imageCompressor)
│   │   ├── ai/         # AI services (routing, claude, openai, prompt)
│   │   ├── config/     # Configuration management (electron-store)
│   │   └── tray/       # System tray manager
│   ├── preload/        # Security bridge (contextBridge)
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components (Preview, ChatPanel, Settings, etc.)
│   │   └── store/      # Zustand stores (capture, frame, app, chat, ui)
│   └── shared/         # Shared types and constants
├── build/              # Build resources (icons, etc.)
├── docs/               # Documentation (8 directories)
└── ...config files
```

## Configuration

Configure API keys in the application Settings panel:

- **Anthropic**: Official Claude API
- **Zhipu**: GLM-5 via standard endpoint `/api/paas/v4`
- **Zhipu-Anthropic**: GLM via Anthropic-compatible endpoint `/api/anthropic`
- **OpenRouter**: OpenRouter platform

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Hotkey to Toast | < 200ms | ✅ |
| Code Extraction | < 20s | ✅ |
| AI Chat Response | < 8s | ✅ |
| Ring Buffer Capacity | 8 frames | ✅ |
| Image Width | 768px (JPEG Q=85) | ✅ |
| Toast Duration | 1.5s | ✅ |

## Documentation

- [Project Overview](docs/00-intro/overview.md)
- [Product Requirements](docs/00-intro/prd.md)
- [Roadmap](docs/00-intro/roadmap.md)
- [Architecture](docs/01-architecture/overview.md)
- [Changelog](docs/08-history/changelog.md)

## License

MIT
