// ---------- SETTINGS ----------
const MAX_PHOTOS = 4;          // most photos allowed per listing
const BUCKET = "listing-images"; // the storage folder we made in step 7a

// ---------- GRAB THE PARTS OF THE PAGE ----------
const sellForm = document.getElementById("sellForm");
const sellMessage = document.getElementById("sellMessage");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const postBtn = document.getElementById("postBtn");
const whatsappInput = document.getElementById("whatsapp");
const saveWhatsapp = document.getElementById("saveWhatsapp");

// The photos the person has chosen so far (starts empty)
let selectedFiles = [];

// The logged-in person (filled in when the page opens)
let currentUser = null;

// ---------- SHOW A MESSAGE ("error" = red, "success" = green) ----------
function showMessage(text, type) {
  sellMessage.textContent = text;
  sellMessage.className = "auth-message " + type;
  // Scroll up so the person sees the message
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 1. ON PAGE OPEN: MAKE SURE SOMEONE IS LOGGED IN ----------
async function startPage() {
  // Ask Supabase: who is logged in on this browser?
  const { data } = await db.auth.getSession();

  // Nobody? Send them to the login page.
  if (!data.session) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = data.session.user;

  // If they saved a WhatsApp number before, fill it in automatically
  const { data: profile } = await db
    .from("profiles")
    .select("whatsapp")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile && profile.whatsapp) {
    whatsappInput.value = profile.whatsapp;
  }
}

// ---------- 2. SHRINK A PHOTO BEFORE UPLOADING ----------
// Phone photos are often 3-8 MB. This makes them about 150-400 KB.
function compressImage(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function () {
      const maxSize = 1000; // longest side will be at most 1000 pixels
      let w = img.width;
      let h = img.height;

      // Scale down, keeping the same shape
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
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      // Turn the canvas into a JPEG file (quality 0.8 = good and small)
      canvas.toBlob(function (blob) {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error("Could not process a photo."));
      }, "image/jpeg", 0.8);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read one of the photos. Try a JPG or PNG."));
    };

    img.src = url;
  });
}

// ---------- 3. SHOW SMALL PREVIEWS OF CHOSEN PHOTOS ----------
function renderPreviews() {
  photoPreview.innerHTML = ""; // clear old previews

  selectedFiles.forEach(function (file, index) {
    // One box per photo
    const box = document.createElement("div");
    box.className = "preview-item";

    // The picture itself
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    box.appendChild(img);

    // The first photo gets a "Cover" tag
    if (index === 0) {
      const tag = document.createElement("span");
      tag.className = "cover-tag";
      tag.textContent = "Cover";
      box.appendChild(tag);
    }

    // A small ✕ button to remove this photo
    const remove = document.createElement("button");
    remove.type = "button"; // so it does not submit the form
    remove.className = "preview-remove";
    remove.textContent = "✕";
    remove.addEventListener("click", function () {
      selectedFiles.splice(index, 1); // take it out of the list
      renderPreviews();               // redraw
    });
    box.appendChild(remove);

    photoPreview.appendChild(box);
  });
}

// ---------- 4. WHEN THE PERSON CHOOSES PHOTOS ----------
photoInput.addEventListener("change", function () {
  // Go through each chosen file
  Array.from(photoInput.files).forEach(function (file) {
    // Only add if it is an image and we have room
    if (file.type.startsWith("image/") && selectedFiles.length < MAX_PHOTOS) {
      selectedFiles.push(file);
    }
  });

  if (photoInput.files.length + selectedFiles.length > MAX_PHOTOS) {
    showMessage("You can add up to " + MAX_PHOTOS + " photos.", "error");
  }

  photoInput.value = ""; // reset so the same photo can be picked again
  renderPreviews();
});

// ---------- 5. WHEN THE PERSON PRESSES "POST LISTING" ----------
sellForm.addEventListener("submit", async function (e) {
  e.preventDefault(); // stops the page from reloading

  // Read what they typed
  const title = document.getElementById("title").value.trim();
  const category = document.getElementById("category").value;
  const price = parseInt(document.getElementById("price").value, 10);
  const description = document.getElementById("description").value.trim();
  const whatsapp = whatsappInput.value.replace(/\s/g, ""); // remove spaces

  // Check everything before uploading
  if (selectedFiles.length === 0) {
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
    // ----- Upload each photo -----
    for (let i = 0; i < selectedFiles.length; i++) {
      // Shrink the photo first
      const blob = await compressImage(selectedFiles[i]);

      // The file goes in a folder named after the user's id.
      // Our storage rule only allows uploads into your OWN folder.
      const path = currentUser.id + "/" + Date.now() + "-" + i + ".jpg";

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });

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
      phone: whatsapp,      // the "phone" column holds the WhatsApp number
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