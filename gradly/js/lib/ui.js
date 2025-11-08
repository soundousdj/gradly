(function () {
  const toastContainer = (() => {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    return c;
  })();

  function showToast(msg, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = 'toast';
    if (type === 'error') el.style.background = 'var(--danger)';
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function showModal(html) {
    let modal = document.getElementById('ui-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ui-modal';
      modal.className = 'modal';
      modal.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><div id="ui-modal-content"></div></div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('ui-modal-content').innerHTML = html;
    modal.style.display = 'flex';
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById('ui-modal');
    if (modal) modal.style.display = 'none';
  }

  function showLoader(container) {
    const el = document.createElement('div');
    el.className = 'card';
    el.id = 'ui-loader';
    el.innerHTML = '<div style="text-align:center;padding:20px;">جاري التحميل...</div>';
    (container || document.body).appendChild(el);
  }
  function hideLoader() { const l = document.getElementById('ui-loader'); if (l) l.remove(); }

  async function safeFetch(queryBuilder) {
    if (!window.supabaseClient) throw new Error('Supabase client غير معرف');
    try {
      const res = await queryBuilder();
      return res;
    } catch (err) {
      console.error(err);
      showToast(err.message || 'حدث خطأ', 'error');
      throw err;
    }
  }

  window.UI = { showToast, showModal, closeModal, showLoader, hideLoader, safeFetch };
})();