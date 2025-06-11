// features/chatManager.js - Chat Management System

import { Logger } from '../core/config.js';

export class ChatManager {
    constructor(appState, aiService, notifications) {
        this.appState = appState;
        this.aiService = aiService;
        this.notifications = notifications;
        this.currentChatId = null;
        this.isProcessing = false;
        
        // Default system prompt for TaskFlowAI chat
        this.defaultSystemPrompt = `You are TaskFlowAI Assistant, an intelligent task management companion. You help users analyze their thoughts, organize ideas, and manage their productivity.

Key capabilities:
- Help users break down complex thoughts into actionable tasks
- Provide insights on task prioritization and time management
- Analyze productivity patterns and suggest improvements
- Offer encouragement and motivation for task completion
- Help organize thoughts and ideas into structured formats

Always be helpful, encouraging, and focused on productivity. When users share thoughts or ideas, help them identify actionable items and suggest ways to organize or prioritize them.

Current user: {userName}
{nameVariations}`;
    }

    async sendMessage(message, chatId = null) {
        if (this.isProcessing) {
            this.notifications.showWarning('Please wait for the current message to complete');
            return null;
        }

        this.isProcessing = true;
        
        try {
            // Get or create chat
            const chat = chatId ? this.appState.getChat(chatId) : this.getCurrentChat();
            
            // Add user message to chat
            const userMessage = {
                id: this.generateMessageId(),
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.addMessageToChat(chat.id, userMessage);
            
            // Prepare conversation context
            const conversationHistory = this.buildConversationHistory(chat);
            
            // Get AI response
            const aiResponse = await this.getAIResponse(conversationHistory);
            
            // Add AI message to chat
            const aiMessage = {
                id: this.generateMessageId(),
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date().toISOString()
            };
            
            this.addMessageToChat(chat.id, aiMessage);
            
            // Update chat metadata
            this.updateChatMetadata(chat.id, {
                lastMessage: aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''),
                lastActivity: new Date().toISOString(),
                messageCount: chat.messages.length + 2
            });
            
            Logger.log('Chat message processed successfully', { 
                chatId: chat.id, 
                messageLength: message.length,
                responseLength: aiResponse.length 
            });
            
            return { userMessage, aiMessage, chatId: chat.id };
            
        } catch (error) {
            Logger.error('Failed to process chat message', error);
            this.notifications.showError(`Chat error: ${error.message}`);
            return null;
        } finally {
            this.isProcessing = false;
        }
    }

    async getAIResponse(conversationHistory) {
        // Build the full prompt with system context
        const systemPrompt = this.buildSystemPrompt();
        
        // Format conversation for AI service
        const fullPrompt = this.formatConversationForAI(systemPrompt, conversationHistory);
        
        // Get response from AI service
        const response = await this.aiService.makeRequest(fullPrompt, {
            maxTokens: 1000,
            temperature: 0.7,
            requireJson: false,
            rawResponse: true
        });
        
        return response;
    }

    buildSystemPrompt() {
        const config = this.appState.onboardingData;
        const userName = config.userName || 'User';
        
        // Use custom system prompt if available, otherwise use default
        const basePrompt = config.chatSystemPrompt || this.defaultSystemPrompt;
        
        return this.aiService.formatPromptWithNameVariations(basePrompt, userName);
    }
    
    updateSystemPrompt(prompt) {
        // This method is called when the user updates the chat system prompt from settings
        if (prompt && typeof prompt === 'string') {
            // The prompt will be saved to appState.onboardingData.chatSystemPrompt by the caller
            // We don't need to save it here, just notify that it was updated
            Logger.log('Chat system prompt updated', { length: prompt.length });
            this.notifications.showSuccess('Chat system prompt updated successfully!');
            return true;
        }
        return false;
    }

    formatConversationForAI(systemPrompt, conversationHistory) {
        // Different AI services may need different formatting
        switch (this.aiService.service) {
            case 'openai':
            case 'openwebui':
                return this.formatForOpenAIStyle(systemPrompt, conversationHistory);
            case 'ollama':
                return this.formatForOllama(systemPrompt, conversationHistory);
            default:
                return this.formatForOllama(systemPrompt, conversationHistory);
        }
    }

