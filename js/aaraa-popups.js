(function () {
  'use strict';

  var POPUP_CONFIG = {
    enquiry: {
      overlayId: 'aaraaEnquiryOverlay',
      triggerAttr: 'data-aaraa-enquiry',
      closeSelector: '[data-aaraa-close="enquiry"]'
    },
    vendor: {
      overlayId: 'aaraaVendorOverlay',
      triggerAttr: 'data-aaraa-vendor',
      closeSelector: '[data-aaraa-close="vendor"]'
    }
  };

  var activePopup = null;

  function getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  }

  function lockBodyScroll(popupClass) {
    var sbw = getScrollbarWidth();
    var cls = popupClass === 'aaraa-popup-overlay' ? 'aaraa-popup-open' : 'ai-modal-open';
    var prop = cls === 'aaraa-popup-open' ? '--aaraa-scrollbar-width' : '--ai-scrollbar-width';
    document.documentElement.style.setProperty(prop, sbw + 'px');
    document.documentElement.classList.add(cls);
    document.body.classList.add(cls);
  }

  function unlockBodyScroll() {
    var cls = 'aaraa-popup-open';
    if (!document.querySelector('.aaraa-popup-overlay.active')) {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    }
    cls = 'ai-modal-open';
    if (!document.querySelector('.ai-modal-overlay.active')) {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    }
  }

  function resetPopupForm(overlay) {
    if (!overlay) return;
    var form = overlay.querySelector('form');
    if (form) {
      form.reset();
      form.removeAttribute('data-firebase-processing');
      form.removeAttribute('data-submitting');
    }
    var success = overlay.querySelector('.aaraa-popup-success');
    if (success) success.classList.remove('show');
    var errorMsg = overlay.querySelector('.aaraa-popup-error-message');
    if (errorMsg) {
      errorMsg.textContent = '';
      errorMsg.style.display = 'none';
    }
    var formBody = overlay.querySelector('.aaraa-popup-form-body');
    if (formBody) formBody.style.display = '';
    var submitBtn = overlay.querySelector('.aaraa-popup-submit, .ai-btn-submit');
    if (submitBtn) {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      if (submitBtn._originalText) {
        submitBtn.innerHTML = submitBtn._originalText;
        submitBtn._originalText = null;
      }
    }
  }

  function openPopup(overlay) {
    if (!overlay || overlay.classList.contains('active')) return;
    activePopup = overlay;
    var isAaraa = overlay.classList.contains('aaraa-popup-overlay');
    lockBodyScroll(isAaraa ? 'aaraa-popup-overlay' : 'ai-modal-overlay');
    overlay.classList.add('active');
    resetPopupForm(overlay);
  }

  function closePopup(overlay) {
    if (!overlay) return;
    overlay.classList.remove('active');
    if (activePopup === overlay) activePopup = null;
    unlockBodyScroll();
    resetPopupForm(overlay);
  }

  function closeActivePopup() {
    var active = document.querySelector('.aaraa-popup-overlay.active') ||
                 document.querySelector('.ai-modal-overlay.active');
    if (active) closePopup(active);
  }

  function setupOverlay(overlay) {
    if (!overlay || overlay.dataset.aaraaPopupInit) return;
    overlay.dataset.aaraaPopupInit = 'true';

    var closeBtn = overlay.querySelector('.aaraa-popup-close, .ai-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePopup(overlay);
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup(overlay);
    });

    overlay.querySelectorAll('[data-aaraa-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closePopup(overlay); });
    });
  }

  function initTriggers() {
    Object.keys(POPUP_CONFIG).forEach(function (key) {
      var cfg = POPUP_CONFIG[key];
      document.querySelectorAll('[' + cfg.triggerAttr + ']').forEach(function (el) {
        if (el.dataset.aaraaTriggerInit) return;
        el.dataset.aaraaTriggerInit = 'true';
        el.addEventListener('click', function (e) {
          e.preventDefault();
          var overlay = document.getElementById(cfg.overlayId);
          if (overlay) openPopup(overlay);
        });
      });
    });
  }

  function initESCHandler() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeActivePopup();
    });
  }

  function initFormObservers() {
    document.querySelectorAll('.aaraa-popup-overlay form, .ai-modal-box form').forEach(function (form) {
      if (form.dataset.aaraaFormObserved) return;
      form.dataset.aaraaFormObserved = 'true';

      form.addEventListener('submit', function () {
        var submitBtn = form.querySelector('.aaraa-popup-submit, .ai-btn-submit');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.setAttribute('data-processing', 'true');
        }
        var overlay = form.closest('.aaraa-popup-overlay, .ai-modal-overlay');
        if (overlay) {
          var errorMsg = overlay.querySelector('.aaraa-popup-error-message');
          if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.style.display = 'none';
          }
        }
      });

      form.addEventListener('aaraa-form-result', function (e) {
        var detail = e.detail;
        var overlay = form.closest('.aaraa-popup-overlay, .ai-modal-overlay');
        if (!overlay) return;

        var submitBtn = form.querySelector('.aaraa-popup-submit, .ai-btn-submit');
        if (submitBtn) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          submitBtn.removeAttribute('data-processing');
        }

        if (detail.success) {
          var successEl = overlay.querySelector('.aaraa-popup-success');
          var formBody = overlay.querySelector('.aaraa-popup-form-body');
          if (successEl) successEl.classList.add('show');
          if (formBody) formBody.style.display = 'none';
          form.reset();
          setTimeout(function () { closePopup(overlay); }, 5000);
        } else {
          var errorEl = overlay.querySelector('.aaraa-popup-error-message');
          if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'aaraa-popup-error-message';
            form.insertBefore(errorEl, form.firstChild);
          }
          errorEl.textContent = detail.error || 'Submission failed. Please try again.';
          errorEl.style.display = 'block';
        }
      });
    });
  }

  function init() {
    if (document.documentElement.classList.contains('aaraa-popups-init')) {
      initTriggers();
      return;
    }
    document.documentElement.classList.add('aaraa-popups-init');

    document.querySelectorAll('.aaraa-popup-overlay').forEach(function (overlay) {
      setupOverlay(overlay);
    });

    initTriggers();
    initFormObservers();

    if (!window._aaraaEscHandlerInit) {
      window._aaraaEscHandlerInit = true;
      initESCHandler();
    }

    window.openEnquiry = function () {
      var el = document.getElementById(POPUP_CONFIG.enquiry.overlayId);
      if (el) { openPopup(el); return true; }
      el = document.getElementById('headerEnquiryForm');
      if (el) { openPopup(el); return true; }
      return false;
    };

    window.closeEnquiry = function () {
      var el = document.getElementById(POPUP_CONFIG.enquiry.overlayId);
      if (el && el.classList.contains('active')) { closePopup(el); return true; }
      el = document.getElementById('headerEnquiryForm');
      if (el && el.classList.contains('active')) { closePopup(el); return true; }
      return false;
    };

    window.openVendorPopup = function () {
      var el = document.getElementById(POPUP_CONFIG.vendor.overlayId);
      if (el) { openPopup(el); return true; }
      return false;
    };

    window.closeVendorPopup = function () {
      var el = document.getElementById(POPUP_CONFIG.vendor.overlayId);
      if (el && el.classList.contains('active')) { closePopup(el); return true; }
      return false;
    };

    window.openPopup = function () {
      var el = document.getElementById(POPUP_CONFIG.vendor.overlayId);
      if (el) { openPopup(el); return true; }
      el = document.getElementById('popupForm');
      if (el && el.classList.contains('ai-modal-overlay')) { openPopup(el); return true; }
      return false;
    };

    window.closePopup = function () {
      var el = document.getElementById(POPUP_CONFIG.vendor.overlayId);
      if (el && el.classList.contains('active')) { closePopup(el); return true; }
      el = document.getElementById('popupForm');
      if (el && el.classList.contains('active')) { closePopup(el); return true; }
      return false;
    };

    window.closeEnquiryModal = function () {
      var el = document.getElementById('enquiryModal');
      if (el) { closePopup(el); }
    };

    window.__aaraaOpenPopup = openPopup;
    window.__aaraaClosePopup = closePopup;
    window.__aaraaCloseActivePopup = closeActivePopup;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
