# 🍔 Loren Eatery — Point of Sale (POS) Kiosk

A modern, highly responsive, and robust Point of Sale (POS) system designed for quick-service restaurants like **Loren Eatery**. The system is built with a fast and secure PHP backend, MySQL database, vanilla CSS styling, and standard JavaScript logic with offline queueing support.

---

## 🚀 Easy XAMPP Setup (Any Device / Folder)

This project has been engineered to be **fully portable**. You do not need to edit or hardcode directories or folder names! It will automatically detect its location and work seamlessly on any subfolder under `htdocs` (e.g., `C:\xampp\htdocs\loren_eatery`, `C:\xampp\htdocs\POS-RESTU`, etc.).

### Step 1: Install XAMPP
1. Download and install **XAMPP** (PHP 8.0 or newer recommended) from the [official website](https://www.apachefriends.org/).

### Step 2: Copy Project Folder
1. Copy this entire project directory into the XAMPP web root folder:
   - **Windows Path:** `C:\xampp\htdocs\<your-folder-name>`
   - *Example:* `C:\xampp\htdocs\loren_eatery` or `C:\xampp\htdocs\POS-RESTU`

### Step 3: Run XAMPP Services
1. Open the **XAMPP Control Panel**.
2. Click **Start** for both **Apache** and **MySQL**.

### Step 4: Import the Database
1. Open your web browser and navigate to **phpMyAdmin**: [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
2. Click **New** in the left sidebar to create a new database.
3. Name the database **`loren_eatery`** and click **Create**.
4. Select the `loren_eatery` database, click the **Import** tab at the top.
5. Click **Choose File** and select the SQL file located in the project at `/database/init.sql`.
6. Scroll down and click **Import** (or **Go**).

### Step 5: Database Connection settings
* The database settings are **pre-configured by default** to work out-of-the-box with standard XAMPP settings in `/config/database.php`:
  * **Host:** `localhost`
  * **Database Name:** `loren_eatery`
  * **Username:** `root`
  * **Password:** *(empty)*

### Step 6: Access the Application
Open your browser and navigate to the project folder URL:
* **Customer POS Kiosk:** `http://localhost/<your-folder-name>/`
  *(e.g., `http://localhost/loren_eatery/` or `http://localhost/POS-RESTU/`)*
* **Admin Dashboard:** `http://localhost/<your-folder-name>/admin/`
* **Public Queue Display:** `http://localhost/<your-folder-name>/queue.html`

---

## 📱 Accessing from Other Devices (Tablets, Phones, PCs)

Since the project uses **100% relative and dynamically generated root paths**, you can access the system from any device connected to the **same local Wi-Fi or Ethernet network**! All CSS, Javascript, and media assets will load perfectly.

1. **Find the host PC's Local IP Address:**
   - Open Command Prompt (`cmd`) on the computer running XAMPP.
   - Run `ipconfig`.
   - Look for the **IPv4 Address** under your active network adapter (e.g., `192.168.1.100`).
2. **Access from another device:**
   - Connect the tablet, phone, or other PC to the same Wi-Fi network.
   - In the browser of that device, enter:
     `http://<host-ip-address>/<your-folder-name>/`
     *(e.g., `http://192.168.1.100/loren_eatery/`)*
   - The UI will beautifully scale and respond to mobile, tablet, and desktop viewports, with all styling and features completely intact.

---

## 📁 Project Structure

```text
/
├── admin/              # Admin dashboard interface (index.html)
├── api/                # Main API entry point (index.php)
├── assets/             # Shared CSS, JS, Images, and Sounds
│   ├── css/            # Style sheets (style.css, admin.css, pos.css, queue.css)
│   ├── img/            # Static assets and food images
│   ├── js/             # Frontend application logic (api.js, cart.js, pos.js, etc.)
│   └── sounds/         # Sounds alerts for orders
├── config/             # Database and configuration helpers
├── controllers/        # Backend MVC controllers
├── database/           # SQL schema initialization
├── uploads/            # Dynamic uploaded menu item images
├── index.html          # Main Customer POS page
└── queue.html          # Public Queue Display page
```

---

## 🔐 Admin Credentials

To log into the **Admin Dashboard** (`/admin/`):
* **Username:** `admin`
* **Password:** `admin123`

---

## 🛠️ Portability Architecture (How It Works)

To ensure this project is fully plug-and-play across different environments, the codebase implements the following mechanisms:

1. **Dynamic Path Resolution (`APP_BASE_PATH`)**: 
   The backend automatically parses the `$_SERVER['SCRIPT_NAME']` variable to calculate the folder offset dynamically. This eliminates hardcoded paths in image URLs and assets, regardless of whether you put the system in `/` (domain root) or a deep subdirectory like `/xampp/Project/POS restu/`.
2. **Dynamic Client API Base Detection**: 
   The frontend JavaScript analyzes `window.location.pathname` to detect if the user is in `/admin/` or the root folder, dynamically setting the backend router endpoint to ensure connectivity.