    formatForOpenAIStyle(systemPrompt, conversationHistory) {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];
        
        return JSON.stringify({ messages });
    }

    formatForOllama(systemPrompt, conversationHistory) {
        let prompt = systemPrompt + '\n\n';
        
        conversationHistory.forEach(msg => {
            const role = msg.role === 'user' ? 'Human' : 'Assistant';
            prompt += `${role}: ${msg.content}\n\n`;
        });
        
        prompt += 'Assistant: ';
        return prompt;
    }

    buildConversationHistory(chat) {
        // Get recent messages (limit to last 20 to manage context length)
        const recentMessages = chat.messages.slice(-20);
        
        return recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    getCurrentChat() {
        if (this.currentChatId) {
            const existingChat = this.appState.getChat(this.currentChatId);
            if (existingChat) {
                return existingChat;
            }
        }
        
        // Create new chat
        return this.createNewChat();
    }

    createNewChat(title = null) {
        const chat = {
            id: this.generateChatId(),
            title: title || `Chat ${new Date().toLocaleDateString()}`,
            messages: [],
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            messageCount: 0,
            lastMessage: ''
        };
        
        this.appState.addChat(chat);
        this.currentChatId = chat.id;
        
        Logger.log('New chat created', { chatId: chat.id });
        return chat;
    }

    addMessageToChat(chatId, message) {
        const chat = this.appState.getChat(chatId);
        if (chat) {
            chat.messages.push(message);
            this.appState.updateChat(chatId, chat);
        }
    }

    updateChatMetadata(chatId, metadata) {
        const chat = this.appState.getChat(chatId);
        if (chat) {
            Object.assign(chat, metadata);
            this.appState.updateChat(chatId, chat);
        }
    }

    async summarizeChatToNote(chatId, customTitle = null) {
        try {
            const chat = this.appState.getChat(chatId);
            if (!chat || chat.messages.length === 0) {
                throw new Error('No chat content to summarize');
            }

            // Build summary prompt
            const conversationText = chat.messages
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n\n');

            const summaryPrompt = `Please create a comprehensive summary of this conversation that would be useful as a note. Focus on key insights, decisions made, and actionable items discussed.

Conversation:
${conversationText}

Please provide a well-structured summary with:
1. Main topics discussed
2. Key insights or decisions
3. Action items or tasks mentioned
4. Important details to remember

Format as a clear, organized note.`;

            const summary = await this.aiService.makeRequest(summaryPrompt);

            // Create note
            const note = {
                id: this.generateNoteId(),
                title: customTitle || `Chat Summary - ${new Date().toLocaleDateString()}`,
                content: summary,
                tags: ['chat-summary'],
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                aiProcessed: true,
                extractedTasks: [],
                summary: summary.substring(0, 200) + '...'
            };

            this.appState.addNote(note);
            this.notifications.showSuccess('Chat summarized and saved as note!');
            
            Logger.log('Chat summarized to note', { chatId, noteId: note.id });
            return note;

        } catch (error) {
            Logger.error('Failed to summarize chat to note', error);
            this.notifications.showError(`Failed to create summary: ${error.message}`);
            throw error;
        }
    }

    async extractTasksFromChat(chatId) {
        try {
            const chat = this.appState.getChat(chatId);
            if (!chat || chat.messages.length === 0) {
                throw new Error('No chat content to analyze');
            }

            // Build task extraction prompt
            const conversationText = chat.messages
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n\n');

            const extractionPrompt = `Analyze this conversation and extract any actionable tasks or to-do items mentioned. Look for:
- Explicit tasks mentioned by the user
- Implied actions that need to be taken
- Follow-up items discussed
- Commitments or plans made

Conversation:
${conversationText}

Please return a JSON array of tasks in this format:
[
  {
    "title": "Task title",
    "description": "Brief description",
    "context": "Context from conversation",
    "confidence": 0.8
  }
]

If no clear tasks are found, return an empty array.`;

            const response = await this.aiService.makeRequest(extractionPrompt);
            const tasks = this.parseExtractedTasks(response);

            if (tasks.length > 0) {
                // Add tasks to pending tasks for user approval
                tasks.forEach(task => {
                    const pendingTask = {
                        id: this.generateTaskId(),
                        title: task.title,
                        context: task.description,
                        confidence: task.confidence || 0.7,
                        source_note_title: `Chat - ${chat.title}`,
                        source_note_id: chatId,
                        created_at: new Date().toISOString(),
                        extracted_from: 'chat'
                    };
                    
                    this.appState.addPendingTask(pendingTask);
                });

                this.notifications.showSuccess(`${tasks.length} tasks extracted from chat and added for review!`);
                Logger.log('Tasks extracted from chat', { chatId, taskCount: tasks.length });
            } else {
                this.notifications.showInfo('No actionable tasks found in this conversation');
            }

            return tasks;

        } catch (error) {
            Logger.error('Failed to extract tasks from chat', error);
            this.notifications.showError(`Failed to extract tasks: ${error.message}`);
            throw error;
        }
    }

    parseExtractedTasks(response) {
        try {
            // Clean and parse JSON response
            const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
            const tasks = JSON.parse(cleanedResponse);
            
            if (Array.isArray(tasks)) {
                return tasks.filter(task => task.title && task.title.trim());
            }
            
            return [];
        } catch (error) {
            Logger.warn('Failed to parse extracted tasks JSON', error);
            return [];
        }
    }

    deleteChat(chatId) {
        try {
            this.appState.deleteChat(chatId);
            
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
            }
            
            this.notifications.showSuccess('Chat deleted successfully');
            Logger.log('Chat deleted', { chatId });
        } catch (error) {
            Logger.error('Failed to delete chat', error);
            this.notifications.showError('Failed to delete chat');
        }
    }

    clearCurrentChat() {
        if (this.currentChatId) {
            const chat = this.appState.getChat(this.currentChatId);
            if (chat) {
                chat.messages = [];
                this.updateChatMetadata(this.currentChatId, {
                    messageCount: 0,
                    lastMessage: '',
                    lastActivity: new Date().toISOString()
                });
                this.notifications.showSuccess('Chat cleared');
            }
        }
    }

    exportChat(chatId, format = 'text') {
        try {
            const chat = this.appState.getChat(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }

            let exportContent = '';
            
            if (format === 'text') {
                exportContent = `Chat: ${chat.title}\nDate: ${new Date(chat.createdAt).toLocaleString()}\n\n`;
                
                chat.messages.forEach(msg => {
                    const role = msg.role === 'user' ? 'You' : 'TaskFlowAI';
                    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
                    exportContent += `[${timestamp}] ${role}: ${msg.content}\n\n`;
                });
            } else if (format === 'json') {
                exportContent = JSON.stringify(chat, null, 2);
            }

            // Create and download file
            const blob = new Blob([exportContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `taskflow-chat-${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format === 'json' ? 'json' : 'txt'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.notifications.showSuccess('Chat exported successfully');
            Logger.log('Chat exported', { chatId, format });

        } catch (error) {
            Logger.error('Failed to export chat', error);
            this.notifications.showError('Failed to export chat');
        }
    }

    // Utility methods
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateNoteId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get chat statistics
    getChatStats(chatId) {
        const chat = this.appState.getChat(chatId);
        if (!chat) return null;

        const userMessages = chat.messages.filter(msg => msg.role === 'user').length;
        const aiMessages = chat.messages.filter(msg => msg.role === 'assistant').length;
        const totalWords = chat.messages.reduce((count, msg) => count + msg.content.split(' ').length, 0);

        return {
            totalMessages: chat.messages.length,
            userMessages,
            aiMessages,
            totalWords,
            duration: chat.lastActivity ? new Date(chat.lastActivity) - new Date(chat.createdAt) : 0
        };
    }
}
