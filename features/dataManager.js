// features/dataManager.js - Complete Data Export/Import with Obsidian Support

import { CONFIG, Logger } from '../core/config.js';
import { StorageManager } from '../core/storage.js';

export class DataManager {
    constructor(appState, notifications) {
        this.appState = appState;
        this.notifications = notifications;
        this.supportedFormats = ['json', 'markdown', 'obsidian', 'csv'];
    }

    // ====== EXPORT FUNCTIONS ======

    async exportAllData(format = 'json') {
        try {
            const data = this.gatherAllData();
            let exportedContent;
            let filename;
            let mimeType;

            switch (format) {
                case 'json':
                    exportedContent = this.exportToJSON(data);
                    filename = `taskflow-backup-${this.getDateString()}.json`;
                    mimeType = 'application/json';
                    break;
                case 'markdown':
                    exportedContent = this.exportToMarkdown(data);
                    filename = `taskflow-export-${this.getDateString()}.md`;
                    mimeType = 'text/markdown';
                    break;
                case 'obsidian':
                    exportedContent = this.exportToObsidian(data);
                    filename = `TaskFlow Export ${this.getDateString()}.md`;
                    mimeType = 'text/markdown';
                    break;
                case 'csv':
                    exportedContent = this.exportToCSV(data);
                    filename = `taskflow-export-${this.getDateString()}.csv`;
                    mimeType = 'text/csv';
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            this.downloadFile(exportedContent, filename, mimeType);
            
            // Don't show success notification here - let the UI handle it
            // this.notifications.showSuccess(`Data exported as ${format.toUpperCase()}!`);
            
            Logger.log(`Data exported as ${format}`, { 
                taskCount: data.tasks.length,
                filename 
            });

            return { success: true, filename, taskCount: data.tasks.length, noteCount: data.notes.length };

        } catch (error) {
            Logger.error('Export failed', error);
            throw error; // Re-throw so UI can handle it
        }
    }

    gatherAllData() {
        return {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                source: 'TaskFlow AI',
                taskCount: this.appState.tasks.length,
                noteCount: this.appState.notes.length,
                userName: this.appState.onboardingData.userName
            },
            tasks: this.appState.tasks,
            notes: this.appState.notes,
            configuration: {
                userName: this.appState.onboardingData.userName,
                nameVariations: this.appState.onboardingData.nameVariations,
                service: this.appState.onboardingData.service,
                model: this.appState.onboardingData.model
                // Note: We don't export API keys for security
            }
        };
    }

    exportToJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    exportToMarkdown(data) {
        const { tasks, notes, metadata } = data;
        
        let markdown = `# TaskFlow AI Export\n\n`;
        markdown += `**Exported:** ${new Date(metadata.exportedAt).toLocaleString()}\n`;
        markdown += `**Tasks:** ${metadata.taskCount}\n`;
        markdown += `**Notes:** ${metadata.noteCount}\n`;
        markdown += `**User:** ${metadata.userName}\n\n`;

        // Active Tasks
        const activeTasks = tasks.filter(t => !t.completed && !t.postponed);
        if (activeTasks.length > 0) {
            markdown += `## 🎯 Active Tasks (${activeTasks.length})\n\n`;
            activeTasks.forEach(task => {
                markdown += `### ${task.name}\n`;
                if (task.description) markdown += `${task.description}\n\n`;
                if (task.notes) markdown += `**Notes:** ${task.notes}\n\n`;
                markdown += `**Created:** ${new Date(task.createdAt).toLocaleDateString()}\n`;
                markdown += `**Type:** ${task.type === 'ai' ? '✨ AI-extracted' : '✓ Manual'}\n\n`;
                markdown += `---\n\n`;
            });
        }

        // Completed Tasks
        const completedTasks = tasks.filter(t => t.completed);
        if (completedTasks.length > 0) {
            markdown += `## ✅ Completed Tasks (${completedTasks.length})\n\n`;
            completedTasks.forEach(task => {
                markdown += `- [x] **${task.name}**`;
                if (task.completedAt) {
                    markdown += ` *(completed ${new Date(task.completedAt).toLocaleDateString()})*`;
                }
                markdown += `\n`;
                if (task.description) markdown += `  - ${task.description}\n`;
            });
            markdown += `\n`;
        }

        // Postponed Tasks
        const postponedTasks = tasks.filter(t => t.postponed && !t.completed);
        if (postponedTasks.length > 0) {
            markdown += `## ⏰ Postponed Tasks (${postponedTasks.length})\n\n`;
            postponedTasks.forEach(task => {
                markdown += `- [ ] **${task.name}** *(postponed)*\n`;
                if (task.description) markdown += `  - ${task.description}\n`;
            });
            markdown += `\n`;
        }

        // Notes Section
        if (notes && notes.length > 0) {
            markdown += `## 📝 Notes (${notes.length})\n\n`;
            notes.forEach(note => {
                markdown += `### ${note.title}\n`;
                markdown += `**Created:** ${new Date(note.createdAt).toLocaleDateString()}\n`;
                if (note.modifiedAt !== note.createdAt) {
                    markdown += `**Modified:** ${new Date(note.modifiedAt).toLocaleDateString()}\n`;
                }
                if (note.tags && note.tags.length > 0) {
                    markdown += `**Tags:** ${note.tags.map(tag => `#${tag}`).join(' ')}\n`;
                }
                markdown += `\n${note.content}\n\n`;
                if (note.summary) {
                    markdown += `**AI Summary:** ${note.summary}\n\n`;
                }
                if (note.extractedTasks && note.extractedTasks.length > 0) {
                    markdown += `**Extracted Tasks:** ${note.extractedTasks.length} tasks found\n\n`;
                }
                markdown += `---\n\n`;
            });
        }

        return markdown;
    }

