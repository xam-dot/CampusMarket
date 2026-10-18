// ---------- GRAB THE PAGE AREA ----------
const page = document.getElementById("listingPage");

// This page has its own bottom bar (WhatsApp + share), so hide the normal one
const bottomNav = document.querySelector(".bottom-nav");
if (bottomNav) bottomNav.style.display = "none";

// ---------- READ THE LISTING NUMBER FROM THE ADDRESS ----------
// Address looks like listing.html?id=25, so we read the "25"
const params = new URLSearchParams(window.location.search);
const listingId = Number(params.get("id"));

// Shown when the listing does not exist
const notFoundHtml =
  '<p class="empty">This listing could not be found. It may have been deleted.</p>';

// ---------- "2 DAYS AGO" STYLE TIME ----------
function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (isNaN(seconds)) return "";
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hours / 24);
  if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
  return new Date(dateString).toLocaleDateString();
}

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
    // Show what went wrong instead of "Loading..." forever
    console.error(err);
    page.textContent = "Something went wrong: " + err.message;
  }
}

// ---------- 2. DRAW THE LISTING ----------
function showListing(item, isMine) {
  // Put the item's name in the browser tab
  document.title = item.title + " - CampusMarket";

  const images = item.images || [];
  const soldBadge = item.is_sold ? '<span class="sold-badge">SOLD</span>' : "";

  // ----- The photo gallery -----
  let galleryHtml;
  if (images.length > 0) {
    // One slide per photo
    const slides = images.map(function (url) {
      return `<div class="gallery-slide"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.title)}"></div>`;
    }).join("");

    // Counter, dots and arrows only when there are 2 or more photos
    const many = images.length > 1;
    const counter = many ? `<span class="gallery-count" id="galleryCount">1/${images.length}</span>` : "";
    const dots = many
      ? `<div class="gallery-dots">${images.map(function (_, i) {
          return `<span class="dot${i === 0 ? " active" : ""}"></span>`;
        }).join("")}</div>`
      : "";
    const arrows = many
      ? `<button type="button" class="gallery-arrow left" id="galleryPrev" aria-label="Previous photo">‹</button>
         <button type="button" class="gallery-arrow right" id="galleryNext" aria-label="Next photo">›</button>`
      : "";

    galleryHtml = `
      <div class="gallery">
        <div class="gallery-track" id="galleryTrack">${slides}</div>
        ${counter}${dots}${arrows}${soldBadge}
      </div>`;
  } else {
    // No photos: show the emoji on a coloured square
    galleryHtml = `
      <div class="gallery gallery-empty" style="background:${safeColor(item.color)}">
        ${escapeHtml(item.emoji || "🛍️")}${soldBadge}
      </div>`;
  }

  // ----- Seller card (a link to their page if the listing has an owner) -----
  const sellerName = item.seller_name || "Seller";
  const initial = escapeHtml(sellerName.trim().charAt(0).toUpperCase() || "S");
  const sellerInner = `
    <div class="seller-avatar">${initial}</div>
    <div class="seller-text">
      <p class="seller-name">${escapeHtml(sellerName)}</p>
      <p class="seller-sub">${item.user_id ? "View all their items" : "Seller"}</p>
    </div>
    ${item.user_id ? '<span class="seller-arrow">›</span>' : ""}`;
  const sellerHtml = item.user_id
    ? `<a class="info-card seller-card" href="seller.html?id=${encodeURIComponent(item.user_id)}">${sellerInner}</a>`
    : `<div class="info-card seller-card">${sellerInner}</div>`;

  // ----- The main button in the bottom bar -----
  let mainAction;
  if (item.is_sold) {
    mainAction = `<p class="action-sold">This item has been sold</p>`;
  } else if (isMine) {
    mainAction = `<a class="action-main manage" href="my-listings.html">Manage in My Listings</a>`;
  } else {
    const message = "Hi, I saw your listing on CampusMarket: " + item.title +
                    " (ZMW" + item.price + "). Is it still available?";
    const link = "https://wa.me/" + toWhatsAppNumber(item.phone) +
                 "?text=" + encodeURIComponent(message);
    mainAction = `<a class="action-main" href="${escapeHtml(link)}" target="_blank" rel="noopener">Chat on WhatsApp</a>`;
  }

  // ----- Build the whole page -----
  page.innerHTML = `
    ${galleryHtml}

    <div class="info-card">
      <p class="detail-price">ZMW${Number(item.price)}</p>
      <h2 class="detail-title">${escapeHtml(item.title)}</h2>
      <div class="detail-meta">
        <span class="chip">${escapeHtml(categoryNames[item.category] || "Other")}</span>
        <span class="posted">Posted ${escapeHtml(timeAgo(item.created_at))}</span>
      </div>
    </div>

    ${item.description ? `
    <div class="info-card">
      <h3>Description</h3>
      <p class="detail-description">${escapeHtml(item.description)}</p>
    </div>` : ""}

    ${sellerHtml}

    <div class="info-card safety">
      <strong>🛡️ Stay safe</strong>
      <p>Meet in a public place, check the item before you pay, and never send money in advance.</p>
    </div>

    <div id="moreArea"></div>

    <div class="action-bar">
      ${mainAction}
      <button id="shareBtn" class="action-share" type="button" aria-label="Share this listing">🔗</button>
    </div>
  `;

  // ----- Make the gallery counter, dots and arrows work -----
  const track = document.getElementById("galleryTrack");
  if (track && images.length > 1) {
    const count = document.getElementById("galleryCount");
    const dotList = page.querySelectorAll(".dot");

    // When the person swipes, work out which photo is showing
    track.addEventListener("scroll", function () {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      count.textContent = (index + 1) + "/" + images.length;
      dotList.forEach(function (d, i) {
        d.classList.toggle("active", i === index);
      });
    });

    // Arrow buttons move one photo at a time
    document.getElementById("galleryPrev").addEventListener("click", function () {
      track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
    });
    document.getElementById("galleryNext").addEventListener("click", function () {
      track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
    });
  }

  // ----- The share button -----
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

  // On a laptop we copy the link instead and show a tick for 2 seconds
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "✅";
    setTimeout(function () {
      btn.textContent = "🔗";
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