/* DIGITAL MONITORING SYSTEM — GLOBAL LOGIN FIX V1
   Frontend gating only. Existing Apps Script APIs are unchanged. */
(function () {
  'use strict';

  const KEY = 'dms_authenticated_v4';
  const USER = 'bpbintaro';
  const PASS = 'jpcb@2026';
  const TTL = 12 * 60 * 60 * 1000;

  function readSession() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const valid =
        data &&
        data.user === USER &&
        Number.isFinite(Number(data.at)) &&
        (Date.now() - Number(data.at) < TTL);

      if (valid) return true;
      localStorage.removeItem(KEY);
    } catch (err) {
      // If storage is unavailable, login can still be accepted for this page.
    }
    return false;
  }

  window.DMSAuth = {
    isLoggedIn: readSession,

    login: function (user, pass) {
      const ok =
        String(user || '').trim().toLowerCase() === USER &&
        String(pass || '') === PASS;

      if (ok) {
        try {
          localStorage.setItem(KEY, JSON.stringify({
            user: USER,
            at: Date.now()
          }));
        } catch (err) {
          // Keep the current page usable even if storage is blocked.
        }
      }
      return ok;
    },

    logout: function () {
      try {
        localStorage.removeItem(KEY);
        localStorage.removeItem('dms_authenticated_v3');
      } catch (err) {}
    },

    requireLogin: function () {
      if (readSession()) return true;

      const path = location.pathname;
      const base = path.indexOf('/pages/') >= 0
        ? path.substring(0, path.indexOf('/pages/'))
        : path.replace(/\/[^/]*$/, '');

      location.replace((base || '') + '/index.html?login=1');
      return false;
    }
  };
})();
