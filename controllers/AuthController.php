<?php
/**
 * Loren Eatery POS - Auth Controller
 * Handles admin login/logout/session
 */

class AuthController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function handle(string $action, string $method): void {
        switch ($action) {
            case 'login':
                if ($method === 'POST') $this->login();
                else sendError('Method not allowed', 405);
                break;
            case 'logout':
                $this->logout();
                break;
            case 'check':
                $this->checkSession();
                break;
            default:
                sendError('Unknown auth action', 404);
        }
    }

    private function login(): void {
        $body = getRequestBody();
        requireFields($body, ['username', 'password']);

        $username = sanitize($body['username']);
        $password = $body['password'];

        $stmt = $this->db->prepare(
            "SELECT id, username, password, full_name, role FROM admins WHERE username = ? LIMIT 1"
        );
        $stmt->execute([$username]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($password, $admin['password'])) {
            sendError('Invalid username or password.', 401);
        }

        // Update last login
        $this->db->prepare("UPDATE admins SET last_login = NOW() WHERE id = ?")->execute([$admin['id']]);

        // Set session
        $_SESSION['admin_id']       = $admin['id'];
        $_SESSION['admin_username'] = $admin['username'];
        $_SESSION['admin_name']     = $admin['full_name'];
        $_SESSION['admin_role']     = $admin['role'];

        logActivity($this->db, $admin['id'], 'LOGIN', "Admin '{$admin['username']}' logged in.");

        sendSuccess([
            'id'        => $admin['id'],
            'username'  => $admin['username'],
            'full_name' => $admin['full_name'],
            'role'      => $admin['role'],
        ], 'Login successful');
    }

    private function logout(): void {
        if (!empty($_SESSION['admin_id'])) {
            logActivity($this->db, $_SESSION['admin_id'], 'LOGOUT', "Admin '{$_SESSION['admin_username']}' logged out.");
        }
        session_destroy();
        sendSuccess(null, 'Logged out successfully');
    }

    private function checkSession(): void {
        if (!empty($_SESSION['admin_id'])) {
            sendSuccess([
                'id'        => $_SESSION['admin_id'],
                'username'  => $_SESSION['admin_username'] ?? '',
                'full_name' => $_SESSION['admin_name'] ?? '',
                'role'      => $_SESSION['admin_role'] ?? '',
            ], 'Session active');
        } else {
            sendError('No active session', 401);
        }
    }
}
