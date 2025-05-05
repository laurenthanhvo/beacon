from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
# app.secret_key = 'supersecretkey'
import os
app.secret_key = os.getenv("SECRET_KEY", "fallback‑dev‑key")
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

ACCESS_CODES = {
    '1234': 'client',
    '4321': 'staff'
}

messages = []
deleted_by_client = set()
last_location = None
last_checkin_time = None

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        code = request.form.get('access_code')
        role = ACCESS_CODES.get(code)
        if role:
            session['role'] = role
            return redirect(url_for('dashboard'))
        return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'role' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', role=session['role'])

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/resources')
def resources():
    return jsonify({
        'resources': [
            {"name": "Father Joe's Villages", "url": "https://my.neighbor.org/"},
            {"name": "211 San Diego", "url": "https://211sandiego.org/"}
        ]
    })

@app.route('/chat_history')
def chat_history():
    role = session.get('role')
    if role == 'client':
        visible_messages = [m for i, m in enumerate(messages) if i not in deleted_by_client]
        return jsonify(visible_messages)
    return jsonify(messages)

@app.route('/get_location')
def get_location():
    return jsonify(last_location)

@socketio.on('send_message')
def handle_message(data):
    messages.append(data)
    emit('receive_message', {**data, 'index': len(messages)-1}, broadcast=True)

@socketio.on('delete_message')
def handle_delete(data):
    index = data.get('index')
    if session.get('role') == 'client' and index is not None:
        deleted_by_client.add(index)

@socketio.on('send_location')
def handle_location(data):
    global last_location, last_checkin_time
    last_location = data
    last_checkin_time = datetime.now().strftime('%B %d, %Y at %I:%M %p')
    emit('receive_location', {'coords': data, 'timestamp': last_checkin_time}, broadcast=True)

@socketio.on('delete_pin')
def delete_pin():
    global last_location, last_checkin_time
    last_location = None
    last_checkin_time = None
    emit('clear_location', broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5050)
