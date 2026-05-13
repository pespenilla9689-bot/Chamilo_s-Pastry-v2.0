# Chamilo's Pastry — Complete Codebase Documentation
### For studying, navigation, and understanding how everything works

---

## TABLE OF CONTENTS

1. What This Project Is
2. Tech Stack (what languages/tools are used)
3. How to Run the Project Locally
4. Folder & File Structure (map of every file)
5. Database — Tables and What They Store
6. Backend (PHP API files) — What Each File Does
7. Frontend HTML Pages
8. CSS Files — What Each Stylesheet Controls
9. JavaScript Files — Deep Explanation
10. Authentication System (Login, Register, Google, Facebook)
11. Cart System
12. Order System
13. Admin Dashboard — Roles and Sections
14. Email & OTP System (verification codes)
15. Voucher / Deal System
16. Profile Picture System
17. Chatbot — How It Works and Its Limitations
18. How Features Connect End-to-End (flow diagrams in text)
19. Common Questions / How to Change Things

---

---

# 1. WHAT THIS PROJECT IS

Chamilo's Pastry is a full-stack bakery website with:

- A **public-facing website** (home, menu, about, contact pages)
- A **customer account system** (login, register, Google/Facebook sign-in)
- A **shopping cart and checkout system**
- An **order tracking system** for customers
- An **admin dashboard** for staff to manage orders, products, customers, analytics, and content
- A **chatbot** for customer support
- A **voucher/deal system** for first-order discounts
- An **email notification system** using Gmail SMTP

---

# 2. TECH STACK

| Layer | Technology | What It Does |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | What users see and interact with |
| Backend | PHP 8+ | Processes form data, talks to database |
| Database | MySQL (via XAMPP) | Stores all data (users, orders, products, etc.) |
| Local Server | XAMPP (Apache + MySQL) | Runs the PHP and MySQL locally |
| Email | Gmail SMTP (raw PHP socket) | Sends OTP verification codes and voucher emails |
| OAuth | Google Identity Services | Google sign-in |
| OAuth | Facebook Graph API | Facebook sign-in |
| Storage | Browser localStorage | Stores the shopping cart temporarily |
| Sessions | PHP $_SESSION | Remembers who is logged in |

**No frameworks. No npm. No Composer.** Everything is plain vanilla — the PHP runs directly, JS has no build step, CSS has no preprocessor.

---

# 3. HOW TO RUN THE PROJECT LOCALLY

### Step 1 — Install XAMPP
Download from https://www.apachefriends.org and install. XAMPP gives you Apache (web server) and MySQL (database).

### Step 2 — Put Files in htdocs
Your project files must live at:
```
C:\xampp\htdocs\
```
Everything under `C:\xampp\htdocs\` becomes accessible at `http://localhost/` in your browser.

So if your files are at `C:\xampp\htdocs\html\index.html`, you visit `http://localhost/html/index.html`.

### Step 3 — Start XAMPP
Open XAMPP Control Panel → Start **Apache** and **MySQL**.

### Step 4 — Create the Database
1. Open your browser and go to `http://localhost/phpmyadmin`
2. Click "New" on the left sidebar
3. Create a database named exactly: `chamilos_pastry`
4. Click on your new database, then click "Import"
5. Upload the SQL schema file from `database/schema.sql` in this project folder
6. Click "Go" — this creates all the tables

### Step 5 — Open the Website
Go to `http://localhost/html/index.html` in your browser.

### Step 6 — Default Admin Account
The admin account is created by the database setup:
- Email: `admin@chamilos.com`
- Password: `admin123` (or check schema.sql for the exact default)

---

# 4. FOLDER & FILE STRUCTURE

```
Chamilo_s Pastry/
│
├── html/                     ← All web pages
│   ├── index.html            ← Home page
│   ├── menu.html             ← Full cake menu
│   ├── about.html            ← About page (story, owner)
│   ├── contact.html          ← Contact form + customer feedback
│   ├── login.html            ← Login / register page
│   └── admin.html            ← Admin dashboard (staff only)
│
├── css/                      ← Stylesheets
│   ├── style.css             ← Global shared styles (used on all pages)
│   ├── index.css             ← Home page specific styles
│   ├── menu.css              ← Menu page specific styles
│   ├── about.css             ← About page specific styles
│   ├── contact.css           ← Contact page specific styles
│   ├── login.css             ← Login page specific styles
│   ├── admin.css             ← Admin dashboard styles
│   ├── nav.css               ← Navigation bar styles
│   ├── footer.css            ← Footer styles
│   └── chatbot.css           ← Chatbot widget styles
│
├── js/                       ← JavaScript files
│   ├── script.js             ← Main JS for ALL public pages (cart, auth, modals)
│   ├── admin.js              ← JS only for admin dashboard
│   └── chatbot.js            ← Chatbot logic (rule-based, self-contained)
│
├── api/                      ← PHP backend (the "server" code)
│   ├── db.php                ← Database connection + shared helper functions
│   ├── auth.php              ← Login, register, logout, Google, Facebook, forgot password
│   ├── users.php             ← Update profile, password change, avatar upload
│   ├── orders.php            ← Create order, get orders, update status, cancel items
│   ├── products.php          ← Product overrides (hide, edit, add custom products)
│   ├── feedbacks.php         ← Customer reviews (submit, list, feature/unfeature, delete)
│   ├── content.php           ← About & contact page editable content
│   ├── staff.php             ← Staff management (create, list, delete staff accounts)
│   ├── otp.php               ← Send and verify 6-digit email codes
│   ├── mailer.php            ← Gmail SMTP email sender
│   └── vouchers.php          ← Voucher/deal system (subscribe, claim, apply, redeem)
│
├── assets/                   ← Images, logos, cake photos
│   ├── logo.png
│   ├── owner.jpg
│   ├── index-featured1.png   ← Home page featured cake images
│   ├── menu-signature1.png   ← Menu page signature cake images
│   └── fullMenu1.png         ← Full menu cake images
│
├── database/
│   └── schema.sql            ← SQL file to create all tables (run this in phpMyAdmin)
│
└── DOCUMENTATION.md          ← This file
```

