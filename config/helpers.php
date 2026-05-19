<?php
/**
 * Loren Eatery POS - API Response Helper
 */

// Set JSON response headers
function setJsonHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Send success response
function sendSuccess(mixed $data = null, string $message = 'Success', int $code = 200): void {
    http_response_code($code);
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data'    => $data,
    ]);
    exit;
}

// Send error response
function sendError(string $message = 'Error', int $code = 400, mixed $detail = null): void {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error'   => $message,
        'detail'  => $detail,
    ]);
    exit;
}

// Get JSON request body
function getRequestBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Sanitize string input
function sanitize(string $value): string {
    return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
}

// Validate required fields
function requireFields(array $data, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
            sendError("Field '$field' is required.", 422);
        }
    }
}

// Log admin activity
function logActivity(PDO $db, ?int $adminId, string $action, string $description): void {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $stmt = $db->prepare(
            "INSERT INTO activity_logs (admin_id, action, description, ip_address) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$adminId, $action, $description, $ip]);
    } catch (Exception $e) {
        // Silently fail - logging should not break requests
    }
}

// Check admin session
function requireAdminAuth(): array {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['admin_id'])) {
        sendError('Unauthorized. Please log in.', 401);
    }
    return [
        'id'        => $_SESSION['admin_id'],
        'username'  => $_SESSION['admin_username'] ?? '',
        'full_name' => $_SESSION['admin_name'] ?? '',
    ];
}

// Generate next queue number for today
function generateQueueNumber(PDO $db): string {
    $today = date('Y-m-d');

    // Try to increment; insert if doesn't exist
    $stmt = $db->prepare(
        "INSERT INTO queue_tracker (date, last_number, prefix)
         VALUES (?, 1, 'A')
         ON DUPLICATE KEY UPDATE last_number = last_number + 1"
    );
    $stmt->execute([$today]);

    $stmt = $db->prepare("SELECT last_number FROM queue_tracker WHERE date = ?");
    $stmt->execute([$today]);
    $row = $stmt->fetch();

    $num = $row['last_number'] ?? 1;
    return 'A' . str_pad($num, 3, '0', STR_PAD_LEFT);
}
