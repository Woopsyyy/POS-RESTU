<?php
/**
 * Loren Eatery POS - Upload Controller
 * Handles menu item image uploads with validation
 */

class UploadController {
    private PDO $db;
    private array $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private array $allowedExts  = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        requireAdminAuth();
        switch ($action) {
            case 'image':
                if ($method === 'POST') $this->uploadImage();
                else sendError('Method not allowed', 405);
                break;
            default:
                sendError('Unknown upload action', 404);
        }
    }

    private function uploadImage(): void {
        if (!isset($_FILES['image'])) {
            sendError('No image file provided.', 422);
        }

        $file  = $_FILES['image'];
        $error = $file['error'];

        if ($error !== UPLOAD_ERR_OK) {
            sendError('Upload error code: ' . $error, 422);
        }

        // Validate size
        if ($file['size'] > MAX_FILE_SIZE) {
            sendError('File too large. Maximum 10MB allowed.', 422);
        }

        // Validate MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $this->allowedTypes)) {
            sendError('Invalid file type. Only JPEG, PNG, WebP, and GIF allowed.', 422);
        }

        // Validate extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $this->allowedExts)) {
            sendError('Invalid file extension.', 422);
        }

        // Create upload directory if needed
        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }

        // Generate unique filename
        $filename  = 'menu_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $destPath  = UPLOAD_DIR . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            sendError('Failed to save uploaded file.', 500);
        }

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'IMAGE_UPLOAD', "Uploaded image: $filename");

        sendSuccess([
            'filename'  => $filename,
            'image_url' => UPLOAD_URL . $filename,
        ], 'Image uploaded successfully', 201);
    }
}
