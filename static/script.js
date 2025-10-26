// Backend API URL
const API_URL = 'http://localhost:5001/api';

// Auto-refresh interval for admin stats (in milliseconds)
const ADMIN_REFRESH_INTERVAL = 3000; // 3 seconds
let adminStatsInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let electionIsActive = true;
    let electionIsPaused = false;
    let isAuthenticated = false;
    let userHasVoted = false;
    let currentUser = null;
    let isAdmin = false;
    let studentToRemove = null;
    let candidateToRemove = null;

    // --- Element Getters ---
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const navLogin = document.getElementById('nav-login');
    const navVote = document.getElementById('nav-vote');
    const navResults = document.getElementById('nav-results');
    const navAdmin = document.getElementById('nav-admin');
    const navLogout = document.getElementById('nav-logout');
    const loginForm = document.getElementById('loginForm');
    const adminLoginLink = document.getElementById('adminLoginLink');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const studentLoginLink = document.getElementById('studentLoginLink');
    const voteForm = document.getElementById('voteForm');
    const voteActive = document.getElementById('voteActive');
    const voteCasted = document.getElementById('voteCasted');
    const seeResultsButton = document.getElementById('seeResultsButton');
    const voteError = document.getElementById('voteError');
    const seeFinalResultsButton = document.getElementById('seeFinalResultsButton');
    const terminateElectionButton = document.getElementById('terminateElectionButton');
    const pauseVotingButton = document.getElementById('pauseVotingButton');
    const resetElectionButton = document.getElementById('resetElectionButton');
    const electionStatusText = document.getElementById('electionStatusText');
    const terminateModal = document.getElementById('terminateModal');
    const cancelTerminateButton = document.getElementById('cancelTerminateButton');
    const confirmTerminateButton = document.getElementById('confirmTerminateButton');
    const resetModal = document.getElementById('resetModal');
    const cancelResetButton = document.getElementById('cancelResetButton');
    const confirmResetButton = document.getElementById('confirmResetButton');
    const addStudentForm = document.getElementById('addStudentForm');
    const addCandidateForm = document.getElementById('addCandidateForm');
    
    // Management elements
    const refreshStudents = document.getElementById('refreshStudents');
    const refreshCandidates = document.getElementById('refreshCandidates');
    const removeStudentModal = document.getElementById('removeStudentModal');
    const cancelRemoveStudent = document.getElementById('cancelRemoveStudent');
    const confirmRemoveStudent = document.getElementById('confirmRemoveStudent');
    const removeCandidateModal = document.getElementById('removeCandidateModal');
    const cancelRemoveCandidate = document.getElementById('cancelRemoveCandidate');
    const confirmRemoveCandidate = document.getElementById('confirmRemoveCandidate');

    // --- Fetch Election Status ---
    async function fetchElectionStatus() {
        try {
            const response = await fetch(`${API_URL}/election-status`);
            const data = await response.json();
            if (data.success) {
                electionIsActive = data.election.isActive;
                electionIsPaused = data.election.isPaused;
            }
        } catch (error) {
            console.error('Failed to fetch election status:', error);
        }
    }

    // --- Load Candidates Dynamically ---
    async function loadCandidates() {
        try {
            const response = await fetch(`${API_URL}/candidates`);
            const data = await response.json();
            if (data.success && data.candidates.length > 0) {
                const candidatesList = document.getElementById('candidatesList');
                candidatesList.innerHTML = '';
                data.candidates.forEach(candidate => {
                    if (candidate.student_id === 'SYSTEM') return;
                    const candidateHTML = `
                        <label for="candidate${candidate.candidate_id}" class="candidate-option flex items-center p-6 rounded-lg cursor-pointer">
                            <input type="radio" id="candidate${candidate.candidate_id}" name="candidate" value="${candidate.candidate_id}" class="h-6 w-6 text-[#00FFFF] focus:ring-0 rounded-full border-gray-500 bg-gray-700">
                            <div class="ml-6 flex-grow">
                                <span class="text-2xl font-semibold text-gray-200 block">${candidate.full_name}</span>
                                <p class="text-gray-400 text-lg mt-1">"${candidate.tagline}"</p>
                            </div>
                            <img src="https://placehold.co/90x90/00FFFF/1A1A2E?text=${candidate.full_name.split(' ').map(n => n[0]).join('')}" alt="${candidate.full_name}" class="h-24 w-24 rounded-full object-cover ml-6 border-2 border-[#00FFFF] p-1">
                        </label>
                    `;
                    candidatesList.innerHTML += candidateHTML;
                });
            }
        } catch (error) {
            console.error('Failed to load candidates:', error);
        }
    }

    // --- Load Students List for Management ---
    async function loadStudentsList() {
        try {
            const response = await fetch(`${API_URL}/admin/students`);
            const data = await response.json();
            const studentsList = document.getElementById('studentsList');
            
            if (data.success && data.students.length > 0) {
                studentsList.innerHTML = '';
                data.students.forEach(student => {
                    const studentItem = `
                        <div class="bg-[#1A1A2E] p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                            <div class="flex-grow">
                                <p class="text-gray-200 font-semibold">${student.full_name}</p>
                                <p class="text-gray-400 text-sm">${student.student_id} • ${student.email}</p>
                                <p class="text-gray-500 text-xs mt-1">${student.department} - Year ${student.year_of_study} ${student.has_voted ? '• ✓ Voted' : ''}</p>
                            </div>
                            <button class="btn-danger py-2 px-4 rounded text-sm remove-student-btn" data-id="${student.student_id}" data-name="${student.full_name}">Remove</button>
                        </div>
                    `;
                    studentsList.innerHTML += studentItem;
                });
                
                // Attach event listeners to remove buttons
                document.querySelectorAll('.remove-student-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log('Remove student button clicked', e.target.dataset); // Debug
                        studentToRemove = {
                            id: e.target.dataset.id,
                            name: e.target.dataset.name
                        };
                        console.log('Student to remove:', studentToRemove); // Debug
                        document.getElementById('removeStudentName').textContent = studentToRemove.name;
                        removeStudentModal.style.display = 'flex';
                        removeStudentModal.classList.remove('hidden');
                    });
                });
            } else {
                studentsList.innerHTML = '<p class="text-gray-400 text-center py-4">No students found.</p>';
            }
        } catch (error) {
            console.error('Failed to load students:', error);
            document.getElementById('studentsList').innerHTML = '<p class="text-red-400 text-center py-4">Error loading students</p>';
        }
    }

    // --- Load Candidates List for Management ---
    async function loadCandidatesManageList() {
        try {
            const response = await fetch(`${API_URL}/admin/candidates-list`);
            const data = await response.json();
            const candidatesList = document.getElementById('candidatesListManage');
            
            if (data.success && data.candidates.length > 0) {
                candidatesList.innerHTML = '';
                data.candidates.forEach(candidate => {
                    const candidateItem = `
                        <div class="bg-[#1A1A2E] p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                            <div class="flex-grow">
                                <p class="text-gray-200 font-semibold">${candidate.full_name}</p>
                                <p class="text-gray-400 text-sm">${candidate.student_id} • ${candidate.vote_count} votes</p>
                                <p class="text-gray-500 text-xs mt-1 italic">"${candidate.tagline}"</p>
                            </div>
                            <button class="btn-danger py-2 px-4 rounded text-sm remove-candidate-btn" data-id="${candidate.candidate_id}" data-name="${candidate.full_name}">Remove</button>
                        </div>
                    `;
                    candidatesList.innerHTML += candidateItem;
                });
                
                // Attach event listeners to remove buttons
                document.querySelectorAll('.remove-candidate-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log('Remove candidate button clicked', e.target.dataset); // Debug
                        candidateToRemove = {
                            id: e.target.dataset.id,
                            name: e.target.dataset.name
                        };
                        console.log('Candidate to remove:', candidateToRemove); // Debug
                        document.getElementById('removeCandidateName').textContent = candidateToRemove.name;
                        removeCandidateModal.style.display = 'flex';
                        removeCandidateModal.classList.remove('hidden');
                    });
                });
            } else {
                candidatesList.innerHTML = '<p class="text-gray-400 text-center py-4">No candidates found.</p>';
            }
        } catch (error) {
            console.error('Failed to load candidates:', error);
            document.getElementById('candidatesListManage').innerHTML = '<p class="text-red-400 text-center py-4">Error loading candidates</p>';
        }
    }

    // --- Fetch Real-time Admin Stats ---
    async function fetchAdminStats() {
        if (!isAdmin) return;
        try {
            const response = await fetch(`${API_URL}/admin/stats`);
            const data = await response.json();
            if (data.success) {
                updateAdminDashboard(data);
            }
        } catch (error) {
            console.error('Failed to fetch admin stats:', error);
        }
    }

    // --- Fetch and Display Final Results ---
    async function loadResults() {
        try {
            const response = await fetch(`${API_URL}/results`);
            const data = await response.json();
            if (data.success) {
                const resultsContainer = document.getElementById('resultsContainer');
                const totalVotesDisplay = document.getElementById('totalVotesDisplay');
                resultsContainer.innerHTML = '';
                if (data.results.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-gray-400 text-center">No votes have been cast yet.</p>';
                    return;
                }
                data.results.forEach(candidate => {
                    if (candidate.candidate_id === 0) return;
                    const percentage = candidate.vote_percentage || 0;
                    const resultHTML = `
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-2xl font-semibold text-gray-200">${candidate.full_name}</span>
                                <span class="text-xl font-bold text-[#00FFFF]">${candidate.vote_count} votes (${percentage}%)</span>
                            </div>
                            <div class="w-full progress-bar-bg rounded-full h-5 overflow-hidden">
                                <div class="progress-bar-fill h-5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                    resultsContainer.innerHTML += resultHTML;
                });
                totalVotesDisplay.textContent = data.statistics.total_voted || 0;
            }
        } catch (error) {
            console.error('Error fetching results:', error);
        }
    }

    // --- Update Admin Dashboard ---
    function updateAdminDashboard(data) {
        const { candidates, statistics, election } = data;
        electionIsActive = election.isActive;
        electionIsPaused = election.isPaused;
        if (electionStatusText) {
            if (!electionIsActive) {
                electionStatusText.textContent = 'INACTIVE (TERMINATED)';
                electionStatusText.className = 'font-bold text-[#FF4500]';
            } else if (electionIsPaused) {
                electionStatusText.textContent = 'ACTIVE (PAUSED)';
                electionStatusText.className = 'font-bold text-[#FFA500]';
            } else {
                electionStatusText.textContent = 'ACTIVE';
                electionStatusText.className = 'font-bold text-[#00FFFF]';
            }
        }
        if (pauseVotingButton) {
            pauseVotingButton.textContent = electionIsPaused ? 'RESUME' : 'PAUSE';
            pauseVotingButton.disabled = !electionIsActive;
        }
        if (terminateElectionButton) {
            terminateElectionButton.disabled = !electionIsActive;
        }
        if (resetElectionButton) {
            resetElectionButton.disabled = false;
        }
        document.getElementById('adminTotalVotes').textContent = statistics.totalVotes;
        document.getElementById('adminTotalStudents').textContent = statistics.totalStudents;
        document.getElementById('adminTurnout').textContent = statistics.turnout + '%';
        const statsContainer = document.getElementById('adminStatsContainer');
        statsContainer.innerHTML = '<div class="space-y-6">';
        candidates.forEach(candidate => {
            if (candidate.candidate_id === 0) return;
            const percentage = candidate.vote_percentage || 0;
            statsContainer.innerHTML += `
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xl font-semibold text-gray-200">${candidate.full_name}</span>
                        <span class="text-lg font-bold text-[#00FFFF]">${candidate.vote_count} votes (${percentage}%)</span>
                    </div>
                    <div class="w-full progress-bar-bg rounded-full h-4 overflow-hidden">
                        <div class="progress-bar-fill h-4 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
        statsContainer.innerHTML += '</div>';
    }

    // --- Auth UI Logic ---
    function updateAuthUI() {
        if (isAuthenticated) {
            navLogin.classList.add('hidden');
            navAdmin.classList.add('hidden');
            navLogout.classList.remove('hidden');

            if (isAdmin) {
                navVote.classList.add('hidden');
                navResults.classList.add('hidden');
            } else {
                navVote.classList.remove('hidden');
                navResults.classList.remove('hidden');
            }
        } else {
            navLogin.classList.remove('hidden');
            navAdmin.classList.remove('hidden');
            navLogout.classList.add('hidden');
            navVote.classList.add('hidden');
            navResults.classList.add('hidden');
        }
    }

    // --- View Switching Logic ---
    function showView(viewId) {
        views.forEach(view => {
            view.style.display = 'none';
        });
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.style.display = 'block';
        }
        navLinks.forEach(link => link.classList.remove('active'));
        let activeNavLink;
        if (viewId === 'loginView' || viewId === 'adminLoginView') activeNavLink = navLogin;
        else if (viewId === 'votingView' || viewId === 'voteEndedView') activeNavLink = navVote;
        else if (viewId === 'resultsView' || viewId === 'resultsPendingView') activeNavLink = navResults;
        else if (viewId === 'adminView') activeNavLink = navAdmin;
        if (activeNavLink) activeNavLink.classList.add('active');
        if (viewId === 'adminView' && isAdmin) {
            fetchAdminStats();
            loadStudentsList();
            loadCandidatesManageList();
            if (!adminStatsInterval) adminStatsInterval = setInterval(fetchAdminStats, ADMIN_REFRESH_INTERVAL);
        } else {
            if (adminStatsInterval) {
                clearInterval(adminStatsInterval);
                adminStatsInterval = null;
            }
        }
    }

    // --- Event Listeners ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (link.id === 'nav-logout') {
                isAuthenticated = false; userHasVoted = false; currentUser = null; isAdmin = false;
                updateAuthUI(); showView('loginView'); return;
            }
            if (link.id === 'nav-vote') {
                if (!isAuthenticated) { showView('loginView'); return; }
                if (electionIsActive) {
                    if (userHasVoted) {
                        voteActive.style.display = 'none';
                        voteCasted.style.display = 'block';
                    } else {
                        voteActive.style.display = 'block';
                        voteCasted.style.display = 'none';
                    }
                    showView('votingView');
                } else { showView('voteEndedView'); }
                return;
            }
            if (link.id === 'nav-results') {
                if (!isAuthenticated) { showView('loginView'); return; }
                if (electionIsActive) {
                    showView('resultsPendingView');
                } else {
                    loadResults();
                    showView('resultsView');
                }
                return;
            }
            if (link.id === 'nav-admin') { showView('adminLoginView'); return; }
            if (link.id === 'nav-login') { showView('loginView'); return; }
        });
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('studentEmail').value;
            const password = document.getElementById('password').value;
            try {
                const response = await fetch(`${API_URL}/student/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (data.success) {
                    isAuthenticated = true; userHasVoted = data.student.hasVoted; currentUser = data.student; isAdmin = false;
                    updateAuthUI(); await loadCandidates();
                    if (electionIsActive) {
                        if (userHasVoted) {
                            voteActive.style.display = 'none';
                            voteCasted.style.display = 'block';
                        } else {
                            voteActive.style.display = 'block';
                            voteCasted.style.display = 'none';
                        }
                        showView('votingView');
                    } else { showView('voteEndedView'); }
                } else { alert(data.message || 'Login failed.'); }
            } catch (error) { alert('Failed to connect to server.'); }
        });
    }

    if (adminLoginLink) adminLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('adminLoginView'); });
    if (studentLoginLink) studentLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('loginView'); });
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;
            try {
                const response = await fetch(`${API_URL}/admin/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (data.success) {
                    isAuthenticated = true; currentUser = data.admin; isAdmin = true;
                    updateAuthUI(); showView('adminView');
                } else { alert(data.message || 'Admin login failed.'); }
            } catch (error) { alert('Failed to connect to server.'); }
        });
    }

    if (voteForm) {
        voteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedCandidate = document.querySelector('input[name="candidate"]:checked');
            voteError.textContent = '';
            if (!selectedCandidate) { voteError.textContent = 'Please select a candidate.'; return; }
            const candidateId = selectedCandidate.value;
            try {
                const response = await fetch(`${API_URL}/student/vote`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: currentUser.studentId, candidateId: parseInt(candidateId) })
                });
                const data = await response.json();
                if (data.success) {
                    userHasVoted = true;
                    voteActive.style.display = 'none';
                    voteCasted.style.display = 'block';
                } else { voteError.textContent = data.message || 'Failed to cast vote.'; }
            } catch (error) { voteError.textContent = 'Failed to connect to server.'; }
        });
    }

    if (seeResultsButton) {
        seeResultsButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (electionIsActive) showView('resultsPendingView');
            else { loadResults(); showView('resultsView'); }
        });
    }

    if (seeFinalResultsButton) {
        seeFinalResultsButton.addEventListener('click', (e) => {
            e.preventDefault();
            loadResults();
            showView('resultsView');
        });
    }

    // --- Admin Panel Logic ---
    if (pauseVotingButton) {
        pauseVotingButton.addEventListener('click', async (e) => {
            e.preventDefault(); if (!electionIsActive) return;
            const shouldPause = !electionIsPaused;
            try {
                const response = await fetch(`${API_URL}/admin/pause-election`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser.username, pause: shouldPause })
                });
                const data = await response.json();
                if (data.success) {
                    electionIsPaused = data.isPaused;
                    fetchAdminStats(); alert(data.message);
                } else { alert(data.message || 'Failed to change status.'); }
            } catch (error) { alert('Failed to connect to server.'); }
        });
    }

    if (terminateElectionButton) {
        terminateElectionButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (terminateModal) {
                terminateModal.style.display = 'flex';
                terminateModal.classList.remove('hidden');
            }
        });
    }

    if (cancelTerminateButton) {
        cancelTerminateButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (terminateModal) terminateModal.style.display = 'none';
        });
    }
    
    if (confirmTerminateButton) {
        confirmTerminateButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch(`${API_URL}/admin/terminate-election`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser.username })
                });
                const data = await response.json();
                if (data.success) {
                    electionIsActive = false;
                    fetchAdminStats(); alert('Election has been terminated!');
                } else { alert(data.message || 'Failed to terminate election.'); }
            } catch (error) { alert('Failed to connect to server.'); }
            if (terminateModal) terminateModal.style.display = 'none';
        });
    }
    
    // --- Admin: Reset Logic ---
    if (resetElectionButton) {
        resetElectionButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetModal) {
                resetModal.style.display = 'flex';
                resetModal.classList.remove('hidden');
            }
        });
    }
    
    if (cancelResetButton) {
        cancelResetButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetModal) resetModal.style.display = 'none';
        });
    }
    
    if (confirmResetButton) {
        confirmResetButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUser.username) {
                alert('User session error. Please log in again.');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/admin/reset-election`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser.username })
                });
                const data = await response.json();
                alert(data.message);
                if (data.success) {
                    await fetchElectionStatus();
                    await fetchAdminStats();
                    await loadStudentsList();
                    await loadCandidatesManageList();
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            } finally {
                if (resetModal) resetModal.style.display = 'none';
            }
        });
    }

    // --- Admin: Add New Student ---
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentData = {
                fullName: document.getElementById('newStudentName').value,
                email: document.getElementById('newStudentEmail').value,
                department: document.getElementById('newStudentDept').value,
                year: parseInt(document.getElementById('newStudentYear').value)
            };
            try {
                const response = await fetch(`${API_URL}/admin/add-student`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(studentData)
                });
                const data = await response.json();
                alert(data.message);
                if (data.success) {
                    addStudentForm.reset();
                    loadStudentsList();
                    fetchAdminStats();
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            }
        });
    }

    // --- Admin: Add New Candidate ---
    if (addCandidateForm) {
        addCandidateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const candidateData = {
                email: document.getElementById('newCandidateEmail').value,
                tagline: document.getElementById('newCandidateTagline').value
            };
            try {
                const response = await fetch(`${API_URL}/admin/add-candidate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(candidateData)
                });
                const data = await response.json();
                alert(data.message);
                if (data.success) {
                    addCandidateForm.reset();
                    loadCandidatesManageList();
                    fetchAdminStats();
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            }
        });
    }

    // --- Admin: Remove Student Logic ---
    if (cancelRemoveStudent) {
        cancelRemoveStudent.addEventListener('click', (e) => {
            e.preventDefault();
            removeStudentModal.style.display = 'none';
            studentToRemove = null;
        });
    }

    if (confirmRemoveStudent) {
        confirmRemoveStudent.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!studentToRemove) return;
            
            try {
                const response = await fetch(`${API_URL}/admin/remove-student`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: studentToRemove.id })
                });
                const data = await response.json();
                alert(data.message);
                if (data.success) {
                    loadStudentsList();
                    fetchAdminStats();
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            } finally {
                removeStudentModal.style.display = 'none';
                studentToRemove = null;
            }
        });
    }

    // --- Admin: Remove Candidate Logic ---
    if (cancelRemoveCandidate) {
        cancelRemoveCandidate.addEventListener('click', (e) => {
            e.preventDefault();
            removeCandidateModal.style.display = 'none';
            candidateToRemove = null;
        });
    }

    if (confirmRemoveCandidate) {
        confirmRemoveCandidate.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!candidateToRemove) return;
            
            try {
                const response = await fetch(`${API_URL}/admin/remove-candidate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ candidateId: candidateToRemove.id })
                });
                const data = await response.json();
                alert(data.message);
                if (data.success) {
                    loadCandidatesManageList();
                    fetchAdminStats();
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            } finally {
                removeCandidateModal.style.display = 'none';
                candidateToRemove = null;
            }
        });
    }

    // --- Admin: Refresh Buttons ---
    if (refreshStudents) {
        refreshStudents.addEventListener('click', (e) => {
            e.preventDefault();
            loadStudentsList();
        });
    }

    if (refreshCandidates) {
        refreshCandidates.addEventListener('click', (e) => {
            e.preventDefault();
            loadCandidatesManageList();
        });
    }

    // --- Initial State ---
    fetchElectionStatus();
    showView('loginView');
    updateAuthUI();
});