// ---------- SETTINGS ----------
const MAX_PHOTOS = 4;            // most photos allowed per listing
const BUCKET = "listing-images"; // the storage folder we made in step 7a

// ---------- GRAB THE PARTS OF THE PAGE ----------
const sellForm = document.getElementById("sellForm");
const sellMessage = document.getElementById("sellMessage");
const photoInput = document.getElementById("photoInput");
const photoPicker = document.querySelector(".photo-picker");
const photoPreview = document.getElementById("photoPreview");
const postBtn = document.getElementById("postBtn");
const whatsappInput = document.getElementById("whatsapp");
const saveWhatsapp = document.getElementById("saveWhatsapp");
const sellerNameInput = document.getElementById("sellerName"); // the public display name box

// The photos chosen so far. These are ALREADY SHRUNK (small files).
let selectedPhotos = [];
// Temporary preview addresses (we free them when we redraw, to save memory)
let previewUrls = [];
// True while photos are being shrunk (posting is paused during this)
let isPreparing = false;
// The logged-in person (filled in when the page opens)
let currentUser = null;

// ---------- SHOW A MESSAGE ("error" = red, "success" = green) ----------
function showMessage(text, type) {
  sellMessage.textContent = text;
  sellMessage.className = "auth-message " + type;
  window.scrollTo({ top: 0, behavior: "smooth" }); // scroll up so it is seen
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

  // Get their saved WhatsApp number and signup name (to prefill the form)
  const { data: profile } = await db
    .from("profiles")
    .select("whatsapp, full_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile && profile.whatsapp) {
    whatsappInput.value = profile.whatsapp;
  }

  // Prefill the display name with their signup name (they can change it)
  if (profile && profile.full_name) {
    sellerNameInput.value = profile.full_name;
  }
}

// ---------- 2. OPEN A PHOTO FILE AS A PICTURE WE CAN DRAW ----------
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
      reject(new Error("Could not read this photo."));
    };
    img.src = url;
  });
}

// ---------- 3. SHRINK A PHOTO ----------
// Phone photos are often 3-8 MB. This makes them about 150-400 KB.
async function compressImage(file) {
  const picture = await loadPicture(file);

  // Scale down so the longest side is at most 1000 pixels
  const maxSize = 1000;
  let w = picture.width;
  let h = picture.height;
  if (w > h && w > maxSize) {
    h = Math.round((h * maxSize) / w);
    w = maxSize;
  } else if (h >= w && h > maxSize) {
    w = Math.round((w * maxSize) / h);
    h = maxSize;
  }

  // Draw the photo smaller on an invisible canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";       // white background (for see-through PNGs)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(picture, 0, 0, w, h);

  // Free the big picture from memory
  if (picture.close) picture.close();

  // Turn the canvas into a small JPEG file
  return await new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob);
      else reject(new Error("Could not process this photo."));
    }, "image/jpeg", 0.8);
  });
}

// ---------- 4. SHOW SMALL PREVIEWS OF THE CHOSEN PHOTOS ----------
function renderPreviews() {
  // Free the old preview addresses, then clear the boxes
  previewUrls.forEach(function (u) {
    URL.revokeObjectURL(u);
  });
  previewUrls = [];
  photoPreview.innerHTML = "";

  selectedPhotos.forEach(function (blob, index) {
    const box = document.createElement("div");
    box.className = "preview-item";

    // The picture itself
    const img = document.createElement("img");
    const url = URL.createObjectURL(blob);
    previewUrls.push(url);
    img.src = url;
    box.appendChild(img);

    // The first photo gets a "Cover" tag
    if (index === 0) {
      const tag = document.createElement("span");
      tag.className = "cover-tag";
      tag.textContent = "Cover";
      box.appendChild(tag);
    }

    // A small X button to remove this photo
    const remove = document.createElement("button");
    remove.type = "button"; // so it does not submit the form
    remove.className = "preview-remove";
    remove.textContent = "✕";
    remove.addEventListener("click", function () {
      selectedPhotos.splice(index, 1);
      renderPreviews();
    });
    box.appendChild(remove);

    photoPreview.appendChild(box);
  });
}

