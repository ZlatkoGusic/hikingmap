import test from 'node:test';
import assert from 'node:assert/strict';
import './hike-math.js';

const { HikeMath } = globalThis;

test('calcRouteEtaMs uses realistic driving speed for car profile', () => {
  // 14 km by car with OSRM duration 900s (15 min)
  const withRouter = HikeMath.calcRouteEtaMs({
    distanceM: 14000,
    ascentM: 350,
    profile: 'car',
    routerDurationSec: 900
  });
  assert.equal(withRouter, 15 * 60 * 1000);
  assert.equal(HikeMath.fmtDurationShort(withRouter), '15 min');

  // 14 km by car fallback without routerDurationSec (~15 min at 55 km/h, NOT ~3.4 hours hiking)
  const fallbackCar = HikeMath.calcRouteEtaMs({
    distanceM: 14000,
    ascentM: 350,
    profile: 'car'
  });
  assert.ok(fallbackCar > 12 * 60 * 1000 && fallbackCar < 20 * 60 * 1000);

  // Same 14 km with +350 m ascent on hiking trail (~3h 23m)
  const trail = HikeMath.calcRouteEtaMs({
    distanceM: 14000,
    ascentM: 350,
    profile: 'trail'
  });
  assert.ok(trail > 3 * 3600000 && trail < 4 * 3600000);
});

test('calcRecElapsedMs freezes elapsed time during pause and resumes cleanly', () => {
  const t0 = 1000000;
  // Active for 10 min
  assert.equal(HikeMath.calcRecElapsedMs({ t0, paused: false, pausedMs: 0, pauseAt: null }, t0 + 600000), 600000);

  // Paused at +10 min, inspected at +70 min (1 hour break at mountain hut) -> still 10 min
  const pausedRec = { t0, paused: true, pausedMs: 0, pauseAt: t0 + 600000 };
  assert.equal(HikeMath.calcRecElapsedMs(pausedRec, t0 + 4200000), 600000);

  // Resumed after 60 min break (pausedMs = 3600000), inspected 5 min later -> 15 min total
  const resumedRec = { t0, paused: false, pausedMs: 3600000, pauseAt: null };
  assert.equal(HikeMath.calcRecElapsedMs(resumedRec, t0 + 4500000), 900000);
});

test('formatSosText safely handles missing GPS fix without crashing', () => {
  assert.equal(HikeMath.formatSosText(null), null);
  assert.equal(HikeMath.formatSosText(undefined), null);
  assert.equal(HikeMath.formatSosText({ lat: NaN, lng: 18 }), null);

  const valid = HikeMath.formatSosText(
    { lat: 43.8563, lng: 18.4131, alt: 540, acc: 8, t: 1700000000000 },
    () => '34T 292114 4859123'
  );
  assert.match(valid, /43\.85630, 18\.41310/);
  assert.match(valid, /UTM 34T 292114 4859123/);
  assert.match(valid, /Visina: 540 m/);
});

test('calcScaleBar produces crisp metric labels and bounded widths across zoom levels', () => {
  const z15 = HikeMath.calcScaleBar(43.85, 15, 90);
  assert.ok(z15.widthPx >= 24 && z15.widthPx <= 90);
  assert.match(z15.label, /^(100|200|500) m$/);

  const z8 = HikeMath.calcScaleBar(43.85, 8, 90);
  assert.ok(z8.widthPx >= 24 && z8.widthPx <= 90);
  assert.match(z8.label, /km$/);
  assert.ok(z8.ratio > z15.ratio);
});

test('estimateTileCount computes bounded tile counts accurately', () => {
  const n = HikeMath.estimateTileCount(
    { south: 43.8, west: 18.3, north: 43.9, east: 18.5 },
    10,
    12,
    [17]
  );
  assert.ok(n > 0 && n < 200);
});

test('getActiveToolLabel returns consistent Bosnian labels for active tools', () => {
  assert.equal(HikeMath.getActiveToolLabel({}), null);
  assert.equal(HikeMath.getActiveToolLabel({ mode: 'bearing' }), 'Azimut');
  assert.equal(HikeMath.getActiveToolLabel({ mode: 'route' }), 'Dionica A→B');
  assert.equal(HikeMath.getActiveToolLabel({ markMode: true, pickCb: true }), 'Dodaj marker');
  assert.equal(HikeMath.getActiveToolLabel({ pickCb: true }), 'Odabir tačke');
  assert.equal(HikeMath.getActiveToolLabel({ calOn: true }), 'Kalibracija');
});

test('resolveMenuButtonAction returns to main menu from submenus like OK cross menu', () => {
  assert.equal(HikeMath.resolveMenuButtonAction(false, 0), 'open_main');
  assert.equal(HikeMath.resolveMenuButtonAction(true, 1), 'return_main');
  assert.equal(HikeMath.resolveMenuButtonAction(true, 2), 'return_main');
  assert.equal(HikeMath.resolveMenuButtonAction(true, 0), 'close');
});

test('resolveMenuSlideRelease supports one-handed slide-to-select, swipe-close, and safe scrolling', () => {
  // Slide vertically over non-scrolling OK menu and release on item 3
  assert.deepEqual(
    HikeMath.resolveMenuSlideRelease({ dx: 6, dy: -110, hoveredIdx: 3, scrollable: false, moved: true }),
    { action: 'select', idx: 3 }
  );
  // Slide off the left edge of the menu -> cancel safely
  assert.deepEqual(
    HikeMath.resolveMenuSlideRelease({ dx: -120, dy: -20, hoveredIdx: -1, scrollable: false, moved: true }),
    { action: 'none' }
  );
  // Swipe right to dismiss menu
  assert.deepEqual(
    HikeMath.resolveMenuSlideRelease({ dx: 88, dy: 12, hoveredIdx: 2, scrollable: false, moved: true }),
    { action: 'close' }
  );
  // Vertical scroll on tall scrollable menu should NOT accidentally select an item
  assert.deepEqual(
    HikeMath.resolveMenuSlideRelease({ dx: 2, dy: -90, hoveredIdx: 4, scrollable: true, moved: true }),
    { action: 'none' }
  );
  // Direct tap on tall scrollable menu selects item
  assert.deepEqual(
    HikeMath.resolveMenuSlideRelease({ dx: 1, dy: 2, hoveredIdx: 4, scrollable: true, moved: false }),
    { action: 'select', idx: 4 }
  );
});
