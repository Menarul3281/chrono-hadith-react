/* Citation formatting + copy-to-clipboard helpers. */

const Clipboard = (() => {
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { return Boolean(document.execCommand('copy')); }
      catch { return false; }
      finally { document.body.removeChild(ta); }
    }
  }

  function hadithPlainText(h) {
    const lines = [];
    if (h.arabic) lines.push(h.arabic);
    lines.push('');
    lines.push(`"${h.translation}"`);
    lines.push('');
    lines.push(`— ${h.reference}${h.grade ? ` (${h.grade})` : ''}`);
    return lines.join('\n');
  }

  function hadithBibtex(h) {
    const key = h.id.replace(/-/g, '_');
    return `@misc{${key},
  title  = {${h.reference}},
  author = {${h.collection}},
  year   = {${new Date().getFullYear()}},
  note   = {${h.translation}},
  url    = {${h.sourceUrl || ''}}
}`;
  }

  function hadithRIS(h) {
    return [
      'TY  - BOOK',
      `TI  - ${h.reference}`,
      `T2  - ${h.collection}`,
      `AB  - ${h.translation}`,
      `UR  - ${h.sourceUrl || ''}`,
      'ER  - ',
    ].join('\n');
  }

  return { copy, hadithPlainText, hadithBibtex, hadithRIS };
})();
