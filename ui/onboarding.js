// ui/onboarding.js - Fixed Onboarding Management

import { CONFIG, Logger } from '../core/config.js';
import { OllamaService } from '../services/ollamaService.js';
import { OpenAIService } from '../services/openaiService.js';
import { OpenWebUIService } from '../services/openwebuiService.js';
import { NameVariationsManager } from '../features/nameVariations.js';

export class OnboardingManager {
    constructor(appState, dependencies) {
        this.appState = appState;
        this.notifications = dependencies.notifications;
        this.onComplete = dependencies.onComplete;
        
        this.currentStep = 1;
        this.selectedService = '';
        this.tempAIService = null;
        this.nameVariationsManager = null;
        
        this.setupOnboardingEvents();
    }

    setupOnboardingEvents() {
        // Make methods available globally for HTML onclick handlers
        window.nextStep = (fromStep) => this.nextStep(fromStep);
        window.previousStep = (fromStep) => this.previousStep(fromStep);
        window.selectService = (service) => this.selectService(service);
        window.testOllamaConnection = () => this.testOllamaConnection();
        window.testOpenWebUIConnection = () => this.testOpenWebUIConnection();
        window.completeOnboarding = () => this.completeOnboarding();
        
        Logger.log('Onboarding global functions setup completed');
    }

    async nextStep(fromStep) {
        try {
            Logger.log(`Moving from step ${fromStep} to next step`);
            
            if (fromStep === 1) {
                if (await this.validateStep1()) {
                    this.showStep(2);
                }
            } else if (fromStep === 3) {
                if (this.selectedService === 'openai') {
                    if (await this.validateOpenAIStep()) {
                        this.showStep(4);
                    }
                }
                // For other services, connection test handles moving to next step
            } else if (fromStep === 4) {
                if (await this.validateModelSelection()) {
                    this.showStep(5);
                    this.testConfiguration();
                }
            }
        } catch (error) {
            Logger.error('Error in nextStep', error);
            this.notifications.showError('An error occurred. Please try again.');
        }
    }

    async validateStep1() {
        const userName = document.getElementById('userName')?.value?.trim();
        Logger.log('Validating step 1', { userName });
        
        if (!userName) {
            this.notifications.showError('Please enter your name');
            return false;
        }
        if (userName.length < 2) {
            this.notifications.showError('Name must be at least 2 characters long');
            return false;
        }
        
        this.appState.updateOnboardingField('userName', userName);
        Logger.log('Step 1 validation passed', { userName });
        return true;
    }

    async validateOpenAIStep() {
        const apiKey = document.getElementById('openaiKey')?.value?.trim();
        if (!apiKey) {
            this.notifications.showError('Please enter your OpenAI API key');
            return false;
        }
        
        const validation = OpenAIService.validateApiKey(apiKey);
        if (!validation.valid) {
            this.notifications.showError(validation.message);
            return false;
        }
        
        const endpoint = document.getElementById('openaiEndpoint')?.value?.trim() || 
            CONFIG.DEFAULT_ENDPOINTS.openai;
        
        this.appState.updateOnboardingField('apiKey', apiKey);
        this.appState.updateOnboardingField('endpoint', endpoint);
        return true;
    }

    async validateModelSelection() {
        let selectedModel = '';
        
        if (this.selectedService === 'ollama') {
            selectedModel = document.getElementById('ollamaModelSelect')?.value;
        } else if (this.selectedService === 'openwebui') {
            selectedModel = document.getElementById('openwebuiModelSelect')?.value;
        } else if (this.selectedService === 'openai') {
            const selectedElement = document.querySelector('input[name="openaiModel"]:checked');
            if (selectedElement?.value === 'custom') {
                selectedModel = document.getElementById('customModelName')?.value?.trim();
                if (!selectedModel) {
                    this.notifications.showError('Please enter a model name');
                    return false;
                }
            } else {
                selectedModel = selectedElement?.value;
            }
        }
        
        if (!selectedModel) {
            this.notifications.showError('Please select a model');
            return false;
        }
        
        this.appState.updateOnboardingField('model', selectedModel);
        return true;
    }

    previousStep(fromStep) {
        const stepMap = { 2: 1, 3: 2, 4: 3, 5: 4 };
        if (stepMap[fromStep]) {
            this.showStep(stepMap[fromStep]);
        }
    }

