# TaskFlow AI

An intelligent task management system that combines the simplicity of traditional to-do lists with the power of artificial intelligence.

## 🚀 Features

- **AI-Powered Task Extraction** - Extract multiple tasks from emails, messages, and documents
- **Smart Notes System** - Create notes with automatic AI summaries and task extraction
- **Multiple AI Services** - Support for Ollama, Open WebUI, and OpenAI
- **Smart Name Recognition** - AI recognizes tasks assigned to you by name variations
- **Daily/Weekly Summaries** - Generate AI-powered summaries of your notes
- **Data Import/Export** - Comprehensive backup and migration tools
- **Privacy-First** - All data stored locally in your browser
- **Keyboard Shortcuts** - Speed up your workflow

## 📦 Quick Start

```bash
# Run development server
npm run dev

# Access the application at http://localhost:8000
```

## 🛠️ Development

```bash
# Run development server
npm run dev

# Or use start command
npm start
```

## 📖 Documentation

- [User Manual](manual.html) - Complete feature guide and instructions

## 🔧 AI Services Supported

### OpenAI (Cloud)
- GPT-3.5, GPT-4, and newer models
- Requires API key
- High accuracy task extraction

### Ollama (Self-Hosted Only)
- Local AI models
- No API costs
- Complete privacy
- Auto-detects available models

### Open WebUI (Self-Hosted Only)
- Unified interface for multiple AI models
- Local or remote deployment
- OpenAI-compatible API

## 📝 Notes System

### Automatic AI Processing
- **Instant Summaries** - Each note gets a concise 1-2 sentence AI summary
- **Task Extraction** - Automatically finds and extracts tasks from your notes
- **Smart Auto-Add** - High-confidence tasks (>70%) are automatically added to your task list
- **Name Recognition** - AI recognizes tasks assigned to you by any of your name variations

### Note Management
- **Tags & Organization** - Tag your notes for easy categorization
- **Full-Text Search** - Search across all notes by title, content, or tags
- **Export Options** - Export notes in JSON, Markdown, or plain text formats

### AI Summaries
- **Daily Summaries** - Generate AI summaries of all notes from a specific day
- **Weekly Reviews** - Get comprehensive weekly summaries of your activities
- **Concise & Direct** - Summaries focus on key points without unnecessary explanations

## 📊 Export/Import Formats

- **JSON** - Complete backup with settings and notes
- **Markdown** - Human-readable task lists and notes
- **Obsidian** - Knowledge management integration
- **CSV** - Spreadsheet analysis for tasks

## 🎯 Use Cases

- **Email Processing** - Extract action items from email threads
- **Meeting Notes** - Convert meeting minutes to task lists with automatic summaries
- **Project Management** - Organize complex project requirements
- **Daily Planning** - Manage personal and professional tasks
- **Knowledge Management** - Create notes with AI-powered summaries and task extraction
- **Weekly Reviews** - Generate comprehensive summaries of your week's activities

## 🔒 Privacy & Security

- All tasks stored locally in browser
- No data sent to external servers (except AI processing)
- API keys stored securely in browser storage
- Export/import happens locally

## 🚀 Deployment

### Local Development

```bash
npm run dev
```
Access at http://localhost:8000

### Docker Deployment (Recommended)

#### Quick Start

Clone repository and build locally
```bash
git clone https://github.com/akdieselfreak/taskflow-ai.git
cd taskflow-ai
docker-compose up -d
```
Access at http://localhost:8080

#### If you encounter issues:

Force clean rebuild (fixes permission and config errors)
```bash
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache
docker-compose up -d
```

#### Direct Docker Build
Build and run manually
```bash
git clone https://github.com/akdieselfreak/taskflow-ai.git
cd taskflow-ai
docker build -t taskflow-ai .
docker run -d -p 8080:80 --name taskflow-ai taskflow-ai
```
Access at http://localhost:8080

#### Development with Docker

# For development with live reload
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Static Hosting
Deploy the files to any static web host:
- GitHub Pages
- Vercel
- Netlify
- Your own web server

### Production Deployment
For production environments, see [DEPLOYMENT.md](DEPLOYMENT.md) and [DOCKER.md](DOCKER.md) for detailed guides including:
- Reverse proxy setup
- SSL configuration
- Health monitoring
- Security considerations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes locally
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the [User Manual](manual.html) for detailed instructions
- Review [Troubleshooting](manual.html#troubleshooting) section
- Open an issue for bugs or feature requests

---

**TaskFlow AI** - Making task management intelligent and effortless.
