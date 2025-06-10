// ui/authUI.js - Authentication UI Components

export class AuthUI {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('auth_token');
        this.isLoggedIn = false;
        this.init();
    }

    init() {
        this.createAuthModal();
        this.checkAuthStatus();
    }

    createAuthModal() {
        const modalHTML = `
            <div id="auth-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="auth-modal-title">Welcome to TaskFlow AI</h2>
                        <span class="close" id="auth-modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div id="auth-tabs">
                            <button id="login-tab" class="auth-tab active">Login</button>
                            <button id="register-tab" class="auth-tab">Register</button>
                            <button id="guest-tab" class="auth-tab">Continue as Guest</button>
                        </div>
                        
                        <!-- Login Form -->
                        <form id="login-form" class="auth-form">
                            <div class="form-group">
                                <label for="login-username">Username or Email:</label>
                                <input type="text" id="login-username" required>
                            </div>
                            <div class="form-group">
                                <label for="login-password">Password:</label>
                                <input type="password" id="login-password" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Login</button>
                            <div id="login-error" class="error-message"></div>
                        </form>

                        <!-- Register Form -->
                        <form id="register-form" class="auth-form" style="display: none;">
                            <div class="form-group">
                                <label for="register-username">Username:</label>
                                <input type="text" id="register-username" required>
                            </div>
                            <div class="form-group">
                                <label for="register-email">Email (optional):</label>
                                <input type="email" id="register-email">
                            </div>
                            <div class="form-group">
                                <label for="register-password">Password:</label>
                                <input type="password" id="register-password" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="register-confirm">Confirm Password:</label>
                                <input type="password" id="register-confirm" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Register</button>
                            <div id="register-error" class="error-message"></div>
                        </form>

                        <!-- Guest Mode Info -->
                        <div id="guest-info" class="auth-form" style="display: none;">
                            <p><strong>Guest Mode:</strong> Your data will be stored locally in your browser only.</p>
                            <p><strong>Limitations:</strong></p>
                            <ul>
                                <li>No cross-device synchronization</li>
                                <li>Data may be lost if browser storage is cleared</li>
                                <li>No backup/restore capabilities</li>
                            </ul>
                            <p><strong>Benefits of Creating an Account:</strong></p>
                            <ul>
                                <li>✅ Access your tasks from any device</li>
                                <li>✅ Automatic data backup</li>
                                <li>✅ Never lose your data</li>
                            </ul>
                            <button id="continue-guest" class="btn btn-secondary">Continue as Guest</button>
                            <button id="create-account-instead" class="btn btn-primary">Create Account Instead</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Tab switching
        document.getElementById('login-tab').addEventListener('click', () => this.showTab('login'));
        document.getElementById('register-tab').addEventListener('click', () => this.showTab('register'));
        document.getElementById('guest-tab').addEventListener('click', () => this.showTab('guest'));

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));

        // Guest mode
        document.getElementById('continue-guest').addEventListener('click', () => this.continueAsGuest());
        document.getElementById('create-account-instead').addEventListener('click', () => this.showTab('register'));

        // Modal close
        document.getElementById('auth-modal-close').addEventListener('click', () => this.hideAuthModal());
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
        } else if (tab === 'guest') {
            document.getElementById('guest-info').style.display = 'block';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        try {
            const response = await fetch('/api/auth/login', {
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
                
                this.hideAuthModal();
                this.onAuthSuccess();
                
                // Show success message
                this.showNotification('Login successful! Your data will now sync across devices.', 'success');
            } else {
                errorDiv.textContent = data.error || 'Login failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            console.error('Login error:', error);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        const errorDiv = document.getElementById('register-error');

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
            } else {
                errorDiv.textContent = data.error || 'Registration failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            console.error('Registration error:', error);
        }
    }

    continueAsGuest() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.authToken = null;
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        this.hideAuthModal();
        this.onAuthSuccess();
        
        this.showNotification('Continuing in guest mode. Data will be stored locally only.', 'info');
    }

    async checkAuthStatus() {
        if (!this.authToken) {
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
                return true;
            } else {
                // Token is invalid, clear it
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Auth verification error:', error);
            return false;
        }
    }

    showAuthModal() {
        document.getElementById('auth-modal').style.display = 'block';
        this.showTab('login');
    }

    hideAuthModal() {
        document.getElementById('auth-modal').style.display = 'none';
    }

    logout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.authToken = null;
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        this.showNotification('Logged out successfully', 'info');
        
        // Optionally reload the page or show auth modal
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
        if (window.notifications && window.notifications.show) {
            if (type === 'success') {
                window.notifications.showSuccess(message);
            } else if (type === 'error') {
                window.notifications.showError(message);
            } else {
                window.notifications.showInfo(message);
            }
        } else {
            // Fallback to console or alert
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // Add user info to header
    updateUserInterface() {
        const headerElement = document.querySelector('.header') || document.querySelector('header');
        
        if (headerElement && !document.getElementById('user-info')) {
            const userInfoHTML = `
                <div id="user-info" class="user-info">
                    ${this.isLoggedIn ? 
                        `<span>Welcome, ${this.currentUser.username}!</span>
                         <button id="logout-btn" class="btn btn-small">Logout</button>` :
                        `<span>Guest Mode</span>
                         <button id="login-btn" class="btn btn-small">Login</button>`
                    }
                </div>
            `;
            
            headerElement.insertAdjacentHTML('beforeend', userInfoHTML);
            
            // Add event listeners
            if (this.isLoggedIn) {
                document.getElementById('logout-btn').addEventListener('click', () => this.logout());
            } else {
                document.getElementById('login-btn').addEventListener('click', () => this.showAuthModal());
            }
        }
    }
}
