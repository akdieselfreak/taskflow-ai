// core/state.js - Global State Management

import { Logger } from './config.js';

export class AppState extends EventTarget {
    constructor() {
        super();
        this.tasks = [];
        this.extractedTasks = [];
        this.currentTaskId = null;
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

    // Debug Methods
    getDebugInfo() {
        return {
            tasksCount: this.tasks.length,
            extractedTasksCount: this.extractedTasks.length,
            currentTaskId: this.currentTaskId,
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