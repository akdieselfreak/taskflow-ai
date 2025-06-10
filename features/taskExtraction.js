// features/taskExtraction.js - Task Extraction Management

import { Logger, DEFAULT_SYSTEM_PROMPT } from '../core/config.js';

export class TaskExtractionManager {
    constructor(appState, aiService, nameVariationsManager) {
        this.appState = appState;
        this.aiService = aiService;
        this.nameVariationsManager = nameVariationsManager;
    }

    async extractTasksFromText(inputText) {
        try {
            if (!inputText || inputText.trim().length < 10) {
                throw new Error('Please enter more detailed text for better task extraction');
            }

            Logger.log('Starting AI task extraction', { textLength: inputText.length });

            const prompt = this.buildExtractionPrompt(inputText);
            const taskData = await this.aiService.makeRequest(prompt, {
                systemPrompt: this.getSystemPrompt(),
                maxTokens: 1000,
                temperature: 0.3
            });

            const extractedTasks = this.parseTaskData(taskData);
            
            // Update app state
            this.appState.setExtractedTasks(extractedTasks);
            
            Logger.log('AI task extraction completed successfully', { 
                taskCount: extractedTasks.length 
            });

            return {
                success: true,
                tasks: extractedTasks,
                count: extractedTasks.length
            };

        } catch (error) {
            Logger.error('AI task extraction failed', error);
            throw new Error(`Task extraction failed: ${error.message}`);
        }
    }

    buildExtractionPrompt(inputText) {
        const userName = this.appState.onboardingData.userName;
        const variations = this.appState.onboardingData.nameVariations || [userName];
        
        let nameContext = '';
        if (variations.length > 1) {
            nameContext = `Note: ${userName} may also be referred to as: ${variations.slice(1).join(', ')}.`;
        }

        return `You are helping ${userName} extract tasks from text. 

Analyze the following text and extract ALL tasks that are assigned to or relevant to ${userName}. 
${nameContext}
Ignore tasks assigned to other people.

You can extract multiple tasks if you identify multiple distinct action items for ${userName}.

Text to analyze:
${inputText}

Return a JSON object with exactly this structure:

For single task:
{
  "title": "Clear, concise task title (max 10 words)",
  "description": "Brief 1-2 sentence summary of what ${userName} needs to do", 
  "notes": "Any additional context, links, deadlines, or details mentioned"
}

For multiple tasks:
{
  "tasks": [
    {
      "title": "First task title",
      "description": "Description of first task for ${userName}",
      "notes": "Notes for first task"
    },
    {
      "title": "Second task title",
      "description": "Description of second task for ${userName}", 
      "notes": "Notes for second task"
    }
  ]
}

Important:
- Extract ALL tasks for ${userName}, not just the first one
- Only extract tasks for ${userName}, not for others mentioned in the text
- Make each title action-oriented and specific
- Keep descriptions brief but informative
- Include any mentioned dates, links, or important details in notes
- Use the "tasks" array format if multiple tasks exist, single task format if only one task exists`;
    }

    parseTaskData(taskData) {
        // Handle both single task and multiple tasks responses
        if (taskData.tasks && Array.isArray(taskData.tasks)) {
            // Multiple tasks format - validate each task
            if (taskData.tasks.length === 0) {
                throw new Error('AI found no tasks in the provided text');
            }
            
            const validTasks = taskData.tasks
                .filter(task => task.title || task.description)
                .map(task => this.normalizeTask(task));
            
            if (validTasks.length === 0) {
                throw new Error('AI could not extract valid tasks from the provided text');
            }
            
            return validTasks;
        } else if (taskData.title || taskData.description) {
            // Single task format
            return [this.normalizeTask(taskData)];
        } else {
            throw new Error('AI could not extract any clear tasks from the provided text');
        }
    }

    normalizeTask(task) {
        return {
            title: task.title || 'Untitled Task',
            description: task.description || '',
            notes: task.notes || ''
        };
    }