---

# 5. DATABASE — TABLES AND WHAT THEY STORE

To view your database, go to `http://localhost/phpmyadmin` and click on `chamilos_pastry`.

---

### TABLE: `users`
Stores every person who has an account.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID for each user |
| email | VARCHAR | Email address (must be unique) |
| password_hash | VARCHAR | Encrypted password (never stored as plain text) |
| name | VARCHAR | Display name |
| role | ENUM | 'customer', 'staff', 'manager', or 'admin' |
| title | VARCHAR | Job title for staff (e.g. "Head Baker") |
| phone | VARCHAR | Phone number |
| avatar | LONGTEXT | Profile picture stored as base64 (uploaded images) |
| picture_url | VARCHAR | Profile picture URL from Google or Facebook |
| created_at | DATETIME | When account was created |

**How roles work:**
- `customer` — regular shopper, can browse and order
- `staff` — can view and manage orders only
- `manager` — can manage orders, products, customers, analytics
- `admin` — full access to everything (highest authority)

---

### TABLE: `orders`
Every order placed by a customer.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Internal database ID |
| order_ref | VARCHAR | Public order ID shown to users (e.g. "ORD-0001") |
| user_id | INT | Which user placed this order (links to users.id) |
| customer_name | VARCHAR | Name entered at checkout |
| customer_phone | VARCHAR | Phone number at checkout |
| customer_email | VARCHAR | Email at checkout |
| delivery_method | ENUM | 'pickup' or 'delivery' |
| address | TEXT | Delivery address (if delivery) |
| preferred_date | DATE | Customer's preferred pickup/delivery date |
| cake_message | VARCHAR | Text to write on the cake |
| special_instructions | TEXT | Any extra notes |
| payment_method | VARCHAR | 'gcash', 'bank', 'cash', 'cod', 'credit' |
| total | DECIMAL | Total amount paid |
| status | ENUM | 'pending', 'processing', 'ready-for-pickup', 'delivered', 'cancelled' |
| created_at | DATETIME | When the order was placed |

---

### TABLE: `order_items`
The individual cakes inside each order.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID for this item row |
| order_id | INT | Which order this belongs to (links to orders.id) |
| product_ref | VARCHAR | The product's ID (e.g. 'c1', 'featured-1') |
| name | VARCHAR | Cake name at time of order |
| price | DECIMAL | Price per item at time of order |
| qty | INT | How many of this item were ordered |
| image | TEXT | Image URL or base64 of the cake |

---

### TABLE: `otps`
Temporary 6-digit codes for email verification.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID |
| email | VARCHAR | Which email the code was sent to |
| code | VARCHAR(6) | The 6-digit code |
| purpose | ENUM | 'forgot_password' or 'change_password' |
| expires_at | DATETIME | Code is invalid after this time (10 minutes from creation) |
| used | TINYINT | 0 = not used yet, 1 = already used |
| created_at | DATETIME | When it was generated |

---

### TABLE: `vouchers`
Discount voucher codes.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID |
| code | VARCHAR(50) | The voucher code (e.g. "CHAMILO-A3F2B1") |
| email | VARCHAR | The email this voucher belongs to |
| discount | DECIMAL | How much discount (10.00 = 10%) |
| type | ENUM | 'percent' or 'fixed' |
| used | TINYINT | 0 = not used, 1 = redeemed |
| expires_at | DATETIME | Expiry date (30 days from creation) |
| created_at | DATETIME | When voucher was created |

---

### TABLE: `products`
Overrides and custom additions to the default menu.

| Column | Type | What It Holds |
|---|---|---|
| id | VARCHAR | Product ID (e.g. 'c1', 'custom-1234567') |
| name | VARCHAR | Product name (if admin changed it) |
| price | DECIMAL | Price (if admin changed it) |
| tag | VARCHAR | Label like "Best Seller" |
| category | VARCHAR | 'featured', 'signature', or 'fullmenu' |
| image_data | LONGTEXT | Custom image in base64 |
| image_path | VARCHAR | Image file path |
| is_hidden | TINYINT | 1 = product hidden from public view |
| is_custom | TINYINT | 1 = admin-created product (not from default menu) |
| created_at | DATETIME | When added |

**Note:** The default menu (cakes with their names, prices, images) is hardcoded in `admin.js` in the `MENU_CATALOG` array. The `products` table only stores **changes** the admin made — price overrides, name changes, hidden products, or brand new custom products.

---

### TABLE: `feedbacks`
Customer reviews submitted via the Contact page.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID |
| name | VARCHAR | Reviewer's name |
| occasion | VARCHAR | e.g. "Birthday", "Wedding" |
| rating | INT | 1–5 stars |
| comment | TEXT | The review text |
| is_featured | TINYINT | 1 = shown on Home page and Contact page |
| created_at | DATETIME | When submitted |

---

### TABLE: `content`
Editable text content for About and Contact pages, managed from the admin dashboard.

