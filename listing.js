// ---------- GRAB THE PAGE AREA ----------
const page = document.getElementById("listingPage");

// ---------- READ THE LISTING NUMBER FROM THE ADDRESS ----------
// Address looks like listing.html?id=25, so we read the "25"
const params = new URLSearchParams(window.location.search);
const listingId = Number(params.get("id"));

// Shown when the listing does not exist
const notFoundHtml =
  '<p class="empty">This listing could not be found. It may have been deleted.</p>';

// ---------- 1. LOAD THE LISTING ----------
async function loadListing() {
  try {
    // No valid number in the address
    if (!listingId) {
      page.innerHTML = notFoundHtml;
      return;
    }

    // Ask Supabase for this one listing
    const { data: item, error } = await db
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle();

    if (error || !item) {
      page.innerHTML = notFoundHtml;
      return;
    }

    // Who is logged in? (used to spot the seller's own listing)
    const { data: sessionData } = await db.auth.getSession();
    const myId = sessionData.session ? sessionData.session.user.id : null;
    const isMine = myId !== null && item.user_id === myId;

    showListing(item, isMine);
    loadMoreFromSeller(item);
  } catch (err) {
    // If anything unexpected fails, show what went wrong instead of "Loading..." forever
    console.error(err);
    page.textContent = "Something went wrong: " + err.message;
  }
}

// ---------- 2. DRAW THE LISTING ----------
function showListing(item, isMine) {
  // Put the item's name in the browser tab
  document.title = item.title + " - CampusMarket";

  const images = item.images || [];

  // Big photo (or the emoji if there are no photos)
  const bigPhoto = images.length > 0
    ? `<img id="mainPhoto" src="${escapeHtml(images[0])}" alt="${escapeHtml(item.title)}">`
    : escapeHtml(item.emoji || "🛍️");

  // Small photos to tap, only if there are 2 or more
  const thumbs = images.length > 1
    ? `<div class="listing-thumbs">` +
      images.map(function (url, i) {
        return `<img class="thumb" data-index="${i}" src="${escapeHtml(url)}" alt="">`;
      }).join("") +
      `</div>`
    : "";

  // Seller name: a link to their page if the listing has an owner
  const sellerName = escapeHtml(item.seller_name || "Seller");
  const sellerHtml = item.user_id
    ? `<a class="seller-link" href="seller.html?id=${encodeURIComponent(item.user_id)}">👤 ${sellerName} · see all their items</a>`
    : `<p class="seller-link">👤 ${sellerName}</p>`;

  // The contact button depends on the situation
  let contactHtml;
  if (item.is_sold) {
    // Sold items cannot be contacted
    contactHtml = `<p class="sold-note">This item has been sold.</p>`;
  } else if (isMine) {
    // Your own listing: no WhatsApp button
    contactHtml = `<a class="whatsapp-btn own-listing" href="my-listings.html">This is your listing. Manage it in My Listings</a>`;
  } else {
    // Someone else's listing: WhatsApp with a ready message
    const message = "Hi, I saw your listing on CampusMarket: " + item.title +
                    " (ZMW" + item.price + "). Is it still available?";
    const link = "https://wa.me/" + toWhatsAppNumber(item.phone) +
                 "?text=" + encodeURIComponent(message);
    contactHtml = `<a class="whatsapp-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener">Chat with seller on WhatsApp</a>`;
  }

  // Build the whole page
  page.innerHTML = `
    <div class="listing-photo" style="background:${safeColor(item.color)}">${bigPhoto}</div>
    ${thumbs}
    <div class="listing-body">
      <p class="listing-price">ZMW${Number(item.price)}</p>
      <h2 class="listing-title">${escapeHtml(item.title)}</h2>
      <p class="listing-category">${escapeHtml(categoryNames[item.category] || "Other")}</p>
      ${item.description ? `<p class="listing-description">${escapeHtml(item.description)}</p>` : ""}
      ${sellerHtml}
      ${contactHtml}
      <button id="shareBtn" class="share-btn" type="button">🔗 Share this listing</button>
    </div>
    <div id="moreArea"></div>
  `;

  // Tapping a small photo swaps the big photo
  const mainPhoto = document.getElementById("mainPhoto");
  page.querySelectorAll(".thumb").forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      mainPhoto.src = images[Number(thumb.dataset.index)];
    });
  });

  // The share button
  document.getElementById("shareBtn").addEventListener("click", function () {
    shareListing(item);
  });
}

// ---------- 3. SHARE BUTTON ----------
async function shareListing(item) {
  const url = window.location.href;
  const text = item.title + " for ZMW" + item.price + " on CampusMarket";
  const btn = document.getElementById("shareBtn");

  // On phones this opens the normal share sheet (WhatsApp, etc.)
  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, text: text, url: url });
    } catch (e) {
      // The person closed the share sheet. Nothing to do.
    }
    return;
  }

  // On a laptop we copy the link instead
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "✅ Link copied!";
    setTimeout(function () {
      btn.textContent = "🔗 Share this listing";
    }, 2000);
  } catch (e) {
    prompt("Copy this link:", url);
  }
}

// ---------- 4. "MORE FROM THIS SELLER" ROW ----------
async function loadMoreFromSeller(item) {
  // Listings with no owner have no seller to show
  if (!item.user_id) return;

  // The seller's other available items, newest first, at most 6
  const { data } = await db
    .from("listings")
    .select("id, title, price, color, emoji, images")
    .eq("user_id", item.user_id)
    .eq("is_sold", false)
    .neq("id", item.id)
    .order("created_at", { ascending: false })
    .limit(6);

  // Nothing else to show? Leave the area empty.
  if (!data || data.length === 0) return;

  document.getElementById("moreArea").innerHTML = `
    <div class="more-header">
      <h3>More from ${escapeHtml(item.seller_name || "this seller")}</h3>
      <a href="seller.html?id=${encodeURIComponent(item.user_id)}">See all</a>
    </div>
    <div class="listing-grid">${data.map(cardHtml).join("")}</div>
  `;
}

// ---------- RUN WHEN THE PAGE OPENS ----------
loadListing();