    getSystemPrompt() {
        // Get current name variations from app state (this ensures we always have the latest)
        const nameVariations = this.appState.onboardingData.nameVariations || 
                              [this.appState.onboardingData.userName || 'your boss'];
        const nameList = nameVariations.length > 1 
            ? nameVariations.map(name => `"${name}"`).join(', ')
            : `"${nameVariations[0]}"`;
        
        // Inject name variations into the default prompt
        return DEFAULT_SYSTEM_PROMPT.replace(
            'When analyzing text, extract ALL tasks that are assigned to, or relevant to your boss. Your boss may be referred to by various names or nicknames. Ignore tasks assigned to other people.',
            `When analyzing text, extract ALL tasks that are assigned to or relevant to your boss. Your boss be referred to by any of these names: ${nameList}.`
        );
    }

    injectNameVariationsIntoPrompt(customPrompt) {
        // For custom prompts, try to intelligently inject name variations
        const nameVariations = this.appState.onboardingData.nameVariations || 
                              [this.appState.onboardingData.userName || 'your boss'];
        
        if (nameVariations.length <= 1) {
            return customPrompt;
        }
        
        const nameList = nameVariations.map(name => `"${name}"`).join(', ');
        const nameVariationText = `your boss may be referred to by any of these names: ${nameList}.`;
        
        // Look for common patterns in custom prompts and inject after them
        const patterns = [
            /extract.*tasks.*assigned to.*user/i,
            /identify.*tasks.*for.*user/i,
            /find.*tasks.*user/i,
            /tasks.*assigned.*user/i
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(customPrompt)) {
                return customPrompt.replace(pattern, (match) => `${match} ${nameVariationText}`);
            }
        }
        
        // If no pattern found, add at the beginning
        return `${nameVariationText}\n\n${customPrompt}`;
    }

    updateExtractedTask(index, field, value) {
        const tasks = [...this.appState.extractedTasks];
        if (index >= 0 && index < tasks.length) {
            tasks[index] = { ...tasks[index], [field]: value };
            this.appState.setExtractedTasks(tasks);
        }
    }

    removeExtractedTask(index) {
        if (this.appState.extractedTasks.length <= 1) {
            throw new Error('Cannot remove the last task. Use "Extract Another" to start over.');
        }
        
        this.appState.removeExtractedTask(index);
    }

    saveExtractedTasks() {
        const tasksToSave = [];
        const extractedTasks = this.appState.extractedTasks;
        
        // Validate and prepare tasks for saving
        extractedTasks.forEach(task => {
            const name = task.title?.trim();
            if (name) {
                tasksToSave.push({
                    id: this.appState.generateTaskId(),
                    name,
                    description: task.description?.trim() || '',
                    notes: task.notes?.trim() || '',
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    type: 'ai',
                    completed: false,
                    postponed: false
                });
            }
        });
        
        if (tasksToSave.length === 0) {
            throw new Error('Please provide at least one task name');
        }
        
        // Add all tasks to the app state
        tasksToSave.forEach(task => {
            this.appState.addTask(task);
        });
        
        // Clear extracted tasks
        this.appState.clearExtractedTasks();
        
        Logger.log('AI tasks saved', { taskCount: tasksToSave.length });
        
        return {
            success: true,
            count: tasksToSave.length,
            message: tasksToSave.length === 1 ? 
                'AI-extracted task saved successfully!' : 
                `${tasksToSave.length} AI-extracted tasks saved successfully!`
        };
    }

    clearExtractedTasks() {
        this.appState.clearExtractedTasks();
    }

    getExtractedTasksCount() {
        return this.appState.extractedTasks.length;
    }

    hasExtractedTasks() {
        return this.appState.extractedTasks.length > 0;
    }

    validateExtractionInput(text) {
        if (!text || typeof text !== 'string') {
            return { valid: false, message: 'Please enter text to extract tasks from' };
        }
        
        if (text.trim().length < 10) {
            return { valid: false, message: 'Please enter more detailed text for better task extraction' };
        }
        
        return { valid: true };
    }
}
