// server.js - Express API Server for TaskFlow AI

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbManager } from './core/database.js';
import { Logger } from './core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Parse CORS origins from environment variable
const getCorsOrigins = () => {
    if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    }
    
    // Build default CORS origins based on external host/port
    const externalHost = process.env.EXTERNAL_HOST || 'localhost';
    const externalPort = process.env.EXTERNAL_PORT || '8080';
    
    const defaultOrigins = [
        `http://${externalHost}:${externalPort}`,
        `https://${externalHost}:${externalPort}`,
        'http://localhost:8000', 
        'http://localhost:3000', 
        'http://localhost:3001',
        `http://localhost:${externalPort}`,
        `https://localhost:${externalPort}`
    ];
    
    return process.env.NODE_ENV === 'production' 
        ? defaultOrigins.filter(origin => !origin.includes('localhost:8000') && !origin.includes('localhost:3000') && !origin.includes('localhost:3001'))
        : defaultOrigins;
};

// Get external host for CSP configuration
const getExternalHost = () => {
    return process.env.EXTERNAL_HOST || 'localhost';
};

const getExternalPort = () => {
    return process.env.EXTERNAL_PORT || '8080';
};

// Build CSP sources based on configuration
const buildCSPSources = () => {
    const externalHost = getExternalHost();
    const externalPort = getExternalPort();
    
    const httpSource = `http://${externalHost}:${externalPort}`;
    const httpsSource = `https://${externalHost}:${externalPort}`;
    
    return {
        self: ["'self'", httpSource],
        connect: ["'self'", httpSource, httpsSource, "http://localhost:*", "https://api.openai.com", "ws:", "wss:"]
    };
};

// Security middleware
const cspSources = buildCSPSources();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: cspSources.self,
            styleSrc: [...cspSources.self, "'unsafe-inline'"],
            scriptSrc: [...cspSources.self, "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: [...cspSources.self, "'unsafe-inline'"],
            imgSrc: [...cspSources.self, "data:", "https:"],
            connectSrc: cspSources.connect,
            workerSrc: [...cspSources.self, "blob:"],
            childSrc: [...cspSources.self, "blob:"],
            objectSrc: ["'none'"],
            mediaSrc: cspSources.self,
            manifestSrc: cspSources.self,
            fontSrc: [...cspSources.self, "data:", "https:"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: getCorsOrigins(),
    credentials: true
}));

