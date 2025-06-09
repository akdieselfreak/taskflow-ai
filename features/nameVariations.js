// features/nameVariations.js - Fixed Name Variations Management

import { CONFIG, Logger } from '../core/config.js';
import { StorageManager } from '../core/storage.js';

export class NameVariationsManager {
    constructor(appState, aiService) {
        this.appState = appState;
        this.aiService = aiService;
    }

    async discoverVariations(userName) {
        try {
            Logger.log('Starting name variations discovery', { userName });
            
            const prompt = `Given the name "${userName}", what are common nicknames, shortened versions, formal versions, or alternative forms this person might be called in professional emails, casual messages, and everyday conversation?

Examples:
- Robert → ["Robert", "Bob", "Rob", "Bobby", "Robbie"]
- Jennifer → ["Jennifer", "Jen", "Jenny", "Jenn"]
- Michael → ["Michael", "Mike", "Mick", "Mickey"]
- Elizabeth → ["Elizabeth", "Liz", "Beth", "Betty", "Lizzy", "Eliza"]

Important: Only include realistic, commonly used variations. Include both the formal and informal versions.

Return ONLY a valid JSON array of strings like: ["FullName", "Nickname1", "Nickname2"]

Do not return any other text or explanation, just the JSON array.`;

            // Use a custom request that doesn't go through task parsing
            const response = await this.makeNameVariationsRequest(prompt);
            const variations = this.parseVariationsResponse(response, userName);
            
            Logger.log('Name variations discovered successfully', { variations });
            return variations;
            
        } catch (error) {
            Logger.warn('Name variations discovery failed', error);
            return [userName]; // Fallback to original name
        }
    }

    async makeNameVariationsRequest(prompt) {
        try {
            // Make a direct AI request without using the task extraction system
            const requestOptions = {
                timeout: CONFIG.NAME_VARIATIONS_TIMEOUT,
                maxTokens: 100,
                temperature: 0.1,
                systemPrompt: "You are a helpful assistant that suggests name variations. Always respond with only a JSON array of strings, no other text."
            };

            // Use the AI service's sendRequest method directly
            const response = await this.aiService.sendRequest(prompt, requestOptions);
            
            // Parse response based on service type
            let content;
            if (this.aiService.service === 'openai' || this.aiService.service === 'openwebui') {
                content = response.choices?.[0]?.message?.content;
            } else if (this.aiService.service === 'ollama') {
                content = response.message?.content || response.response;
            } else {
                content = response.content || response.message || response;
            }

            if (!content) {
                throw new Error('No content in AI response');
            }

            return content;
        } catch (error) {
            Logger.error('Name variations AI request failed', error);
            throw error;
        }
    }

    parseVariationsResponse(response, userName) {
        try {
            let variations;
            
            // Clean the response - remove any markdown formatting
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            Logger.log('Parsing name variations response', { cleanResponse });
            
            // Try to parse as JSON
            try {
                variations = JSON.parse(cleanResponse);
            } catch (parseError) {
                Logger.warn('Failed to parse as JSON, trying to extract array', { parseError: parseError.message });
                
                // Try to extract array from text
                const arrayMatch = cleanResponse.match(/\[.*\]/);
                if (arrayMatch) {
                    variations = JSON.parse(arrayMatch[0]);
                } else {
                    throw new Error('No valid JSON array found in response');
                }
            }

            // Validate and clean variations
            if (!Array.isArray(variations)) {
                Logger.warn('Response is not an array, creating fallback', { variations });
                variations = [userName];
            }

            const validVariations = variations
                .filter(name => typeof name === 'string' && name.trim().length > 0)
                .map(name => name.trim())
                .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
                .slice(0, CONFIG.MAX_NAME_VARIATIONS);

            // Ensure original name is included
            if (!validVariations.includes(userName)) {
                validVariations.unshift(userName);
            }

            Logger.log('Successfully parsed name variations', { validVariations });
            return validVariations;
        } catch (error) {
            Logger.warn('Failed to parse name variations response', { error: error.message, response });
            return [userName];
        }
    }

