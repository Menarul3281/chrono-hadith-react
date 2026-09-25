/* Dynasty geography — the projection, the region shapes and the dated extents
   the Islamic Dynasties map draws.

   Two things are deliberately explicit about their limits.

   1. The coastlines in `data/world-land.json` are modern Natural Earth geometry,
      drawn for context only. They say nothing about where a border ran.
   2. The territory shapes below are schematic. Boundaries between medieval
      states were frontiers of tribute, garrison and grazing, not surveyed lines,
      and the sources describe them as areas rather than borders. Every entry
      therefore carries `approximate: true`, the map prints that word on the
      frame, and an extent is only ever shown for the years its own period
      covers — never every dynasty's widest reach at once. */

const DynastyGeo = (() => {
  // ---- Projection ---------------------------------------------------------
  // Equirectangular over the window the map shows, normalised so the SVG can use
  // any frame that keeps the window's aspect ratio.
  const VIEW = { lonMin: -16, lonMax: 92, latMin: -3, latMax: 53 };
  const WIDTH = VIEW.lonMax - VIEW.lonMin;
  const HEIGHT = VIEW.latMax - VIEW.latMin;
  const ASPECT = WIDTH / HEIGHT;
  const PLANE_W = 1000;
  const PLANE_H = 1000 / ASPECT;      // height of the projected frame

  const project = ([lon, lat]) => [
    ((lon - VIEW.lonMin) / WIDTH) * PLANE_W,
    ((VIEW.latMax - lat) / HEIGHT) * PLANE_H,
  ];

  const ringPath = (ring) => {
    const pts = ring.map(project);
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
  };

  const centroid = (ring) => {
    const pts = ring.map(project);
    return [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
  };

  // ---- Schematic regions --------------------------------------------------
  // Each shape is the area the sources describe a place or a dynasty as
  // controlling in a period — a rectangle of meaning, not a surveyed border.
  const REGIONS = {
    hejaz:      { label: 'Hejaz',     ring: [[34.6, 29.4], [36.4, 27.6], [38.4, 24.2], [39.6, 21.4], [41.2, 18.4], [43.0, 16.2], [43.6, 13.4], [45.2, 15.6], [44.4, 18.4], [42.8, 21.4], [42.0, 24.4], [40.2, 27.0], [37.6, 29.2]] },
    najd:       { label: 'Najd',      ring: [[38.4, 29.4], [42.4, 29.6], [46.4, 28.6], [48.6, 25.4], [47.6, 22.4], [44.4, 20.4], [41.0, 21.4], [39.0, 24.4]] },
    yemen:      { label: 'Yemen',     ring: [[42.6, 16.4], [45.4, 16.4], [48.4, 14.4], [52.4, 15.4], [52.2, 17.4], [48.4, 18.6], [45.0, 17.6], [43.6, 17.4]] },
    levant:     { label: 'Levant',    ring: [[34.4, 31.4], [35.2, 33.6], [36.4, 36.6], [38.4, 37.2], [41.4, 36.4], [42.4, 34.4], [41.0, 31.4], [38.4, 30.4], [36.4, 29.4], [34.6, 29.4]] },
    jazira:     { label: 'Jazira',    ring: [[39.4, 35.4], [42.4, 37.6], [45.4, 37.2], [45.6, 34.4], [42.6, 33.4], [40.0, 33.6]] },
    iraq:       { label: 'Iraq',      ring: [[41.0, 30.0], [46.6, 29.9], [48.4, 32.0], [46.4, 34.4], [43.0, 34.0], [41.2, 32.0]] },
    persia:     { label: 'Persia',    ring: [[44.0, 39.4], [48.6, 38.6], [53.6, 38.2], [58.0, 37.6], [61.0, 36.4], [61.2, 31.0], [59.6, 25.6], [55.6, 26.2], [52.6, 27.6], [49.6, 29.6], [47.6, 30.0], [45.6, 32.0], [44.6, 35.0]] },
    khurasan:   { label: 'Khurasan',  ring: [[53.6, 37.6], [57.6, 38.0], [61.0, 36.4], [62.4, 33.6], [60.6, 31.0], [57.6, 31.2], [55.0, 33.0], [53.2, 35.2]] },
    tabaristan: { label: 'Tabaristan', ring: [[50.0, 37.4], [53.4, 38.0], [55.6, 37.0], [53.6, 36.0], [50.6, 36.4]] },
    caucasus:   { label: 'Azerbaijan & the Caucasus', ring: [[44.2, 42.0], [48.4, 41.6], [50.6, 40.6], [49.0, 38.4], [45.6, 38.6], [44.0, 39.6]] },
    transoxiana:{ label: 'Transoxiana', ring: [[57.6, 42.0], [62.6, 42.6], [67.6, 42.4], [71.6, 41.6], [72.0, 38.0], [69.6, 36.4], [65.0, 36.2], [60.6, 37.0], [58.0, 39.4]] },
    anatolia:   { label: 'Anatolia',  ring: [[26.4, 41.4], [29.4, 41.0], [35.6, 42.0], [41.0, 41.6], [44.0, 39.6], [43.0, 37.0], [39.6, 36.4], [35.6, 35.9], [31.6, 36.0], [27.6, 36.6], [26.0, 38.6]] },

    balkans:    { label: 'The Balkans', ring: [[19.0, 42.6], [22.4, 44.6], [26.4, 44.4], [29.4, 45.0], [29.4, 42.0], [26.4, 41.0], [23.0, 39.6], [20.4, 39.0], [19.0, 40.6]] },
    crimea:     { label: 'Crimea & the Black Sea steppe', ring: [[30.6, 45.6], [34.6, 46.2], [37.6, 47.0], [38.6, 45.0], [34.6, 44.6], [31.0, 44.8]] },
    egypt:      { label: 'Egypt',     ring: [[24.6, 31.6], [29.4, 31.6], [34.4, 31.4], [34.6, 29.4], [33.4, 24.0], [31.0, 22.0], [25.0, 22.0]] },
    ifriqiya:   { label: 'Ifriqiya',  ring: [[7.6, 37.2], [10.6, 37.4], [13.4, 33.4], [15.4, 32.0], [19.6, 30.4], [20.4, 31.6], [17.4, 33.0], [13.6, 34.6], [11.6, 36.6], [9.6, 36.6]] },
    maghreb:    { label: 'The Maghreb', ring: [[-10.4, 35.6], [-5.4, 35.6], [0.0, 36.4], [3.4, 37.0], [8.0, 37.2], [7.6, 34.4], [3.4, 31.4], [-1.0, 30.0], [-6.4, 29.0], [-10.4, 31.0], [-11.0, 34.0]] },
    sahara:     { label: 'Sahara & the Sahel', ring: [[-12.0, 22.0], [-6.0, 20.0], [2.0, 19.4], [10.0, 19.0], [20.0, 19.4], [28.0, 18.0], [32.0, 16.4], [28.0, 14.4], [18.0, 14.4], [8.0, 14.4], [-2.0, 15.4], [-10.0, 17.4]] },
    iberia:     { label: 'Al-Andalus', ring: [[-9.4, 43.2], [-2.4, 43.6], [3.0, 42.4], [0.4, 39.0], [-0.6, 37.0], [-5.4, 36.0], [-9.4, 37.0]] },
    sicily:     { label: 'Sicily',    ring: [[12.4, 38.2], [15.4, 38.2], [18.4, 40.2], [16.4, 41.2], [13.4, 40.0]] },
    sindh:      { label: 'Sindh',     ring: [[66.4, 25.4], [70.4, 25.4], [72.4, 28.4], [70.0, 30.4], [67.0, 29.4], [66.2, 27.4]] },
    hind:       { label: 'Hindustan', ring: [[70.0, 32.4], [74.4, 32.0], [78.4, 31.0], [80.4, 28.4], [78.4, 25.4], [74.4, 24.4], [70.4, 25.4], [69.4, 29.0]] },
    deccan:     { label: 'The Deccan', ring: [[73.4, 20.4], [78.4, 20.4], [80.4, 17.4], [78.4, 14.4], [75.4, 13.4], [73.0, 16.4]] },
    bengal:     { label: 'Bengal',    ring: [[85.6, 26.4], [89.4, 26.4], [92.4, 23.4], [88.4, 21.4], [86.0, 23.0]] },
    nubia:      { label: 'Nubia',     ring: [[29.6, 22.4], [33.6, 22.4], [36.4, 19.4], [34.4, 15.9], [31.0, 16.4], [28.6, 19.4]] },
    // Two small shapes keep the early Ottoman frames honest: the beylik of the
    // 1300s held Bithynia, and Rumeli is the Balkan foothold before the
    // conquest of Constantinople.
    bithynia:   { label: 'Bithynia',  ring: [[26.4, 41.4], [29.4, 41.0], [32.4, 40.4], [31.4, 38.4], [28.4, 38.6], [26.4, 40.0]] },
    rumeli:     { label: 'Rumeli',    ring: [[21.4, 43.4], [26.4, 44.4], [28.4, 42.6], [26.4, 41.0], [22.4, 41.0]] },
  };

  // ---- Dated extents ------------------------------------------------------
  // One entry per dynasty, one period per reading of the sources. `from`/`to`
  // are the years that reading covers, so a map drawn for 1500 shows the
  // Ottoman state of 1500 and not the empire of 1683.
  const TERRITORIES = {
    rashidun: [
      { from: 632, to: 640, regions: ['hejaz', 'najd', 'yemen', 'levant', 'jazira'], note: 'The caliphate of Madinah and the first conquests in Syria and Iraq.' },
      { from: 640, to: 661, regions: ['hejaz', 'najd', 'yemen', 'levant', 'jazira', 'iraq', 'egypt', 'persia', 'khurasan'], note: 'After Egypt (641), Nihawand (642) and Khurasan (651).' },
    ],
    umayyad: [
      { from: 661, to: 692, regions: ['levant', 'jazira', 'iraq', 'hejaz', 'najd', 'yemen', 'egypt', 'persia', 'khurasan', 'ifriqiya'], note: 'Damascus and the provinces as they stood before the second fitna.' },
      { from: 692, to: 711, regions: ['levant', 'jazira', 'iraq', 'hejaz', 'najd', 'yemen', 'egypt', 'persia', 'khurasan', 'ifriqiya', 'transoxiana', 'maghreb'], note: 'Abd al-Malik reunites the caliphate and the Maghreb is taken to the Atlantic.' },
      { from: 711, to: 750, regions: ['levant', 'jazira', 'iraq', 'hejaz', 'najd', 'yemen', 'egypt', 'persia', 'khurasan', 'ifriqiya', 'transoxiana', 'maghreb', 'iberia', 'sindh'], note: 'Al-Andalus (711) and Sindh (711-712) are the widest reach of the dynasty.' },
    ],
    abbasid: [
      { from: 750, to: 800, regions: ['iraq', 'jazira', 'levant', 'hejaz', 'najd', 'yemen', 'persia', 'khurasan', 'transoxiana', 'sindh', 'egypt', 'ifriqiya'], note: 'The caliphate after the revolution, governed from Kufa and then from Baghdad.' },
      { from: 800, to: 861, regions: ['iraq', 'jazira', 'levant', 'hejaz', 'yemen', 'persia', 'khurasan', 'transoxiana', 'sindh', 'egypt'], note: 'The provinces begin to pass to local governors; the caliph keeps Iraq, the Jazira and the Hejaz.' },
      { from: 861, to: 1055, regions: ['iraq', 'jazira', 'hejaz'], note: 'After the anarchy at Samarra the caliph\u2019s writ is largely Iraq, with the Hejaz held nominally.' },
      { from: 1055, to: 1258, regions: ['iraq', 'jazira'], note: 'The caliph holds Baghdad and the Jazira under Seljuk, and later other, protection.' },
    ],
    fatimid: [
      { from: 909, to: 969, regions: ['ifriqiya', 'sicily', 'sahara'], note: 'The Ismaili caliphate in Ifriqiya, with Sicily and the Saharan trade routes.' },
      { from: 969, to: 1071, regions: ['ifriqiya', 'sicily', 'egypt', 'levant', 'hejaz', 'yemen'], note: 'After the conquest of Egypt (969) and the founding of Cairo.' },
      { from: 1071, to: 1171, regions: ['egypt', 'levant', 'hejaz', 'yemen'], note: 'Sicily passes to the Normans (1071) and the Levant is contested with the Seljuks.' },
    ],
    seljuk: [
      { from: 1037, to: 1092, regions: ['khurasan', 'persia', 'tabaristan', 'iraq', 'jazira', 'caucasus', 'anatolia', 'levant'], note: 'The sultanate at its height, from Khurasan to Anatolia and Jerusalem.' },
      { from: 1092, to: 1157, regions: ['khurasan', 'persia', 'tabaristan', 'iraq', 'caucasus'], note: 'After Malik Shah the sultanate divides among the Seljuk princes.' },
      { from: 1157, to: 1194, regions: ['persia', 'khurasan', 'iraq'], note: 'Sanjar holds Khurasan and Persia; the western lands pass to the atabegs.' },
    ],
    ayyubid: [
      { from: 1171, to: 1260, regions: ['egypt', 'levant', 'hejaz', 'yemen', 'jazira'], note: 'Egypt, the Levant and the Hejaz under the Ayyubid family, with rule shared among its branches.' },
    ],
    mamluk: [
      { from: 1250, to: 1517, regions: ['egypt', 'levant', 'hejaz'], note: 'The sultanate of Cairo, with the Levant recovered from the crusaders and the Hejaz in its keeping.' },
    ],
    ottoman: [
      { from: 1299, to: 1362, regions: ['bithynia'], note: 'The beylik of Sogut and Bursa in north-western Anatolia.' },
      { from: 1362, to: 1453, regions: ['bithynia', 'rumeli'], note: 'After the 1360s the state straddles the Dardanelles: Rumeli and Anatolia.' },
      { from: 1453, to: 1517, regions: ['anatolia', 'balkans', 'crimea'], note: 'Constantinople becomes the capital (1453) and the Black Sea coast follows.' },
      { from: 1517, to: 1683, regions: ['anatolia', 'balkans', 'crimea', 'levant', 'jazira', 'iraq', 'egypt', 'hejaz', 'ifriqiya', 'maghreb', 'sahara', 'nubia'], note: 'After Selim I: the Mamluk lands, the Hejaz, Iraq and the North African coast. The Sahara band stands for influence along the caravan routes.' },
      { from: 1683, to: 1830, regions: ['anatolia', 'balkans', 'levant', 'iraq', 'egypt', 'hejaz', 'ifriqiya', 'sahara', 'nubia'], note: 'The retreat from central Europe begins at Vienna (1683), confirmed at Karlowitz (1699).' },
      { from: 1830, to: 1922, regions: ['anatolia', 'levant', 'hejaz', 'iraq'], note: 'After Algeria (1830) and the Balkan wars (1912-13): Anatolia and the Arab provinces.' },
    ],
    safavid: [
      { from: 1501, to: 1534, regions: ['persia', 'tabaristan', 'caucasus', 'iraq', 'khurasan'], note: 'Isma\u2019il I takes Tabriz, Azerbaijan and Iraq (1508); Khurasan is contested with the Uzbeks.' },
      { from: 1534, to: 1736, regions: ['persia', 'tabaristan', 'caucasus', 'khurasan'], note: 'Iraq passes to Istanbul in the Ottoman wars; Isfahan becomes the capital in 1598.' },
    ],
    mughal: [
      { from: 1526, to: 1556, regions: ['hind', 'sindh'], note: 'Babur and Humayun hold the north Indian plain.' },
      { from: 1556, to: 1707, regions: ['hind', 'sindh', 'deccan', 'bengal'], note: 'Akbar, Jahangir, Shah Jahan and Aurangzeb extend the empire to Bengal and the Deccan.' },
      { from: 1707, to: 1857, regions: ['hind'], note: 'After Aurangzeb the provinces break away; the emperor keeps the Delhi region until 1857.' },
    ],
  };
  const periodsFor = (id, year) => (TERRITORIES[id] || []).filter((p) => year >= p.from && year < p.to);

  /* Which dynasties have a recorded extent in a given year — the map's own
     answer, used for the legend and for the period read-out. */
  function snapshot(year) {
    return ChronoData.allDynasties()
      .map((d) => ({ dynasty: d, period: periodsFor(d.id, year)[0] || null }))
      .filter((x) => x.period);
  }

  const yearBounds = () => {
    let lo = Infinity, hi = -Infinity;
    Object.values(TERRITORIES).forEach((periods) => periods.forEach((p) => {
      lo = Math.min(lo, p.from);
      hi = Math.max(hi, p.to);
    }));
    return { min: Math.floor(lo / 10) * 10, max: Math.ceil(hi / 10) * 10 };
  };

  // ---- Coastlines ---------------------------------------------------------
  // Modern land drawn for context only, read once from data/world-land.json.
  // `landRings()` hands back the raw coordinate rings, which the compact event
  // map needs; `land()` gives the same land as ready-made SVG paths.
  let coastRings = null;
  async function landRings() {
    if (coastRings) return coastRings;
    const res = await DataLoader.json('./data/world-land.json');
    coastRings = res?.rings || [];
    return coastRings;
  }
  async function land() {
    return (await landRings()).map(ringPath);
  }

  return {
    VIEW, PLANE_W, PLANE_H, ASPECT,
    project, ringPath, centroid,
    REGIONS, TERRITORIES,
    periodsFor, snapshot, yearBounds, land, landRings,
    regionLabel: (key) => REGIONS[key]?.label || key,
  };
})();
