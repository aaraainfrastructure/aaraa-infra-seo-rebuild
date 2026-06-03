(function () {
  'use strict';

  var CONFIG = {
    toastDuration: 5000,
    debug: window.location.hostname === 'localhost'
  };

  function log() {
    if (CONFIG.debug) console.log('[AARAA Modals]', ...arguments);
  }

  var AaraaModals = {
    init() {
      if (document.documentElement.classList.contains('aaraa-modals-init')) {
        this.bindLegacyTriggers();
        return;
      }
      document.documentElement.classList.add('aaraa-modals-init');
      log('Initializing modal system');
      this.initModals();
      this.initToasts();
      this.bindForms();
      this.bindLegacyTriggers();
    },

    initModals() {
      document.querySelectorAll('.ai-modal-overlay').forEach(function (overlay) {
        if (overlay.dataset.aaraaModalInit) return;
        overlay.dataset.aaraaModalInit = 'true';
        var closeBtn = overlay.querySelector('.ai-modal-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            AaraaModals.closeModal(overlay);
          });
        }
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) AaraaModals.closeModal(overlay);
        });
      });

      document.querySelectorAll('[data-modal-open]').forEach(function (btn) {
        if (btn.dataset.aaraaModalTriggerInit) return;
        btn.dataset.aaraaModalTriggerInit = 'true';
        btn.addEventListener('click', function () {
          var target = document.getElementById(btn.getAttribute('data-modal-open'));
          if (target) AaraaModals.openModal(target);
        });
      });
    },

    openModal(overlay) {
      if (!overlay || overlay.classList.contains('active')) return;
      if (typeof window.__aaraaOpenPopup === 'function') {
        window.__aaraaOpenPopup(overlay);
        return;
      }
      overlay.classList.add('active');
      document.body.classList.add('ai-modal-open');
      var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty('--ai-scrollbar-width', scrollbarWidth + 'px');
      log('Modal opened:', overlay.id);
    },

    closeModal(overlay) {
      if (!overlay) return;
      if (typeof window.__aaraaClosePopup === 'function') {
        window.__aaraaClosePopup(overlay);
        return;
      }
      overlay.classList.remove('active');
      if (!document.querySelector('.ai-modal-overlay.active')) {
        document.body.classList.remove('ai-modal-open');
      }
      log('Modal closed:', overlay.id);
    },

    closeActiveModal() {
      if (typeof window.__aaraaCloseActivePopup === 'function') {
        window.__aaraaCloseActivePopup();
        return;
      }
      var active = document.querySelector('.ai-modal-overlay.active');
      if (active) this.closeModal(active);
    },

    initToasts() {
      if (document.getElementById('ai-toast-container')) return;
      var container = document.createElement('div');
      container.id = 'ai-toast-container';
      container.className = 'ai-toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    },

    showToast: function (type, title, message) {
      AaraaModals.initToasts();
      var container = document.getElementById('ai-toast-container');
      if (!container) return;

      var toast = document.createElement('div');
      toast.className = 'ai-toast ' + type;
      toast.setAttribute('role', 'alert');
      toast.innerHTML = '<strong>' + title + '</strong><br>' + message;
      container.appendChild(toast);

      requestAnimationFrame(function () {
        toast.classList.add('show');
      });

      setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
      }, CONFIG.toastDuration);
    },

    bindForms() {
      document.querySelectorAll('.ai-modal-box form, form[data-form-handler="aaraa"]').forEach(function (form) {
        if (form.dataset.aaraaFormBound) return;
        form.dataset.aaraaFormBound = 'true';
        form.addEventListener('submit', AaraaModals._submitHandler);
      });
    },

    _submitHandler: function (e) {
      AaraaModals.handleSubmit(e, this);
    },

    async handleSubmit(e, form) {
      e.preventDefault();

      if (form.getAttribute('data-submitting') === 'true') {
        log('Blocked duplicate submission');
        return;
      }
      form.setAttribute('data-submitting', 'true');

      var errors = this.validateForm(form);
      this.clearErrors(form);

      if (errors.length > 0) {
        errors.forEach(function (err) { AaraaModals.showFieldError(form, err.field, err.message); });
        form.setAttribute('data-submitting', 'false');
        AaraaModals.showToast('error', 'Validation Error', errors[0].message);
        return;
      }

      var btn = form.querySelector('.ai-btn-submit');
      if (btn) btn.classList.add('loading');

      try {
        log('Delegating submission to Firebase handler (capture phase)');

        var overlay = form.closest('.ai-modal-overlay');
        form.removeAttribute('data-firebase-skip');
        if (typeof window.__aaraaFirebaseHandler === 'function') {
          window.__aaraaFirebaseHandler(e);
        } else {
          AaraaModals.showToast('success', 'Thank You!', 'Your enquiry has been submitted. Our team will contact you shortly.');
          form.reset();
          if (overlay) {
            setTimeout(function () { AaraaModals.closeModal(overlay); }, 2000);
          }
        }
      } catch (err) {
        log('Delegation error:', err);
        AaraaModals.showToast('error', 'Submission Failed', 'Please try again or call us directly.');
      } finally {
        form.setAttribute('data-submitting', 'false');
        if (btn) btn.classList.remove('loading');
      }
    },

    validateForm(form) {
      var errors = [];
      var inputs = form.querySelectorAll('input, textarea, select');

      inputs.forEach(function (input) {
        if (input.type === 'submit' || input.type === 'hidden' || input.type === 'checkbox') return;

        var value = input.value.trim();
        var name = input.name;
        var type = input.type;
        var required = input.required || input.hasAttribute('required');

        if (required && !value) {
          errors.push({ field: name, message: AaraaModals.getFieldLabel(name) + ' is required' });
          return;
        }

        if (!value) return;

        if (type === 'email' || name === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({ field: name, message: 'Please enter a valid email address' });
            return;
          }
        }

        if (name === 'phone' || name === 'clientPhone' || name === 'mobile') {
          var digits = value.replace(/\D/g, '');
          if (digits.length < 10) {
            errors.push({ field: name, message: 'Phone number must have at least 10 digits' });
            return;
          }
          if (!/^[6-9]\d{9}$/.test(digits)) {
            errors.push({ field: name, message: 'Please enter a valid Indian mobile number starting with 6-9' });
            return;
          }
        }

        if (name === 'aadhaar') {
          var aadhaarDigits = value.replace(/\D/g, '');
          if (aadhaarDigits.length !== 12) {
            errors.push({ field: name, message: 'Aadhaar must be exactly 12 digits' });
            return;
          }
        }

        if (name === 'pan') {
          if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(value)) {
            errors.push({ field: name, message: 'Please enter a valid PAN (e.g., ABCDE1234F)' });
            return;
          }
        }

        if (name === 'gst') {
          if (!/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}Z[0-9A-Za-z]{1}$/.test(value)) {
            errors.push({ field: name, message: 'Please enter a valid GST number' });
            return;
          }
        }
      });

      return errors;
    },

    getFieldLabel(name) {
      var labels = {
        name: 'Name',
        email: 'Email',
        phone: 'Phone Number',
        mobile: 'Phone Number',
        message: 'Message',
        company: 'Company Name',
        aadhaar: 'Aadhaar Number',
        pan: 'PAN Number',
        gst: 'GST Number',
        clientName: 'Full Name',
        clientPhone: 'Phone Number',
        reason: 'Reason for Connection',
        description: 'Description',
        subject: 'Subject'
      };
      return labels[name] || name.charAt(0).toUpperCase() + name.slice(1);
    },

    clearErrors(form) {
      form.querySelectorAll('.ai-field-error').forEach(function (el) { el.remove(); });
      form.querySelectorAll('.error').forEach(function (el) { el.classList.remove('error'); });
    },

    showFieldError(form, fieldName, message) {
      if (!fieldName) return;
      var input = form.querySelector('[name="' + fieldName + '"]');
      if (!input) return;
      var group = input.closest('.ai-form-group') || input.parentElement;
      input.classList.add('error');
      var err = document.createElement('span');
      err.className = 'ai-field-error';
      err.textContent = message;
      group.appendChild(err);
    },

    bindLegacyTriggers() {
      if (window.__aaraaLegacyBound) return;
      window.__aaraaLegacyBound = true;

      var originalOpenEnquiry = window.openEnquiry;
      var originalCloseEnquiry = window.closeEnquiry;
      var originalOpenPopup = window.openPopup;
      var originalClosePopup = window.closePopup;

      window.openEnquiry = function () {
        if (typeof originalOpenEnquiry === 'function') {
          if (originalOpenEnquiry()) return;
        }
        if (_showOverlay(document.getElementById('headerEnquiryForm'))) return;
        if (_showOverlay(document.getElementById('enquiryForm'))) return;
      };

      window.closeEnquiry = function () {
        if (typeof originalCloseEnquiry === 'function') {
          if (originalCloseEnquiry()) return;
        }
        if (_hideOverlay(document.getElementById('headerEnquiryForm'))) return;
        if (_hideOverlay(document.getElementById('enquiryForm'))) return;
      };

      function _showOverlay(el) {
        if (!el) return false;
        if (el.classList.contains('aaraa-popup-overlay') || el.classList.contains('ai-modal-overlay')) {
          if (typeof window.__aaraaOpenPopup === 'function') {
            window.__aaraaOpenPopup(el);
          } else {
            el.classList.add('active');
            document.body.classList.add(el.classList.contains('aaraa-popup-overlay') ? 'aaraa-popup-open' : 'ai-modal-open');
          }
        } else {
          el.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          var modal = el.closest('.modal');
          if (modal) modal.style.display = 'flex';
        }
        return true;
      }

      function _hideOverlay(el) {
        if (!el) return false;
        if (el.classList.contains('aaraa-popup-overlay') || el.classList.contains('ai-modal-overlay')) {
          el.classList.remove('active');
          if (!document.querySelector('.aaraa-popup-overlay.active')) {
            document.body.classList.remove('aaraa-popup-open');
          }
          if (!document.querySelector('.ai-modal-overlay.active')) {
            document.body.classList.remove('ai-modal-open');
          }
        } else {
          el.style.display = 'none';
          document.body.style.overflow = '';
          var modal = el.closest('.modal');
          if (modal) modal.style.display = 'none';
        }
        return true;
      }

      window.openPopup = function () {
        if (typeof originalOpenPopup === 'function') {
          if (originalOpenPopup()) return;
        }
        if (_showOverlay(document.getElementById('popupForm'))) return;
        if (_showOverlay(document.getElementById('vendorPopup'))) return;
        if (_showOverlay(document.getElementById('enquiryPopup'))) return;
      };

      window.closePopup = function () {
        if (typeof originalClosePopup === 'function') {
          if (originalClosePopup()) return;
        }
        if (_hideOverlay(document.getElementById('popupForm'))) return;
        if (_hideOverlay(document.getElementById('vendorPopup'))) return;
        if (_hideOverlay(document.getElementById('enquiryPopup'))) return;
      };

      window.closeEnquiryModal = function () {
        var el = document.getElementById('enquiryModal');
        if (!el) return;
        if (el.classList.contains('ai-modal-overlay')) {
          AaraaModals.closeModal(el);
        } else {
          el.style.display = 'none';
          var form = el.querySelector('#enquiryForm');
          if (form) { form.style.display = 'block'; form.reset(); }
          var thanks = el.querySelector('#thankYouMsg');
          if (thanks) thanks.style.display = 'none';
          document.body.style.overflow = '';
        }
      };
    }
  };

  function boot() {
    AaraaModals.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.AaraaModals = AaraaModals;

})();
