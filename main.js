// main.js - Complete Enhanced Main Application Entry Point

import { CONFIG, Logger } from './core/config.js';
import { StorageManager } from './core/storage.js';
import { AppState } from './core/state.js';

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

class TaskFlowApp {
    constructor() {
        this.appState = new AppState();
        this.aiService = null;
        this.notifications = new NotificationManager();
        
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
            
            // Load configuration
            const config = StorageManager.loadConfiguration();
            
            if (config && config.hasCompletedOnboarding) {
                await this.initializeMainApp(config);
            } else {
                this.initializeOnboarding();
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
        
        // Load tasks and notes
        const tasks = StorageManager.loadTasks();
        const notes = StorageManager.loadNotes();
        this.appState.setTasks(tasks);
        this.appState.setNotes(notes);
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Show main app
        this.showMainApp();
        
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
            // Save configuration
            const saved = StorageManager.saveConfiguration(config);
            if (!saved) {
                throw new Error('Failed to save configuration');
            }
            
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
        
        this.autoSaveInterval = setInterval(() => {
            try {
                StorageManager.saveTasks(this.appState.tasks);
                StorageManager.saveNotes(this.appState.notes);
            } catch (error) {
                Logger.error('Auto-save failed', error);
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
        
        Logger.log('Auto-save setup completed');
    }

    setupEventListeners() {
        // Listen to app state changes
        this.appState.addEventListener('tasksChanged', () => {
            if (this.taskRenderer) {
                this.taskRenderer.renderAll();
            }
            StorageManager.saveTasks(this.appState.tasks);
        });

        this.appState.addEventListener('notesChanged', () => {
            if (this.notesRenderer) {
                this.notesRenderer.refresh();
            }
            StorageManager.saveNotes(this.appState.notes);
        });

        this.appState.addEventListener('extractedTasksChanged', () => {
            if (this.modalManager) {
                this.modalManager.updateExtractedTasksPreview();
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
        window.addEventListener('beforeunload', () => {
            StorageManager.saveTasks(this.appState.tasks);
            StorageManager.saveNotes(this.appState.notes);
        });

        // Enhanced page visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this) {
                // Save state when page becomes hidden
                StorageManager.saveTasks(this.appState.tasks);
                
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

    openSettings() {
        this.modalManager?.openModal('settings');
    }

    resetOnboarding() {
        if (confirm('This will reset your AI configuration and delete all tasks and notes. Are you sure?')) {
            try {
                // Clear app state first
                this.appState.setTasks([]);
                this.appState.setNotes([]);
                
                // Clear all localStorage data
                StorageManager.clearAll();
                
                // Also clear any potential remaining localStorage items manually
                localStorage.clear();
                
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
                // Clear only AI-related configuration
                StorageManager.clearAIConfig();
                
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

    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Save final state
        StorageManager.saveTasks(this.appState.tasks);
        
        Logger.log('TaskFlow AI destroyed');
    }
}

// Global app instance
let app = null;

// Initialize app when DOM is ready
function initializeApp() {
    if (app) {
        app.destroy();
    }
    
    app = new TaskFlowApp();
    app.initialize();
    
    // Make app available globally for HTML onclick handlers
    window.taskFlowApp = app;
    
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
    
    // Task management functions
    window.updateTask = (event) => app.updateTask(event);
    window.deleteTask = () => app.deleteTask();
    window.completeTask = () => app.completeTask();
    window.postponeTask = () => app.postponeTask();
    window.copyTask = () => app.copyTask();
    window.moveToToday = () => app.moveToToday();
    
    // Notes functions
    window.openNotesModal = (type, noteId) => app.notesModalManager?.openModal(type, noteId);
    window.closeNotesModal = (type) => app.notesModalManager?.closeModal(type);
    window.saveNote = (event) => app.notesModalManager?.saveNote(event);
    window.updateNote = (event) => app.notesModalManager?.updateNote(event);
    window.generateSummary = () => app.notesModalManager?.generateSummary();
    window.performExport = () => app.notesModalManager?.performExport();
    window.copyNoteContent = (noteId) => app.notesModalManager?.copyNoteContent(noteId);
    window.copySummary = () => app.notesModalManager?.copySummary();
    window.exportSingleNote = (noteId) => app.notesModalManager?.exportSingleNote(noteId);
    window.confirmDeleteNote = (noteId) => app.notesModalManager?.confirmDeleteNote(noteId);
    window.switchTab = (tab) => app.switchTab(tab);
    window.searchNotes = (query) => app.notesRenderer?.setSearchQuery(query);
    window.sortNotes = (sortBy) => app.notesRenderer?.setSortBy(sortBy);
    window.toggleTagFilter = (tag) => app.notesRenderer?.toggleTagFilter(tag);
    window.clearTagFilters = () => app.notesRenderer?.clearTagFilters();
    window.clearSearch = () => app.clearSearch();
    window.openNote = (noteId) => app.notesModalManager?.openModal('view', noteId);
    
    // Performance debugging functions
    window.getPerformanceReport = () => app.getPerformanceReport();
    window.clearPerformanceMetrics = () => {
        app.performanceMetrics.renderTimes = [];
        app.performanceMetrics.aiRequestTimes = [];
    };
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

export { TaskFlowApp };
