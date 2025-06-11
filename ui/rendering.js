// ui/rendering.js - Task Rendering Management

import { CONFIG, Logger } from '../core/config.js';

export class TaskRenderer {
    constructor(appState) {
        this.appState = appState;
        this.completedSectionVisible = false;
        this.postponedSectionVisible = false;
        this.pendingSectionVisible = false;
    }

    renderAll() {
        try {
            this.renderTodayTasks();
            this.renderPendingTasks();
            this.renderCompletedTasks();
            this.renderPostponedTasks();
            this.updateTaskCounts();
            
            Logger.log('Tasks rendered successfully');
        } catch (error) {
            Logger.error('Failed to render tasks', error);
        }
    }

    renderTodayTasks() {
        const container = document.getElementById('tasksList');
        if (!container) return;

        const todayTasks = this.appState.getTodayTasks();
        
        if (todayTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p>No active tasks for today. Create your first one!</p>
                </div>
            `;
            return;
        }

        // Sort tasks by creation time (newest first)
        const sortedTasks = todayTasks.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        container.innerHTML = sortedTasks.map(task => this.renderTaskItem(task)).join('');
    }

    renderTaskItem(task) {
        return `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="window.taskFlowApp.toggleTaskComplete('${task.id}', event)"
                     title="Mark as complete">
                </div>
                <div class="task-content" onclick="openModal('edit', '${task.id}')">
                    <div class="task-title">${this.escapeHtml(task.name)}</div>
                    ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span title="Task type">${task.type === 'ai' ? '✨ AI' : '✓ Quick'}</span>
                        <span title="Created at">${this.formatTime(task.createdAt)}</span>
                        ${task.modifiedAt ? `<span title="Modified at">✏️ ${this.formatTime(task.modifiedAt)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderCompletedTasks() {
        const container = document.getElementById('completedTasksList');
        if (!container) return;

        const completedTasks = this.appState.getCompletedTasks();
        
        if (completedTasks.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 0.9rem;">No completed tasks yet</p>';
            return;
        }

        const sortedTasks = completedTasks
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, CONFIG.MAX_COMPLETED_DISPLAY);
            
        container.innerHTML = sortedTasks.map(task => `
            <div class="expandable-task-item completed" onclick="openModal('edit', '${task.id}')" title="Click to view details">
                <span>${this.escapeHtml(task.name)}</span>
                <span class="task-date" title="Completed on">${this.formatDate(task.completedAt)}</span>
            </div>
        `).join('');
        
        if (completedTasks.length > CONFIG.MAX_COMPLETED_DISPLAY) {
            container.innerHTML += `<p style="color: #666; font-size: 0.8rem; text-align: center; margin-top: 1rem;">Showing ${CONFIG.MAX_COMPLETED_DISPLAY} of ${completedTasks.length} completed tasks</p>`;
        }
    }

    renderPendingTasks() {
        const container = document.getElementById('pendingTasksList');
        if (!container) return;

        const pendingTasks = this.appState.pendingTasks || [];
        
        if (pendingTasks.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 0.9rem;">No tasks pending approval</p>';
            return;
        }

        const sortedTasks = pendingTasks
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
        container.innerHTML = sortedTasks.map(task => `
            <div class="pending-task-item" data-pending-id="${task.id}">
                <div class="pending-task-content">
                    <div class="pending-task-title">${this.escapeHtml(task.title)}</div>
                    <div class="pending-task-description">${this.escapeHtml(task.description || '')}</div>
                    <div class="pending-task-meta">
                        <span class="confidence-badge" title="AI Confidence">${Math.round(task.confidence * 100)}%</span>
                        <span class="source-note" title="From note">${this.escapeHtml(task.sourceNoteTitle)}</span>
                        <span class="created-time" title="Created">${this.formatTime(task.createdAt)}</span>
                    </div>
                    ${task.context ? `<div class="pending-task-context">${this.escapeHtml(task.context)}</div>` : ''}
                </div>
                <div class="pending-task-actions">
                    <button class="approve-btn" onclick="approvePendingTask('${task.id}')" title="Approve and add to tasks">
                        ✓ Approve
                    </button>
                    <button class="reject-btn" onclick="rejectPendingTask('${task.id}')" title="Reject and remove">
                        ✗ Reject
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add bulk actions if there are multiple tasks
        if (pendingTasks.length > 1) {
            container.innerHTML += `
                <div class="pending-bulk-actions">
                    <button class="bulk-approve-btn" onclick="bulkApprovePendingTasks()">
                        ✓ Approve All (${pendingTasks.length})
                    </button>
                    <button class="bulk-reject-btn" onclick="bulkRejectPendingTasks()">
                        ✗ Reject All
                    </button>
                </div>
            `;
        }
    }

    renderPostponedTasks() {
        const container = document.getElementById('postponedTasksList');
        if (!container) return;

        const postponedTasks = this.appState.getPostponedTasks();
        
        if (postponedTasks.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 0.9rem;">No postponed tasks</p>';
            return;
        }

        const sortedTasks = postponedTasks
            .sort((a, b) => new Date(b.postponedAt) - new Date(a.postponedAt))
            .slice(0, CONFIG.MAX_POSTPONED_DISPLAY);
            
        container.innerHTML = sortedTasks.map(task => `
            <div class="expandable-task-item" onclick="openModal('edit', '${task.id}')" title="Click to view details">
                <span>${this.escapeHtml(task.name)}</span>
                <span class="task-date" title="Postponed on">${this.formatDate(task.postponedAt)}</span>
            </div>
        `).join('');
        
        if (postponedTasks.length > CONFIG.MAX_POSTPONED_DISPLAY) {
            container.innerHTML += `<p style="color: #666; font-size: 0.8rem; text-align: center; margin-top: 1rem;">Showing ${CONFIG.MAX_POSTPONED_DISPLAY} of ${postponedTasks.length} postponed tasks</p>`;
        }
    }

    updateTaskCounts() {
        const counts = this.appState.getTaskCounts();
        const pendingCount = this.appState.getPendingTasksCount();
        
        const completedCountEl = document.getElementById('completedCount');
        const postponedCountEl = document.getElementById('postponedCount');
        const pendingCountEl = document.getElementById('pendingCount');
        
        if (completedCountEl) {
            completedCountEl.textContent = counts.completed;
        }
        
        if (postponedCountEl) {
            postponedCountEl.textContent = counts.postponed;
        }
        
        if (pendingCountEl) {
            pendingCountEl.textContent = pendingCount;
        }
    }

    toggleCompletedTasks() {
        try {
            const section = document.getElementById('completedSection');
            const button = document.querySelector('.completed-btn');
            const postponedSection = document.getElementById('postponedSection');
            const postponedButton = document.querySelector('.postponed-btn');
            const pendingSection = document.getElementById('pendingSection');
            const pendingButton = document.querySelector('.pending-btn');
            
            if (!section || !button) return;
            
            this.completedSectionVisible = !this.completedSectionVisible;
            
            if (this.completedSectionVisible) {
                section.style.display = 'block';
                button.classList.add('active');
                // Hide other sections if open
                if (postponedSection && postponedButton) {
                    postponedSection.style.display = 'none';
                    postponedButton.classList.remove('active');
                    this.postponedSectionVisible = false;
                }
                if (pendingSection && pendingButton) {
                    pendingSection.style.display = 'none';
                    pendingButton.classList.remove('active');
                    this.pendingSectionVisible = false;
                }
                
                // Scroll to section
                section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                section.style.display = 'none';
                button.classList.remove('active');
            }
            
            Logger.log('Toggled completed tasks visibility', { visible: this.completedSectionVisible });
        } catch (error) {
            Logger.error('Failed to toggle completed tasks', error);
        }
    }

    togglePendingTasks() {
        try {
            const section = document.getElementById('pendingSection');
            const button = document.querySelector('.pending-btn');
            const completedSection = document.getElementById('completedSection');
            const completedButton = document.querySelector('.completed-btn');
            const postponedSection = document.getElementById('postponedSection');
            const postponedButton = document.querySelector('.postponed-btn');
            
            if (!section || !button) return;
            
            this.pendingSectionVisible = !this.pendingSectionVisible;
            
            if (this.pendingSectionVisible) {
                section.style.display = 'block';
                button.classList.add('active');
                // Hide other sections if open
                if (completedSection && completedButton) {
                    completedSection.style.display = 'none';
                    completedButton.classList.remove('active');
                    this.completedSectionVisible = false;
                }
                if (postponedSection && postponedButton) {
                    postponedSection.style.display = 'none';
                    postponedButton.classList.remove('active');
                    this.postponedSectionVisible = false;
                }
                
                // Scroll to section
                section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                section.style.display = 'none';
                button.classList.remove('active');
            }
            
            Logger.log('Toggled pending tasks visibility', { visible: this.pendingSectionVisible });
        } catch (error) {
            Logger.error('Failed to toggle pending tasks', error);
        }
    }

    togglePostponedTasks() {
        try {
            const section = document.getElementById('postponedSection');
            const button = document.querySelector('.postponed-btn');
            const completedSection = document.getElementById('completedSection');
            const completedButton = document.querySelector('.completed-btn');
            const pendingSection = document.getElementById('pendingSection');
            const pendingButton = document.querySelector('.pending-btn');
            
            if (!section || !button) return;
            
            this.postponedSectionVisible = !this.postponedSectionVisible;
            
            if (this.postponedSectionVisible) {
                section.style.display = 'block';
                button.classList.add('active');
                // Hide other sections if open
                if (completedSection && completedButton) {
                    completedSection.style.display = 'none';
                    completedButton.classList.remove('active');
                    this.completedSectionVisible = false;
                }
                if (pendingSection && pendingButton) {
                    pendingSection.style.display = 'none';
                    pendingButton.classList.remove('active');
                    this.pendingSectionVisible = false;
                }
                
                // Scroll to section
                section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                section.style.display = 'none';
                button.classList.remove('active');
            }
            
            Logger.log('Toggled postponed tasks visibility', { visible: this.postponedSectionVisible });
        } catch (error) {
            Logger.error('Failed to toggle postponed tasks', error);
        }
    }

    // Utility methods
    formatTime(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return 'Unknown';
        }
    }

    formatDate(isoString) {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            
            return date.toLocaleDateString();
        } catch (error) {
            return 'Unknown';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Animation helpers
    animateTaskAddition(taskElement) {
        if (!taskElement) return;
        
        taskElement.style.opacity = '0';
        taskElement.style.transform = 'translateY(-10px)';
        
        requestAnimationFrame(() => {
            taskElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            taskElement.style.opacity = '1';
            taskElement.style.transform = 'translateY(0)';
        });
    }

    animateTaskRemoval(taskElement, callback) {
        if (!taskElement) {
            callback?.();
            return;
        }
        
        taskElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        taskElement.style.opacity = '0';
        taskElement.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            callback?.();
        }, 300);
    }

    highlightTask(taskId, duration = 2000) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskElement) return;
        
        taskElement.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
        taskElement.style.borderColor = 'rgba(76, 175, 80, 0.8)';
        
        setTimeout(() => {
            taskElement.style.boxShadow = '';
            taskElement.style.borderColor = '';
        }, duration);
    }
}