    exportToObsidian(data) {
        const { tasks, notes, metadata } = data;
        
        let obsidian = `---\n`;
        obsidian += `title: TaskFlow AI Export\n`;
        obsidian += `created: ${metadata.exportedAt}\n`;
        obsidian += `tags: [taskflow, tasks, notes, productivity]\n`;
        obsidian += `task-count: ${metadata.taskCount}\n`;
        obsidian += `note-count: ${metadata.noteCount}\n`;
        obsidian += `user: ${metadata.userName}\n`;
        obsidian += `---\n\n`;

        obsidian += `# TaskFlow AI Export\n\n`;
        obsidian += `> **Exported:** ${new Date(metadata.exportedAt).toLocaleString()}\n`;
        obsidian += `> **Total Tasks:** ${metadata.taskCount}\n`;
        obsidian += `> **Total Notes:** ${metadata.noteCount}\n\n`;

        // Active Tasks with Obsidian task format
        const activeTasks = tasks.filter(t => !t.completed && !t.postponed);
        if (activeTasks.length > 0) {
            obsidian += `## 🎯 Active Tasks\n\n`;
            activeTasks.forEach(task => {
                obsidian += `- [ ] ${task.name}`;
                
                // Add Obsidian tags
                const tags = [];
                if (task.type === 'ai') tags.push('#ai-extracted');
                if (task.type === 'quick') tags.push('#manual');
                
                // Add creation date in Obsidian format
                const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
                tags.push(`#created/${createdDate}`);
                
                if (tags.length > 0) {
                    obsidian += ` ${tags.join(' ')}`;
                }
                
                obsidian += `\n`;
                
                if (task.description || task.notes) {
                    if (task.description) obsidian += `  - **Description:** ${task.description}\n`;
                    if (task.notes) obsidian += `  - **Notes:** ${task.notes}\n`;
                }
                obsidian += `\n`;
            });
        }

        // Completed Tasks
        const completedTasks = tasks.filter(t => t.completed);
        if (completedTasks.length > 0) {
            obsidian += `## ✅ Completed Tasks\n\n`;
            completedTasks.forEach(task => {
                obsidian += `- [x] ${task.name}`;
                
                if (task.completedAt) {
                    const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
                    obsidian += ` #completed/${completedDate}`;
                }
                
                obsidian += `\n`;
                if (task.description) obsidian += `  - ${task.description}\n`;
            });
            obsidian += `\n`;
        }

        // Postponed Tasks
        const postponedTasks = tasks.filter(t => t.postponed && !t.completed);
        if (postponedTasks.length > 0) {
            obsidian += `## ⏰ Postponed Tasks\n\n`;
            postponedTasks.forEach(task => {
                obsidian += `- [ ] ${task.name} #postponed\n`;
                if (task.description) obsidian += `  - ${task.description}\n`;
            });
        }

        // Notes Section
        if (notes && notes.length > 0) {
            obsidian += `\n## 📝 Notes\n\n`;
            notes.forEach(note => {
                obsidian += `### [[${note.title}]]\n`;
                obsidian += `**Created:** ${new Date(note.createdAt).toISOString().split('T')[0]}\n`;
                if (note.modifiedAt !== note.createdAt) {
                    obsidian += `**Modified:** ${new Date(note.modifiedAt).toISOString().split('T')[0]}\n`;
                }
                if (note.tags && note.tags.length > 0) {
                    obsidian += `**Tags:** ${note.tags.map(tag => `#${tag}`).join(' ')}\n`;
                }
                obsidian += `\n${note.content}\n\n`;
                if (note.summary) {
                    obsidian += `> [!ai] AI Summary\n> ${note.summary.split('\n').join('\n> ')}\n\n`;
                }
                if (note.extractedTasks && note.extractedTasks.length > 0) {
                    obsidian += `> [!info] Extracted Tasks\n> ${note.extractedTasks.length} tasks found and extracted from this note\n\n`;
                }
                obsidian += `---\n\n`;
            });
        }

        // Add backlinks section for Obsidian
        obsidian += `\n---\n\n`;
        obsidian += `## Related\n`;
        obsidian += `- [[Daily Notes]]\n`;
        obsidian += `- [[Project Management]]\n`;
        obsidian += `- [[Productivity]]\n`;

        return obsidian;
    }

