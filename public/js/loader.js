/* Data loader — fetches and validates narrators + hadiths. */

const DataLoader = (() => {
  let narrators = {};
  let hadiths = [];
  let loaded = false;
  let pending = null;
  let hadithById = new Map();

  // Share in-flight requests; a rejected request is evicted so Retry can recover.
  const requests = new Map();
  function json(path) {
    if (!requests.has(path)) {
      const request = fetch(path).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
        return response.json();
      }).catch((error) => { requests.delete(path); throw error; });
      requests.set(path, request);
    }
    return requests.get(path);
  }

  function load() {
    if (loaded) return Promise.resolve();
    if (!pending) pending = (async () => {
      const [nextNarrators, nextReports] = await Promise.all([
        json('./data/narrators.json'), json('./data/hadiths.json'),
      ]);
      validate(nextNarrators, nextReports.hadiths);
      narrators = nextNarrators;
      hadiths = nextReports.hadiths;
      hadithById = new Map(hadiths.map((h) => [h.id, h]));
      loaded = true;
    })().catch((error) => {
      requests.delete('./data/narrators.json');
      requests.delete('./data/hadiths.json');
      throw error;
    }).finally(() => { pending = null; });
    return pending;
  }

  function validate(narrators, hadiths) {
    if (!narrators || typeof narrators !== 'object' || Array.isArray(narrators) || !Array.isArray(hadiths)) {
      throw new Error('Invalid narrator or hadith data format.');
    }
    const errors = [];
    const ids = new Set();
    for (const h of hadiths) {
      if (!h || typeof h.id !== 'string' || ids.has(h.id)) {
        errors.push('Hadith records need unique string IDs');
        continue;
      }
      ids.add(h.id);
      if (!Array.isArray(h.chain) || h.chain.length < 2) {
        errors.push(`Hadith ${h.id}: chain must have at least 2 links`);
        continue;
      }
      if (h.chain[0]?.narratorId !== 'prophet') {
        errors.push(`Hadith ${h.id}: first chain link must be prophet`);
      }
      for (const link of h.chain) {
        if (!link || !Object.hasOwn(narrators, link.narratorId)) {
          errors.push(`Hadith ${h.id}: unknown narrator "${link?.narratorId}"`);
        }
      }
      if (!Object.hasOwn(narrators, h.narratorId)) {
        errors.push(`Hadith ${h.id}: narratorId "${h.narratorId}" not found`);
      }
    }
    if (errors.length) {
      console.error('Data validation failed:', errors);
      throw new Error(`Data validation failed with ${errors.length} error(s).`);
    }
  }

  const getNarrator = (id) => Object.hasOwn(narrators, id) ? narrators[id] : null;
  const listNarrators = () => narrators;
  const getHadith = (id) => hadithById.get(id) || null;
  const listHadiths = () => hadiths.slice();

  function chainWithNarrators(id) {
    const h = getHadith(id);
    if (!h) return null;
    return h.chain.map((link, i) => ({
      step: i + 1,
      role: link.role,
      generation: link.generation,
      narrator: getNarrator(link.narratorId),
    }));
  }

  const invalidate = (path) => requests.delete(path);
  return { load, json, invalidate, getNarrator, listNarrators, getHadith, listHadiths, chainWithNarrators };
})();
