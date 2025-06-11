// ui/chatUI.js - Chat User Interface Components

import { Logger } from '../core/config.js';

export class ChatUI {
    constructor(appState, chatManager, notifications) {
        this.appState = appState;
        this.chatManager = chatManager;
        this.notifications = notifications;
        this.currentChatId = null;
        this.isAutoScrollEnabled = true;
        this.messageContainer = null;
        this.chatInput = null;
        this.sendButton = null;
    }

    initialize() {
        this.setupEventListeners();
        this.renderChatInterface();
        Logger.log('Chat UI initialized');
    }

    setupEventListeners() {
        // Listen for chat state changes
        this.appState.addEventListener('chatsChanged', () => {
            this.refreshChatList();
        });

        this.appState.addEventListener('chatUpdated', (event) => {
            const { chatId } = event.detail;
            if (chatId === this.currentChatId) {
                this.refreshCurrentChat();
            }
            this.refreshChatList();
        });

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'Enter':
                        if (this.chatInput && document.activeElement === this.chatInput) {
                            event.preventDefault();
                            this.sendMessage();
                        }
                        break;
                    case 'n':
                        if (this.isInChatTab()) {
                            event.preventDefault();
                            this.startNewChat();
                        }
                        break;
                }
            }
        });
    }

    renderChatInterface() {
        const chatTab = document.getElementById('chatTab');
        if (!chatTab) {
            Logger.error('Chat tab container not found');
            return;
        }

        chatTab.innerHTML = `
            <div class="chat-container">
                <!-- Chat Sidebar -->
                <div class="chat-sidebar">
                    <div class="chat-sidebar-header">
                        <h3>Conversations</h3>
                        <button class="btn btn-sm btn-primary" onclick="startNewChat()" title="New Chat">
                            <span class="btn-icon">💬</span>
                            New Chat
                        </button>
                    </div>
                    
                    <div class="chat-list" id="chatList">
                        <!-- Chat list will be populated here -->
                    </div>
                </div>

                <!-- Chat Main Area -->
                <div class="chat-main">
                    <div class="chat-header" id="chatHeader">
                        <div class="chat-title">
                            <h3 id="currentChatTitle">Select a chat or start a new conversation</h3>
                            <div class="chat-actions">
                                <button class="btn btn-sm" onclick="summarizeCurrentChat()" title="Summarize to Note" id="summarizeBtn" style="display: none;">
                                    📝 Summarize
                                </button>
                                <button class="btn btn-sm" onclick="extractTasksFromCurrentChat()" title="Extract Tasks" id="extractTasksBtn" style="display: none;">
                                    ✨ Extract Tasks
                                </button>
                                <button class="btn btn-sm" onclick="exportCurrentChat()" title="Export Chat" id="exportBtn" style="display: none;">
                                    📤 Export
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="clearCurrentChat()" title="Clear Chat" id="clearBtn" style="display: none;">
                                    🗑️ Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="chat-messages" id="chatMessages">
                        <div class="chat-welcome">
                            <div class="welcome-icon">🤖</div>
                            <h3>Welcome to TaskFlowAI Chat</h3>
                            <p>I'm here to help you analyze your thoughts, organize ideas, and manage your productivity. Start a conversation to get personalized assistance!</p>
                            <div class="chat-suggestions">
                                <button class="suggestion-btn" onclick="sendSuggestion('Help me organize my thoughts about an upcoming project')">
                                    💡 Organize project thoughts
                                </button>
                                <button class="suggestion-btn" onclick="sendSuggestion('I have too many tasks and feel overwhelmed. Can you help me prioritize?')">
                                    📋 Help with task prioritization
                                </button>
                                <button class="suggestion-btn" onclick="sendSuggestion('Can you help me break down a complex goal into smaller steps?')">
                                    🎯 Break down complex goals
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="chat-input-container">
                        <div class="chat-input-wrapper">
                            <textarea 
                                id="chatInput" 
                                placeholder="Type your message... (Ctrl+Enter to send)"
                                rows="3"
                                disabled
                            ></textarea>
                            <button 
                                id="sendButton" 
                                class="btn btn-primary send-btn" 
                                onclick="sendMessage()"
                                disabled
                                title="Send message (Ctrl+Enter)"
                            >
                                <span class="btn-icon">📤</span>
                                Send
                            </button>
                        </div>
                        <div class="chat-input-status" id="chatInputStatus"></div>
                    </div>
                </div>
            </div>
        `;

        // Store references to key elements
        this.messageContainer = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');

        // Setup input event listeners
        this.setupInputListeners();
        
        // Load existing chats
        this.refreshChatList();
    }

    setupInputListeners() {
        if (this.chatInput) {
            // Auto-resize textarea
            this.chatInput.addEventListener('input', () => {
                this.chatInput.style.height = 'auto';
                this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
                
                // Enable/disable send button
                const hasContent = this.chatInput.value.trim().length > 0;
                this.sendButton.disabled = !hasContent || this.chatManager.isProcessing;
            });

            // Handle Enter key
            this.chatInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        this.sendMessage();
                    } else if (!event.shiftKey) {
                        // Allow Shift+Enter for new lines, but prevent plain Enter
                        event.preventDefault();
                    }
                }
            });
        }
    }

    refreshChatList() {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        const chats = this.appState.chats || [];
        
        if (chats.length === 0) {
            chatList.innerHTML = `
                <div class="empty-chat-list">
                    <p>No conversations yet</p>
                    <button class="btn btn-sm btn-primary" onclick="startNewChat()">
                        Start your first chat
                    </button>
                </div>
            `;
            return;
        }

        // Sort chats by last activity
        const sortedChats = [...chats].sort((a, b) => 
            new Date(b.lastActivity) - new Date(a.lastActivity)
        );

        chatList.innerHTML = sortedChats.map(chat => `
            <div class="chat-item ${chat.id === this.currentChatId ? 'active' : ''}" 
                 onclick="selectChat('${chat.id}')">
                <div class="chat-item-header">
                    <h4 class="chat-item-title">${this.escapeHtml(chat.title)}</h4>
                    <span class="chat-item-time">${this.formatTime(chat.lastActivity)}</span>
                </div>
                <p class="chat-item-preview">${this.escapeHtml(chat.lastMessage || 'No messages yet')}</p>
                <div class="chat-item-meta">
                    <span class="message-count">${chat.messageCount || 0} messages</span>
                    <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete chat">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    selectChat(chatId) {
        this.currentChatId = chatId;
        this.chatManager.currentChatId = chatId;
        
        // Update UI
        this.refreshChatList(); // Update active state
        this.refreshCurrentChat();
        this.enableChatInput();
        this.showChatActions();
        
        Logger.log('Chat selected', { chatId });
    }

    refreshCurrentChat() {
        if (!this.currentChatId) {
            this.showWelcomeScreen();
            return;
        }

        const chat = this.appState.getChat(this.currentChatId);
        if (!chat) {
            this.showWelcomeScreen();
            return;
        }

        // Update chat title
        const titleElement = document.getElementById('currentChatTitle');
        if (titleElement) {
            titleElement.textContent = chat.title;
        }

        // Render messages
        this.renderMessages(chat.messages);
    }

    renderMessages(messages) {
        if (!this.messageContainer) return;

        if (!messages || messages.length === 0) {
            this.messageContainer.innerHTML = `
                <div class="empty-chat">
                    <div class="empty-icon">💬</div>
                    <p>Start the conversation by sending a message below</p>
                </div>
            `;
            return;
        }

        this.messageContainer.innerHTML = messages.map(message => 
            this.renderMessage(message)
        ).join('');

        // Auto-scroll to bottom if enabled
        if (this.isAutoScrollEnabled) {
            this.scrollToBottom();
        }
    }

    renderMessage(message) {
        const isUser = message.role === 'user';
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        return `
            <div class="message ${isUser ? 'user-message' : 'ai-message'}">
                <div class="message-header">
                    <span class="message-sender">${isUser ? 'You' : 'TaskFlowAI'}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">
                    ${this.formatMessageContent(message.content)}
                </div>
                ${!isUser ? `
                    <div class="message-actions">
                        <button class="btn btn-xs" onclick="copyMessageContent('${message.id}')" title="Copy message">
                            📋
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatMessageContent(content) {
        // Basic markdown-like formatting
        return this.escapeHtml(content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    async sendMessage() {
        if (!this.chatInput || !this.sendButton) return;
        
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Disable input while processing
        this.disableChatInput('Sending...');
        
        try {
            // Clear input immediately for better UX
            this.chatInput.value = '';
            this.chatInput.style.height = 'auto';

            // If no current chat, create one
            if (!this.currentChatId) {
                this.startNewChat();
            }

            // Send message through chat manager
            const result = await this.chatManager.sendMessage(message, this.currentChatId);
            
            if (result) {
                // Update current chat ID if it was created
                this.currentChatId = result.chatId;
                this.chatManager.currentChatId = result.chatId;
                
                // Refresh UI
                this.refreshCurrentChat();
                this.refreshChatList();
                this.showChatActions();
            }
            
        } catch (error) {
            Logger.error('Failed to send message', error);
            this.notifications.showError('Failed to send message. Please try again.');
        } finally {
            this.enableChatInput();
        }
    }

    startNewChat() {
        const chat = this.chatManager.createNewChat();
        this.currentChatId = chat.id;
        
        // Update UI
        this.refreshChatList();
        this.refreshCurrentChat();
        this.enableChatInput();
        this.showChatActions();
        
        // Focus input
        if (this.chatInput) {
            this.chatInput.focus();
        }
        
        Logger.log('New chat started', { chatId: chat.id });
    }

    showWelcomeScreen() {
        if (!this.messageContainer) return;
        
        this.messageContainer.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-icon">🤖</div>
                <h3>Welcome to TaskFlowAI Chat</h3>
                <p>I'm here to help you analyze your thoughts, organize ideas, and manage your productivity. Start a conversation to get personalized assistance!</p>
                <div class="chat-suggestions">
                    <button class="suggestion-btn" onclick="sendSuggestion('Help me organize my thoughts about an upcoming project')">
                        💡 Organize project thoughts
                    </button>
                    <button class="suggestion-btn" onclick="sendSuggestion('I have too many tasks and feel overwhelmed. Can you help me prioritize?')">
                        📋 Help with task prioritization
                    </button>
                    <button class="suggestion-btn" onclick="sendSuggestion('Can you help me break down a complex goal into smaller steps?')">
                        🎯 Break down complex goals
                    </button>
                </div>
            </div>
        `;
        
        // Update title
        const titleElement = document.getElementById('currentChatTitle');
        if (titleElement) {
            titleElement.textContent = 'Select a chat or start a new conversation';
        }
        
        this.hideChatActions();
        this.disableChatInput('Select a chat or start a new conversation');
    }

    enableChatInput() {
        if (this.chatInput && this.sendButton) {
            this.chatInput.disabled = false;
            this.chatInput.placeholder = 'Type your message... (Ctrl+Enter to send)';
            this.sendButton.disabled = this.chatInput.value.trim().length === 0;
            
            const statusElement = document.getElementById('chatInputStatus');
            if (statusElement) {
                statusElement.textContent = '';
            }
        }
    }

    disableChatInput(message = 'Chat not available') {
        if (this.chatInput && this.sendButton) {
            this.chatInput.disabled = true;
            this.chatInput.placeholder = message;
            this.sendButton.disabled = true;
            
            const statusElement = document.getElementById('chatInputStatus');
            if (statusElement) {
                statusElement.textContent = message;
            }
        }
    }

    showChatActions() {
        const actions = ['summarizeBtn', 'extractTasksBtn', 'exportBtn', 'clearBtn'];
        actions.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'inline-block';
            }
        });
    }

    hideChatActions() {
        const actions = ['summarizeBtn', 'extractTasksBtn', 'exportBtn', 'clearBtn'];
        actions.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
    }

    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    isInChatTab() {
        const chatTab = document.getElementById('chatTab');
        return chatTab && chatTab.classList.contains('active');
    }

    // Public methods for global access
    sendSuggestion(suggestion) {
        if (this.chatInput) {
            this.chatInput.value = suggestion;
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
            this.sendButton.disabled = false;
            this.chatInput.focus();
        }
    }

    async summarizeCurrentChat() {
        if (!this.currentChatId) {
            this.notifications.showWarning('No chat selected');
            return;
        }

        try {
            const note = await this.chatManager.summarizeChatToNote(this.currentChatId);
            if (note) {
                // Switch to notes tab to show the created note
                if (window.switchTab) {
                    window.switchTab('notes');
                }
            }
        } catch (error) {
            // Error already handled in chatManager
        }
    }

    async extractTasksFromCurrentChat() {
        if (!this.currentChatId) {
            this.notifications.showWarning('No chat selected');
            return;
        }

        try {
            await this.chatManager.extractTasksFromChat(this.currentChatId);
        } catch (error) {
            // Error already handled in chatManager
        }
    }

    exportCurrentChat() {
        if (!this.currentChatId) {
            this.notifications.showWarning('No chat selected');
            return;
        }

        // Show export options
        const format = confirm('Export as JSON? (Cancel for plain text)') ? 'json' : 'text';
        this.chatManager.exportChat(this.currentChatId, format);
    }

    clearCurrentChat() {
        if (!this.currentChatId) {
            this.notifications.showWarning('No chat selected');
            return;
        }

        if (confirm('Are you sure you want to clear this chat? This action cannot be undone.')) {
            this.chatManager.clearCurrentChat();
            this.refreshCurrentChat();
        }
    }

    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
            this.chatManager.deleteChat(chatId);
            
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
                this.chatManager.currentChatId = null;
                this.showWelcomeScreen();
            }
            
            this.refreshChatList();
        }
    }

    copyMessageContent(messageId) {
        const chat = this.appState.getChat(this.currentChatId);
        if (!chat) return;

        const message = chat.messages.find(msg => msg.id === messageId);
        if (!message) return;

        navigator.clipboard.writeText(message.content).then(() => {
            this.notifications.showSuccess('Message copied to clipboard');
        }).catch(() => {
            this.notifications.showError('Failed to copy message');
        });
    }
}
