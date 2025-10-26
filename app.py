from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from datetime import datetime
import os
import hashlib
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return render_template('index.html')

# Example API endpoint
@app.route('/api/test')
def test():
    return jsonify({"message": "Backend is working!"})

app = Flask(__name__)
CORS(app)

# Database Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'student_voting_system'
}

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# ==========================================
# STUDENT ROUTES
# ==========================================

@app.route('/api/student/login', methods=['POST'])
def student_login():
    """Student login endpoint - EMAIL BASED"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            return jsonify({'success': False, 'message': 'Missing credentials'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT student_id, full_name, email, password_hash, has_voted FROM students WHERE email = %s", (email,))
        student = cursor.fetchone()
        
        if not student or password != student['password_hash']:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, ip_address)
            VALUES (%s, 'student', 'LOGIN', %s)
        """, (student['student_id'], request.remote_addr))
        connection.commit()
        
        return jsonify({
            'success': True,
            'student': {
                'studentId': student['student_id'],
                'fullName': student['full_name'],
                'email': student['email'],
                'hasVoted': bool(student['has_voted'])
            }
        }), 200
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/student/vote', methods=['POST'])
def cast_vote():
    """Cast a vote endpoint WITH BLOCKCHAIN-LIKE HASHING"""
    try:
        data = request.json
        student_id = data.get('studentId')
        candidate_id = data.get('candidateId')
        if not student_id or not candidate_id:
            return jsonify({'success': False, 'message': 'Missing data'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("SELECT has_voted FROM students WHERE student_id = %s", (student_id,))
        student = cursor.fetchone()
        if student and student['has_voted']:
            return jsonify({'success': False, 'message': 'You have already voted'}), 400
        
        cursor.execute("SELECT is_active, is_paused FROM election_settings WHERE setting_id = (SELECT MAX(setting_id) FROM election_settings)")
        election = cursor.fetchone()
        if not election or not election['is_active'] or election['is_paused']:
            return jsonify({'success': False, 'message': 'Voting is not currently active'}), 400
        
        # --- BLOCKCHAIN LOGIC START ---
        cursor.execute("SELECT vote_hash FROM votes WHERE vote_id = (SELECT MAX(vote_id) FROM votes)")
        last_vote = cursor.fetchone()
        previous_hash = last_vote['vote_hash'] if last_vote else '0'
        vote_timestamp = datetime.utcnow().isoformat()
        block_data = f"{student_id}{candidate_id}{vote_timestamp}{previous_hash}"
        current_hash = hashlib.sha256(block_data.encode()).hexdigest()
        # --- BLOCKCHAIN LOGIC END ---

        cursor.execute("""
            INSERT INTO votes (student_id, candidate_id, ip_address, voted_at, vote_hash, previous_hash) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (student_id, candidate_id, request.remote_addr, vote_timestamp, current_hash, previous_hash))
        
        cursor.execute("UPDATE students SET has_voted = TRUE WHERE student_id = %s", (student_id,))
        cursor.execute("UPDATE candidates SET vote_count = vote_count + 1 WHERE candidate_id = %s", (candidate_id,))
        
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, description, ip_address)
            VALUES (%s, 'student', 'VOTE_CAST_CHAINED', %s, %s)
        """, (student_id, f'Voted for candidate {candidate_id}', request.remote_addr))
        
        connection.commit()
        return jsonify({'success': True, 'message': 'Vote cast successfully and secured in chain'}), 200
    except Exception as e:
        print(f"Vote error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': 'Failed to cast vote'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

# ==========================================
# ADMIN ROUTES
# ==========================================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({'success': False, 'message': 'Missing credentials'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT admin_id, username, full_name, email, password_hash FROM admins WHERE username = %s", (username,))
        admin = cursor.fetchone()
        
        if not admin or password != admin['password_hash']:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        
        cursor.execute("UPDATE admins SET last_login = NOW() WHERE admin_id = %s", (admin['admin_id'],))
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, ip_address)
            VALUES (%s, 'admin', 'LOGIN', %s)
        """, (username, request.remote_addr))
        
        connection.commit()
        return jsonify({
            'success': True,
            'admin': {
                'username': admin['username'],
                'fullName': admin['full_name'],
                'email': admin['email']
            }
        }), 200
    except Exception as e:
        print(f"Admin login error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/students', methods=['GET'])
def get_all_students():
    """Get all students for admin"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT student_id, full_name, email, department, year_of_study, has_voted 
            FROM students 
            WHERE student_id != 'SYSTEM'
            ORDER BY student_id
        """)
        students = cursor.fetchall()
        
        return jsonify({'success': True, 'students': students}), 200
    except Exception as e:
        print(f"Get students error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/candidates-list', methods=['GET'])
def get_all_candidates():
    """Get all candidates for admin"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT candidate_id, student_id, full_name, tagline, vote_count, is_active 
            FROM candidates 
            WHERE candidate_id != 0
            ORDER BY candidate_id
        """)
        candidates = cursor.fetchall()
        
        return jsonify({'success': True, 'candidates': candidates}), 200
    except Exception as e:
        print(f"Get candidates error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
            
@app.route('/api/admin/add-student', methods=['POST'])
def add_student():
    """Admin endpoint to add a new student"""
    try:
        data = request.json
        full_name = data.get('fullName')
        email = data.get('email')
        department = data.get('department')
        year = data.get('year')
        
        if not all([full_name, email, department, year]):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400

        connection = get_db_connection()
        if not connection: return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT student_id FROM students WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'A student with this email already exists'}), 409

        cursor.execute("SELECT COUNT(*) as count FROM students")
        student_count = cursor.fetchone()['count']
        new_student_id = f"S{student_count + 1:03d}"
        
        temp_password = "password123"
        cursor.execute("""
            INSERT INTO students (student_id, full_name, email, password_hash, department, year_of_study)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (new_student_id, full_name, email, temp_password, department, year))
        
        connection.commit()
        return jsonify({'success': True, 'message': f"Student '{full_name}' added successfully."}), 201
    except Exception as e:
        print(f"Add student error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/remove-student', methods=['POST'])
def remove_student():
    """Admin endpoint to remove a student"""
    try:
        data = request.json
        student_id = data.get('studentId')
        
        if not student_id:
            return jsonify({'success': False, 'message': 'Student ID is required'}), 400
        
        if student_id == 'SYSTEM':
            return jsonify({'success': False, 'message': 'Cannot remove system student'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if student exists
        cursor.execute("SELECT full_name FROM students WHERE student_id = %s", (student_id,))
        student = cursor.fetchone()
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Check if student is a candidate
        cursor.execute("SELECT candidate_id FROM candidates WHERE student_id = %s", (student_id,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Cannot remove student who is a candidate. Remove from candidates first.'}), 400
        
        # Delete student (CASCADE will handle votes and audit logs)
        cursor.execute("DELETE FROM students WHERE student_id = %s", (student_id,))
        
        connection.commit()
        return jsonify({'success': True, 'message': f"Student '{student['full_name']}' removed successfully."}), 200
    except Exception as e:
        print(f"Remove student error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/add-candidate', methods=['POST'])
def add_candidate():
    """Admin endpoint to add a new candidate"""
    try:
        data = request.json
        email = data.get('email')
        tagline = data.get('tagline')
        if not email or not tagline:
            return jsonify({'success': False, 'message': 'Email and tagline are required'}), 400

        connection = get_db_connection()
        if not connection: return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT student_id, full_name FROM students WHERE email = %s", (email,))
        student = cursor.fetchone()
        if not student:
            return jsonify({'success': False, 'message': 'No student found with this email.'}), 404

        student_id = student['student_id']
        cursor.execute("SELECT candidate_id FROM candidates WHERE student_id = %s", (student_id,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'This student is already a candidate.'}), 409

        cursor.execute("""
            INSERT INTO candidates (student_id, full_name, tagline, manifesto)
            VALUES (%s, %s, %s, %s)
        """, (student_id, student['full_name'], tagline, "Manifesto to be updated."))
        
        connection.commit()
        return jsonify({'success': True, 'message': f"Candidate '{student['full_name']}' added successfully."}), 201
    except Exception as e:
        print(f"Add candidate error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/remove-candidate', methods=['POST'])
def remove_candidate():
    """Admin endpoint to remove a candidate"""
    try:
        data = request.json
        candidate_id = data.get('candidateId')
        
        if not candidate_id:
            return jsonify({'success': False, 'message': 'Candidate ID is required'}), 400
        
        if candidate_id == 0:
            return jsonify({'success': False, 'message': 'Cannot remove system candidate'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if candidate exists
        cursor.execute("SELECT full_name, vote_count FROM candidates WHERE candidate_id = %s", (candidate_id,))
        candidate = cursor.fetchone()
        if not candidate:
            return jsonify({'success': False, 'message': 'Candidate not found'}), 404
        
        # Check if candidate has votes
        if candidate['vote_count'] > 0:
            return jsonify({'success': False, 'message': f"Cannot remove candidate '{candidate['full_name']}' who has {candidate['vote_count']} votes. Reset election first."}), 400
        
        # Delete candidate
        cursor.execute("DELETE FROM candidates WHERE candidate_id = %s", (candidate_id,))
        
        connection.commit()
        return jsonify({'success': True, 'message': f"Candidate '{candidate['full_name']}' removed successfully."}), 200
    except Exception as e:
        print(f"Remove candidate error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
            
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    """Get real-time voting statistics"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT c.candidate_id, c.full_name, c.vote_count,
            ROUND((c.vote_count * 100.0 / NULLIF((SELECT SUM(vote_count) FROM candidates WHERE is_active = TRUE), 0)), 2) AS vote_percentage
            FROM candidates c WHERE c.is_active = TRUE ORDER BY c.vote_count DESC
        """)
        candidates = cursor.fetchall()
        cursor.execute("SELECT COUNT(DISTINCT student_id) AS total_students FROM students WHERE student_id != 'SYSTEM'")
        stats_total = cursor.fetchone()
        cursor.execute("SELECT COUNT(DISTINCT student_id) AS total_voted FROM votes WHERE vote_id != 0")
        stats_voted = cursor.fetchone()
        
        turnout = 0
        if stats_total['total_students'] > 0:
            turnout = round((stats_voted['total_voted'] / stats_total['total_students']) * 100, 1)

        cursor.execute("SELECT is_active, is_paused, results_published FROM election_settings WHERE setting_id = (SELECT MAX(setting_id) FROM election_settings)")
        election = cursor.fetchone()
        
        return jsonify({
            'success': True, 'candidates': candidates,
            'statistics': {
                'totalStudents': stats_total['total_students'], 'totalVoted': stats_voted['total_voted'],
                'totalVotes': stats_voted['total_voted'], 'turnout': turnout
            },
            'election': {
                'isActive': bool(election['is_active']), 'isPaused': bool(election['is_paused']),
                'resultsPublished': bool(election['results_published'])
            }
        }), 200
    except Exception as e:
        print(f"Stats error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/terminate-election', methods=['POST'])
def terminate_election():
    """Terminate election"""
    try:
        data = request.json
        admin_username = data.get('username')
        if not admin_username: return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("""
            UPDATE election_settings 
            SET is_active = FALSE, results_published = TRUE 
            WHERE setting_id = (SELECT * FROM (SELECT MAX(setting_id) FROM election_settings) AS temp)
        """)
        
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, description)
            VALUES (%s, 'admin', 'ELECTION_TERMINATED', 'Election terminated')
        """, (admin_username,))
        connection.commit()
        return jsonify({'success': True, 'message': 'Election terminated successfully'}), 200
    except Exception as e:
        print(f"Terminate error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/pause-election', methods=['POST'])
def pause_election():
    """Pause/Resume election"""
    try:
        data = request.json
        admin_username = data.get('username')
        pause = data.get('pause', True)
        if not admin_username: return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("""
            UPDATE election_settings 
            SET is_paused = %s 
            WHERE setting_id = (SELECT * FROM (SELECT MAX(setting_id) FROM election_settings) AS temp)
        """, (pause,))
        
        action = 'ELECTION_PAUSED' if pause else 'ELECTION_RESUMED'
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, description)
            VALUES (%s, 'admin', %s, 'Election status changed')
        """, (admin_username, action))
        connection.commit()
        return jsonify({'success': True, 'message': f"Election {'paused' if pause else 'resumed'} successfully", 'isPaused': pause}), 200
    except Exception as e:
        print(f"Pause error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/admin/reset-election', methods=['POST'])
def reset_election():
    """Admin endpoint to reset all votes and statuses"""
    try:
        data = request.json
        admin_username = data.get('username')
        if not admin_username:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("DELETE FROM votes WHERE vote_id != 0")
        cursor.execute("UPDATE students SET has_voted = FALSE WHERE student_id != 'SYSTEM'")
        cursor.execute("UPDATE candidates SET vote_count = 0 WHERE candidate_id != 0")
        
        cursor.execute("""
            UPDATE election_settings 
            SET is_active = TRUE, is_paused = FALSE, results_published = FALSE
            WHERE setting_id = (SELECT * FROM (SELECT MAX(setting_id) FROM election_settings) AS temp)
        """)
        
        cursor.execute("""
            INSERT INTO audit_log (user_id, user_type, action, description, ip_address)
            VALUES (%s, 'admin', 'ELECTION_RESET', 'All votes and statuses have been reset', %s)
        """, (admin_username, request.remote_addr))

        connection.commit()
        return jsonify({'success': True, 'message': 'Election has been reset successfully. All votes are cleared and election is now active.'}), 200
    except Exception as e:
        print(f"Reset error: {e}")
        if 'connection' in locals():
            connection.rollback()
        return jsonify({'success': False, 'message': f'Server error during election reset: {str(e)}'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

# ==========================================
# PUBLIC ROUTES
# ==========================================

@app.route('/api/candidates', methods=['GET'])
def get_candidates():
    """Get all active candidates"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT candidate_id, student_id, full_name, tagline FROM candidates WHERE is_active = TRUE ORDER BY full_name")
        candidates = cursor.fetchall()
        return jsonify({'success': True, 'candidates': candidates}), 200
    except Exception as e:
        print(f"Candidates error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/results', methods=['GET'])
def get_results():
    """Get election results"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT is_active, results_published FROM election_settings WHERE setting_id = (SELECT MAX(setting_id) FROM election_settings)")
        election = cursor.fetchone()
        
        if not election or (election['is_active'] and not election['results_published']):
            return jsonify({'success': False,'message': 'Results not yet available'}), 403
        
        cursor.execute("""
            SELECT candidate_id, full_name, vote_count,
                   ROUND((vote_count * 100.0 / NULLIF((SELECT SUM(vote_count) FROM candidates WHERE is_active = TRUE), 0)), 2) AS vote_percentage
            FROM candidates WHERE is_active = TRUE ORDER BY vote_count DESC
        """)
        results = cursor.fetchall()
        cursor.execute("SELECT COUNT(DISTINCT student_id) AS total_voted FROM votes WHERE vote_id != 0")
        stats = cursor.fetchone()
        
        return jsonify({'success': True, 'results': results, 'statistics': stats}), 200
    except Exception as e:
        print(f"Results error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/election-status', methods=['GET'])
def get_election_status():
    """Get current election status"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT election_name, is_active, is_paused FROM election_settings WHERE setting_id = (SELECT MAX(setting_id) FROM election_settings)")
        election = cursor.fetchone()
        if not election:
            return jsonify({'success': False, 'message': 'No election found'}), 404
        
        return jsonify({
            'success': True,
            'election': {
                'name': election['election_name'], 'isActive': bool(election['is_active']),
                'isPaused': bool(election['is_paused'])
            }
        }), 200
    except Exception as e:
        print(f"Status error: {e}")
        return jsonify({'success': False, 'message': 'Server error'}), 500
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