// Rate limiting with environment variable support
// More permissive rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 50, // 50 auth requests per 5 minutes
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiting for data endpoints
const dataLimiter = rateLimit({
    windowMs: parseInt(process.env.DATA_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.DATA_RATE_LIMIT_MAX_REQUESTS) || 200, // 200 data requests per 15 minutes
    message: 'Too many data requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply auth rate limiting to authentication endpoints
app.use('/api/auth/', authLimiter);

// Apply data rate limiting to other API endpoints
app.use('/api/tasks', dataLimiter);
app.use('/api/notes', dataLimiter);
app.use('/api/config', dataLimiter);
app.use('/api/migrate', dataLimiter);
app.use('/api/chats', dataLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (your frontend)
app.use(express.static('.', {
    index: 'index.html',
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const verification = await dbManager.verifyToken(token);
        
        if (!verification.valid) {
            return res.status(403).json({ error: verification.error });
        }

        req.user = verification.user;
        next();
    } catch (error) {
        Logger.error('Token verification failed', error);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ====== AUTHENTICATION ROUTES ======

app.post('/api/auth/register', async (req, res) => {
    try {
        Logger.log('Registration request received', { body: req.body, headers: req.headers['content-type'] });
        
        const { username, email, password } = req.body;

        if (!username || !password) {
            Logger.log('Registration validation failed: missing username or password');
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (password.length < 6) {
            Logger.log('Registration validation failed: password too short');
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        Logger.log('Calling dbManager.registerUser', { username, email: email || 'none' });
        const result = await dbManager.registerUser(username, email, password);
        Logger.log('Registration result', result);
        
        if (result.success) {
            res.status(201).json({ 
                message: 'User registered successfully',
                userId: result.userId 
            });
        } else {
            Logger.log('Registration failed', { error: result.error });
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        Logger.error('Registration error', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await dbManager.loginUser(username, password);
        
        if (result.success) {
            res.json({
                message: 'Login successful',
                token: result.token,
                user: result.user
            });
        } else {
            res.status(401).json({ error: result.error });
        }
    } catch (error) {
        Logger.error('Login error', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In a more complex system, you'd invalidate the token here
    res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

// ====== USER PROFILE ROUTES ======

app.get('/api/user/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ====== TASK ROUTES ======

app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        Logger.log('Loading tasks for user', { userId: req.user.id });
        const tasks = await dbManager.loadTasks(req.user.id);
        Logger.log('Tasks loaded', { userId: req.user.id, count: tasks ? tasks.length : 0 });
        res.json({ tasks: tasks || [] });
    } catch (error) {
        Logger.error('Failed to load tasks', error);
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { tasks } = req.body;
        
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ error: 'Tasks must be an array' });
        }

        Logger.log('Saving tasks for user', { userId: req.user.id, count: tasks.length });
        const success = await dbManager.saveTasks(req.user.id, tasks);
        Logger.log('Tasks save result', { userId: req.user.id, success });
        
        if (success) {
            res.json({ message: 'Tasks saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save tasks' });
        }
    } catch (error) {
        Logger.error('Failed to save tasks', error);
        res.status(500).json({ error: 'Failed to save tasks' });
    }
});

// ====== NOTES ROUTES ======

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        Logger.log('Loading notes for user', { userId: req.user.id });
        const notes = await dbManager.loadNotes(req.user.id);
        Logger.log('Notes loaded', { userId: req.user.id, count: notes ? notes.length : 0 });
        res.json({ notes: notes || [] });
    } catch (error) {
        Logger.error('Failed to load notes', error);
        res.status(500).json({ error: 'Failed to load notes' });
    }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
    try {
        const { notes } = req.body;
        
        if (!Array.isArray(notes)) {
            return res.status(400).json({ error: 'Notes must be an array' });
        }

        Logger.log('Saving notes for user', { userId: req.user.id, count: notes.length });
        const success = await dbManager.saveNotes(req.user.id, notes);
        Logger.log('Notes save result', { userId: req.user.id, success });
        
        if (success) {
            res.json({ message: 'Notes saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save notes' });
        }
    } catch (error) {
        Logger.error('Failed to save notes', error);
        res.status(500).json({ error: 'Failed to save notes' });
    }
});

// ====== CONFIGURATION ROUTES ======

app.get('/api/config', authenticateToken, async (req, res) => {
    try {
        Logger.log('Loading configuration for user', { userId: req.user.id });
        const config = await dbManager.loadConfiguration(req.user.id);
        Logger.log('Configuration loaded', { userId: req.user.id, hasConfig: !!config });
        res.json({ config });
    } catch (error) {
        Logger.error('Failed to load configuration', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

app.post('/api/config', authenticateToken, async (req, res) => {
    try {
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({ error: 'Configuration data required' });
        }

        Logger.log('Saving configuration for user', { userId: req.user.id });
        const success = await dbManager.saveConfiguration(req.user.id, config);
        Logger.log('Configuration save result', { userId: req.user.id, success });
        
        if (success) {
            res.json({ message: 'Configuration saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save configuration' });
        }
    } catch (error) {
        Logger.error('Failed to save configuration', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// ====== CHAT ROUTES ======

app.get('/api/chats', authenticateToken, async (req, res) => {
    try {
        Logger.log('Loading chats for user', { userId: req.user.id });
        const chats = await dbManager.loadChats(req.user.id);
        Logger.log('Chats loaded', { userId: req.user.id, count: chats ? chats.length : 0 });
        res.json({ chats: chats || [] });
    } catch (error) {
        Logger.error('Failed to load chats', error);
        res.status(500).json({ error: 'Failed to load chats' });
    }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
    try {
        const { chats } = req.body;
        
        if (!Array.isArray(chats)) {
            return res.status(400).json({ error: 'Chats must be an array' });
        }

        Logger.log('Saving chats for user', { userId: req.user.id, count: chats.length });
        const success = await dbManager.saveChats(req.user.id, chats);
        Logger.log('Chats save result', { userId: req.user.id, success });
        
        if (success) {
            res.json({ message: 'Chats saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save chats' });
        }
    } catch (error) {
        Logger.error('Failed to save chats', error);
        res.status(500).json({ error: 'Failed to save chats' });
    }
});

app.post('/api/chats/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { chat } = req.body;
        
        if (!chat) {
            return res.status(400).json({ error: 'Chat data required' });
        }

        // Ensure the chat ID matches
        if (chat.id !== chatId) {
            return res.status(400).json({ error: 'Chat ID mismatch' });
        }

        Logger.log('Saving individual chat for user', { userId: req.user.id, chatId });
        const success = await dbManager.saveChat(req.user.id, chat);
        Logger.log('Individual chat save result', { userId: req.user.id, chatId, success });
        
        if (success) {
            res.json({ message: 'Chat saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save chat' });
        }
    } catch (error) {
        Logger.error('Failed to save individual chat', error);
        res.status(500).json({ error: 'Failed to save chat' });
    }
});

app.delete('/api/chats/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;

        Logger.log('Deleting chat for user', { userId: req.user.id, chatId });
        const success = await dbManager.deleteChat(req.user.id, chatId);
        Logger.log('Chat delete result', { userId: req.user.id, chatId, success });
        
        if (success) {
            res.json({ message: 'Chat deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete chat' });
        }
    } catch (error) {
        Logger.error('Failed to delete chat', error);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

// ====== DATA MIGRATION ROUTES ======

app.post('/api/migrate/import', authenticateToken, async (req, res) => {
    try {
        const { tasks, notes, pendingTasks, configuration } = req.body;
        
        Logger.log('Import request received', { 
            userId: req.user.id, 
            tasksCount: tasks ? tasks.length : 0,
            notesCount: notes ? notes.length : 0 
        });
        
        let imported = 0;
        let errors = [];

        // Import tasks
        if (tasks && Array.isArray(tasks) && tasks.length > 0) {
            Logger.log('Importing tasks', { userId: req.user.id, count: tasks.length });
            const success = await dbManager.saveTasks(req.user.id, tasks);
            Logger.log('Tasks import result', { userId: req.user.id, success });
            if (success) {
                imported += tasks.length;
            } else {
                errors.push('Failed to import tasks');
            }
        }

        // Import notes
        if (notes && Array.isArray(notes) && notes.length > 0) {
            Logger.log('Importing notes', { userId: req.user.id, count: notes.length });
            const success = await dbManager.saveNotes(req.user.id, notes);
            Logger.log('Notes import result', { userId: req.user.id, success });
            if (success) {
                imported += notes.length;
            } else {
                errors.push('Failed to import notes');
            }
        }

        // Import configuration
        if (configuration) {
            Logger.log('Importing configuration', { userId: req.user.id });
            const success = await dbManager.saveConfiguration(req.user.id, configuration);
            Logger.log('Configuration import result', { userId: req.user.id, success });
            if (!success) {
                errors.push('Failed to import configuration');
            }
        }

        Logger.log('Import completed', { userId: req.user.id, imported, errors });

        if (errors.length > 0) {
            res.status(207).json({ // 207 Multi-Status
                message: 'Partial import completed',
                imported,
                errors
            });
        } else {
            res.json({
                message: 'Import completed successfully',
                imported
            });
        }
    } catch (error) {
        Logger.error('Import failed', error);
        res.status(500).json({ error: 'Import failed' });
    }
});

// ====== HEALTH CHECK ======

app.get('/health', (req, res) => {
    const dbHealth = dbManager.healthCheck();
    
    if (dbHealth) {
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(503).json({ 
            status: 'unhealthy', 
            database: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
});

// ====== ERROR HANDLING ======

app.use((err, req, res, next) => {
    Logger.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ====== SERVER STARTUP ======

const server = app.listen(PORT, () => {
    Logger.log(`TaskFlow AI server running on port ${PORT}`);
    Logger.log(`Frontend available at: http://localhost:${PORT}`);
    Logger.log(`API available at: http://localhost:${PORT}/api`);
    Logger.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    Logger.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        dbManager.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    Logger.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        dbManager.close();
        process.exit(0);
    });
});

export default app;
