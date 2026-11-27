(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HikeMath = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROUTE_PROFILES = [
    { id: 'trail', label: 'Planinarska staza', short: 'Staza', icon: '🥾' },
    { id: 'foot', label: 'Pješke (putevi)', short: 'Pješke', icon: '🚶' },
    { id: 'car', label: 'Auto (ceste)', short: 'Auto', icon: '🚗' }
  ];

  function getRouteProfile(id) {
    return ROUTE_PROFILES.find(p => p.id === id) || ROUTE_PROFILES[0];
  }

  /**
   * Computes realistic travel duration in ms based on routing profile.
   * - car: uses router duration (seconds) if provided, otherwise 55 km/h fallback.
   * - foot: 4.8 km/h + Naismith climb (600 m/h).
   * - trail: 5.0 km/h + Naismith climb (600 m/h).
   */
  function calcRouteEtaMs(opts) {
    const distanceM = Math.max(0, Number(opts && opts.distanceM) || 0);
    const ascentM = Math.max(0, Number(opts && opts.ascentM) || 0);
    const profile = (opts && opts.profile) || 'trail';
    const routerDurationSec = opts && opts.routerDurationSec != null ? Number(opts.routerDurationSec) : null;

    if (profile === 'car') {
      if (routerDurationSec != null && isFinite(routerDurationSec) && routerDurationSec > 0) {
        return Math.round(routerDurationSec * 1000);
      }
      // Realistic mountain/regional road speed ~55 km/h
      return Math.round((distanceM / 55000) * 3600000);
    }
    if (profile === 'foot') {
      return Math.round((distanceM / 4800 + ascentM / 600) * 3600000);
    }
    // Hiking trail (Naismith)
    return Math.round((distanceM / 5000 + ascentM / 600) * 3600000);
  }

  function fmtDurationShort(ms) {
    const mins = Math.max(1, Math.round(Math.max(0, Number(ms) || 0) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return m + ' min';
    if (m === 0) return h + ' h';
    return h + ' h ' + String(m).padStart(2, '0') + ' min';
  }

  /**
   * Returns active recording elapsed time in ms, excluding paused periods.
   */
  function calcRecElapsedMs(rec, nowMs) {
    if (!rec || !rec.t0) return 0;
    const now = nowMs != null ? nowMs : Date.now();
    const pausedMs = Number(rec.pausedMs) || 0;
    const end = rec.paused && rec.pauseAt ? rec.pauseAt : now;
    return Math.max(0, end - rec.t0 - pausedMs);
  }

  /**
   * Computes a rounded metric scale bar (label, pixel width, and 1:N ratio).
   */
  function calcScaleBar(latDeg, zoom, maxPx) {
    const limitPx = maxPx || 88;
    const mpp = (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / Math.pow(2, zoom);
    const maxMeters = mpp * limitPx;
    if (!isFinite(maxMeters) || maxMeters <= 0) {
      return { meters: 100, widthPx: 50, label: '100 m', ratio: 25000 };
    }
    const pow10 = Math.pow(10, Math.floor(Math.log10(maxMeters)));
    const d = maxMeters / pow10;
    const mult = d >= 5 ? 5 : d >= 2 ? 2 : 1;
    const meters = pow10 * mult;
    const widthPx = Math.max(24, Math.round(meters / mpp));
    const label = meters >= 1000 ? (meters / 1000) + ' km' : meters + ' m';
    const rawRatio = mpp / (0.0254 / 96);
    const rp = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(10, rawRatio))) - 1));
    const ratio = Math.round(rawRatio / rp) * rp;
    return { meters, widthPx, label, ratio };
  }

  /**
   * Safely formats an SOS text payload; returns null if fix is missing/invalid.
   */
  function formatSosText(fix, utmFn) {
    if (!fix || typeof fix.lat !== 'number' || typeof fix.lng !== 'number' || isNaN(fix.lat) || isNaN(fix.lng)) {
      return null;
    }
    const utmStr = typeof utmFn === 'function' ? utmFn(fix.lat, fix.lng) : '';
    const tStr = fix.t ? new Date(fix.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      'HITNO – moja pozicija\n' +
      fix.lat.toFixed(5) + ', ' + fix.lng.toFixed(5) +
      (fix.acc ? ' (±' + Math.round(fix.acc) + ' m)' : '') +
      (utmStr ? '\nUTM ' + utmStr : '') +
      (fix.alt != null ? '\nVisina: ' + Math.round(fix.alt) + ' m' : '') +
      '\nhttps://maps.google.com/?q=' + fix.lat.toFixed(5) + ',' + fix.lng.toFixed(5) +
      (tStr ? '\nVrijeme: ' + tStr : '')
    );
  }

  /**
   * Estimates Web Mercator tile count for a geographic bounding box.
   */
  function estimateTileCount(bounds, z0, z1, layerMaxList) {
    const rad = d => (d * Math.PI) / 180;
    const t2x = (lng, z) => Math.floor(((lng + 180) / 360) * Math.pow(2, z));
    const t2y = (lat, z) => {
      const r = rad(Math.max(-85, Math.min(85, lat)));
      return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
    };
    let count = 0;
    for (const maxZ of layerMaxList) {
      const hi = Math.min(z1, maxZ);
      for (let z = z0; z <= hi; z++) {
        const x0 = t2x(bounds.west, z), x1 = t2x(bounds.east, z);
        const y0 = t2y(bounds.north, z), y1 = t2y(bounds.south, z);
        if (x1 >= x0 && y1 >= y0) count += (x1 - x0 + 1) * (y1 - y0 + 1);
      }
    }
    return count;
  }

  return {
    ROUTE_PROFILES,
    getRouteProfile,
    calcRouteEtaMs,
    fmtDurationShort,
    calcRecElapsedMs,
    calcScaleBar,
    formatSosText,
    estimateTileCount
  };
});
