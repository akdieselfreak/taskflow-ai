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

// UI Components
import { OnboardingManager } from './ui/onboarding.js';
import { ModalManager } from './ui/modals.js';
import { TaskRenderer } from './ui/rendering.js';
import { NotificationManager } from './ui/notifications.js';
import { DataManagerUI, enhanceModalManagerWithDataManagement } from './ui/dataManagerUI.js';
import { NotesRenderer } from './ui/notesRenderer.js';
import { NotesModalManager } from './ui/notesModals.js';
import { AuthUI } from './ui/authUI.js';

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
                
                // Refresh UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
                if (this.notesRenderer) {
                    this.notesRenderer.refresh();
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
        
        // Setup performance monitoring for task renderer
        this.setupPerformanceMonitoring();
        
        // Setup global modal functions
        this.modalManager.setupGlobalModalFunctions(this);
        
        // Load tasks, notes, and pending tasks
        const tasks = await this.authStorage.loadTasks();
        const notes = await this.authStorage.loadNotes();
        const pendingTasks = await this.authStorage.loadPendingTasks();
        this.appState.setTasks(tasks);
        this.appState.setNotes(notes);
        this.appState.setPendingTasks(pendingTasks);
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Show main app
        this.showMainApp();
        
        // Setup global functions now that all managers are initialized
        setupGlobalFunctions(this);
        
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
                ...(config.notesTaskExtractionPrompt && { notesTaskExtractionPrompt: config.notesTaskExtractionPrompt })
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
        
        alert('Keyboard Shortcuts:\n\n' + shortcuts.join('\n'));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Only handle shortcuts when no modal is open
            if (document.querySelector('.modal-overlay.active')) return;
            
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'q':
                        event.preventDefault();
                        this.modalManager?.openModal('quick');
                        break;
                    case 'e':
                        event.preventDefault();
                        this.modalManager?.openModal('ai');
                        break;
                    case ',':
                        event.preventDefault();
                        this.modalManager?.openModal('settings');
                        break;
                }
            } else if (event.key === 'Escape') {
                // Close any open modal
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal) {
                    const modalType = activeModal.id.replace('ModalOverlay', '').replace('Modal', '');
                    this.modalManager?.closeModal(modalType);
                }
            }
        });
        
        Logger.log('Keyboard shortcuts setup completed');
    }

    // ============================================
    // TASK MANAGEMENT METHODS
    // ============================================

    // Public API methods for HTML onclick handlers
    openModal(type, taskId = null) {
        if (this.modalManager) {
            this.modalManager.openModal(type, taskId);
        }
    }

    closeModal(type) {
        if (this.modalManager) {
            this.modalManager.closeModal(type);
        }
    }

    async saveQuickTask(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const task = {
                id: this.appState.generateTaskId(),
                name: formData.get('quickTaskName')?.trim(),
                description: formData.get('quickTaskDescription')?.trim() || '',
                notes: formData.get('quickTaskNotes')?.trim() || '',
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                type: 'quick',
                completed: false,
                postponed: false
            };

            if (!task.name) {
                this.notifications.showError('Task name is required');
                return;
            }

            this.appState.addTask(task);
            this.modalManager?.closeModal('quick');
            this.notifications.showSuccess('Task created successfully!');
            
            // Highlight new task
            setTimeout(() => {
                this.taskRenderer?.highlightTask?.(task.id);
            }, 100);
            
            Logger.log('Quick task created', { taskId: task.id });
        } catch (error) {
            Logger.error('Failed to save quick task', error);
            this.notifications.showError('Failed to create task. Please try again.');
        }
    }

    async extractTask(event) {
        event.preventDefault();
        
        const startTime = performance.now();
        const extractButton = document.getElementById('extractButtonText');
        const originalText = extractButton.textContent;
        extractButton.innerHTML = '<span class="loading"></span> Extracting...';
        
        try {
            const formData = new FormData(event.target);
            const inputText = formData.get('aiTaskInput')?.trim();
            
            const validation = this.taskExtractionManager.validateExtractionInput(inputText);
            if (!validation.valid) {
                this.notifications.showError(validation.message);
                return;
            }

            const result = await this.taskExtractionManager.extractTasksFromText(inputText);
            
            if (this.modalManager) {
                this.modalManager.showExtractedTasksPreview(result.tasks);
            }
            
            // Track AI request performance
            const requestTime = performance.now() - startTime;
            this.performanceMetrics.aiRequestTimes.push(requestTime);
            
            Logger.log(`AI task extraction completed in ${requestTime.toFixed(2)}ms`);
            
        } catch (error) {
            Logger.error('AI task extraction failed', error);
            this.notifications.showError(`Error: ${error.message}`);
            this.showAIFallbackOption();
        } finally {
            extractButton.textContent = originalText;
        }
    }

    saveExtractedTasks() {
        try {
            const result = this.taskExtractionManager.saveExtractedTasks();
            this.modalManager?.closeModal('ai');
            this.notifications.showSuccess(result.message);
            
            Logger.log('AI tasks saved', { taskCount: result.count });
        } catch (error) {
            Logger.error('Failed to save extracted tasks', error);
            this.notifications.showError('Failed to save tasks. Please try again.');
        }
    }

    removeExtractedTask(index) {
        try {
            this.taskExtractionManager.removeExtractedTask(index);
            this.notifications.showSuccess('Task removed');
        } catch (error) {
            this.notifications.showError(error.message);
        }
    }

    resetAiModal() {
        this.taskExtractionManager?.clearExtractedTasks();
        if (this.modalManager) {
            this.modalManager.resetAiModal();
        }
    }

    toggleTaskComplete(taskId, event) {
        event?.stopPropagation();
        
        try {
            const task = this.appState.getTask(taskId);
            if (!task) {
                this.notifications.showError('Task not found');
                return;
            }
            
            const updates = {
                completed: !task.completed,
                modifiedAt: new Date().toISOString()
            };
            
            if (updates.completed) {
                updates.completedAt = new Date().toISOString();
                updates.postponed = false;
                delete updates.postponedAt;
                this.notifications.showSuccess('Task completed! 🎉');
            } else {
                delete updates.completedAt;
                this.notifications.showSuccess('Task reopened');
            }
            
            this.appState.updateTask(taskId, updates);
            
            Logger.log('Task completion toggled', { taskId, completed: updates.completed });
        } catch (error) {
            Logger.error('Failed to toggle task completion', error);
            this.notifications.showError('Failed to update task. Please try again.');
        }
    }

    toggleCompletedTasks() {
        if (this.taskRenderer) {
            this.taskRenderer.toggleCompletedTasks();
        }
    }

    togglePostponedTasks() {
        if (this.taskRenderer) {
            this.taskRenderer.togglePostponedTasks();
        }
    }

    togglePendingTasks() {
        if (this.taskRenderer) {
            this.taskRenderer.togglePendingTasks();
        }
    }

    async approvePendingTask(pendingTaskId) {
        try {
            if (this.notesManager) {
                const task = await this.notesManager.approvePendingTask(pendingTaskId);
                // Re-render to update counts and UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
                return task;
            }
        } catch (error) {
            Logger.error('Failed to approve pending task', error);
            this.notifications.showError('Failed to approve task. Please try again.');
        }
    }

    async rejectPendingTask(pendingTaskId) {
        try {
            if (this.notesManager) {
                await this.notesManager.rejectPendingTask(pendingTaskId);
                // Re-render to update counts and UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
            }
        } catch (error) {
            Logger.error('Failed to reject pending task', error);
            this.notifications.showError('Failed to reject task. Please try again.');
        }
    }

    async bulkApprovePendingTasks() {
        try {
            const pendingTasks = this.appState.pendingTasks || [];
            if (pendingTasks.length === 0) {
                this.notifications.showInfo('No pending tasks to approve.');
                return;
            }

            const taskIds = pendingTasks.map(task => task.id);
            if (this.notesManager) {
                await this.notesManager.bulkApprovePendingTasks(taskIds);
                // Re-render to update counts and UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
            }
        } catch (error) {
            Logger.error('Failed to bulk approve pending tasks', error);
            this.notifications.showError('Failed to approve tasks. Please try again.');
        }
    }

    async bulkRejectPendingTasks() {
        try {
            const pendingTasks = this.appState.pendingTasks || [];
            if (pendingTasks.length === 0) {
                this.notifications.showInfo('No pending tasks to reject.');
                return;
            }

            const taskIds = pendingTasks.map(task => task.id);
            if (this.notesManager) {
                await this.notesManager.bulkRejectPendingTasks(taskIds);
                // Re-render to update counts and UI
                if (this.taskRenderer) {
                    this.taskRenderer.renderAll();
                }
            }
        } catch (error) {
            Logger.error('Failed to bulk reject pending tasks', error);
            this.notifications.showError('Failed to reject tasks. Please try again.');
        }
    }

    openSettings() {
        this.modalManager?.openModal('settings');
    }

    resetOnboarding() {
        if (confirm('This will reset your AI configuration and delete all tasks and notes. Are you sure?')) {
            try {
                // Clear app state first
                this.appState.setTasks([]);
                this.appState.setNotes([]);
                
                // Clear all localStorage data manually
                localStorage.clear();
                sessionStorage.clear();
                
                Logger.log('Complete application reset completed');
                location.reload();
            } catch (error) {
                Logger.error('Failed to reset application', error);
                this.notifications.showError('Failed to reset application. Please try again.');
            }
        }
    }

    resetAIConfigOnly() {
        if (confirm('This will reset your AI configuration but keep your tasks and notes. Are you sure?')) {
            try {
                // Clear all local data since we're auth-only now
                localStorage.clear();
                sessionStorage.clear();
                
                Logger.log('AI configuration reset completed');
                location.reload();
            } catch (error) {
                Logger.error('Failed to reset AI configuration', error);
                this.notifications.showError('Failed to reset AI configuration. Please try again.');
            }
        }
    }

    // Task management functions for HTML compatibility
    updateTask(event) {
        event?.preventDefault();
        
        try {
            const taskId = this.appState.currentTaskId;
            const task = this.appState.getTask(taskId);
            if (!task) {
                this.notifications.showError('Task not found');
                return;
            }
            
            const name = document.getElementById('editTaskName')?.value?.trim();
            if (!name) {
                this.notifications.showError('Task name is required');
                return;
            }
            
            const updates = {
                name,
                description: document.getElementById('editTaskDescription')?.value?.trim() || '',
                notes: document.getElementById('editTaskNotes')?.value?.trim() || '',
                modifiedAt: new Date().toISOString()
            };
            
            this.appState.updateTask(taskId, updates);
            this.modalManager?.closeModal('edit');
            this.notifications.showSuccess('Task updated successfully!');
            
            Logger.log('Task updated', { taskId });
        } catch (error) {
            Logger.error('Failed to update task', error);
            this.notifications.showError('Failed to update task. Please try again.');
        }
    }

    deleteTask() {
        if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            try {
                const taskId = this.appState.currentTaskId;
                this.appState.deleteTask(taskId);
                this.modalManager?.closeModal('edit');
                this.notifications.showSuccess('Task deleted successfully!');
                
                Logger.log('Task deleted', { taskId });
            } catch (error) {
                Logger.error('Failed to delete task', error);
                this.notifications.showError('Failed to delete task. Please try again.');
            }
        }
    }

    completeTask() {
        try {
            const taskId = this.appState.currentTaskId;
            const updates = {
                completed: true,
                completedAt: new Date().toISOString(),
                postponed: false,
                modifiedAt: new Date().toISOString()
            };
            delete updates.postponedAt;
            
            this.appState.updateTask(taskId, updates);
            this.modalManager?.closeModal('edit');
            this.notifications.showSuccess('Task completed! 🎉');
            
            Logger.log('Task completed', { taskId });
        } catch (error) {
            Logger.error('Failed to complete task', error);
            this.notifications.showError('Failed to complete task. Please try again.');
        }
    }

    postponeTask() {
        try {
            const taskId = this.appState.currentTaskId;
            const updates = {
                postponed: true,
                postponedAt: new Date().toISOString(),
                completed: false,
                modifiedAt: new Date().toISOString()
            };
            delete updates.completedAt;
            
            this.appState.updateTask(taskId, updates);
            this.modalManager?.closeModal('edit');
            this.notifications.showSuccess('Task postponed');
            
            Logger.log('Task postponed', { taskId });
        } catch (error) {
            Logger.error('Failed to postpone task', error);
            this.notifications.showError('Failed to postpone task. Please try again.');
        }
    }

    copyTask() {
        try {
            const taskId = this.appState.currentTaskId;
            const task = this.appState.getTask(taskId);
            if (!task) {
                this.notifications.showError('Task not found');
                return;
            }
            
            const newTask = {
                ...task,
                id: this.appState.generateTaskId(),
                completed: false,
                postponed: false,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                completedAt: undefined,
                postponedAt: undefined,
                modifiedAt: undefined
            };
            
            this.appState.addTask(newTask);
            this.modalManager?.closeModal('edit');
            this.notifications.showSuccess('Task copied to today!');
            
            Logger.log('Task copied', { originalId: taskId, newId: newTask.id });
        } catch (error) {
            Logger.error('Failed to copy task', error);
            this.notifications.showError('Failed to copy task. Please try again.');
        }
    }

    moveToToday() {
        try {
            const taskId = this.appState.currentTaskId;
            const updates = {
                postponed: false,
                date: new Date().toISOString().split('T')[0],
                modifiedAt: new Date().toISOString()
            };
            delete updates.postponedAt;
            
            this.appState.updateTask(taskId, updates);
            this.modalManager?.closeModal('edit');
            this.notifications.showSuccess('Task moved to today!');
            
            Logger.log('Task moved to today', { taskId });
        } catch (error) {
            Logger.error('Failed to move task to today', error);
            this.notifications.showError('Failed to move task. Please try again.');
        }
    }

    // ============================================
    // NOTES AND TAB MANAGEMENT METHODS
    // ============================================

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tab) {
                btn.classList.add('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tab}Tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
        // Render content for the active tab
        if (tab === 'notes' && this.notesRenderer) {
            this.notesRenderer.refresh();
        } else if (tab === 'tasks' && this.taskRenderer) {
            this.taskRenderer.renderAll();
        }
        
        Logger.log('Tab switched', { tab });
    }

    clearSearch() {
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        
        if (this.notesRenderer) {
            this.notesRenderer.setSearchQuery('');
        }
    }

    // Utility methods for global access
    getAppState() {
        return this.appState;
    }

    getAIService() {
        return this.aiService;
    }

    getNotifications() {
        return this.notifications;
    }

    // ============================================
    // AUTHENTICATION HANDLERS
    // ============================================

    async handleAuthStateChange(isLoggedIn, user) {
        Logger.log('Handling auth state change', { isLoggedIn, user });
        
        try {
            // Sync AuthUI with auth manager
            this.syncAuthUIWithAuthManager();
            
            if (isLoggedIn && user) {
                // User just logged in - check for existing configuration
                try {
                    const config = await this.authStorage.loadConfiguration();
                    if (config && config.hasCompletedOnboarding) {
                        // User has existing configuration, reinitialize with it
                        await this.initializeMainApp(config);
                        this.notifications.showSuccess(`Welcome back, ${user.username}!`);
                    } else {
                        // User needs to complete onboarding - but don't show it if already in onboarding
                        const onboardingOverlay = document.getElementById('onboardingOverlay');
                        if (!onboardingOverlay || onboardingOverlay.style.display === 'none') {
                            this.initializeOnboarding();
                        }
                    }
                } catch (error) {
                    Logger.error('Failed to load configuration after login', error);
                    // Show onboarding if config load fails
                    this.initializeOnboarding();
                }
                
                // Update UI to show user info
                this.updateUserInterface();
            } else {
                // User logged out or auth failed - show onboarding (authentication required)
                this.initializeOnboarding();
            }
        } catch (error) {
            Logger.error('Failed to handle auth state change', error);
            this.notifications.showError('Authentication error. Please try again.');
        }
    }

    async handleLogout() {
        Logger.log('Handling logout');
        
        try {
            // Clear auth-related data
            this.authUI.isLoggedIn = false;
            this.authUI.currentUser = null;
            this.authUI.authToken = null;
            
            // Clear session data from auth storage
            this.authStorage.clearSessionData();
            
            // Clear app state completely
            this.appState.setTasks([]);
            this.appState.setNotes([]);
            this.appState.setPendingTasks([]);
            this.appState.clearExtractedTasks();
            
            // Clear onboarding data
            this.appState.onboardingData = {};
            
            // Stop auto-save
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
                this.autoSaveInterval = null;
            }
            
            // Show onboarding since authentication is now required
            this.initializeOnboarding();
            
            // Update UI to remove user info
            this.updateUserInterface();
            
            Logger.log('Logout handled successfully - app state cleared');
            
        } catch (error) {
            Logger.error('Failed to handle logout', error);
            this.notifications.showError('Logout error. Please refresh the page.');
        }
    }

    async migrateLocalDataIfNeeded() {
        try {
            // Check if there's local data that needs migration
            const localTasks = StorageManager.loadTasks();
            const localNotes = StorageManager.loadNotes();
            const localConfig = StorageManager.loadConfiguration();
            
            if (localTasks.length > 0 || localNotes.length > 0 || localConfig) {
                Logger.log('Found local data, offering migration', {
                    tasks: localTasks.length,
                    notes: localNotes.length,
                    hasConfig: !!localConfig
                });
                
                const shouldMigrate = confirm(
                    'You have local data that can be synced to your account. ' +
                    'Would you like to migrate your tasks and notes to the cloud?'
                );
                
                if (shouldMigrate) {
                    // Since we're now using auth-only storage, we can't migrate from hybrid
                    // This method is no longer needed in the new architecture
                    this.notifications.showInfo('Data migration is no longer available. Please manually recreate your data.');
                }
            }
        } catch (error) {
            Logger.error('Failed to migrate local data', error);
            this.notifications.showError('Failed to migrate local data. Your data is still safe locally.');
        }
    }

    updateUserInterface() {
        // Update the user greeting in the existing header
        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting) {
            if (this.authUI.isLoggedIn && this.authUI.currentUser) {
                userGreeting.textContent = this.authUI.currentUser.username;
            } else {
                userGreeting.textContent = this.appState.onboardingData?.userName || 'Guest';
            }
        }
        
        // Don't add separate user info section - use the existing header structure
        // The logout functionality will be handled through the settings modal
    }

    // ============================================
    // AI RECONFIGURATION METHODS
    // ============================================

    openAIReconfigModal() {
        if (this.modalManager) {
            this.modalManager.openModal('aiReconfig');
        }
    }

    selectReconfigService(service) {
        // Store the selected service temporarily
        this.tempReconfigData = { service };
        
        // Show service configuration step
        this.showReconfigStep(2, service);
        
        Logger.log('AI reconfig service selected', { service });
    }

    showReconfigStep(stepNumber, service = null) {
        // Hide all steps
        document.querySelectorAll('.reconfig-step').forEach(step => {
            step.style.display = 'none';
            step.classList.remove('active');
        });
        
        // Show the target step
        const targetStep = document.getElementById(`reconfigStep${stepNumber}`);
        if (targetStep) {
            targetStep.style.display = 'block';
            targetStep.classList.add('active');
            
            if (stepNumber === 2 && service) {
                this.populateServiceConfigStep(service);
            } else if (stepNumber === 3) {
                this.populateModelSelectionStep();
            }
        }
    }

    populateServiceConfigStep(service) {
        const content = document.getElementById('reconfigServiceContent');
        if (!content) return;
        
        const currentConfig = this.appState.onboardingData;
        
        switch (service) {
            case 'ollama':
                content.innerHTML = `
                    <h3>Configure Ollama</h3>
                    <p class="step-description">Enter your Ollama server details</p>
                    
                    <div class="form-group">
                        <label for="reconfigOllamaUrl">Ollama Server URL</label>
                        <input type="text" id="reconfigOllamaUrl" 
                               value="${currentConfig.service === 'ollama' ? currentConfig.endpoint?.replace('/api/chat', '') || 'localhost:11434' : 'localhost:11434'}"
                               placeholder="e.g., localhost:11434 or 192.168.1.100:11434" />
                        <p class="input-hint">Just enter the address, we'll handle the rest</p>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-primary" onclick="testReconfigConnection('ollama')">
                            Test Connection
                        </button>
                        <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(1)">
                            Back
                        </button>
                    </div>
                    
                    <div class="connection-status" id="reconfigConnectionStatus"></div>
                `;
                break;
                
            case 'openai':
                content.innerHTML = `
                    <h3>Configure OpenAI</h3>
                    <p class="step-description">Enter your OpenAI API details</p>
                    
                    <div class="form-group">
                        <label for="reconfigOpenaiKey">OpenAI API Key</label>
                        <input type="password" id="reconfigOpenaiKey" 
                               value="${currentConfig.service === 'openai' ? currentConfig.apiKey || '' : ''}"
                               placeholder="sk-..." required />
                        <p class="input-hint">Your API key is stored securely and never sent to our servers</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="reconfigOpenaiEndpoint">API Endpoint (Optional)</label>
                        <input type="url" id="reconfigOpenaiEndpoint" 
                               value="${currentConfig.service === 'openai' ? currentConfig.endpoint || 'https://api.openai.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'}"
                               placeholder="https://api.openai.com/v1/chat/completions" />
                        <p class="input-hint">Leave as default for standard OpenAI endpoint</p>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-primary" onclick="testReconfigConnection('openai')">
                            Test & Continue
                        </button>
                        <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(1)">
                            Back
                        </button>
                    </div>
                    
                    <div class="connection-status" id="reconfigConnectionStatus"></div>
                `;
                break;
                
            case 'openwebui':
                content.innerHTML = `
                    <h3>Configure Open WebUI</h3>
                    <p class="step-description">Enter your Open WebUI server details</p>
                    
                    <div class="form-group">
                        <label for="reconfigOpenwebuiUrl">Open WebUI Server URL</label>
                        <input type="text" id="reconfigOpenwebuiUrl" 
                               value="${currentConfig.service === 'openwebui' ? currentConfig.endpoint?.replace('/api/chat/completions', '') || 'localhost:3000' : 'localhost:3000'}"
                               placeholder="e.g., localhost:3000 or https://openwebui.example.com" />
                        <p class="input-hint">Your Open WebUI server address</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="reconfigOpenwebuiKey">API Key</label>
                        <input type="password" id="reconfigOpenwebuiKey" 
                               value="${currentConfig.service === 'openwebui' ? currentConfig.apiKey || '' : ''}"
                               placeholder="Your Open WebUI API key" required />
                        <p class="input-hint">Get your API key from Settings > Account in Open WebUI</p>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-primary" onclick="testReconfigConnection('openwebui')">
                            Test Connection
                        </button>
                        <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(1)">
                            Back
                        </button>
                    </div>
                    
                    <div class="connection-status" id="reconfigConnectionStatus"></div>
                `;
                break;
        }
        
        // Add global function for testing connection
        window.testReconfigConnection = (service) => this.testReconfigConnection(service);
    }

    async testReconfigConnection(service) {
        const statusDiv = document.getElementById('reconfigConnectionStatus');
        const testBtn = document.querySelector('.reconfig-actions .btn-primary');
        
        if (testBtn) {
            testBtn.innerHTML = '<span class="loading"></span> Testing...';
            testBtn.disabled = true;
        }
        
        if (statusDiv) {
            statusDiv.innerHTML = '';
        }
        
        try {
            let result;
            
            switch (service) {
                case 'ollama':
                    const ollamaUrl = document.getElementById('reconfigOllamaUrl')?.value?.trim();
                    if (!ollamaUrl) {
                        throw new Error('Please enter an Ollama server URL');
                    }
                    result = await OllamaService.getAvailableModels(ollamaUrl);
                    if (result.success) {
                        this.tempReconfigData.endpoint = result.endpoint;
                        this.tempReconfigData.models = result.models;
                    }
                    break;
                    
                case 'openai':
                    const apiKey = document.getElementById('reconfigOpenaiKey')?.value?.trim();
                    const endpoint = document.getElementById('reconfigOpenaiEndpoint')?.value?.trim() || 'https://api.openai.com/v1/chat/completions';
                    
                    if (!apiKey) {
                        throw new Error('Please enter your OpenAI API key');
                    }
                    
                    const validation = OpenAIService.validateApiKey(apiKey);
                    if (!validation.valid) {
                        throw new Error(validation.message);
                    }
                    
                    this.tempReconfigData.apiKey = apiKey;
                    this.tempReconfigData.endpoint = endpoint;
                    result = { success: true, message: 'API key validated successfully' };
                    break;
                    
                case 'openwebui':
                    const openwebuiUrl = document.getElementById('reconfigOpenwebuiUrl')?.value?.trim();
                    const openwebuiKey = document.getElementById('reconfigOpenwebuiKey')?.value?.trim();
                    
                    const openwebuiValidation = OpenWebUIService.validateConnection(openwebuiUrl, openwebuiKey);
                    if (!openwebuiValidation.valid) {
                        throw new Error(openwebuiValidation.message);
                    }
                    
                    result = await OpenWebUIService.getAvailableModels(openwebuiUrl, openwebuiKey);
                    if (result.success) {
                        this.tempReconfigData.apiKey = openwebuiKey;
                        this.tempReconfigData.endpoint = result.endpoint;
                        this.tempReconfigData.fallbackEndpoint = result.fallbackEndpoint;
                        this.tempReconfigData.models = result.models;
                    }
                    break;
            }
            
            if (result.success) {
                if (statusDiv) {
                    statusDiv.innerHTML = `<div class="success">✓ ${result.message || 'Connection successful!'}</div>`;
                }
                
                // Move to model selection step
                setTimeout(() => {
                    this.showReconfigStep(3);
                }, 1500);
                
                Logger.log('AI reconfig connection test successful', { service });
            } else {
                throw new Error(result.message || 'Connection failed');
            }
            
        } catch (error) {
            if (statusDiv) {
                statusDiv.innerHTML = `<div class="error">❌ ${error.message}</div>`;
            }
            Logger.error('AI reconfig connection test failed', error);
        } finally {
            if (testBtn) {
                testBtn.textContent = service === 'openai' ? 'Test & Continue' : 'Test Connection';
                testBtn.disabled = false;
            }
        }
    }

    populateModelSelectionStep() {
        const content = document.getElementById('reconfigModelContent');
        if (!content || !this.tempReconfigData) return;
        
        const service = this.tempReconfigData.service;
        const currentConfig = this.appState.onboardingData;
        
        switch (service) {
            case 'ollama':
            case 'openwebui':
                const models = this.tempReconfigData.models || [];
                content.innerHTML = `
                    <h3>Select Model</h3>
                    <p class="step-description">Choose which model to use</p>
                    
                    <div class="form-group">
                        <label for="reconfigModelSelect">Available Models</label>
                        <select id="reconfigModelSelect" size="6">
                            ${models.map(model => {
                                const value = service === 'ollama' ? model.name : model.id;
                                const display = service === 'ollama' ? OllamaService.formatModelDisplay(model) : model.name;
                                const selected = currentConfig.model === value ? 'selected' : '';
                                return `<option value="${value}" ${selected}>${display}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-primary" onclick="taskFlowApp?.proceedToTestStep?.()">
                            Continue
                        </button>
                        <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(2)">
                            Back
                        </button>
                    </div>
                `;
                break;
                
            case 'openai':
                content.innerHTML = `
                    <h3>Select Model</h3>
                    <p class="step-description">Choose which OpenAI model to use</p>
                    
                    <div class="model-options">
                        <label class="model-option">
                            <input type="radio" name="reconfigOpenaiModel" value="gpt-4o-mini" 
                                   ${currentConfig.model === 'gpt-4o-mini' ? 'checked' : ''} />
                            <div class="model-card">
                                <h4>GPT-4o Mini</h4>
                                <p>Fast and cost-effective</p>
                            </div>
                        </label>
                        <label class="model-option">
                            <input type="radio" name="reconfigOpenaiModel" value="gpt-4o" 
                                   ${currentConfig.model === 'gpt-4o' ? 'checked' : ''} />
                            <div class="model-card">
                                <h4>GPT-4o</h4>
                                <p>Most capable model</p>
                            </div>
                        </label>
                        <label class="model-option">
                            <input type="radio" name="reconfigOpenaiModel" value="gpt-3.5-turbo" 
                                   ${currentConfig.model === 'gpt-3.5-turbo' ? 'checked' : ''} />
                            <div class="model-card">
                                <h4>GPT-3.5 Turbo</h4>
                                <p>Legacy fast model</p>
                            </div>
                        </label>
                        <label class="model-option">
                            <input type="radio" name="reconfigOpenaiModel" value="custom" 
                                   ${!['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'].includes(currentConfig.model) ? 'checked' : ''} />
                            <div class="model-card">
                                <h4>Custom Model</h4>
                                <input type="text" id="reconfigCustomModelName" 
                                       value="${!['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'].includes(currentConfig.model) ? currentConfig.model || '' : ''}"
                                       placeholder="Enter model name..." 
                                       onclick="document.querySelector('input[value=custom]').checked = true" />
                            </div>
                        </label>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-primary" onclick="taskFlowApp?.proceedToTestStep?.()">
                            Continue
                        </button>
                        <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(2)">
                            Back
                        </button>
                    </div>
                `;
                break;
        }
        
        // Add global function
        window.proceedToTestStep = () => this.proceedToTestStep();
    }

    proceedToTestStep() {
        // Get selected model
        let selectedModel = '';
        const service = this.tempReconfigData.service;
        
        switch (service) {
            case 'ollama':
            case 'openwebui':
                selectedModel = document.getElementById('reconfigModelSelect')?.value;
                break;
            case 'openai':
                const selectedElement = document.querySelector('input[name="reconfigOpenaiModel"]:checked');
                if (selectedElement?.value === 'custom') {
                    selectedModel = document.getElementById('reconfigCustomModelName')?.value?.trim();
                    if (!selectedModel) {
                        this.notifications.showError('Please enter a model name');
                        return;
                    }
                } else {
                    selectedModel = selectedElement?.value;
                }
                break;
        }
        
        if (!selectedModel) {
            this.notifications.showError('Please select a model');
            return;
        }
        
        this.tempReconfigData.model = selectedModel;
        this.showReconfigStep(4);
        this.testReconfiguredAI();
    }

    async testReconfiguredAI() {
        const testConnection = document.getElementById('reconfigTestConnection');
        const testModel = document.getElementById('reconfigTestModel');
        const finalActions = document.getElementById('reconfigFinalActions');
        
        try {
            // Test connection
            if (testConnection) {
                const span = testConnection.querySelector('span:last-child');
                if (span) span.textContent = 'Testing connection...';
            }
            
            // Create temporary AI service for testing
            const tempConfig = {
                ...this.tempReconfigData,
                nameVariations: this.appState.onboardingData.nameVariations
            };
            
            const tempAIService = this.createAIService(tempConfig);
            const connectionResult = await tempAIService.testConnection();
            
            if (connectionResult.success) {
                if (testConnection) {
                    testConnection.className = 'test-item success';
                    const icon = testConnection.querySelector('.test-icon');
                    const span = testConnection.querySelector('span:last-child');
                    if (icon) icon.textContent = '✓';
                    if (span) span.textContent = 'Connection successful';
                }
                
                // Test model
                if (testModel) {
                    const span = testModel.querySelector('span:last-child');
                    if (span) span.textContent = 'Verifying model...';
                    
                    setTimeout(() => {
                        testModel.className = 'test-item success';
                        const icon = testModel.querySelector('.test-icon');
                        const modelSpan = testModel.querySelector('span:last-child');
                        if (icon) icon.textContent = '✓';
                        if (modelSpan) modelSpan.textContent = 'Model verified';
                        
                        // Show final actions
                        if (finalActions) {
                            finalActions.style.display = 'flex';
                        }
                    }, 500);
                }
            } else {
                throw new Error(connectionResult.message);
            }
            
        } catch (error) {
            Logger.error('AI reconfiguration test failed', error);
            
            if (testConnection) {
                testConnection.className = 'test-item error';
                const icon = testConnection.querySelector('.test-icon');
                const span = testConnection.querySelector('span:last-child');
                if (icon) icon.textContent = '❌';
                if (span) span.textContent = `Error: ${error.message}`;
            }
            
            if (finalActions) {
                finalActions.innerHTML = `
                    <button class="btn btn-secondary" onclick="taskFlowApp?.showReconfigStep?.(3)">
                        Back to Model Selection
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal('aiReconfig')">
                        Cancel
                    </button>
                `;
                finalActions.style.display = 'flex';
            }
        }
    }

    async saveAIReconfiguration() {
        try {
            if (!this.tempReconfigData) {
                throw new Error('No configuration data to save');
            }
            
            // Merge with existing configuration
            const newConfig = {
                ...this.appState.onboardingData,
                service: this.tempReconfigData.service,
                endpoint: this.tempReconfigData.endpoint,
                model: this.tempReconfigData.model,
                apiKey: this.tempReconfigData.apiKey,
                fallbackEndpoint: this.tempReconfigData.fallbackEndpoint
            };
            
            // Save configuration
            const saved = await this.authStorage.saveConfiguration(newConfig);
            if (!saved) {
                throw new Error('Failed to save configuration');
            }
            
            // Update app state
            this.appState.setOnboardingData(newConfig);
            
            // Recreate AI service with new configuration
            this.aiService = this.createAIService(newConfig);
            
            // Update managers with new AI service
            if (this.nameVariationsManager) {
                this.nameVariationsManager.aiService = this.aiService;
            }
            if (this.taskExtractionManager) {
                this.taskExtractionManager.aiService = this.aiService;
            }
            if (this.notesManager) {
                this.notesManager.aiService = this.aiService;
            }
            
            // Close modal and show success
            this.modalManager?.closeModal('aiReconfig');
            this.notifications.showSuccess('AI configuration updated successfully!');
            
            // Clear temporary data
            this.tempReconfigData = null;
            
            Logger.log('AI reconfiguration completed successfully', { 
                service: newConfig.service, 
                model: newConfig.model 
            });
            
        } catch (error) {
            Logger.error('Failed to save AI reconfiguration', error);
            this.notifications.showError('Failed to save configuration. Please try again.');
        }
    }

    async testAIConnection() {
        if (!this.aiService) {
            this.notifications.showError('No AI service configured');
            return;
        }
        
        const testBtn = document.querySelector('[onclick*="testAIConnection"]');
        if (testBtn) {
            const originalText = testBtn.textContent;
            testBtn.innerHTML = '<span class="loading"></span> Testing...';
            testBtn.disabled = true;
            
            try {
                const result = await this.aiService.testConnection();
                if (result.success) {
                    this.notifications.showSuccess('AI connection test successful!');
                } else {
                    this.notifications.showError(`Connection test failed: ${result.message}`);
                }
            } catch (error) {
                this.notifications.showError(`Connection test failed: ${error.message}`);
                Logger.error('AI connection test failed', error);
            } finally {
                if (testBtn) {
                    testBtn.textContent = originalText;
                    testBtn.disabled = false;
                }
            }
        }
    }

    // ============================================
    // CONFIGURATION VALIDATION
    // ============================================

    hasValidAIConfiguration(config) {
        if (!config) {
            Logger.log('No configuration found');
            return false;
        }

        // Check for required AI configuration fields (userName is optional for existing configs)
        const requiredFields = ['service', 'endpoint', 'model'];
        const hasRequiredFields = requiredFields.every(field => {
            const hasField = config[field] && config[field].trim() !== '';
            if (!hasField) {
                Logger.log(`Missing required field: ${field}`);
            }
            return hasField;
        });

        if (!hasRequiredFields) {
            Logger.log('Configuration missing required fields');
            return false;
        }

        // Check service-specific requirements
        if (config.service === 'openai' || config.service === 'openwebui') {
            if (!config.apiKey || config.apiKey.trim() === '') {
                Logger.log('OpenAI/OpenWebUI service requires API key');
                return false;
            }
        }

        // If userName is missing, add a default one
        if (!config.userName) {
            config.userName = 'User';
            Logger.log('Added default userName to configuration');
        }

        Logger.log('Valid AI configuration found', {
            service: config.service,
            model: config.model,
            hasApiKey: !!(config.apiKey),
            userName: config.userName
        });

        return true;
    }

    async destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Save final state
        try {
            if (authManager.isAuthenticated()) {
                await this.authStorage.saveTasks(this.appState.tasks);
            }
        } catch (error) {
            Logger.error('Failed to save on destroy', error);
        }
        
        Logger.log('TaskFlow AI destroyed');
    }
}

// Global app instance
let app = null;

// Initialize basic global functions immediately to prevent "function not defined" errors
function initializeBasicGlobalFunctions() {
    // Basic fallback functions that show loading messages
    const showLoadingMessage = () => {
        alert('The application is still loading. Please wait a moment and try again.');
    };
    
    // Notes functions
    window.openNotesModal = window.openNotesModal || showLoadingMessage;
    window.closeNotesModal = window.closeNotesModal || (() => {});
    window.saveNote = window.saveNote || showLoadingMessage;
    window.updateNote = window.updateNote || showLoadingMessage;
    window.generateSummary = window.generateSummary || showLoadingMessage;
    window.performExport = window.performExport || showLoadingMessage;
    window.copyNoteContent = window.copyNoteContent || showLoadingMessage;
    window.copySummary = window.copySummary || showLoadingMessage;
    window.exportSingleNote = window.exportSingleNote || showLoadingMessage;
    window.confirmDeleteNote = window.confirmDeleteNote || showLoadingMessage;
    window.switchTab = window.switchTab || showLoadingMessage;
    window.searchNotes = window.searchNotes || (() => {});
    window.sortNotes = window.sortNotes || (() => {});
    window.toggleTagFilter = window.toggleTagFilter || (() => {});
    window.clearTagFilters = window.clearTagFilters || (() => {});
    window.clearSearch = window.clearSearch || (() => {});
    window.openNote = window.openNote || showLoadingMessage;
    
    // Task functions
    window.openModal = window.openModal || showLoadingMessage;
    window.closeModal = window.closeModal || (() => {});
    window.saveQuickTask = window.saveQuickTask || showLoadingMessage;
    window.extractTask = window.extractTask || showLoadingMessage;
    window.saveExtractedTasks = window.saveExtractedTasks || showLoadingMessage;
    window.removeExtractedTask = window.removeExtractedTask || showLoadingMessage;
    window.resetAiModal = window.resetAiModal || (() => {});
    window.toggleTaskComplete = window.toggleTaskComplete || showLoadingMessage;
    window.toggleCompletedTasks = window.toggleCompletedTasks || (() => {});
    window.togglePostponedTasks = window.togglePostponedTasks || (() => {});
    window.togglePendingTasks = window.togglePendingTasks || (() => {});
    window.openSettings = window.openSettings || showLoadingMessage;
    
    Logger.log('Basic global functions initialized');
}

// Initialize basic functions immediately
initializeBasicGlobalFunctions();

// Function to setup global functions after app initialization
function setupGlobalFunctions(app) {
    // Global functions for HTML compatibility
    window.openModal = (type, taskId) => app.openModal(type, taskId);
    window.closeModal = (type) => app.closeModal(type);
    window.saveQuickTask = (event) => app.saveQuickTask(event);
    window.extractTask = (event) => app.extractTask(event);
    window.saveExtractedTasks = () => app.saveExtractedTasks();
    window.removeExtractedTask = (index) => app.removeExtractedTask(index);
    window.resetAiModal = () => app.resetAiModal();
    window.toggleTaskComplete = (taskId, event) => app.toggleTaskComplete(taskId, event);
    window.toggleCompletedTasks = () => app.toggleCompletedTasks();
    window.togglePostponedTasks = () => app.togglePostponedTasks();
    window.openSettings = () => app.openSettings();
    window.resetOnboarding = () => app.resetOnboarding();
    window.resetAIConfigOnly = () => app.resetAIConfigOnly();
    
    // AI Reconfiguration functions
    window.selectReconfigService = (service) => app.selectReconfigService(service);
    window.saveAIReconfiguration = () => app.saveAIReconfiguration();

    // Task management functions
    window.updateTask = (event) => app.updateTask(event);
    window.deleteTask = () => app.deleteTask();
    window.completeTask = () => app.completeTask();
    window.postponeTask = () => app.postponeTask();
    window.copyTask = () => app.copyTask();
    window.moveToToday = () => app.moveToToday();
    
    // Notes functions - properly initialized after app is ready
    window.openNotesModal = (type, noteId) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.openModal(type, noteId);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.closeNotesModal = (type) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.closeModal(type);
        } else {
            // Fallback: try to close modal manually
            const modalId = `notes${type.charAt(0).toUpperCase() + type.slice(1)}ModalOverlay`;
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.remove();
            }
        }
    };
    window.saveNote = (event) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.saveNote(event);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.updateNote = (event) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.updateNote(event);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.generateSummary = () => {
        if (app && app.notesModalManager) {
            app.notesModalManager.generateSummary();
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.performExport = () => {
        if (app && app.notesModalManager) {
            app.notesModalManager.performExport();
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.copyNoteContent = (noteId) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.copyNoteContent(noteId);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.copySummary = () => {
        if (app && app.notesModalManager) {
            app.notesModalManager.copySummary();
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.exportSingleNote = (noteId) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.exportSingleNote(noteId);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.confirmDeleteNote = (noteId) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.confirmDeleteNote(noteId);
        } else {
            console.error('Notes modal manager not initialized yet');
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    window.switchTab = (tab) => {
        if (app) {
            app.switchTab(tab);
        } else {
            // App not initialized yet
        }
    };
    window.searchNotes = (query) => {
        if (app && app.notesRenderer) {
            app.notesRenderer.setSearchQuery(query);
        } else {
            // Notes renderer not initialized yet
        }
    };
    window.sortNotes = (sortBy) => {
        if (app && app.notesRenderer) {
            app.notesRenderer.setSortBy(sortBy);
        } else {
            // Notes renderer not initialized yet
        }
    };
    window.toggleTagFilter = (tag) => {
        if (app && app.notesRenderer) {
            app.notesRenderer.toggleTagFilter(tag);
        } else {
            // Notes renderer not initialized yet
        }
    };
    window.clearTagFilters = () => {
        if (app && app.notesRenderer) {
            app.notesRenderer.clearTagFilters();
        } else {
            // Notes renderer not initialized yet
        }
    };
    window.clearSearch = () => {
        if (app) {
            app.clearSearch();
        } else {
            // App not initialized yet
        }
    };
    window.openNote = (noteId) => {
        if (app && app.notesModalManager) {
            app.notesModalManager.openModal('view', noteId);
        } else {
            alert('Notes functionality is still loading. Please wait a moment and try again.');
        }
    };
    
    Logger.log('Global functions setup completed after app initialization');
}

// Initialize app when DOM is ready
function initializeApp() {
    if (app) {
        app.destroy();
    }
    
    app = new TaskFlowApp();
    app.initialize();
    
    // Make app available globally for HTML onclick handlers
    window.taskFlowApp = app;
    
    // Make authManager globally available for settings modal
    window.authManager = authManager;
    
    // Pending task approval functions
    window.togglePendingTasks = () => app.togglePendingTasks();
    window.approvePendingTask = (pendingTaskId) => app.approvePendingTask(pendingTaskId);
    window.rejectPendingTask = (pendingTaskId) => app.rejectPendingTask(pendingTaskId);
    window.bulkApprovePendingTasks = () => app.bulkApprovePendingTasks();
    window.bulkRejectPendingTasks = () => app.bulkRejectPendingTasks();
    
    // Performance debugging functions
    window.getPerformanceReport = () => app.getPerformanceReport();
    window.clearPerformanceMetrics = () => {
        app.performanceMetrics.renderTimes = [];
        app.performanceMetrics.aiRequestTimes = [];
    };
    
    // Sync debugging functions
    window.getSyncStatus = () => app.authStorage?.getSyncStatus();
    window.forceSync = () => app.authStorage?.forceSync();
    
    // Auth debugging functions
    window.checkAuth = () => {
        console.log('Manual auth check:', {
            authToken: localStorage.getItem('auth_token'),
            authUI: app.authUI,
            isAuthenticated: app.authUI?.isAuthenticated(),
            isLoggedIn: app.authUI?.isLoggedIn
        });
        return app.authUI?.checkAuthStatus();
    };
    window.forceLogin = async (username, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        console.log('Login response:', data);
        if (data.token) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            app.authUI.authToken = data.token;
            app.authUI.currentUser = data.user;
            app.authUI.isLoggedIn = true;
            app.authUI.triggerAuthStateChange();
        }
        return data;
    };
    window.logout = () => {
        if (app.authUI) {
            app.authUI.logout();
        }
    };
    window.showAuthModal = () => {
        if (app.authUI) {
            app.authUI.showAuthModal();
        }
    };
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

export { TaskFlowApp };
