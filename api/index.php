<?php
/**
 * Loren Eatery POS - API Router
 * All API requests go through this file
 *
 * URL Pattern: /api/index.php?resource=X&action=Y
 * or via .htaccess rewriting: /api/X/Y
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/helpers.php';

// Start output buffering
ob_start();

// Set JSON response headers
setJsonHeaders();

// Parse the request
$resource = $_GET['resource'] ?? '';
$action   = $_GET['action']   ?? '';
$method   = $_SERVER['REQUEST_METHOD'];

// Route to appropriate controller
switch ($resource) {
    case 'menu':
        require_once __DIR__ . '/../controllers/MenuController.php';
        $ctrl = new MenuController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'orders':
        require_once __DIR__ . '/../controllers/OrderController.php';
        $ctrl = new OrderController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'categories':
        require_once __DIR__ . '/../controllers/CategoryController.php';
        $ctrl = new CategoryController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'auth':
        require_once __DIR__ . '/../controllers/AuthController.php';
        $ctrl = new AuthController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'queue':
        require_once __DIR__ . '/../controllers/QueueController.php';
        $ctrl = new QueueController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'uploads':
        require_once __DIR__ . '/../controllers/UploadController.php';
        $ctrl = new UploadController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'dashboard':
        require_once __DIR__ . '/../controllers/DashboardController.php';
        $ctrl = new DashboardController(getDB());
        $ctrl->handle($action, $method);
        break;

    case 'ping':
        sendSuccess(['status' => 'ok', 'time' => date('c')], 'API is running');
        break;

    default:
        sendError('Unknown API resource: ' . htmlspecialchars($resource), 404);
}
