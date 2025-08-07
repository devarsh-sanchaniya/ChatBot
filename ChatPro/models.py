from datetime import datetime
from app import db
from sqlalchemy import func

class User(db.Model):
    """User model for registered users"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationship to messages
    messages = db.relationship('ChatMessage', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'

class ChatMessage(db.Model):
    """Chat message model for storing conversation history"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message_text = db.Column(db.Text, nullable=False)
    sender_type = db.Column(db.String(10), nullable=False)  # 'user' or 'bot'
    message_type = db.Column(db.String(20), default='text')  # 'text', 'attachment', 'system'
    attachment_filename = db.Column(db.String(255))
    attachment_size = db.Column(db.Integer)
    response_time_ms = db.Column(db.Integer)  # Response time for bot messages
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<ChatMessage {self.id} - {self.sender_type}>'
    
    def to_dict(self):
        """Convert message to dictionary for JSON response"""
        return {
            'id': self.id,
            'message_text': self.message_text,
            'sender_type': self.sender_type,
            'message_type': self.message_type,
            'attachment_filename': self.attachment_filename,
            'attachment_size': self.attachment_size,
            'created_at': self.created_at.isoformat(),
            'response_time_ms': self.response_time_ms
        }

class ChatSession(db.Model):
    """Model for tracking chat session statistics"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    session_start = db.Column(db.DateTime, default=datetime.utcnow)
    session_end = db.Column(db.DateTime)
    total_messages = db.Column(db.Integer, default=0)
    total_user_messages = db.Column(db.Integer, default=0)
    total_bot_messages = db.Column(db.Integer, default=0)
    avg_response_time_ms = db.Column(db.Float)
    session_rating = db.Column(db.Integer)  # 1-5 star rating
    feedback_text = db.Column(db.Text)
    
    def __repr__(self):
        return f'<ChatSession {self.id} - User {self.user_id}>'