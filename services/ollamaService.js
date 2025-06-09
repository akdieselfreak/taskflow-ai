// services/ollamaService.js - Ollama AI Service Implementation

import { AIService } from './aiService.js';
import { CONFIG, Logger } from '../core/config.js';

export class OllamaService extends AIService {
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
            stream: false
        };

        // Only request JSON format if not asking for raw response
        if (!options.rawResponse) {
            requestBody.format = 'json';
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
                throw new Error(`HTTP ${response.status}: ${errorText || 'Request failed'}`);
            }

            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    parseResponse(data, options = {}) {
        this.validateResponse(data);
        
        const content = data.message?.content || data.response;
        if (!content) {
            throw new Error('No content in Ollama response');
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
            // Test with a simple prompt
            const testPrompt = 'Say "Hello" if you can read this.';
            const requestBody = {
                model: this.model,
                messages: [{ role: 'user', content: testPrompt }],
                stream: false
            };

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const responseText = data.message?.content || data.response || '';
            
            if (responseText.toLowerCase().includes('hello')) {
                return { success: true, message: 'Connection successful' };
            } else {
                throw new Error('Model response validation failed');
            }
        } catch (error) {
            Logger.error('Ollama connection test failed', error);
            return { 
                success: false, 
                message: error.name === 'AbortError' ? 'Request timed out' : error.message 
            };
        }
    }

    static async getAvailableModels(baseUrl) {
        try {
            // Format URL properly
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                baseUrl = 'http://' + baseUrl;
            }
            baseUrl = baseUrl.replace(/\/+$/, '');

            Logger.log(`Attempting to connect to Ollama at: ${baseUrl}`);

            const response = await fetch(`${baseUrl}/api/tags`, {
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });

            Logger.log(`Ollama response status: ${response.status}`);
            Logger.log(`Ollama response headers:`, [...response.headers.entries()]);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                Logger.error(`Ollama HTTP ${response.status}:`, errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Get the response text first for debugging
            const responseText = await response.text();
            Logger.log(`Ollama raw response:`, responseText.substring(0, 500)); // Log first 500 chars

            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                Logger.error('Failed to parse Ollama response as JSON:', {
                    parseError: parseError.message,
                    responseText: responseText.substring(0, 200),
                    contentType: response.headers.get('content-type')
                });
                
                // Check if it looks like HTML (common error case)
                if (responseText.trim().startsWith('<')) {
                    throw new Error('Received HTML instead of JSON. Check if Ollama is running and accessible at the correct port.');
                }
                
                // Check if it's empty
                if (!responseText.trim()) {
                    throw new Error('Received empty response. Ollama may not be running or may be starting up.');
                }
                
                // Generic JSON parse error
                throw new Error(`Invalid JSON response from Ollama. Response: ${responseText.substring(0, 100)}...`);
            }
            
            Logger.log('Parsed Ollama data:', data);
            
            if (!data.models || !Array.isArray(data.models)) {
                Logger.error('Invalid Ollama response structure:', data);
                throw new Error('Invalid response format: missing models array');
            }

            return {
                success: true,
                models: data.models.sort((a, b) => a.name.localeCompare(b.name)),
                endpoint: `${baseUrl}/api/chat`
            };
        } catch (error) {
            Logger.error('Failed to get Ollama models', error);
            
            let errorMessage = 'Connection failed';
            if (error.name === 'AbortError') {
                errorMessage = 'Connection timed out. Please check the URL and ensure Ollama is running.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Could not connect to Ollama. Please check the URL and ensure Ollama is running.';
            } else if (error.message.includes('HTML instead of JSON')) {
                errorMessage = 'Received HTML response instead of JSON. This usually means Ollama is not running on this port, or you\'re connecting to a web server instead of Ollama.';
            } else if (error.message.includes('empty response')) {
                errorMessage = 'Ollama returned an empty response. It may be starting up or not properly configured.';
            } else {
                errorMessage = error.message;
            }

            return { success: false, message: errorMessage };
        }
    }

    static formatModelDisplay(model) {
        const sizeText = model.size ? ` (${OllamaService.formatSize(model.size)})` : '';
        const modifiedDate = model.modified_at ? 
            ` - Updated ${new Date(model.modified_at).toLocaleDateString()}` : '';
        
        return `${model.name}${sizeText}${modifiedDate}`;
    }

    static formatSize(bytes) {
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) {
            return gb.toFixed(1) + ' GB';
        }
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(1) + ' MB';
    }
}
