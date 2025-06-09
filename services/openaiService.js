// services/openaiService.js - OpenAI AI Service Implementation

import { AIService } from './aiService.js';
import { CONFIG, Logger } from '../core/config.js';

export class OpenAIService extends AIService {
    constructor(config) {
        super(config);
    }

    async sendRequest(prompt, options = {}) {
        const requestBody = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: options.systemPrompt || 'You are a helpful assistant.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.3
        };

        // Add response format for JSON if not asking for raw response
        if (!options.rawResponse && options.requireJson !== false) {
            requestBody.response_format = { type: "json_object" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error?.message || errorMessage;
                } catch (e) {
                    // Use default error message if JSON parsing fails
                }

                if (response.status === 401) {
                    errorMessage = 'Invalid API key. Please verify your OpenAI API key.';
                } else if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please check your API key permissions.';
                }

                throw new Error(errorMessage);
            }

            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    parseResponse(data, options = {}) {
        this.validateResponse(data);
        
        if (!data.choices || !data.choices[0]) {
            throw new Error('Invalid response format from OpenAI API');
        }

        const content = data.choices[0].message?.content;
        if (!content) {
            throw new Error('No content in OpenAI response');
        }

        // If expecting raw text (like for summaries), return as-is
        if (options.rawResponse) {
            return content;
        }

        // Otherwise, parse as task data
        return AIService.parseTaskData(content);
    }

    async testConnection() {
        try {
            const testPrompt = 'Say "Hello" if you can read this.';
            const requestBody = {
                model: this.model,
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 10,
                temperature: 0
            };

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error?.message || errorMessage;
                } catch (e) {
                    // Use default error message
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            const responseText = data.choices?.[0]?.message?.content || '';
            
            if (responseText.toLowerCase().includes('hello')) {
                return { success: true, message: 'Connection successful' };
            } else {
                throw new Error('Model response validation failed');
            }
        } catch (error) {
            Logger.error('OpenAI connection test failed', error);
            return { 
                success: false, 
                message: error.name === 'AbortError' ? 'Request timed out' : error.message 
            };
        }
    }

    static getDefaultModels() {
        return [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
            { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy fast model' }
        ];
    }

    static validateApiKey(apiKey) {
        if (!apiKey) {
            return { valid: false, message: 'API key is required' };
        }
        
        if (!apiKey.startsWith('sk-')) {
            return { valid: false, message: 'Invalid API key format' };
        }
        
        if (apiKey.length < 20) {
            return { valid: false, message: 'API key appears to be too short' };
        }
        
        return { valid: true };
    }
}
