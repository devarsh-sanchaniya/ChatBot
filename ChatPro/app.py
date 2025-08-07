import os
import json
import uuid
import time
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.security import generate_password_hash, check_password_hash
import logging

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

# Initialize database
db = SQLAlchemy(model_class=Base)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")

# Configure the database
database_url = os.environ.get("DATABASE_URL")
if database_url:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    
    # Initialize the app with the extension
    db.init_app(app)
    
    with app.app_context():
        # Import models to create tables
        import models
        db.create_all()
        app.logger.info("Database tables created successfully")
else:
    app.logger.warning("No DATABASE_URL found, running without database")

def get_current_user():
    """Get current logged in user"""
    if 'user_id' not in session:
        return None
    
    from models import User
    user = User.query.get(session['user_id'])
    if user:
        # Update last active timestamp
        user.last_active = datetime.utcnow()
        db.session.commit()
    return user

def login_required(f):
    """Decorator to require login for routes"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth_page'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Serve the main page - redirect to auth if not logged in"""
    if 'user_id' not in session:
        return redirect(url_for('auth_page'))
    return redirect(url_for('chat'))

@app.route('/auth')
def auth_page():
    """Serve the login/registration page"""
    return render_template('auth.html')

@app.route('/chat')
@login_required
def chat():
    """Serve the main chatbot interface"""
    user = get_current_user()
    if not user:
        return redirect(url_for('auth_page'))
    app.logger.info(f"User accessing chat: {user.username}")
    return render_template('chat.html', user=user)

@app.route('/register', methods=['POST'])
def register():
    """Handle user registration"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400
        
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        from models import User
        
        # Check if username or email exists
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            ip_address=request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR')),
            user_agent=request.headers.get('User-Agent')
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Log in the user
        session['user_id'] = user.id
        session['username'] = user.username
        
        app.logger.info(f"New user registered: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully!',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        })
        
    except Exception as e:
        app.logger.error(f"Registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to create account'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        from models import User
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Log in the user
        session['user_id'] = user.id
        session['username'] = user.username
        
        app.logger.info(f"User logged in: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful!',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        })
        
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/logout', methods=['POST'])
def logout():
    """Handle user logout"""
    username = session.get('username', 'Unknown')
    session.clear()
    app.logger.info(f"User logged out: {username}")
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    """Handle account deletion"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        username = user.username
        
        # Delete user's messages first (cascade should handle this, but let's be explicit)
        from models import ChatMessage
        ChatMessage.query.filter_by(user_id=user.id).delete()
        
        # Delete user
        db.session.delete(user)
        db.session.commit()
        
        # Clear session
        session.clear()
        
        app.logger.info(f"User account deleted: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Account deletion error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete account'}), 500

@app.route('/api/send_message', methods=['POST'])
@login_required
def send_message():
    """Handle incoming chat messages and provide responses"""
    try:
        # Get current user
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'error': 'Message cannot be empty'}), 400
        
        # Store user message in database
        from models import ChatMessage
        user_msg = ChatMessage(
            user_id=user.id,
            message_text=user_message,
            sender_type='user',
            message_type='text'
        )
        db.session.add(user_msg)
        
        # Professional chatbot responses based on context
        bot_responses = {
            'hello': 'Hello! I\'m your professional assistant. How can I help you today?',
            'hi': 'Good day! I\'m here to assist you with your professional needs.',
            'help': 'I\'m here to provide professional assistance. You can ask me about our services, get information, or request support.',
            'services': 'We offer comprehensive professional services including consulting, support, and customized solutions tailored to your business needs.',
            'pricing': 'Our pricing is competitive and tailored to your specific requirements. Would you like me to connect you with our sales team for a detailed quote?',
            'support': 'Our support team is available 24/7 to assist you. What specific issue can I help you resolve today?',
            'contact': 'You can reach our team through multiple channels. Would you prefer email, phone, or to schedule a meeting?',
            'about': 'We are a leading professional services company dedicated to delivering excellence and innovation to our clients worldwide.',
            'history': 'Let me show you your recent conversation history.',
            'clear': 'I understand you want to clear the chat. Your conversation history has been noted.',
            'default': 'Thank you for your message. I\'m processing your request and will provide you with the most relevant information shortly.'
        }
        
        # Simple keyword matching for demonstration
        response_key = 'default'
        user_message_lower = user_message.lower()
        
        for key in bot_responses.keys():
            if key in user_message_lower:
                response_key = key
                break
        
        start_time = time.time()
        bot_response = bot_responses[response_key]
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Store bot response in database
        bot_msg = ChatMessage(
            user_id=user.id,
            message_text=bot_response,
            sender_type='bot',
            message_type='text',
            response_time_ms=response_time_ms
        )
        db.session.add(bot_msg)
        db.session.commit()
        
        app.logger.info(f"Conversation: User {user.username} - User: '{user_message}' | Bot: '{bot_response[:50]}...'")
        
        return jsonify({
            'response': bot_response,
            'timestamp': datetime.now().isoformat(),
            'message_id': f"msg_{bot_msg.id}",
            'response_time_ms': response_time_ms
        })
        
    except Exception as e:
        app.logger.error(f"Error processing message: {str(e)}")
        return jsonify({'error': 'Failed to process message'}), 500

