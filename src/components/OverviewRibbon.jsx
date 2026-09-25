import React, { useEffect, useRef, useState } from 'react';

const VERSE_KEY = 'ribbon-verse-last';
const VERSES = [
  {
    ar: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ',
    en: 'Read in the name of your Lord who created',
    ref: '— Surah Al-\'Alaq (96:1) ↗',
    url: 'https://quran.com/96/1',
  },
  {
    ar: 'هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ',
    en: 'Are those who know equal to those who do not know?',
    ref: '— Surah Az-Zumar (39:9) · excerpt ↗',
    url: 'https://quran.com/39/9',
  },
  {
    ar: 'وَقُلْ رَبِّ زِدْنِي عِلْمًا',
    en: 'My Lord, increase me in knowledge.',
    ref: '— Surah Ta-Ha (20:114) · excerpt ↗',
    url: 'https://quran.com/20/114',
  },
];

export function chooseNextVerseIndex(previous, random = Math.random) {
  if (!Array.isArray(VERSES) || VERSES.length === 0) return 0;
  const choices = VERSES.map((_, index) => index).filter((index) => index !== previous);
  const pool = choices.length ? choices : VERSES.map((_, index) => index);
  return pool[Math.floor(random() * pool.length)];
}

export default function OverviewRibbon() {
  const [verseIndex, setVerseIndex] = useState(0);
  const arabicRef = useRef(null);
  const initialVerse = useRef(true);
  const verse = VERSES[verseIndex] ?? VERSES[0];

  useEffect(() => {
    let previous = null;
    try {
      const stored = Number.parseInt(sessionStorage.getItem(VERSE_KEY) ?? '', 10);
      if (Number.isInteger(stored) && stored >= 0 && stored < VERSES.length) previous = stored;
    } catch { /* Session-only choice; storage may be unavailable. */ }

    const next = chooseNextVerseIndex(previous);
    setVerseIndex(next);
    try { sessionStorage.setItem(VERSE_KEY, String(next)); } catch { /* Session-only choice. */ }
  }, []);

  useEffect(() => {
    if (initialVerse.current) {
      initialVerse.current = false;
      return;
    }
    const el = arabicRef.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }, [verseIndex]);

  return (
    <header className="topbar overview-ribbon" aria-label="Overview">
      <span aria-hidden="true" className="overview-ribbon-route-title" id="topbarTitle" />

      <button aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation" className="top-action nav-toggle" data-nav-toggle type="button">
        <span className="nav-icon" data-icon="menu" />
      </button>
      <button aria-controls="topSearch" aria-expanded="false" aria-label="Search this page" className="top-action search-toggle" data-search-toggle hidden type="button">
        <span className="nav-icon" data-icon="search" />
      </button>

      <div className="overview-ribbon-meta">
        <span aria-hidden="true" className="overview-ribbon-dot" />
        <span className="overview-ribbon-label">OVERVIEW</span>
        <span aria-hidden="true" className="overview-ribbon-divider" />
        <span className="overview-ribbon-subcopy">Explore connected Islamic knowledge.</span>
      </div>

      <div className="overview-ribbon-verse">
        <span className="overview-ribbon-arabic" dir="rtl" lang="ar" ref={arabicRef}>{verse.ar}</span>
        <span className="overview-ribbon-english">{verse.en}</span>
        <a className="overview-ribbon-source" href={verse.url} rel="noopener noreferrer" target="_blank">{verse.ref}</a>
      </div>

      <div className="overview-ribbon-search-zone">
        <div className="topsearch overview-ribbon-search" id="topSearch">
          <label className="overview-ribbon-sr-only" htmlFor="topSearchInput">Search this page</label>
          <div className="topbar-search overview-ribbon-field">
            <span aria-hidden="true" className="search-icon" data-icon="search" />
            <input
              aria-autocomplete="list"
              aria-controls="topSearchPanel"
              aria-expanded="false"
              autoComplete="off"
              id="topSearchInput"
              placeholder="Search…"
              role="combobox"
              type="text"
            />
            <kbd aria-hidden="true" className="search-kbd">CTRL K</kbd>
          </div>
          <div aria-label="Records on this page" className="tps-panel" hidden id="topSearchPanel" role="listbox">
            <div className="tps-head"><div className="tps-chips" id="tpsChips" /></div>
            <div className="tps-body" id="tpsBody" />
            <div className="tps-foot" id="tpsFoot" />
          </div>
        </div>
      </div>
    </header>
  );
}