| Column | Type | What It Holds |
|---|---|---|
| id | INT (auto) | Unique ID |
| key | VARCHAR | Identifier for the content block (e.g. 'aboutBio1') |
| value | TEXT | The actual text content |

---

### TABLE: `user_payment_methods`
Payment methods saved to a user's account.

| Column | What It Holds |
|---|---|
| id | Unique ID |
| user_id | Which user |
| method | Payment method name (e.g. "GCASH / E-wallet") |

---

### TABLE: `user_saved_addresses`
Delivery addresses saved to a user's account.

| Column | What It Holds |
|---|---|
| id | Unique ID |
| user_id | Which user |
| address | Full address text |

---

# 6. BACKEND (PHP API FILES)

These files live in the `api/` folder. They receive requests from JavaScript (via `fetch()`), process them, talk to the database, and send back JSON responses.

**How to reach them:** Every API file is accessed via URL like:
`http://localhost/api/auth.php?action=login`

The `?action=` part tells the PHP which action to perform.

---

## api/db.php — The Foundation

Every other API file starts with `require __DIR__ . '/db.php';` — this loads the database connection and helper functions. You never call db.php directly from the browser.

**What it sets up:**
- Starts the PHP session (remembers who is logged in)
- Sets response headers (`Content-Type: application/json`)
- Defines database credentials (DB_HOST, DB_NAME, DB_USER, DB_PASS)
- Creates the database connection as a singleton (one connection reused by all)
- `respond($data)` — sends a JSON response and stops execution
- `fail($msg, $code)` — sends an error JSON response
- `body()` — reads the JSON body from the incoming request
- `auth_user()` — checks if user is logged in, returns their data or fails with 401
- `require_role('manager')` — checks if logged-in user has enough permissions
- `user_full($id)` — fetches complete user profile including payment methods and saved addresses

---

## api/auth.php — Login, Register, Social Login, Forgot Password

Actions:

**GET ?action=me**
- Returns the currently logged-in user's full profile
- Used by the frontend on every page load to know who is logged in

**POST ?action=login**
- Receives: `{ email, password }`
- Checks the database for a matching email
- Uses `password_verify()` to check the hashed password
- Sets `$_SESSION['user_id']` to remember the login
- Returns full user data

**POST ?action=register**
- Receives: `{ email, password, name }`
- Checks email isn't already taken
- Uses `password_hash()` to securely hash the password before storing
- Creates new user in database with role 'customer'
- Returns full user data

**POST ?action=logout**
- Destroys the PHP session
- User is now logged out

