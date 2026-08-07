import { $, escapeHtml } from "./controller-helpers.js";

export function showToast(message, type = "default") {
  const el = $("#toast");
  const safeType = ["default", "success", "error"].includes(type)
    ? type
    : "default";
  el.innerHTML = `<div class="toast__message toast--${safeType}">${escapeHtml(message)}</div>`;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2800);
}
