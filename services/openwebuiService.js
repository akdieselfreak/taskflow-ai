// services/openwebuiService.js - Open WebUI AI Service Implementation

import { AIService } from './aiService.js';
import { CONFIG, Logger } from '../core/config.js';

export class OpenWebUIService extends AIService {
    constructor(config) {
        super(config);
        this.fallbackEndpoint = config.fallbackEndpoint;
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
                
                if (response.status === 401) {
                    errorMessage = 'Invalid API key. Please check your API key in Open WebUI Settings > Account.';
                } else if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please check your API key permissions and ensure API access is enabled in Open WebUI.';
                } else {
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error?.message || errorMessage;
                    } catch (e) {
                        // Use default error message
                    }
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
        
        // Open WebUI typically follows OpenAI format
        if (!data.choices || !data.choices[0]) {
            throw new Error('Invalid response format from Open WebUI API');
        }

        const content = data.choices[0].message?.content;
        if (!content) {
            throw new Error('No content in Open WebUI response');
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
                
                if (response.status === 401) {
                    errorMessage = 'Invalid API key. Please check your API key.';
                } else if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please check your API key permissions.';
                } else {
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error?.message || errorMessage;
                    } catch (e) {
                        // Use default error message
                    }
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
            Logger.error('Open WebUI connection test failed', error);
            return { 
                success: false, 
                message: error.name === 'AbortError' ? 'Request timed out' : error.message 
            };
        }
    }

    static async getAvailableModels(baseUrl, apiKey) {
        try {
            // Format the URL properly
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                baseUrl = 'http://' + baseUrl;
            }
            baseUrl = baseUrl.replace(/\/$/, '');

            const response = await fetch(`${baseUrl}/api/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            let models = [];
            
            // Handle different response formats from Open WebUI
            if (Array.isArray(data)) {
                models = data;
            } else if (data && typeof data === 'object') {
                models = data.data || data.models || data.items || [];
            }

            if (!Array.isArray(models)) {
                throw new Error('Invalid response format');
            }

            // Process models to ensure consistent format
            const processedModels = models.map(model => {
                if (typeof model === 'string') {
                    return { id: model, name: model };
                } else if (typeof model === 'object' && model !== null) {
                    const modelId = model.id || model.model_id || model.name || model.model || 'unknown';
                    const modelName = model.name || model.title || model.model_name || modelId;
                    return { id: modelId, name: modelName, ...model };
                }
                return null;
            }).filter(Boolean);

            return {
                success: true,
                models: processedModels,
                endpoint: `${baseUrl}/api/chat/completions`,
                fallbackEndpoint: `${baseUrl}/ollama/api/generate`
            };
        } catch (error) {
            Logger.error('Failed to get Open WebUI models', error);
            
            let errorMessage = 'Connection failed';
            if (error.name === 'AbortError') {
                errorMessage = 'Connection timed out. Please check the URL and ensure Open WebUI is running.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Could not connect to Open WebUI. Please check the URL and ensure Open WebUI is running.';
            } else {
                errorMessage = error.message;
            }

            return { success: false, message: errorMessage };
        }
    }

    static validateConnection(url, apiKey) {
        if (!url) {
            return { valid: false, message: 'Server URL is required' };
        }
        
        if (!apiKey) {
            return { valid: false, message: 'API key is required' };
        }
        
        return { valid: true };
    }
}
