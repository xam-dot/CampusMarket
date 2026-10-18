// Adds a "Show / Hide" button to every password box on the page.

document.querySelectorAll('input[type="password"]').forEach(function (input) {
  // Wrap the password box in a holder, so the button can sit inside it
  const wrap = document.createElement("div");
  wrap.className = "password-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  // The small Show / Hide button
  const btn = document.createElement("button");
  btn.type = "button";               // so it never submits the form
  btn.className = "password-toggle";
  btn.textContent = "Show";
  btn.setAttribute("aria-label", "Show password");

  btn.addEventListener("click", function () {
    // If the box is showing plain text, hide it again. Otherwise show it.
    const isShowing = input.type === "text";
    input.type = isShowing ? "password" : "text";
    btn.textContent = isShowing ? "Show" : "Hide";
    btn.setAttribute("aria-label", isShowing ? "Show password" : "Hide password");
  });

  wrap.appendChild(btn);
});