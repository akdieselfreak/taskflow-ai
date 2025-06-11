// main.js - Complete Enhanced Main Application Entry Point

import { CONFIG, Logger } from './core/config.js';
import { AppState } from './core/state.js';

// Core Systems
import { authManager } from './core/authManager.js';
import { AuthStorageManager } from './core/authStorage.js';

// Services
import { OllamaService } from './services/ollamaService.js';
import { OpenAIService } from './services/openaiService.js';
import { OpenWebUIService } from './services/openwebuiService.js';

// Features
import { NameVariationsManager } from './features/nameVariations.js';
import { TaskExtractionManager } from './features/taskExtraction.js';
import { DataManager } from './features/dataManager.js';
import { NotesManager } from './features/notesManager.js';
import { ChatManager } from './features/chatManager.js';

// UI Components
import { OnboardingManager } from './ui/onboarding.js';
import { ModalManager } from './ui/modals.js';
import { TaskRenderer } from './ui/rendering.js';
import { NotificationManager } from './ui/notifications.js';
import { DataManagerUI, enhanceModalManagerWithDataManagement } from './ui/dataManagerUI.js';
import { NotesRenderer } from './ui/notesRenderer.js';
import { NotesModalManager } from './ui/notesModals.js';
import { AuthUI } from './ui/authUI.js';
import { ChatUI } from './ui/chatUI.js';