**POST ?action=google**
- Receives: `{ accessToken }` — the token from Google's OAuth flow
- Calls Google's userinfo API to get the user's email, name, and profile picture
- Checks if this email already exists in our database
- If yes: logs them in (and updates their profile picture if they didn't have one)
- If no: creates a new account with role 'customer', saves their profile picture URL
- Returns full user data

**POST ?action=facebook**
- Same as Google but uses Facebook's Graph API

**POST ?action=forgot_password**
- Step 1: Receives `{ email }` only → generates a 6-digit OTP, stores it in the `otps` table, sends it to their email, responds `{ step: 'otp_sent' }`
- Step 2: Receives `{ email, code, password, confirmPassword }` → verifies OTP from database, resets the password, responds `{ step: 'password_reset' }`

---

## api/users.php — Profile Management

**POST ?action=update**
- Updates user profile
- Can update: name, phone, title
- Can upload avatar (base64 image data)
- To change password: requires old password + new password + OTP code (verification code)
- Verifies the OTP against the database before allowing password change

**POST ?action=add_payment / remove_payment**
- Adds or removes a payment method from the user's saved list

**POST ?action=add_address / remove_address**
- Adds or removes a saved delivery address

---

## api/orders.php — Order Management

**GET** (no action)
- If logged-in customer: returns only their own orders
- If staff+: returns ALL orders from all customers

**GET ?action=has_ordered**
- Checks if the current user has ever placed an order (used to gate feedback submission)

**POST ?action=create**
- Creates a new order
- Receives all checkout details: customer info, items, payment method, delivery, etc.
- Generates a unique order reference like "ORD-0001"
- Stores the order in `orders` table and each item in `order_items` table
- Optionally saves the delivery address to the user's account

**POST ?action=update_status**
- Staff only — changes an order's status
- Statuses flow: pending → processing → ready-for-pickup → delivered
- If status is changed to 'cancelled': only allowed for pending orders; deletes the order and its items from the database completely

**POST ?action=cancel_item**
- Customer or staff can cancel a single item from an order
- Only allowed when order status is 'pending'
- Deletes that item from `order_items`
- Recalculates the order total
- If no items remain: deletes the entire order

---

## api/products.php — Menu Product Management

**GET** — returns all product overrides from the database

**POST ?action=upsert** — admin creates or updates a product override (name, price, tag, image, category)

**POST ?action=hide** — marks a default menu product as hidden (won't appear on public pages)

**POST ?action=delete** — permanently deletes a custom product (only custom ones, not default)

---

## api/feedbacks.php — Customer Reviews

**GET** — returns all feedbacks (admin view)

**GET ?action=featured** — returns only featured feedbacks (shown on Home page)

**POST** (no action) — submits a new feedback (requires being logged in and having ordered)

**POST ?action=toggle_featured** — admin toggles whether a feedback is shown publicly

**POST ?action=delete** — admin permanently deletes a feedback

---

## api/staff.php — Staff Account Management

**GET** — returns all users with role staff/manager/admin

**POST ?action=create** — admin creates a new staff account with name, email, password, title, role

**POST ?action=delete** — admin removes a staff account (cannot remove main admin@chamilos.com)

---

## api/otp.php — Email Verification Codes

**POST ?action=send**
- Receives: `{ email, purpose }` (purpose = 'forgot_password' or 'change_password')
- Checks the email exists in the database
- Invalidates any previous unused OTPs for that email + purpose
- Generates a random 6-digit number
- Stores it in the `otps` table with a 10-minute expiry
- Sends it to the user's email via mailer.php

**POST ?action=verify**
- Receives: `{ email, code, purpose }`
- Checks database for a matching code that is: correct email, correct purpose, not used, not expired
- If valid: marks it as used and responds OK
- If invalid/expired: responds with an error

---

## api/mailer.php — Email Sender

Sends emails using Gmail SMTP directly via a raw PHP socket connection (no Composer, no PHPMailer library needed).

**What you must configure:**
```php
define('GMAIL_FROM',     'your_gmail@gmail.com');    // Your Gmail address
define('GMAIL_APP_PASS', 'xxxx xxxx xxxx xxxx');     // Gmail App Password
```

**How to get a Gmail App Password:**
1. Go to your Google Account → Security
2. Enable 2-Step Verification (required)
3. Search for "App Passwords"
4. Generate a new App Password for "Mail" → "Windows Computer"
5. Copy the 16-character password and paste it into the file above

**Functions:**
- `sendMail($to, $subject, $htmlBody)` — connects to Gmail on port 465 (SSL), authenticates, sends the email
- `otpEmailBody($code, $purpose)` — generates a nice purple HTML email template with the OTP code in large text

---

## api/vouchers.php — Deal and Discount System

**POST ?action=subscribe** (for guests)
- Receives: `{ name, email }`
- Checks if this email already has a voucher
- If new: generates a unique code "CHAMILO-XXXXXX", stores in `vouchers` table, sends a voucher email, returns the code
- If already has one: returns the existing code

**POST ?action=claim** (for logged-in users)
- Same as subscribe but uses the logged-in user's email automatically

**POST ?action=apply** (at checkout)
- Receives: `{ code, total }`
- Validates the code exists, is not used, and is not expired
- Calculates the discount amount
- Returns the discount (does NOT mark as used yet)

**POST ?action=redeem** (after order placed)
- Receives: `{ code }`
- Marks the voucher as used (can no longer be applied again)
- This is called immediately after a successful order

---

# 7. FRONTEND HTML PAGES

Each page loads these files consistently:
- `/css/style.css` — global styles
- `/css/[pagename].css` — page-specific styles
- `/css/nav.css` — navbar styles
- `/css/footer.css` — footer styles
- `/js/script.js` — all interactive features (except admin)

---

### html/index.html — Home Page
Sections (top to bottom):
1. Navbar (logo, navigation links, cart button, login button)
2. Hero section (main banner with headline and "Order Now" button)
3. Why Clients Choose Us (3 cards with emoji icons)
4. Featured Cakes carousel (3 slides with "Add to Cart" buttons)
5. Testimonials/Reviews grid (shows featured feedbacks from database)
6. Footer

### html/menu.html — Menu Page
Sections:
1. Navbar + hero
2. Signature Cakes carousel
3. Full Menu grid (all cakes with Add to Cart buttons)
4. Footer

### html/about.html — About Page
Sections:
1. Navbar + hero
2. Chamilo's Pastry story and founder biography
3. Stats (orders per week, rating, years)
4. Owner photo
5. Footer

### html/contact.html — Contact Page
Sections:
1. Navbar + hero
2. Contact information (address, phone, email, hours)
3. Inquiry form (name, email, occasion, message, photo upload)
4. Customer Feedback section (star rating form + reviews grid)
5. Footer

### html/login.html — Login / Register Page
- Animated split-card design
- Left panel: colored panel with "switch" button
- Right panel: form (email, password, optional name for registration)
- Social login buttons (Google, Facebook)
- "Forgot Password" link

### html/admin.html — Admin Dashboard
- Left sidebar: navigation buttons for each section
- Right main area: content area that changes based on which section is active
- Sections: Dashboard, Orders, Products, Customers, Analytics, Feedbacks, Content, Staff
- Only accessible to users with role 'staff', 'manager', or 'admin'

---

# 8. CSS FILES — WHAT EACH CONTROLS

| File | What It Styles |
|---|---|
| style.css | Buttons, modals (account, checkout, auth gate), notifications, cart, OTP fields, avatar, deal button, order cards in My Orders |
| index.css | Hero section, featured cakes, carousel, testimonials, highlights grid |
| menu.css | Menu cards, signature carousel, full menu grid |
| about.css | Story layout, stat boxes, owner photo, signature area |
| contact.css | Contact info cards, inquiry form, feedback form and review cards |
| login.css | Split card animation, social login buttons, forgot password modal |
| nav.css | Navbar, mobile hamburger menu, nav links, cart button |
| footer.css | Footer columns, links, copyright |
| admin.css | Sidebar, header, stat cards, order cards, product cards, tables, modals |
| chatbot.css | Chat bubble button, chat window, message bubbles, quick reply chips, input field |

---

# 9. JAVASCRIPT FILES — DEEP EXPLANATION

## js/script.js — Main Script (public pages)

This file is loaded on every public page. It does everything interactive on the customer side.

**How it starts:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();  // First: check who is logged in
  // Then set up all features
})
```

`loadSession()` makes one API call to `/api/auth.php?action=me` and caches the result in `_user`. This is how every page knows if someone is logged in.

**Key functions and what they do:**

| Function | What It Does |
|---|---|
| `loadSession()` | Calls the API to get the logged-in user; stores in `_user` |
| `getCurrentUserData()` | Returns the `_user` object |
| `updateNavAuth()` | Changes the navbar based on login status (profile pic vs login button) |
| `buildNavAvatarHtml()` | Builds the profile picture HTML for the navbar |
| `updateNavAvatarDisplay()` | Updates the navbar avatar after profile changes |
| `setupCart()` | Attaches "Add to Cart" click events to all buttons |
| `getCart()` | Reads the cart from localStorage |
| `saveCart(cart)` | Saves the cart to localStorage |
| `addToCart(product)` | Adds an item to cart, shows toast notification |
| `updateCartCount()` | Updates the red badge number on the cart icon |
| `initCartOverlay()` | Creates the sliding cart panel DOM element |
| `renderCartOverlay()` | Fills the cart panel with current cart items |
| `showCheckoutModal()` | Opens the checkout form with all cart items and total |
| `showAccountDetailsModal()` | Opens the "My Account" popup for profile editing |
| `renderAccountAvatar()` | Draws the user's profile picture in the account modal |
| `showMyOrdersModal()` | Opens the "My Orders" popup |
| `loadMyOrders()` | Fetches orders from the API and renders them with cancel buttons |
| `showForgotPasswordModal()` | Opens the 2-step password reset popup |
| `showAuthGate()` | Shows a "please log in" popup when a guest tries to use cart |
| `showOrderConfirmation()` | Shows "Order Placed!" confirmation after checkout |
| `renderFeaturedReviews()` | Fetches featured reviews and renders them on the home page |
| `setupFeedbackForm()` | Sets up the star rating + review submit form on contact page |
| `setupCarousel()` | Makes the featured cakes slider work with dots and auto-play |
| `initHeaderScrollHide()` | Hides navbar when scrolling down, reveals when scrolling up |
| `initDealButton()` | Creates the floating "10% Deal" button (bottom-left) |
| `openDealModal()` | Opens the deal popup (subscribe for guests, claim for logged-in) |
| `buildDealModalHtml()` | Generates the HTML content for the deal popup based on state |
| `showNotification()` | Shows a toast notification (top-right corner) |
| `applyMenuOverrides()` | Fetches product overrides from admin and applies to menu |

---

## js/admin.js — Admin Dashboard Script

This file is ONLY loaded on `admin.html`. It never runs on public pages.

**How it starts:**
```javascript
async function init() {
  // Check if user is logged in and is staff+
  // If not: redirect to login page
  // If yes: set up everything
}
init();
```

**Key functions:**

| Function | What It Does |
|---|---|
| `init()` | Auth guard + boots everything |
| `showSection(name)` | Shows one dashboard section, hides all others |
| `renderDashboard()` | Fetches orders and calculates stats (total orders, revenue, pending, delivered) |
| `renderOrders(filter)` | Fetches and displays orders filtered by status |
| `orderCardHtml(order)` | Generates the HTML card for one order |
| `attachStatusButtons()` | Adds click events to the order status buttons |
| `updateOrderStatus(id, status)` | Calls API to change an order's status |
| `renderProducts(tab)` | Shows products for the selected category tab |
| `saveProductInline()` | Saves edits to a product (name, price, tag, image) |
| `renderCustomers()` | Shows a table of all customers derived from order data |
| `renderAnalytics(period)` | Shows revenue stats and charts for a time period |
| `renderFeedbacks()` | Shows all customer reviews with toggle/delete buttons |
| `renderStaff()` | Shows the staff table |
| `setupStaffModal()` | Wires up the "Add Staff" form |
| `openAdminAccountModal()` | Opens the admin's own account settings popup |
| `showNotification()` | Same as script.js — shows toast notifications |

---

## js/chatbot.js — Chatbot Script

Self-contained, wrapped in an IIFE (immediately invoked function expression) so it doesn't conflict with other code.

---

# 10. AUTHENTICATION SYSTEM

## How login state works:

1. When you log in, PHP stores your user ID in `$_SESSION['user_id']`
2. PHP sessions use a cookie (PHPSESSID) to link your browser to this session data on the server
3. Every page load, JavaScript calls `/api/auth.php?action=me`
4. PHP reads `$_SESSION['user_id']`, looks up the user in the database, and returns their profile
5. JavaScript stores this in `_user` — this is what every function uses to know who you are

## Login flow (email/password):
```
User fills login form
  → JavaScript sends POST to /api/auth.php?action=login
  → PHP checks email in database
  → PHP uses password_verify() to check password against hash
  → If correct: sets $_SESSION['user_id'], returns user object
  → JavaScript stores user in _user, redirects to home page
