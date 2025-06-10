# TaskFlow AI

An intelligent task management system that combines the simplicity of traditional to-do lists with the power of artificial intelligence. TaskFlow AI features secure multi-user authentication, cloud data synchronization, and advanced AI-powered task extraction from emails, messages, and documents.

## 🚀 Key Features

### 🔐 **Secure Multi-User System**
- **User Authentication** - Secure account creation and login with JWT tokens
- **Cloud Data Sync** - All data stored securely in the cloud with multi-device access
- **User Isolation** - Complete data separation between users
- **Session Management** - Secure session handling with automatic token refresh

### 🤖 **AI-Powered Task Management**
- **Smart Task Extraction** - Extract multiple tasks from emails, messages, and documents
- **Multiple AI Services** - Support for Ollama, OpenAI, and Open WebUI
- **Name Recognition** - AI recognizes tasks assigned to you by name variations
- **Intelligent Processing** - Automatic retry, timeout protection, and error recovery

### 📝 **Advanced Notes System**
- **AI-Powered Notes** - Create notes with automatic AI summaries and task extraction
- **Smart Auto-Add** - High-confidence tasks (>70%) automatically added to task list
- **Daily/Weekly Summaries** - Generate AI-powered summaries of your notes
- **Full-Text Search** - Search across all notes by title, content, or tags
- **Tag Organization** - Categorize notes with custom tags

### 📊 **Comprehensive Data Management**
- **Multiple Export Formats** - JSON, Markdown, Obsidian, CSV
- **Smart Import** - Import from various sources with duplicate detection
- **Data Migration** - Easy migration between devices and platforms
- **Backup & Restore** - Complete data backup with configuration settings

### ⌨️ **Enhanced User Experience**
- **Keyboard Shortcuts** - Speed up your workflow with hotkeys
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Accessibility** - Full keyboard navigation and screen reader support
- **Performance Monitoring** - Built-in performance tracking and optimization

## 🏗️ Architecture

### Frontend
- **Modern JavaScript** - ES6 modules with clean architecture
- **Responsive UI** - CSS3 with mobile-first design
- **Real-time Updates** - Live data synchronization
- **Offline Support** - Graceful handling of network issues

### Backend
- **Express.js API** - RESTful API with comprehensive endpoints
- **SQLite Database** - Reliable data storage with user isolation
- **JWT Authentication** - Secure token-based authentication
- **Rate Limiting** - Protection against abuse and spam

### Security
- **Password Hashing** - bcryptjs for secure password storage
- **CORS Protection** - Configurable cross-origin resource sharing
- **Input Validation** - Comprehensive server-side validation
- **Environment Variables** - Secure configuration management

## 📦 Quick Start

### Prerequisites
- Node.js v18 LTS or later
- npm v9+ or yarn v1.22+

### Installation

```bash
# Clone the repository
git clone https://github.com/akdieselfreak/taskflow-ai.git
cd taskflow-ai

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Set JWT_SECRET to a secure random string
```

### Development

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run server  # Backend on port 3001
npm run client  # Frontend on port 8000
```

### Production

```bash
# Start production server
npm start

# Access at http://localhost:3001
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Security (REQUIRED for production)
JWT_SECRET=your-super-secure-secret-key-here-change-this-in-production

# Database
DATABASE_PATH=./data/taskflow.db

# Server
NODE_ENV=production
PORT=3001

# CORS (comma-separated origins)
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS=300000
AUTH_RATE_LIMIT_MAX_REQUESTS=50
DATA_RATE_LIMIT_WINDOW_MS=900000
DATA_RATE_LIMIT_MAX_REQUESTS=200
```

### AI Services Supported

#### OpenAI (Cloud)
- GPT-3.5, GPT-4, and newer models
- Requires API key from OpenAI
- High accuracy task extraction
- Custom endpoint support

#### Ollama (Self-Hosted)
- Local AI models (Llama, Mistral, etc.)
- No API costs or external dependencies
- Complete privacy and control
- Auto-detects available models

#### Open WebUI (Self-Hosted)
- Unified interface for multiple AI models
- OpenAI-compatible API
- Local or remote deployment
- Supports various model providers

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Access at http://localhost:8080
```

### Development with Docker

```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d
```

### With Local AI (Ollama)

```bash
# Include Ollama service
docker-compose --profile with-ollama up -d
```

### Manual Docker Build

```bash
# Build image
docker build -t taskflow-ai .

# Run container
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret-key \
  taskflow-ai
```