// ---------- 5. WHEN THE PERSON CHOOSES PHOTOS ----------
// We shrink each photo RIGHT AWAY, one at a time, while the phone
// still lets us read it.
photoInput.addEventListener("change", async function () {
  const files = Array.from(photoInput.files);
  if (files.length === 0) return;

  // Pause posting and show a "please wait" label
  isPreparing = true;
  postBtn.disabled = true;
  photoPicker.textContent = "⏳ Preparing photos...";

  let failed = 0;      // photos we could not read
  let tooMany = false; // true if the person picked more than the limit

  for (const file of files) {
    // Stop if we already have the maximum
    if (selectedPhotos.length >= MAX_PHOTOS) {
      tooMany = true;
      break;
    }
    // Skip anything that is not an image
    if (!file.type.startsWith("image/")) {
      failed++;
      continue;
    }

    try {
      const small = await compressImage(file); // shrink it now
      selectedPhotos.push(small);
      renderPreviews();                        // show it straight away
    } catch (err) {
      console.error("Photo problem:", err);
      failed++;
    }
  }

  // Back to normal
  photoInput.value = ""; // reset so the same photo can be picked again
  photoPicker.textContent = "📷 Add photos";
  isPreparing = false;
  postBtn.disabled = false;

  // Tell the person if anything went wrong
  if (failed > 0) {
    showMessage(failed + " photo(s) could not be read. Try a JPG or PNG, or take the photo again.", "error");
  } else if (tooMany) {
    showMessage("You can add up to " + MAX_PHOTOS + " photos.", "error");
  }
});

// ---------- 6. WHEN THE PERSON PRESSES "POST LISTING" ----------
sellForm.addEventListener("submit", async function (e) {
  e.preventDefault(); // stops the page from reloading

  // Wait if photos are still being shrunk
  if (isPreparing) {
    showMessage("Photos are still being prepared. Please wait a moment.", "error");
    return;
  }

  // Read what they typed
  const title = document.getElementById("title").value.trim();
  const category = document.getElementById("category").value;
  const price = parseInt(document.getElementById("price").value, 10);
  const description = document.getElementById("description").value.trim();
  const whatsapp = whatsappInput.value.replace(/\s/g, "");
  const sellerName = sellerNameInput.value.trim(); // the name buyers will see

  // Check everything before uploading
  if (selectedPhotos.length === 0) {
    showMessage("Please add at least one photo.", "error");
    return;
  }
  if (!category) {
    showMessage("Please choose a category.", "error");
    return;
  }
  if (!price || price < 1) {
    showMessage("Enter a price of 1 or more.", "error");
    return;
  }
  if (!sellerName) {
    showMessage("Enter the name buyers will see.", "error");
    return;
  }
  if (!/^0[79]\d{8}$/.test(whatsapp)) {
    showMessage("Enter a valid WhatsApp number like 0971234567.", "error");
    return;
  }

  // Stop double-clicks while we work
  postBtn.disabled = true;
  postBtn.textContent = "Uploading photos...";

  // We remember uploaded file paths so we can clean up if something fails
  const uploadedPaths = [];
  const imageUrls = [];

  try {
    // ----- Upload each (already small) photo -----
    for (let i = 0; i < selectedPhotos.length; i++) {
      // Each file goes in a folder named after the user's id
      const path = currentUser.id + "/" + Date.now() + "-" + i + ".jpg";

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, selectedPhotos[i], { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      uploadedPaths.push(path);

      // Get the public web address of the uploaded photo
      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }

    // ----- Save the listing in the database -----
    postBtn.textContent = "Saving listing...";

    const { error: insertError } = await db.from("listings").insert({
      user_id: currentUser.id,
      title: title,
      category: category,
      price: price,
      description: description,
      phone: whatsapp,           // the seller's WhatsApp number
      seller_name: sellerName,   // the name buyers will see
      images: imageUrls
    });

    if (insertError) throw insertError;

    // ----- Save the WhatsApp number to their profile if they ticked the box -----
    if (saveWhatsapp.checked) {
      await db.from("profiles").update({ whatsapp: whatsapp }).eq("id", currentUser.id);
    }

    // ----- Done! Go to the marketplace -----
    window.location.href = "index.html";

  } catch (error) {
    console.error("Post failed:", error);

    // If photos uploaded but the listing failed, delete those photos
    if (uploadedPaths.length > 0) {
      await db.storage.from(BUCKET).remove(uploadedPaths);
    }

    showMessage("Could not post: " + (error.message || "please try again."), "error");
    postBtn.disabled = false;
    postBtn.textContent = "Post listing";
  }
});

// ---------- RUN WHEN THE PAGE OPENS ----------
startPage();