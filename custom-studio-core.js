/* Hands of Gold - Custom Jewelry Studio core
   Lifted verbatim from script.js so custom-jewelry.html can run the studio
   without loading 97KB of homepage-only code. Same ids, same behaviour.
   Added 2026-09-08. */
(function () {
  "use strict";
  function init() {
    // Custom jewelry builder
    const choiceGroups = document.querySelectorAll("[data-choice-group]");
    const budgetSelect = document.getElementById("custom-budget");
    const sizeInput = document.getElementById("custom-size");
    const notesInput = document.getElementById("custom-notes");
    const customSummary = document.getElementById("custom-summary");
    const copyButton = document.getElementById("copy-custom-design");
    const copyStatus = document.getElementById("custom-copy-status");

    function selectedValue(groupName) {
      return document.querySelector(`[data-choice-group="${groupName}"] .custom-choice.is-selected`)?.dataset.value || "";
    }

    function buildCustomText() {
      const parts = [
        selectedValue("piece"),
        selectedValue("metal"),
        selectedValue("stones"),
        budgetSelect?.value || ""
      ].filter(Boolean);
      const size = sizeInput?.value?.trim();
      const notes = notesInput?.value?.trim();
      let text = parts.join(" · ");
      if (size) text += ` · Size/Dimensions: ${size}`;
      if (notes) text += ` · Notes: ${notes}`;
      return text;
    }

    function refreshCustomSummary() {
      if (customSummary) customSummary.textContent = buildCustomText();
    }

    choiceGroups.forEach(group => {
      group.querySelectorAll(".custom-choice").forEach(button => {
        button.addEventListener("click", () => {
          group.querySelectorAll(".custom-choice").forEach(b => b.classList.remove("is-selected"));
          button.classList.add("is-selected");
          refreshCustomSummary();
        });
      });
    });
    budgetSelect?.addEventListener("change", refreshCustomSummary);
    sizeInput?.addEventListener("input", refreshCustomSummary);
    notesInput?.addEventListener("input", refreshCustomSummary);

    copyButton?.addEventListener("click", async () => {
      const text = `Hands of Gold custom jewelry request: ${buildCustomText()}`;
      try {
        await navigator.clipboard.writeText(text);
        if (copyStatus) copyStatus.textContent = "Design details copied to your device. They have not been sent to Hands of Gold. Call us and paste or read the request when you are ready.";
      } catch {
        if (copyStatus) copyStatus.textContent = text;
      }
    });

    // Keep the single send action usable even when the Astra preview service
    // is temporarily unavailable. studio.js replaces this button with its
    // concept-aware handler when Astra is online.
    const submit = document.getElementById("submit-custom-order");
    submit?.addEventListener("click", async () => {
      const name = document.getElementById("custom-order-name");
      const email = document.getElementById("custom-order-email");
      const phone = document.getElementById("custom-order-phone");
      const consent = document.getElementById("custom-order-consent");
      const status = document.getElementById("custom-order-status");
      const invalid = [name, email, phone].find(el => !el?.checkValidity());
      if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
      if (!consent?.checked) {
        if (status) { status.className = "custom-order-status is-error"; status.textContent = "Please accept the contact consent before sending your design."; }
        consent?.focus();
        return;
      }

      const payload = {
        leadType: "custom_jewelry",
        name: name.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim(),
        piece: selectedValue("piece"),
        metal: selectedValue("metal"),
        stones: selectedValue("stones"),
        budget: budgetSelect?.value || "",
        size_dimensions: sizeInput?.value?.trim() || "Not provided",
        design_notes: notesInput?.value?.trim() || "Not provided",
        request_summary: customSummary?.textContent?.trim() || buildCustomText(),
        source: "HandsOfGoldNY.com Custom Jewelry Studio",
        page: window.location.href,
        submitted_at: new Date().toISOString(),
        consent: "Customer accepted Terms/Privacy and consented to contact about this custom jewelry request."
      };

      submit.disabled = true;
      submit.textContent = "Sending…";
      if (status) { status.className = "custom-order-status"; status.textContent = "Sending your design to Hands of Gold…"; }
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: {"Content-Type":"application/json","Accept":"application/json"},
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true || !data.leadId) throw new Error(data.error || "Submission failed");
        if (status) { status.className = "custom-order-status is-success"; status.textContent = `Design sent ✓ Reference ${data.leadId}. We will follow up by phone or email.`; }
        submit.textContent = "Design Sent ✓";
      } catch (error) {
        console.error("[hog-custom-studio]", error);
        if (status) { status.className = "custom-order-status is-error"; status.textContent = "We couldn't deliver the design. Please try again or call (631) 264-6610."; }
        submit.disabled = false;
        submit.textContent = "Send My Design to Hands of Gold";
      }
    });
    refreshCustomSummary();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
