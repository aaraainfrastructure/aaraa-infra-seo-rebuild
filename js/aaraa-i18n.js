/* ============================================
   AARAA i18n Engine v1.0
   Lightweight client-side internationalization
   ============================================ */

;(function () {
  'use strict';

  var SUPPORTED_LANGS = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr'];
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'aaraa-lang';
  var ATTR_KEY = 'data-i18n';
  var ATTR_HTML = 'data-i18n-html';
  var ATTR_PLACEHOLDER = 'data-i18n-placeholder';
  var ATTR_ALT = 'data-i18n-alt';
  var ATTR_VALUE = 'data-i18n-value';
  var ATTR_TITLE = 'data-i18n-title';
  var ATTR_ARIA = 'data-i18n-aria-label';
  var LOADED_FLAG = 'aaraa-i18n-loaded';

  var currentLang = DEFAULT_LANG;
  var localeData = {};
  var isReady = false;
  var callbacks = [];

  /* ---------- Language Detection ---------- */

  function detectLanguage() {
    // 1. URL path prefix
    var path = window.location.pathname;
    var match = path.match(/^\/(en|hi|ta|te|kn|ml|mr)(?:\/|$)/);
    if (match && SUPPORTED_LANGS.indexOf(match[1]) !== -1) {
      currentLang = match[1];
      persistLanguage(currentLang);
      return currentLang;
    }

    // 2. Query param override
    var qs = new URLSearchParams(window.location.search);
    var langParam = qs.get('lang');
    if (langParam && SUPPORTED_LANGS.indexOf(langParam) !== -1) {
      currentLang = langParam;
      persistLanguage(currentLang);
      return currentLang;
    }

    // 3. Saved preference
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1) {
      currentLang = saved;
      return currentLang;
    }

    // 4. Browser language
    var browserLang = (navigator.language || navigator.userLanguage || '').split('-')[0];
    if (browserLang && SUPPORTED_LANGS.indexOf(browserLang) !== -1) {
      if (browserLang !== DEFAULT_LANG) {
        currentLang = browserLang;
        persistLanguage(currentLang);
        return currentLang;
      }
    }

    // 5. Default fallback
    currentLang = DEFAULT_LANG;
    return currentLang;
  }

  function persistLanguage(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  /* ---------- Locale Loading ---------- */

  function getLocalePath(lang) {
    return 'locales/' + lang + '.json';
  }

  function loadLocale(lang) {
    if (lang === DEFAULT_LANG) {
      localeData = {};
      return Promise.resolve();
    }
    var cached = sessionStorage.getItem('aaraa-locale-' + lang);
    if (cached) {
      try {
        localeData = JSON.parse(cached);
        return Promise.resolve();
      } catch (e) {}
    }
    var url = getLocalePath(lang);
    return fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load locale: ' + url);
        return res.json();
      })
      .then(function (data) {
        localeData = data || {};
        try { sessionStorage.setItem('aaraa-locale-' + lang, JSON.stringify(localeData)); } catch (e) {}
      })
      .catch(function (err) {
        console.warn('[AARAA i18n]', err.message);
        localeData = {};
      });
  }

  /* ---------- Translation ---------- */

  function t(key) {
    if (!key) return '';
    if (currentLang === DEFAULT_LANG) return key;
    if (localeData[key]) return localeData[key];
    return key;
  }

  function resolveKeyPath(obj, path) {
    var parts = path.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object' && parts[i] in current) {
        current = current[parts[i]];
      } else {
        return undefined;
      }
    }
    return current;
  }

  function translateText(key) {
    if (currentLang === DEFAULT_LANG) return key;
    var translation = localeData[key] || resolveKeyPath(localeData, key);
    return translation !== undefined && translation !== null ? translation : key;
  }

  /* ---------- DOM Translation ---------- */

  function processElement(el) {
    var key;

    key = el.getAttribute(ATTR_KEY);
    if (key) {
      var text = translateText(key);
      if (text && text !== key) {
        el.textContent = text;
      }
    }

    key = el.getAttribute(ATTR_HTML);
    if (key) {
      var html = translateText(key);
      if (html && html !== key) {
        el.innerHTML = html;
      }
    }

    key = el.getAttribute(ATTR_PLACEHOLDER);
    if (key) {
      var ph = translateText(key);
      if (ph && ph !== key && el.hasAttribute('placeholder')) {
        el.setAttribute('placeholder', ph);
      }
    }

    key = el.getAttribute(ATTR_ALT);
    if (key) {
      var altText = translateText(key);
      if (altText && altText !== key && el.hasAttribute('alt')) {
        el.setAttribute('alt', altText);
      }
    }

    key = el.getAttribute(ATTR_VALUE);
    if (key) {
      var val = translateText(key);
      if (val && val !== key) {
        el.setAttribute('value', val);
      }
    }

    key = el.getAttribute(ATTR_TITLE);
    if (key) {
      var title = translateText(key);
      if (title && title !== key) {
        el.setAttribute('title', title);
      }
    }

    key = el.getAttribute(ATTR_ARIA);
    if (key) {
      var aria = translateText(key);
      if (aria && aria !== key) {
        el.setAttribute('aria-label', aria);
      }
    }
  }

  function translatePage(root) {
    root = root || document;
    var elements = root.querySelectorAll('[' + ATTR_KEY + '], [' + ATTR_HTML + '], [' + ATTR_PLACEHOLDER + '], [' + ATTR_ALT + '], [' + ATTR_VALUE + '], [' + ATTR_TITLE + '], [' + ATTR_ARIA + ']');
    for (var i = 0; i < elements.length; i++) {
      processElement(elements[i]);
    }
    document.documentElement.lang = currentLang;
  }

  /* ---------- SEO Tags ---------- */

  function injectHreflang() {
    var existing = document.querySelectorAll('link[data-i18n-hreflang]');
    for (var i = 0; i < existing.length; i++) {
      existing[i].parentNode.removeChild(existing[i]);
    }

    var canonical = document.querySelector('link[rel="canonical"]');
    var canonicalHref = canonical ? canonical.getAttribute('href') : window.location.origin + window.location.pathname.replace(/^\/(en|hi|ta|te|kn|ml|mr)/, '');

    var cleanPath = window.location.pathname.replace(/^\/(en|hi|ta|te|kn|ml|mr)/, '') || '/';

    for (var j = 0; j < SUPPORTED_LANGS.length; j++) {
      var lang = SUPPORTED_LANGS[j];
      var link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('data-i18n-hreflang', '');
      var href;
      if (lang === DEFAULT_LANG) {
        href = window.location.origin + cleanPath;
      } else {
        href = window.location.origin + '/' + lang + cleanPath;
      }
      link.setAttribute('href', href);
      document.head.appendChild(link);
    }

    var xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('data-i18n-hreflang', '');
    xDefault.setAttribute('href', window.location.origin + cleanPath);
    document.head.appendChild(xDefault);
  }

  function updateCanonical() {
    var cleanPath = window.location.pathname.replace(/^\/(en|hi|ta|te|kn|ml|mr)/, '') || '/';
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', window.location.origin + cleanPath);
    }
  }

  function injectLangMeta() {
    var meta = document.querySelector('meta[name="language"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'language');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', currentLang);
  }

  /* ---------- Language Switcher ---------- */

  function getLanguageLabel(langCode) {
    var labels = {
      en: 'English',
      hi: 'हिन्दी',
      ta: 'தமிழ்',
      te: 'తెలుగు',
      kn: 'ಕನ್ನಡ',
      ml: 'മലയാളം',
      mr: 'मराठी'
    };
    return labels[langCode] || langCode.toUpperCase();
  }

  function createLanguageSwitcher() {
    if (document.getElementById('aaraa-lang-switcher')) return;

    var container = document.createElement('div');
    container.id = 'aaraa-lang-switcher';
    container.className = 'aaraa-lang-switcher';
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Language switcher');

    var btn = document.createElement('button');
    btn.className = 'aaraa-lang-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="aaraa-lang-icon">🌐</span><span class="aaraa-lang-current">' + getLanguageLabel(currentLang) + '</span><span class="aaraa-lang-arrow">▾</span>';

    var dropdown = document.createElement('ul');
    dropdown.className = 'aaraa-lang-dropdown';
    dropdown.setAttribute('role', 'menu');
    dropdown.style.display = 'none';

    var currentLangCode = currentLang;
    for (var i = 0; i < SUPPORTED_LANGS.length; i++) {
      var code = SUPPORTED_LANGS[i];
      var item = document.createElement('li');
      item.setAttribute('role', 'none');
      var link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.setAttribute('href', '#');
      link.setAttribute('data-lang', code);
      link.className = 'aaraa-lang-option';
      if (code === currentLangCode) link.classList.add('active');
      link.innerHTML = getLanguageLabel(code);
      item.appendChild(link);
      dropdown.appendChild(item);
    }

    container.appendChild(btn);
    container.appendChild(dropdown);
    document.body.appendChild(container);

    /* ---------- Events ---------- */

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
      btn.setAttribute('aria-expanded', !isOpen);
    });

    dropdown.addEventListener('click', function (e) {
      var target = e.target;
      if (target.tagName !== 'A') return;
      e.preventDefault();
      var lang = target.getAttribute('data-lang');
      if (lang && lang !== currentLang) {
        switchLanguage(lang);
      }
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('click', function () {
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function updateSwitcherLabel() {
    var currentEl = document.querySelector('.aaraa-lang-current');
    if (currentEl) {
      currentEl.textContent = getLanguageLabel(currentLang);
    }
    var options = document.querySelectorAll('.aaraa-lang-option');
    for (var i = 0; i < options.length; i++) {
      options[i].classList.remove('active');
      if (options[i].getAttribute('data-lang') === currentLang) {
        options[i].classList.add('active');
      }
    }
  }

  /* ---------- URL Rewriting ---------- */

  function buildLanguageUrl(lang) {
    var path = window.location.pathname;
    var search = window.location.search;
    var hash = window.location.hash;
    var cleanPath = path.replace(/^\/(en|hi|ta|te|kn|ml|mr)/, '') || '/';
    if (lang === DEFAULT_LANG) {
      return cleanPath + search + hash;
    }
    return '/' + lang + cleanPath + search + hash;
  }

  function switchLanguage(lang) {
    if (lang === currentLang) return;
    persistLanguage(lang);
    var url = buildLanguageUrl(lang);
    window.location.href = url;
  }

  /* ---------- Video Localization ---------- */

  function getLocalizedVideoIds() {
    var videos = {
      en: 'zPSnAosLNzw',
      hi: 'zPSnAosLNzw',
      ta: 'zPSnAosLNzw',
      te: 'zPSnAosLNzw',
      kn: 'zPSnAosLNzw',
      ml: 'zPSnAosLNzw',
      mr: 'zPSnAosLNzw'
    };
    return videos[currentLang] || videos[DEFAULT_LANG];
  }

  function updateHeroVideo() {
    var iframe = document.getElementById('ytHero');
    if (!iframe || !iframe.src) return;
    var videoId = getLocalizedVideoIds();
    var src = iframe.src;
    var newSrc = src.replace(/\/embed\/[^?]+/, '/embed/' + videoId);
    if (newSrc !== src) {
      iframe.src = newSrc;
    }
  }

  function getLangDir() {
    return 'ltr';
  }

  /* ---------- Init ---------- */

  function init() {
    if (document.documentElement.classList.contains(LOADED_FLAG)) return;
    document.documentElement.classList.add(LOADED_FLAG);

    detectLanguage();
    injectHreflang();
    updateCanonical();
    injectLangMeta();
    updateHeroVideo();

    loadLocale(currentLang).then(function () {
      translatePage();
      createLanguageSwitcher();
      updateSwitcherLabel();
      isReady = true;
      document.body.classList.add('aaraa-i18n-ready');
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i]();
      }
    });

    /* Re-translate on dynamic content */
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1 && !added[j].closest('.' + LOADED_FLAG)) {
            translatePage(added[j]);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Public API ---------- */

  window.AaraaI18n = {
    getCurrentLang: function () { return currentLang; },
    getLangDir: getLangDir,
    t: translateText,
    translate: translatePage,
    switchLang: switchLanguage,
    getSupportedLangs: function () { return SUPPORTED_LANGS.slice(); },
    getLocalizedVideoIds: getLocalizedVideoIds,
    isReady: function () { return isReady; },
    onReady: function (fn) {
      if (isReady) { fn(); return; }
      callbacks.push(fn);
    }
  };

  /* ---------- Auto-init ---------- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
