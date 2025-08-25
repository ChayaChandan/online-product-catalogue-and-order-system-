const API = "http://localhost:5000";
const user = JSON.parse(localStorage.getItem("user"));

// Only admin access
if (!user || user.role !== "admin") {
  alert("❌ Access denied! Admins only.");
  window.location.href = "login.html";
}

// Logout
function logout() { localStorage.removeItem("user"); window.location.href = "login.html"; }

// DOM
const productsDiv = document.getElementById("products");
const addForm = document.getElementById("addProductForm");
const msgDiv = document.getElementById("msg");

// Load products
async function loadProducts() { /* ...existing code... */ }

// Add product
addForm.addEventListener("submit", async e => { /* ...existing code... */ });

// Update & Delete product
async function updateProduct(id){ /* ...existing code... */ }
async function deleteProduct(id){ /* ...existing code... */ }

// Init
loadProducts();
