-- ============================================================
-- Loren Eatery POS System - MySQL Database Initialization
-- ============================================================
-- Compatible with: Docker MySQL 8.0 and XAMPP MySQL
-- Author: Loren Eatery POS
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+08:00";

-- Create and use database
CREATE DATABASE IF NOT EXISTS `loren_eatery` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `loren_eatery`;

-- ============================================================
-- Table: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `role` ENUM('super_admin','cashier') NOT NULL DEFAULT 'cashier',
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: categories
-- ============================================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) DEFAULT '🍽️',
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: menu_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `category_id` INT(11) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `is_bestseller` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_available` (`is_available`),
  CONSTRAINT `fk_menu_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: queue_tracker
-- ============================================================
CREATE TABLE IF NOT EXISTS `queue_tracker` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `last_number` INT(11) NOT NULL DEFAULT 0,
  `prefix` CHAR(1) NOT NULL DEFAULT 'A',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `queue_number` VARCHAR(10) NOT NULL,
  `customer_name` VARCHAR(100) NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `payment_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `change_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `estimated_wait` INT(11) NOT NULL DEFAULT 10,
  `order_date` DATE NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_queue` (`queue_number`, `order_date`),
  KEY `idx_status` (`status`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `order_id` INT(11) NOT NULL,
  `menu_item_id` INT(11) DEFAULT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `item_price` DECIMAL(10,2) NOT NULL,
  `quantity` INT(11) NOT NULL DEFAULT 1,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_menu_item` (`menu_item_id`),
  CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_item_menu` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_id` INT(11) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_log_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA: Admin Account
-- Password: admin123 (bcrypt hashed)
-- ============================================================
INSERT INTO `admins` (`username`, `password`, `full_name`, `email`, `role`) VALUES
('admin', '$2y$10$YC2jYyRh0/DpljYezvy21ub6c80t9L5ZRPAZDkaLVK6cm8qws0XH2', 'System Administrator', 'admin@loreneatery.com', 'super_admin');

-- ============================================================
-- SEED DATA: Categories
-- ============================================================
INSERT INTO `categories` (`name`, `slug`, `icon`, `sort_order`) VALUES
('Burgers', 'burgers', '🍔', 1),
('Chicken', 'chicken', '🍗', 2),
('Fries', 'fries', '🍟', 3),
('Pasta', 'pasta', '🍝', 4),
('Drinks', 'drinks', '🥤', 5),
('Desserts', 'desserts', '🍨', 6);

-- ============================================================
-- SEED DATA: Menu Items
-- ============================================================
INSERT INTO `menu_items` (`category_id`, `name`, `description`, `price`, `image_path`, `is_available`, `is_bestseller`, `sort_order`) VALUES
-- Burgers
(1, 'Yum Burger', 'Classic beef patty with special Yum sauce, lettuce, and tomato', 69.00, 'assets/img/yum burger.webp', 1, 1, 1),
(1, 'Burger Steak', 'Juicy beef patty smothered in rich mushroom gravy sauce', 119.00, 'assets/img/burger steak.webp', 1, 1, 2),
(1, 'Double Yum', 'Double patty with double cheese and special sauce', 139.00, 'assets/img/double yum.webp', 1, 0, 3),
(1, 'Cheeseburger', 'Classic cheeseburger with cheddar, pickles, and ketchup', 89.00, 'assets/img/cheese burger.webp', 1, 0, 4),

-- Chicken
(2, 'Chickenjoy Solo', 'Crispy fried chicken with signature golden-brown coating', 119.00, 'assets/img/chicken joy solo.webp', 1, 1, 1),
(2, 'Chickenjoy Bucket 6pcs', 'Family-size bucket of crispy Chickenjoy pieces', 549.00, 'assets/img/chicken joy bucket.webp', 1, 1, 2),
(2, 'Chicken Sandwich', 'Crispy chicken fillet with mayo and fresh veggies', 99.00, 'assets/img/chicken sandwhich.webp', 1, 0, 3),
(2, 'Spicy Chickenjoy', 'Hot and spicy version of our signature Chickenjoy', 129.00, 'assets/img/chicken joy spicy.webp', 1, 0, 4),

-- Fries
(3, 'Regular Fries', 'Golden crispy French fries lightly salted', 59.00, 'assets/img/regular fries.webp', 1, 0, 1),
(3, 'Large Fries', 'Supersized golden crispy French fries', 79.00, 'assets/img/regular fries.webp', 1, 1, 2),
(3, 'Loaded Fries', 'Fries topped with cheese sauce and bacon bits', 109.00, 'assets/img/regular fries.webp', 1, 0, 3),
(3, 'Seasoned Fries', 'Crispy fries tossed in our secret seasoning blend', 69.00, 'assets/img/regular fries.webp', 1, 0, 4),

-- Pasta
(4, 'Jolly Spaghetti', 'Sweet Filipino-style spaghetti with hot dog slices and cheese', 99.00, 'assets/img/jolly spaghetti.webp', 1, 1, 1),
(4, 'Carbonara', 'Creamy white sauce pasta with bacon and parmesan', 119.00, 'assets/img/carbonara.webp', 1, 0, 2),
(4, 'Pesto Pasta', 'Al dente pasta with basil pesto and pine nuts', 129.00, 'assets/img/pesto pasta.webp', 1, 0, 3),

-- Drinks
(5, 'Coke Float', 'Chilled Coca-Cola with a scoop of vanilla ice cream', 79.00, 'assets/img/coke float.webp', 1, 1, 1),
(5, 'Iced Tea', 'Refreshing brewed iced tea with lemon', 59.00, 'assets/img/iced tea.webp', 1, 0, 2),
(5, 'Orange Juice', 'Fresh-squeezed orange juice packed with vitamins', 69.00, 'assets/img/orange juice.webp', 1, 0, 3),
(5, 'Hot Coffee', 'Rich brewed coffee served hot', 55.00, 'assets/img/hot coffee.webp', 1, 0, 4),
(5, 'Bottled Water', 'Cold mineral water 500ml', 35.00, 'assets/img/bottle water.webp', 1, 0, 5),

-- Desserts
(6, 'Hot Fudge Sundae', 'Creamy vanilla soft serve drizzled with hot fudge', 79.00, 'assets/img/Hot Fudge Sundae.webp', 1, 1, 1),
(6, 'Peach Mango Pie', 'Flaky pastry filled with sweet peach and mango jam', 65.00, 'assets/img/Peach Mango Pie.webp', 1, 1, 2),
(6, 'Chocolate Sundae', 'Classic chocolate-dipped soft serve ice cream', 55.00, 'assets/img/Chocolate Sundae.webp', 1, 0, 3),
(6, 'Halo-Halo', 'Filipino shaved ice dessert with beans, fruits, and leche flan', 119.00, 'assets/img/Halo-Halo.webp', 1, 0, 4);

COMMIT;
