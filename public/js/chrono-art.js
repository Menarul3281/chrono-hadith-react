/* Chrono art — the imagery the two dashboards show, drawn rather than fetched.

   The project ships no photograph assets, and a historical record must not be
   illustrated with a picture of somewhere else. Every frame here is therefore
   generated from the record itself: a stable seed (the record id) fixes the
   scene, and the event's own type or the dynasty's own colour fixes the palette
   and the motif. Drop a real image in later and the panels use it — the event
   card tests for an `image` field on the record before falling back here. */

const ChronoArt = (() => {
  // Deterministic pseudo-random from a string: the same record must always draw
  // the same picture, in every session and on every render.
  function seedOf(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let s = seed || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  // One palette per event type, so a reader learns the language of the cards.
  const PALETTES = {
    birth:      { sky: '#0a2333', horizon: '#1d5f6b', glow: '#5a8dff', land: '#071722' },
    revelation: { sky: '#140f2a', horizon: '#3d2a63', glow: '#ad68ff', land: '#0a0718' },
    migration:  { sky: '#0a2430', horizon: '#1f5a6e', glow: '#34c9ff', land: '#06141d' },
    battle:     { sky: '#251012', horizon: '#6e2a2a', glow: '#ff5f70', land: '#120608' },
    treaty:     { sky: '#0a2620', horizon: '#1f6353', glow: '#62f59a', land: '#061712' },
    political:  { sky: '#241705', horizon: '#71461b', glow: '#ff9648', land: '#130b02' },
    social:     { sky: '#241e05', horizon: '#6b5a1c', glow: '#ffd45e', land: '#141003' },
    death:      { sky: '#151b1f', horizon: '#3e4f58', glow: '#8fa3ad', land: '#0a0f12' },
    other:      { sky: '#0a1c26', horizon: '#255467', glow: '#34f6c1', land: '#061219' },
  };

  // Foreground silhouettes, drawn on a stage of `w` × 180 with the horizon at
  // `y`. The motif states the kind of record; it is never a photograph.
  const MOTIFS = {
    revelation: (r, y, c) => `
      <path d="M0 ${y + 40} L86 ${y - 46} L150 ${y + 12} L206 ${y - 30} L320 ${y + 44} V180 H0 Z" fill="${c.land}"/>
      <path d="M86 ${y - 46} L104 ${y - 12} L92 ${y - 6} L74 ${y - 16} Z" fill="#000" opacity="0.55"/>
      <circle cx="96" cy="${y - 6}" r="5" fill="${c.glow}" opacity="0.9"/>
      <g opacity="0.5" fill="${c.glow}">
        <path d="M118 ${y - 40} h3 l14 60 h-3 Z"/><path d="M136 ${y - 38} h3 l16 58 h-3 Z"/>
      </g>`,
    battle: (r, y, c) => `
      <path d="M0 ${y + 26} L64 ${y + 4} L128 ${y + 30} L198 ${y + 2} L320 ${y + 28} V180 H0 Z" fill="${c.land}"/>
      <g stroke="#000" stroke-opacity="0.6" stroke-width="2">
        ${[18, 44, 70, 108, 134, 168, 206, 240, 274, 300].map((x, i) =>
          `<path d="M${x} ${y + 44} L${x + (i % 2 ? 12 : -12)} ${y + 6}"/>`).join('')}
      </g>
      <g fill="${c.glow}" opacity="0.75">
        ${[18, 44, 70, 108, 134, 168, 206, 240, 274, 300].map((x, i) =>
          `<path d="M${x + (i % 2 ? 12 : -12)} ${y + 6} l8 0 l-4 12 Z"/>`).join('')}
      </g>`,
    migration: (r, y, c) => `
      <path d="M0 ${y + 30} Q80 ${y + 8} 160 ${y + 30} T320 ${y + 22} V180 H0 Z" fill="${c.land}"/>
      <g fill="#000" opacity="0.75">
        ${[0, 1, 2].map((i) => {
          const x = 60 + i * 74, yy = y + 30 - i * 3;
          return `<path d="M${x} ${yy} q6 -12 12 -14 l10 0 q6 4 8 14 l-8 0 -2 12 -3 0 -1 -12 -8 0 -1 12 -3 0 0 -12 Z"/>`;
        }).join('')}
      </g>`,
    treaty: (r, y, c) => `
      <path d="M0 ${y + 22} H320 V180 H0 Z" fill="${c.land}"/>
      <g fill="#000" opacity="0.7">
        ${[36, 118, 200, 268].map((x, i) => `<path d="M${x} ${y + 24} l40 0 l-6 -18 q-14 -${i % 2 ? 12 : 16} -28 0 Z"/>`).join('')}
      </g>
      <g stroke="${c.glow}" stroke-width="1.4" opacity="0.8" fill="none">
        ${[36, 118, 200, 268].map((x) => `<path d="M${x + 20} ${y + 6} v-12"/>`).join('')}
      </g>`,
    political: (r, y, c) => `
      <path d="M0 ${y + 30} H320 V180 H0 Z" fill="${c.land}"/>
      <g fill="#000" opacity="0.72">
        <rect x="24" y="${y - 22}" width="12" height="52"/><rect x="52" y="${y - 6}" width="150" height="36"/>
        <rect x="216" y="${y - 40}" width="12" height="70"/><rect x="244" y="${y - 10}" width="60" height="40"/>
      </g>
      <g fill="${c.glow}" opacity="0.8">
        <path d="M30 ${y - 30} q0 -10 8 -10 q8 0 8 10 Z"/><path d="M222 ${y - 48} q0 -10 8 -10 q8 0 8 10 Z"/>
      </g>`,
    social: (r, y, c) => `
      <path d="M0 ${y + 26} H320 V180 H0 Z" fill="${c.land}"/>
      <g fill="#000" opacity="0.7">
        <path d="M96 ${y + 26} v-26 q0 -26 34 -26 q34 0 34 26 v26 Z"/>
        <path d="M170 ${y + 26} q-16 0 -16 -22 q0 -34 32 -34 q32 0 32 34 q0 22 -16 22 Z"/>
        <rect x="64" y="${y - 4}" width="8" height="30"/><rect x="256" y="${y - 4}" width="8" height="30"/>
      </g>
      <g fill="${c.glow}" opacity="0.75">
        <path d="M168 ${y - 34} q14 -16 28 0 Z"/><path d="M66 ${y - 12} q4 -12 8 0 Z"/>
      </g>`,
    death: (r, y, c) => `
      <path d="M0 ${y + 34} Q70 ${y + 20} 150 ${y + 34} T320 ${y + 30} V180 H0 Z" fill="${c.land}"/>
      <path d="M158 ${y + 32} v-26" stroke="#000" stroke-opacity="0.8" stroke-width="4"/>
      <path d="M158 ${y + 6} q-16 -4 -22 -14 q14 2 22 10 q8 -12 24 -14 q-4 12 -24 18 Z" fill="#000" opacity="0.8"/>`,
    birth: (r, y, c) => `
      <path d="M0 ${y + 30} H320 V180 H0 Z" fill="${c.land}"/>
      <g fill="#000" opacity="0.72">
        <path d="M64 ${y + 32} q-4 -40 8 -52" stroke="#000" stroke-width="3"/>
        <path d="M72 ${y - 20} q-26 -6 -34 -18 q4 16 -34 22 Z" transform="translate(68 0)"/>
        <path d="M72 ${y - 20} q26 -6 34 -18 q-4 16 -34 22 Z" transform="translate(-68 0)"/>
        <path d="M240 ${y + 32} q-4 -36 6 -46" stroke="#000" stroke-width="3"/>
        <path d="M246 ${y - 14} q-22 -6 -30 -16 q4 14 -30 20 Z" transform="translate(52 0)"/>
        <path d="M246 ${y - 14} q22 -6 30 -16 q-4 14 30 20 Z" transform="translate(-52 0)"/>
      </g>`,
    other: (r, y, c) => `
      <path d="M0 ${y + 30} Q90 ${y + 6} 180 ${y + 30} T320 ${y + 24} V180 H0 Z" fill="${c.land}"/>`,
  };

  let uid = 0;

  /* A landscape frame: sky, light source, two ridges, the record's motif and a
     vignette. `opts` carries the event type (palette and motif), an accent for
     the light, and the stage size. */
  function scene(key, opts = {}) {
    const palette = PALETTES[opts.kind] || PALETTES.other;
    const accent = opts.accent || palette.glow;
    const w = opts.w || 320;
    const h = opts.h || 180;
    const r = rng(seedOf(key));
    const id = `cha${++uid}`;

    const horizon = h * (0.58 + r() * 0.08);
    const sunX = w * (0.2 + r() * 0.6);
    const sunY = horizon - h * (0.12 + r() * 0.16);
    const sunR = h * (0.06 + r() * 0.03);

    // Ridges are sampled from a sine with a per-scene phase, so two records of
    // the same type still open on different horizons.
    const ridge = (base, amp, step, phase) => {
      const pts = [];
      for (let x = 0; x <= w; x += step) {
        pts.push(`${x} ${(base + Math.sin((x / w) * Math.PI * 2 + phase) * amp).toFixed(1)}`);
      }
      return `M0 ${h} L${pts.join(' L')} L${w} ${h} Z`;
    };

    const motif = (MOTIFS[opts.kind] || MOTIFS.other)(r, horizon, palette);
    const label = ChronoData.esc(opts.label || 'Generated illustration of the record');

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}" focusable="false">
  <defs>
    <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.sky}"/>
      <stop offset="0.62" stop-color="${palette.horizon}"/>
      <stop offset="1" stop-color="${palette.land}"/>
    </linearGradient>
    <radialGradient id="${id}glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.8"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id}sky)"/>
  <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${(sunR * 4.4).toFixed(1)}" fill="url(#${id}glow)"/>
  <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="${accent}" opacity="0.92"/>
  <path d="${ridge(horizon - h * 0.15, h * 0.05, 40, r() * 6)}" fill="${palette.horizon}" opacity="0.55"/>
  <path d="${ridge(horizon - h * 0.05, h * 0.04, 30, r() * 6)}" fill="${palette.land}" opacity="0.85"/>
  ${motif}
</svg>`;
  }

  /* A dynasty's frame: the same idea in the dynasty's own colour, with a city
     skyline in place of the event motifs, so the carousel, the map legend and
     the panel read as one family of images. */
  function emblem(dynasty, opts = {}) {
    const w = opts.w || 320, h = opts.h || 180;
    const r = rng(seedOf('dyn-' + dynasty.id));
    const id = `chd${++uid}`;
    const horizon = h * 0.68;
    const skyline = [24, 74, 116, 166, 212, 262, 300].map((x, i) => {
      const hh = h * (0.12 + r() * 0.3);
      return i % 3 === 0
        ? `<path d="M${x} ${horizon} v-${(hh * 0.55).toFixed(0)} q0 -${(hh * 0.45).toFixed(0)} ${(hh * 0.45).toFixed(0)} -${(hh * 0.45).toFixed(0)} q${(hh * 0.45).toFixed(0)} 0 ${(hh * 0.45).toFixed(0)} ${(hh * 0.45).toFixed(0)} v${(hh * 0.55).toFixed(0)} Z"/>`
        : `<rect x="${x}" y="${(horizon - hh).toFixed(0)}" width="${(h * 0.05).toFixed(0)}" height="${hh.toFixed(0)}"/>`;
    }).join('');
    const label = ChronoData.esc(dynasty.full || dynasty.name);

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Generated emblem for ${label}" focusable="false">
  <defs>
    <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1c26"/>
      <stop offset="0.7" stop-color="${dynasty.colour}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#061219"/>
    </linearGradient>
    <radialGradient id="${id}glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${dynasty.colour}" stop-opacity="0.8"/>
      <stop offset="1" stop-color="${dynasty.colour}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id}sky)"/>
  <circle cx="${(w * 0.72).toFixed(0)}" cy="${(horizon - h * 0.24).toFixed(0)}" r="${(h * 0.34).toFixed(0)}" fill="url(#${id}glow)"/>
  <g fill="#000" opacity="0.55">${skyline}</g>
  <rect y="${horizon}" width="${w}" height="${(h - horizon).toFixed(0)}" fill="#061219" opacity="0.94"/>
  <line x1="0" y1="${horizon}" x2="${w}" y2="${horizon}" stroke="${dynasty.colour}" stroke-width="1.5" opacity="0.9"/>
</svg>`;
  }

  /* A square monogram for list rows and map labels, in the idiom the narrator
     view uses for its avatars: the dynasty's Arabic initial over its colour. */
  const monogram = (dynasty) => {
    const letter = (dynasty.arabic || dynasty.name || '·').trim().charAt(0) || '·';
    return `<span class="dsh-monogram" style="--mono:${dynasty.colour}">${ChronoData.esc(letter)}</span>`;
  };

  /* A book cover, drawn rather than taken: the project holds no licensed cover
     imagery, and a real cover must not be borrowed or imitated. The frame is the
     same for every work; the palette follows the category and the Arabic title
     sits in a cartouche, so a shelf still reads at a glance. */
  function cover(b, opts = {}) {
    const w = opts.w || 150, h = opts.h || 200;
    const palette = CATEGORY_PALETTE[b.category] || CATEGORY_PALETTE.default;
    const r = rng(seedOf('cover-' + b.id));
    const id = `chc${++uid}`;
    const title = b.arabic || b.name;
    const words = String(title).split(/\s+/).slice(0, 3);
    const lines = words.map((word, i) => `
      <text x="${(w / 2).toFixed(0)}" y="${(h * 0.3 + i * h * 0.105).toFixed(0)}" class="cha-cover-ar" text-anchor="middle">${ChronoData.esc(word)}</text>`).join('');
    const rules = [0.24, 0.62].map((p) => `
      <line x1="${(w * 0.16).toFixed(0)}" y1="${(h * p).toFixed(0)}" x2="${(w * 0.84).toFixed(0)}" y2="${(h * p).toFixed(0)}"/>`).join('');

    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Styled placeholder cover for ${ChronoData.esc(b.name)}" focusable="false">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.a}"/>
      <stop offset="1" stop-color="${palette.b}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="4" fill="url(#${id}bg)"/>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="3" fill="none" stroke="${palette.line}" stroke-width="1.4"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="2" fill="none" stroke="${palette.line}" stroke-width="0.6" opacity="0.7"/>
  <g stroke="${palette.line}" stroke-width="0.8" opacity="0.65">${rules}</g>
  <g fill="${palette.ink}" font-family="Amiri, serif">${lines}</g>
  <text x="${(w / 2).toFixed(0)}" y="${(h * 0.84).toFixed(0)}" class="cha-cover-en" text-anchor="middle">${ChronoData.esc(b.name.slice(0, 26))}</text>
  <g fill="${palette.line}" opacity="0.9">
    <path d="M${(w * 0.17).toFixed(0)} ${(h * 0.68).toFixed(0)} q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0 q${(w * 0.05).toFixed(0)} -6 ${(w * 0.1).toFixed(0)} 0"/>
  </g>
  <rect width="${w}" height="${h}" rx="4" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
</svg>`;
  }

  const CATEGORY_PALETTE = {
    'Primary Source': { a: '#0b2f2a', b: '#061a18', line: '#3ecf9a', ink: '#eafff6' },
    'Hadith Collections': { a: '#123322', b: '#07170f', line: '#c9a227', ink: '#f6ffe9' },
    'Seerah & History': { a: '#2a1220', b: '#150812', line: '#e08c8c', ink: '#fff0f0' },
    'Biographical Works': { a: '#1b1330', b: '#0b0818', line: '#9b8cf6', ink: '#f2efff' },
    Tafsir: { a: '#0f2733', b: '#061319', line: '#34c9ff', ink: '#eaf8ff' },
    Fiqh: { a: '#241a08', b: '#120d03', line: '#e0b64f', ink: '#fff6e0' },
    Aqidah: { a: '#101e33', b: '#070d17', line: '#7fa9f6', ink: '#eef4ff' },
    Sufism: { a: '#1d1233', b: '#0d0819', line: '#b096f6', ink: '#f4f0ff' },
    'Language & Linguistics': { a: '#0b2b2f', b: '#05161a', line: '#4fd8d8', ink: '#e9ffff' },
    'Adab & Ethics': { a: '#2a2110', b: '#150f05', line: '#ffd45e', ink: '#fff8e2' },
    'Sciences & Miscellaneous': { a: '#1c1c24', b: '#0c0c12', line: '#aab4c0', ink: '#f4f6f8' },
    default: { a: '#122530', b: '#07141b', line: '#34f6c1', ink: '#eafdf7' },
  };

  /* A frame for a record: a real image when the record carries one, otherwise the
     generated scene. Drop `"image": "./assets/events/<id>.jpg"` on a record and
     the card, the hero and the carousel pick it up with no code change. */
  const frame = (record, opts = {}) => (record.image
    ? `<img class="cha-img" src="${ChronoData.esc(record.image)}" alt="${ChronoData.esc(opts.label || record.name || '')}" loading="lazy" />`
    : scene(record.id, opts));

  const emblemFrame = (dynasty, opts = {}) => (dynasty.image
    ? `<img class="cha-img" src="${ChronoData.esc(dynasty.image)}" alt="${ChronoData.esc(dynasty.full || dynasty.name)}" loading="lazy" />`
    : emblem(dynasty, opts));

  return { scene, emblem, cover, frame, emblemFrame, monogram, PALETTES, CATEGORY_PALETTE };
})();
