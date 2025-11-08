/**
 * يعرض رسالة تنبيه (toast) في زاوية الشاشة.
 * @param {string} message - الرسالة التي ستعرض.
 * @param {string} type - نوع الرسالة ('success' أو 'error').
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}