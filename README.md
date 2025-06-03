# HumOS Canvas - Your Personal AI Integration Framework

**Your Personal Interface for Enhanced AI Collaboration**

HumOS Canvas is a modern infinite canvas application with AI-powered idea generation, built with Vite and supporting multiple AI providers. 

## Features

- **Infinite Canvas**: Pan, zoom, and navigate a limitless workspace
- **Node Management**: Create, edit, resize, and delete nodes
- **Connections**: Link nodes with visual connections (Ctrl/Cmd + click)
- **AI Integration**: Generate connected ideas using AI models
- **Multi-Provider Support**: Works with OpenAI, OpenRouter, local models, and any OpenAI-compatible API
- **Undo/Redo**: Full history management
- **Auto-save**: Local storage persistence
- **Export**: JSON export functionality

## AI Provider Configuration

The application supports multiple AI providers through a flexible configuration system:

### Supported Providers

- **OpenAI**: `https://api.openai.com/v1`
- **OpenRouter**: `https://openrouter.ai/api/v1` (access to hundreds of models)
- **Local Models**: `http://localhost:1234/v1` (e.g., LM Studio, Ollama with OpenAI compatibility)
- **Custom APIs**: Any OpenAI-compatible endpoint

### Setup

1. Click the "🔑 Configure AI API" button
2. Enter your base URL and API key
3. Click "Save Configuration"

### OpenRouter Setup

For OpenRouter (recommended for variety and cost-effectiveness):

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Get your API key from the dashboard
3. Use base URL: `https://openrouter.ai/api/v1`
4. Choose from hundreds of available models

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

- `main.js` - Main application logic with ES6 modules
- `index.html` - HTML entry point
- `style.css` - Styling and UI components
- `package.json` - Dependencies and scripts

## Usage

### Basic Operations

- **Create Node**: Click "Add Node" or double-click empty space
- **Edit Node**: Double-click a node to edit text
- **Select Node**: Click a node to select it
- **Move Node**: Drag a selected node
- **Resize Node**: Drag the resize handles on selected nodes
- **Connect Nodes**: Ctrl/Cmd + click and drag from one node to another
- **Delete Node**: Select a node and press Delete/Backspace

### Canvas Navigation

- **Pan**: Drag empty space or use middle mouse button
- **Zoom**: Mouse wheel or zoom buttons
- **Reset View**: Click the home button (⌂)

### AI Features

1. Select a node containing your central idea
2. Click "🤖 Generate AI Ideas"
3. The AI will generate 3-5 related concepts
4. New nodes will be created and automatically connected

## Technical Details

### Dependencies

- **Vite**: Modern build tool and dev server
- **OpenAI SDK**: For AI API integration
- **ES6 Modules**: Modern JavaScript module system

### Features Implemented

- ✅ Vite-based build system
- ✅ ES6 module structure
- ✅ Multi-provider AI configuration
- ✅ OpenRouter integration
- ✅ Local model support
- ✅ Enhanced UI with modal dialogs
- ✅ Configuration persistence
- ✅ Error handling and notifications
- ✅ Provider detection and branding

### Browser Compatibility

Modern browsers with ES6 module support required.

## License

MIT License