## 📖 API Documentation

### Authentication Endpoints

```bash
POST /api/auth/register    # Create new user account
POST /api/auth/login       # User login
POST /api/auth/logout      # User logout
GET  /api/auth/verify      # Verify JWT token
```

### Data Endpoints (Authenticated)

```bash
GET  /api/tasks           # Load user tasks
POST /api/tasks           # Save user tasks
GET  /api/notes           # Load user notes
POST /api/notes           # Save user notes
GET  /api/config          # Load user configuration
POST /api/config          # Save user configuration
```

### Utility Endpoints

```bash
GET  /health              # Health check
POST /api/migrate/import  # Import data
```

## 🎯 Use Cases

### Personal Productivity
- **Daily Task Management** - Organize personal and professional tasks
- **Email Processing** - Extract action items from email threads
- **Meeting Notes** - Convert meeting minutes to actionable tasks
- **Project Planning** - Break down complex projects into manageable tasks

### Team Collaboration
- **Multi-User Support** - Each team member has their own secure account
- **Data Sharing** - Export/import capabilities for team coordination
- **Task Assignment** - AI recognizes tasks assigned to specific team members
- **Progress Tracking** - Monitor task completion across the team

### Knowledge Management
- **Note-Taking** - Capture ideas with automatic AI summaries
- **Research Organization** - Tag and categorize research notes
- **Weekly Reviews** - Generate comprehensive summaries of activities
- **Data Export** - Export to Obsidian, Markdown, or other knowledge tools

## 🔒 Security & Privacy

### Data Protection
- **User Isolation** - Complete separation of user data in database
- **Secure Authentication** - JWT tokens with configurable expiration
- **Password Security** - bcryptjs hashing with salt rounds
- **Session Management** - Secure session handling and cleanup

### Privacy Features
- **Local AI Processing** - Support for local AI models (Ollama)
- **No Data Mining** - No analytics or tracking of user content
- **Export Control** - Users own and control their data completely
- **Secure Storage** - All data encrypted in transit and at rest

### Production Security
- **Environment Variables** - Sensitive configuration via environment
- **Rate Limiting** - Protection against brute force and spam
- **CORS Protection** - Configurable cross-origin policies
- **Input Validation** - Comprehensive server-side validation

## 🚀 Deployment

### Static Hosting (Frontend Only)
Deploy the frontend files to any static web host:
- Vercel, Netlify, GitHub Pages
- AWS S3 + CloudFront
- Your own web server

### Full-Stack Deployment
For complete functionality including authentication:
- **VPS/Cloud Server** - Deploy both frontend and backend
- **Docker** - Use provided Docker configuration
- **Platform as a Service** - Heroku, Railway, DigitalOcean App Platform

### Production Checklist
- [ ] Set secure `JWT_SECRET` environment variable
- [ ] Configure proper `CORS_ORIGIN` for your domain
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure database backups
- [ ] Set up monitoring and logging
- [ ] Test authentication flow
- [ ] Verify AI service connections

## 📚 Documentation

- **[User Manual](manual.html)** - Complete feature guide and instructions
- **[Build Guide](BUILD.md)** - Detailed build and development instructions
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment guide
- **[Docker Guide](DOCKER.md)** - Docker-specific documentation
- **[Upgrade Guide](UPGRADE_GUIDE.md)** - Version upgrade instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes locally
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation for user-facing changes
- Ensure all tests pass before submitting PR

## 🆘 Support & Troubleshooting

### Common Issues
- **Authentication Problems** - Check JWT_SECRET and database connectivity
- **AI Connection Failures** - Verify API keys and service endpoints
- **Import/Export Issues** - Check file formats and browser permissions
- **Performance Issues** - Monitor database size and clear browser cache

### Getting Help
- **[User Manual](manual.html)** - Comprehensive feature documentation
- **[Troubleshooting Guide](manual.html#troubleshooting)** - Common issues and solutions
- **GitHub Issues** - Report bugs or request features
- **Community Support** - Join discussions and get help from other users

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **AI Integration** - Support for multiple AI providers
- **Security** - JWT authentication and bcryptjs password hashing
- **Database** - SQLite for reliable data storage
- **Frontend** - Modern JavaScript with ES6 modules
- **Docker** - Containerization for easy deployment

---

**TaskFlow AI** - Making task management intelligent, secure, and effortless.

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Minimum Node.js:** v18 LTS