    saveVariations(variations) {
        try {
            if (!Array.isArray(variations) || variations.length === 0) {
                throw new Error('Invalid variations array');
            }

            // Clean and validate
            const cleanVariations = variations
                .map(name => name.trim())
                .filter(name => name.length > 0)
                .filter((name, index, arr) => arr.indexOf(name) === index)
                .slice(0, CONFIG.MAX_NAME_VARIATIONS);

            if (cleanVariations.length === 0) {
                throw new Error('No valid variations provided');
            }

            // Update state and storage
            this.appState.updateOnboardingField('nameVariations', cleanVariations);
            StorageManager.saveNameVariations(cleanVariations);

            // Update AI service with new variations
            if (this.aiService) {
                this.aiService.nameVariations = cleanVariations;
                Logger.log('Updated AI service with new name variations', { variations: cleanVariations });
            }

            // Trigger system prompt update
            this.appState.dispatchEvent(new CustomEvent('nameVariationsUpdated', { 
                detail: { variations: cleanVariations } 
            }));

            Logger.log('Name variations saved successfully', { variations: cleanVariations });
            return { success: true, variations: cleanVariations };
        } catch (error) {
            Logger.error('Failed to save name variations', error);
            return { success: false, message: error.message };
        }
    }

    parseVariationsInput(input) {
        if (!input || typeof input !== 'string') {
            return [];
        }

        return input
            .split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0)
            .filter((name, index, arr) => arr.indexOf(name) === index)
            .slice(0, CONFIG.MAX_NAME_VARIATIONS);
    }

    generatePromptWithVariations(basePrompt, userName) {
        const variations = this.appState.onboardingData.nameVariations || [userName];
        
        if (variations.length <= 1) {
            return basePrompt.replace(/\{userName\}/g, userName);
        }

        const nameList = variations.map(name => `"${name}"`).join(', ');
        const nameVariationText = variations.length > 1 
            ? `Note: ${userName} may also be referred to as: ${variations.slice(1).join(', ')}.`
            : '';
        
        return basePrompt
            .replace(/\{userName\}/g, userName)
            .replace(/\{nameVariations\}/g, nameVariationText);
    }

    async discoverDuringOnboarding() {
        const userName = this.appState.onboardingData.userName;
        if (!userName) {
            throw new Error('User name not available');
        }

        try {
            const variations = await this.discoverVariations(userName);
            
            // Save variations
            this.saveVariations(variations);
            
            return {
                success: true,
                variations,
                message: `Found ${variations.length} name variation${variations.length > 1 ? 's' : ''}: ${variations.join(', ')}`
            };
        } catch (error) {
            Logger.error('Failed to discover variations during onboarding', error);
            
            // Fallback to original name
            const fallbackVariations = [userName];
            this.saveVariations(fallbackVariations);
            
            return {
                success: false,
                variations: fallbackVariations,
                message: `Using "${userName}" only (you can add more variations in Settings later)`
            };
        }
    }

    getVariationsForDisplay() {
        const variations = this.appState.onboardingData.nameVariations || [];
        return variations.length > 0 ? variations : [this.appState.onboardingData.userName].filter(Boolean);
    }

    getVariationsAsString() {
        return this.getVariationsForDisplay().join(', ');
    }

    validateVariations(variations) {
        if (!Array.isArray(variations)) {
            return { valid: false, message: 'Variations must be an array' };
        }

        if (variations.length === 0) {
            return { valid: false, message: 'At least one variation is required' };
        }

        if (variations.length > CONFIG.MAX_NAME_VARIATIONS) {
            return { 
                valid: false, 
                message: `Maximum ${CONFIG.MAX_NAME_VARIATIONS} variations allowed` 
            };
        }

        const invalidNames = variations.filter(name => 
            typeof name !== 'string' || name.trim().length === 0
        );

        if (invalidNames.length > 0) {
            return { valid: false, message: 'All variations must be non-empty strings' };
        }

        return { valid: true };
    }
}