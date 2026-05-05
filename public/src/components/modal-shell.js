export function renderModalShell() {
  return `
  <div id="toast" class="fixed right-4 bottom-4 hidden z-[70]"></div>

  <div id="modalRoot" class="hidden fixed inset-0 z-50 items-center justify-center p-4 modal-backdrop no-print">
    <div id="modalContent" class="card w-full max-w-3xl p-6 max-h-[92vh] overflow-auto"></div>
  </div>
  `;
}
