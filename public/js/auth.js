// ========================================
// AUTHENTICATION SYSTEM (Telegram Login)
// ========================================

const AUTH_STORAGE_KEY = 'im_auth_session';

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

// Set session from Telegram auth data
function setSession(user) {
    const session = {
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        photo_url: user.photo_url,
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
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }

    if (requiredPage && !hasPermission(requiredPage)) {
        alert('You do not have permission to access this page.');
        window.location.href = '/';
        return false;
    }

    return true;
}

// Telegram Login callback (called by the widget)
async function onTelegramAuth(telegramUser) {
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) {
        statusEl.textContent = 'Signing in...';
        statusEl.className = 'login-status loading';
    }

    try {
        const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telegramUser)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        setSession(data.user);

        const redirect = new URLSearchParams(window.location.search).get('redirect') || '/admin.html';
        window.location.href = redirect;
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = error.message;
            statusEl.className = 'login-status error';
        }
    }
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

    const response = await fetch('/api/users', {
        headers: {
            'Authorization': 'Bearer ' + session.telegram_id
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
            'Authorization': 'Bearer ' + session.telegram_id
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
async function deleteUser(id) {
    const session = getSession();
    if (!session || session.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const response = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.telegram_id
        },
        body: JSON.stringify({ id })
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
window.onTelegramAuth = onTelegramAuth;
window.logout = logout;
window.getUsers = getUsers;
window.saveUser = saveUser;
window.deleteUser = deleteUser;
