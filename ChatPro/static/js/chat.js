// Professional Chat Application JavaScript
class ProfessionalChat {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.messageHistory = [];
        this.isTyping = false;
        this.loadChatHistory(); // Load existing chat history on page load
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.exportChatBtn = document.getElementById('exportChatBtn');
        this.attachmentBtn = document.getElementById('attachmentBtn');
        this.quickActionBtns = document.querySelectorAll('.quick-action-btn');
    }

    bindEvents() {
        // Send message events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Input focus and typing events
        this.messageInput.addEventListener('input', () => this.handleTyping());
        this.messageInput.addEventListener('focus', () => this.handleInputFocus());

        // Quick action buttons
        this.quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.getAttribute('data-message');
                this.messageInput.value = message;
                this.sendMessage();
            });
        });

        // Header action buttons
        this.clearChatBtn.addEventListener('click', () => this.clearChat());
        this.exportChatBtn.addEventListener('click', () => this.exportChat());
        this.attachmentBtn.addEventListener('click', () => this.handleAttachment());
        
        // Settings button functionality
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // User menu functionality
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.style.display = 'none';
            });
        }

        // Auto-resize input
        this.messageInput.addEventListener('input', () => this.autoResizeInput());
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Disable send button temporarily
        this.sendBtn.disabled = true;
        this.messageInput.disabled = true;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send message to server
            const response = await fetch('/api/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Simulate realistic response delay
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage(data.response, 'bot', data.timestamp);
                
                // Re-enable input
                this.sendBtn.disabled = false;
                this.messageInput.disabled = false;
                this.messageInput.focus();
            }, 1500 + Math.random() * 1000); // 1.5-2.5 seconds

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.', 'bot');
            
            // Re-enable input
            this.sendBtn.disabled = false;
            this.messageInput.disabled = false;
            this.messageInput.focus();
        }
    }

    addMessage(text, sender, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${sender}-message`;
        
        const avatarSrc = sender === 'user' 
            ? '/static/images/avatar-user.svg' 
            : '/static/images/avatar-bot.svg';
        
        const messageTime = timestamp 
            ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="avatar">
                <img src="${avatarSrc}" alt="${sender} avatar">
            </div>
            <div class="message-content">
                <p class="message-text">${this.escapeHtml(text)}</p>
                <div class="message-meta">
                    <span class="message-time">${messageTime}</span>
                    ${sender === 'user' ? '<i class="fas fa-check-double"></i>' : ''}
                </div>
            </div>
        `;

        // Remove welcome message if it exists
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in message history
        this.messageHistory.push({
            text: text,
            sender: sender,
            timestamp: timestamp || new Date().toISOString()
        });

        // Trigger message animation
        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 50);
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        this.typingIndicator.style.display = 'none';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    async clearChat() {
        if (confirm('Are you sure you want to clear the chat history? This action cannot be undone.')) {
            try {
                // Call API to clear chat history in database
                const response = await fetch('/api/clear_chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`Cleared ${data.cleared_messages} messages from database`);
                    
                    // Remove all messages from UI
                    const messages = this.chatMessages.querySelectorAll('.message-bubble');
                    messages.forEach(message => {
                        message.style.animation = 'messageSlideOut 0.3s ease-in forwards';
                        setTimeout(() => message.remove(), 300);
                    });

                    // Reset message history
                    this.messageHistory = [];

                    // Show success notification
                    this.showNotification('Chat history cleared successfully!', 'success');

                    // Show welcome message again
                    setTimeout(() => {
                        this.showWelcomeMessage();
                    }, 400);
                } else {
                    throw new Error('Failed to clear chat history');
                }
            } catch (error) {
                console.error('Error clearing chat:', error);
                this.showNotification('Failed to clear chat history. Please try again.', 'error');
            }
        }
    }

    showWelcomeMessage() {
        const welcomeHTML = `
            <div class="welcome-message">
                <div class="welcome-avatar">
                    <img src="/static/images/avatar-bot.svg" alt="Assistant">
                </div>
                <div class="welcome-content">
                    <h4>Welcome to Professional Chat</h4>
                    <p>I'm your dedicated professional assistant, ready to help you with inquiries, support, and guidance. How may I assist you today?</p>
                    <div class="quick-actions">
                        <button class="quick-action-btn" data-message="Tell me about your services">
                            <i class="fas fa-briefcase"></i>
                            Our Services
                        </button>
                        <button class="quick-action-btn" data-message="I need support">
                            <i class="fas fa-headset"></i>
                            Get Support
                        </button>
                        <button class="quick-action-btn" data-message="Contact information">
                            <i class="fas fa-phone"></i>
                            Contact Us
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.chatMessages.innerHTML = welcomeHTML;
        
        // Re-bind quick action events
        this.quickActionBtns = document.querySelectorAll('.quick-action-btn');
        this.quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.getAttribute('data-message');
                this.messageInput.value = message;
                this.sendMessage();
            });
        });
    }

    async exportChat() {
        try {
            // Get chat history from database
            const response = await fetch('/api/export_chat');
            
            if (!response.ok) {
                throw new Error('Failed to export chat history');
            }

            const chatData = await response.json();
            
            if (chatData.total_messages === 0) {
                alert('No messages to export. Start a conversation first!');
                return;
            }

            const jsonString = JSON.stringify(chatData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Show success feedback
            this.showNotification(`Exported ${chatData.total_messages} messages successfully!`, 'success');
            
        } catch (error) {
            console.error('Error exporting chat:', error);
            this.showNotification('Failed to export chat history. Please try again.', 'error');
        }
    }

    handleAttachment() {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 10 * 1024 * 1024) { // 10MB limit
                    alert('File size must be less than 10MB.');
                    return;
                }
                
                // For demo purposes, just show a message
                this.addMessage(`📎 Attachment: ${file.name} (${this.formatFileSize(file.size)})`, 'user');
                setTimeout(() => {
                    this.addMessage('Thank you for sharing the file. I\'ve received it and will review it shortly. How else can I assist you?', 'bot');
                }, 1000);
            }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    handleTyping() {
        // Send typing indicator to server (for future real-time features)
        if (!this.typingTimeout) {
            fetch('/api/typing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ typing: true })
            }).catch(console.error);
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.typingTimeout = null;
        }, 1000);
    }

    handleInputFocus() {
        // Remove welcome message when user starts typing
        if (this.messageInput.value.length === 0) {
            setTimeout(() => this.scrollToBottom(), 100);
        }
    }

    autoResizeInput() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadChatHistory() {
        try {
            const response = await fetch('/api/chat_history?per_page=20');
            if (response.ok) {
                const data = await response.json();
                
                if (data.messages.length > 0) {
                    // Remove welcome message if exists
                    const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
                    if (welcomeMessage) {
                        welcomeMessage.remove();
                    }
                    
                    // Add messages in chronological order (reverse since API returns newest first)
                    data.messages.reverse().forEach(msg => {
                        this.displayHistoryMessage(msg);
                    });
                    
                    this.scrollToBottom();
                    console.log(`Loaded ${data.messages.length} messages from chat history`);
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    displayHistoryMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${message.sender_type}-message`;
        
        const avatarSrc = message.sender_type === 'user' 
            ? '/static/images/avatar-user.svg' 
            : '/static/images/avatar-bot.svg';
        
        const messageTime = new Date(message.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="avatar">
                <img src="${avatarSrc}" alt="${message.sender_type} avatar">
            </div>
            <div class="message-content">
                <p class="message-text">${this.escapeHtml(message.message_text)}</p>
                <div class="message-meta">
                    <span class="message-time">${messageTime}</span>
                    ${message.sender_type === 'user' ? '<i class="fas fa-check-double"></i>' : ''}
                    ${message.response_time_ms ? `<span class="response-time">${message.response_time_ms}ms</span>` : ''}
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        
        // Store in local message history
        this.messageHistory.push({
            text: message.message_text,
            sender: message.sender_type,
            timestamp: message.created_at,
            id: message.id
        });
    }

    async showSettings() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            
            const stats = await response.json();
            
            const settingsHTML = `
                <div class="settings-modal" id="settingsModal">
                    <div class="settings-content">
                        <div class="settings-header">
                            <h3><i class="fas fa-cog"></i> Chat Settings & Statistics</h3>
                            <button class="btn-close" onclick="this.closest('.settings-modal').remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="settings-body">
                            <div class="stats-section">
                                <h4><i class="fas fa-chart-bar"></i> Session Statistics</h4>
                                <div class="stats-grid">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Messages:</span>
                                        <span class="stat-value">${stats.total_messages}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Your Messages:</span>
                                        <span class="stat-value">${stats.user_messages}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Bot Responses:</span>
                                        <span class="stat-value">${stats.bot_messages}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Avg Response Time:</span>
                                        <span class="stat-value">${stats.avg_response_time_ms}ms</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Today's Messages:</span>
                                        <span class="stat-value">${stats.today_messages}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Session Duration:</span>
                                        <span class="stat-value">${stats.session_duration_minutes} min</span>
                                    </div>
                                </div>
                            </div>
                            <div class="actions-section">
                                <h4><i class="fas fa-tools"></i> Actions</h4>
                                <div class="action-buttons">
                                    <button class="action-btn" onclick="chat.exportChat(); document.getElementById('settingsModal').remove();">
                                        <i class="fas fa-download"></i> Export Chat
                                    </button>
                                    <button class="action-btn danger" onclick="chat.clearChat(); document.getElementById('settingsModal').remove();">
                                        <i class="fas fa-trash"></i> Clear History
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if present
            const existingModal = document.getElementById('settingsModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to page
            document.body.insertAdjacentHTML('beforeend', settingsHTML);
            
        } catch (error) {
            console.error('Error showing settings:', error);
            this.showNotification('Failed to load chat statistics.', 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes messageSlideOut {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-20px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                window.location.href = '/auth';
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
        }
    }
}

// Delete account function
async function deleteAccount() {
    const confirmation = prompt('WARNING: This will permanently delete your account and all chat history. Type "DELETE" to confirm:');
    
    if (confirmation === 'DELETE') {
        try {
            const response = await fetch('/delete_account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                alert('Account deleted successfully. You will be redirected to the login page.');
                window.location.href = '/auth';
            } else {
                alert(data.error || 'Failed to delete account. Please try again.');
            }
        } catch (error) {
            console.error('Account deletion error:', error);
            alert('Failed to delete account. Please try again.');
        }
    }
}

// Initialize the chat application
let chat; // Global variable for settings modal access
document.addEventListener('DOMContentLoaded', () => {
    chat = new ProfessionalChat();
    
    // Add loading state management
    window.addEventListener('beforeunload', () => {
        // Save any unsent message
        const messageInput = document.getElementById('messageInput');
        if (messageInput && messageInput.value.trim()) {
            localStorage.setItem('unsent-message', messageInput.value);
        }
    });
    
    // Restore unsent message
    const unsentMessage = localStorage.getItem('unsent-message');
    if (unsentMessage) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = unsentMessage;
            localStorage.removeItem('unsent-message');
        }
    }
});
