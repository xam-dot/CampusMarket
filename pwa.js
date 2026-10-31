// ---------- 1. REGISTER THE SERVICE WORKER ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.error("Service worker failed:", error);
    });
  });
}

// ---------- 2. CLEAN UP THE OLD "HIDE FOR 14 DAYS" NOTE ----------
// An earlier version saved this note. We no longer use it.
try {
  localStorage.removeItem("installBannerDismissedAt");
} catch (e) {
  // Storage is blocked. Nothing to do.
}

// ---------- 3. HELPERS FOR THE INSTALL BANNER ----------
// True when the site is already running as an installed app
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// "✕" only hides the banner for this visit (this browser tab).
// sessionStorage is cleared when the tab is closed, so the banner
// comes back the next time the site is opened.
const HIDE_KEY = "installBannerHiddenThisVisit";

function hiddenThisVisit() {
  try {
    return sessionStorage.getItem(HIDE_KEY) === "yes";
  } catch (e) {
    return false;
  }
}

function hideForThisVisit() {
  try {
    sessionStorage.setItem(HIDE_KEY, "yes");
  } catch (e) {
    // Storage is blocked. The banner will simply show again on the next page.
  }
}

// Builds the banner: a message, an optional button, and a close button
function showBanner(message, buttonText, onButton) {
  if (document.getElementById("installBanner")) return; // only one at a time

  const banner = document.createElement("div");
  banner.id = "installBanner";
  banner.className = "install-banner";

  const text = document.createElement("span");
  text.className = "install-text";
  text.textContent = message;
  banner.appendChild(text);

  if (buttonText) {
    const go = document.createElement("button");
    go.type = "button";
    go.className = "install-go";
    go.textContent = buttonText;
    go.addEventListener("click", function () {
      onButton();
      banner.remove();
    });
    banner.appendChild(go);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "install-close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", function () {
    hideForThisVisit();   // hidden for now, back on the next visit
    banner.remove();
  });
  banner.appendChild(close);

  document.body.appendChild(banner);
}

// ---------- 4. ANDROID / CHROME: INSTALL BUTTON ----------
let deferredPrompt = null;

// Chrome fires this ONLY when the app is not installed yet
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();      // stop Chrome's own small bar, we show ours
  deferredPrompt = event;

  if (isStandalone || hiddenThisVisit()) return;

  showBanner("Install CampusMarket on your phone", "Install", async function () {
    deferredPrompt.prompt();           // opens Chrome's install box
    await deferredPrompt.userChoice;   // wait for the answer
    deferredPrompt = null;
  });
});

// Remove the banner once the app has been installed
window.addEventListener("appinstalled", function () {
  const banner = document.getElementById("installBanner");
  if (banner) banner.remove();
});

// ---------- 5. IPHONE: SHOW HOW TO ADD IT ----------
// iPhones give websites no way to know if the app is installed,
// so Safari visitors see this each visit. The installed app itself never shows it.
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isSafari =
  /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

if (isIos && isSafari && !isStandalone && !hiddenThisVisit()) {
  window.addEventListener("load", function () {
    setTimeout(function () {
      showBanner("To install: tap the Share button, then “Add to Home Screen”.", null, null);
    }, 2500);
  });
}