// ui/notifications.js - Notification Management

import { Logger } from '../core/config.js';

export class NotificationManager {
    constructor() {
        this.currentNotification = null;
        this.setupStyles();
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showNotification(message, type = 'info') {
        try {
            // Remove existing notification
            if (this.currentNotification) {
                this.currentNotification.remove();
                this.currentNotification = null;
            }
            
            const notification = this.createNotificationElement(message, type);
            document.body.appendChild(notification);
            this.currentNotification = notification;
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                    if (this.currentNotification === notification) {
                        this.currentNotification = null;
                    }
                }
            }, 5000);
            
            Logger.log(`Notification shown: ${type} - ${message}`);
        } catch (error) {
            Logger.error('Failed to show notification', error);
            // Fallback to alert
            alert(message);
        }
    }

    createNotificationElement(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const iconMap = {
            success: '✓',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${iconMap[type] || iconMap.info}</span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
            <button class="notification-close" onclick="this.parentElement.remove()" title="Close">×</button>
        `;
        
        return notification;
    }

    setupStyles() {
        // Add notification styles if not already present
        if (document.querySelector('#notification-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 2rem;
                right: 2rem;
                background: rgba(20, 20, 20, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 1rem 1.5rem;
                color: #fff;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                max-width: 400px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                font-size: 0.9rem;
            }
            
            .notification-success {
                border-color: rgba(76, 175, 80, 0.5);
                background: rgba(76, 175, 80, 0.1);
            }
            
            .notification-error {
                border-color: rgba(255, 67, 54, 0.5);
                background: rgba(255, 67, 54, 0.1);
            }
            
            .notification-warning {
                border-color: rgba(255, 193, 7, 0.5);
                background: rgba(255, 193, 7, 0.1);
            }
            
            .notification-info {
                border-color: rgba(33, 150, 243, 0.5);
                background: rgba(33, 150, 243, 0.1);
            }
            
            .notification-icon {
                font-size: 1.1rem;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                font-size: 1.2rem;
                padding: 0;
                margin-left: 0.5rem;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            
            .notification-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @media (max-width: 768px) {
                .notification {
                    top: 1rem;
                    right: 1rem;
                    left: 1rem;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility methods for specific use cases
    showTaskCreated() {
        this.showSuccess('Task created successfully!');
    }

    showTaskUpdated() {
        this.showSuccess('Task updated successfully!');
    }

    showTaskDeleted() {
        this.showSuccess('Task deleted successfully!');
    }

    showTaskCompleted() {
        this.showSuccess('Task completed! 🎉');
    }

    showTaskPostponed() {
        this.showSuccess('Task postponed');
    }

    showConfigurationSaved() {
        this.showSuccess('Configuration saved successfully!');
    }

    showConnectionError() {
        this.showError('Connection failed. Please check your settings.');
    }

    showValidationError(message) {
        this.showError(message);
    }

    clear() {
        if (this.currentNotification) {
            this.currentNotification.remove();
            this.currentNotification = null;
        }
    }
}