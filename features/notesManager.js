// features/notesManager.js - Notes Management System

import { Logger } from '../core/config.js';
import { StorageManager } from '../core/storage.js';

export class NotesManager {
    constructor(appState, aiService, taskExtractionManager, notifications) {
        this.appState = appState;
        this.aiService = aiService;
        this.taskExtractionManager = taskExtractionManager;
        this.notifications = notifications;
        
        // Initialize notes in app state if not exists
        if (!this.appState.notes) {
            this.appState.notes = [];
        }
    }

    async createNote(noteData) {
        try {
            const note = {
                id: this.generateNoteId(),
                title: noteData.title?.trim() || this.generateTitleFromContent(noteData.content),
                content: noteData.content?.trim() || '',
                tags: noteData.tags || [],
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                summary: '',
                extractedTasks: [],
                aiProcessed: false
            };

            // Add note to state
            this.appState.addNote(note);
            
            // Process with AI in background
            this.processNoteWithAI(note.id);
            
            Logger.log(`Note created: ${note.id} - "${note.title}"`);
            return note;
            
        } catch (error) {
            Logger.error('Failed to create note', error);
            throw new Error('Failed to create note. Please try again.');
        }
    }

    async updateNote(noteId, updates) {
        try {
            const note = this.appState.getNote(noteId);
            if (!note) {
                throw new Error('Note not found');
            }

            const updatedNote = {
                ...note,
                ...updates,
                modifiedAt: new Date().toISOString(),
                aiProcessed: false // Mark for reprocessing if content changed
            };

            this.appState.updateNote(noteId, updatedNote);
            
            // Reprocess with AI if content changed
            if (updates.content && updates.content !== note.content) {
                this.processNoteWithAI(noteId);
            }
            
            Logger.log(`Note updated: ${noteId} - changes: ${Object.keys(updates).join(', ')}`);
            return updatedNote;
            
        } catch (error) {
            Logger.error('Failed to update note', error);
            throw error;
        }
    }

    async deleteNote(noteId) {
        try {
            this.appState.deleteNote(noteId);
            Logger.log(`Note deleted: ${noteId}`);
        } catch (error) {
            Logger.error('Failed to delete note', error);
            throw new Error('Failed to delete note. Please try again.');
        }
    }

    async processNoteWithAI(noteId) {
        try {
            const note = this.appState.getNote(noteId);
            if (!note || !note.content.trim()) {
                return;
            }

            Logger.log(`Processing note with AI: ${noteId}`);

            // Generate title, summary and extract tasks in parallel
            const [aiTitle, summary, taskAnalysis] = await Promise.all([
                this.generateAITitle(note),
                this.generateNoteSummary(note),
                this.analyzeNoteForTasks(note)
            ]);

            // Update note with AI results
            const updates = {
                summary: summary,
                extractedTasks: taskAnalysis.tasks,
                aiProcessed: true,
                aiProcessedAt: new Date().toISOString()
            };

            // Only update title if AI generated a better one and current title looks auto-generated
            if (aiTitle && this.shouldUpdateTitle(note.title, note.content)) {
                updates.title = aiTitle;
            }

            this.appState.updateNote(noteId, updates);

            // Auto-add high-confidence tasks
            if (taskAnalysis.autoAddTasks.length > 0) {
                await this.autoAddTasksFromNote(noteId, taskAnalysis.autoAddTasks);
            }

            Logger.log(`Note AI processing completed: ${noteId} - title updated: ${!!updates.title}, summary: ${summary.length} chars, tasks: ${taskAnalysis.tasks.length}, auto-added: ${taskAnalysis.autoAddTasks.length}`);

        } catch (error) {
            Logger.error('AI processing failed for note', error);
            // Don't throw - this is background processing
        }
    }

