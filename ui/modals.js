// ui/modals.js - Enhanced Modal Management with Tabbed Settings

import { Logger, DEFAULT_NOTES_TITLE_PROMPT, DEFAULT_NOTES_SUMMARY_PROMPT, DEFAULT_NOTES_TASK_EXTRACTION_PROMPT } from '../core/config.js';

export class ModalManager {
    constructor(appState, dependencies) {
        this.appState = appState;
        this.taskExtraction = dependencies.taskExtraction;
        this.nameVariations = dependencies.nameVariations;
        this.notifications = dependencies.notifications;
        this.currentSettingsTab = 'general';
        
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Close modal when clicking overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    const modalType = overlay.id.replace('ModalOverlay', '').replace('Modal', '');
                    this.closeModal(modalType);
                }
            });
        });
    }

    openModal(type, taskId = null) {
        try {
            switch (type) {
                case 'quick':
                    this.openQuickTaskModal();
                    break;
                case 'ai':
                    this.openAITaskModal();
                    break;
                case 'edit':
                    this.openEditTaskModal(taskId);
                    break;
                case 'settings':
                    this.openSettingsModal();
                    break;
                case 'aiReconfig':
                    this.openAIReconfigModal();
                    break;
                case 'pendingTasks':
                    this.openPendingTasksModal();
                    break;
                default:
                    Logger.warn('Unknown modal type', { type });
            }
        } catch (error) {
            Logger.error('Failed to open modal', error);
            this.notifications.showError('Failed to open modal. Please try again.');
        }
    }

    closeModal(type) {
        try {
            const modalMap = {
                'quick': 'quickModalOverlay',
                'ai': 'aiModalOverlay',
                'edit': 'editModalOverlay',
                'settings': 'settingsModalOverlay',
                'aiReconfig': 'aiReconfigModalOverlay'
            };
            
            const modalId = modalMap[type];
            if (modalId) {
                const overlay = document.getElementById(modalId);
                if (overlay) {
                    overlay.classList.remove('active');
                    overlay.style.display = 'none';
                }
            }
            
            // Reset forms and state
            this.resetModalState(type);
            
            Logger.log(`Closed ${type} modal`);
        } catch (error) {
            Logger.error('Failed to close modal', error);
        }
    }

    resetModalState(type) {
        switch (type) {
            case 'quick':
                document.getElementById('quickTaskForm')?.reset();
                break;
            case 'ai':
                this.resetAiModal();
                break;
            case 'edit':
                this.appState.setCurrentTaskId(null);
                break;
            case 'settings':
                this.currentSettingsTab = 'general';
                this.updateUserNameFromSettings();
                break;
        }
    }

    openQuickTaskModal() {
        const overlay = document.getElementById('quickModalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
            
            setTimeout(() => {
                document.getElementById('quickTaskName')?.focus();
            }, 100);
        }
    }

    openAITaskModal() {
        const overlay = document.getElementById('aiModalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
            
            this.resetAiModal();
            setTimeout(() => {
                document.getElementById('aiTaskInput')?.focus();
            }, 100);
        }
    }

    openEditTaskModal(taskId) {
        if (!taskId) {
            this.notifications.showError('Task ID is required');
            return;
        }

        const task = this.appState.getTask(taskId);
        if (!task) {
            this.notifications.showError('Task not found');
            return;
        }

        this.appState.setCurrentTaskId(taskId);
        
        // Populate form fields
        document.getElementById('editTaskName').value = task.name || '';
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskNotes').value = task.notes || '';
        
        // Generate appropriate buttons based on task state
        this.generateEditModalButtons(task);
        
        const overlay = document.getElementById('editModalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
        }
    }

    generateEditModalButtons(task) {
        const buttonGroup = document.getElementById('editButtonGroup');
        if (!buttonGroup) return;

        const readOnly = task.completed || task.postponed;
        
        // Set form fields to read-only if needed
        ['editTaskName', 'editTaskDescription', 'editTaskNotes'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.readOnly = readOnly;
            }
        });

        let buttonsHTML = '';
        
        if (task.completed) {
            buttonsHTML = `
                <button type="button" class="btn btn-primary" onclick="taskFlowApp?.copyTask?.()">Copy to Today</button>
                <button type="button" class="btn btn-danger" onclick="taskFlowApp?.deleteTask?.()">Delete</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit')">Cancel</button>
            `;
        } else if (task.postponed) {
            buttonsHTML = `
                <button type="button" class="btn btn-primary" onclick="taskFlowApp?.moveToToday?.()">Move to Today</button>
                <button type="button" class="btn btn-danger" onclick="taskFlowApp?.deleteTask?.()">Delete</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit')">Cancel</button>
            `;
        } else {
            buttonsHTML = `
                <button type="submit" class="btn btn-secondary" onclick="taskFlowApp?.updateTask?.(event)">Save Changes</button>
                <button type="button" class="btn btn-secondary" onclick="taskFlowApp?.postponeTask?.()">Postpone</button>
                <button type="button" class="btn btn-primary" onclick="taskFlowApp?.completeTask?.()">Complete</button>
            `;
        }
        
        buttonGroup.innerHTML = buttonsHTML;
    }

    openSettingsModal() {
        this.populateSettingsModal();
        
        const overlay = document.getElementById('settingsModalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
        }
    }

    openAIReconfigModal() {
        const overlay = document.getElementById('aiReconfigModalOverlay');
        const content = document.getElementById('aiReconfigContent');
        
        if (!overlay || !content) {
            this.notifications.showError('AI reconfiguration modal not found');
            return;
        }

        // Generate the AI reconfiguration content
        content.innerHTML = this.generateAIReconfigContent();
        
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        
        Logger.log('AI reconfiguration modal opened');
    }

    generateAIReconfigContent() {
        const currentConfig = this.appState.onboardingData;
        
        return `
            <div class="ai-reconfig-steps">
                <!-- Step 1: Service Selection -->
                <div class="reconfig-step active" id="reconfigStep1">
                    <h3>Choose AI Service</h3>
                    <p class="step-description">Select which AI service you'd like to use</p>
                    
                    <div class="service-options">
                        <button class="service-option ${currentConfig.service === 'ollama' ? 'selected' : ''}" 
                                onclick="selectReconfigService('ollama')">
                            <div class="service-icon">🦙</div>
                            <h4>Ollama</h4>
                            <p>Local or self-hosted AI models</p>
                        </button>
                        <button class="service-option ${currentConfig.service === 'openai' ? 'selected' : ''}" 
                                onclick="selectReconfigService('openai')">
                            <div class="service-icon">🤖</div>
                            <h4>OpenAI</h4>
                            <p>GPT models via API</p>
                        </button>
                        <button class="service-option ${currentConfig.service === 'openwebui' ? 'selected' : ''}" 
                                onclick="selectReconfigService('openwebui')">
                            <div class="service-icon">🌐</div>
                            <h4>Open WebUI</h4>
                            <p>Unified interface for multiple AI models</p>
                        </button>
                    </div>
                    
                    <div class="reconfig-actions">
                        <button class="btn btn-secondary" onclick="closeModal('aiReconfig')">Cancel</button>
                    </div>
                </div>

                <!-- Step 2: Service Configuration -->
                <div class="reconfig-step" id="reconfigStep2" style="display: none;">
                    <div id="reconfigServiceContent">
                        <!-- Service-specific configuration will be inserted here -->
                    </div>
                </div>

                <!-- Step 3: Model Selection -->
                <div class="reconfig-step" id="reconfigStep3" style="display: none;">
                    <div id="reconfigModelContent">
                        <!-- Model selection will be inserted here -->
                    </div>
                </div>

                <!-- Step 4: Test & Save -->
                <div class="reconfig-step" id="reconfigStep4" style="display: none;">
                    <h3>Test & Save Configuration</h3>
                    <p class="step-description">Let's test your new configuration</p>
                    
                    <div class="test-status" id="reconfigTestStatus">
                        <div class="test-item" id="reconfigTestConnection">
                            <span class="test-icon">⏳</span>
                            <span>Testing connection...</span>
                        </div>
                        <div class="test-item" id="reconfigTestModel">
                            <span class="test-icon">⏳</span>
                            <span>Verifying model...</span>
                        </div>
                    </div>
                    
                    <div class="reconfig-actions" id="reconfigFinalActions" style="display: none;">
                        <button class="btn btn-primary" onclick="saveAIReconfiguration()">
                            Save Configuration
                        </button>
                        <button class="btn btn-secondary" onclick="closeModal('aiReconfig')">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    populateSettingsModal() {
        const content = document.getElementById('settingsContent');
        if (!content) return;

        const onboardingData = this.appState.onboardingData;
        const nameVariations = this.nameVariations.getVariationsAsString();

        content.innerHTML = `
            <div class="settings-tabs">
                <button class="settings-tab ${this.currentSettingsTab === 'general' ? 'active' : ''}" 
                        onclick="taskFlowApp?.switchSettingsTab?.('general')">
                    <span class="tab-icon">👤</span>
                    General
                </button>
                <button class="settings-tab ${this.currentSettingsTab === 'ai' ? 'active' : ''}" 
                        onclick="taskFlowApp?.switchSettingsTab?.('ai')">
                    <span class="tab-icon">🤖</span>
                    AI Configuration
                </button>
                <button class="settings-tab ${this.currentSettingsTab === 'data' ? 'active' : ''}" 
                        onclick="taskFlowApp?.switchSettingsTab?.('data')">
                    <span class="tab-icon">💾</span>
                    Data Management
                </button>
                <button class="settings-tab ${this.currentSettingsTab === 'advanced' ? 'active' : ''}" 
                        onclick="taskFlowApp?.switchSettingsTab?.('advanced')">
                    <span class="tab-icon">⚙️</span>
                    Advanced
                </button>
            </div>

            <div class="settings-tab-content">
                ${this.generateTabContent(this.currentSettingsTab, onboardingData, nameVariations)}
            </div>

            <div class="settings-footer">
                <button class="btn btn-secondary" onclick="closeModal('settings')">Close</button>
            </div>
        `;
    }

    generateTabContent(tab, onboardingData, nameVariations) {
        switch (tab) {
            case 'general':
                return this.generateGeneralTabContent(onboardingData, nameVariations);
            case 'ai':
                return this.generateAITabContent(onboardingData);
            case 'data':
                return this.generateDataTabContent();
            case 'advanced':
                return this.generateAdvancedTabContent();
            default:
                return '';
        }
    }

    generateGeneralTabContent(onboardingData, nameVariations) {
        // Check if user is authenticated using centralized auth manager
        const authManager = window.authManager || (window.taskFlowApp?.authManager);
        const isAuthenticated = authManager?.isAuthenticated?.() || false;
        const currentUser = authManager?.getCurrentUser?.();
        
        return `
            <div class="tab-section">
                <h3>Account Information</h3>
                ${isAuthenticated ? `
                    <div class="account-status authenticated">
                        <div class="account-info">
                            <span class="account-icon">✅</span>
                            <div class="account-details">
                                <strong>Signed in as: ${currentUser?.username || 'Unknown'}</strong>
                                <p>Your data is synced across devices</p>
                            </div>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-secondary" onclick="taskFlowApp?.authUI?.showAuthModal?.()">
                                Switch Account
                            </button>
                            <button class="btn btn-danger" onclick="authManager?.logout?.()">
                                Sign Out
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="account-status guest">
                        <div class="account-info">
                            <span class="account-icon">👤</span>
                            <div class="account-details">
                                <strong>Guest Mode</strong>
                                <p>Data is stored locally only</p>
                            </div>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-primary" onclick="taskFlowApp?.authUI?.showAuthModal?.()">
                                Sign In / Create Account
                            </button>
                        </div>
                        <div class="guest-benefits">
                            <p><strong>Benefits of creating an account:</strong></p>
                            <ul>
                                <li>✅ Access your tasks from any device</li>
                                <li>✅ Automatic data backup</li>
                                <li>✅ Never lose your data</li>
                            </ul>
                        </div>
                    </div>
                `}
            </div>

            <div class="tab-section">
                <h3>Personal Information</h3>
                <div class="setting-item">
                    <label for="settingsUserName">Your Name</label>
                    <input type="text" id="settingsUserName" value="${onboardingData.userName || ''}" />
                    <p class="setting-description">This is how TaskFlow AI identifies you in emails and messages</p>
                </div>
                
                <div class="setting-item">
                    <label for="nameVariations">Name Variations</label>
                    <p class="setting-description">Names and nicknames you might be called in emails and messages</p>
                    <input type="text" id="nameVariations" class="name-variations-input" 
                           placeholder="e.g., Robert, Bob, Rob, Bobby" value="${nameVariations}" />
                    <div class="name-variations-actions">
                        <button class="btn btn-secondary" onclick="taskFlowApp?.suggestNameVariations?.()">
                            ✨ Get AI Suggestions
                        </button>
                        <button class="btn btn-primary" onclick="taskFlowApp?.saveNameVariations?.()">
                            Save Variations
                        </button>
                    </div>
                    <div class="setting-hint">
                        <strong>💡 Tip:</strong> Include nicknames, shortened versions, and formal/informal variations. 
                        Separate with commas. This helps AI identify tasks assigned to you even when people use different names.
                    </div>
                </div>
            </div>
        `;
    }

    generateAITabContent(onboardingData) {
        return `
            <div class="tab-section">
                <h3>Current AI Configuration</h3>
                <div class="ai-config-display">
                    <div class="config-item">
                        <span class="config-label">Service:</span>
                        <span class="config-value">${this.getServiceDisplayName(onboardingData.service)}</span>
                    </div>
                    <div class="config-item">
                        <span class="config-label">Model:</span>
                        <span class="config-value">${onboardingData.model || 'Unknown'}</span>
                    </div>
                    <div class="config-item">
                        <span class="config-label">Endpoint:</span>
                        <span class="config-value endpoint">${onboardingData.endpoint || 'Not configured'}</span>
                    </div>
                    ${onboardingData.apiKey ? `
                    <div class="config-item">
                        <span class="config-label">API Key:</span>
                        <span class="config-value">••••••••${onboardingData.apiKey.slice(-4)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="setting-item">
                    <button class="btn btn-primary" onclick="taskFlowApp?.openAIReconfigModal?.()">
                        🔄 Reconfigure AI Service
                    </button>
                    <p class="setting-description">Change your AI service, model, or connection settings</p>
                </div>
                
                <div class="setting-item">
                    <button class="btn btn-secondary" onclick="taskFlowApp?.testAIConnection?.()">
                        🧪 Test Current Configuration
                    </button>
                    <p class="setting-description">Verify that your AI service is working correctly</p>
                </div>
            </div>
        `;
    }

    generateDataTabContent() {
        return `
            <div class="tab-section">
                <h3>Export Your Data</h3>
                <div class="export-grid">
                    <div class="export-option">
                        <div class="export-header">
                            <span class="export-icon">📄</span>
                            <h4>JSON Backup</h4>
                        </div>
                        <p>Complete backup with all settings and metadata</p>
                        <button class="btn btn-secondary" onclick="exportData('json')">Export JSON</button>
                    </div>
                    
                    <div class="export-option">
                        <div class="export-header">
                            <span class="export-icon">📝</span>
                            <h4>Markdown</h4>
                        </div>
                        <p>Human-readable task list for sharing</p>
                        <button class="btn btn-secondary" onclick="exportData('markdown')">Export Markdown</button>
                    </div>
                    
                    <div class="export-option">
                        <div class="export-header">
                            <span class="export-icon">🔗</span>
                            <h4>Obsidian</h4>
                        </div>
                        <p>Optimized for Obsidian with tags and links</p>
                        <button class="btn btn-secondary" onclick="exportData('obsidian')">Export Obsidian</button>
                    </div>
                    
                    <div class="export-option">
                        <div class="export-header">
                            <span class="export-icon">📊</span>
                            <h4>CSV</h4>
                        </div>
                        <p>Spreadsheet-compatible format</p>
                        <button class="btn btn-secondary" onclick="exportData('csv')">Export CSV</button>
                    </div>
                </div>
                
                <h3>Import Data</h3>
                <div class="import-section">
                    <input type="file" id="importFile" accept=".json,.md,.csv" style="display: none;" 
                           onchange="handleImportFile(this)" />
                    <button class="btn btn-primary import-btn" onclick="document.getElementById('importFile').click()">
                        📁 Choose File to Import
                    </button>
                    <p class="setting-description">
                        Supports: JSON (TaskFlow backup), Markdown (including Obsidian), CSV
                    </p>
                </div>
                
                <div class="import-preview-container" id="importPreview" style="display: none;">
                    <div class="import-preview-header">
                        <h4>📋 Import Preview</h4>
                        <button class="close-preview-btn" onclick="cancelImport()" title="Cancel import">×</button>
                    </div>
                    <div id="importDetails" class="import-details"></div>
                    <div class="import-actions">
                        <button class="btn btn-primary" onclick="confirmImport()">
                            ✅ Confirm Import
                        </button>
                        <button class="btn btn-secondary" onclick="cancelImport()">
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    generateAdvancedTabContent() {
        return `
            <div class="tab-section">
                <h3>AI System Prompt</h3>
                <div class="setting-item">
                    <label for="systemPrompt">Task Extraction Prompt</label>
                    <p class="setting-description">Customize how AI extracts tasks from your text</p>
                    <textarea id="systemPrompt" class="system-prompt-textarea" 
                              placeholder="Enter custom system prompt...">${this.taskExtraction.getSystemPrompt()}</textarea>
                    <div class="setting-hint">
                        <strong>💡 Tip:</strong> Your prompt should instruct the AI to return JSON with "title", "description", 
                        and "notes" fields. The default prompt works well for most cases and automatically includes your name variations.
                    </div>
                    <div class="prompt-actions">
                        <button class="btn btn-secondary" onclick="taskFlowApp?.resetToDefaultPrompt?.()">
                            Reset to Default
                        </button>
                        <button class="btn btn-primary" onclick="taskFlowApp?.saveSystemPrompt?.()">
                            Save Prompt
                        </button>
                    </div>
                </div>

                <h3>Notes AI Prompts</h3>
                <div class="setting-item">
                    <label for="notesTitlePrompt">Notes Title Generation Prompt</label>
                    <p class="setting-description">Customize how AI generates titles for your notes</p>
                    <textarea id="notesTitlePrompt" class="system-prompt-textarea" 
                              placeholder="Enter notes title prompt...">${this.getNotesPrompt('title')}</textarea>
                    <div class="setting-hint">
                        <strong>💡 Tip:</strong> Use {CONTENT} as a placeholder for the note content.
                    </div>
                    <div class="prompt-actions">
                        <button class="btn btn-secondary" onclick="taskFlowApp?.resetNotesPrompt?.('title')">
                            Reset to Default
                        </button>
                        <button class="btn btn-primary" onclick="taskFlowApp?.saveNotesPrompt?.('title')">
                            Save Prompt
                        </button>
                    </div>
                </div>

                <div class="setting-item">
                    <label for="notesSummaryPrompt">Notes Summary Generation Prompt</label>
                    <p class="setting-description">Customize how AI creates summaries for your notes</p>
                    <textarea id="notesSummaryPrompt" class="system-prompt-textarea" 
                              placeholder="Enter notes summary prompt...">${this.getNotesPrompt('summary')}</textarea>
                    <div class="setting-hint">
                        <strong>💡 Tip:</strong> Use {CONTENT} as a placeholder for the note content.
                    </div>
                    <div class="prompt-actions">
                        <button class="btn btn-secondary" onclick="taskFlowApp?.resetNotesPrompt?.('summary')">
                            Reset to Default
                        </button>
                        <button class="btn btn-primary" onclick="taskFlowApp?.saveNotesPrompt?.('summary')">
                            Save Prompt
                        </button>
                    </div>
                </div>

                <div class="setting-item">
                    <label for="notesTaskExtractionPrompt">Notes Task Extraction Prompt</label>
                    <p class="setting-description">Customize how AI extracts tasks from your notes</p>
                    <textarea id="notesTaskExtractionPrompt" class="system-prompt-textarea" 
                              placeholder="Enter notes task extraction prompt...">${this.getNotesPrompt('taskExtraction')}</textarea>
                    <div class="setting-hint">
                        <strong>💡 Tip:</strong> Use {USER_NAME}, {NAME_CONTEXT}, {TITLE}, and {CONTENT} as placeholders. 
                        Must return valid JSON with tasks array.
                    </div>
                    <div class="prompt-actions">
                        <button class="btn btn-secondary" onclick="taskFlowApp?.resetNotesPrompt?.('taskExtraction')">
                            Reset to Default
                        </button>
                        <button class="btn btn-primary" onclick="taskFlowApp?.saveNotesPrompt?.('taskExtraction')">
                            Save Prompt
                        </button>
                    </div>
                </div>
                
                <h3>Application Settings</h3>
                <div class="setting-item">
                    <label>Reset Application</label>
                    <p class="setting-description">Clear all data and restart TaskFlow AI from scratch</p>
                    <button class="btn btn-danger" onclick="resetOnboarding()">
                        🗑️ Reset All Data
                    </button>
                </div>
            </div>
        `;
    }

    switchSettingsTab(tab) {
        this.currentSettingsTab = tab;
        this.populateSettingsModal();
    }

    updateUserNameFromSettings() {
        try {
            const newName = document.getElementById('settingsUserName')?.value?.trim();
            if (newName && newName !== this.appState.onboardingData.userName && newName.length >= 2) {
                this.appState.updateOnboardingField('userName', newName);
                // Note: User name is now saved automatically through app state changes
                
                const greetingElement = document.getElementById('userGreeting');
                if (greetingElement) {
                    greetingElement.textContent = newName;
                }
                
                // Update name variations if only the original name was stored
                const variations = this.appState.onboardingData.nameVariations;
                if (variations && variations.length === 1) {
                    const newVariations = [newName];
                    this.appState.updateOnboardingField('nameVariations', newVariations);
                    // Note: Name variations are now saved automatically through app state changes
                }
                
                Logger.log('User name updated', { newName });
            }
        } catch (error) {
            Logger.error('Failed to update user name', error);
        }
    }

    resetAiModal() {
        const aiTaskForm = document.getElementById('aiTaskForm');
        const extractedTaskPreview = document.getElementById('extractedTaskPreview');
        
        if (aiTaskForm) {
            aiTaskForm.style.display = 'block';
            aiTaskForm.reset();
        }
        
        if (extractedTaskPreview) {
            extractedTaskPreview.style.display = 'none';
        }
        
        this.taskExtraction.clearExtractedTasks();
    }

    showExtractedTasksPreview(tasks) {
        const aiTaskForm = document.getElementById('aiTaskForm');
        const extractedTaskPreview = document.getElementById('extractedTaskPreview');
        const extractedTaskContent = document.getElementById('extractedTaskContent');
        
        if (!extractedTaskPreview || !extractedTaskContent) return;
        
        // Hide the input form
        if (aiTaskForm) {
            aiTaskForm.style.display = 'none';
        }
        
        // Update header to show count
        const header = extractedTaskPreview.querySelector('h3');
        if (header) {
            header.textContent = tasks.length === 1 ? 'Extracted Task' : `Extracted ${tasks.length} Tasks`;
        }
        
        // Generate preview content
        extractedTaskContent.innerHTML = this.generateExtractedTasksHTML(tasks);
        
        // Show preview
        extractedTaskPreview.style.display = 'block';
        
        // Update save button text
        const saveButton = extractedTaskPreview.querySelector('.btn-primary');
        if (saveButton) {
            saveButton.textContent = tasks.length === 1 ? 'Save Task' : `Save All ${tasks.length} Tasks`;
        }
    }

    generateExtractedTasksHTML(tasks) {
        return tasks.map((task, index) => `
            <div class="extracted-task-item">
                <div class="task-header">
                    <h4>Task ${index + 1}</h4>
                    <div class="task-actions">
                        <button type="button" class="btn-small btn-danger" 
                                onclick="removeExtractedTask(${index})" title="Remove task">×</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" id="extractedTaskName${index}" 
                           value="${this.escapeHtml(task.title)}" 
                           onchange="taskFlowApp?.updateExtractedTask?.(${index}, 'title', this.value)" />
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="extractedTaskDescription${index}" 
                              onchange="taskFlowApp?.updateExtractedTask?.(${index}, 'description', this.value)">${this.escapeHtml(task.description)}</textarea>
                </div>
                <div class="form-group">
                    <label>Additional Notes</label>
                    <textarea id="extractedTaskNotes${index}" 
                              onchange="taskFlowApp?.updateExtractedTask?.(${index}, 'notes', this.value)">${this.escapeHtml(task.notes)}</textarea>
                </div>
            </div>
        `).join('');
    }

    updateExtractedTasksPreview() {
        const tasks = this.appState.extractedTasks;
        if (tasks.length > 0) {
            this.showExtractedTasksPreview(tasks);
        }
    }

    getServiceDisplayName(service) {
        const serviceMap = {
            'ollama': 'Ollama',
            'openai': 'OpenAI',
            'openwebui': 'Open WebUI'
        };
        return serviceMap[service] || service || 'Unknown';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    getNotesPrompt(type) {
        const onboardingData = this.appState.onboardingData;
        switch (type) {
            case 'title':
                return onboardingData.notesTitlePrompt || this.getDefaultNotesPrompt('title');
            case 'summary':
                return onboardingData.notesSummaryPrompt || this.getDefaultNotesPrompt('summary');
            case 'taskExtraction':
                return onboardingData.notesTaskExtractionPrompt || this.getDefaultNotesPrompt('taskExtraction');
            default:
                return '';
        }
    }

    getDefaultNotesPrompt(type) {
        switch (type) {
            case 'title':
                return DEFAULT_NOTES_TITLE_PROMPT;
            case 'summary':
                return DEFAULT_NOTES_SUMMARY_PROMPT;
            case 'taskExtraction':
                return DEFAULT_NOTES_TASK_EXTRACTION_PROMPT;
            default:
                return '';
        }
    }

    // Global functions that will be attached to the app instance
    setupGlobalModalFunctions(app) {
        app.switchSettingsTab = (tab) => {
            this.switchSettingsTab(tab);
        };

        app.updateExtractedTask = (index, field, value) => {
            this.taskExtraction.updateExtractedTask(index, field, value);
        };

        app.saveNameVariations = () => {
            const input = document.getElementById('nameVariations')?.value?.trim();
            if (!input) {
                this.notifications.showError('Please enter at least one name variation');
                return;
            }
            
            const variations = this.nameVariations.parseVariationsInput(input);
            const result = this.nameVariations.saveVariations(variations);
            
            if (result.success) {
                this.notifications.showSuccess('Name variations saved successfully!');
                Logger.log('Name variations saved from settings modal', { variations: result.variations });
            } else {
                this.notifications.showError(result.message);
            }
        };

        app.suggestNameVariations = async () => {
            const userName = this.appState.onboardingData.userName;
            if (!userName) {
                this.notifications.showError('Please set your name first');
                return;
            }
            
            const suggestBtn = document.querySelector('[onclick*="suggestNameVariations"]');
            if (suggestBtn) {
                const originalText = suggestBtn.textContent;
                suggestBtn.innerHTML = '<span class="loading"></span> Getting suggestions...';
                suggestBtn.disabled = true;
                
                try {
                    const variations = await this.nameVariations.discoverVariations(userName);
                    const input = document.getElementById('nameVariations');
                    if (input) {
                        input.value = variations.join(', ');
                    }
                    
                    this.notifications.showSuccess(`Found ${variations.length} name variations! Click "Save Variations" to apply them.`);
                    Logger.log('Name variations suggested', { variations });
                } catch (error) {
                    this.notifications.showError('Failed to get suggestions. Please try again.');
                    Logger.error('Failed to suggest name variations', error);
                } finally {
                    if (suggestBtn) {
                        suggestBtn.textContent = originalText;
                        suggestBtn.disabled = false;
                    }
                }
            }
        };

        app.saveSystemPrompt = () => {
            const prompt = document.getElementById('systemPrompt')?.value?.trim();
            if (!prompt) {
                this.notifications.showError('Please enter a valid prompt');
                return;
            }
            
            if (!prompt.toLowerCase().includes('json')) {
                if (!confirm('Your prompt doesn\'t mention JSON format. This may cause extraction to fail. Continue anyway?')) {
                    return;
                }
            }
            
            // Note: System prompts are now saved automatically through app state changes
            this.appState.updateOnboardingField('systemPrompt', prompt);
            this.notifications.showSuccess('System prompt saved successfully!');
        };

        app.resetToDefaultPrompt = () => {
            const textarea = document.getElementById('systemPrompt');
            if (textarea) {
                textarea.value = this.taskExtraction.getSystemPrompt();
                this.notifications.showSuccess('Reset to default prompt');
            }
        };

        app.saveNotesPrompt = (type) => {
            const elementId = `notes${type.charAt(0).toUpperCase() + type.slice(1)}Prompt`;
            const prompt = document.getElementById(elementId)?.value?.trim();
            
            if (!prompt) {
                this.notifications.showError('Please enter a valid prompt');
                return;
            }
            
            switch (type) {
                case 'title':
                    this.appState.updateOnboardingField('notesTitlePrompt', prompt);
                    break;
                case 'summary':
                    this.appState.updateOnboardingField('notesSummaryPrompt', prompt);
                    break;
                case 'taskExtraction':
                    if (!prompt.toLowerCase().includes('json')) {
                        if (!confirm('Your prompt doesn\'t mention JSON format. This may cause task extraction to fail. Continue anyway?')) {
                            return;
                        }
                    }
                    this.appState.updateOnboardingField('notesTaskExtractionPrompt', prompt);
                    break;
            }
            
            // Note: Notes prompts are now saved automatically through app state changes
            this.notifications.showSuccess(`Notes ${type} prompt saved successfully!`);
        };

        app.resetNotesPrompt = (type) => {
            const elementId = `notes${type.charAt(0).toUpperCase() + type.slice(1)}Prompt`;
            const textarea = document.getElementById(elementId);
            if (textarea) {
                textarea.value = this.getDefaultNotesPrompt(type);
                this.notifications.showSuccess(`Reset to default ${type} prompt`);
            }
        };
    }
}