class TaskFlowApp {
    constructor() {
        this.appState = new AppState();
        this.aiService = null;
        this.notifications = new NotificationManager();
        
        // Initialize storage system (database-only, requires authentication)
        this.authStorage = new AuthStorageManager();
        
        // Keep AuthUI for backward compatibility with existing modals
        this.authUI = new AuthUI();
        
        // Initialize managers
        this.nameVariationsManager = null;
        this.taskExtractionManager = null;
        this.onboardingManager = null;
        this.modalManager = null;
        this.taskRenderer = null;
        this.dataManager = null;
        this.notesManager = null;
        this.notesRenderer = null;
        this.notesModalManager = null;
        this.chatManager = null;
        this.chatUI = null;
        this.currentTab = 'tasks';
        
        // Performance & Accessibility features (integrated)
        this.keyboardNav = null;
        this.errorBoundary = null;
        this.focusableElements = [];
        this.currentFocusIndex = -1;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // Auto-save interval
        this.autoSaveInterval = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            renderTimes: [],
            aiRequestTimes: []
        };
    }

    async initialize() {
        const startTime = performance.now();
        
        try {
            Logger.log('Initializing Enhanced TaskFlow AI');
            
            // Setup error boundary first
            this.setupErrorBoundary();
            
            // Set up authentication state change handler
            authManager.onAuthStateChange((isLoggedIn, user) => {
                Logger.log('Auth state changed in main app', { isLoggedIn, user });
                this.handleAuthStateChange(isLoggedIn, user);
            });
            
            // Set up logout handler
            authManager.onLogout(() => {
                Logger.log('Logout triggered in main app');
                this.handleLogout();
            });
            
            // Initialize AuthUI for backward compatibility (modals, etc.)
            await this.authUI.init();
            
            // Sync AuthUI with centralized auth manager
            this.syncAuthUIWithAuthManager();
            
            // Listen for server data updates
            window.addEventListener('dataUpdatedFromServer', (event) => {
                Logger.log('Data updated from server, refreshing UI', event.detail);
                
                // Update app state with server data
                if (event.detail.tasks) {
                    this.appState.setTasks(event.detail.tasks);
                }
                if (event.detail.notes) {
                    this.appState.setNotes(event.detail.notes);
                }
                if (event.detail.chats) {
                    this.appState.setChats(event.detail.chats);
                }
                
                // Refresh UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
                if (this.notesRenderer) {
                    this.notesRenderer.refresh();
                }
                if (this.chatUI) {
                    this.chatUI.refreshChatList();
                }
                
                // Show notification
                this.notifications.showInfo('Data synchronized from server');
            });
            
            // Wait for auth manager to initialize and verify token
            await authManager.init();
            
            // Give auth manager more time to complete token verification
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if user is authenticated after initialization
            if (!authManager.isAuthenticated()) {
                Logger.log('User not authenticated after init, showing authentication');
                this.initializeOnboarding();
            } else {
                Logger.log('User is authenticated, loading configuration');
                // Load configuration and determine app state
                try {
                    const config = await this.authStorage.loadConfiguration();
                    
                    if (config && (config.hasCompletedOnboarding || this.hasValidAIConfiguration(config))) {
                        // User has completed onboarding or has valid AI configuration
                        if (!config.hasCompletedOnboarding) {
                            config.hasCompletedOnboarding = true;
                            await this.authStorage.saveConfiguration(config);
                        }
                        Logger.log('Loading main app with existing configuration');
                        await this.initializeMainApp(config);
                    } else {
                        Logger.log('No valid configuration found, showing onboarding (authenticated user)');
                        this.initializeOnboarding();
                    }
                } catch (error) {
                    Logger.error('Failed to load configuration, showing onboarding', error);
                    this.initializeOnboarding();
                }
            }
            
            // Initialize enhancements
            this.setupKeyboardNavigation();
            this.setupAccessibility();
            this.setupKeyboardShortcuts();
            this.setupEventListeners();
            
            const initTime = performance.now() - startTime;
            Logger.log(`Enhanced TaskFlow AI initialized successfully in ${initTime.toFixed(2)}ms`);
            
        } catch (error) {
            Logger.error('Failed to initialize Enhanced TaskFlow AI', error);
            this.showCriticalError(error);
        }
    }

    // Sync AuthUI with centralized auth manager for backward compatibility
    syncAuthUIWithAuthManager() {
        if (authManager.isAuthenticated()) {
            this.authUI.authToken = authManager.getAuthToken();
            this.authUI.currentUser = authManager.getCurrentUser();
            this.authUI.isLoggedIn = true;
            
            // Update the UI to reflect authenticated state
            const accountStatusElement = document.querySelector('.account-status');
            if (accountStatusElement) {
                accountStatusElement.classList.remove('guest');
                accountStatusElement.classList.add('authenticated');
            }
            
            // Hide all sign in buttons in the UI
            document.querySelectorAll('.account-actions .btn-primary').forEach(button => {
                if (button.textContent.includes('Sign In') || button.textContent.includes('Create Account')) {
                    button.style.display = 'none';
                }
            });
            
            // Update header to show user's name
            const userGreeting = document.getElementById('userGreeting');
            if (userGreeting && this.appState.onboardingData && this.appState.onboardingData.userName) {
                userGreeting.textContent = this.appState.onboardingData.userName;
            } else if (userGreeting && this.authUI.currentUser) {
                userGreeting.textContent = this.authUI.currentUser.username || 'User';
            }
            
            // Hide onboarding overlay and show main app
            const onboardingOverlay = document.getElementById('onboardingOverlay');
            const mainApp = document.getElementById('mainApp');
            
            if (onboardingOverlay) {
                onboardingOverlay.style.display = 'none';
            }
            
            if (mainApp) {
                mainApp.style.display = 'block';
            }
            
            Logger.log('AuthUI synced with centralized auth manager', {
                user: this.authUI.currentUser,
                isLoggedIn: this.authUI.isLoggedIn
            });
        }
    }

    async initializeMainApp(config) {
        const startTime = performance.now();
        
        // Initialize AI service
        this.aiService = this.createAIService(config);
        
        // Set app state
        this.appState.setOnboardingData(config);
        
        // Initialize feature managers
        this.nameVariationsManager = new NameVariationsManager(this.appState, this.aiService);
        this.taskExtractionManager = new TaskExtractionManager(
            this.appState, 
            this.aiService, 
            this.nameVariationsManager
        );
        
        // Initialize Data Manager
        this.dataManager = new DataManager(this.appState, this.notifications);
        
        // Initialize Notes Manager
        this.notesManager = new NotesManager(
            this.appState, 
            this.aiService, 
            this.taskExtractionManager, 
            this.notifications
        );
        
        // Initialize Chat Manager
        this.chatManager = new ChatManager(
            this.appState,
            this.aiService,
            this.notifications
        );
        
        // Initialize UI managers
        this.modalManager = new ModalManager(this.appState, {
            taskExtraction: this.taskExtractionManager,
            nameVariations: this.nameVariationsManager,
            notifications: this.notifications
        });
        
        // Initialize Data Manager UI (after modalManager is created)
        this.dataManagerUI = new DataManagerUI(this.dataManager, this.modalManager, this.notifications);
        
        // Enhance modal manager with data management
        enhanceModalManagerWithDataManagement(this.modalManager, this.dataManager);
        
        this.taskRenderer = new TaskRenderer(this.appState);
        this.notesRenderer = new NotesRenderer(this.appState, this.notesManager);
        this.notesModalManager = new NotesModalManager(this.appState, this.notesManager, this.notifications);
        
        // Initialize Chat UI
        this.chatUI = new ChatUI(this.appState, this.chatManager, this.notifications);
        
        // Setup performance monitoring for task renderer
        this.setupPerformanceMonitoring();
        
        // Setup global modal functions
        this.modalManager.setupGlobalModalFunctions(this);
        
        // Load tasks, notes, chats, and pending tasks
        const tasks = await this.authStorage.loadTasks();
        const notes = await this.authStorage.loadNotes();
        const chats = await this.authStorage.loadChats();
        const pendingTasks = await this.authStorage.loadPendingTasks();
        this.appState.setTasks(tasks);
        this.appState.setNotes(notes);
        this.appState.setChats(chats);
        this.appState.setPendingTasks(pendingTasks);
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Show main app
        this.showMainApp();
        
    // Setup global functions now that all managers are initialized
    setupGlobalFunctions(this);
    
    // Make sure the chat system prompt functions are available
    window.saveChatPrompt = () => {
        if (this.modalManager) {
            this.modalManager.saveChatPrompt();
        }
    };
    
    window.resetChatPrompt = () => {
        if (this.modalManager) {
            this.modalManager.resetChatPrompt();
        }
    };
        
        const initTime = performance.now() - startTime;
        Logger.log(`Main app initialized in ${initTime.toFixed(2)}ms`, this.appState.getDebugInfo());
    }

    initializeOnboarding() {
        this.onboardingManager = new OnboardingManager(this.appState, {
            notifications: this.notifications,
            onComplete: (config) => this.completeOnboarding(config)
        });
        
        this.showOnboarding();
        Logger.log('Onboarding initialized');
    }

    createAIService(config) {
        const serviceConfig = {
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            model: config.model,
            service: config.service,
            nameVariations: config.nameVariations
        };

        switch (config.service) {
            case 'ollama':
                return new OllamaService(serviceConfig);
            case 'openai':
                return new OpenAIService(serviceConfig);
            case 'openwebui':
                return new OpenWebUIService({
                    ...serviceConfig,
                    fallbackEndpoint: config.fallbackEndpoint
                });
            default:
                throw new Error(`Unknown AI service: ${config.service}`);
        }
    }

    async completeOnboarding(config) {
        try {
            // Extract only the configuration fields needed for the database
            const configToSave = {
                service: config.service,
                endpoint: config.endpoint,
                apiKey: config.apiKey || '',
                model: config.model,
                nameVariations: config.nameVariations || [],
                userName: config.userName,
                hasCompletedOnboarding: true,
                // Include optional fields if they exist
                ...(config.fallbackEndpoint && { fallbackEndpoint: config.fallbackEndpoint }),
                ...(config.systemPrompt && { systemPrompt: config.systemPrompt }),
                ...(config.notesTitlePrompt && { notesTitlePrompt: config.notesTitlePrompt }),
                ...(config.notesSummaryPrompt && { notesSummaryPrompt: config.notesSummaryPrompt }),
                ...(config.notesTaskExtractionPrompt && { notesTaskExtractionPrompt: config.notesTaskExtractionPrompt }),
                ...(config.chatSystemPrompt && { chatSystemPrompt: config.chatSystemPrompt })
            };
            
            Logger.log('Saving configuration to database', configToSave);
            
            // Save configuration using auth storage (requires authentication)
            const saved = await this.authStorage.saveConfiguration(configToSave);
            if (!saved) {
                throw new Error('Failed to save configuration');
            }
            
            // Mark the full config as completed for app initialization
            config.hasCompletedOnboarding = true;
            
            // Initialize main app
            await this.initializeMainApp(config);
            
            this.notifications.showSuccess('Setup complete! Welcome to TaskFlow AI.');
            Logger.log('Onboarding completed successfully');
            
        } catch (error) {
            Logger.error('Failed to complete onboarding', error);
            this.notifications.showError('Failed to save configuration. Please try again.');
        }
    }

    showMainApp() {
        document.getElementById('onboardingOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('userGreeting').textContent = this.appState.onboardingData.userName;
        
        // Render tasks
        if (this.taskRenderer) {
            this.taskRenderer.renderAll();
        }
        
        // Initialize chat UI
        if (this.chatUI) {
            this.chatUI.initialize();
        }
    }

    showOnboarding() {
        document.getElementById('onboardingOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    setupAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(async () => {
            try {
                // Only save if authenticated (required for authStorage)
                if (authManager.isAuthenticated()) {
                    await this.authStorage.saveTasks(this.appState.tasks);
                    await this.authStorage.saveNotes(this.appState.notes);
                    await this.authStorage.saveChats(this.appState.chats);
                    await this.authStorage.savePendingTasks(this.appState.pendingTasks);
                }
            } catch (error) {
                Logger.error('Auto-save failed', error);
            }
        }, Math.max(CONFIG.AUTO_SAVE_INTERVAL, 30000)); // Minimum 30 seconds
        
        Logger.log('Auto-save setup completed');
    }

    setupEventListeners() {
        // Listen to app state changes
        this.appState.addEventListener('tasksChanged', async () => {
            if (this.taskRenderer) {
                this.taskRenderer.renderAll();
            }
            try {
                if (authManager.isAuthenticated()) {
                    await this.authStorage.saveTasks(this.appState.tasks);
                }
            } catch (error) {
                Logger.error('Failed to save tasks on change', error);
            }
        });

        this.appState.addEventListener('notesChanged', async () => {
            if (this.notesRenderer) {
                this.notesRenderer.refresh();
            }
            try {
                if (authManager.isAuthenticated()) {
                    await this.authStorage.saveNotes(this.appState.notes);
                }
            } catch (error) {
                Logger.error('Failed to save notes on change', error);
            }
        });

        this.appState.addEventListener('chatsChanged', async () => {
            if (this.chatUI) {
                this.chatUI.refreshChatList();
            }
            try {
                if (authManager.isAuthenticated()) {
                    await this.authStorage.saveChats(this.appState.chats);
                }
            } catch (error) {
                Logger.error('Failed to save chats on change', error);
            }
        });

        this.appState.addEventListener('extractedTasksChanged', () => {
            if (this.modalManager) {
                this.modalManager.updateExtractedTasksPreview();
            }
        });

        this.appState.addEventListener('pendingTasksChanged', async () => {
            try {
                if (authManager.isAuthenticated()) {
                    await this.authStorage.savePendingTasks(this.appState.pendingTasks);
                }
            } catch (error) {
                Logger.error('Failed to save pending tasks on change', error);
            }
        });

        this.appState.addEventListener('onboardingDataChanged', () => {
            // Update AI service with new name variations
            if (this.aiService && this.appState.onboardingData.nameVariations) {
                this.aiService.nameVariations = this.appState.onboardingData.nameVariations;
                Logger.log('Updated AI service with onboarding data changes');
            }
        });

        // Listen specifically for name variations updates
        this.appState.addEventListener('nameVariationsUpdated', (event) => {
            const variations = event.detail.variations;
            
            // Update AI service
            if (this.aiService) {
                this.aiService.nameVariations = variations;
                Logger.log('AI service updated with new name variations', { variations });
            }
            
            // Update task extraction manager
            if (this.taskExtractionManager) {
                Logger.log('Task extraction will use updated name variations in next request');
            }
            
            // Show success notification
            this.notifications.showSuccess(`Name variations updated! AI will now recognize: ${variations.join(', ')}`);
        });

        // Window events
        window.addEventListener('beforeunload', async () => {
            try {
                if (authManager.isAuthenticated()) {
                    await this.authStorage.saveTasks(this.appState.tasks);
                    await this.authStorage.saveNotes(this.appState.notes);
                    await this.authStorage.saveChats(this.appState.chats);
                }
            } catch (error) {
                Logger.error('Failed to save on beforeunload', error);
            }
        });

        // Enhanced page visibility handling
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden && this) {
                // Save state when page becomes hidden
                try {
                    if (authManager.isAuthenticated()) {
                        await this.authStorage.saveTasks(this.appState.tasks);
                        await this.authStorage.saveChats(this.appState.chats);
                    }
                } catch (error) {
                    Logger.error('Failed to save on visibility change', error);
                }
                
                // Clear performance metrics to save memory
                if (this.performanceMetrics.renderTimes.length > 50) {
                    this.performanceMetrics.renderTimes = this.performanceMetrics.renderTimes.slice(-25);
                }
                if (this.performanceMetrics.aiRequestTimes.length > 50) {
                    this.performanceMetrics.aiRequestTimes = this.performanceMetrics.aiRequestTimes.slice(-25);
                }
            }
        });
    }

    // ============================================
    // PERFORMANCE MONITORING (INTEGRATED)
    // ============================================

    setupPerformanceMonitoring() {
        // Monitor render performance
        const originalRenderAll = this.taskRenderer?.renderAll?.bind(this.taskRenderer);
        if (originalRenderAll) {
            this.taskRenderer.renderAll = () => {
                const startTime = performance.now();
                const result = originalRenderAll();
                const renderTime = performance.now() - startTime;
                
                this.performanceMetrics.renderTimes.push(renderTime);
                if (this.performanceMetrics.renderTimes.length > 100) {
                    this.performanceMetrics.renderTimes.shift();
                }
                
                // Log if render is slow
                if (renderTime > 100) {
                    Logger.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
                }
                
                return result;
            };
        }
    }

    getPerformanceReport() {
        const renderTimes = this.performanceMetrics.renderTimes;
        const aiTimes = this.performanceMetrics.aiRequestTimes;
        
        return {
            averageRenderTime: renderTimes.length > 0 
                ? (renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length).toFixed(2)
                : 0,
            averageAIRequestTime: aiTimes.length > 0
                ? (aiTimes.reduce((a, b) => a + b, 0) / aiTimes.length).toFixed(2)
                : 0,
            totalTasks: this.appState.tasks.length,
            totalChats: this.appState.chats.length,
            memoryUsage: performance.memory ? {
                used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
                total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
            } : 'Not available'
        };
    }

    // ============================================
    // ERROR BOUNDARY (INTEGRATED)
    // ============================================

    setupErrorBoundary() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'Global Error');
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise Rejection');
        });
    }

    handleError(error, context) {
        this.errorCount++;
        
        console.error(`[ErrorBoundary] ${context}:`, error);
        
        // Show user-friendly error message
        const errorMessage = this.getUserFriendlyMessage(error);
        this.notifications.showError(errorMessage);
        
        // Attempt recovery based on error type
        this.attemptRecovery(error, context);
        
        // If too many errors, suggest reset
        if (this.errorCount >= this.maxErrors) {
            this.showCriticalErrorDialog();
        }
    }

    getUserFriendlyMessage(error) {
        if (error.message.includes('localStorage')) {
            return 'Storage is full. Please clear some browser data.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            return 'Network error. Please check your connection.';
        } else if (error.message.includes('JSON')) {
            return 'Data format error. Please try again.';
        } else {
            return 'An unexpected error occurred. The app will try to recover.';
        }
    }

    attemptRecovery(error, context) {
        if (context.includes('render') || context.includes('display')) {
            // UI rendering error - try to re-render
            setTimeout(() => {
                try {
                    this.taskRenderer?.renderAll();
                } catch (e) {
                    console.error('Recovery render failed:', e);
                }
            }, 1000);
        } else if (context.includes('AI') || context.includes('extract')) {
            // AI service error - show manual task creation
            this.showAIFallbackOption();
        }
    }

    showAIFallbackOption() {
        const fallbackMessage = 'AI service unavailable. You can still create tasks manually using Quick Task.';
        this.notifications.showInfo(fallbackMessage);
        
        // Highlight quick task button
        const quickTaskBtn = document.querySelector('.quick-task');
        if (quickTaskBtn) {
            quickTaskBtn.style.animation = 'pulse 2s infinite';
            setTimeout(() => {
                quickTaskBtn.style.animation = '';
            }, 10000);
        }
    }

    showCriticalErrorDialog() {
        const shouldReset = confirm(
            'Multiple errors detected. Would you like to reset the application? ' +
            'This will clear your settings but preserve your tasks in a backup.'
        );
        
        if (shouldReset) {
            this.performEmergencyReset();
        }
    }

    performEmergencyReset() {
        try {
            // Backup tasks
            const tasks = this.appState.tasks;
            const backup = JSON.stringify(tasks);
            
            // Store backup with timestamp
            const backupKey = `taskflow_emergency_backup_${Date.now()}`;
            localStorage.setItem(backupKey, backup);
            
            // Clear application state
            this.resetOnboarding();
            
            alert(`Emergency reset complete. Your tasks are backed up as: ${backupKey}`);
        } catch (error) {
            alert('Reset failed. Please refresh the page manually.');
        }
    }

    showCriticalError(error) {
        const errorHtml = `
            <div class="critical-error-screen">
                <div class="critical-error-content">
                    <span class="critical-error-icon">⚠️</span>
                    <h1>Application Error</h1>
                    <p>TaskFlow AI encountered a critical error and couldn't start properly.</p>
                    <div class="error-details">${error.message}</div>
                    <div class="critical-error-actions">
                        <button class="btn btn-primary" onclick="location.reload()">
                            Reload Application
                        </button>
                        <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">
                            Reset & Reload
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }

    // ============================================
    // KEYBOARD NAVIGATION (INTEGRATED)
    // ============================================

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (event) => {
            // Skip if user is typing in input/textarea
            if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
                return;
            }
            
            switch (event.key) {
                case 'j':
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateToNext();
                    break;
                case 'k':
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateToPrevious();
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    this.activateCurrentElement();
                    break;
                case 'c':
                    if (!event.ctrlKey && !event.metaKey) {
                        event.preventDefault();
                        this.toggleCurrentTaskComplete();
                    }
                    break;
                case 'e':
                    if (!event.ctrlKey && !event.metaKey) {
                        event.preventDefault();
                        this.editCurrentTask();
                    }
                    break;
                case 'd':
                    if (!event.ctrlKey && !event.metaKey) {
                        event.preventDefault();
                        this.deleteCurrentTask();
                    }
                    break;
                case '?':
                    event.preventDefault();
                    this.showKeyboardShortcuts();
                    break;
            }
        });
    }

    setupAccessibility() {
        // Add ARIA labels to main elements
        const elements = [
            { selector: '.task-item', label: 'Task item' },
            { selector: '.add-task-btn', label: 'Create new task' },
            { selector: '.status-btn', label: 'Toggle task status view' },
            { selector: '.settings-btn', label: 'Open settings' },
            { selector: '.help-btn', label: 'Open help documentation' }
        ];
        
        elements.forEach(({ selector, label }) => {
            document.querySelectorAll(selector).forEach(el => {
                if (!el.getAttribute('aria-label')) {
                    el.setAttribute('aria-label', label);
                }
            });
        });
    }

    updateFocusableElements() {
        this.focusableElements = Array.from(document.querySelectorAll(
            '.task-item, .add-task-btn, .status-btn, .settings-btn, .help-btn'
        )).filter(el => el.style.display !== 'none');
    }

    navigateToNext() {
        this.updateFocusableElements();
        if (this.focusableElements.length === 0) return;
        
        this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
        this.focusCurrentElement();
    }

    navigateToPrevious() {
        this.updateFocusableElements();
        if (this.focusableElements.length === 0) return;
        
        this.currentFocusIndex = this.currentFocusIndex <= 0 
            ? this.focusableElements.length - 1 
            : this.currentFocusIndex - 1;
        this.focusCurrentElement();
    }

    focusCurrentElement() {
        const element = this.focusableElements[this.currentFocusIndex];
        if (element) {
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add visual focus indicator
            this.clearFocusIndicators();
            element.classList.add('keyboard-focused');
        }
    }

    clearFocusIndicators() {
        document.querySelectorAll('.keyboard-focused').forEach(el => {
            el.classList.remove('keyboard-focused');
        });
    }

    activateCurrentElement() {
        const element = this.focusableElements[this.currentFocusIndex];
        if (element) {
            element.click();
        }
    }

    toggleCurrentTaskComplete() {
        const element = this.focusableElements[this.currentFocusIndex];
        if (element && element.classList.contains('task-item')) {
            const checkbox = element.querySelector('.task-checkbox');
            if (checkbox) checkbox.click();
        }
    }

    editCurrentTask() {
        const element = this.focusableElements[this.currentFocusIndex];
        if (element && element.classList.contains('task-item')) {
            const taskId = element.getAttribute('data-task-id');
            if (taskId) this.openModal('edit', taskId);
        }
    }

    deleteCurrentTask() {
        const element = this.focusableElements[this.currentFocusIndex];
        if (element && element.classList.contains('task-item')) {
            const taskId = element.getAttribute('data-task-id');
            if (taskId) {
                this.openModal('edit', taskId);
                // Auto-focus delete button in modal
                setTimeout(() => {
                    const deleteBtn = document.querySelector('.btn-danger');
                    if (deleteBtn) deleteBtn.focus();
                }, 100);
            }
        }
    }

    showKeyboardShortcuts() {
        const shortcuts = [
            'j/↓ - Next item',
            'k/↑ - Previous item',
            'Enter/Space - Activate',
            'c - Complete task',
            'e - Edit task',
            'd - Delete task',
            'Ctrl+Q - Quick task',
            'Ctrl+E - AI extract',
            'Ctrl+, - Settings',
            'Esc - Close modal',
            '? - Show shortcuts'
        ];
        
        this.notifications.showInfo(
            'Keyboard Shortcuts:\n' + shortcuts.join('\n'),
            { duration: 10000 }
        );
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'q':
                        event.preventDefault();
                        this.openModal('quick');
                        break;
                    case 'e':
                        event.preventDefault();
                        this.openModal('ai');
                        break;
                    case ',':
                        event.preventDefault();
                        this.openSettings();
                        break;
                }
            } else if (event.key === 'Escape') {
                // Close any open modals
                this.closeAllModals();
            }
        });
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // ============================================
    // AUTH STATE MANAGEMENT
    // ============================================

    handleAuthStateChange(isLoggedIn, user) {
        if (isLoggedIn) {
            Logger.log('User logged in, initializing app', { user });
            // User logged in - load their configuration
            this.loadUserConfiguration();
        } else {
            Logger.log('User logged out, showing onboarding');
            // User logged out - show authentication
            this.handleLogout();
        }
    }

    async loadUserConfiguration() {
        try {
            const config = await this.authStorage.loadConfiguration();
            
            if (config && (config.hasCompletedOnboarding || this.hasValidAIConfiguration(config))) {
                // User has valid configuration
                if (!config.hasCompletedOnboarding) {
                    config.hasCompletedOnboarding = true;
                    await this.authStorage.saveConfiguration(config);
                }
                Logger.log('Loading main app with user configuration');
                await this.initializeMainApp(config);
            } else {
                Logger.log('No valid configuration found, showing onboarding for authenticated user');
                this.initializeOnboarding();
            }
        } catch (error) {
            Logger.error('Failed to load user configuration', error);
            this.initializeOnboarding();
        }
    }

    handleLogout() {
        // Clear any auto-save intervals
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        // Reset app state
        this.appState = new AppState();
        
        // Clear managers
        this.aiService = null;
        this.nameVariationsManager = null;
        this.taskExtractionManager = null;
        this.modalManager = null;
        this.taskRenderer = null;
        this.dataManager = null;
        this.notesManager = null;
        this.notesRenderer = null;
        this.notesModalManager = null;
        this.chatManager = null;
        this.chatUI = null;
        
        // Show onboarding
        this.showOnboarding();
        this.initializeOnboarding();
    }

    hasValidAIConfiguration(config) {
        return config && 
               config.service && 
               config.model && 
               config.userName &&
               (config.service === 'ollama' || config.apiKey);
    }

    resetOnboarding() {
        // Clear onboarding data
        this.appState.setOnboardingData({
            userName: '',
            service: '',
            endpoint: '',
            apiKey: '',
            model: '',
            nameVariations: []
        });
        
        // Show onboarding
        this.showOnboarding();
        this.initializeOnboarding();
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    openModal(type, taskId = null) {
        if (this.modalManager) {
            this.modalManager.openModal(type, taskId);
        }
    }

    openSettings() {
        if (this.modalManager) {
            this.modalManager.openModal('settings');
        }
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab content
        const selectedTab = document.getElementById(`${tabName}Tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Add active class to selected nav tab
        const selectedNavTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedNavTab) {
            selectedNavTab.classList.add('active');
        }
        
        // Update current tab
        this.currentTab = tabName;
        
        // Initialize tab-specific functionality
        if (tabName === 'chat' && this.chatUI && !this.chatUI.initialized) {
            this.chatUI.initialize();
        }
        
        // Refresh notes tab when selected
        if (tabName === 'notes' && this.notesRenderer) {
            this.notesRenderer.refresh();
        }
        
        Logger.log('Switched to tab', { tabName });
    }
    
    // Task management functions
    toggleTaskComplete(taskId, event) {
        if (event) {
            event.stopPropagation(); // Prevent opening the edit modal
        }
        
        const task = this.appState.getTask(taskId);
        if (!task) return;
        
        const updates = {
            completed: !task.completed
        };
        
        if (updates.completed) {
            updates.completedAt = new Date().toISOString();
        } else {
            updates.completedAt = null;
        }
        
        this.appState.updateTask(taskId, updates);
        Logger.log('Task completion toggled', { taskId, completed: updates.completed });
    }
    
    completeTask() {
        const taskId = this.appState.currentTaskId;
        if (!taskId) return;
        
        const task = this.appState.getTask(taskId);
        if (!task) return;
        
        const updates = {
            completed: true,
            completedAt: new Date().toISOString()
        };
        
        this.appState.updateTask(taskId, updates);
        this.modalManager.closeModal('edit');
        this.notifications.showSuccess('Task completed!');
        Logger.log('Task marked as complete', { taskId });
    }
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