    async generateAITitle(note) {
        try {
            const prompt = `Generate a concise, descriptive title for this note content. The title should be 3-8 words and capture the main topic or action.

Content: ${note.content}

Requirements:
- Be specific and descriptive
- Use action words when appropriate (e.g., "Review", "Plan", "Meeting with")
- Avoid generic words like "Note", "Thoughts", "Ideas"
- Focus on the key subject or outcome
- Keep it under 60 characters

Return only the title, nothing else. Do not use quotes or formatting.`;

            Logger.log('Generating AI title for note with content length:', note.content.length);

            const response = await this.aiService.makeRequest(prompt, {
                maxTokens: 50,
                temperature: 0.3,
                rawResponse: true
            });

            Logger.log('AI title response:', response);

            const title = response.trim();
            
            // Validate the title is reasonable
            if (title && title.length > 3 && title.length < 100 && !title.includes('\n')) {
                Logger.log('AI generated valid title:', title);
                return title;
            }
            
            Logger.warn('AI title validation failed:', { title, length: title?.length });
            return null; // Return null if title doesn't meet criteria
        } catch (error) {
            Logger.error('Failed to generate AI title', error);
            return null;
        }
    }

    shouldUpdateTitle(currentTitle, content) {
        // Check if current title looks auto-generated (basic heuristics)
        const autoGeneratedPatterns = [
            /^.{47}\.\.\.$/,  // Ends with ... (truncated)
            /^Untitled Note$/,
            /^\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+/,  // Very long first line
            content.trim().split('\n')[0] === currentTitle,  // Exact match with first line
            content.trim().split('.')[0] === currentTitle    // Exact match with first sentence
        ];
        
        return autoGeneratedPatterns.some(pattern => 
            typeof pattern === 'object' ? pattern.test(currentTitle) : pattern
        );
    }

    async generateNoteSummary(note) {
        try {
            const prompt = `Summarize this note in 1-2 sentences. Focus on key points, actions, and outcomes.

Content: ${note.content}

Be extremely concise and specific. Avoid generic phrases.`;

            const response = await this.aiService.makeRequest(prompt, {
                maxTokens: 100,
                temperature: 0.2,
                rawResponse: true  // Tell AI service to return plain text, not JSON
            });

            return response.trim();
        } catch (error) {
            Logger.error('Failed to generate note summary', error);
            return 'Summary generation failed';
        }
    }

    async analyzeNoteForTasks(note) {
        try {
            const userName = this.appState.onboardingData.userName;
            const variations = this.appState.onboardingData.nameVariations || [userName];
            
            let nameContext = '';
            if (variations.length > 1) {
                nameContext = `Note: ${userName} may also be referred to as: ${variations.slice(1).join(', ')}.`;
            }

            const prompt = `Analyze this note for potential tasks assigned to ${userName}.
${nameContext}

Title: ${note.title}
Content: ${note.content}

You must return ONLY a valid JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "confidence": 0.8,
      "context": "Where this task was mentioned in the note",
      "autoAdd": true
    }
  ]
}

IMPORTANT: 
- If NO tasks are found, return exactly: {"tasks": []}
- Do not include any text before or after the JSON
- Ensure the JSON is valid and properly formatted

Guidelines:
- Only extract tasks clearly assigned to ${userName}
- Set confidence 0.0-1.0 based on how clear the task assignment is
- Set autoAdd to true only for confidence > 0.7 and clear action items
- Include context showing where in the note this task was found
- Look for action words: "need to", "should", "must", "todo", "remind", etc.`;

            Logger.log('Analyzing note for tasks with prompt length:', prompt.length);

            const response = await this.aiService.makeRequest(prompt, {
                maxTokens: 500,
                temperature: 0.2,
                rawResponse: false  // Ensure we get JSON response for task extraction
            });

            Logger.log('Task extraction response type:', typeof response);
            Logger.log('Task extraction response:', response);

            // Handle the response based on what we received
            let taskData;
            if (typeof response === 'string') {
                // If it's a string, try to parse it
                try {
                    taskData = JSON.parse(response);
                } catch (parseError) {
                    Logger.warn('Failed to parse task response as JSON, assuming no tasks found:', response);
                    return { tasks: [], autoAddTasks: [] };
                }
            } else if (response && typeof response === 'object') {
                // If it's already an object, use it directly
                taskData = response;
            } else {
                Logger.warn('Unexpected response type, assuming no tasks found:', typeof response);
                return { tasks: [], autoAddTasks: [] };
            }

            const tasks = taskData.tasks || [];
            
            // Separate auto-add tasks from suggestions
            const autoAddTasks = tasks.filter(task => task.autoAdd && task.confidence > 0.7);
            
            Logger.log(`Found ${tasks.length} tasks, ${autoAddTasks.length} will be auto-added`);
            
            return {
                tasks: tasks,
                autoAddTasks: autoAddTasks
            };

        } catch (error) {
            Logger.error('Failed to analyze note for tasks', error);
            return { tasks: [], autoAddTasks: [] };
        }
    }