```

## Google OAuth flow:
```
User clicks "Sign in with Google"
  → Google's popup appears
  → User approves
  → Google gives JavaScript an Access Token
  → JavaScript sends token to /api/auth.php?action=google
  → PHP calls Google's API: https://www.googleapis.com/oauth2/v3/userinfo
  → Google returns email, name, profile picture
  → PHP creates/finds account in database
  → PHP logs them in via session
  → Returns user object to JavaScript
```

## Forgot Password flow (2 steps):
```
Step 1:
  User enters email in forgot password modal
  → Clicks "Send Code"
  → JavaScript calls /api/auth.php?action=forgot_password with just { email }
  → PHP generates 6-digit code, saves to otps table, sends email
  → Frontend shows Step 2 form

Step 2:
  User enters the code they received + new password + confirm password
  → Clicks "Reset Password"
  → JavaScript calls same endpoint with { email, code, password, confirmPassword }
  → PHP verifies code from database (must match, not used, not expired)
  → PHP updates the password in users table
  → Done
```

## Change Password flow (from Account Details):
```
User types in new password field
  → An OTP code row appears automatically
  → User clicks "Send Code"
  → JavaScript calls /api/otp.php?action=send with { email, purpose: 'change_password' }
  → An email is sent to the user's account email

User enters received code, old password, new password, confirm
  → Clicks "Save Changes"
  → JavaScript calls /api/users.php?action=update with all fields + otpCode
  → PHP verifies old password first
  → PHP verifies OTP code from database
  → PHP updates the password