    exportToCSV(data) {
        const { tasks, notes } = data;
        
        // Create two CSV sections - one for tasks and one for notes
        let csv = '=== TASKS ===\n';
        
        // Tasks section
        const taskHeaders = [
            'Name', 'Description', 'Notes', 'Status', 'Type', 
            'Created', 'Completed', 'Postponed', 'Modified'
        ];
        
        csv += taskHeaders.join(',') + '\n';
        
        tasks.forEach(task => {
            const row = [
                this.escapeCsvField(task.name),
                this.escapeCsvField(task.description || ''),
                this.escapeCsvField(task.notes || ''),
                task.completed ? 'Completed' : task.postponed ? 'Postponed' : 'Active',
                task.type === 'ai' ? 'AI-extracted' : 'Manual',
                this.formatDateForCSV(task.createdAt),
                this.formatDateForCSV(task.completedAt),
                this.formatDateForCSV(task.postponedAt),
                this.formatDateForCSV(task.modifiedAt)
            ];
            csv += row.join(',') + '\n';
        });
        
        // Notes section
        if (notes && notes.length > 0) {
            csv += '\n\n=== NOTES ===\n';
            
            const noteHeaders = [
                'Title', 'Content', 'Tags', 'Summary', 'AI Processed', 
                'Extracted Tasks Count', 'Created', 'Modified'
            ];
            
            csv += noteHeaders.join(',') + '\n';
            
            notes.forEach(note => {
                const row = [
                    this.escapeCsvField(note.title),
                    this.escapeCsvField(note.content),
                    this.escapeCsvField(note.tags ? note.tags.join('; ') : ''),
                    this.escapeCsvField(note.summary || ''),
                    note.aiProcessed ? 'Yes' : 'No',
                    note.extractedTasks ? note.extractedTasks.length : 0,
                    this.formatDateForCSV(note.createdAt),
                    this.formatDateForCSV(note.modifiedAt)
                ];
                csv += row.join(',') + '\n';
            });
        }
        
        return csv;
    }

    // ====== IMPORT FUNCTIONS ======

