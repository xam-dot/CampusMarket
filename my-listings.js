// ---------- SETTINGS ----------
const BUCKET = "listing-images"; // the photo folder from step 7a

// ---------- GRAB THE PARTS OF THE PAGE ----------
const myList = document.getElementById("myList");
const pageMessage = document.getElementById("pageMessage");
const editModal = document.getElementById("editModal");
const closeEdit = document.getElementById("closeEdit");
const editForm = document.getElementById("editForm");
const saveEditBtn = document.getElementById("saveEditBtn");

// Who is logged in, and their listings
let currentUser = null;
let myListings = [];
// The id of the listing being edited right now
let editingId = null;

// ---------- SAFETY HELPER ----------
// Cleans text so hidden code in a title can never run
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- SHOW A MESSAGE ("error" = red, "success" = green) ----------
function showMessage(text, type) {
  pageMessage.textContent = text;
  pageMessage.className = "auth-message " + type;
}

// ---------- 1. ON PAGE OPEN: MAKE SURE SOMEONE IS LOGGED IN ----------
async function startPage() {
  const { data } = await db.auth.getSession();

  // Nobody logged in? Send them to the login page.
  if (!data.session) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = data.session.user;
  loadMyListings();
}

// ---------- 2. LOAD ONLY MY LISTINGS ----------
async function loadMyListings() {
  myList.innerHTML = '<p class="empty">Loading your listings...</p>';

  const { data, error } = await db
    .from("listings")
    .select("*")
    .eq("user_id", currentUser.id)   // only listings that belong to me
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    myList.innerHTML = '<p class="empty">Could not load your listings.</p>';
    return;
  }

  myListings = data;
  renderList();
}

// ---------- 3. DRAW THE LIST ----------
function renderList() {
  // No listings yet
  if (myListings.length === 0) {
    myList.innerHTML = '<p class="empty">You have not posted anything yet. Tap Sell to post your first listing.</p>';
    return;
  }

  myList.innerHTML = myListings
    .map(function (item) {
      // Photo if there is one, otherwise the emoji
      const picture =
        item.images && item.images.length > 0
          ? `<img src="${escapeHtml(item.images[0])}" alt="">`
          : escapeHtml(item.emoji || "🛍️");

      // A grey "Sold" tag, and the right label for the sold button
      const soldTag = item.is_sold ? '<span class="badge-sold">Sold</span>' : "";
      const soldLabel = item.is_sold ? "Mark available" : "Mark as sold";

      return `
        <div class="my-item" data-id="${Number(item.id)}">
          <div class="my-thumb">${picture}</div>
          <div class="my-info">
            <p class="my-title">${escapeHtml(item.title)} ${soldTag}</p>
            <p class="my-price">ZMW${Number(item.price)}</p>
            <div class="my-actions">
              <button class="mini-btn" data-action="edit">Edit</button>
              <button class="mini-btn" data-action="sold">${soldLabel}</button>
              <button class="mini-btn danger" data-action="delete">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- 4. WHEN ANY BUTTON IN THE LIST IS TAPPED ----------
// One listener on the whole list works for every button, even new ones.
myList.addEventListener("click", async function (event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  // Find which listing this button belongs to
  const id = Number(button.closest(".my-item").dataset.id);
  const item = myListings.find(function (l) {
    return l.id === id;
  });
  const action = button.dataset.action;

  if (action === "edit") openEdit(item);
  if (action === "sold") await toggleSold(item);
  if (action === "delete") await deleteListing(item);
});

// ---------- 5. MARK AS SOLD / AVAILABLE ----------
async function toggleSold(item) {
  const { error } = await db
    .from("listings")
    .update({ is_sold: !item.is_sold })  // flip: sold becomes available and back
    .eq("id", item.id);

  if (error) {
    showMessage("Could not update: " + error.message, "error");
    return;
  }
  loadMyListings(); // refresh the list
}

// ---------- 6. DELETE A LISTING AND ITS PHOTOS ----------
async function deleteListing(item) {
  // Ask first, so nobody deletes by accident
  const sure = confirm("Delete \"" + item.title + "\"? This cannot be undone.");
  if (!sure) return;

  // Delete the listing row first
  const { error } = await db.from("listings").delete().eq("id", item.id);

  if (error) {
    showMessage("Could not delete: " + error.message, "error");
    return;
  }

  // Then delete its photos from storage to free space.
  // A photo address looks like .../listing-images/<folder>/<file>.jpg,
  // so we cut out everything after "/listing-images/".
  const paths = (item.images || [])
    .map(function (url) {
      return url.split("/" + BUCKET + "/")[1];
    })
    .filter(Boolean);

  if (paths.length > 0) {
    await db.storage.from(BUCKET).remove(paths);
  }

  showMessage("Listing deleted.", "success");
  loadMyListings();
}

// ---------- 7. OPEN THE EDIT POPUP ----------
function openEdit(item) {
  editingId = item.id;

  // Fill the form with the listing's current details
  document.getElementById("editTitle").value = item.title;
  document.getElementById("editCategory").value = item.category;
  document.getElementById("editPrice").value = item.price;
  document.getElementById("editDescription").value = item.description || "";
  document.getElementById("editWhatsapp").value = item.phone;

  editModal.classList.remove("hidden");
}

// Close with the X, or by tapping the dark area
closeEdit.addEventListener("click", function () {
  editModal.classList.add("hidden");
});
editModal.addEventListener("click", function (event) {
  if (event.target === editModal) {
    editModal.classList.add("hidden");
  }
});

// ---------- 8. SAVE THE EDITS ----------
editForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Read the edited values
  const title = document.getElementById("editTitle").value.trim();
  const category = document.getElementById("editCategory").value;
  const price = parseInt(document.getElementById("editPrice").value, 10);
  const description = document.getElementById("editDescription").value.trim();
  const whatsapp = document.getElementById("editWhatsapp").value.replace(/\s/g, "");

  // Check the WhatsApp number format
  if (!/^0[79]\d{8}$/.test(whatsapp)) {
    showMessage("Enter a valid WhatsApp number like 0971234567.", "error");
    editModal.classList.add("hidden");
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = "Saving...";

  const { error } = await db
    .from("listings")
    .update({
      title: title,
      category: category,
      price: price,
      description: description,
      phone: whatsapp
    })
    .eq("id", editingId);

  saveEditBtn.disabled = false;
  saveEditBtn.textContent = "Save changes";
  editModal.classList.add("hidden");

  if (error) {
    showMessage("Could not save: " + error.message, "error");
    return;
  }

  showMessage("Changes saved.", "success");
  loadMyListings();
});

// ---------- RUN WHEN THE PAGE OPENS ----------
startPage();