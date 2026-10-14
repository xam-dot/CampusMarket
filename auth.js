// ---------- GRAB THE PARTS OF THE PAGE ----------
const loginView = document.getElementById("loginView");
const signupView = document.getElementById("signupView");
const forgotView = document.getElementById("forgotView");
const authMessage = document.getElementById("authMessage");

// ---------- SHOW ONE FORM AT A TIME ----------
// Pass "login", "signup" or "forgot". The other two forms get hidden.
function showView(name) {
  loginView.classList.toggle("hidden", name !== "login");
  signupView.classList.toggle("hidden", name !== "signup");
  forgotView.classList.toggle("hidden", name !== "forgot");
  authMessage.classList.add("hidden"); // clear any old message
}

// ---------- SHOW A MESSAGE ----------
// type is "error" (red) or "success" (green)
function showMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = "auth-message " + type;
}

// ---------- LINKS THAT SWITCH BETWEEN THE FORMS ----------
document.getElementById("showSignup").addEventListener("click", function (e) {
  e.preventDefault(); // stops the link from jumping to the top
  showView("signup");
});
document.getElementById("showForgot").addEventListener("click", function (e) {
  e.preventDefault();
  showView("forgot");
});
document.getElementById("showLogin1").addEventListener("click", function (e) {
  e.preventDefault();
  showView("login");
});
document.getElementById("showLogin2").addEventListener("click", function (e) {
  e.preventDefault();
  showView("login");
});

// ---------- SIGN UP ----------
signupView.addEventListener("submit", async function (e) {
  e.preventDefault(); // stops the page from reloading

  // Read what the person typed
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phone = document.getElementById("signupPhone").value.replace(/\s/g, ""); // remove spaces
  const password = document.getElementById("signupPassword").value;

  // Check the phone: 10 digits starting with 09 or 07 (Zambian format)
  if (!/^0[79]\d{8}$/.test(phone)) {
    showMessage("Enter a valid phone number like 0971234567.", "error");
    return;
  }

  // Check the password length
  if (password.length < 8) {
    showMessage("Password must be at least 8 characters.", "error");
    return;
  }

  // Ask Supabase to create the account.
  // "data" carries the name and phone to our profiles table.
  const { data, error } = await db.auth.signUp({
    email: email,
    password: password,
    options: { data: { full_name: name, phone: phone } }
  });

  if (error) {
    // A duplicate phone number makes the database reject the signup
    // with a vague message. We turn it into something friendly.
    if (error.message.includes("Database error")) {
      showMessage("That phone number or email is already registered. Try logging in.", "error");
    } else {
      showMessage(error.message, "error");
    }
    return;
  }

  // If email confirmation is ON, there is no session yet: tell them to check email
  if (!data.session) {
    showView("login");
    showMessage("Account created! Check your email, tap the confirmation link, then log in.", "success");
    return;
  }

  // Confirmation is OFF, so they are logged in straight away
  window.location.href = "index.html";
});

// ---------- LOG IN (email OR phone number) ----------
loginView.addEventListener("submit", async function (e) {
  e.preventDefault();

  // The box holds either an email or a phone number
  const identifier = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  // If it contains only digits, spaces and "+", it is a phone number
  const looksLikePhone = /^[0-9+\s]+$/.test(identifier);

  if (looksLikePhone) {
    // ----- PHONE LOGIN: ask our server function to check it -----
    const phone = identifier.replace(/\s/g, ""); // remove spaces

    const { data, error } = await db.functions.invoke("phone-login", {
      body: { phone: phone, password: password }
    });

    // The function answers with an "error" field when something is wrong
    if (error || !data || data.error) {
      showMessage("Wrong phone number or password.", "error");
      return;
    }

    // The function gave us a login session. Save it in this browser.
    const { error: sessionError } = await db.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token
    });

    if (sessionError) {
      showMessage("Could not log in. Please try again.", "error");
      return;
    }

    window.location.href = "index.html";
    return;
  }

  // ----- EMAIL LOGIN: the normal way (same as before) -----
  const { error } = await db.auth.signInWithPassword({
    email: identifier,
    password: password
  });

  if (error) {
    showMessage("Wrong email or password, or email not confirmed yet.", "error");
    return;
  }

  window.location.href = "index.html";
});

// ---------- FORGOT PASSWORD ----------
forgotView.addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("forgotEmail").value.trim();

  // Supabase emails a reset link. "redirectTo" is the page that link opens.
  // (We build reset-password.html in step 6e.)
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html"
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  // We say the same thing whether or not the email exists, for privacy
  showMessage("If that email has an account, a reset link is on its way.", "success");
});