// ui/notesModals.js - Notes Modal Management

import { Logger } from '../core/config.js';

export class NotesModalManager {
    constructor(appState, notesManager, notifications) {
        this.appState = appState;
        this.notesManager = notesManager;
        this.notifications = notifications;
        this.currentNoteId = null;
        this.isEditing = false;
    }

    openModal(type, noteId = null) {
        this.currentNoteId = noteId;
        
        switch (type) {
            case 'create':
                this.openCreateModal();
                break;
            case 'edit':
                this.openEditModal(noteId);
                break;
            case 'view':
                this.openViewModal(noteId);
                break;
            case 'summary':
                this.openSummaryModal();
                break;
            case 'export':
                this.openExportModal();
                break;
            default:
                Logger.error('Unknown notes modal type', { type });
        }
    }

    openCreateModal() {
        const modalHtml = `
            <div class="modal-overlay active" id="notesCreateModalOverlay">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>Create New Note</h2>
                        <button class="modal-close" onclick="closeNotesModal('create')">&times;</button>
                    </div>
                    
                    <form id="createNoteForm" onsubmit="saveNote(event)">
                        <div class="form-group">
                            <label for="noteTitle">Title (optional)</label>
                            <input type="text" id="noteTitle" placeholder="Leave empty to auto-generate from content..." />
                        </div>
                        
                        <div class="form-group">
                            <label for="noteContent">Content</label>
                            <textarea id="noteContent" placeholder="Paste your thoughts, emails, meeting notes, project updates, or any text here..." required rows="12"></textarea>
                            <div class="textarea-help">
                                <span class="help-text">💡 AI will automatically summarize your note and extract any tasks</span>
                                <span class="char-count" id="contentCharCount">0 characters</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="noteTags">Tags (optional)</label>
                            <input type="text" id="noteTags" placeholder="work, project, meeting, idea (comma-separated)" />
                            <div class="help-text">Add tags to organize and find your notes easily</div>
                        </div>

                        <div class="button-group">
                            <button type="submit" class="btn btn-primary">
                                <span class="btn-icon">💾</span>
                                Save Note
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="closeNotesModal('create')">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.setupCreateModalListeners();
        
        // Focus on content area
        setTimeout(() => {
            const noteContent = document.getElementById('noteContent');
            if (noteContent) {
                noteContent.focus();
            }
        }, 100);
    }

    openEditModal(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) {
            this.notifications.showError('Note not found');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay active" id="notesEditModalOverlay">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>Edit Note</h2>
                        <button class="modal-close" onclick="closeNotesModal('edit')">&times;</button>
                    </div>
                    
                    <form id="editNoteForm" onsubmit="updateNote(event)">
                        <div class="form-group">
                            <label for="editNoteTitle">Title</label>
                            <input type="text" id="editNoteTitle" value="${note.title}" required />
                        </div>
                        
                        <div class="form-group">
                            <label for="editNoteContent">Content</label>
                            <textarea id="editNoteContent" required rows="12">${note.content}</textarea>
                            <div class="textarea-help">
                                <span class="help-text">💡 Changes will trigger AI re-processing</span>
                                <span class="char-count" id="editContentCharCount">${note.content.length} characters</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="editNoteTags">Tags</label>
                            <input type="text" id="editNoteTags" value="${note.tags.join(', ')}" />
                        </div>

                        ${note.extractedTasks.length > 0 ? this.renderExtractedTasksSection(note.extractedTasks) : ''}

                        <div class="button-group">
                            <button type="submit" class="btn btn-primary">
                                <span class="btn-icon">💾</span>
                                Update Note
                            </button>
                            <button type="button" class="btn btn-danger" onclick="confirmDeleteNote('${noteId}')">
                                <span class="btn-icon">🗑️</span>
                                Delete Note
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="closeNotesModal('edit')">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.setupEditModalListeners();
    }

    openViewModal(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) {
            this.notifications.showError('Note not found');
            return;
        }

        const createdDate = new Date(note.createdAt).toLocaleString();
        const modifiedDate = new Date(note.modifiedAt).toLocaleString();
        
        const modalHtml = `
            <div class="modal-overlay active" id="notesViewModalOverlay">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>${note.title}</h2>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" onclick="openNotesModal('edit', '${noteId}')">
                                <span class="btn-icon">✏️</span>
                                Edit
                            </button>
                            <button class="modal-close" onclick="closeNotesModal('view')">&times;</button>
                        </div>
                    </div>
                    
                    <div class="note-view-content">
                        <div class="note-meta">
                            <div class="note-dates">
                                <span><strong>Created:</strong> ${createdDate}</span>
                                ${modifiedDate !== createdDate ? `<span><strong>Modified:</strong> ${modifiedDate}</span>` : ''}
                            </div>
                            
                            ${note.tags.length > 0 ? `
                                <div class="note-tags-display">
                                    <strong>Tags:</strong> ${note.tags.map(tag => `<span class="note-tag">#${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                            
                            <div class="note-ai-status">
                                ${note.aiProcessed ? 
                                    `<span class="ai-status processed">🤖 AI Processed</span>` : 
                                    `<span class="ai-status processing">⏳ AI Processing...</span>`
                                }
                            </div>
                        </div>

                        ${note.summary ? `
                            <div class="note-summary-display">
                                <h4>AI Summary</h4>
                                <p>${note.summary}</p>
                            </div>
                        ` : ''}

                        <div class="note-content-display">
                            <h4>Content</h4>
                            <div class="note-content-text">${this.formatNoteContent(note.content)}</div>
                        </div>

                        ${note.extractedTasks.length > 0 ? `
                            <div class="note-extracted-tasks">
                                <h4>Extracted Tasks (${note.extractedTasks.length})</h4>
                                ${this.renderExtractedTasksList(note.extractedTasks)}
                            </div>
                        ` : ''}
                    </div>

                    <div class="note-view-actions">
                        <button class="btn btn-primary" onclick="exportSingleNote('${noteId}')">
                            <span class="btn-icon">📤</span>
                            Export Note
                        </button>
                        <button class="btn btn-secondary" onclick="copyNoteContent('${noteId}')">
                            <span class="btn-icon">📋</span>
                            Copy Content
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    openSummaryModal() {
        const modalHtml = `
            <div class="modal-overlay active" id="notesSummaryModalOverlay">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>Generate Summary</h2>
                        <button class="modal-close" onclick="closeNotesModal('summary')">&times;</button>
                    </div>
                    
                    <div class="summary-options">
                        <div class="summary-type-selector">
                            <h4>Summary Type</h4>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="summaryType" value="daily" checked />
                                    <span>Daily Summary</span>
                                    <small>Summary of today's notes</small>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="summaryType" value="weekly" />
                                    <span>Weekly Summary</span>
                                    <small>Summary of the past 7 days</small>
                                </label>
                            </div>
                        </div>

                        <div class="summary-actions">
                            <button class="btn btn-primary" onclick="generateSummary()">
                                <span class="btn-icon">🤖</span>
                                Generate Summary
                            </button>
                            <button class="btn btn-secondary" onclick="closeNotesModal('summary')">
                                Cancel
                            </button>
                        </div>
                    </div>

                    <div class="summary-result" id="summaryResult" style="display: none;">
                        <h4>Generated Summary</h4>
                        <div class="summary-content" id="summaryContent"></div>
                        <div class="summary-actions">
                            <button class="btn btn-secondary" onclick="copySummary()">
                                <span class="btn-icon">📋</span>
                                Copy Summary
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    openExportModal() {
        const stats = this.notesManager.getNotesStats();
        
        const modalHtml = `
            <div class="modal-overlay active" id="notesExportModalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Export Notes</h2>
                        <button class="modal-close" onclick="closeNotesModal('export')">&times;</button>
                    </div>
                    
                    <div class="export-options">
                        <div class="export-stats">
                            <p><strong>${stats.total}</strong> total notes available for export</p>
                        </div>

                        <div class="form-group">
                            <label>Export Format</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="exportFormat" value="markdown" checked />
                                    <span>Markdown (.md)</span>
                                    <small>Best for documentation and sharing</small>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="exportFormat" value="json" />
                                    <span>JSON (.json)</span>
                                    <small>Complete data with metadata</small>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="exportFormat" value="txt" />
                                    <span>Plain Text (.txt)</span>
                                    <small>Simple text format</small>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Export Scope</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="exportScope" value="all" checked />
                                    <span>All Notes</span>
                                    <small>Export all ${stats.total} notes</small>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="exportScope" value="recent" />
                                    <span>Recent Notes</span>
                                    <small>Notes from the past 30 days</small>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="exportScope" value="today" />
                                    <span>Today's Notes</span>
                                    <small>${stats.today} notes from today</small>
                                </label>
                            </div>
                        </div>

                        <div class="export-actions">
                            <button class="btn btn-primary" onclick="performExport()">
                                <span class="btn-icon">📤</span>
                                Export Notes
                            </button>
                            <button class="btn btn-secondary" onclick="closeNotesModal('export')">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    closeModal(type) {
        const modalId = `notes${type.charAt(0).toUpperCase() + type.slice(1)}ModalOverlay`;
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
        this.currentNoteId = null;
        this.isEditing = false;
    }

    setupCreateModalListeners() {
        const contentTextarea = document.getElementById('noteContent');
        const charCount = document.getElementById('contentCharCount');
        
        contentTextarea.addEventListener('input', () => {
            charCount.textContent = `${contentTextarea.value.length} characters`;
        });

        // Auto-resize textarea
        contentTextarea.addEventListener('input', this.autoResizeTextarea);
    }

    setupEditModalListeners() {
        const contentTextarea = document.getElementById('editNoteContent');
        const charCount = document.getElementById('editContentCharCount');
        
        contentTextarea.addEventListener('input', () => {
            charCount.textContent = `${contentTextarea.value.length} characters`;
        });

        // Auto-resize textarea
        contentTextarea.addEventListener('input', this.autoResizeTextarea);
    }

    autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    renderExtractedTasksSection(tasks) {
        return `
            <div class="extracted-tasks-section">
                <h4>Extracted Tasks (${tasks.length})</h4>
                <div class="extracted-tasks-list">
                    ${tasks.map((task, index) => `
                        <div class="extracted-task-item">
                            <div class="task-info">
                                <strong>${task.title}</strong>
                                <p>${task.description}</p>
                                <small>Confidence: ${Math.round(task.confidence * 100)}%</small>
                            </div>
                            ${task.autoAdd ? 
                                '<span class="task-auto-added">✓ Auto-added to tasks</span>' : 
                                '<span class="task-suggestion">💡 Suggestion</span>'
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderExtractedTasksList(tasks) {
        return `
            <div class="extracted-tasks-display">
                ${tasks.map(task => `
                    <div class="extracted-task-display-item">
                        <div class="task-header">
                            <strong>${task.title}</strong>
                            <span class="task-confidence">Confidence: ${Math.round(task.confidence * 100)}%</span>
                        </div>
                        <p class="task-description">${task.description}</p>
                        ${task.context ? `<small class="task-context">Context: ${task.context}</small>` : ''}
                        ${this.getTaskStatusDisplay(task)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    formatNoteContent(content) {
        // Convert line breaks to HTML and preserve formatting
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    // Public API methods for global access
    async saveNote(event) {
        event.preventDefault();
        
        try {
            const title = document.getElementById('noteTitle').value.trim();
            const content = document.getElementById('noteContent').value.trim();
            const tagsInput = document.getElementById('noteTags').value.trim();
            
            if (!content) {
                this.notifications.showError('Note content is required');
                return;
            }

            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            const noteData = { title, content, tags };
            const note = await this.notesManager.createNote(noteData);
            
            this.closeModal('create');
            this.notifications.showSuccess('Note created successfully!');
            
            Logger.log('Note created via modal', { noteId: note.id });
            
        } catch (error) {
            Logger.error('Failed to save note', error);
            this.notifications.showError('Failed to save note. Please try again.');
        }
    }

    async updateNote(event) {
        event.preventDefault();
        
        try {
            const title = document.getElementById('editNoteTitle').value.trim();
            const content = document.getElementById('editNoteContent').value.trim();
            const tagsInput = document.getElementById('editNoteTags').value.trim();
            
            if (!title || !content) {
                this.notifications.showError('Title and content are required');
                return;
            }

            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            const updates = { title, content, tags };
            await this.notesManager.updateNote(this.currentNoteId, updates);
            
            this.closeModal('edit');
            this.notifications.showSuccess('Note updated successfully!');
            
            Logger.log('Note updated via modal', { noteId: this.currentNoteId });
            
        } catch (error) {
            Logger.error('Failed to update note', error);
            this.notifications.showError('Failed to update note. Please try again.');
        }
    }

    async generateSummary() {
        try {
            const summaryType = document.querySelector('input[name="summaryType"]:checked').value;
            const generateBtn = document.querySelector('.summary-actions .btn-primary');
            const originalText = generateBtn.innerHTML;
            
            generateBtn.innerHTML = '<span class="loading"></span> Generating...';
            generateBtn.disabled = true;
            
            let summary;
            if (summaryType === 'daily') {
                summary = await this.notesManager.generateDailySummary();
            } else {
                summary = await this.notesManager.generateWeeklySummary();
            }
            
            document.getElementById('summaryContent').innerHTML = this.formatNoteContent(summary);
            document.getElementById('summaryResult').style.display = 'block';
            
            this.notifications.showSuccess('Summary generated successfully!');
            
        } catch (error) {
            Logger.error('Failed to generate summary', error);
            this.notifications.showError('Failed to generate summary. Please try again.');
        } finally {
            const generateBtn = document.querySelector('.summary-actions .btn-primary');
            if (generateBtn) {
                generateBtn.innerHTML = '<span class="btn-icon">🤖</span> Generate Summary';
                generateBtn.disabled = false;
            }
        }
    }

    async performExport() {
        try {
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const scope = document.querySelector('input[name="exportScope"]:checked').value;
            
            let notes = this.appState.notes;
            
            // Filter notes based on scope
            if (scope === 'recent') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                notes = notes.filter(note => new Date(note.createdAt) >= thirtyDaysAgo);
            } else if (scope === 'today') {
                const today = new Date().toISOString().split('T')[0];
                notes = notes.filter(note => note.createdAt.startsWith(today));
            }
            
            const exportData = await this.notesManager.exportNotes(format, { noteIds: notes.map(n => n.id) });
            
            // Download the file
            this.downloadFile(exportData, `notes-export-${scope}.${format}`, this.getMimeType(format));
            
            this.closeModal('export');
            this.notifications.showSuccess(`Exported ${notes.length} notes as ${format.toUpperCase()}`);
            
        } catch (error) {
            Logger.error('Failed to export notes', error);
            this.notifications.showError('Failed to export notes. Please try again.');
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getMimeType(format) {
        switch (format) {
            case 'json': return 'application/json';
            case 'markdown': return 'text/markdown';
            case 'txt': return 'text/plain';
            default: return 'text/plain';
        }
    }

    // Utility methods for global access
    copyNoteContent(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) return;
        
        navigator.clipboard.writeText(note.content).then(() => {
            this.notifications.showSuccess('Note content copied to clipboard');
        }).catch(() => {
            this.notifications.showError('Failed to copy content');
        });
    }

    copySummary() {
        const summaryContent = document.getElementById('summaryContent').textContent;
        navigator.clipboard.writeText(summaryContent).then(() => {
            this.notifications.showSuccess('Summary copied to clipboard');
        }).catch(() => {
            this.notifications.showError('Failed to copy summary');
        });
    }

    exportSingleNote(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) return;
        
        this.notesManager.exportNotes('markdown', { noteIds: [noteId] }).then(exportData => {
            this.downloadFile(exportData, `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`, 'text/markdown');
            this.notifications.showSuccess('Note exported successfully');
        }).catch(error => {
            Logger.error('Failed to export single note', error);
            this.notifications.showError('Failed to export note');
        });
    }

    confirmDeleteNote(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) return;

        if (confirm(`Are you sure you want to delete "${note.title}"? This action cannot be undone.`)) {
            this.notesManager.deleteNote(noteId);
            this.closeModal('edit');
            this.notifications.showSuccess('Note deleted successfully');
        }
    }

    getTaskStatusDisplay(task) {
        // Get the current note to check task status
        const note = this.appState.getNote(this.currentNoteId);
        if (!note) {
            return '<div class="task-status unknown">❓ Status unknown</div>';
        }

        // Check if this task was added to the main task list
        const isInTaskList = this.appState.tasks.some(mainTask => 
            mainTask.sourceNoteId === note.id && 
            (mainTask.name === task.title || mainTask.description === task.description)
        );

        // Check if this task is in pending approval
        const isInPending = this.appState.pendingTasks.some(pendingTask => 
            pendingTask.sourceNoteId === note.id && 
            (pendingTask.title === task.title || pendingTask.description === task.description)
        );

        if (isInTaskList) {
            return '<div class="task-status auto-added">✅ Automatically added to tasks</div>';
        } else if (isInPending) {
            return '<div class="task-status pending">⏳ Pending approval</div>';
        } else {
            // Task was either rejected or not processed yet
            if (task.confidence >= 0.95) {
                return '<div class="task-status rejected">❌ Rejected or removed</div>';
            } else {
                return '<div class="task-status low-confidence">💡 Low confidence - not auto-added</div>';
            }
        }
    }
}
