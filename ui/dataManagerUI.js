// ui/dataManagerUI.js - Cleaned UI Integration for Data Import/Export

export class DataManagerUI {
    constructor(dataManager, modalManager, notifications) {
        this.dataManager = dataManager;
        this.modalManager = modalManager;
        this.notifications = notifications;
        this.pendingImportFile = null;
        
        this.setupGlobalFunctions();
    }

    setupGlobalFunctions() {
        // Export functions
        window.exportData = (format) => this.exportData(format);
        
        // Import functions
        window.handleImportFile = (input) => this.handleImportFile(input);
        window.confirmImport = () => this.confirmImport();
        window.cancelImport = () => this.cancelImport();
        
        // Additional export options
        window.exportTasksOnly = () => this.exportTasksOnly();
        window.exportObsidianVault = () => this.exportObsidianVault();
    }

    async exportData(format) {
        const button = event.target;
        const originalText = button.textContent;
        
        try {
            button.innerHTML = '<span class="loading"></span> Exporting...';
            button.disabled = true;

            const result = await this.dataManager.exportAllData(format);
            
            // Show success message
            const itemsText = result.noteCount > 0 
                ? `${result.taskCount} tasks, ${result.noteCount} notes`
                : `${result.taskCount} tasks`;
            this.notifications.showSuccess(
                `${format.toUpperCase()} exported successfully! (${itemsText})`
            );

        } catch (error) {
            this.notifications.showError(`Export failed: ${error.message}`);
        } finally {
            // Reset button
            setTimeout(() => {
                if (button) {
                    button.textContent = originalText;
                    button.disabled = false;
                }
            }, 500);
        }
    }

    async handleImportFile(input) {
        const file = input.files[0];
        if (!file) return;

        try {
            // Show preview
            await this.showImportPreview(file);
            
        } catch (error) {
            this.notifications.showError(`Failed to read file: ${error.message}`);
            input.value = ''; // Clear file input
        }
    }

