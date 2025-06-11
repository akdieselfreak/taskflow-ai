// core/authManager.js - Centralized Authentication Manager

import { Logger } from './config.js';

export class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('auth_token');
        this.isLoggedIn = false;
        this.authCallbacks = [];
        this.logoutCallbacks = [];
        
        // Initialize auth state
        this.init();
    }

    async init() {
        Logger.log('[AuthManager] Initializing authentication manager');
        
        // Check for token in localStorage again in case it was set after constructor
        if (!this.authToken) {
            this.authToken = localStorage.getItem('auth_token');
        }
        
        if (this.authToken) {
            Logger.log('[AuthManager] Found existing token, verifying...');
            const isValid = await this.verifyToken();
            if (isValid) {
                Logger.log('[AuthManager] Token verification successful, user authenticated');
            } else {
                Logger.log('[AuthManager] Token verification failed, clearing auth data');
            }
        } else {
            Logger.log('[AuthManager] No existing token found');
        }
    }

    async verifyToken() {
        if (!this.authToken) {
            Logger.log('[AuthManager] No token to verify');
            return false;
        }

        try {
            const response = await fetch('http://localhost:3001/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.isLoggedIn = true;
                
                Logger.log('[AuthManager] Token verified successfully', {
                    user: data.user,
                    isLoggedIn: this.isLoggedIn
                });
                
                this.triggerAuthCallbacks(true, this.currentUser);
                return true;
            } else {
                Logger.log('[AuthManager] Token verification failed');
                this.clearAuthData();
                return false;
            }
        } catch (error) {
            Logger.error('[AuthManager] Token verification error:', error);
            return false;
        }
    }

    async login(username, password) {
        try {
            const response = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.authToken = data.token;
                this.currentUser = data.user;
                this.isLoggedIn = true;
                
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                Logger.log('[AuthManager] Login successful', {
                    user: data.user,
                    isLoggedIn: this.isLoggedIn
                });
                
                this.triggerAuthCallbacks(true, this.currentUser);
                
                return {
                    success: true,
                    user: data.user,
                    token: data.token
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Login failed'
                };
            }
        } catch (error) {
            Logger.error('[AuthManager] Login error:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
            };
        }
    }

    async register(username, email, password) {
        try {
            const response = await fetch('http://localhost:3001/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                Logger.log('[AuthManager] Registration successful', { username });
                return {
                    success: true,
                    userId: data.userId
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Registration failed'
                };
            }
        } catch (error) {
            Logger.error('[AuthManager] Registration error:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
            };
        }
    }

    logout() {
        Logger.log('[AuthManager] Logging out user');
        
        this.clearAuthData();
        this.clearAllLocalData();
        this.triggerLogoutCallbacks();
        this.triggerAuthCallbacks(false, null);
        
        // Redirect to login screen after logout
        this.redirectToLogin();
    }

    clearAuthData() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.authToken = null;
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        Logger.log('[AuthManager] Auth data cleared');
    }

    clearAllLocalData() {
        try {
            // Clear all localStorage
            localStorage.clear();
            
            // Clear all sessionStorage
            sessionStorage.clear();
            
            Logger.log('[AuthManager] All local data cleared on logout');
        } catch (error) {
            Logger.error('[AuthManager] Failed to clear local data', error);
        }
    }

    redirectToLogin() {
        try {
            // Hide main app and show onboarding
            const mainApp = document.getElementById('mainApp');
            const onboardingOverlay = document.getElementById('onboardingOverlay');
            
            if (mainApp) {
                mainApp.style.display = 'none';
            }
            
            if (onboardingOverlay) {
                onboardingOverlay.style.display = 'flex';
            }
            
            // Close any open modals
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.classList.remove('active');
                modal.style.display = 'none';
            });
            
            // Reset the app state by reloading the page
            // This ensures a clean state after logout
            setTimeout(() => {
                window.location.reload();
            }, 100);
            
            Logger.log('[AuthManager] Redirected to login screen');
        } catch (error) {
            Logger.error('[AuthManager] Failed to redirect to login', error);
            // Fallback: just reload the page
            window.location.reload();
        }
    }

    // Get auth headers for API requests
    getAuthHeaders() {
        if (this.authToken) {
            return {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.isLoggedIn && this.authToken && this.currentUser;
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Get auth token
    getAuthToken() {
        return this.authToken;
    }

    // Set authentication data (for onboarding integration)
    setAuthData(token, user) {
        this.authToken = token;
        this.currentUser = user;
        this.isLoggedIn = true;
        
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        
        Logger.log('[AuthManager] Auth data set from external source', {
            user: user,
            isLoggedIn: this.isLoggedIn
        });
        
        this.triggerAuthCallbacks(true, user);
    }

    // Callback management
    onAuthStateChange(callback) {
        this.authCallbacks.push(callback);
        
        // Immediately call with current state
        if (this.isLoggedIn) {
            callback(true, this.currentUser);
        }
    }

    onLogout(callback) {
        this.logoutCallbacks.push(callback);
    }

    triggerAuthCallbacks(isLoggedIn, user) {
        Logger.log('[AuthManager] Triggering auth callbacks', { isLoggedIn, user });
        
        this.authCallbacks.forEach(callback => {
            try {
                callback(isLoggedIn, user);
            } catch (error) {
                Logger.error('[AuthManager] Error in auth callback:', error);
            }
        });

        // Also trigger global event for backward compatibility
        const event = new CustomEvent('authStateChanged', {
            detail: {
                isAuthenticated: isLoggedIn,
                user: user,
                token: this.authToken
            }
        });
        window.dispatchEvent(event);
    }

    triggerLogoutCallbacks() {
        this.logoutCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                Logger.error('[AuthManager] Error in logout callback:', error);
            }
        });
    }

    // Health check method
    async healthCheck() {
        if (!this.isAuthenticated()) {
            return { healthy: false, reason: 'Not authenticated' };
        }

        try {
            const response = await fetch('http://localhost:3001/api/auth/verify', {
                headers: this.getAuthHeaders()
            });

            return {
                healthy: response.ok,
                reason: response.ok ? 'Token valid' : 'Token invalid'
            };
        } catch (error) {
            return {
                healthy: false,
                reason: 'Network error'
            };
        }
    }
}

// Export singleton instance
export const authManager = new AuthManager();
