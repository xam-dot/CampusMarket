// ---------- GRAB THE PAGE AREA ----------
const sellerPage = document.getElementById("sellerPage");

// ---------- READ THE SELLER'S ID FROM THE ADDRESS ----------
// Address looks like seller.html?id=..., so we read the id part
const params = new URLSearchParams(window.location.search);
const sellerId = params.get("id") || "";

async function loadSeller() {
  try {
    // A real seller id is 36 characters of letters, numbers and dashes.
    // Anything else is rejected before we ask the database.
    if (!/^[0-9a-fA-F-]{36}$/.test(sellerId)) {
      sellerPage.innerHTML = '<p class="empty">This seller could not be found.</p>';
      return;
    }

    // Get all of this seller's available listings, newest first
    const { data, error } = await db
      .from("listings")
      .select("*")
      .eq("user_id", sellerId)
      .eq("is_sold", false)
      .order("created_at", { ascending: false });

    if (error) {
      sellerPage.innerHTML = '<p class="empty">Could not load this seller. Check your connection.</p>';
      return;
    }

    // Nothing available right now
    if (!data || data.length === 0) {
      sellerPage.innerHTML = '<p class="empty">This seller has nothing listed right now.</p>';
      return;
    }

    // The seller's name comes from their newest listing
    const name = data[0].seller_name || "Seller";
    document.title = name + " - CampusMarket";

    // Draw the name, the item count, and a grid of cards
    sellerPage.innerHTML = `
      <div class="seller-header">
        <h2>👤 ${escapeHtml(name)}</h2>
        <p>${data.length} item${data.length === 1 ? "" : "s"} available</p>
      </div>
      <div class="listing-grid">${data.map(cardHtml).join("")}</div>
    `;
  } catch (err) {
    // If anything unexpected fails, show what went wrong instead of "Loading..." forever
    console.error(err);
    sellerPage.innerHTML = '<p class="empty"></p>';
    sellerPage.firstChild.textContent = "Something went wrong: " + err.message;
  }
}

// Run when the page opens
loadSeller();