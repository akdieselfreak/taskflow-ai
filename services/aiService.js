// services/aiService.js - Base AI Service Class

import { CONFIG, Logger } from '../core/config.js';

export class AIService {
    constructor(config) {
        this.endpoint = config.endpoint;
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.service = config.service;
        this.nameVariations = config.nameVariations || [];
    }

    async makeRequest(prompt, options = {}) {
        const maxRetries = options.maxRetries || CONFIG.MAX_RETRY_ATTEMPTS;
        const timeout = options.timeout || CONFIG.REQUEST_TIMEOUT;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                Logger.log(`AI request attempt ${attempt + 1}/${maxRetries}`);
                
                const response = await this.sendRequest(prompt, { ...options, timeout });
                return this.parseResponse(response);
                
            } catch (error) {
                Logger.warn(`AI request attempt ${attempt + 1} failed`, error);
                
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                
                // Wait before retrying
                await this.wait(1000 * (attempt + 1));
            }
        }
    }

    async sendRequest(prompt, options) {
        throw new Error('sendRequest must be implemented by subclass');
    }

    parseResponse(response) {
        throw new Error('parseResponse must be implemented by subclass');
    }

    formatPromptWithNameVariations(basePrompt, userName) {
        if (!this.nameVariations || this.nameVariations.length <= 1) {
            return basePrompt.replace(/\{userName\}/g, userName);
        }

        const nameList = this.nameVariations.map(name => `"${name}"`).join(', ');
        const nameVariationText = `Note: ${userName} may also be referred to as: ${this.nameVariations.slice(1).join(', ')}.`;
        
        return basePrompt
            .replace(/\{userName\}/g, userName)
            .replace(/\{nameVariations\}/g, nameVariationText);
    }

    createHeaders(extraHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...extraHeaders
        };

        if (this.apiKey && (this.service === 'openai' || this.service === 'openwebui')) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    validateResponse(data) {
        if (!data) {
            throw new Error('Empty response from AI service');
        }
        return true;
    }

    static cleanJsonResponse(content) {
        let cleanedContent = content.trim();
        
        // Remove markdown code block markers
        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        return cleanedContent.trim();
    }

    static parseTaskData(content) {
        try {
            const cleanedContent = AIService.cleanJsonResponse(content);
            const taskData = JSON.parse(cleanedContent);
            
            // Handle both single task and multiple tasks responses
            if (taskData.tasks && Array.isArray(taskData.tasks)) {
                // Multiple tasks format - validate each task
                if (taskData.tasks.length === 0) {
                    throw new Error('AI found no tasks in the provided text');
                }
                
                const validTasks = taskData.tasks.filter(task => task.title || task.description);
                if (validTasks.length === 0) {
                    throw new Error('AI could not extract valid tasks from the provided text');
                }
                
                return { tasks: validTasks };
            } else if (taskData.title || taskData.description) {
                // Single task format
                return taskData;
            } else {
                throw new Error('AI could not extract any clear tasks from the provided text');
            }
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new Error('Invalid task format returned by AI. Please try again with different text.');
            }
            throw e;
        }
    }
}