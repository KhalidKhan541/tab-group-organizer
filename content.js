(() => {
  const STYLE_ID = 'tgo-content-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tgo-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: white;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
        max-width: 320px;
      }
      .tgo-toast.visible {
        transform: translateX(0);
        opacity: 1;
      }
      .tgo-toast.success { background: #34c759; }
      .tgo-toast.error { background: #ff3b30; }
      .tgo-toast.info { background: #007aff; }
      .tgo-toast.warning { background: #ff9500; }
      .tgo-toast .tgo-toast-icon {
        display: inline-block;
        margin-right: 8px;
        font-size: 14px;
      }
      .tgo-grouping-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(2px);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .tgo-grouping-overlay.visible { opacity: 1; }
      .tgo-grouping-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: #4285f4;
        border-radius: 50%;
        animation: tgo-spin 0.8s linear infinite;
      }
      .tgo-grouping-text {
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        margin-top: 12px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      @keyframes tgo-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message, type = 'info', duration = 3000) {
    injectStyles();
    const toast = document.createElement('div');
    toast.className = `tgo-toast ${type}`;

    const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span class="tgo-toast-icon">${icons[type] || ''}</span>${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('visible'));
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function showGroupingOverlay(message = 'Grouping tabs...') {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.className = 'tgo-grouping-overlay';
    overlay.innerHTML = `
      <div style="text-align:center">
        <div class="tgo-grouping-spinner"></div>
        <div class="tgo-grouping-text">${message}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('visible'));
    });
    return {
      update(msg) {
        const text = overlay.querySelector('.tgo-grouping-text');
        if (text) text.textContent = msg;
      },
      remove() {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
      }
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SHOW_TOAST') {
      showToast(msg.message, msg.toastType || 'success', msg.duration || 3000);
      sendResponse({ ok: true });
    }
    if (msg.type === 'SHOW_GROUPING') {
      const overlay = showGroupingOverlay(msg.message);
      sendResponse({ ok: true });
      const checkDone = setInterval(() => {
        if (msg._done) {
          overlay.remove();
          clearInterval(checkDone);
        }
      }, 500);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'g') {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'AUTO_GROUP' });
    }
    if (e.altKey && e.key === 'c') {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'COLLAPSE_ALL' });
    }
    if (e.altKey && e.key === 'e') {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'EXPAND_ALL' });
    }
  });
})();
