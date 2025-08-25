// ===============================
// 📦 DEPENDENCIES
// ===============================
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();

// ===============================
// 🔹 INITIALIZE APP
// ===============================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ===============================
// 📦 MYSQL CONNECTION
// ===============================
let db;
async function initDB() {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  console.log("✅ Connected to MySQL database");
}
initDB().catch(err => console.error("❌ DB Connection Failed:", err));

// ===============================
// 🛡️ ADMIN MIDDLEWARE
// ===============================
function isAdmin(req, res, next) {
  if (req.body.role === "admin" || req.query.role === "admin") next();
  else res.status(403).json({ error: "Admins only ❌" });
}

// ===============================
// 👤 AUTH APIs
// ===============================

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
      [name, email, hashedPassword]
    );
    res.status(201).json({ message: "User registered successfully ✅" });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).json({ error: "User not found ❌" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password ❌" });

    res.json({
      message: "Login successful ✅",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// 🛒 PRODUCT APIs
// ===============================

// GET products
app.get("/products", async (req, res) => {
  try {
    const { search, minPrice, maxPrice, category } = req.query;
    let query = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (minPrice) {
      query += " AND price >= ?";
      params.push(minPrice);
    }
    if (maxPrice) {
      query += " AND price <= ?";
      params.push(maxPrice);
    }
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    const [products] = await db.execute(query, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "DB error" });
  }
});

// GET single product
app.get("/products/:id", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "DB error" });
  }
});

// CREATE product (Admin)
app.post("/products", isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    if (!name || price == null || stock == null)
      return res.status(400).json({ error: "name, price, stock required" });

    const [result] = await db.execute(
      "INSERT INTO products (name, description, price, stock, category) VALUES (?, ?, ?, ?, ?)",
      [name, description || "", price, stock, category || ""]
    );
    res.status(201).json({ id: result.insertId, name, description, price, stock, category });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "DB error" });
  }
});

// UPDATE product (Admin)
app.put("/products/:id", isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    const [result] = await db.execute(
      "UPDATE products SET name=?, description=?, price=?, stock=?, category=? WHERE id=?",
      [name, description, price, stock, category, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product updated ✅" });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "DB error" });
  }
});

// DELETE product (Admin)
app.delete("/products/:id", isAdmin, async (req, res) => {
  try {
    const [result] = await db.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted ✅" });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || "DB error" });
  }
});

// ===============================
// 🛒 ORDER APIs
// ===============================

// CREATE order
app.post("/orders", async (req, res) => {
  const { product_id, quantity, delivery_address, user_id } = req.body;
  if (!product_id || !quantity || !delivery_address || !user_id)
    return res.status(400).json({ error: "All fields are required" });

  try {
    await db.beginTransaction();

    // Check product and stock
    const [products] = await db.execute("SELECT * FROM products WHERE id = ?", [product_id]);
    if (products.length === 0) throw new Error("Product not found");
    const product = products[0];
    if (product.stock < quantity) throw new Error("Not enough stock");

    // Check user exists
    const [users] = await db.execute("SELECT * FROM users WHERE id = ?", [user_id]);
    if (users.length === 0) throw new Error("User not found");

    // Insert order
    const totalPrice = product.price * quantity;
    const [orderResult] = await db.execute(
      "INSERT INTO orders (user_id, product_id, quantity, total_price, delivery_address, status) VALUES (?, ?, ?, ?, ?, 'Pending')",
      [user_id, product_id, quantity, totalPrice, delivery_address]
    );

    // Reduce stock
    await db.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product_id]);

    await db.commit();

    res.status(201).json({
      message: "Order placed ✅",
      order_id: orderResult.insertId,
      product: product.name,
      quantity,
      total_price: totalPrice,
      status: "Pending",
    });
  } catch (err) {
    await db.rollback();
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET orders
app.get("/orders", async (req, res) => {
  try {
    const { user_id, role } = req.query;
    let sql, params = [];

    if (role === "admin") {
      sql = `
        SELECT o.id AS order_id, u.name AS customer, p.name AS product,
               o.quantity, o.total_price, o.status, o.created_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN products p ON o.product_id = p.id
        ORDER BY o.created_at DESC
      `;
    } else {
      sql = `
        SELECT o.id AS order_id, p.name AS product,
               o.quantity, o.total_price, o.status, o.created_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `;
      params = [user_id];
    }

    const [orders] = await db.execute(sql, params);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE order status (Admin)
app.put("/orders/:id/status", isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    const allowedStatus = ["Pending", "Shipped", "Delivered"];
    if (!allowedStatus.includes(status)) return res.status(400).json({ error: "Invalid status value" });

    const [result] = await db.execute("UPDATE orders SET status=? WHERE id=?", [status, orderId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Order not found" });

    res.json({ message: `Order status updated to ${status} ✅` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CANCEL order
app.delete("/orders/:id", async (req, res) => {
  const { user_id, role } = req.body;
  const orderId = req.params.id;

  try {
    await db.beginTransaction();

    const [orders] = await db.execute("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (orders.length === 0) throw new Error("Order not found");

    const order = orders[0];
    if (role !== "admin" && Number(user_id) !== order.user_id) throw new Error("Forbidden ❌");

    // Restore stock
    await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [order.quantity, order.product_id]);

    // Delete order
    await db.execute("DELETE FROM orders WHERE id = ?", [orderId]);

    await db.commit();
    res.json({ message: "Order cancelled successfully ✅" });
  } catch (err) {
    await db.rollback();
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));


