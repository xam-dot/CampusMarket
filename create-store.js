// ---------- SETTINGS ----------
const BUCKET = "listing-images"; // the same photo folder we already made

// ---------- GRAB THE PARTS OF THE PAGE ----------
const storeForm = document.getElementById("storeForm");
const storeMessage = document.getElementById("storeMessage");
const storeDone = document.getElementById("storeDone");
const logoInput = document.getElementById("logoInput");
const logoPicker = document.getElementById("logoPicker");
const logoPreview = document.getElementById("logoPreview");
const storeNameInput = document.getElementById("storeName");
const storeSlugInput = document.getElementById("storeSlug");
const slugPreview = document.getElementById("slugPreview");
const storeDescriptionInput = document.getElementById("storeDescription");
const storeWhatsappInput = document.getElementById("storeWhatsapp");
const createBtn = document.getElementById("createBtn");

let currentUser = null;      // the logged-in person
let logoBlob = null;         // the logo, already shrunk (empty if none chosen)
let logoPreviewUrl = null;   // temporary address used for the round preview
let slugEditedByHand = false; // becomes true if they type their own link name
let isPreparing = false;     // true while the logo is being shrunk

// ---------- SHOW A MESSAGE ("error" = red, "success" = green) ----------
function showMessage(text, type) {
  storeMessage.textContent = text;
  storeMessage.className = "auth-message " + type;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- TURN A STORE NAME INTO A LINK NAME ----------
// "Mary's Beauty Store!" becomes "marys-beauty-store"
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")            // remove apostrophes
    .replace(/[^a-z0-9]+/g, "-")     // anything else becomes a dash
    .replace(/^-+|-+$/g, "")         // no dashes at the start or end
    .slice(0, 30)                    // at most 30 characters
    .replace(/-+$/g, "");            // cutting can leave a dash at the end
}

// The full store link shown under the link box
function fullStoreLink(slug) {
  return window.location.origin + "/store.html?name=" + slug;
}

// Updates the "Your store link: ..." line
function updateSlugPreview() {
  slugPreview.textContent = fullStoreLink(storeSlugInput.value || "your-store");
}

// ---------- 1. ON PAGE OPEN ----------
async function startPage() {
  // Must be logged in
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = data.session.user;

  // Does this person already have a store? (One store per account)
  const { data: existing } = await db
    .from("stores")
    .select("name, slug")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (existing) {
    storeForm.style.display = "none";
    storeDone.style.display = "block";
    storeDone.innerHTML = `
      <h2>You already have a store</h2>
      <p>${escapeText(existing.name)}</p>
      <a class="auth-btn" href="store.html?name=${encodeURIComponent(existing.slug)}">View my store</a>
      <a class="auth-btn alt" href="sell.html">Add a product</a>
      <a class="auth-btn alt" href="edit-store.html">Edit my store</a>
    `;
    return;
  }

  // Prefill the WhatsApp number if they saved one before
  const { data: profile } = await db
    .from("profiles")
    .select("whatsapp")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (profile && profile.whatsapp) {
    storeWhatsappInput.value = profile.whatsapp;
  }

  updateSlugPreview();
}

// Cleans text so hidden code typed by a user can never run on the page
function escapeText(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- 2. THE LINK NAME FOLLOWS THE STORE NAME ----------
// As they type the store name, we fill in the link name for them.
storeNameInput.addEventListener("input", function () {
  if (!slugEditedByHand) {
    storeSlugInput.value = slugify(storeNameInput.value);
    updateSlugPreview();
  }
});

// If they edit the link name themselves, stop overwriting it
storeSlugInput.addEventListener("input", function () {
  slugEditedByHand = true;
  // Keep only allowed characters while they type
  storeSlugInput.value = storeSlugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
  updateSlugPreview();
});

// ---------- 3. OPEN A LOGO FILE AS A PICTURE WE CAN DRAW ----------
async function loadPicture(file) {
  // Modern way: lighter on memory, and it fixes sideways camera photos
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      // If that fails, we try the older way below
    }
  }

  // Older way: load the file into an invisible <img>
  return await new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this picture."));
    };
    img.src = url;
  });
}

// ---------- 4. SHRINK THE LOGO INTO A SMALL SQUARE ----------
async function makeLogo(file) {
  const picture = await loadPicture(file);

  // Cut the biggest centred square out of the picture
  const size = Math.min(picture.width, picture.height);
  const startX = (picture.width - size) / 2;
  const startY = (picture.height - size) / 2;

  // Draw it at 400 x 400 pixels
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // white behind see-through logos
  ctx.fillRect(0, 0, 400, 400);
  ctx.drawImage(picture, startX, startY, size, size, 0, 0, 400, 400);

  // Free the big picture from memory
  if (picture.close) picture.close();

  // Turn it into a small JPEG file
  return await new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob);
      else reject(new Error("Could not process this logo."));
    }, "image/jpeg", 0.85);
  });
}

