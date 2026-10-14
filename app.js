// ---------- 1. SETUP ----------
// The product list starts empty. We fill it from the database (see the bottom).
let products = [];

// Friendly names shown in the popup (instead of "beauty", "services")
const categoryNames = {
  books: "Books",
  electronics: "Electronics",
  clothes: "Clothes",
  beauty: "Beauty & Personal Care",
  services: "Student Services",
  other: "Other"
};

// ---------- 2. GRAB THE PARTS OF THE PAGE WE NEED ----------
const productGrid = document.getElementById("productGrid");
const searchBox = document.getElementById("searchBox");
const pills = document.querySelectorAll(".pill");

// The popup parts
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const modalImg = document.getElementById("modalImg");
const modalThumbs = document.getElementById("modalThumbs");
const modalPrice = document.getElementById("modalPrice");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalDescription = document.getElementById("modalDescription");
const whatsappBtn = document.getElementById("whatsappBtn");

// ---------- 3. REMEMBER WHAT THE USER HAS CHOSEN ----------
let selectedCategory = "all";
// The id of the logged-in person (stays empty if nobody is logged in)
let currentUserId = null;

// ---------- 4. SAFETY HELPERS ----------
// Students type the titles, so we must clean their text before putting it in
// the page. Otherwise someone could sneak hidden code into a title.
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

  // Keep only items that pass BOTH checks
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

  // Turn each product into a card. data-id tells us which product was tapped.
  productGrid.innerHTML = filtered
    .map(function (product) {
      return `
        <a class="card" href="#" data-id="${Number(product.id)}">
          <div class="card-img" style="background:${safeColor(product.color)}">${cardPicture(product)}</div>
          <p class="card-title">ZMW${Number(product.price)} · ${escapeHtml(product.title)}</p>
        </a>
      `;
    })
    .join("");
}

// ---------- 7. SEARCH ----------
searchBox.addEventListener("input", showProducts);

// ---------- 8. CATEGORY PILLS ----------
pills.forEach(function (pill) {
  pill.addEventListener("click", function () {
    pills.forEach(function (p) {
      p.classList.remove("active");
    });
    pill.classList.add("active");
    selectedCategory = pill.dataset.category;
    showProducts();
  });
});

// ---------- 9. TURN A PHONE NUMBER INTO WHATSAPP FORMAT ----------
// WhatsApp links need the country code and no leading zero.
// Example: 0972209371 becomes 260972209371 (260 is Zambia's code)
function toWhatsAppNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, ""); // keep digits only
  if (digits.startsWith("0")) {
    digits = "260" + digits.slice(1);
  }
  return digits;
}

// ---------- 10. SHOW ONE PHOTO IN THE POPUP'S BIG PHOTO AREA ----------
function showModalPhoto(product, index) {
  modalImg.innerHTML = "";                         // clear the old photo
  modalImg.style.background = safeColor(product.color);

  if (product.images && product.images.length > 0) {
    // Real photo
    const img = document.createElement("img");
    img.src = product.images[index];
    img.alt = product.title;
    modalImg.appendChild(img);
  } else {
    // No photo: show the emoji
    modalImg.textContent = product.emoji || "🛍️";
  }
}

// ---------- 11. OPEN THE POPUP FOR ONE PRODUCT ----------
function openModal(product) {
  // Big photo: start with the first one
  showModalPhoto(product, 0);

  // Small photos: only if there are 2 or more
  modalThumbs.innerHTML = "";
  if (product.images && product.images.length > 1) {
    product.images.forEach(function (url, index) {
      const thumb = document.createElement("img");
      thumb.src = url;
      thumb.className = "thumb";
      thumb.alt = "";
      // Tapping a small photo shows it as the big photo
      thumb.addEventListener("click", function () {
        showModalPhoto(product, index);
      });
      modalThumbs.appendChild(thumb);
    });
  }

  // Text details (textContent is safe: it never runs hidden code)
  modalPrice.textContent = "ZMW" + product.price;
  modalTitle.textContent = product.title;
  modalCategory.textContent = categoryNames[product.category] || "Other";
  modalDescription.textContent = product.description || "";

    // Is this MY OWN listing? (Its owner id matches the logged-in person.)
  const isMine = currentUserId !== null && product.user_id === currentUserId;

  if (isMine) {
    // My own listing: no WhatsApp button. Point to My Listings instead.
    whatsappBtn.textContent = "This is your listing. Manage it in My Listings";
    whatsappBtn.href = "my-listings.html";
    whatsappBtn.removeAttribute("target");   // open in the same tab
    whatsappBtn.classList.add("own-listing"); // grey style
  } else {
    // Someone else's listing: the normal WhatsApp button
    const message = "Hi, I saw your listing on CampusMarket: " + product.title +
                    " (ZMW" + product.price + "). Is it still available?";

    whatsappBtn.textContent = "Chat with seller on WhatsApp";
    whatsappBtn.href =
      "https://wa.me/" + toWhatsAppNumber(product.phone) +
      "?text=" + encodeURIComponent(message);
    whatsappBtn.target = "_blank";             // open WhatsApp in a new tab
    whatsappBtn.classList.remove("own-listing"); // normal green style
  }

  // Show the popup
  modal.classList.remove("hidden");
}

// ---------- 12. WHEN A CARD IS TAPPED ----------
productGrid.addEventListener("click", function (event) {
  const card = event.target.closest(".card");
  if (!card) return;

  event.preventDefault();

  const id = Number(card.dataset.id);
  const product = products.find(function (p) {
    return p.id === id;
  });

  openModal(product);
});

// ---------- 13. CLOSING THE POPUP ----------
closeModal.addEventListener("click", function () {
  modal.classList.add("hidden");
});

modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});

// ---------- 14. LOAD LISTINGS FROM THE DATABASE ----------
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

// ---------- 15. LOGIN / LOGOUT LINK ----------
const authLink = document.getElementById("authLink");

async function setupAuthLink() {
  // Ask Supabase: is someone logged in on this browser?
  const { data } = await db.auth.getSession();

  if (data.session) {
     // Remember who is logged in (used to spot my own listings)
    currentUserId = data.session.user.id;
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