```

---

# 11. CART SYSTEM

The cart is stored in **browser localStorage** (not the database). This means:
- Cart survives page refreshes
- Cart is lost when the user clears browser data
- Cart is per-device (not synced across devices)
- Cart is visible even before login, but adding requires login

**Cart data format** (stored in localStorage key 'sweetLayersCart'):
```json
[
  { "id": "c1", "name": "Strawberry Milk Cloud Cake", "price": 1500, "image": "/assets/...", "qty": 2 },
  { "id": "featured-1", "name": "Lavender Flutter Bloom Cake", "price": 1500, "image": "/assets/...", "qty": 1 }
]
```

**Cart lifecycle:**
1. User clicks "Add to Cart" on any cake → `addToCart()` is called
2. If not logged in: shows the "Sign in to continue" gate
3. If logged in: adds item to localStorage, updates the badge number, shows toast
4. User clicks cart icon → cart panel slides in from the right
5. User can change quantities or remove items
6. User clicks "Checkout" → checkout modal opens
7. User fills in details and confirms → order is sent to API
8. On success: cart is cleared (`saveCart([])`)

---

# 12. ORDER SYSTEM

## Customer flow:
```
1. Add items to cart
2. Click cart icon → Click "Checkout"
3. Fill in: name, phone, email, delivery/pickup choice, date, cake message, payment method
4. Optionally enter a voucher code
5. Click "Place Order"
6. Backend creates record in orders + order_items tables
7. Confirmation popup appears with order ID
8. View order in "My Orders" (click profile picture → My Orders)
```

## Order statuses and what they mean:
- **pending** — just placed, waiting for staff to confirm
- **processing** — staff accepted and is making the cake
- **ready-for-pickup** — cake is done, customer can pick up
- **delivered** — order completed
- **cancelled** — order was cancelled (deleted from database)

## Admin order management:
- Default view shows **Pending** orders first
- Staff can click status buttons to move orders forward
- Only **pending** orders have the Cancel button enabled
- When cancelled: the order and all its items are deleted from the database

## Customer order management:
- Go to My Orders (click profile picture in navbar → My Orders)
- Pending orders show "Cancel Item" buttons on each item
- Only individual items can be cancelled, not the whole order at once
- If you cancel all items, the order is automatically removed

---

# 13. ADMIN DASHBOARD — ROLES AND SECTIONS

## Access levels (from lowest to highest):
```
staff    → Can see: Dashboard, Orders, Feedbacks
manager  → Can see: Everything staff can + Products, Customers, Analytics
admin    → Can see: Everything + Content management, Staff management
```

## Dashboard section:
Shows 4 stat cards: Total Orders, Total Revenue, Pending Orders, Delivered Orders.
Also shows a "Recent Orders" list (the 5 most recent orders).

## Orders section:
- Filter buttons: Pending, Processing, Ready for Pickup, Delivered
- Each order shows: customer info, items, total, status buttons
- Cancel button is only clickable for orders with status "pending"

## Products section:
- 3 tabs: Index Featured Cakes, Menu Signature Carousel, Menu Full Menu
- Each product card lets you change: name, price, tag, image
- "Save" button saves changes to the database
- "Hide" removes it from public view (default products can only be hidden, not deleted)
- "Delete" removes custom products entirely
- "+ Add Product" button adds a completely new custom product

## Customers section:
- Shows all customers derived from order history
- Columns: name, contact, number of orders, total spent, loyalty points, last order date
- Loyalty points formula: ₱100 spent = 1 point

## Analytics section:
- Filter by: Today, This Week, This Month, All Time
- Stats: number of orders, total revenue, average order value, pending, delivered
- Popular Products: horizontal bar chart of best-selling items
- Revenue by Day: bar chart

## Feedbacks section:
- Table of all customer reviews
- "Set Featured" / "Featured" toggle button — featured reviews show on Home and Contact pages
- "Delete" button permanently removes a review

## Content section:
- Edit text content for About and Contact pages
- Changes save to the database and appear immediately on the public pages

## Staff section:
- Table showing all staff, manager, and admin accounts
- Includes their title (e.g. "Head Baker")
- "+ Add Staff" button creates a new staff account
- "Remove" deletes a staff account

---

# 14. EMAIL & OTP SYSTEM

## What emails the system sends:
1. **Forgot password code** — when a user requests a password reset
2. **Change password code** — when a user wants to update their password from Account Details
3. **Voucher code** — when a guest subscribes for the first-order deal

## How the OTP (One-Time Password) system works:

```
1. System generates a random 6-digit number: str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT)
   Examples: "042891", "007523", "199934"

2. A new row is inserted into the otps table:
   - email: the recipient's email
   - code: the 6 digits
   - purpose: 'forgot_password' or 'change_password'
   - expires_at: current time + 10 minutes
   - used: 0

