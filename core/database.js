// core/database.js - SQLite Database Layer with User Support

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Logger } from './config.js';

export class DatabaseManager {
    constructor(dbPath = './data/taskflow.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.init();
    }

    init() {
        try {
            // Ensure data directory exists
            const fs = require('fs');
            const path = require('path');
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL'); // Better performance
            this.createTables();
            Logger.log('Database initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize database', error);
            throw error;
        }
    }

    createTables() {
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
                notes_task_extraction_prompt TEXT
            )`
        ];

        tables.forEach(sql => {
            this.db.exec(sql);
        });

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_pending_tasks_user_id ON pending_tasks(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)'
        ];

        indexes.forEach(sql => {
            this.db.exec(sql);
        });
    }

    // ====== USER AUTHENTICATION ======

    async registerUser(username, email, password) {
        try {
            const passwordHash = await bcrypt.hash(password, 10);
            
            const stmt = this.db.prepare(`
                INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)
            `);
            
            const result = stmt.run(username, email, passwordHash);
            
            Logger.log('User registered successfully', { username, userId: result.lastInsertRowid });
            return { success: true, userId: result.lastInsertRowid };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, error: 'Username or email already exists' };
            }
            Logger.error('User registration failed', error);
            return { success: false, error: 'Registration failed' };
        }
    }

    async loginUser(username, password) {
        try {
            const stmt = this.db.prepare(`
                SELECT id, username, email, password_hash 
                FROM users 
                WHERE username = ? OR email = ?
            `);
            
            const user = stmt.get(username, username);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return { success: false, error: 'Invalid password' };
            }

            // Update last login
            const updateStmt = this.db.prepare(`
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            `);
            updateStmt.run(user.id);

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                this.jwtSecret,
                { expiresIn: '30d' }
            );

            // Store session
            const sessionStmt = this.db.prepare(`
                INSERT INTO user_sessions (user_id, session_token, expires_at)
                VALUES (?, ?, datetime('now', '+30 days'))
            `);
            sessionStmt.run(user.id, token);

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

    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Check if session exists and is valid
            const stmt = this.db.prepare(`
                SELECT s.*, u.username, u.email
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = ? AND s.expires_at > datetime('now')
            `);
            
            const session = stmt.get(token);
            
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

    saveTasks(userId, tasks) {
        try {
            const deleteStmt = this.db.prepare('DELETE FROM tasks WHERE user_id = ?');
            const insertStmt = this.db.prepare(`
                INSERT INTO tasks (
                    id, user_id, name, description, notes, completed, postponed, 
                    type, created_at, completed_at, postponed_at, modified_at, date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const transaction = this.db.transaction(() => {
                deleteStmt.run(userId);
                
                tasks.forEach(task => {
                    insertStmt.run(
                        task.id, userId, task.name, task.description || null, 
                        task.notes || null, task.completed ? 1 : 0, task.postponed ? 1 : 0,
                        task.type, task.createdAt, task.completedAt || null,
                        task.postponedAt || null, task.modifiedAt || null, task.date
                    );
                });
            });

            transaction();
            Logger.log('Tasks saved successfully', { userId, count: tasks.length });
            return true;
        } catch (error) {
            Logger.error('Failed to save tasks', error);
            return false;
        }
    }

    loadTasks(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC
            `);
            
            const rows = stmt.all(userId);
            
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

    saveNotes(userId, notes) {
        try {
            const deleteStmt = this.db.prepare('DELETE FROM notes WHERE user_id = ?');
            const insertStmt = this.db.prepare(`
                INSERT INTO notes (
                    id, user_id, title, content, tags, summary, 
                    ai_processed, extracted_tasks, created_at, modified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const transaction = this.db.transaction(() => {
                deleteStmt.run(userId);
                
                notes.forEach(note => {
                    insertStmt.run(
                        note.id, userId, note.title, note.content,
                        JSON.stringify(note.tags || []), note.summary || null,
                        note.aiProcessed ? 1 : 0, JSON.stringify(note.extractedTasks || []),
                        note.createdAt, note.modifiedAt
                    );
                });
            });

            transaction();
            Logger.log('Notes saved successfully', { userId, count: notes.length });
            return true;
        } catch (error) {
            Logger.error('Failed to save notes', error);
            return false;
        }
    }

    loadNotes(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM notes WHERE user_id = ? ORDER BY modified_at DESC
            `);
            
            const rows = stmt.all(userId);
            
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

    saveConfiguration(userId, config) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO user_config (
                    user_id, service_type, api_endpoint, api_key, model_name,
                    name_variations, system_prompt, notes_title_prompt,
                    notes_summary_prompt, notes_task_extraction_prompt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                userId, config.service, config.endpoint, config.apiKey,
                config.model, JSON.stringify(config.nameVariations || []),
                config.systemPrompt, config.notesTitlePrompt,
                config.notesSummaryPrompt, config.notesTaskExtractionPrompt
            );

            Logger.log('Configuration saved successfully', { userId });
            return true;
        } catch (error) {
            Logger.error('Failed to save configuration', error);
            return false;
        }
    }

    loadConfiguration(userId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM user_config WHERE user_id = ?
            `);
            
            const config = stmt.get(userId);
            
            if (!config) {
                return null;
            }

            return {
                service: config.service_type,
                endpoint: config.api_endpoint,
                apiKey: config.api_key,
                model: config.model_name,
                nameVariations: JSON.parse(config.name_variations || '[]'),
                systemPrompt: config.system_prompt,
                notesTitlePrompt: config.notes_title_prompt,
                notesSummaryPrompt: config.notes_summary_prompt,
                notesTaskExtractionPrompt: config.notes_task_extraction_prompt
            };
        } catch (error) {
            Logger.error('Failed to load configuration', error);
            return null;
        }
    }

    // ====== UTILITY METHODS ======

    close() {
        if (this.db) {
            this.db.close();
            Logger.log('Database connection closed');
        }
    }

    // Health check for Docker
    healthCheck() {
        try {
            const result = this.db.prepare('SELECT 1 as health').get();
            return result.health === 1;
        } catch (error) {
            Logger.error('Database health check failed', error);
            return false;
        }
    }
}

// Export singleton instance
export const dbManager = new DatabaseManager();
