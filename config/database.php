<?php

// Database Connection settings (Hardcoded XAMPP Defaults)
define('DB_HOST', 'localhost');
define('DB_NAME', 'loren_eatery');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Application settings
define('APP_NAME', 'Loren Eatery POS');
define('APP_VERSION', '1.0.0');
define('APP_TIMEZONE', 'Asia/Manila');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');

// Determine the base path dynamically relative to the server root (e.g. "/POS-RESTU/")
if (php_sapi_name() === 'cli' || !isset($_SERVER['SCRIPT_NAME'])) {
    define('APP_BASE_PATH', '/');
    define('UPLOAD_URL', '/uploads/');
} else {
    $base_dir = dirname($_SERVER['SCRIPT_NAME']);
    $base_dir = str_replace('\\', '/', $base_dir);

    // Strip "/api" or "/admin" subfolders to get the true root of the project
    if (substr($base_dir, -4) === '/api') {
        $base_dir = substr($base_dir, 0, -4);
    } elseif (substr($base_dir, -6) === '/admin') {
        $base_dir = substr($base_dir, 0, -6);
    }

    $base_dir = '/' . trim($base_dir, '/') . '/';
    if ($base_dir === '//') {
        $base_dir = '/';
    }

    define('APP_BASE_PATH', $base_dir);
    define('UPLOAD_URL', APP_BASE_PATH . 'uploads/');
}

define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

date_default_timezone_set(APP_TIMEZONE);


function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            // Parse host and optional port if present in host
            $host = DB_HOST;
            $port = null;
            if (strpos($host, ':') !== false) {
                list($host, $port) = explode(':', $host, 2);
            }

            $dsn = "mysql:host=" . $host;
            if ($port !== null) {
                $dsn .= ";port=" . $port;
            }
            $dsn .= ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'"
            ];
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'Database connection failed',
                'detail'  => $e->getMessage()
            ]);
            exit;
        }
    }
    return $pdo;
}


