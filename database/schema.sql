CREATE DATABASE IF NOT EXISTS chamilos_pastry
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chamilos_pastry;


CREATE TABLE IF NOT EXISTS users (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  name          VARCHAR(255)  NOT NULL DEFAULT '',
  role          ENUM('customer','staff','manager','admin') NOT NULL DEFAULT 'customer',
  phone         VARCHAR(11)   NOT NULL DEFAULT '',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS user_payment_methods (
  id      INT          AUTO_INCREMENT PRIMARY KEY,
  user_id INT          NOT NULL,
  method  VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_user_method (user_id, method),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS user_saved_addresses (
  id      INT  AUTO_INCREMENT PRIMARY KEY,
  user_id INT  NOT NULL,
  address TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS orders (
  id                   INT           AUTO_INCREMENT PRIMARY KEY,
  order_ref            VARCHAR(20)   UNIQUE NOT NULL,
  user_id              INT,
  customer_name        VARCHAR(255)  NOT NULL,
  customer_phone       VARCHAR(50)   NOT NULL,
  customer_email       VARCHAR(255)  NOT NULL DEFAULT '',
  delivery_method      ENUM('pickup','delivery') NOT NULL DEFAULT 'pickup',
  address              TEXT,
  preferred_date       DATE,
  cake_message         TEXT,
  special_instructions TEXT,
  payment_method       VARCHAR(50)   NOT NULL DEFAULT 'gcash',
  total                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status               ENUM('pending','processing','ready-for-pickup','delivered','cancelled')
                       NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS order_items (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  order_id    INT           NOT NULL,
  product_ref VARCHAR(100)  NOT NULL DEFAULT '',
  name        VARCHAR(255)  NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  qty         INT           NOT NULL DEFAULT 1,
  image       VARCHAR(500)  NOT NULL DEFAULT '',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS products (
  id          VARCHAR(100)  PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  tag         VARCHAR(100)  NOT NULL DEFAULT '',
  image_path  VARCHAR(500)  NOT NULL DEFAULT '',
  image_data  LONGTEXT,
  category    ENUM('featured','signature','fullmenu') NOT NULL,
  is_custom   TINYINT(1)    NOT NULL DEFAULT 0,
  is_hidden   TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS feedbacks (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  name        VARCHAR(255) NOT NULL,
  occasion    VARCHAR(255) NOT NULL DEFAULT '',
  comment     TEXT         NOT NULL,
  rating      TINYINT      NOT NULL,
  is_featured TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS site_content (
  content_key   VARCHAR(100) PRIMARY KEY,
  content_value TEXT,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