    showStep(step) {
        try {
            Logger.log(`Showing step ${step}`);
            
            // Hide all steps
            document.querySelectorAll('.onboarding-step').forEach(el => {
                el.style.display = 'none';
            });
            
            // Show current step - for now, we'll work with the existing structure
            // In a full refactor, we'd generate these dynamically
            const stepElements = {
                1: 'step1',
                2: 'step2',
                3: this.getStep3ElementId(),
                4: this.getStep4ElementId(),
                5: 'step5'
            };
            
            const elementId = stepElements[step];
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = 'block';
                Logger.log(`Successfully displayed step ${step} with element ${elementId}`);
            } else {
                Logger.error(`Step element not found: ${elementId}`);
                this.notifications.showError(`Step ${step} not found. Please refresh and try again.`);
            }
            
            this.currentStep = step;
            this.appState.setCurrentStep(step);
        } catch (error) {
            Logger.error('Error showing step', error);
            this.notifications.showError('Failed to show step. Please refresh and try again.');
        }
    }

    getStep3ElementId() {
        switch(this.selectedService) {
            case 'ollama': return 'step3-ollama';
            case 'openai': return 'step3-openai';
            case 'openwebui': return 'step3-openwebui';
            default: return 'step3-openai';
        }
    }

    getStep4ElementId() {
        switch(this.selectedService) {
            case 'ollama': return 'step4-ollama';
            case 'openai': return 'step4-openai';
            case 'openwebui': return 'step4-openwebui';
            default: return 'step4-openai';
        }
    }

    selectService(service) {
        Logger.log(`Service selected: ${service}`);
        this.selectedService = service;
        this.appState.setSelectedService(service);
        
        // Set default endpoint
        const endpoint = CONFIG.DEFAULT_ENDPOINTS[service] || CONFIG.DEFAULT_ENDPOINTS.openai;
        this.appState.updateOnboardingField('endpoint', endpoint);
        
        this.showStep(3);
    }

    async testOllamaConnection() {
        const url = document.getElementById('ollamaUrl')?.value?.trim();
        if (!url) {
            this.notifications.showError('Please enter an Ollama server URL');
            return;
        }
        
        const statusDiv = document.getElementById('ollamaStatus');
        const testBtn = document.getElementById('testOllamaBtn');
        
        if (testBtn) {
            testBtn.innerHTML = '<span class="loading"></span> Testing...';
        }
        if (statusDiv) {
            statusDiv.innerHTML = '';
        }
        
        try {
            const result = await OllamaService.getAvailableModels(url);
            
            if (result.success) {
                // Store the endpoint
                this.appState.updateOnboardingField('endpoint', result.endpoint);
                
                // Populate model select
                const modelSelect = document.getElementById('ollamaModelSelect');
                if (modelSelect && result.models) {
                    modelSelect.innerHTML = '';
                    
                    result.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = OllamaService.formatModelDisplay(model);
                        modelSelect.appendChild(option);
                    });
                }
                
                if (statusDiv) {
                    statusDiv.innerHTML = `<div class="success">✓ Connection successful! Found ${result.models.length} models.</div>`;
                }
                
                Logger.log(`Ollama connection successful, found ${result.models.length} models`);
                
                // Enable next button by moving to model selection
                setTimeout(() => {
                    this.showStep(4);
                }, 1500);
            } else {
                if (statusDiv) {
                    statusDiv.innerHTML = `<div class="error">❌ ${result.message}</div>`;
                }
                Logger.error('Ollama connection failed', result.message);
            }
        } catch (error) {
            if (statusDiv) {
                statusDiv.innerHTML = `<div class="error">❌ Connection failed: ${error.message}</div>`;
            }
            Logger.error('Ollama connection failed', error);
        } finally {
            if (testBtn) {
                testBtn.textContent = 'Test Connection';
            }
        }
    }

    async testOpenWebUIConnection() {
        const url = document.getElementById('openwebuiUrl')?.value?.trim();
        const apiKey = document.getElementById('openwebuiKey')?.value?.trim();
        
        const validation = OpenWebUIService.validateConnection(url, apiKey);
        if (!validation.valid) {
            this.notifications.showError(validation.message);
            return;
        }
        
        const statusDiv = document.getElementById('openwebuiStatus');
        const testBtn = document.getElementById('testOpenWebUIBtn');
        
        if (testBtn) {
            testBtn.innerHTML = '<span class="loading"></span> Testing...';
        }
        if (statusDiv) {
            statusDiv.innerHTML = '';
        }
        
        try {
            // Store the API key and endpoint early
            this.appState.updateOnboardingField('apiKey', apiKey);
            
            const result = await OpenWebUIService.getAvailableModels(url, apiKey);
            
            if (result.success) {
                // Store endpoints
                this.appState.updateOnboardingField('endpoint', result.endpoint);
                if (result.fallbackEndpoint) {
                    this.appState.updateOnboardingField('fallbackEndpoint', result.fallbackEndpoint);
                }
                
                // Populate model select
                const modelSelect = document.getElementById('openwebuiModelSelect');
                if (modelSelect && result.models) {
                    modelSelect.innerHTML = '';
                    
                    result.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    });
                }
                
                if (statusDiv) {
                    statusDiv.innerHTML = `<div class="success">✓ Connection successful! Found ${result.models.length} models.</div>`;
                }
                
                Logger.log(`Open WebUI connection successful, found ${result.models.length} models`);
                
                // Enable next button by moving to model selection
                setTimeout(() => {
                    this.showStep(4);
                }, 1500);
            } else {
                if (statusDiv) {
                    statusDiv.innerHTML = `<div class="error">❌ ${result.message}</div>`;
                }
                Logger.error('Open WebUI connection failed', result.message);
            }
        } catch (error) {
            if (statusDiv) {
                statusDiv.innerHTML = `<div class="error">❌ Connection failed: ${error.message}</div>`;
            }
            Logger.error('Open WebUI connection failed', error);
        } finally {
            if (testBtn) {
                testBtn.textContent = 'Test Connection';
            }
        }
    }

    async testConfiguration() {
        const testConnection = document.getElementById('testConnection');
        const testModel = document.getElementById('testModel');
        const testComplete = document.getElementById('testComplete');
        const testButtons = document.getElementById('testButtons');
        
        // Reset all statuses
        [testConnection, testModel, testComplete].forEach(el => {
            if (el) {
                el.className = 'test-item';
                const icon = el.querySelector('.test-icon');
                if (icon) icon.textContent = '⏳';
            }
        });
        
        try {
            // Create AI service for testing
            this.tempAIService = this.createTempAIService();
            
            // Test 1: Connection
            if (testConnection) {
                const span = testConnection.querySelector('span:last-child');
                if (span) span.textContent = 'Testing connection...';
            }
            
            const connectionResult = await this.tempAIService.testConnection();
            
            if (connectionResult.success) {
                if (testConnection) {
                    testConnection.className = 'test-item success';
                    const icon = testConnection.querySelector('.test-icon');
                    const span = testConnection.querySelector('span:last-child');
                    if (icon) icon.textContent = '✓';
                    if (span) span.textContent = 'Connection successful';
                }
                
                // Test 2: Model verification (already done in connection test)
                if (testModel) {
                    const span = testModel.querySelector('span:last-child');
                    if (span) span.textContent = 'Verifying model...';
                    
                    setTimeout(() => {
                        testModel.className = 'test-item success';
                        const icon = testModel.querySelector('.test-icon');
                        const modelSpan = testModel.querySelector('span:last-child');
                        if (icon) icon.textContent = '✓';
                        if (modelSpan) modelSpan.textContent = 'Model verified';
                        
                        // Start name variations discovery
                        this.discoverNameVariations();
                    }, 500);
                }
            } else {
                throw new Error(connectionResult.message);
            }
        } catch (error) {
            Logger.error('Configuration test failed', error);
            
            if (testConnection) {
                testConnection.className = 'test-item error';
                const icon = testConnection.querySelector('.test-icon');
                const span = testConnection.querySelector('span:last-child');
                if (icon) icon.textContent = '❌';
                if (span) span.textContent = `Error: ${error.message}`;
            }
            
            if (testButtons) {
                testButtons.style.display = 'flex';
            }
        }
    }

    async discoverNameVariations() {
        const testComplete = document.getElementById('testComplete');
        const testButtons = document.getElementById('testButtons');
        const testStatusContainer = testButtons?.parentNode;
        
        // Create name variations manager
        this.nameVariationsManager = new NameVariationsManager(this.appState, this.tempAIService);
        
        // Create name variations test item
        const nameVariationsDiv = document.createElement('div');
        nameVariationsDiv.className = 'test-item';
        nameVariationsDiv.id = 'testNameVariations';
        nameVariationsDiv.innerHTML = `
            <span class="test-icon">✨</span>
            <span>Discovering name variations for better task detection...</span>
        `;
        
        // Insert before the buttons
        if (testStatusContainer && testButtons) {
            testStatusContainer.insertBefore(nameVariationsDiv, testButtons);
        }
        
        try {
            const result = await this.nameVariationsManager.discoverDuringOnboarding();
            
            // Update UI with results
            nameVariationsDiv.className = result.success ? 'test-item success' : 'test-item';
            nameVariationsDiv.innerHTML = `
                <span class="test-icon">${result.success ? '✓' : 'ℹ️'}</span>
                <span>${result.message}</span>
            `;
            
            // Show explanation and enable completion
            this.showNameVariationsExplanation(result.variations);
            
        } catch (error) {
            Logger.error('Name variations discovery failed', error);
            
            nameVariationsDiv.className = 'test-item';
            nameVariationsDiv.innerHTML = `
                <span class="test-icon">ℹ️</span>
                <span>Using "${this.appState.onboardingData.userName}" only (you can add variations in Settings later)</span>
            `;
            
            this.showNameVariationsExplanation([this.appState.onboardingData.userName]);
        }
    }

    showNameVariationsExplanation(variations) {
        const testButtons = document.getElementById('testButtons');
        const testStatusContainer = testButtons?.parentNode;
        
        if (!testStatusContainer || !testButtons) return;
        
        // Update test complete status
        const testComplete = document.getElementById('testComplete');
        if (testComplete) {
            testComplete.className = 'test-item success';
            const icon = testComplete.querySelector('.test-icon');
            const span = testComplete.querySelector('span:last-child');
            if (icon) icon.textContent = '✓';
            if (span) span.textContent = 'Setup complete!';
        }
        
        // Create explanation section
        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'name-variations-explanation';
        explanationDiv.innerHTML = `
            <div class="explanation-content">
                <h4>🎯 Smart Name Recognition</h4>
                <p>TaskFlow AI will now recognize when tasks are assigned to you using any of these names:</p>
                <div class="name-variations-list">
                    ${variations.map(name => `<span class="name-tag">${name}</span>`).join('')}
                </div>
                <p class="explanation-note">
                    💡 This means if someone emails "Bob, can you review the report?" and your name is Robert, 
                    the AI will correctly identify this as your task. You can modify these variations anytime in Settings.
                </p>
            </div>
        `;
        
        // Insert before buttons
        testStatusContainer.insertBefore(explanationDiv, testButtons);
        
        // Show the completion buttons
        testButtons.style.display = 'flex';
        
        // Add smooth reveal animation
        setTimeout(() => {
            explanationDiv.style.opacity = '1';
            explanationDiv.style.transform = 'translateY(0)';
        }, 100);
    }

    createTempAIService() {
        const config = {
            endpoint: this.appState.onboardingData.endpoint,
            apiKey: this.appState.onboardingData.apiKey,
            model: this.appState.onboardingData.model,
            service: this.appState.onboardingData.service,
            nameVariations: this.appState.onboardingData.nameVariations
        };

        switch (this.appState.onboardingData.service) {
            case 'ollama':
                return new OllamaService(config);
            case 'openai':
                return new OpenAIService(config);
            case 'openwebui':
                return new OpenWebUIService({
                    ...config,
                    fallbackEndpoint: this.appState.onboardingData.fallbackEndpoint
                });
            default:
                throw new Error(`Unknown AI service: ${this.appState.onboardingData.service}`);
        }
    }

    async completeOnboarding() {
        try {
            const config = { ...this.appState.onboardingData };
            
            Logger.log('Completing onboarding', config);
            
            // Call the completion callback
            if (this.onComplete) {
                await this.onComplete(config);
            }
            
        } catch (error) {
            Logger.error('Failed to complete onboarding', error);
            this.notifications.showError('Failed to complete setup. Please try again.');
        }
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    formatSize(bytes) {
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) {
            return gb.toFixed(1) + ' GB';
        }
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(1) + ' MB';
    }
}