3. Any previous unused OTPs for the same email + purpose are marked used=1 first
   (so old codes can't be used if you request a new one)

4. The code is emailed to the user

5. When the user submits the code:
   PHP checks: does a row exist where email matches, code matches, purpose matches, used=0, expires_at > NOW()?
   If yes: marks it used=1 and proceeds
   If no: returns "Invalid or expired verification code."
```

## Email template:
The OTP email has a purple/white design with the 6-digit code displayed in very large text. It says "This code expires in 10 minutes. Do not share it with anyone."

## Gmail SMTP setup:
The `mailer.php` file connects directly to Gmail's SMTP server at `ssl://smtp.gmail.com:465` using raw PHP socket programming. It authenticates using Base64-encoded credentials. No external email library is needed.

---

# 15. VOUCHER / DEAL SYSTEM

## The Deal Button:
- Floating circular button, bottom-left of every public page
- Shows "10%" and "Deal"
- Purple gradient design

## Guest flow (not logged in):
```
1. Guest clicks Deal button
2. Modal appears: "10% OFF your first order!"
3. Guest enters their name and email
4. Clicks "Get My Voucher"
5. System calls /api/vouchers.php?action=subscribe
6. A unique code is generated: "CHAMILO-" + 6 random hex characters (e.g. "CHAMILO-A3F2B1")
7. Code is stored in vouchers table linked to their email
8. A voucher email is sent to them
9. Code is shown on screen
```

## Logged-in customer flow:
```
1. Customer clicks Deal button
2. System calls /api/vouchers.php?action=claim
3. If they have a voucher already: shows existing code (and whether it's used)
4. If they don't: generates and stores a new code, shows it
```

## Using the voucher at checkout:
```
1. Checkout modal has a "Voucher / Promo Code" field
2. Customer types their code and clicks "Apply"
3. System calls /api/vouchers.php?action=apply with { code, total }
4. If valid: calculates discount (10% of total), shows "-₱X discount" and new total
5. When order is placed: /api/vouchers.php?action=redeem marks the code as used (can't reuse)
```

---

# 16. PROFILE PICTURE SYSTEM

## Three sources for profile pictures (priority order):
1. **`avatar`** — custom image uploaded by the user (stored as base64 in the database)
2. **`picture_url`** — URL to Google or Facebook profile picture (stored as URL in database)
3. **Initials fallback** — if no picture exists, the user's initials are shown in a purple circle

## Uploading a custom photo:
```
1. User clicks profile picture in navbar → Account Details
2. Clicks "Change Photo" button
3. File picker opens (accepts image files only)
4. User selects an image (must be under 3 MB)
5. JavaScript reads the file using FileReader API → converts to base64 string
6. Calls /api/users.php?action=update with { avatar: "data:image/jpeg;base64,..." }
7. PHP validates: must start with "data:image/..." and be under 4 MB
8. Stores the base64 string in users.avatar column
9. Returns updated user data
10. JavaScript updates both the account modal display AND the navbar picture
```

## How Google/Facebook pictures work:
```
When logging in with Google:
  → Google returns a picture URL in userinfo response
  → PHP stores this URL in users.picture_url

When logging in with Facebook:
  → Facebook returns a picture URL in graph API response
  → PHP stores this URL in users.picture_url

If user logs in with Google and has no picture stored:
  → Their Google picture URL is saved
If they already have a picture stored:
  → Keep existing (don't overwrite)
```

## Where profile pictures appear:
- Navbar (small circle, 38×38px)
- Account Details modal header (large circle, 88×88px)

---

# 17. CHATBOT — HOW IT WORKS AND ITS LIMITATIONS

## What kind of chatbot is it?

This is a **rule-based chatbot**, NOT an AI chatbot. It does NOT use ChatGPT, OpenAI, Claude, or any AI API. There are no API calls to external services. Everything runs entirely in the browser using JavaScript.

## How it works (step by step):

```
1. User types a message (or clicks a quick reply button)
2. JavaScript takes the text and checks it against a "knowledge base" (KB array)
3. The KB array contains objects, each with:
   - patterns: array of regular expressions (regex patterns to match words)
   - responses: array of pre-written answer strings
4. The code loops through every entry in KB:
   - Tests if ANY of the patterns match the user's message
   - If a match is found: picks one of the pre-written responses (randomly if multiple)
5. If NO pattern matches: uses a fallback response
6. The bot's response appears in the chat window after a 420ms delay (to feel more natural)
```

## Example from the code:
```javascript
{
  patterns: [/hour|open|close|schedule|when.*open|what time/i],
  responses: [
    "Our studio hours are:\nTue – Sun: 10AM – 10PM\nWe're closed on Mondays.",
  ],
}
```
If you type "when are you open" or "what time do you close" or "business hours" — any of these will match the regex and return the hours response.

## Quick Reply buttons:
The chat window has pre-made buttons for common topics:
- Opening hours, View menu, How to order, Delivery options, Payment methods, Cancel an order, Get a deal, Contact us

Clicking these buttons sends that text as if the user typed it, which then goes through the same pattern matching.

## The Knowledge Base covers:
- Greetings
- Business hours (Tue–Sun, 10AM–10PM)
- Menu items and prices
- Pricing questions
- How to order
- Delivery vs pickup options and address
- Cancellation policy
- Payment methods
- Voucher/deal information
- Account creation
- Contact details
- Custom cake orders
- Thank you / goodbye responses

## LIMITATIONS of the chatbot:

1. **Cannot answer anything outside its knowledge base.** If you ask "What flour do you use?" or "Can you do fondant cakes?" — it will give a generic fallback response because those are not in the KB.

2. **Cannot look up real-time information.** It cannot check "is my order ORD-0012 ready?" or "how long will my order take?" — it has no connection to the database.

3. **Cannot take actions.** It cannot place orders, cancel items, or change your account details. It only gives information.

4. **Pattern matching is literal.** If the user makes a spelling mistake like "oppen hours" instead of "open hours", it might not match the pattern. However, most patterns are broad enough to catch variations.

5. **No memory between messages.** Each message is processed independently. The bot doesn't remember what was said earlier in the conversation (no context tracking).

6. **No learning.** The chatbot cannot improve from conversations. Whatever knowledge is hardcoded in chatbot.js is all it knows.

## How to add more knowledge to the chatbot:

Open `js/chatbot.js` and find the `KB` array. Add a new object:

```javascript
{
  patterns: [/your keyword|another keyword/i],
  responses: [
    "Your answer here.",
    "Alternative answer here (picked randomly).",
  ],
},
```

The `/i` at the end makes it case-insensitive (so "Hours" and "hours" both match).

---

# 18. HOW FEATURES CONNECT END-TO-END

## Full order placement flow:

```
Customer (browser)                    Server (PHP)                Database (MySQL)
     |                                     |                            |
     | 1. Load page                        |                            |
     | ─ GET /api/auth.php?action=me ────► |                            |
     |                                     | ── SELECT users ──────────►|
     |                                     |◄── user data ─────────────|
     |◄── { user data } ─────────────────  |                            |
     |                                     |                            |
     | 2. Add items to cart (localStorage) |                            |
     | 3. Open checkout modal              |                            |
     | 4. Fill details + click Place Order |                            |
     | ─ POST /api/orders.php?action=create►                            |
     |                                     | ── INSERT INTO orders ────►|
     |                                     | ── INSERT INTO order_items►|
     |                                     |◄── order ID ──────────────|
     |◄── { orderId: "ORD-0001" } ────────|                            |
     |                                     |                            |
     | 5. Cart cleared from localStorage   |                            |
     | 6. "Order Placed!" popup shown      |                            |
```

## How admin sees and processes the order:

```
Admin opens Orders section in dashboard
  → Browser calls GET /api/orders.php
  → PHP fetches all orders from database (staff+ see all orders)
  → Admin sees order ORD-0001 in "Pending" filter
  → Admin clicks "Processing" button
  → Browser calls POST /api/orders.php?action=update_status { orderId: "ORD-0001", status: "processing" }
  → PHP updates status in database
  → Dashboard refreshes to show updated status
```

---

# 19. COMMON QUESTIONS / HOW TO CHANGE THINGS

**Q: How do I add a new cake to the menu?**
A: Log in as admin, go to Admin Dashboard → Products → click the category tab → click "+ Add Product". Fill in the name, price, and upload an image.

**Q: How do I change the business hours shown on the contact page?**
A: Log in as admin, go to Admin Dashboard → Content → Contact Page. Edit the "Studio Hours" field and click Save Changes.

**Q: How do I feature a customer review on the home page?**
A: Go to Admin Dashboard → Feedbacks. Find the review and click "Set Featured". It will now appear in the testimonials section on the home page.

**Q: How do I change the price of a cake?**
A: Admin Dashboard → Products → find the cake → change the price number → click Save.

**Q: Why is my Gmail not sending OTP emails?**
A: Open `api/mailer.php` and make sure:
- `GMAIL_FROM` has your real Gmail address
- `GMAIL_APP_PASS` has your Gmail App Password (not your regular Gmail password)
- You have 2-Step Verification enabled on your Google account

**Q: How do I create a staff account?**
A: Log in as admin, go to Admin Dashboard → Staff → click "+ Add Staff". Fill in name, email, password, title, and role. The new account can log in from `/html/login.html`.

**Q: How do I change the admin account password?**
A: The default admin uses `admin@chamilos.com`. Log in and click the account button (top-right in admin dashboard) to change the password. Note: the admin account may not have a password hash initially — check your schema.sql.

**Q: Why does the cart empty after logout?**
A: When logging out, `localStorage.removeItem('sweetLayersCart')` is called to clear the cart. This is intentional — the cart is tied to the local browser session.

**Q: How do I add more topics to the chatbot?**
A: Open `js/chatbot.js`, find the `KB` array, and add a new entry with `patterns` (regex) and `responses` (array of strings). Then re-sync to htdocs.

**Q: Where is the "10% off" voucher percentage set?**
A: In `api/vouchers.php`, the INSERT statement has `discount: 10.00`. Change this number to change the discount. Note: you'd also need to update the text in the deal modal HTML in script.js.

**Q: How do I make a customer an admin?**
A: In phpMyAdmin, find the user in the `users` table, edit their row, and change `role` from 'customer' to 'admin'. They must log out and log back in.

**Q: How do I sync changes from the project folder to htdocs?**
A: After editing files in `C:\Activities\WebApps\Chamilo-s-Pastry-main\Chamilo_s Pastry\`, copy them to `C:\xampp\htdocs\` using PowerShell:
```powershell
Copy-Item -Path "C:\Activities\...\api\auth.php" -Destination "C:\xampp\htdocs\api\auth.php" -Force
```
Or copy the entire folder. XAMPP serves files from htdocs, not from the Activities folder.

---

*End of Documentation*
*Chamilo's Pastry — Built with PHP, MySQL, HTML, CSS, and JavaScript*
