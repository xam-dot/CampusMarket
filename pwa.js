// ---------- 1. REGISTER THE SERVICE WORKER ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.error("Service worker failed:", error);
    });
  });
}

// ---------- 2. HELPERS FOR THE INSTALL BANNER ----------
// True when the site is already running as an installed app
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const DISMISS_KEY = "installBannerDismissedAt"; // remembered in the browser
const DISMISS_DAYS = 14;                        // how long to stay quiet after "✕"

function recentlyDismissed() {
  try {
    const time = Number(localStorage.getItem(DISMISS_KEY));
    return time && Date.now() - time < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch (e) {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch (e) {
    // Storage is blocked. Nothing to do.
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
    rememberDismiss();
    banner.remove();
  });
  banner.appendChild(close);

  document.body.appendChild(banner);
}

// ---------- 3. ANDROID / CHROME: INSTALL BUTTON ----------
let deferredPrompt = null;

// Chrome fires this when the site can be installed
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();      // stop Chrome's own small bar, we show ours
  deferredPrompt = event;

  if (isStandalone || recentlyDismissed()) return;

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

// ---------- 4. IPHONE: SHOW HOW TO ADD IT ----------
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isSafari =
  /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

if (isIos && isSafari && !isStandalone && !recentlyDismissed()) {
  window.addEventListener("load", function () {
    setTimeout(function () {
      showBanner("To install: tap the Share button, then “Add to Home Screen”.", null, null);
    }, 2500);
  });
}