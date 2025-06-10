// core/hybridStorage.js - Hybrid Storage Manager (localStorage + Database)

import { StorageManager } from './storage.js';
import { Logger } from './config.js';

export class HybridStorageManager {
    constructor(authUI) {
        this.authUI = authUI;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.lastSyncTime = null;
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    // Determine which storage method to use
    getStorageMode() {
        return this.authUI && this.authUI.isAuthenticated() ? 'database' : 'localStorage';
    }

    // ====== CONFIGURATION METHODS ======

    async saveConfiguration(onboardingData) {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.saveConfigurationToDatabase(onboardingData);
        } else {
            return StorageManager.saveConfiguration(onboardingData);
        }
    }

    async loadConfiguration() {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.loadConfigurationFromDatabase();
        } else {
            return StorageManager.loadConfiguration();
        }
    }

    async saveConfigurationToDatabase(onboardingData) {
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: this.authUI.getAuthHeaders(),
                body: JSON.stringify({ config: onboardingData })
            });

            if (response.ok) {
                Logger.log('Configuration saved to database');
                return true;
            } else {
                Logger.error('Failed to save configuration to database');
                // Fallback to localStorage
                return StorageManager.saveConfiguration(onboardingData);
            }
        } catch (error) {
            Logger.error('Database save error, falling back to localStorage', error);
            return StorageManager.saveConfiguration(onboardingData);
        }
    }

    async loadConfigurationFromDatabase() {
        try {
            const response = await fetch('/api/config', {
                headers: this.authUI.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('Configuration loaded from database');
                return data.config;
            } else {
                Logger.error('Failed to load configuration from database');
                return StorageManager.loadConfiguration();
            }
        } catch (error) {
            Logger.error('Database load error, falling back to localStorage', error);
            return StorageManager.loadConfiguration();
        }
    }

    // ====== TASK METHODS ======

    async saveTasks(tasks) {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.saveTasksToDatabase(tasks);
        } else {
            const success = StorageManager.saveTasks(tasks);
            if (mode === 'database' && !this.isOnline) {
                this.queueForSync('tasks', tasks);
            }
            return success;
        }
    }

    async loadTasks() {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.loadTasksFromDatabase();
        } else {
            return StorageManager.loadTasks();
        }
    }

    async saveTasksToDatabase(tasks) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: this.authUI.getAuthHeaders(),
                body: JSON.stringify({ tasks })
            });

            if (response.ok) {
                Logger.log('Tasks saved to database');
                return true;
            } else {
                Logger.error('Failed to save tasks to database');
                return StorageManager.saveTasks(tasks);
            }
        } catch (error) {
            Logger.error('Database save error, falling back to localStorage', error);
            return StorageManager.saveTasks(tasks);
        }
    }

    async loadTasksFromDatabase() {
        try {
            const response = await fetch('/api/tasks', {
                headers: this.authUI.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('Tasks loaded from database');
                return data.tasks || [];
            } else {
                Logger.error('Failed to load tasks from database');
                return StorageManager.loadTasks();
            }
        } catch (error) {
            Logger.error('Database load error, falling back to localStorage', error);
            return StorageManager.loadTasks();
        }
    }

    // ====== NOTES METHODS ======

    async saveNotes(notes) {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.saveNotesToDatabase(notes);
        } else {
            const success = StorageManager.saveNotes(notes);
            if (mode === 'database' && !this.isOnline) {
                this.queueForSync('notes', notes);
            }
            return success;
        }
    }

    async loadNotes() {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            return await this.loadNotesFromDatabase();
        } else {
            return StorageManager.loadNotes();
        }
    }

    async saveNotesToDatabase(notes) {
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: this.authUI.getAuthHeaders(),
                body: JSON.stringify({ notes })
            });

            if (response.ok) {
                Logger.log('Notes saved to database');
                return true;
            } else {
                Logger.error('Failed to save notes to database');
                return StorageManager.saveNotes(notes);
            }
        } catch (error) {
            Logger.error('Database save error, falling back to localStorage', error);
            return StorageManager.saveNotes(notes);
        }
    }

    async loadNotesFromDatabase() {
        try {
            const response = await fetch('/api/notes', {
                headers: this.authUI.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Logger.log('Notes loaded from database');
                return data.notes || [];
            } else {
                Logger.error('Failed to load notes from database');
                return StorageManager.loadNotes();
            }
        } catch (error) {
            Logger.error('Database load error, falling back to localStorage', error);
            return StorageManager.loadNotes();
        }
    }

    // ====== PENDING TASKS METHODS ======

    async savePendingTasks(pendingTasks) {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            // For now, pending tasks still use localStorage even in database mode
            // This can be extended later if needed
            return StorageManager.savePendingTasks(pendingTasks);
        } else {
            return StorageManager.savePendingTasks(pendingTasks);
        }
    }

    async loadPendingTasks() {
        const mode = this.getStorageMode();
        
        if (mode === 'database' && this.isOnline) {
            // For now, pending tasks still use localStorage even in database mode
            return StorageManager.loadPendingTasks();
        } else {
            return StorageManager.loadPendingTasks();
        }
    }

    // ====== SYNC METHODS ======

    queueForSync(type, data) {
        this.syncQueue.push({
            type,
            data,
            timestamp: Date.now()
        });
        Logger.log(`Queued ${type} for sync when online`);
    }

    async handleOnline() {
        this.isOnline = true;
        Logger.log('Connection restored, processing sync queue');
        
        if (this.syncQueue.length > 0 && this.authUI.isAuthenticated()) {
            await this.processSyncQueue();
        }
    }

    handleOffline() {
        this.isOnline = false;
        Logger.log('Connection lost, switching to offline mode');
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
                }
                Logger.log(`Synced ${item.type} from queue`);
            } catch (error) {
                Logger.error(`Failed to sync ${item.type}`, error);
                // Re-queue failed items
                this.syncQueue.push(item);
            }
        }

        if (this.syncQueue.length === 0) {
            this.lastSyncTime = Date.now();
            Logger.log('All queued items synced successfully');
        }
    }

    // ====== MIGRATION METHODS ======

    async migrateLocalDataToDatabase() {
        if (!this.authUI.isAuthenticated()) {
            throw new Error('User must be authenticated to migrate data');
        }

        try {
            // Load all local data
            const localTasks = StorageManager.loadTasks();
            const localNotes = StorageManager.loadNotes();
            const localConfig = StorageManager.loadConfiguration();

            // Prepare migration data
            const migrationData = {
                tasks: localTasks,
                notes: localNotes,
                configuration: localConfig
            };

            // Send to migration endpoint
            const response = await fetch('/api/migrate/import', {
                method: 'POST',
                headers: this.authUI.getAuthHeaders(),
                body: JSON.stringify(migrationData)
            });

            if (response.ok) {
                const result = await response.json();
                Logger.log('Data migration successful', result);
                
                // Optionally clear local data after successful migration
                // StorageManager.clearAll();
                
                return {
                    success: true,
                    imported: result.imported,
                    message: result.message
                };
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Migration failed');
            }
        } catch (error) {
            Logger.error('Data migration failed', error);
            throw error;
        }
    }

    // ====== UTILITY METHODS ======

    // Delegate other methods to StorageManager for backward compatibility
    saveNameVariations(variations) {
        return StorageManager.saveNameVariations(variations);
    }

    loadNameVariations() {
        return StorageManager.loadNameVariations();
    }

    saveSystemPrompt(prompt) {
        return StorageManager.saveSystemPrompt(prompt);
    }

    saveNotesTitlePrompt(prompt) {
        return StorageManager.saveNotesTitlePrompt(prompt);
    }

    saveNotesSummaryPrompt(prompt) {
        return StorageManager.saveNotesSummaryPrompt(prompt);
    }

    saveNotesTaskExtractionPrompt(prompt) {
        return StorageManager.saveNotesTaskExtractionPrompt(prompt);
    }

    clearAll() {
        return StorageManager.clearAll();
    }

    clearAIConfig() {
        return StorageManager.clearAIConfig();
    }

    updateUserName(newName) {
        return StorageManager.updateUserName(newName);
    }

    // Get sync status
    getSyncStatus() {
        return {
            mode: this.getStorageMode(),
            isOnline: this.isOnline,
            queuedItems: this.syncQueue.length,
            lastSyncTime: this.lastSyncTime,
            isAuthenticated: this.authUI ? this.authUI.isAuthenticated() : false
        };
    }

    // Force sync (useful for manual sync buttons)
    async forceSync() {
        if (this.authUI.isAuthenticated() && this.isOnline) {
            await this.processSyncQueue();
            return true;
        }
        return false;
    }
}