    async autoAddTasksFromNote(noteId, tasks) {
        try {
            const note = this.appState.getNote(noteId);
            const addedTasks = [];

            for (const taskData of tasks) {
                const task = {
                    id: this.appState.generateTaskId(),
                    name: taskData.title,
                    description: taskData.description,
                    notes: `Auto-extracted from note: "${note.title}"\nContext: ${taskData.context}`,
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    type: 'note-extracted',
                    completed: false,
                    postponed: false,
                    sourceNoteId: noteId,
                    extractionConfidence: taskData.confidence
                };

                this.appState.addTask(task);
                addedTasks.push(task);
            }

            if (addedTasks.length > 0) {
                const message = addedTasks.length === 1 
                    ? `Auto-added 1 task from note "${note.title}"`
                    : `Auto-added ${addedTasks.length} tasks from note "${note.title}"`;
                
                this.notifications.showSuccess(message);
                Logger.log(`Auto-added ${addedTasks.length} tasks from note: ${noteId}`);
            }

            return addedTasks;
        } catch (error) {
            Logger.error('Failed to auto-add tasks from note', error);
            return [];
        }
    }

    async generateWeeklySummary() {
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const recentNotes = this.appState.notes.filter(note => 
                new Date(note.createdAt) >= weekAgo
            );

            if (recentNotes.length === 0) {
                return 'No notes from the past week to summarize.';
            }

            const notesContent = recentNotes.map(note => 
                `${note.title}: ${note.summary || note.content.substring(0, 200)}`
            ).join('\n\n');

            const prompt = `Weekly summary of these notes:

${notesContent}

Key themes, progress, and outstanding items. Be concise.`;

            const summary = await this.aiService.makeRequest(prompt, {
                maxTokens: 300,
                temperature: 0.3,
                rawResponse: true  // Tell AI service to return plain text, not JSON
            });

            return summary;
        } catch (error) {
            Logger.error('Failed to generate weekly summary', error);
            throw new Error('Failed to generate weekly summary');
        }
    }

    async generateDailySummary(date = null) {
        try {
            const targetDate = date ? new Date(date) : new Date();
            const dateStr = targetDate.toISOString().split('T')[0];
            
            Logger.log('Generating daily summary for date:', dateStr);
            
            const dayNotes = this.appState.notes.filter(note => 
                note.createdAt.startsWith(dateStr)
            );

            Logger.log(`Found ${dayNotes.length} notes for ${dateStr}`);

            if (dayNotes.length === 0) {
                // Check if there are any notes at all
                const totalNotes = this.appState.notes.length;
                if (totalNotes === 0) {
                    return `No notes have been created yet. Start by creating your first note!`;
                }
                
                // Show available dates with notes
                const noteDates = [...new Set(this.appState.notes.map(note => 
                    note.createdAt.split('T')[0]
                ))].sort().reverse().slice(0, 5);
                
                return `No notes found for ${dateStr}. You have notes from these recent dates: ${noteDates.join(', ')}`;
            }

            const notesContent = dayNotes.map(note => 
                `${note.title}: ${note.summary || note.content.substring(0, 150)}`
            ).join('\n\n');

            Logger.log('Notes content being sent to AI:', notesContent);

            const prompt = `Daily summary for ${dateStr}:

${notesContent}

Main activities, decisions, and tasks. Be direct and concise.`;

            const summary = await this.aiService.makeRequest(prompt, {
                maxTokens: 200,
                temperature: 0.2,
                rawResponse: true  // Tell AI service to return plain text, not JSON
            });

            return summary;
        } catch (error) {
            Logger.error('Failed to generate daily summary', error);
            throw new Error('Failed to generate daily summary');
        }
    }

    searchNotes(query, options = {}) {
        const { 
            includeContent = true, 
            includeTags = true, 
            caseSensitive = false,
            limit = 50 
        } = options;

        const searchTerm = caseSensitive ? query : query.toLowerCase();
        
        const results = this.appState.notes.filter(note => {
            const title = caseSensitive ? note.title : note.title.toLowerCase();
            const content = caseSensitive ? note.content : note.content.toLowerCase();
            const tags = note.tags.map(tag => caseSensitive ? tag : tag.toLowerCase());
            
            return title.includes(searchTerm) ||
                   (includeContent && content.includes(searchTerm)) ||
                   (includeTags && tags.some(tag => tag.includes(searchTerm)));
        });

        return results.slice(0, limit);
    }

    getNotesWithTags(tags) {
        return this.appState.notes.filter(note => 
            tags.some(tag => note.tags.includes(tag))
        );
    }

    getAllTags() {
        const tagSet = new Set();
        this.appState.notes.forEach(note => {
            note.tags.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }

    async exportNotes(format = 'json', options = {}) {
        try {
            const notes = options.noteIds 
                ? this.appState.notes.filter(note => options.noteIds.includes(note.id))
                : this.appState.notes;

            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(notes, null, 2);
                
                case 'markdown':
                    return this.exportToMarkdown(notes);
                
                case 'txt':
                    return this.exportToText(notes);
                
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            Logger.error('Failed to export notes', error);
            throw new Error('Failed to export notes');
        }
    }

    exportToMarkdown(notes) {
        return notes.map(note => {
            let markdown = `# ${note.title}\n\n`;
            markdown += `**Created:** ${new Date(note.createdAt).toLocaleString()}\n`;
            markdown += `**Modified:** ${new Date(note.modifiedAt).toLocaleString()}\n\n`;
            
            if (note.tags.length > 0) {
                markdown += `**Tags:** ${note.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
            }
            
            if (note.summary) {
                markdown += `**Summary:** ${note.summary}\n\n`;
            }
            
            markdown += `${note.content}\n\n`;
            
            if (note.extractedTasks.length > 0) {
                markdown += `## Extracted Tasks\n\n`;
                note.extractedTasks.forEach(task => {
                    markdown += `- ${task.title} (confidence: ${task.confidence})\n`;
                });
                markdown += '\n';
            }
            
            return markdown;
        }).join('---\n\n');
    }

    exportToText(notes) {
        return notes.map(note => {
            let text = `${note.title}\n${'='.repeat(note.title.length)}\n\n`;
            text += `Created: ${new Date(note.createdAt).toLocaleString()}\n`;
            text += `Modified: ${new Date(note.modifiedAt).toLocaleString()}\n\n`;
            
            if (note.tags.length > 0) {
                text += `Tags: ${note.tags.join(', ')}\n\n`;
            }
            
            if (note.summary) {
                text += `Summary: ${note.summary}\n\n`;
            }
            
            text += `${note.content}\n\n`;
            
            return text;
        }).join('\n' + '-'.repeat(50) + '\n\n');
    }

    generateNoteId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateTitleFromContent(content) {
        if (!content || !content.trim()) {
            return 'Untitled Note';
        }
        
        const lines = content.trim().split('\n');
        const firstLine = lines[0];
        
        // Try to extract a meaningful title from the first line
        let title = firstLine;
        
        // Remove common prefixes that don't add value
        title = title.replace(/^(note:|notes?:|thoughts?:|ideas?:|todo:|task:|meeting:|call:)\s*/i, '');
        
        // If the first line is very short, try to combine with second line
        if (title.length < 10 && lines.length > 1) {
            const secondLine = lines[1].trim();
            if (secondLine.length > 0) {
                title = `${title} - ${secondLine}`;
            }
        }
        
        // Clean up the title
        title = title.replace(/[^\w\s\-.,!?()]/g, ' ').trim();
        
        // Limit to reasonable length
        if (title.length > 60) {
            // Try to break at word boundary
            const words = title.split(' ');
            let truncated = '';
            for (const word of words) {
                if ((truncated + ' ' + word).length > 57) {
                    break;
                }
                truncated += (truncated ? ' ' : '') + word;
            }
            title = truncated + '...';
        }
        
        return title || 'Untitled Note';
    }

    getNotesStats() {
        const notes = this.appState.notes;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            total: notes.length,
            today: notes.filter(note => new Date(note.createdAt) >= today).length,
            thisWeek: notes.filter(note => new Date(note.createdAt) >= thisWeek).length,
            thisMonth: notes.filter(note => new Date(note.createdAt) >= thisMonth).length,
            withTasks: notes.filter(note => note.extractedTasks.length > 0).length,
            processed: notes.filter(note => note.aiProcessed).length,
            totalTags: this.getAllTags().length
        };
    }
}