function setupGlobalFunctions(app) {
    // Make app instance globally available for debugging
    window.taskFlowApp = app;
    
    // Global tab switching
    window.switchTab = (tabName) => app.switchTab(tabName);
    
    // Global auth functions - make sure this is accessible globally
    window.authManager = {
        logout: () => {
            if (app && app.authUI) {
                app.authUI.logout();
                app.handleLogout();
            }
        },
        isAuthenticated: () => {
            return app && app.authUI && app.authUI.isAuthenticated();
        },
        getCurrentUser: () => {
            return app && app.authUI ? app.authUI.getCurrentUser() : null;
        }
    };
    
// Global modal functions
window.openModal = (type, taskId) => app.openModal(type, taskId);
window.closeModal = (type) => {
    if (app && app.modalManager) {
        app.modalManager.closeModal(type);
    }
};
window.openSettings = () => app.openSettings();
window.openNotesModal = (type, noteId) => {
    if (app.notesModalManager) {
        app.notesModalManager.openModal(type, noteId);
    }
};
window.closeNotesModal = (type) => {
    if (app.notesModalManager) {
        app.notesModalManager.closeModal(type);
    }
};

// Global task functions
window.toggleTaskComplete = (taskId, event) => {
    if (app) {
        app.toggleTaskComplete(taskId, event);
    }
};

window.completeTask = () => {
    if (app) {
        app.completeTask();
    }
};

window.updateTask = (event) => {
    if (event) {
        event.preventDefault();
    }
    
    if (app) {
        const taskId = app.appState.currentTaskId;
        if (!taskId) return;
        
        const name = document.getElementById('editTaskName').value;
        const description = document.getElementById('editTaskDescription').value;
        const notes = document.getElementById('editTaskNotes').value;
        
        const updates = {
            name: name,
            description: description,
            notes: notes,
            modifiedAt: new Date().toISOString()
        };
        
        app.appState.updateTask(taskId, updates);
        app.modalManager.closeModal('edit');
        app.notifications.showSuccess('Task updated successfully!');
    }
};

window.deleteTask = () => {
    if (app) {
        const taskId = app.appState.currentTaskId;
        if (!taskId) return;
        
        if (confirm('Are you sure you want to delete this task?')) {
            app.appState.deleteTask(taskId);
            app.modalManager.closeModal('edit');
            app.notifications.showSuccess('Task deleted successfully!');
        }
    }
};

window.postponeTask = () => {
    if (app) {
        const taskId = app.appState.currentTaskId;
        if (!taskId) return;
        
        const updates = {
            postponed: true,
            postponedAt: new Date().toISOString()
        };
        
        app.appState.updateTask(taskId, updates);
        app.modalManager.closeModal('edit');
        app.notifications.showSuccess('Task postponed!');
    }
};
    
    // Chat-specific global functions
    window.startNewChat = () => {
        if (app.chatUI) {
            app.chatUI.startNewChat();
        }
    };
    
    window.selectChat = (chatId) => {
        if (app.chatUI) {
            app.chatUI.selectChat(chatId);
        }
    };
    
    window.sendMessage = () => {
        if (app.chatUI) {
            app.chatUI.sendMessage();
        }
    };
    
    window.sendSuggestion = (suggestion) => {
        if (app.chatUI) {
            app.chatUI.sendSuggestion(suggestion);
        }
    };
    
    window.summarizeCurrentChat = () => {
        if (app.chatUI) {
            app.chatUI.summarizeCurrentChat();
        }
    };
    
    window.extractTasksFromCurrentChat = () => {
        if (app.chatUI) {
            app.chatUI.extractTasksFromCurrentChat();
        }
    };
    
    window.exportCurrentChat = () => {
        if (app.chatUI) {
            app.chatUI.exportCurrentChat();
        }
    };
    
    window.clearCurrentChat = () => {
        if (app.chatUI) {
            app.chatUI.clearCurrentChat();
        }
    };
    
    window.deleteChat = (chatId) => {
        if (app.chatUI) {
            app.chatUI.deleteChat(chatId);
        }
    };
    
    window.copyMessageContent = (messageId) => {
        if (app.chatUI) {
            app.chatUI.copyMessageContent(messageId);
        }
    };
    
    // Notes-specific global functions
    window.saveNote = (event) => {
        if (app.notesModalManager) {
            app.notesModalManager.saveNote(event);
        }
    };
    
    window.updateNote = (event) => {
        if (app.notesModalManager) {
            app.notesModalManager.updateNote(event);
        }
    };
    
    window.toggleTagFilter = (tag) => {
        if (app.notesRenderer) {
            app.notesRenderer.toggleTagFilter(tag);
        }
    };
    
    window.clearTagFilters = () => {
        if (app.notesRenderer) {
            app.notesRenderer.clearTagFilters();
        }
    };
    
    window.clearSearch = () => {
        if (app.notesRenderer) {
            app.notesRenderer.setSearchQuery('');
            document.getElementById('notesSearch').value = '';
            document.getElementById('searchResults').style.display = 'none';
        }
    };
    
    window.openNote = (noteId) => {
        if (app.notesRenderer) {
            app.notesRenderer.openViewModal(noteId);
        }
    };
    
    window.confirmDeleteNote = (noteId) => {
        if (app.notesModalManager) {
            app.notesModalManager.confirmDeleteNote(noteId);
        }
    };
    
    window.copyNoteContent = (noteId) => {
        if (app.notesModalManager) {
            app.notesModalManager.copyNoteContent(noteId);
        }
    };
    
    window.exportSingleNote = (noteId) => {
        if (app.notesModalManager) {
            app.notesModalManager.exportSingleNote(noteId);
        }
    };
    
    window.generateSummary = () => {
        if (app.notesModalManager) {
            app.notesModalManager.generateSummary();
        }
    };
    
    window.copySummary = () => {
        if (app.notesModalManager) {
            app.notesModalManager.copySummary();
        }
    };
    
    window.performExport = () => {
        if (app.notesModalManager) {
            app.notesModalManager.performExport();
        }
    };
    
    window.searchNotes = (query) => {
        if (app.notesRenderer) {
            app.notesRenderer.search(query);
        }
    };
    
    window.sortNotes = (sortBy) => {
        if (app.notesRenderer) {
            app.notesRenderer.sort(sortBy);
        }
    };
    
    Logger.log('Global functions setup completed');
}

// ============================================
// APPLICATION STARTUP
// ============================================

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new TaskFlowApp();
    await app.initialize();
});

// Export for module usage
export { TaskFlowApp };