// ---------- 5. WHEN THE PERSON CHOOSES A LOGO ----------
logoInput.addEventListener("change", async function () {
  const file = logoInput.files[0];
  if (!file) return;

  isPreparing = true;
  createBtn.disabled = true;
  logoPicker.textContent = "⏳ Preparing logo...";

  try {
    logoBlob = await makeLogo(file); // shrink it right away

    // Show a round preview
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = URL.createObjectURL(logoBlob);
    logoPreview.src = logoPreviewUrl;
    logoPreview.style.display = "block";
    logoPicker.textContent = "🖼️ Change logo";
  } catch (err) {
    console.error(err);
    logoBlob = null;
    logoPicker.textContent = "🖼️ Add logo";
    showMessage("Could not read that picture. Try a JPG or PNG.", "error");
  }

  logoInput.value = "";
  isPreparing = false;
  createBtn.disabled = false;
});

// ---------- 6. WHEN THE PERSON PRESSES "CREATE MY STORE" ----------
storeForm.addEventListener("submit", async function (e) {
  e.preventDefault(); // stops the page from reloading

  if (isPreparing) {
    showMessage("Your logo is still being prepared. Please wait a moment.", "error");
    return;
  }

  // Read what they typed
  const name = storeNameInput.value.trim();
  const slug = storeSlugInput.value.trim();
  const description = storeDescriptionInput.value.trim();
  const whatsapp = storeWhatsappInput.value.replace(/\s/g, "");

  // Check everything before saving
  if (name.length < 3) {
    showMessage("Your store name must be at least 3 characters.", "error");
    return;
  }
  // Same rule the database uses: lowercase letters, numbers, single dashes, 3 to 30 characters
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 30) {
    showMessage("The link name needs 3 to 30 letters or numbers, with single dashes between words. No spaces.", "error");
    return;
  }
  if (!/^0[79]\d{8}$/.test(whatsapp)) {
    showMessage("Enter a valid WhatsApp number like 0971234567.", "error");
    return;
  }

  createBtn.disabled = true;
  createBtn.textContent = "Creating your store...";

  let logoPath = null; // remembered so we can delete it if saving fails
  let logoUrl = null;

  try {
    // ----- Upload the logo if they chose one -----
    if (logoBlob) {
      logoPath = currentUser.id + "/logo-" + Date.now() + ".jpg";
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(logoPath, logoBlob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(logoPath);
      logoUrl = urlData.publicUrl;
    }

    // ----- Save the store -----
    const { error: insertError } = await db.from("stores").insert({
      owner_id: currentUser.id,
      name: name,
      slug: slug,
      description: description,
      logo_url: logoUrl,
      whatsapp: whatsapp
    });

    if (insertError) {
      // Tidy up the logo we just uploaded, since the store was not saved
      if (logoPath) await db.storage.from(BUCKET).remove([logoPath]);

      // 23505 means "this value is already taken"
      if (insertError.code === "23505") {
        if (String(insertError.message).includes("owner_id")) {
          showMessage("You already have a store.", "error");
        } else {
          showMessage("That link name is already taken. Please try another.", "error");
        }
      } else {
        showMessage("Could not create the store: " + insertError.message, "error");
      }
      createBtn.disabled = false;
      createBtn.textContent = "Create my store";
      return;
    }

    // ----- Success! Replace the form with a "done" message -----
    storeForm.style.display = "none";
    storeMessage.className = "auth-message hidden";
    storeDone.style.display = "block";
    storeDone.innerHTML = `
      <h2>🎉 Your store is ready!</h2>
      <p>Share this link with your customers:</p>
      <p class="slug-preview">${escapeText(fullStoreLink(slug))}</p>
      <a class="auth-btn" href="sell.html">Add your first product</a>
      <a class="auth-btn alt" href="store.html?name=${encodeURIComponent(slug)}">View my store</a>
    `;
    window.scrollTo({ top: 0 });

  } catch (error) {
    console.error("Store creation failed:", error);
    if (logoPath) await db.storage.from(BUCKET).remove([logoPath]);
    showMessage("Could not create the store: " + (error.message || "please try again."), "error");
    createBtn.disabled = false;
    createBtn.textContent = "Create my store";
  }
});

// ---------- RUN WHEN THE PAGE OPENS ----------
startPage();