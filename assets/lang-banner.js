/**
 * lang-banner.js
 * Shows an informational banner on article pages when the user's
 * preferred language doesn't match the article language.
 *
 * Usage: Include after the opening <body> tag or before </body>.
 * Requires: <html lang="fr|en|ar"> attribute on the page.
 * Optional: A <div id="langBanner"></div> where you want the banner placed.
 *           If not present, it's injected after the brand-bar.
 */
(function () {
  'use strict';

  var userLang = localStorage.getItem('mw-lang');
  if (!userLang) {
    var nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    userLang = nav.startsWith('fr') ? 'fr' : 'en';
  }

  var pageLang = document.documentElement.lang || 'fr';

  // No mismatch, nothing to show
  if (userLang === pageLang) return;

  var messages = {
    // User is EN, page is FR
    'en-fr': {
      icon: 'fa-solid fa-language',
      text: 'This article is in French.',
      linkText: 'Switch to French mode',
      linkAction: "localStorage.setItem('mw-lang','fr');location.reload();"
    },
    // User is EN, page is AR
    'en-ar': {
      icon: 'fa-solid fa-language',
      text: 'This article is in Arabic.',
      linkText: 'View all articles',
      linkHref: '/?tab=analyses'
    },
    // User is FR, page is EN
    'fr-en': {
      icon: 'fa-solid fa-language',
      text: 'Cet article est en anglais.',
      linkText: 'Passer en mode anglais',
      linkAction: "localStorage.setItem('mw-lang','en');location.reload();"
    },
    // User is FR, page is AR
    'fr-ar': {
      icon: 'fa-solid fa-language',
      text: 'Cet article est en arabe.',
      linkText: 'Voir tous les articles',
      linkHref: '/?tab=analyses'
    }
  };

  var key = userLang + '-' + pageLang;
  var msg = messages[key];
  if (!msg) return;

  function createBanner() {
    var banner = document.createElement('div');
    banner.style.cssText = 'display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:10px;padding:10px 16px;margin:0.75rem auto;max-width:900px;font-size:0.85rem;color:#1e40af;font-family:Inter,sans-serif;';

    var icon = document.createElement('i');
    icon.className = msg.icon;
    icon.style.fontSize = '1.1rem';
    banner.appendChild(icon);

    var text = document.createElement('span');
    text.textContent = msg.text + ' ';
    banner.appendChild(text);

    if (msg.linkAction) {
      var link = document.createElement('a');
      link.href = '#';
      link.textContent = msg.linkText;
      link.style.cssText = 'color:#1d4ed8;font-weight:600;text-decoration:underline;text-underline-offset:2px;';
      link.setAttribute('onclick', msg.linkAction + 'return false;');
      text.appendChild(link);
    } else if (msg.linkHref) {
      var link2 = document.createElement('a');
      link2.href = msg.linkHref;
      link2.textContent = msg.linkText;
      link2.style.cssText = 'color:#1d4ed8;font-weight:600;text-decoration:underline;text-underline-offset:2px;';
      text.appendChild(link2);
    }

    // Close button
    var close = document.createElement('button');
    close.innerHTML = '&times;';
    close.style.cssText = 'margin-left:auto;background:none;border:none;color:#1e40af;font-size:1.2rem;cursor:pointer;padding:0 4px;opacity:0.6;';
    close.onclick = function () { banner.remove(); };
    banner.appendChild(close);

    return banner;
  }

  function inject() {
    var existing = document.getElementById('langBanner');
    if (existing) {
      existing.appendChild(createBanner());
      return;
    }

    // Insert after brand-bar or at top of container
    var brandBar = document.querySelector('.brand-bar');
    var container = document.querySelector('.container');
    var target = brandBar || container;

    if (target) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding:0 1rem;';
      wrapper.appendChild(createBanner());
      target.parentNode.insertBefore(wrapper, target.nextSibling);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
