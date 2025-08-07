// Authentication JavaScript
class AuthManager {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.isLogin = true; // Start with login form
    }

    initializeElements() {
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.toggleFormBtn = document.getElementById('toggleFormBtn');
        this.authTitle = document.getElementById('authTitle');
        this.authSubtitle = document.getElementById('authSubtitle');
        this.toggleText = document.getElementById('toggleText');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.messageContainer = document.getElementById('messageContainer');
    }

    bindEvents() {
        // Form submissions
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        
        // Form toggle
        this.toggleFormBtn.addEventListener('click', () => this.toggleForm());
        
        // Password validation for registration
        const confirmPasswordInput = document.getElementById('confirmPassword');
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
        }
        
        // Real-time validation
        document.getElementById('registerUsername').addEventListener('input', (e) => {
            this.validateUsername(e.target.value);
        });
        
        document.getElementById('registerEmail').addEventListener('input', (e) => {
            this.validateEmail(e.target.value);
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(data.message, 'success');
                
                // Redirect to chat after short delay
                setTimeout(() => {
                    window.location.href = '/chat';
                }, 1000);
            } else {
                this.showMessage(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Connection error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Client-side validation
        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }
        
        if (username.length < 3) {
            this.showMessage('Username must be at least 3 characters', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(data.message, 'success');
                
                // Redirect to chat after short delay
                setTimeout(() => {
                    window.location.href = '/chat';
                }, 1000);
            } else {
                this.showMessage(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Connection error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    toggleForm() {
        this.isLogin = !this.isLogin;
        
        if (this.isLogin) {
            // Show login form
            this.loginForm.style.display = 'block';
            this.registerForm.style.display = 'none';
            this.authTitle.textContent = 'Welcome Back';
            this.authSubtitle.textContent = 'Sign in to continue your conversations';
            this.toggleText.textContent = "Don't have an account?";
            this.toggleFormBtn.textContent = 'Sign Up';
        } else {
            // Show registration form
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'block';
            this.authTitle.textContent = 'Create Account';
            this.authSubtitle.textContent = 'Join our community and start chatting';
            this.toggleText.textContent = 'Already have an account?';
            this.toggleFormBtn.textContent = 'Sign In';
        }
        
        // Clear messages and form
        this.clearMessages();
        this.resetForms();
    }

    showLoading(show) {
        if (show) {
            this.loadingIndicator.style.display = 'block';
            // Disable form buttons
            document.querySelectorAll('.auth-btn').forEach(btn => {
                btn.disabled = true;
            });
        } else {
            this.loadingIndicator.style.display = 'none';
            // Enable form buttons
            document.querySelectorAll('.auth-btn').forEach(btn => {
                btn.disabled = false;
            });
        }
    }

    showMessage(message, type) {
        this.clearMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 'exclamation-triangle';
        messageDiv.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        this.messageContainer.appendChild(messageDiv);
        
        // Auto-remove success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }

    clearMessages() {
        this.messageContainer.innerHTML = '';
    }

    resetForms() {
        this.loginForm.reset();
        this.registerForm.reset();
        
        // Clear any validation styling
        document.querySelectorAll('.input-wrapper input').forEach(input => {
            input.style.borderColor = '';
        });
    }

    validatePasswordMatch() {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmInput = document.getElementById('confirmPassword');
        
        if (confirmPassword && password !== confirmPassword) {
            confirmInput.style.borderColor = '#ef4444';
        } else {
            confirmInput.style.borderColor = '';
        }
    }

    validateUsername(username) {
        const usernameInput = document.getElementById('registerUsername');
        
        if (username.length > 0 && username.length < 3) {
            usernameInput.style.borderColor = '#ef4444';
        } else {
            usernameInput.style.borderColor = '';
        }
    }

    validateEmail(email) {
        const emailInput = document.getElementById('registerEmail');
        
        if (email && !this.isValidEmail(email)) {
            emailInput.style.borderColor = '#ef4444';
        } else {
            emailInput.style.borderColor = '';
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Enter key submits active form
    if (e.key === 'Enter' && !e.shiftKey) {
        const activeForm = document.querySelector('.auth-form:not([style*="display: none"])');
        if (activeForm) {
            e.preventDefault();
            activeForm.querySelector('.auth-btn').click();
        }
    }
});