// ui/notesRenderer.js - Notes UI Rendering

import { Logger } from '../core/config.js';

export class NotesRenderer {
    constructor(appState, notesManager) {
        this.appState = appState;
        this.notesManager = notesManager;
        this.currentView = 'grid'; // 'grid' or 'list'
        this.searchQuery = '';
        this.selectedTags = [];
        this.sortBy = 'modified'; // 'created', 'modified', 'title'
        this.sortOrder = 'desc'; // 'asc', 'desc'
    }

    renderNotesGrid() {
        const container = document.getElementById('notesGrid');
        if (!container) return;

        const filteredNotes = this.getFilteredNotes();
        
        if (filteredNotes.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const notesHtml = filteredNotes.map(note => this.renderNoteCard(note)).join('');
        container.innerHTML = notesHtml;
        
        // Add event listeners
        this.attachNoteEventListeners();
    }

    renderNoteCard(note) {
        const createdDate = new Date(note.createdAt).toLocaleDateString();
        const modifiedDate = new Date(note.modifiedAt).toLocaleDateString();
        const isToday = note.createdAt.startsWith(new Date().toISOString().split('T')[0]);
        
        const tagsHtml = note.tags.length > 0 
            ? `<div class="note-tags">${note.tags.map(tag => `<span class="note-tag">#${tag}</span>`).join('')}</div>`
            : '';

        const summaryHtml = note.summary 
            ? `<div class="note-summary">${note.summary}</div>`
            : '';

        const tasksIndicator = note.extractedTasks.length > 0
            ? this.renderTasksIndicator(note)
            : '';

        const aiProcessedIndicator = note.aiProcessed
            ? `<div class="ai-processed-indicator" title="AI processed">🤖</div>`
            : `<div class="ai-processing-indicator" title="AI processing...">⏳</div>`;

        return `
            <div class="note-card ${isToday ? 'note-today' : ''}" data-note-id="${note.id}">
                <div class="note-header">
                    <h3 class="note-title" title="${note.title}">${this.truncateText(note.title, 50)}</h3>
                    <div class="note-indicators">
                        ${aiProcessedIndicator}
                        ${tasksIndicator}
                    </div>
                </div>
                
                ${summaryHtml}
                
                <div class="note-content-preview">
                    ${this.truncateText(note.content, 150)}
                </div>
                
                ${tagsHtml}
                
                <div class="note-footer">
                    <div class="note-dates">
                        <span class="note-created" title="Created: ${createdDate}">📅 ${createdDate}</span>
                        ${modifiedDate !== createdDate ? `<span class="note-modified" title="Modified: ${modifiedDate}">✏️ ${modifiedDate}</span>` : ''}
                    </div>
                    <div class="note-actions">
                        <button class="note-action-btn edit-note" data-note-id="${note.id}" title="Edit note">
                            ✏️
                        </button>
                        <button class="note-action-btn view-note" data-note-id="${note.id}" title="View note">
                            👁️
                        </button>
                        <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete note">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="notes-empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Start capturing your thoughts, ideas, and important information.</p>
                <button class="btn btn-primary" onclick="openNotesModal('create')">
                    Create Your First Note
                </button>
            </div>
        `;
    }

    renderNotesStats() {
        const stats = this.notesManager.getNotesStats();
        const statsContainer = document.getElementById('notesStats');
        
        if (!statsContainer) return;

        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">Total Notes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.today}</span>
                    <span class="stat-label">Today</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.thisWeek}</span>
                    <span class="stat-label">This Week</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.withTasks}</span>
                    <span class="stat-label">With Tasks</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.processed}</span>
                    <span class="stat-label">AI Processed</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.totalTags}</span>
                    <span class="stat-label">Tags</span>
                </div>
            </div>
        `;
    }

    renderTagsFilter() {
        const allTags = this.notesManager.getAllTags();
        const tagsContainer = document.getElementById('tagsFilter');
        
        if (!tagsContainer || allTags.length === 0) return;

        const tagsHtml = allTags.map(tag => {
            const isSelected = this.selectedTags.includes(tag);
            return `
                <button class="tag-filter-btn ${isSelected ? 'selected' : ''}" 
                        data-tag="${tag}" 
                        onclick="toggleTagFilter('${tag}')">
                    #${tag}
                </button>
            `;
        }).join('');

        tagsContainer.innerHTML = `
            <div class="tags-filter-container">
                <h4>Filter by Tags</h4>
                <div class="tags-filter-list">
                    ${tagsHtml}
                </div>
                ${this.selectedTags.length > 0 ? 
                    `<button class="clear-tags-btn" onclick="clearTagFilters()">Clear All</button>` : 
                    ''
                }
            </div>
        `;
    }

    renderSearchResults(query) {
        const results = this.notesManager.searchNotes(query);
        const container = document.getElementById('searchResults');
        
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="search-no-results">
                    <p>No notes found for "${query}"</p>
                </div>
            `;
            return;
        }

        const resultsHtml = results.map(note => this.renderSearchResultItem(note, query)).join('');
        container.innerHTML = `
            <div class="search-results-header">
                <h4>Search Results (${results.length})</h4>
                <button class="clear-search-btn" onclick="clearSearch()">Clear</button>
            </div>
            <div class="search-results-list">
                ${resultsHtml}
            </div>
        `;
    }

    renderSearchResultItem(note, query) {
        const highlightedTitle = this.highlightSearchTerm(note.title, query);
        const highlightedContent = this.highlightSearchTerm(
            this.truncateText(note.content, 100), 
            query
        );
        
        return `
            <div class="search-result-item" data-note-id="${note.id}" onclick="openNote('${note.id}')">
                <h5 class="search-result-title">${highlightedTitle}</h5>
                <p class="search-result-content">${highlightedContent}</p>
                <div class="search-result-meta">
                    <span class="search-result-date">${new Date(note.modifiedAt).toLocaleDateString()}</span>
                    ${note.tags.length > 0 ? 
                        `<span class="search-result-tags">${note.tags.map(tag => `#${tag}`).join(' ')}</span>` : 
                        ''
                    }
                </div>
            </div>
        `;
    }

    getFilteredNotes() {
        let notes = [...this.appState.notes];

        // Apply search filter
        if (this.searchQuery) {
            notes = this.notesManager.searchNotes(this.searchQuery);
        }

        // Apply tag filter
        if (this.selectedTags.length > 0) {
            notes = notes.filter(note => 
                this.selectedTags.some(tag => note.tags.includes(tag))
            );
        }

        // Apply sorting
        notes.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortBy) {
                case 'created':
                    aValue = new Date(a.createdAt);
                    bValue = new Date(b.createdAt);
                    break;
                case 'modified':
                    aValue = new Date(a.modifiedAt);
                    bValue = new Date(b.modifiedAt);
                    break;
                case 'title':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                default:
                    aValue = new Date(a.modifiedAt);
                    bValue = new Date(b.modifiedAt);
            }

            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return notes;
    }

    attachNoteEventListeners() {
        // Edit note buttons
        document.querySelectorAll('.edit-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-note-id');
                this.openEditModal(noteId);
            });
        });

        // View note buttons
        document.querySelectorAll('.view-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-note-id');
                this.openViewModal(noteId);
            });
        });

        // Delete note buttons
        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-note-id');
                this.confirmDeleteNote(noteId);
            });
        });

        // Note card click to view
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const noteId = card.getAttribute('data-note-id');
                this.openViewModal(noteId);
            });
        });
    }

    openEditModal(noteId) {
        if (window.openNotesModal) {
            window.openNotesModal('edit', noteId);
        } else {
            // Fallback - try to access the app instance directly
            if (window.taskFlowApp && window.taskFlowApp.notesModalManager) {
                window.taskFlowApp.notesModalManager.openModal('edit', noteId);
            }
        }
    }

    openViewModal(noteId) {
        if (window.openNotesModal) {
            window.openNotesModal('view', noteId);
        } else {
            // Fallback - try to access the app instance directly
            if (window.taskFlowApp && window.taskFlowApp.notesModalManager) {
                window.taskFlowApp.notesModalManager.openModal('view', noteId);
            }
        }
    }

    confirmDeleteNote(noteId) {
        const note = this.appState.getNote(noteId);
        if (!note) return;

        if (confirm(`Are you sure you want to delete "${note.title}"? This action cannot be undone.`)) {
            this.notesManager.deleteNote(noteId);
        }
    }

    // Utility methods
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    highlightSearchTerm(text, term) {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // Public API methods
    setSearchQuery(query) {
        this.searchQuery = query;
        this.renderNotesGrid();
    }

    toggleTagFilter(tag) {
        const index = this.selectedTags.indexOf(tag);
        if (index > -1) {
            this.selectedTags.splice(index, 1);
        } else {
            this.selectedTags.push(tag);
        }
        this.renderNotesGrid();
        this.renderTagsFilter();
    }

    clearTagFilters() {
        this.selectedTags = [];
        this.renderNotesGrid();
        this.renderTagsFilter();
    }

    setSortBy(sortBy, sortOrder = 'desc') {
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        this.renderNotesGrid();
    }

    setView(view) {
        this.currentView = view;
        this.renderNotesGrid();
    }

    refresh() {
        this.renderNotesGrid();
        this.renderNotesStats();
        this.renderTagsFilter();
    }

    highlightNote(noteId) {
        setTimeout(() => {
            const noteCard = document.querySelector(`[data-note-id="${noteId}"]`);
            if (noteCard) {
                noteCard.classList.add('note-highlight');
                noteCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                setTimeout(() => {
                    noteCard.classList.remove('note-highlight');
                }, 2000);
            }
        }, 100);
    }

    renderTasksIndicator(note) {
        if (!note.extractedTasks || note.extractedTasks.length === 0) {
            return '';
        }

        // Check the actual status of tasks from this note
        const taskStatuses = this.getTaskStatuses(note);
        const totalTasks = note.extractedTasks.length;
        const autoAddedCount = taskStatuses.autoAdded;
        const pendingCount = taskStatuses.pending;

        let icon, title, className;

        if (autoAddedCount > 0 && pendingCount === 0) {
            // All tasks were auto-added
            icon = '✅';
            title = `${totalTasks} task${totalTasks > 1 ? 's' : ''} automatically added`;
            className = 'note-tasks-indicator auto-added';
        } else if (autoAddedCount === 0 && pendingCount > 0) {
            // All tasks are pending
            icon = '⏳';
            title = `${totalTasks} task${totalTasks > 1 ? 's' : ''} pending approval`;
            className = 'note-tasks-indicator pending';
        } else if (autoAddedCount > 0 && pendingCount > 0) {
            // Mixed status
            icon = '🔄';
            title = `${autoAddedCount} added, ${pendingCount} pending approval`;
            className = 'note-tasks-indicator mixed';
        } else {
            // No tasks found in either list (shouldn't happen, but fallback)
            icon = '❓';
            title = `${totalTasks} task${totalTasks > 1 ? 's' : ''} found`;
            className = 'note-tasks-indicator unknown';
        }

        return `
            <div class="${className}" title="${title}">
                <span class="task-icon">${icon}</span>
                <span class="task-count">${totalTasks}</span>
            </div>
        `;
    }

    getTaskStatuses(note) {
        let autoAdded = 0;
        let pending = 0;

        // Check each extracted task to see its current status
        note.extractedTasks.forEach(extractedTask => {
            // Check if this task was added to the main task list
            const isInTaskList = this.appState.tasks.some(task => 
                task.sourceNoteId === note.id && 
                (task.name === extractedTask.title || task.description === extractedTask.description)
            );

            // Check if this task is in pending approval
            const isInPending = this.appState.pendingTasks.some(pendingTask => 
                pendingTask.sourceNoteId === note.id && 
                (pendingTask.title === extractedTask.title || pendingTask.description === extractedTask.description)
            );

            if (isInTaskList) {
                autoAdded++;
            } else if (isInPending) {
                pending++;
            }
            // Note: Some tasks might not be in either list if they were rejected or removed
        });

        return { autoAdded, pending };
    }
}
