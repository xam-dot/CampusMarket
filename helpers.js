// Shared helper code used by the listing page and the seller page.

// Friendly names for categories
const categoryNames = {
  books: "Books",
  electronics: "Electronics",
  clothes: "Clothes",
  beauty: "Beauty & Personal Care",
  services: "Student Services",
  other: "Other"
};

// Cleans text so hidden code typed by a user can never run on the page
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

// Turns 0972209371 into 260972209371 (WhatsApp wants the country code)
function toWhatsAppNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "260" + digits.slice(1);
  }
  return digits;
}

// The picture inside a card: real photo if there is one, otherwise the emoji
function pictureHtml(item) {
  if (item.images && item.images.length > 0) {
    return `<img src="${escapeHtml(item.images[0])}" alt="" loading="lazy">`;
  }
  return escapeHtml(item.emoji || "🛍️");
}

// One product card. It links to that listing's own page.
function cardHtml(item) {
  return `
    <a class="card" href="listing.html?id=${Number(item.id)}">
      <div class="card-img" style="background:${safeColor(item.color)}">${pictureHtml(item)}</div>
      <p class="card-title">ZMW${Number(item.price)} · ${escapeHtml(item.title)}</p>
    </a>
  `;
}