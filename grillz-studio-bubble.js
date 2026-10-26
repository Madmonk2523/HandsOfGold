/* Grillz Design Studio bubble (grillz.html)
   A floating "Design your grillz" button, styled like the Astra chat launcher,
   that opens the existing studio in a side panel. The whole #studio section is
   moved into the panel while it is open and put back on close; grillz.js looks
   up studio parts inside that section, so moving it keeps every listener working. The bubble only appears once the studio itself is
   available (grillz.js un-hides #studio after its /api/design probe). */
(function () {
  "use strict";
  var section = document.getElementById("studio");
  var studio = section && section.querySelector(".gz-studio");
  if (!section || !studio) return;

  function push(event, data) {
    window.dataLayer = window.dataLayer || [];
    var o = { event: event };
    for (var k in (data || {})) o[k] = data[k];
    window.dataLayer.push(o);
  }

  var launch = document.createElement("button");
  launch.type = "button";
  launch.className = "gz-studio-bubble";
  launch.setAttribute("aria-controls", "gz-studio-panel");
  launch.setAttribute("aria-expanded", "false");
  launch.textContent = "✦ Design your grillz";
  launch.hidden = true;

  var panel = document.createElement("section");
  panel.id = "gz-studio-panel";
  panel.className = "gz-studio-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "gz-studio-panel-title");
  panel.hidden = true;
  panel.innerHTML =
    '<header><div><strong id="gz-studio-panel-title">Grillz Design Studio</strong>' +
    '<span>Build your set and see an AI concept</span></div>' +
    '<button type="button" class="gz-studio-panel-close" aria-label="Close design studio">×</button></header>' +
    '<div class="gz-studio-panel-body"></div>';
  var body = panel.querySelector(".gz-studio-panel-body");

  var wrap = document.createElement("div");
  wrap.id = "gz-studio-bubble-root";
  wrap.append(launch, panel);
  document.body.append(wrap);

  var placeholder = document.createComment("gz-studio home");
  var open = false, lastFocus = null, oldOverflow = "", background = [], sectionOnScreen = false;

  // Other "Design" buttons (hero, phone sticky bar) open the same panel and
  // only show once the studio is available, like the bubble itself.
  var triggers = document.querySelectorAll("[data-gz-open-studio]");
  function available() { return !section.hidden; }
  function syncLaunch() {
    launch.hidden = open || !available() || sectionOnScreen;
    triggers.forEach(function (t) { t.hidden = !available(); });
  }
  triggers.forEach(function (t) {
    t.addEventListener("click", function (e) {
      if (!available()) return;
      e.preventDefault();
      push("grillz_design_trigger_open", { from: t.getAttribute("data-gz-open-studio") || "link" });
      setOpen(true);
    });
  });

  function setOpen(next) {
    if (next === open) return;
    open = next;
    launch.setAttribute("aria-expanded", String(open));
    if (open) {
      lastFocus = document.activeElement;
      section.parentNode.insertBefore(placeholder, section);
      body.append(section);
      panel.hidden = false;
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      background = Array.prototype.filter.call(document.body.children, function (e) { return e !== wrap; })
        .map(function (e) { return [e, e.inert]; });
      background.forEach(function (p) { p[0].inert = true; });
      var first = panel.querySelector("button.gz-choice, input, textarea, select");
      (first || panel.querySelector(".gz-studio-panel-close")).focus();
      push("grillz_design_bubble_open");
    } else {
      panel.hidden = true;
      placeholder.parentNode.insertBefore(section, placeholder);
      placeholder.remove();
      background.forEach(function (p) { p[0].inert = p[1]; });
      document.body.style.overflow = oldOverflow;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    syncLaunch();
  }

  launch.addEventListener("click", function () { setOpen(true); });
  panel.querySelector(".gz-studio-panel-close").addEventListener("click", function () { setOpen(false); });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  });
  // "Reserve this design" / "Get a quote" jump to sections on the page:
  // close the panel first so the page can scroll there.
  panel.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) setOpen(false);
  });

  // Show the bubble once grillz.js reveals the studio.
  new MutationObserver(syncLaunch).observe(section, { attributes: true, attributeFilter: ["hidden"] });
  // Hide it while the studio section itself is on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      sectionOnScreen = entries[0].isIntersecting;
      syncLaunch();
    }, { threshold: 0.15 }).observe(section);
  }
  syncLaunch();
})();
