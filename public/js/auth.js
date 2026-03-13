// ========================================
// AUTHENTICATION SYSTEM
// ========================================

const AUTH_STORAGE_KEY = 'im_auth_session';
const USERS_API_URL = '/api/users';

// Get current session
function getSession() {
    try {
        const sessionData = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!sessionData) return null;

        const session = JSON.parse(sessionData);

        // Check if session expired (24 hours)
        if (session.expires && Date.now() > session.expires) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
        }

        return session;
    } catch (e) {
        return null;
    }
}

// Set session
function setSession(user) {
    const session = {
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

// Clear session
function clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Check if user has permission for a page
function hasPermission(page) {
    const session = getSession();
    if (!session) return false;

    // Super admin has all permissions
    if (session.role === 'super_admin') return true;

    // Check specific permissions
    return session.permissions && session.permissions.includes(page);
}

// Require authentication for current page
function requireAuth(requiredPage) {
    const session = getSession();

    if (!session) {
        // Not logged in - redirect to login
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }

    if (requiredPage && !hasPermission(requiredPage)) {
        // No permission - redirect to main page
        alert('You do not have permission to access this page.');
        window.location.href = '/';
        return false;
    }

    return true;
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');

    // Reset error
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';

    // Disable button
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Save session
        setSession(data.user);

        // Redirect
        const redirect = new URLSearchParams(window.location.search).get('redirect') || '/admin.html';
        window.location.href = redirect;

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.add('show');

        // Re-enable button
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }

    return false;
}

// Logout
function logout() {
    clearSession();
    window.location.href = '/login.html';
}

// Get all users (for admin)
async function getUsers() {
    const session = getSession();
    if (!session || session.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const response = await fetch(USERS_API_URL, {
        headers: {
            'Authorization': 'Bearer ' + session.email
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch users');
    }

    return response.json();
}

// Save user (create or update)
async function saveUser(user) {
    const session = getSession();
    if (!session || session.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const response = await fetch('/api/users/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.email
        },
        body: JSON.stringify(user)
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save user');
    }

    return response.json();
}

// Delete user
async function deleteUser(email) {
    const session = getSession();
    if (!session || session.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const response = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.email
        },
        body: JSON.stringify({ email })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
    }

    return response.json();
}

// Make functions globally available
window.getSession = getSession;
window.setSession = setSession;
window.clearSession = clearSession;
window.hasPermission = hasPermission;
window.requireAuth = requireAuth;
window.handleLogin = handleLogin;
window.logout = logout;
window.getUsers = getUsers;
window.saveUser = saveUser;
window.deleteUser = deleteUser;