    async importData(file) {
        try {
            const content = await this.readFile(file);
            const extension = this.getFileExtension(file.name);
            
            let importedData;
            
            switch (extension) {
                case 'json':
                    importedData = this.importFromJSON(content);
                    break;
                case 'md':
                    importedData = this.importFromMarkdown(content);
                    break;
                case 'csv':
                    importedData = this.importFromCSV(content);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${extension}`);
            }

            const result = await this.processImportedData(importedData);
            
            // Build success message
            let successMessage = '';
            if (result.importedTasks > 0) {
                successMessage += `Imported ${result.importedTasks} tasks`;
                if (result.skippedTasks > 0) {
                    successMessage += ` (${result.skippedTasks} duplicates skipped)`;
                }
            }
            
            if (result.importedNotes > 0) {
                if (successMessage) successMessage += ' and ';
                successMessage += `${result.importedNotes} notes`;
                if (result.skippedNotes > 0) {
                    successMessage += ` (${result.skippedNotes} duplicates skipped)`;
                }
            }
            
            if (!successMessage) {
                successMessage = 'No new items to import (all were duplicates)';
            } else {
                successMessage += '!';
            }
            
            this.notifications.showSuccess(successMessage);
            
            Logger.log('Data imported successfully', result);
            
            return result;

        } catch (error) {
            Logger.error('Import failed', error);
            this.notifications.showError(`Import failed: ${error.message}`);
            throw error;
        }
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    importFromJSON(content) {
        const data = JSON.parse(content);
        
        // Validate JSON structure
        if (!data.tasks || !Array.isArray(data.tasks)) {
            throw new Error('Invalid JSON format: missing tasks array');
        }
        
        return {
            tasks: data.tasks,
            notes: data.notes || [],
            configuration: data.configuration,
            metadata: data.metadata
        };
    }

    importFromMarkdown(content) {
        const tasks = [];
        const lines = content.split('\n');
        
        let currentTask = null;
        let inTaskSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for task items (both [ ] and [x])
            const taskMatch = line.match(/^-\s*\[([ x])\]\s*(.+)$/);
            if (taskMatch) {
                if (currentTask) {
                    tasks.push(currentTask);
                }
                
                const isCompleted = taskMatch[1] === 'x';
                let taskName = taskMatch[2];
                
                // Remove Obsidian tags from task name
                taskName = taskName.replace(/#\S+/g, '').trim();
                // Remove markdown formatting
                taskName = taskName.replace(/\*\*(.*?)\*\*/g, '$1');
                
                currentTask = {
                    id: this.generateTaskId(),
                    name: taskName,
                    description: '',
                    notes: '',
                    completed: isCompleted,
                    postponed: line.includes('#postponed'),
                    type: line.includes('#ai-extracted') ? 'ai' : 'quick',
                    createdAt: new Date().toISOString(),
                    date: new Date().toISOString().split('T')[0]
                };
                
                if (isCompleted) {
                    currentTask.completedAt = new Date().toISOString();
                }
                
                continue;
            }
            
            // Check for task details (indented lines)
            if (currentTask && line.startsWith('  ')) {
                const detail = line.substring(2).trim();
                if (detail.startsWith('**Description:**')) {
                    currentTask.description = detail.replace('**Description:**', '').trim();
                } else if (detail.startsWith('**Notes:**')) {
                    currentTask.notes = detail.replace('**Notes:**', '').trim();
                } else if (detail.startsWith('- ')) {
                    currentTask.description = detail.substring(2);
                }
            }
            
            // Check for headers (tasks sections)
            if (line.startsWith('##')) {
                inTaskSection = line.toLowerCase().includes('task');
            }
        }
        
        // Add the last task
        if (currentTask) {
            tasks.push(currentTask);
        }
        
        return { tasks };
    }

    importFromCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const tasks = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            if (values.length < headers.length) continue;
            
            const task = {
                id: this.generateTaskId(),
                name: values[0],
                description: values[1] || '',
                notes: values[2] || '',
                completed: values[3] === 'Completed',
                postponed: values[3] === 'Postponed',
                type: values[4] === 'AI-extracted' ? 'ai' : 'quick',
                createdAt: values[5] || new Date().toISOString(),
                date: new Date().toISOString().split('T')[0]
            };
            
            if (task.completed && values[6]) {
                task.completedAt = values[6];
            }
            
            if (task.postponed && values[7]) {
                task.postponedAt = values[7];
            }
            
            tasks.push(task);
        }
        
        return { tasks };
    }

    async processImportedData(importedData) {
        const existingTasks = this.appState.tasks;
        const existingTaskNames = new Set(existingTasks.map(t => t.name.toLowerCase()));
        
        const existingNotes = this.appState.notes;
        const existingNoteTitles = new Set(existingNotes.map(n => n.title.toLowerCase()));
        
        let importedTasks = 0;
        let skippedTasks = 0;
        let importedNotes = 0;
        let skippedNotes = 0;
        
        // Process tasks
        for (const task of importedData.tasks) {
            // Skip duplicates based on task name
            if (existingTaskNames.has(task.name.toLowerCase())) {
                skippedTasks++;
                continue;
            }
            
            // Validate and clean task data
            const cleanTask = this.validateAndCleanTask(task);
            
            this.appState.addTask(cleanTask);
            importedTasks++;
        }
        
        // Process notes if they exist
        if (importedData.notes && importedData.notes.length > 0) {
            for (const note of importedData.notes) {
                // Skip duplicates based on note title
                if (existingNoteTitles.has(note.title.toLowerCase())) {
                    skippedNotes++;
                    continue;
                }
                
                // Validate and clean note data
                const cleanNote = this.validateAndCleanNote(note);
                
                this.appState.addNote(cleanNote);
                importedNotes++;
            }
        }
        
        return { 
            importedTasks, 
            skippedTasks, 
            totalTasks: importedData.tasks.length,
            importedNotes,
            skippedNotes,
            totalNotes: importedData.notes ? importedData.notes.length : 0,
            // Legacy properties for backward compatibility
            imported: importedTasks,
            skipped: skippedTasks,
            total: importedData.tasks.length
        };
    }

    validateAndCleanTask(task) {
        return {
            id: task.id || this.generateTaskId(),
            name: task.name || 'Imported Task',
            description: task.description || '',
            notes: task.notes || '',
            completed: Boolean(task.completed),
            postponed: Boolean(task.postponed),
            type: ['ai', 'quick'].includes(task.type) ? task.type : 'quick',
            createdAt: task.createdAt || new Date().toISOString(),
            date: task.date || new Date().toISOString().split('T')[0],
            completedAt: task.completedAt,
            postponedAt: task.postponedAt,
            modifiedAt: task.modifiedAt
        };
    }

    validateAndCleanNote(note) {
        return {
            id: note.id || this.generateNoteId(),
            title: note.title || 'Imported Note',
            content: note.content || '',
            tags: Array.isArray(note.tags) ? note.tags : [],
            summary: note.summary || '',
            aiProcessed: Boolean(note.aiProcessed),
            extractedTasks: Array.isArray(note.extractedTasks) ? note.extractedTasks : [],
            createdAt: note.createdAt || new Date().toISOString(),
            modifiedAt: note.modifiedAt || note.createdAt || new Date().toISOString()
        };
    }

    generateNoteId() {
        return 'note-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // ====== UTILITY FUNCTIONS ======

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    generateTaskId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    escapeCsvField(field) {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }

    formatDateForCSV(dateString) {
        return dateString ? new Date(dateString).toLocaleString() : '';
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    // ====== OBSIDIAN SPECIFIC HELPERS ======

    createObsidianVault() {
        // Create a complete Obsidian vault structure
        const vaultData = {
            'TaskFlow Tasks.md': this.exportToObsidian(this.gatherAllData()),
            '.obsidian/workspace.json': JSON.stringify({
                "main": {
                    "id": "main-workspace",
                    "type": "split",
                    "children": [{
                        "id": "taskflow-tab",
                        "type": "leaf",
                        "state": {
                            "type": "markdown",
                            "state": {
                                "file": "TaskFlow Tasks.md",
                                "mode": "source"
                            }
                        }
                    }]
                }
            }, null, 2),
            '.obsidian/plugins/taskflow/manifest.json': JSON.stringify({
                "id": "taskflow-import",
                "name": "TaskFlow Import",
                "version": "1.0.0",
                "description": "Imported from TaskFlow AI"
            }, null, 2)
        };
        
        return vaultData;
    }
}
