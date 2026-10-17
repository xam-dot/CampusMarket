// ---------- 1. SETUP ----------
// The product list starts empty. We fill it from the database (see the bottom).
let products = [];

// ---------- 2. GRAB THE PARTS OF THE PAGE WE NEED ----------
const productGrid = document.getElementById("productGrid");
const searchBox = document.getElementById("searchBox");
const pills = document.querySelectorAll(".pill");

// ---------- 3. REMEMBER WHAT THE USER HAS CHOSEN ----------
// Starts as "all" so every item shows when the page opens
let selectedCategory = "all";

// ---------- 4. SAFETY HELPERS ----------
// People type the titles, so we clean their text before putting it in the page.
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only accept normal colour codes like #ffd9c7, otherwise use grey
function safeColor(color) {
  return /^#[0-9a-fA-F]{3,8}$/.test(color || "") ? color : "#e8e8e8";
}

// ---------- 5. WHAT GOES INSIDE A CARD'S PICTURE BOX ----------
// Real photo if the listing has one, otherwise the emoji
function cardPicture(product) {
  if (product.images && product.images.length > 0) {
    return `<img src="${escapeHtml(product.images[0])}" alt="" loading="lazy">`;
  }
  return escapeHtml(product.emoji || "🛍️");
}

// ---------- 6. SHOW PRODUCTS ----------
function showProducts() {
  // What the user typed, in lowercase so "Laptop" matches "laptop"
  const searchText = searchBox.value.toLowerCase().trim();

  // Keep only items that pass BOTH checks: category and search text
  const filtered = products.filter(function (product) {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchText);
    return matchesCategory && matchesSearch;
  });

  // Nothing matched: show a friendly message
  if (filtered.length === 0) {
    productGrid.innerHTML = '<p class="empty">No items found. Try another search.</p>';
    return;
  }

  // Turn each product into a card. Each card is a LINK to that listing's own page.
  productGrid.innerHTML = filtered
    .map(function (product) {
      return `
        <a class="card" href="listing.html?id=${Number(product.id)}">
          <div class="card-img" style="background:${safeColor(product.color)}">${cardPicture(product)}</div>
          <p class="card-title">ZMW${Number(product.price)} · ${escapeHtml(product.title)}</p>
        </a>
      `;
    })
    .join("");
}

// ---------- 7. SEARCH ----------
// Runs every time the user types or deletes a letter
searchBox.addEventListener("input", showProducts);

// ---------- 8. CATEGORY PILLS ----------
pills.forEach(function (pill) {
  pill.addEventListener("click", function () {
    // Remove the orange look from every pill
    pills.forEach(function (p) {
      p.classList.remove("active");
    });
    // Make the clicked pill orange
    pill.classList.add("active");
    // Save its category (from data-category in the HTML), then refresh
    selectedCategory = pill.dataset.category;
    showProducts();
  });
});

// ---------- 9. LOAD LISTINGS FROM THE DATABASE ----------
async function loadProducts() {
  productGrid.innerHTML = '<p class="empty">Loading listings...</p>';

  // Get every listing that is NOT sold, newest first
  const { data, error } = await db
    .from("listings")
    .select("*")
    .eq("is_sold", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase error:", error);
    productGrid.innerHTML = '<p class="empty">Could not load listings. Check your connection.</p>';
    return;
  }

  products = data;
  showProducts();
}

loadProducts();

// ---------- 10. LOGIN / LOGOUT LINK ----------
const authLink = document.getElementById("authLink");

async function setupAuthLink() {
  // Ask Supabase: is someone logged in on this browser?
  const { data } = await db.auth.getSession();

  if (data.session) {
    // Change the link to "Logout"
    authLink.textContent = "Logout";
    authLink.href = "#";
    authLink.addEventListener("click", async function (e) {
      e.preventDefault();
      await db.auth.signOut();
      window.location.reload();
    });
  }
}

setupAuthLink();