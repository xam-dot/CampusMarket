// ---------- GRAB THE PAGE AREA ----------
const storePage = document.getElementById("storePage");

// ---------- READ THE STORE'S LINK NAME FROM THE ADDRESS ----------
// Address looks like store.html?name=zams-tech-store
const params = new URLSearchParams(window.location.search);
const slug = (params.get("name") || "").toLowerCase();

// Shown when the store does not exist
const notFoundHtml =
  '<p class="empty">This store could not be found. Check the link and try again.</p>';

// ---------- 1. LOAD THE STORE AND ITS PRODUCTS ----------
async function loadStore() {
  try {
    // Link names are 3 to 30 characters: letters, numbers and single dashes
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 30) {
      storePage.innerHTML = notFoundHtml;
      return;
    }

    // Find the store with this link name
    const { data: store, error } = await db
      .from("stores")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !store) {
      storePage.innerHTML = notFoundHtml;
      return;
    }

    // All of this owner's products that are still available, newest first
    const { data: items } = await db
      .from("listings")
      .select("*")
      .eq("user_id", store.owner_id)
      .eq("is_sold", false)
      .order("created_at", { ascending: false });

    // Is the person looking at the page the store's owner?
    const { data: sessionData } = await db.auth.getSession();
    const myId = sessionData.session ? sessionData.session.user.id : null;
    const isOwner = myId !== null && myId === store.owner_id;

    showStore(store, items || [], isOwner);
  } catch (err) {
    // Show what went wrong instead of "Loading..." forever
    console.error(err);
    storePage.textContent = "Something went wrong: " + err.message;
  }
}

// ---------- 2. DRAW THE STORE ----------
function showStore(store, items, isOwner) {
  // Put the store's name in the browser tab
  document.title = store.name + " - CampusMarket";

  // Logo: the picture if there is one, otherwise a circle with the first letter
  const initial = escapeHtml(store.name.trim().charAt(0).toUpperCase() || "S");
  const logoHtml = store.logo_url
    ? `<img src="${escapeHtml(store.logo_url)}" alt="${escapeHtml(store.name)} logo">`
    : initial;

  // The main button: the owner sees "Add a product", visitors see WhatsApp
  let mainButton;
  if (isOwner) {
    mainButton = `<a class="store-btn" href="sell.html">+ Add a product</a>`;
  } else {
    const message = "Hi, I found your store " + store.name + " on CampusMarket.";
    const link = "https://wa.me/" + toWhatsAppNumber(store.whatsapp) +
                 "?text=" + encodeURIComponent(message);
    mainButton = `<a class="store-btn whatsapp" href="${escapeHtml(link)}" target="_blank" rel="noopener">Message store on WhatsApp</a>`;
  }

  // The product count, with the right singular or plural word
  const count = items.length + (items.length === 1 ? " product" : " products");

  // What to show under "Products"
  let productsHtml;
  if (items.length === 0) {
    productsHtml = isOwner
      ? '<p class="empty">You have no products yet. Tap "Add a product" to post your first one.</p>'
      : '<p class="empty">This store has no products right now. Check back soon.</p>';
  } else {
    productsHtml = `<div class="listing-grid">${items.map(cardHtml).join("")}</div>`;
  }

  // Build the whole page
  storePage.innerHTML = `
    <div class="store-banner"></div>
    <div class="store-head">
      <div class="store-logo">${logoHtml}</div>
      <h2 class="store-name">${escapeHtml(store.name)}</h2>
      <p class="store-count">${count}</p>
      ${store.description ? `<p class="store-about">${escapeHtml(store.description)}</p>` : ""}
      <div class="store-actions">
        ${mainButton}
        <button id="shareStoreBtn" class="store-btn light" type="button">🔗 Share</button>
      </div>
    </div>
    <h3 class="store-products-title">Products</h3>
    ${productsHtml}
  `;

  // The share button
  document.getElementById("shareStoreBtn").addEventListener("click", function () {
    shareStore(store);
  });
}

// ---------- 3. SHARE BUTTON ----------
async function shareStore(store) {
  const url = window.location.href;
  const btn = document.getElementById("shareStoreBtn");

  // On phones this opens the normal share sheet (WhatsApp, etc.)
  if (navigator.share) {
    try {
      await navigator.share({
        title: store.name,
        text: "Visit " + store.name + " on CampusMarket",
        url: url
      });
    } catch (e) {
      // The person closed the share sheet. Nothing to do.
    }
    return;
  }

  // On a laptop we copy the link instead
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "✅ Copied";
    setTimeout(function () {
      btn.textContent = "🔗 Share";
    }, 2000);
  } catch (e) {
    prompt("Copy this link:", url);
  }
}

// ---------- RUN WHEN THE PAGE OPENS ----------
loadStore();