@app.route('/api/typing', methods=['POST'])
def typing_indicator():
    """Handle typing indicator requests"""
    return jsonify({'status': 'acknowledged', 'timestamp': datetime.now().isoformat()})

@app.route('/api/chat_history', methods=['GET'])
@login_required
def get_chat_history():
    """Get chat history for current user session"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        from models import ChatMessage
        messages = ChatMessage.query.filter_by(user_id=user.id)\
            .order_by(ChatMessage.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'messages': [msg.to_dict() for msg in messages.items],
            'total': messages.total,
            'page': page,
            'per_page': per_page,
            'has_next': messages.has_next,
            'has_prev': messages.has_prev
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching chat history: {str(e)}")
        return jsonify({'error': 'Failed to fetch chat history'}), 500

@app.route('/api/clear_chat', methods=['POST'])
@login_required
def clear_chat_history():
    """Clear chat history for current user session"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        from models import ChatMessage
        # Delete all messages for this user
        deleted_count = ChatMessage.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        
        app.logger.info(f"Cleared {deleted_count} messages for user {user.username}")
        
        return jsonify({
            'status': 'success',
            'cleared_messages': deleted_count,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Error clearing chat history: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to clear chat history'}), 500

@app.route('/api/export_chat', methods=['GET'])
@login_required
def export_chat_history():
    """Export chat history for current user session"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        from models import ChatMessage
        messages = ChatMessage.query.filter_by(user_id=user.id)\
            .order_by(ChatMessage.created_at.asc()).all()
        
        chat_data = {
            'username': user.username,
            'export_date': datetime.now().isoformat(),
            'total_messages': len(messages),
            'messages': [msg.to_dict() for msg in messages],
            'user_info': {
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat(),
                'last_active': user.last_active.isoformat()
            }
        }
        
        return jsonify(chat_data)
        
    except Exception as e:
        app.logger.error(f"Error exporting chat history: {str(e)}")
        return jsonify({'error': 'Failed to export chat history'}), 500

@app.route('/api/stats', methods=['GET'])
@login_required
def get_chat_stats():
    """Get chat statistics for current user session"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        from models import ChatMessage
        from sqlalchemy import func
        
        # Get message statistics
        total_messages = ChatMessage.query.filter_by(user_id=user.id).count()
        user_messages = ChatMessage.query.filter_by(user_id=user.id, sender_type='user').count()
        bot_messages = ChatMessage.query.filter_by(user_id=user.id, sender_type='bot').count()
        
        # Get average response time
        avg_response_time = db.session.query(func.avg(ChatMessage.response_time_ms))\
            .filter_by(user_id=user.id, sender_type='bot').scalar()
        
        # Get today's message count
        today = datetime.now().date()
        today_messages = ChatMessage.query.filter_by(user_id=user.id)\
            .filter(func.date(ChatMessage.created_at) == today).count()
        
        return jsonify({
            'total_messages': total_messages,
            'user_messages': user_messages,
            'bot_messages': bot_messages,
            'avg_response_time_ms': round(avg_response_time, 2) if avg_response_time else 0,
            'today_messages': today_messages,
            'session_duration_minutes': round((datetime.utcnow() - user.created_at).total_seconds() / 60, 2),
            'last_active': user.last_active.isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Error getting chat stats: {str(e)}")
        return jsonify({'error': 'Failed to get chat statistics'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
