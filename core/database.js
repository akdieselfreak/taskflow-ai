// core/database.js - SQLite Database Layer with User Support

import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Logger } from './config.js';
import { promisify } from 'util';

export class DatabaseManager {
    constructor(dbPath = process.env.DATABASE_PATH || './data/taskflow.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';
        
        // Warn if using fallback secret
        if (!process.env.JWT_SECRET) {
            Logger.warn('Using fallback JWT secret. Set JWT_SECRET environment variable for production!');
        }
        
        this.init();
    }

    async init() {
        try {
            // Ensure data directory exists
            const fs = await import('fs');
            const path = await import('path');
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    Logger.error('Failed to connect to database', err);
                    throw err;
                }
            });

            // Promisify database methods
            this.dbRun = promisify(this.db.run.bind(this.db));
            this.dbGet = promisify(this.db.get.bind(this.db));
            this.dbAll = promisify(this.db.all.bind(this.db));
            this.dbExec = promisify(this.db.exec.bind(this.db));

            // Set WAL mode for better performance
            await this.dbRun('PRAGMA journal_mode = WAL');
            
            await this.createTables();
            Logger.log('Database initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize database', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`,

            // User sessions
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                session_token TEXT UNIQUE NOT NULL,
                device_info TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            )`,

            // Tasks with user support
            `CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name TEXT NOT NULL,
                description TEXT,
                notes TEXT,
                completed BOOLEAN DEFAULT FALSE,
                postponed BOOLEAN DEFAULT FALSE,
                type TEXT DEFAULT 'quick',
                created_at DATETIME,
                completed_at DATETIME,
                postponed_at DATETIME,
                modified_at DATETIME,
                date TEXT
            )`,

            // Notes with user support
            `CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                content TEXT,
                tags TEXT,
                summary TEXT,
                ai_processed BOOLEAN DEFAULT FALSE,
                extracted_tasks TEXT,
                created_at DATETIME,
                modified_at DATETIME
            )`,

            // Pending tasks with user support
            `CREATE TABLE IF NOT EXISTS pending_tasks (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                context TEXT,
                confidence REAL,
                source_note_title TEXT,
                source_note_id TEXT,
                created_at DATETIME,
                extracted_from TEXT
            )`,

            // User configuration
            `CREATE TABLE IF NOT EXISTS user_config (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                service_type TEXT,
                api_endpoint TEXT,
                api_key TEXT,
                model_name TEXT,
                name_variations TEXT,
                system_prompt TEXT,
                notes_title_prompt TEXT,
                notes_summary_prompt TEXT,
                notes_task_extraction_prompt TEXT,
                user_name TEXT
            )`
        ];

        for (const sql of tables) {
            await this.dbExec(sql);
        }

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_pending_tasks_user_id ON pending_tasks(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)'
        ];

        for (const sql of indexes) {
            await this.dbExec(sql);
        }
    }

    // ====== USER AUTHENTICATION ======

    async registerUser(username, email, password) {
        try {
            const passwordHash = await bcrypt.hash(password, 10);
            
            const sql = `
                INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)
            `;
            
            // Use a different approach - get the lastID from the result context
            const result = await new Promise((resolve, reject) => {
                this.db.run(sql, [username, email, passwordHash], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ lastID: this.lastID, changes: this.changes });
                    }
                });
            });
            
            Logger.log('User registered successfully', { username, userId: result.lastID });
            return { success: true, userId: result.lastID };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE')) {
                return { success: false, error: 'Username or email already exists' };
            }
            Logger.error('User registration failed', error);
            return { success: false, error: 'Registration failed' };
        }
    }

    async loginUser(username, password) {
        try {
            const sql = `
                SELECT id, username, email, password_hash 
                FROM users 
                WHERE username = ? OR email = ?
            `;
            
            const user = await this.dbGet(sql, [username, username]);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return { success: false, error: 'Invalid password' };
            }

            // Update last login
            const updateSql = `
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            `;
            await this.dbRun(updateSql, [user.id]);

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                this.jwtSecret,
                { expiresIn: '30d' }
            );

            // Store session
            const sessionSql = `
                INSERT INTO user_sessions (user_id, session_token, expires_at)
                VALUES (?, ?, datetime('now', '+30 days'))
            `;
            await this.dbRun(sessionSql, [user.id, token]);

            Logger.log('User logged in successfully', { username: user.username, userId: user.id });
            
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            };
        } catch (error) {
            Logger.error('Login failed', error);
            return { success: false, error: 'Login failed' };
        }
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Check if session exists and is valid
            const sql = `
                SELECT s.*, u.username, u.email
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = ? AND s.expires_at > datetime('now')
            `;
            
            const session = await this.dbGet(sql, [token]);
            
            if (!session) {
                return { valid: false, error: 'Session expired or invalid' };
            }

            return {
                valid: true,
                user: {
                    id: session.user_id,
                    username: session.username,
                    email: session.email
                }
            };
        } catch (error) {
            return { valid: false, error: 'Invalid token' };
        }
    }

    // ====== TASK OPERATIONS ======

    async saveTasks(userId, tasks) {
        try {
            // Use transaction for atomic operation
            await this.dbRun('BEGIN TRANSACTION');
            
            try {
                // Delete existing tasks for user
                await this.dbRun('DELETE FROM tasks WHERE user_id = ?', [userId]);
                
                // Insert new tasks
                const insertSql = `
                    INSERT INTO tasks (
                        id, user_id, name, description, notes, completed, postponed, 
                        type, created_at, completed_at, postponed_at, modified_at, date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                for (const task of tasks) {
                    await this.dbRun(insertSql, [
                        task.id, userId, task.name, task.description || null, 
                        task.notes || null, task.completed ? 1 : 0, task.postponed ? 1 : 0,
                        task.type, task.createdAt, task.completedAt || null,
                        task.postponedAt || null, task.modifiedAt || null, task.date
                    ]);
                }

                await this.dbRun('COMMIT');
                Logger.log('Tasks saved successfully', { userId, count: tasks.length });
                return true;
            } catch (error) {
                await this.dbRun('ROLLBACK');
                throw error;
            }
        } catch (error) {
            Logger.error('Failed to save tasks', error);
            return false;
        }
    }

    async loadTasks(userId) {
        try {
            const sql = `
                SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC
            `;
            
            const rows = await this.dbAll(sql, [userId]);
            
            const tasks = rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                notes: row.notes,
                completed: Boolean(row.completed),
                postponed: Boolean(row.postponed),
                type: row.type,
                createdAt: row.created_at,
                completedAt: row.completed_at,
                postponedAt: row.postponed_at,
                modifiedAt: row.modified_at,
                date: row.date
            }));

            Logger.log('Tasks loaded successfully', { userId, count: tasks.length });
            return tasks;
        } catch (error) {
            Logger.error('Failed to load tasks', error);
            return [];
        }
    }

    // ====== NOTE OPERATIONS ======

    async saveNotes(userId, notes) {
        try {
            // Use transaction for atomic operation
            await this.dbRun('BEGIN TRANSACTION');
            
            try {
                // Delete existing notes for user
                await this.dbRun('DELETE FROM notes WHERE user_id = ?', [userId]);
                
                // Insert new notes
                const insertSql = `
                    INSERT INTO notes (
                        id, user_id, title, content, tags, summary, 
                        ai_processed, extracted_tasks, created_at, modified_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                for (const note of notes) {
                    await this.dbRun(insertSql, [
                        note.id, userId, note.title, note.content,
                        JSON.stringify(note.tags || []), note.summary || null,
                        note.aiProcessed ? 1 : 0, JSON.stringify(note.extractedTasks || []),
                        note.createdAt, note.modifiedAt
                    ]);
                }

                await this.dbRun('COMMIT');
                Logger.log('Notes saved successfully', { userId, count: notes.length });
                return true;
            } catch (error) {
                await this.dbRun('ROLLBACK');
                throw error;
            }
        } catch (error) {
            Logger.error('Failed to save notes', error);
            return false;
        }
    }

    async loadNotes(userId) {
        try {
            const sql = `
                SELECT * FROM notes WHERE user_id = ? ORDER BY modified_at DESC
            `;
            
            const rows = await this.dbAll(sql, [userId]);
            
            const notes = rows.map(row => ({
                id: row.id,
                title: row.title,
                content: row.content,
                tags: JSON.parse(row.tags || '[]'),
                summary: row.summary,
                aiProcessed: Boolean(row.ai_processed),
                extractedTasks: JSON.parse(row.extracted_tasks || '[]'),
                createdAt: row.created_at,
                modifiedAt: row.modified_at
            }));

            Logger.log('Notes loaded successfully', { userId, count: notes.length });
            return notes;
        } catch (error) {
            Logger.error('Failed to load notes', error);
            return [];
        }
    }

    // ====== CONFIGURATION OPERATIONS ======

    async saveConfiguration(userId, config) {
        try {
            const sql = `
                INSERT OR REPLACE INTO user_config (
                    user_id, service_type, api_endpoint, api_key, model_name,
                    name_variations, system_prompt, notes_title_prompt,
                    notes_summary_prompt, notes_task_extraction_prompt, user_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.dbRun(sql, [
                userId, config.service, config.endpoint, config.apiKey,
                config.model, JSON.stringify(config.nameVariations || []),
                config.systemPrompt, config.notesTitlePrompt,
                config.notesSummaryPrompt, config.notesTaskExtractionPrompt,
                config.userName
            ]);

            Logger.log('Configuration saved successfully', { userId });
            return true;
        } catch (error) {
            Logger.error('Failed to save configuration', error);
            return false;
        }
    }

    async loadConfiguration(userId) {
        try {
            const sql = `
                SELECT * FROM user_config WHERE user_id = ?
            `;
            
            const config = await this.dbGet(sql, [userId]);
            
            if (!config) {
                Logger.log('No configuration found for user', { userId });
                return null;
            }

            const loadedConfig = {
                service: config.service_type,
                endpoint: config.api_endpoint,
                apiKey: config.api_key,
                model: config.model_name,
                nameVariations: JSON.parse(config.name_variations || '[]'),
                systemPrompt: config.system_prompt,
                notesTitlePrompt: config.notes_title_prompt,
                notesSummaryPrompt: config.notes_summary_prompt,
                notesTaskExtractionPrompt: config.notes_task_extraction_prompt,
                hasCompletedOnboarding: true, // Mark as completed if config exists
                userName: config.user_name || 'User' // Add default user name
            };

            Logger.log('Configuration loaded successfully', { userId, service: loadedConfig.service });
            return loadedConfig;
        } catch (error) {
            Logger.error('Failed to load configuration', error);
            return null;
        }
    }

    // ====== UTILITY METHODS ======

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    Logger.error('Error closing database', err);
                } else {
                    Logger.log('Database connection closed');
                }
            });
        }
    }

    // Health check for Docker
    async healthCheck() {
        try {
            const result = await this.dbGet('SELECT 1 as health');
            return result.health === 1;
        } catch (error) {
            Logger.error('Database health check failed', error);
            return false;
        }
    }
}

// Export singleton instance
export const dbManager = new DatabaseManager();
