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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:*", "https://api.openai.com"]
        }
    }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:8000', 'http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const verification = dbManager.verifyToken(token);
    
    if (!verification.valid) {
        return res.status(403).json({ error: verification.error });
    }

    req.user = verification.user;
    next();
};

// ====== AUTHENTICATION ROUTES ======

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const result = await dbManager.registerUser(username, email, password);
        
        if (result.success) {
            res.status(201).json({ 
                message: 'User registered successfully',
                userId: result.userId 
            });
        } else {
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

app.get('/api/tasks', authenticateToken, (req, res) => {
    try {
        const tasks = dbManager.loadTasks(req.user.id);
        res.json({ tasks });
    } catch (error) {
        Logger.error('Failed to load tasks', error);
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

app.post('/api/tasks', authenticateToken, (req, res) => {
    try {
        const { tasks } = req.body;
        
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ error: 'Tasks must be an array' });
        }

        const success = dbManager.saveTasks(req.user.id, tasks);
        
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

app.get('/api/notes', authenticateToken, (req, res) => {
    try {
        const notes = dbManager.loadNotes(req.user.id);
        res.json({ notes });
    } catch (error) {
        Logger.error('Failed to load notes', error);
        res.status(500).json({ error: 'Failed to load notes' });
    }
});

app.post('/api/notes', authenticateToken, (req, res) => {
    try {
        const { notes } = req.body;
        
        if (!Array.isArray(notes)) {
            return res.status(400).json({ error: 'Notes must be an array' });
        }

        const success = dbManager.saveNotes(req.user.id, notes);
        
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

app.get('/api/config', authenticateToken, (req, res) => {
    try {
        const config = dbManager.loadConfiguration(req.user.id);
        res.json({ config });
    } catch (error) {
        Logger.error('Failed to load configuration', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

app.post('/api/config', authenticateToken, (req, res) => {
    try {
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({ error: 'Configuration data required' });
        }

        const success = dbManager.saveConfiguration(req.user.id, config);
        
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

// ====== DATA MIGRATION ROUTES ======

app.post('/api/migrate/import', authenticateToken, (req, res) => {
    try {
        const { tasks, notes, pendingTasks, configuration } = req.body;
        
        let imported = 0;
        let errors = [];

        // Import tasks
        if (tasks && Array.isArray(tasks) && tasks.length > 0) {
            const success = dbManager.saveTasks(req.user.id, tasks);
            if (success) {
                imported += tasks.length;
            } else {
                errors.push('Failed to import tasks');
            }
        }

        // Import notes
        if (notes && Array.isArray(notes) && notes.length > 0) {
            const success = dbManager.saveNotes(req.user.id, notes);
            if (success) {
                imported += notes.length;
            } else {
                errors.push('Failed to import notes');
            }
        }

        // Import configuration
        if (configuration) {
            const success = dbManager.saveConfiguration(req.user.id, configuration);
            if (!success) {
                errors.push('Failed to import configuration');
            }
        }

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
