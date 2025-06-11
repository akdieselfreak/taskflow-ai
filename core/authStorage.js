// core/authStorage.js - Database-Only Storage Manager (No Local Storage)

import { Logger } from './config.js';
import { authManager } from './authManager.js';

export class AuthStorageManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.lastSyncTime = null;
        
        // Rate limiting to prevent 429 errors
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // Minimum 1 second between requests
        this.maxConcurrentRequests = 3;
        this.activeRequests = 0;
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        Logger.log('[AuthStorage] Database-only storage manager initialized');
    }

    // Ensure user is authenticated before any operation
    ensureAuthenticated() {
        if (!authManager.isAuthenticated()) {
            throw new Error('User must be authenticated to access data');
        }
    }

    // ====== CONFIGURATION METHODS ======

    async saveConfiguration(onboardingData) {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            throw new Error('Internet connection required to save configuration');
        }
        
        return await this.saveConfigurationToDatabase(onboardingData);
    }

    async loadConfiguration() {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            throw new Error('Internet connection required to load configuration');
        }
        
        return await this.loadConfigurationFromDatabase();
    }

    async saveConfigurationToDatabase(onboardingData) {
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/config', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ config: onboardingData })
                });

                if (response.ok) {
                    Logger.log('[AuthStorage] Configuration saved to database');
                    return true;
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save configuration');
                }
            } catch (error) {
                Logger.error('[AuthStorage] Failed to save configuration', error);
                throw error;
            }
        });
    }

    async loadConfigurationFromDatabase() {
        try {
            const response = await fetch('http://localhost:3001/api/config', {
                headers: authManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('[AuthStorage] Configuration loaded from database');
                return data.config;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load configuration');
            }
        } catch (error) {
            Logger.error('[AuthStorage] Failed to load configuration', error);
            throw error;
        }
    }

    // ====== TASK METHODS ======

    async saveTasks(tasks) {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            this.queueForSync('tasks', tasks);
            throw new Error('Tasks queued for sync when online');
        }
        
        return await this.saveTasksToDatabase(tasks);
    }

    async loadTasks() {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            throw new Error('Internet connection required to load tasks');
        }
        
        return await this.loadTasksFromDatabase();
    }

    async saveTasksToDatabase(tasks) {
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/tasks', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ tasks })
                });

                if (response.ok) {
                    Logger.log('[AuthStorage] Tasks saved to database');
                    return true;
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save tasks');
                }
            } catch (error) {
                Logger.error('[AuthStorage] Failed to save tasks', error);
                throw error;
            }
        });
    }

    async loadTasksFromDatabase() {
        try {
            const response = await fetch('http://localhost:3001/api/tasks', {
                headers: authManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('[AuthStorage] Tasks loaded from database');
                return data.tasks || [];
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load tasks');
            }
        } catch (error) {
            Logger.error('[AuthStorage] Failed to load tasks', error);
            throw error;
        }
    }

    // ====== NOTES METHODS ======

    async saveNotes(notes) {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            this.queueForSync('notes', notes);
            throw new Error('Notes queued for sync when online');
        }
        
        return await this.saveNotesToDatabase(notes);
    }

    async loadNotes() {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            throw new Error('Internet connection required to load notes');
        }
        
        return await this.loadNotesFromDatabase();
    }

    async saveNotesToDatabase(notes) {
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/notes', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ notes })
                });

                if (response.ok) {
                    Logger.log('[AuthStorage] Notes saved to database');
                    return true;
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save notes');
                }
            } catch (error) {
                Logger.error('[AuthStorage] Failed to save notes', error);
                throw error;
            }
        });
    }

    async loadNotesFromDatabase() {
        try {
            const response = await fetch('http://localhost:3001/api/notes', {
                headers: authManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('[AuthStorage] Notes loaded from database');
                return data.notes || [];
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load notes');
            }
        } catch (error) {
            Logger.error('[AuthStorage] Failed to load notes', error);
            throw error;
        }
    }

    // ====== CHAT METHODS ======

    async saveChats(chats) {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            this.queueForSync('chats', chats);
            throw new Error('Chats queued for sync when online');
        }
        
        return await this.saveChatsToDatabase(chats);
    }

    async loadChats() {
        this.ensureAuthenticated();
        
        if (!this.isOnline) {
            throw new Error('Internet connection required to load chats');
        }
        
        return await this.loadChatsFromDatabase();
    }

    async saveChatsToDatabase(chats) {
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/chats', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ chats })
                });

                if (response.ok) {
                    Logger.log('[AuthStorage] Chats saved to database');
                    return true;
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save chats');
                }
            } catch (error) {
                Logger.error('[AuthStorage] Failed to save chats', error);
                throw error;
            }
        });
    }

    async loadChatsFromDatabase() {
        try {
            const response = await fetch('http://localhost:3001/api/chats', {
                headers: authManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('[AuthStorage] Chats loaded from database');
                return data.chats || [];
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load chats');
            }
        } catch (error) {
            Logger.error('[AuthStorage] Failed to load chats', error);
            throw error;
        }
    }

    // ====== PENDING TASKS METHODS ======
    // Note: Pending tasks are temporary and can be stored in memory/session storage
    // They don't need to persist across sessions

    async savePendingTasks(pendingTasks) {
        // Store in session storage only (cleared when browser closes)
        try {
            sessionStorage.setItem('pending_tasks', JSON.stringify(pendingTasks));
            Logger.log('[AuthStorage] Pending tasks saved to session storage');
            return true;
        } catch (error) {
            Logger.error('[AuthStorage] Failed to save pending tasks', error);
            return false;
        }
    }

    async loadPendingTasks() {
        try {
            const savedPendingTasks = sessionStorage.getItem('pending_tasks');
            if (savedPendingTasks) {
                const pendingTasks = JSON.parse(savedPendingTasks);
                Logger.log('[AuthStorage] Pending tasks loaded from session storage');
                return pendingTasks || [];
            }
            return [];
        } catch (error) {
            Logger.error('[AuthStorage] Failed to load pending tasks', error);
            return [];
        }
    }

    // ====== SYNC METHODS ======

    queueForSync(type, data) {
        this.syncQueue.push({
            type,
            data,
            timestamp: Date.now()
        });
        Logger.log(`[AuthStorage] Queued ${type} for sync when online`);
    }

    async handleOnline() {
        this.isOnline = true;
        Logger.log('[AuthStorage] Connection restored, processing sync queue');
        
        if (this.syncQueue.length > 0 && authManager.isAuthenticated()) {
            await this.processSyncQueue();
        }
    }

    handleOffline() {
        this.isOnline = false;
        Logger.log('[AuthStorage] Connection lost, switching to offline mode');
    }

    async processSyncQueue() {
        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'tasks') {
                    await this.saveTasksToDatabase(item.data);
                } else if (item.type === 'notes') {
                    await this.saveNotesToDatabase(item.data);
                } else if (item.type === 'config') {
                    await this.saveConfigurationToDatabase(item.data);
                } else if (item.type === 'chats') {
                    await this.saveChatsToDatabase(item.data);
                }
                Logger.log(`[AuthStorage] Synced ${item.type} from queue`);
            } catch (error) {
                Logger.error(`[AuthStorage] Failed to sync ${item.type}`, error);
                // Re-queue failed items
                this.syncQueue.push(item);
            }
        }

        if (this.syncQueue.length === 0) {
            this.lastSyncTime = Date.now();
            Logger.log('[AuthStorage] All queued items synced successfully');
        }
    }

    // ====== UTILITY METHODS ======

    // Get sync status
    getSyncStatus() {
        return {
            mode: 'database-only',
            isOnline: this.isOnline,
            queuedItems: this.syncQueue.length,
            lastSyncTime: this.lastSyncTime,
            isAuthenticated: authManager.isAuthenticated()
        };
    }

    // Force sync (useful for manual sync buttons)
    async forceSync() {
        if (authManager.isAuthenticated() && this.isOnline) {
            await this.processSyncQueue();
            return true;
        }
        return false;
    }

    // Clear all session data (called on logout)
    clearSessionData() {
        try {
            // Clear session storage
            sessionStorage.clear();
            
            // Clear any temporary data
            this.syncQueue = [];
            this.lastSyncTime = null;
            
            Logger.log('[AuthStorage] Session data cleared');
        } catch (error) {
            Logger.error('[AuthStorage] Failed to clear session data', error);
        }
    }

    // ====== RATE LIMITING METHODS ======

    async throttledRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFn, resolve, reject });
            this.processRequestQueue();
        });
    }

    async processRequestQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        if (this.activeRequests >= this.maxConcurrentRequests) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.minRequestInterval) {
                const delay = this.minRequestInterval - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const { requestFn, resolve, reject } = this.requestQueue.shift();
            this.activeRequests++;
            this.lastRequestTime = Date.now();

            try {
                const result = await requestFn();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.activeRequests--;
            }

        } finally {
            this.isProcessingQueue = false;
            
            // Process next request if any
            if (this.requestQueue.length > 0) {
                setTimeout(() => this.processRequestQueue(), 100);
            }
        }
    }
}
