// core/state.js - Global State Management

import { Logger } from './config.js';

export class AppState extends EventTarget {
    constructor() {
        super();
        this.tasks = [];
        this.extractedTasks = [];
        this.notes = [];
        this.pendingTasks = [];
        this.chats = [];
        this.currentTaskId = null;
        this.currentNoteId = null;
        this.currentChatId = null;
        this.currentStep = 1;
        this.selectedService = '';
        this.onboardingData = {
            userName: '',
            service: '',
            endpoint: '',
            apiKey: '',
            model: '',
            nameVariations: []
        };
    }

    // Task Management
    setTasks(tasks) {
        this.tasks = tasks;
        this.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks } }));
    }

    addTask(task) {
        this.tasks.unshift(task);
        this.dispatchEvent(new CustomEvent('taskAdded', { detail: { task } }));
        this.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: this.tasks } }));
    }

    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.dispatchEvent(new CustomEvent('taskUpdated', { 
                detail: { taskId, task: this.tasks[taskIndex] } 
            }));
            this.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: this.tasks } }));
        }
    }

    deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const deletedTask = this.tasks.splice(taskIndex, 1)[0];
            this.dispatchEvent(new CustomEvent('taskDeleted', { detail: { taskId, task: deletedTask } }));
            this.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: this.tasks } }));
        }
    }

    getTask(taskId) {
        return this.tasks.find(t => t.id === taskId);
    }

    getTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(t => 
            t.date === today && 
            !t.completed && 
            !t.postponed
        );
    }

    getCompletedTasks() {
        return this.tasks.filter(t => t.completed);
    }

    getPostponedTasks() {
        return this.tasks.filter(t => t.postponed && !t.completed);
    }

    // Extracted Tasks Management
    setExtractedTasks(tasks) {
        this.extractedTasks = tasks;
        this.dispatchEvent(new CustomEvent('extractedTasksChanged', { detail: { tasks } }));
    }

    addExtractedTask(task) {
        this.extractedTasks.push(task);
        this.dispatchEvent(new CustomEvent('extractedTasksChanged', { 
            detail: { tasks: this.extractedTasks } 
        }));
    }

    removeExtractedTask(index) {
        if (index >= 0 && index < this.extractedTasks.length) {
            this.extractedTasks.splice(index, 1);
            this.dispatchEvent(new CustomEvent('extractedTasksChanged', { 
                detail: { tasks: this.extractedTasks } 
            }));
        }
    }

    clearExtractedTasks() {
        this.extractedTasks = [];
        this.dispatchEvent(new CustomEvent('extractedTasksChanged', { 
            detail: { tasks: this.extractedTasks } 
        }));
    }

    // Onboarding Data Management
    setOnboardingData(data) {
        this.onboardingData = { ...this.onboardingData, ...data };
        this.dispatchEvent(new CustomEvent('onboardingDataChanged', { 
            detail: { data: this.onboardingData } 
        }));
    }

    updateOnboardingField(field, value) {
        this.onboardingData[field] = value;
        this.dispatchEvent(new CustomEvent('onboardingDataChanged', { 
            detail: { data: this.onboardingData } 
        }));
    }

    // UI State Management
    setCurrentTaskId(taskId) {
        this.currentTaskId = taskId;
        this.dispatchEvent(new CustomEvent('currentTaskChanged', { detail: { taskId } }));
    }

    setCurrentStep(step) {
        this.currentStep = step;
        this.dispatchEvent(new CustomEvent('stepChanged', { detail: { step } }));
    }

    setSelectedService(service) {
        this.selectedService = service;
        this.onboardingData.service = service;
        this.dispatchEvent(new CustomEvent('serviceSelected', { detail: { service } }));
    }

    // Utility Methods
    generateTaskId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    getTaskCounts() {
        return {
            completed: this.getCompletedTasks().length,
            postponed: this.getPostponedTasks().length,
            today: this.getTodayTasks().length
        };
    }

    // Notes Management
    setNotes(notes) {
        // Ensure notes is always an array
        this.notes = Array.isArray(notes) ? notes : [];
        this.dispatchEvent(new CustomEvent('notesChanged', { detail: { notes: this.notes } }));
    }

    addNote(note) {
        this.notes.unshift(note);
        this.dispatchEvent(new CustomEvent('noteAdded', { detail: { note } }));
        this.dispatchEvent(new CustomEvent('notesChanged', { detail: { notes: this.notes } }));
    }

    updateNote(noteId, updates) {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = { ...this.notes[noteIndex], ...updates };
            this.dispatchEvent(new CustomEvent('noteUpdated', { 
                detail: { noteId, note: this.notes[noteIndex] } 
            }));
            this.dispatchEvent(new CustomEvent('notesChanged', { detail: { notes: this.notes } }));
        }
    }

    deleteNote(noteId) {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            const deletedNote = this.notes.splice(noteIndex, 1)[0];
            this.dispatchEvent(new CustomEvent('noteDeleted', { detail: { noteId, note: deletedNote } }));
            this.dispatchEvent(new CustomEvent('notesChanged', { detail: { notes: this.notes } }));
        }
    }

    getNote(noteId) {
        return this.notes.find(n => n.id === noteId);
    }

    getTodayNotes() {
        const today = new Date().toISOString().split('T')[0];
        return this.notes.filter(n => n.createdAt.startsWith(today));
    }

    getRecentNotes(days = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return this.notes.filter(n => new Date(n.createdAt) >= cutoff);
    }

    // UI State Management for Notes
    setCurrentNoteId(noteId) {
        this.currentNoteId = noteId;
        this.dispatchEvent(new CustomEvent('currentNoteChanged', { detail: { noteId } }));
    }

    // Pending Tasks Management
    setPendingTasks(pendingTasks) {
        this.pendingTasks = pendingTasks;
        this.dispatchEvent(new CustomEvent('pendingTasksChanged', { detail: { pendingTasks } }));
    }

    addPendingTask(pendingTask) {
        this.pendingTasks.unshift(pendingTask);
        this.dispatchEvent(new CustomEvent('pendingTaskAdded', { detail: { pendingTask } }));
        this.dispatchEvent(new CustomEvent('pendingTasksChanged', { detail: { pendingTasks: this.pendingTasks } }));
    }

    removePendingTask(pendingTaskId) {
        const taskIndex = this.pendingTasks.findIndex(t => t.id === pendingTaskId);
        if (taskIndex !== -1) {
            const removedTask = this.pendingTasks.splice(taskIndex, 1)[0];
            this.dispatchEvent(new CustomEvent('pendingTaskRemoved', { detail: { pendingTaskId, task: removedTask } }));
            this.dispatchEvent(new CustomEvent('pendingTasksChanged', { detail: { pendingTasks: this.pendingTasks } }));
        }
    }

    getPendingTask(pendingTaskId) {
        return this.pendingTasks.find(t => t.id === pendingTaskId);
    }

    getPendingTasksCount() {
        return this.pendingTasks.length;
    }

    // Chat Management
    setChats(chats) {
        this.chats = Array.isArray(chats) ? chats : [];
        this.dispatchEvent(new CustomEvent('chatsChanged', { detail: { chats: this.chats } }));
    }

    addChat(chat) {
        this.chats.unshift(chat);
        this.dispatchEvent(new CustomEvent('chatAdded', { detail: { chat } }));
        this.dispatchEvent(new CustomEvent('chatsChanged', { detail: { chats: this.chats } }));
    }

    updateChat(chatId, updates) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            this.chats[chatIndex] = { ...this.chats[chatIndex], ...updates };
            this.dispatchEvent(new CustomEvent('chatUpdated', { 
                detail: { chatId, chat: this.chats[chatIndex] } 
            }));
            this.dispatchEvent(new CustomEvent('chatsChanged', { detail: { chats: this.chats } }));
        }
    }

    deleteChat(chatId) {
        const chatIndex = this.chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            const deletedChat = this.chats.splice(chatIndex, 1)[0];
            this.dispatchEvent(new CustomEvent('chatDeleted', { detail: { chatId, chat: deletedChat } }));
            this.dispatchEvent(new CustomEvent('chatsChanged', { detail: { chats: this.chats } }));
        }
    }

    getChat(chatId) {
        return this.chats.find(c => c.id === chatId);
    }

    getRecentChats(limit = 10) {
        return [...this.chats]
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
            .slice(0, limit);
    }

    // UI State Management for Chats
    setCurrentChatId(chatId) {
        this.currentChatId = chatId;
        this.dispatchEvent(new CustomEvent('currentChatChanged', { detail: { chatId } }));
    }

    // Debug Methods
    getDebugInfo() {
        return {
            tasksCount: this.tasks.length,
            extractedTasksCount: this.extractedTasks.length,
            notesCount: this.notes.length,
            chatsCount: this.chats.length,
            currentTaskId: this.currentTaskId,
            currentNoteId: this.currentNoteId,
            currentChatId: this.currentChatId,
            currentStep: this.currentStep,
            selectedService: this.selectedService,
            userName: this.onboardingData.userName,
            hasNameVariations: this.onboardingData.nameVariations?.length > 0
        };
    }

    log(message) {
        Logger.log(message, this.getDebugInfo());
    }
}
