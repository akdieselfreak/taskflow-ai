// ui/authUI.js - Authentication UI Components

export class AuthUI {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('auth_token');
        this.isLoggedIn = false;
        this.modalCreated = false;
        // Don't call init() in constructor - let main app call it
    }

    async init() {
        // Don't create the modal automatically - let onboarding handle auth flow
        // Only check auth status silently
        await this.checkAuthStatus();
    }

    // Only create modal when explicitly requested (not automatically)
    createAuthModal() {
        if (this.modalCreated) return;
        
        const modalHTML = `
            <div id="auth-modal" class="modal-overlay" style="display: none;">
                <div class="modal">
                    <div class="modal-header">
                        <h2 id="auth-modal-title">Account Access</h2>
                        <button class="modal-close" id="auth-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="auth-tabs" class="auth-tabs">
                            <button id="login-tab" class="auth-tab active">Sign In</button>
                            <button id="register-tab" class="auth-tab">Create Account</button>
                        </div>
                        
                        <!-- Login Form -->
                        <form id="login-form" class="auth-form">
                            <div class="form-group">
                                <label for="login-username">Username or Email</label>
                                <input type="text" id="login-username" placeholder="Enter your username or email..." required>
                            </div>
                            <div class="form-group">
                                <label for="login-password">Password</label>
                                <input type="password" id="login-password" placeholder="Enter your password..." required>
                            </div>
                            <div class="button-group">
                                <button type="submit" class="btn btn-primary">Sign In</button>
                                <button type="button" class="btn btn-secondary" onclick="closeAuthModal()">Cancel</button>
                            </div>
                            <div id="login-error" class="error-message"></div>
                        </form>

                        <!-- Register Form -->
                        <form id="register-form" class="auth-form" style="display: none;">
                            <div class="form-group">
                                <label for="register-username">Username</label>
                                <input type="text" id="register-username" placeholder="Choose a username..." required>
                            </div>
                            <div class="form-group">
                                <label for="register-email">Email (optional)</label>
                                <input type="email" id="register-email" placeholder="your@email.com">
                                <p class="input-hint">For account recovery and notifications</p>
                            </div>
                            <div class="form-group">
                                <label for="register-password">Password</label>
                                <input type="password" id="register-password" placeholder="Create a secure password..." required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="register-confirm">Confirm Password</label>
                                <input type="password" id="register-confirm" placeholder="Confirm your password..." required>
                            </div>
                            <div class="button-group">
                                <button type="submit" class="btn btn-primary">Create Account</button>
                                <button type="button" class="btn btn-secondary" onclick="closeAuthModal()">Cancel</button>
                            </div>
                            <div id="register-error" class="error-message"></div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.attachEventListeners();
        this.modalCreated = true;
    }

    attachEventListeners() {
        // Tab switching
        document.getElementById('login-tab').addEventListener('click', () => this.showTab('login'));
        document.getElementById('register-tab').addEventListener('click', () => this.showTab('register'));

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));

        // Modal close
        document.getElementById('auth-modal-close').addEventListener('click', () => this.hideAuthModal());
        
        // Make closeAuthModal available globally
        window.closeAuthModal = () => this.hideAuthModal();
    }

    showTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');

        // Show/hide forms
        document.querySelectorAll('.auth-form').forEach(form => form.style.display = 'none');
        
        if (tab === 'login') {
            document.getElementById('login-form').style.display = 'block';
        } else if (tab === 'register') {
            document.getElementById('register-form').style.display = 'block';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        // Clear previous errors
        errorDiv.textContent = '';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                errorDiv.textContent = 'Server error. Please try again.';
                return;
            }

            if (response.ok) {
                this.authToken = data.token;
                this.currentUser = data.user;
                this.isLoggedIn = true;
                
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                
                this.hideAuthModal();
                this.onAuthSuccess();
                
                // Show success message
                this.showNotification('Login successful! Your data will now sync across devices.', 'success');
                
                // Trigger auth state change event
                this.triggerAuthStateChange();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        const errorDiv = document.getElementById('register-error');

        // Clear previous errors
        errorDiv.textContent = '';

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Registration successful! Please log in.', 'success');
                this.showTab('login');
                document.getElementById('login-username').value = username;
                // Clear the register form
                document.getElementById('register-form').reset();
            } else {
                errorDiv.textContent = data.error || 'Registration failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
        }
    }

    async checkAuthStatus() {
        if (!this.authToken) {
            // Don't automatically show auth modal - let the app decide when to show it
            return false;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.isLoggedIn = true;
                
                // Trigger auth success callback
                this.onAuthSuccess();
                return true;
            } else {
                // Token is invalid, clear it but don't show modal automatically
                this.clearAuthData();
                return false;
            }
        } catch (error) {
            // Network error, don't show modal automatically
            return false;
        }
    }

    showAuthModal() {
        // Create modal if it doesn't exist
        if (!this.modalCreated) {
            this.createAuthModal();
        }
        
        document.getElementById('auth-modal').style.display = 'block';
        this.showTab('login');
    }

    hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    clearAuthData() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.authToken = null;
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }

    logout() {
        this.clearAuthData();
        
        this.showNotification('Logged out successfully', 'info');
        
        // Trigger auth state change
        this.triggerAuthStateChange();
        
        // Call logout callback
        if (this.onLogout) {
            this.onLogout();
        }
    }

    // Method to be called when authentication is successful
    onAuthSuccess() {
        if (this.onAuthSuccessCallback) {
            this.onAuthSuccessCallback(this.isLoggedIn, this.currentUser);
        }
    }

    // Set callback for auth success
    setAuthSuccessCallback(callback) {
        this.onAuthSuccessCallback = callback;
    }

    // Set callback for logout
    setLogoutCallback(callback) {
        this.onLogout = callback;
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
        return this.isLoggedIn && this.authToken;
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Show notification (assumes notification system exists)
    showNotification(message, type = 'info') {
        // This should integrate with your existing notification system
        if (window.taskFlowApp && window.taskFlowApp.notifications) {
            if (type === 'success') {
                window.taskFlowApp.notifications.showSuccess(message);
            } else if (type === 'error') {
                window.taskFlowApp.notifications.showError(message);
            } else {
                window.taskFlowApp.notifications.showInfo(message);
            }
        } else {
            // Fallback - no notification system available
        }
    }

    // Trigger auth state change event
    triggerAuthStateChange() {
        const event = new CustomEvent('authStateChanged', {
            detail: {
                isAuthenticated: this.isLoggedIn,
                user: this.currentUser,
                token: this.authToken
            }
        });
        window.dispatchEvent(event);
    }
}
