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
                return this.parseResponse(response, options);
                
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

    parseResponse(response, options = {}) {
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
                const validTasks = taskData.tasks.filter(task => task.title || task.description);
                
                // Return empty array if no valid tasks found - this is normal for notes without tasks
                return { tasks: validTasks };
            } else if (taskData.title || taskData.description) {
                // Single task format
                return taskData;
            } else {
                // No tasks found - return empty array instead of throwing error
                return { tasks: [] };
            }
        } catch (e) {
            if (e instanceof SyntaxError) {
                // JSON parsing failed - this is normal when no tasks are found
                Logger.warn('Failed to parse AI response as JSON, assuming no tasks found:', content);
                return { tasks: [] };
            }
            // For other errors, still return empty tasks instead of throwing
            Logger.warn('Unexpected error in parseTaskData, assuming no tasks found:', e.message);
            return { tasks: [] };
        }
    }
}
