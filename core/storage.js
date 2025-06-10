// core/storage.js - LocalStorage Management

import { STORAGE_KEYS, Logger } from './config.js';

export class StorageManager {
    static saveConfiguration(onboardingData) {
        try {
            localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
            localStorage.setItem(STORAGE_KEYS.USER_NAME, onboardingData.userName);
            localStorage.setItem(STORAGE_KEYS.SERVICE_TYPE, onboardingData.service);
            localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, onboardingData.endpoint);
            localStorage.setItem(STORAGE_KEYS.API_KEY, onboardingData.apiKey);
            localStorage.setItem(STORAGE_KEYS.MODEL_NAME, onboardingData.model);
            
            if (onboardingData.nameVariations) {
                localStorage.setItem(STORAGE_KEYS.NAME_VARIATIONS, JSON.stringify(onboardingData.nameVariations));
            }
            
            Logger.log('Configuration saved successfully');
            return true;
        } catch (error) {
            Logger.error('Failed to save configuration', error);
            return false;
        }
    }

    static loadConfiguration() {
        try {
            const config = {
                hasCompletedOnboarding: localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true',
                userName: localStorage.getItem(STORAGE_KEYS.USER_NAME) || '',
                service: localStorage.getItem(STORAGE_KEYS.SERVICE_TYPE) || '',
                endpoint: localStorage.getItem(STORAGE_KEYS.API_ENDPOINT) || '',
                apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
                model: localStorage.getItem(STORAGE_KEYS.MODEL_NAME) || '',
                nameVariations: this.loadNameVariations(),
                systemPrompt: localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT),
                notesTitlePrompt: localStorage.getItem(STORAGE_KEYS.NOTES_TITLE_PROMPT),
                notesSummaryPrompt: localStorage.getItem(STORAGE_KEYS.NOTES_SUMMARY_PROMPT),
                notesTaskExtractionPrompt: localStorage.getItem(STORAGE_KEYS.NOTES_TASK_EXTRACTION_PROMPT)
            };

            Logger.log('Configuration loaded successfully', { 
                userName: config.userName, 
                service: config.service,
                nameVariations: config.nameVariations 
            });
            
            return config;
        } catch (error) {
            Logger.error('Failed to load configuration', error);
            return null;
        }
    }

    static loadNameVariations() {
        try {
            const savedVariations = localStorage.getItem(STORAGE_KEYS.NAME_VARIATIONS);
            if (savedVariations) {
                return JSON.parse(savedVariations);
            }
            return null;
        } catch (error) {
            Logger.warn('Failed to load name variations', error);
            return null;
        }
    }

    static saveNameVariations(variations) {
        try {
            localStorage.setItem(STORAGE_KEYS.NAME_VARIATIONS, JSON.stringify(variations));
            Logger.log('Name variations saved', { variations });
            return true;
        } catch (error) {
            Logger.error('Failed to save name variations', error);
            return false;
        }
    }

    static saveTasks(tasks) {
        try {
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            Logger.log('Tasks saved to localStorage');
            return true;
        } catch (error) {
            Logger.error('Failed to save tasks', error);
            return false;
        }
    }

    static loadTasks() {
        try {
            const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
            if (savedTasks) {
                const tasks = JSON.parse(savedTasks);
                return this.migrateTasks(tasks);
            }
            return [];
        } catch (error) {
            Logger.error('Failed to load tasks', error);
            return [];
        }
    }

    static migrateTasks(tasks) {
        return tasks.map(task => {
            // Ensure all required fields exist
            if (!task.id) task.id = Date.now().toString() + Math.random();
            if (!task.createdAt) task.createdAt = new Date().toISOString();
            if (!task.date) task.date = new Date().toISOString().split('T')[0];
            if (!task.type) task.type = 'quick';
            
            return task;
        });
    }

    static saveSystemPrompt(prompt) {
        try {
            localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
            Logger.log('System prompt saved');
            return true;
        } catch (error) {
            Logger.error('Failed to save system prompt', error);
            return false;
        }
    }

    static saveNotesTitlePrompt(prompt) {
        try {
            localStorage.setItem(STORAGE_KEYS.NOTES_TITLE_PROMPT, prompt);
            Logger.log('Notes title prompt saved');
            return true;
        } catch (error) {
            Logger.error('Failed to save notes title prompt', error);
            return false;
        }
    }

    static saveNotesSummaryPrompt(prompt) {
        try {
            localStorage.setItem(STORAGE_KEYS.NOTES_SUMMARY_PROMPT, prompt);
            Logger.log('Notes summary prompt saved');
            return true;
        } catch (error) {
            Logger.error('Failed to save notes summary prompt', error);
            return false;
        }
    }

    static saveNotesTaskExtractionPrompt(prompt) {
        try {
            localStorage.setItem(STORAGE_KEYS.NOTES_TASK_EXTRACTION_PROMPT, prompt);
            Logger.log('Notes task extraction prompt saved');
            return true;
        } catch (error) {
            Logger.error('Failed to save notes task extraction prompt', error);
            return false;
        }
    }

    static clearAll() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            Logger.log('All storage cleared');
            return true;
        } catch (error) {
            Logger.error('Failed to clear storage', error);
            return false;
        }
    }

    static clearAIConfig() {
        try {
            // Clear only AI-related configuration, keep tasks and notes
            const aiConfigKeys = [
                STORAGE_KEYS.ONBOARDING_COMPLETED,
                STORAGE_KEYS.USER_NAME,
                STORAGE_KEYS.SERVICE_TYPE,
                STORAGE_KEYS.API_ENDPOINT,
                STORAGE_KEYS.API_KEY,
                STORAGE_KEYS.MODEL_NAME,
                STORAGE_KEYS.NAME_VARIATIONS,
                STORAGE_KEYS.SYSTEM_PROMPT
            ];
            
            aiConfigKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            Logger.log('AI configuration cleared, tasks and notes preserved');
            return true;
        } catch (error) {
            Logger.error('Failed to clear AI configuration', error);
            return false;
        }
    }

    static updateUserName(newName) {
        try {
            localStorage.setItem(STORAGE_KEYS.USER_NAME, newName);
            Logger.log('User name updated', { newName });
            return true;
        } catch (error) {
            Logger.error('Failed to update user name', error);
            return false;
        }
    }

    // Notes Management
    static saveNotes(notes) {
        try {
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
            Logger.log('Notes saved to localStorage');
            return true;
        } catch (error) {
            Logger.error('Failed to save notes', error);
            return false;
        }
    }

    static loadNotes() {
        try {
            const savedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
            if (savedNotes) {
                const notes = JSON.parse(savedNotes);
                return this.migrateNotes(notes);
            }
            return [];
        } catch (error) {
            Logger.error('Failed to load notes', error);
            return [];
        }
    }

    // Pending Tasks Management
    static savePendingTasks(pendingTasks) {
        try {
            localStorage.setItem(STORAGE_KEYS.PENDING_TASKS, JSON.stringify(pendingTasks));
            Logger.log('Pending tasks saved to localStorage');
            return true;
        } catch (error) {
            Logger.error('Failed to save pending tasks', error);
            return false;
        }
    }

    static loadPendingTasks() {
        try {
            const savedPendingTasks = localStorage.getItem(STORAGE_KEYS.PENDING_TASKS);
            if (savedPendingTasks) {
                const pendingTasks = JSON.parse(savedPendingTasks);
                return this.migratePendingTasks(pendingTasks);
            }
            return [];
        } catch (error) {
            Logger.error('Failed to load pending tasks', error);
            return [];
        }
    }

    static migratePendingTasks(pendingTasks) {
        return pendingTasks.map(task => {
            // Ensure all required fields exist
            if (!task.id) task.id = 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            if (!task.createdAt) task.createdAt = new Date().toISOString();
            if (!task.confidence) task.confidence = 0.5;
            if (!task.sourceNoteId) task.sourceNoteId = null;
            if (!task.status) task.status = 'pending';
            
            return task;
        });
    }

    static migrateNotes(notes) {
        return notes.map(note => {
            // Ensure all required fields exist
            if (!note.id) note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            if (!note.createdAt) note.createdAt = new Date().toISOString();
            if (!note.modifiedAt) note.modifiedAt = note.createdAt;
            if (!note.title) note.title = 'Untitled Note';
            if (!note.content) note.content = '';
            if (!note.tags) note.tags = [];
            if (!note.summary) note.summary = '';
            if (!note.extractedTasks) note.extractedTasks = [];
            if (note.aiProcessed === undefined) note.aiProcessed = false;
            
            return note;
        });
    }
}
