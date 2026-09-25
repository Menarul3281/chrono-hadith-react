/* Hadith of the Day — deterministic rotation based on day-of-year.
   The chosen hadith deep-links into the Isnad Explorer. */

const HadithOfDay = (() => {
  function dayOfYear(d = new Date()) {
    // Compare calendar dates in UTC so daylight-saving changes cannot repeat a day.
    const start = Date.UTC(d.getFullYear(), 0, 0);
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000);
  }

  function pick(hadiths) {
    if (!hadiths.length) return null;
    const idx = dayOfYear() % hadiths.length;
    return hadiths[idx];
  }

  function render(hadith) {
    const el = document.getElementById('hadithOfDay');
    if (!el || !hadith) return;

    el.classList.add('swapping');

    setTimeout(() => {
      document.getElementById('hodArabic').textContent = hadith.arabic || '—';
      document.getElementById('hodTranslation').textContent =
        hadith.translation ? `"${hadith.translation}"` : '—';
      document.getElementById('hodGrade').textContent = hadith.grade || '';
      document.getElementById('hodRef').textContent = hadith.reference || '';
      document.getElementById('hodLink').href = `#isnad?hadith=${hadith.id}`;
      el.classList.remove('swapping');
    }, 180);
  }

  function init(hadiths) {
    const h = pick(hadiths);
    if (h) render(h);
  }

  return { init };
})();
