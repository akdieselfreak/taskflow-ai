// core/hybridStorage.js - Hybrid Storage Manager (localStorage + Database)

import { StorageManager } from './storage.js';
import { Logger } from './config.js';
import { authManager } from './authManager.js';

export class HybridStorageManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.lastSyncTime = null;
        this.lastDataHash = {
            tasks: null,
            notes: null,
            config: null
        };
        this.pendingSaves = new Set();
        
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
        
        // Listen for auth state changes
        authManager.onAuthStateChange((isLoggedIn, user) => {
            Logger.log('[HybridStorage] Auth state changed', { isLoggedIn, user });
            if (isLoggedIn) {
                // User logged in - sync local data to server
                this.syncLocalDataToServer();
            }
        });
        
        // Start periodic sync check
        this.startPeriodicSyncCheck();
    }

    // Determine which storage method to use
    getStorageMode() {
        const isAuthenticated = authManager.isAuthenticated();
        const mode = isAuthenticated ? 'database' : 'localStorage';
        
        Logger.log(`Storage mode determined: ${mode}`, {
            isAuthenticated: isAuthenticated,
            authToken: authManager.getAuthToken() ? 'present' : 'missing',
            user: authManager.getCurrentUser()
        });
        
        return mode;
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
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ config: onboardingData })
                });

                if (response.ok) {
                    Logger.log('Configuration saved to database');
                    return true;
                } else if (response.status === 429) {
                    Logger.warn('Rate limited, falling back to localStorage for config');
                    return StorageManager.saveConfiguration(onboardingData);
                } else {
                    Logger.error('Failed to save configuration to database');
                    return StorageManager.saveConfiguration(onboardingData);
                }
            } catch (error) {
                Logger.error('Database save error, falling back to localStorage', error);
                return StorageManager.saveConfiguration(onboardingData);
            }
        });
    }

    async loadConfigurationFromDatabase() {
        try {
            const response = await fetch('/api/config', {
                headers: authManager.getAuthHeaders()
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
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ tasks })
                });

                if (response.ok) {
                    Logger.log('Tasks saved to database');
                    return true;
                } else if (response.status === 429) {
                    Logger.warn('Rate limited, falling back to localStorage');
                    return StorageManager.saveTasks(tasks);
                } else {
                    Logger.error('Failed to save tasks to database');
                    return StorageManager.saveTasks(tasks);
                }
            } catch (error) {
                Logger.error('Database save error, falling back to localStorage', error);
                return StorageManager.saveTasks(tasks);
            }
        });
    }

    async loadTasksFromDatabase() {
        try {
            const response = await fetch('/api/tasks', {
                headers: authManager.getAuthHeaders()
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
        return await this.throttledRequest(async () => {
            try {
                const response = await fetch('/api/notes', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({ notes })
                });

                if (response.ok) {
                    Logger.log('Notes saved to database');
                    return true;
                } else if (response.status === 429) {
                    Logger.warn('Rate limited, falling back to localStorage for notes');
                    return StorageManager.saveNotes(notes);
                } else {
                    Logger.error('Failed to save notes to database');
                    return StorageManager.saveNotes(notes);
                }
            } catch (error) {
                Logger.error('Database save error, falling back to localStorage', error);
                return StorageManager.saveNotes(notes);
            }
        });
    }

    async loadNotesFromDatabase() {
        try {
            const response = await fetch('/api/notes', {
                headers: authManager.getAuthHeaders()
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
        
        if (this.syncQueue.length > 0 && authManager.isAuthenticated()) {
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
        if (!authManager.isAuthenticated()) {
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
                headers: authManager.getAuthHeaders(),
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

    // New method to sync local data to server when user logs in
    async syncLocalDataToServer() {
        if (!authManager.isAuthenticated()) {
            Logger.log('[HybridStorage] Cannot sync - user not authenticated');
            return;
        }

        try {
            Logger.log('[HybridStorage] Syncing local data to server after login');
            
            // Check if there's local data that needs syncing
            const localTasks = StorageManager.loadTasks();
            const localNotes = StorageManager.loadNotes();
            const localConfig = StorageManager.loadConfiguration();
            
            if (localTasks.length > 0 || localNotes.length > 0 || localConfig) {
                Logger.log('[HybridStorage] Found local data, syncing to server', {
                    tasks: localTasks.length,
                    notes: localNotes.length,
                    hasConfig: !!localConfig
                });
                
                // Sync tasks
                if (localTasks.length > 0) {
                    await this.saveTasksToDatabase(localTasks);
                }
                
                // Sync notes
                if (localNotes.length > 0) {
                    await this.saveNotesToDatabase(localNotes);
                }
                
                // Sync configuration
                if (localConfig) {
                    await this.saveConfigurationToDatabase(localConfig);
                }
                
                Logger.log('[HybridStorage] Local data synced to server successfully');
            } else {
                Logger.log('[HybridStorage] No local data to sync');
            }
        } catch (error) {
            Logger.error('[HybridStorage] Failed to sync local data to server', error);
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

    // ====== ENHANCED PERIODIC SYNC METHODS ======

    startPeriodicSyncCheck() {
        // Check every 60 seconds for unsaved changes (reduced frequency)
        setInterval(() => {
            this.checkForUnsavedChanges();
        }, 60000);

        // Full sync check every 5 minutes (reduced frequency)
        setInterval(() => {
            this.performPeriodicSync();
        }, 300000);

        Logger.log('Periodic sync checks started');
    }

    async checkForUnsavedChanges() {
        if (!authManager.isAuthenticated() || !this.isOnline) {
            return;
        }

        try {
            // Check if there are any pending saves
            if (this.pendingSaves.size > 0) {
                Logger.log('Detected pending saves, attempting to sync');
                await this.processSyncQueue();
            }

            // Check for data changes by comparing hashes
            const currentTasks = StorageManager.loadTasks();
            const currentNotes = StorageManager.loadNotes();
            const currentConfig = StorageManager.loadConfiguration();

            const tasksHash = this.generateDataHash(currentTasks);
            const notesHash = this.generateDataHash(currentNotes);
            const configHash = this.generateDataHash(currentConfig);

            let hasChanges = false;

            if (this.lastDataHash.tasks !== tasksHash) {
                Logger.log('Tasks changed, syncing to database');
                await this.saveTasksToDatabase(currentTasks);
                this.lastDataHash.tasks = tasksHash;
                hasChanges = true;
            }

            if (this.lastDataHash.notes !== notesHash) {
                Logger.log('Notes changed, syncing to database');
                await this.saveNotesToDatabase(currentNotes);
                this.lastDataHash.notes = notesHash;
                hasChanges = true;
            }

            if (this.lastDataHash.config !== configHash) {
                Logger.log('Configuration changed, syncing to database');
                await this.saveConfigurationToDatabase(currentConfig);
                this.lastDataHash.config = configHash;
                hasChanges = true;
            }

            if (hasChanges) {
                this.lastSyncTime = Date.now();
                Logger.log('Periodic sync completed - changes detected and saved');
            }

        } catch (error) {
            Logger.error('Periodic sync check failed', error);
        }
    }

    async performPeriodicSync() {
        if (!authManager.isAuthenticated() || !this.isOnline) {
            return;
        }

        try {
            Logger.log('Performing periodic full sync check');
            
            // Process any queued items
            if (this.syncQueue.length > 0) {
                await this.processSyncQueue();
            }

            // Check for server-side changes and sync down
            await this.syncFromServer();

        } catch (error) {
            Logger.error('Periodic full sync failed', error);
        }
    }

    async syncFromServer() {
        try {
            // Load latest data from server
            const serverTasks = await this.loadTasksFromDatabase();
            const serverNotes = await this.loadNotesFromDatabase();
            const serverConfig = await this.loadConfigurationFromDatabase();

            // Compare with local data
            const localTasks = StorageManager.loadTasks();
            const localNotes = StorageManager.loadNotes();
            const localConfig = StorageManager.loadConfiguration();

            let hasServerChanges = false;

            // Check if server has newer data
            if (this.hasNewerData(serverTasks, localTasks)) {
                Logger.log('Server has newer tasks, updating local storage');
                StorageManager.saveTasks(serverTasks);
                hasServerChanges = true;
            }

            if (this.hasNewerData(serverNotes, localNotes)) {
                Logger.log('Server has newer notes, updating local storage');
                StorageManager.saveNotes(serverNotes);
                hasServerChanges = true;
            }

            if (hasServerChanges) {
                // Trigger UI refresh
                window.dispatchEvent(new CustomEvent('dataUpdatedFromServer', {
                    detail: { tasks: serverTasks, notes: serverNotes }
                }));
                Logger.log('Local data updated from server');
            }

        } catch (error) {
            Logger.error('Failed to sync from server', error);
        }
    }

    generateDataHash(data) {
        // Simple hash function for change detection
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    hasNewerData(serverData, localData) {
        // Simple comparison - in a real app you'd use timestamps
        if (!serverData || !localData) return false;
        
        // Compare array lengths and modification times if available
        if (Array.isArray(serverData) && Array.isArray(localData)) {
            if (serverData.length !== localData.length) return true;
            
            // Check for newer modification times
            for (let i = 0; i < serverData.length; i++) {
                const serverItem = serverData[i];
                const localItem = localData.find(item => item.id === serverItem.id);
                
                if (!localItem) return true;
                
                if (serverItem.modifiedAt && localItem.modifiedAt) {
                    if (new Date(serverItem.modifiedAt) > new Date(localItem.modifiedAt)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    // Mark data as having pending saves
    markPendingSave(type) {
        this.pendingSaves.add(type);
        Logger.log(`Marked ${type} as pending save`);
    }

    // Clear pending save marker
    clearPendingSave(type) {
        this.pendingSaves.delete(type);
        Logger.log(`Cleared pending save for ${type}`);
    }

    // Get detailed sync status
    getDetailedSyncStatus() {
        return {
            mode: this.getStorageMode(),
            isOnline: this.isOnline,
            isAuthenticated: authManager.isAuthenticated(),
            queuedItems: this.syncQueue.length,
            pendingSaves: Array.from(this.pendingSaves),
            lastSyncTime: this.lastSyncTime,
            lastDataHashes: this.lastDataHash,
            syncQueueDetails: this.syncQueue.map(item => ({
                type: item.type,
                timestamp: new Date(item.timestamp).toISOString(),
                age: Date.now() - item.timestamp
            }))
        };
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
