const API = "http://localhost:5000";
const $ = id => document.getElementById(id);

// Helpers
function saveUser(u) { localStorage.setItem("user", JSON.stringify(u)); }
function getUser() { return JSON.parse(localStorage.getItem("user")); }
function requireLogin() {
  const u = getUser();
  if (!u) window.location.href = "login.html";
  if (u.role === "admin") window.location.href = "admin-dashboard.html"; // redirect admin
  return u;
}

// Logout
function logout() { localStorage.removeItem("user"); window.location.href="login.html"; }

// Navigation
function goToOrders() { window.location.href="orders.html"; }
function goBack() { window.location.href="dashboard.html"; }

// Signup & Login remain same
async function signupUser(e){ /* ...existing code... */ }
async function loginUser(e){ /* ...existing code... */ }

// Dashboard
async function loadDashboard(){
  const user = requireLogin();
  $("welcome").textContent = `Hello, ${user.name}`;
  const container = $("products");
  try{
    const res = await fetch(`${API}/products`);
    const products = await res.json();
    container.innerHTML = "";
    products.forEach(p=>{
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<h3>${p.name}</h3><p>${p.description}</p><p>₹${p.price} | Stock: ${p.stock}</p><button onclick="placeOrder(${user.id},${p.id},1)">Buy</button>`;
      container.appendChild(div);
    });
  }catch(e){ console.error(e); }
}

// Orders (users only)
async function loadOrders(){
  const user = requireLogin();
  $("welcome").textContent = `Hello, ${user.name}`;
  const container = $("orders");
  try{
    const res = await fetch(`${API}/orders?user_id=${user.id}`);
    const orders = await res.json();
    container.innerHTML = "";
    if(!orders.length) { container.innerHTML = "<p>No orders yet</p>"; return; }
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Product</th><th>Qty</th><th>Total</th><th>Date</th><th>Action</th></tr>`;
    orders.forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${o.product}</td><td>${o.quantity}</td><td>₹${o.total_price}</td><td>${new Date(o.created_at).toLocaleString()}</td><td><button onclick='cancelOrder(${o.order_id})'>Cancel</button></td>`;
      table.appendChild(tr);
    });
    container.appendChild(table);
  }catch(e){ console.error(e); }
}

// Place order
async function placeOrder(user_id, product_id, qty){
  const res = await fetch(`${API}/orders`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({user_id,product_id,quantity:qty})
  });
  const data = await res.json();
  if(!res.ok) return alert(data.error||"Order failed");
  alert("✅ Order placed");
  if(window.location.pathname.includes("dashboard.html")) loadDashboard();
  if(window.location.pathname.includes("orders.html")) loadOrders();
}

// Cancel order
async function cancelOrder(orderId){
  const user = getUser();
  if(!confirm("Cancel order?")) return;
  const res = await fetch(`${API}/orders/${orderId}`,{
    method:"DELETE",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({user_id:user.id,role:user.role})
  });
  const data = await res.json();
  if(!res.ok) return alert(data.error||"Cancel failed");
  alert("✅ Order cancelled");
  loadOrders();
}

// Auto attach
document.addEventListener("DOMContentLoaded",()=>{
  if($("signup-form")) $("signup-form").addEventListener("submit",signupUser);
  if($("login-form")) $("login-form").addEventListener("submit",loginUser);
  if(window.location.pathname.includes("dashboard.html")) loadDashboard();
  if(window.location.pathname.includes("orders.html")) loadOrders();
});