    async showImportPreview(file) {
        const preview = document.getElementById('importPreview');
        const details = document.getElementById('importDetails');
        
        if (!preview || !details) {
            throw new Error('Import preview elements not found in DOM');
        }
        
        try {
            // Clear any existing preview first
            details.innerHTML = '<div class="loading">Analyzing file...</div>';
            preview.style.display = 'block';
            
            // Read file content for preview
            const content = await this.dataManager.readFile(file);
            const extension = this.dataManager.getFileExtension(file.name);
            
            let previewData;
            
            switch (extension) {
                case 'json':
                    previewData = this.previewJSON(content);
                    break;
                case 'md':
                    previewData = this.previewMarkdown(content);
                    break;
                case 'csv':
                    previewData = this.previewCSV(content);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${extension}`);
            }

            // Update preview with actual data
            details.innerHTML = this.generateCleanPreviewHTML(previewData, file.name);
            
            // Store file for later import
            this.pendingImportFile = file;
            
            
        } catch (error) {
            // Hide preview on error
            preview.style.display = 'none';
            throw new Error(`Preview failed: ${error.message}`);
        }
    }

    previewJSON(content) {
        const data = JSON.parse(content);
        return {
            type: 'JSON Backup',
            taskCount: data.tasks?.length || 0,
            hasConfiguration: !!data.configuration,
            exportDate: data.metadata?.exportedAt,
            userName: data.metadata?.userName || data.configuration?.userName,
            fileSize: this.formatFileSize(JSON.stringify(data).length)
        };
    }

    previewMarkdown(content) {
        const lines = content.split('\n');
        const taskLines = lines.filter(line => 
            line.trim().match(/^-\s*\[([ x])\]/)
        );
        
        const activeTasks = taskLines.filter(line => line.includes('[ ]')).length;
        const completedTasks = taskLines.filter(line => line.includes('[x]')).length;
        const isObsidian = content.includes('---') && content.includes('tags:');
        
        return {
            type: isObsidian ? 'Obsidian Markdown' : 'Markdown',
            taskCount: taskLines.length,
            activeTasks,
            completedTasks,
            isObsidian,
            fileSize: this.formatFileSize(content.length)
        };
    }

    previewCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',') || [];
        
        return {
            type: 'CSV Spreadsheet',
            taskCount: Math.max(0, lines.length - 1), // Subtract header
            columns: headers.length,
            hasHeaders: headers.some(h => 
                h.toLowerCase().includes('name') || 
                h.toLowerCase().includes('task')
            ),
            fileSize: this.formatFileSize(content.length)
        };
    }

    generateCleanPreviewHTML(previewData, filename) {
        const warnings = this.generateWarnings(previewData);
        
        return `
            <div class="import-file-info">
                <div class="info-item">
                    <div class="info-label">File Name</div>
                    <div class="info-value" style="font-size: 0.9rem; word-break: break-word;">${filename}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">File Type</div>
                    <div class="info-value">${previewData.type}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Tasks Found</div>
                    <div class="info-value">${previewData.taskCount}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">File Size</div>
                    <div class="info-value">${previewData.fileSize}</div>
                </div>
                
                ${previewData.activeTasks !== undefined ? `
                    <div class="info-item">
                        <div class="info-label">Active Tasks</div>
                        <div class="info-value">${previewData.activeTasks}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Completed Tasks</div>
                        <div class="info-value">${previewData.completedTasks}</div>
                    </div>
                ` : ''}
                
                ${previewData.userName ? `
                    <div class="info-item">
                        <div class="info-label">Original User</div>
                        <div class="info-value" style="font-size: 0.9rem;">${previewData.userName}</div>
                    </div>
                ` : ''}
                
                ${previewData.exportDate ? `
                    <div class="info-item">
                        <div class="info-label">Export Date</div>
                        <div class="info-value" style="font-size: 0.8rem;">${new Date(previewData.exportDate).toLocaleDateString()}</div>
                    </div>
                ` : ''}
            </div>
            
            ${warnings.length > 0 ? `
                <div class="import-warnings">
                    <h5>Import Information</h5>
                    <ul class="warning-list">
                        ${warnings.map(warning => `<li>${warning}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    generateWarnings(previewData) {
        const warnings = [];
        
        if (previewData.taskCount === 0) {
            warnings.push('No tasks found in this file');
        }
        
        if (previewData.hasConfiguration) {
            warnings.push('This backup includes configuration settings');
        }
        
        if (previewData.isObsidian) {
            warnings.push('Obsidian format detected with tags and metadata');
        }
        
        if (previewData.type === 'CSV Spreadsheet' && !previewData.hasHeaders) {
            warnings.push('CSV file may not have proper headers');
        }
        
        warnings.push('Duplicate tasks (same name) will be automatically skipped');
        
        if (previewData.taskCount > 50) {
            warnings.push('Large import - this may take a moment to process');
        }
        
        return warnings;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async confirmImport() {
        if (!this.pendingImportFile) {
            this.notifications.showError('No file selected for import');
            return;
        }

        const confirmBtn = event.target;
        const originalText = confirmBtn.textContent;
        
        try {
            confirmBtn.innerHTML = '<span class="loading"></span> Importing...';
            confirmBtn.disabled = true;

            const result = await this.dataManager.importData(this.pendingImportFile);
            
            // Hide preview first
            this.cancelImport();
            
            // Show success with details
            this.notifications.showSuccess(
                `Import complete! Added ${result.imported} new tasks. ${result.skipped} duplicates skipped.`
            );

        } catch (error) {
            this.notifications.showError(`Import failed: ${error.message}`);
        } finally {
            // Reset button
            if (confirmBtn) {
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        }
    }

    cancelImport() {
        try {
            const preview = document.getElementById('importPreview');
            const fileInput = document.getElementById('importFile');
            
            if (preview) {
                preview.style.display = 'none';
                // Clear the preview content to prevent UI issues
                const details = document.getElementById('importDetails');
                if (details) {
                    details.innerHTML = '';
                }
            }
            if (fileInput) {
                fileInput.value = '';
            }
            
            this.pendingImportFile = null;
            
        } catch (error) {
            // Error cancelling import
        }
    }

    // Additional export methods
    async exportTasksOnly() {
        try {
            const tasks = this.dataManager.appState.tasks;
            const simplifiedData = {
                tasks: tasks.map(task => ({
                    name: task.name,
                    description: task.description,
                    notes: task.notes,
                    completed: task.completed,
                    postponed: task.postponed,
                    created: task.createdAt
                }))
            };
            
            const content = JSON.stringify(simplifiedData, null, 2);
            const filename = `taskflow-tasks-only-${this.dataManager.getDateString()}.json`;
            
            this.dataManager.downloadFile(content, filename, 'application/json');
            this.notifications.showSuccess('Tasks exported (simplified format)!');
            
        } catch (error) {
            this.notifications.showError(`Export failed: ${error.message}`);
        }
    }

    async exportObsidianVault() {
        try {
            // Create a complete Obsidian vault structure
            const vaultData = this.dataManager.createObsidianVault();
            
            // For now, just export the main file
            // In a full implementation, you'd create a ZIP file with JSZip
            this.dataManager.downloadFile(
                vaultData['TaskFlow Tasks.md'],
                'TaskFlow-Obsidian-Tasks.md',
                'text/markdown'
            );
            
            this.notifications.showSuccess('Obsidian tasks exported! Import this file into your vault.');
            
        } catch (error) {
            this.notifications.showError(`Vault export failed: ${error.message}`);
        }
    }
}

// Simplified Modal Manager integration - NO CONTENT INJECTION
export function enhanceModalManagerWithDataManagement(modalManager, dataManager) {
    // Store reference to data manager for use in data tab
    modalManager.dataManager = dataManager;
    
    // The data tab content is now generated directly in the modal manager
    // We DO NOT modify populateSettingsModal anymore to prevent duplicates
    
}
