// ---------- SETTINGS ----------
const BUCKET = "listing-images"; // the same photo folder we already use

// ---------- GRAB THE PARTS OF THE PAGE ----------
const editForm = document.getElementById("editForm");
const editMessage = document.getElementById("editMessage");
const noStore = document.getElementById("noStore");
const logoInput = document.getElementById("logoInput");
const logoPicker = document.getElementById("logoPicker");
const logoPreview = document.getElementById("logoPreview");
const removeLogoRow = document.getElementById("removeLogoRow");
const removeLogo = document.getElementById("removeLogo");
const storeNameInput = document.getElementById("storeName");
const storeDescriptionInput = document.getElementById("storeDescription");
const storeWhatsappInput = document.getElementById("storeWhatsapp");
const linkNote = document.getElementById("linkNote");
const saveBtn = document.getElementById("saveBtn");

let currentUser = null;     // the logged-in person
let myStore = null;         // their store, loaded when the page opens
let newLogoBlob = null;     // a newly chosen logo, already shrunk (empty if none)
let logoPreviewUrl = null;  // temporary address for the preview of a new logo
let isPreparing = false;    // true while a logo is being shrunk

// ---------- SHOW A MESSAGE ("error" = red, "success" = green) ----------
function showMessage(text, type) {
  editMessage.textContent = text;
  editMessage.className = "auth-message " + type;
  window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Find this person's store
  const { data: store } = await db
    .from("stores")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  // No store yet? Show the "create one" message instead of the form
  if (!store) {
    noStore.style.display = "block";
    return;
  }
  myStore = store;

  // Fill the form with the store's current details
  storeNameInput.value = store.name;
  storeDescriptionInput.value = store.description || "";
  storeWhatsappInput.value = store.whatsapp || "";
  linkNote.textContent =
    "Your store link (this stays the same so shared links keep working): " +
    window.location.origin + "/store.html?name=" + store.slug;

  // Show the current logo, if there is one
  if (store.logo_url) {
    logoPreview.src = store.logo_url;
    logoPreview.style.display = "block";
    removeLogoRow.style.display = "flex";
  } else {
    logoPicker.textContent = "🖼️ Add logo";
  }

  editForm.style.display = "flex";
}

// ---------- 2. OPEN A LOGO FILE AS A PICTURE WE CAN DRAW ----------
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

// ---------- 3. SHRINK THE LOGO INTO A SMALL SQUARE ----------
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

// ---------- 4. WHEN THE PERSON CHOOSES A NEW LOGO ----------
logoInput.addEventListener("change", async function () {
  const file = logoInput.files[0];
  if (!file) return;

  isPreparing = true;
  saveBtn.disabled = true;
  logoPicker.textContent = "⏳ Preparing logo...";

  try {
    newLogoBlob = await makeLogo(file); // shrink it right away

    // Show the new logo as the preview
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = URL.createObjectURL(newLogoBlob);
    logoPreview.src = logoPreviewUrl;
    logoPreview.style.display = "block";
    removeLogo.checked = false;          // choosing a logo cancels "remove"
    removeLogoRow.style.display = "flex";
    logoPicker.textContent = "🖼️ Change logo";
  } catch (err) {
    console.error(err);
    newLogoBlob = null;
    logoPicker.textContent = myStore && myStore.logo_url ? "🖼️ Change logo" : "🖼️ Add logo";
    showMessage("Could not read that picture. Try a JPG or PNG.", "error");
  }

  logoInput.value = "";
  isPreparing = false;
  saveBtn.disabled = false;
});

// ---------- 5. THE "REMOVE MY LOGO" TICK BOX ----------
removeLogo.addEventListener("change", function () {
  if (removeLogo.checked) {
    // Hide the preview and forget any newly chosen logo
    logoPreview.style.display = "none";
    newLogoBlob = null;
    logoPicker.textContent = "🖼️ Add logo";
  } else if (myStore && myStore.logo_url) {
    // Un-ticked: show the current logo again
    logoPreview.src = myStore.logo_url;
    logoPreview.style.display = "block";
    logoPicker.textContent = "🖼️ Change logo";
  }
});

// Works out a file's path inside the storage folder from its web address
function pathFromUrl(url) {
  if (!url) return null;
  const parts = url.split("/" + BUCKET + "/");
  return parts.length > 1 ? parts[1] : null;
}

// ---------- 6. WHEN THE PERSON PRESSES "SAVE CHANGES" ----------
editForm.addEventListener("submit", async function (e) {
  e.preventDefault(); // stops the page from reloading

  if (isPreparing) {
    showMessage("Your logo is still being prepared. Please wait a moment.", "error");
    return;
  }

  // Read what they typed
  const name = storeNameInput.value.trim();
  const description = storeDescriptionInput.value.trim();
  const whatsapp = storeWhatsappInput.value.replace(/\s/g, "");

  // Check everything before saving
  if (name.length < 3) {
    showMessage("Your store name must be at least 3 characters.", "error");
    return;
  }
  if (!/^0[79]\d{8}$/.test(whatsapp)) {
    showMessage("Enter a valid WhatsApp number like 0971234567.", "error");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  const oldLogoUrl = myStore.logo_url;  // the logo the store has now
  let newLogoPath = null;               // path of a logo we upload now
  let logoUrl = oldLogoUrl;             // the logo the store will have after saving

  try {
    // ----- Upload the new logo if one was chosen -----
    if (newLogoBlob) {
      newLogoPath = currentUser.id + "/logo-" + Date.now() + ".jpg";
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(newLogoPath, newLogoBlob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(newLogoPath);
      logoUrl = urlData.publicUrl;
    } else if (removeLogo.checked) {
      logoUrl = null; // the owner chose to remove the logo
    }

    // ----- Save the changes. ".select()" lets us check that a row really changed. -----
    const { data: updated, error: updateError } = await db
      .from("stores")
      .update({
        name: name,
        description: description,
        whatsapp: whatsapp,
        logo_url: logoUrl
      })
      .eq("id", myStore.id)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) throw new Error("The store could not be updated. Please log in again.");

    // ----- Delete the old logo file from storage if it was replaced or removed -----
    if (oldLogoUrl && oldLogoUrl !== logoUrl) {
      const oldPath = pathFromUrl(oldLogoUrl);
      if (oldPath) await db.storage.from(BUCKET).remove([oldPath]);
    }

    // ----- Keep the name on this owner's listings up to date -----
    await db.from("listings").update({ seller_name: name }).eq("user_id", currentUser.id);

    showMessage("Changes saved! Taking you to your store...", "success");
    setTimeout(function () {
      window.location.href = "store.html?name=" + encodeURIComponent(myStore.slug);
    }, 1200);

  } catch (error) {
    console.error("Store update failed:", error);

    // If a new logo was uploaded but saving failed, delete the new logo file
    if (newLogoPath) await db.storage.from(BUCKET).remove([newLogoPath]);

    showMessage("Could not save: " + (error.message || "please try again."), "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save changes";
  }
});

// ---------- RUN WHEN THE PAGE OPENS ----------
startPage();