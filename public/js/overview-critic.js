(() => {
  const REPORT_ID = 'overviewCritiqueReport';
  const ROOT = '[data-ovx-root]';
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function hasRuleText(fragment) {
    const walk = (rules) => {
      for (const rule of rules || []) {
        if (String(rule.cssText || '').includes(fragment)) return true;
        if (rule.cssRules && walk(rule.cssRules)) return true;
      }
      return false;
    };
    for (const sheet of [...document.styleSheets]) {
      try { if (walk(sheet.cssRules)) return true; } catch {}
    }
    return false;
  }

  function maxMotionMs() {
    let max = 0;
    const parseTime = (value) => {
      const raw = String(value || '').trim();
      if (raw.endsWith('ms')) return Number.parseFloat(raw) || 0;
      if (raw.endsWith('s')) return (Number.parseFloat(raw) || 0) * 1000;
      return 0;
    };
    for (const element of qsa('.ovx *')) {
      const style = getComputedStyle(element);
      for (const part of style.transitionDuration.split(',')) max = Math.max(max, parseTime(part));
      for (const part of style.animationDuration.split(',')) max = Math.max(max, parseTime(part));
    }
    return max;
  }

  function fidelity(root, issues) {
    let score = 0;
    const sections = qsa('.ovx-lens-card', root);
    const records = qsa('.ovx-record-card', root);
    const chain = qsa('.ovx-chain-step', root);
    if (sections.length === 7) score += .28; else issues.push(`Expected 7 app entry points; found ${sections.length}.`);
    if (records.length === 7) score += .24; else issues.push(`Expected 7 record families; found ${records.length}.`);
    if (chain.length >= 2) score += .2; else issues.push('The real report-chain preview did not resolve.');
    const routeHrefs = sections.map((link) => link.getAttribute('href') || '');
    const required = ['#overview', '#isnad', '#graph', '#history?view=timeline', '#figures', '#library?tab=hadiths', '#dynasties'];
    if (required.every((href) => routeHrefs.includes(href))) score += .16; else issues.push('One or more canonical section routes are missing.');
    if (qsa('.ovx-integrity-grid article', root).length === 4) score += .12; else issues.push('Integrity rules are incomplete.');
    return clamp(score, 0, 1);
  }

  function layout(root, issues) {
    let score = 0;
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (overflow <= 3) score += .32; else issues.push(`Page has ${Math.round(overflow)}px horizontal overflow.`);
    const text = qsa('h1,h2,h3,p,strong,.ovx-lens-body>span,.ovx-context-card strong', root);
    const clipped = text.filter((element) =>
      element.scrollWidth > element.clientWidth + 3 || element.scrollHeight > element.clientHeight + 4);
    if (!clipped.length) score += .25; else issues.push(`${clipped.length} key text blocks appear clipped.`);
    const cards = qsa('.ovx-lens-card,.ovx-record-card,.ovx-feature,.ovx-chain-panel', root);
    if (cards.every((card) => card.getBoundingClientRect().width > 0)) score += .18; else issues.push('A primary Overview surface collapsed to zero width.');
    const hero = root.querySelector('.ovx-hero');
    if (hero && hero.getBoundingClientRect().right <= innerWidth + 2) score += .15; else issues.push('Hero exceeds the viewport.');
    if (hasRuleText('max-width: 680px') && hasRuleText('max-width: 440px')) score += .1; else issues.push('Compact responsive breakpoints were not detected.');
    return clamp(score, 0, 1);
  }

  function motion(root, issues) {
    let score = 0;
    const max = maxMotionMs();
    if (max <= 400) score += .38; else issues.push(`A rendered Overview animation/transition exceeds 400ms (${Math.round(max)}ms).`);
    if (hasRuleText('prefers-reduced-motion')) score += .24; else issues.push('Reduced-motion fallback was not detected.');
    if (document.documentElement.dataset.motion === 'off' || hasRuleText('data-motion="off"')) score += .18; else issues.push('Independent motion preference handling was not detected.');
    const animated = qsa('.ovx *', root).filter((element) => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });
    if (!animated.length) score += .2; else issues.push(`${animated.length} autonomous animated elements remain active.`);
    return clamp(score, 0, 1);
  }

  function accessibility(root, issues) {
    let score = 0;
    const controls = qsa('a,button,[tabindex]', root).filter((element) =>
      element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    const tooSmall = controls.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 34 || rect.height < 34;
    });
    if (controls.length && tooSmall.length / controls.length <= .1) score += .24; else issues.push(`${tooSmall.length} visible controls are below the interaction floor.`);
    if (root.querySelector('h1') && qsa('h2', root).length >= 4) score += .2; else issues.push('Heading hierarchy is incomplete.');
    if (hasRuleText(':focus-visible')) score += .2; else issues.push('Visible keyboard focus treatment was not detected.');
    if (hasRuleText('forced-colors') && hasRuleText('prefers-reduced-transparency')) score += .18; else issues.push('High-contrast/reduced-transparency responses are incomplete.');
    if (qsa('[lang="ar"][dir="rtl"]', root).length) score += .18; else issues.push('Arabic content lost explicit language/direction markup.');
    return clamp(score, 0, 1);
  }

  function coherence(root, issues) {
    let score = 0;
    if (document.querySelector('.sidebar.rail') && document.querySelector('.overview-ribbon')) score += .24; else issues.push('Overview no longer sits inside the shared app shell.');
    if (getComputedStyle(document.body).getPropertyValue('--ovx-page').trim()) score += .2; else issues.push('Overview route-scoped design tokens are missing.');
    if (hasRuleText('body.no-fx') && document.documentElement.dataset.atmosphere) score += .18; else issues.push('Independent atmosphere/FX behavior is not wired.');
    const sectionCopy = qsa('.ovx-lens-body>span', root).map((element) => element.textContent.trim());
    if (sectionCopy.every(Boolean)) score += .18; else issues.push('One or more app-entry cards lost its repo-grounded purpose copy.');
    if (root.querySelector('.ovx-chain-section') && root.querySelector('.ovx-integrity')) score += .2; else issues.push('The Overview is missing either its real relationship example or integrity explanation.');
    return clamp(score, 0, 1);
  }

  function publish(report) {
    window.__chronoOverviewCritique = report;
    let node = document.getElementById(REPORT_ID);
    if (!node) {
      node = document.createElement('script');
      node.id = REPORT_ID;
      node.type = 'application/json';
      node.hidden = true;
      document.body.appendChild(node);
    }
    node.textContent = JSON.stringify(report);
    document.documentElement.dataset.overviewScore = report.score.toFixed(2);
    console.info('[Overview Critic]', report);
  }

  function run() {
    const root = document.querySelector(ROOT);
    if (!root) return null;
    const issues = [];
    const categories = {
      fidelity: fidelity(root, issues),
      layout: layout(root, issues),
      motion: motion(root, issues),
      accessibility: accessibility(root, issues),
      coherence: coherence(root, issues),
    };
    const score = Object.values(categories).reduce((sum, value) => sum + value, 0);
    const report = {
      score: Number(score.toFixed(2)),
      max: 5,
      passed: Object.values(categories).every((value) => value >= .8),
      categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Number((value * 5).toFixed(2))])),
      issues,
      viewport: { width: innerWidth, height: innerHeight },
      theme: document.documentElement.dataset.theme || 'unknown',
      atmosphere: document.documentElement.dataset.atmosphere || 'unknown',
      timestamp: new Date().toISOString(),
    };
    publish(report);
    return report;
  }

  window.ChronoOverviewCritic = { run };
  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(run));
  window.addEventListener('chrono:overview-rendered', schedule);
  window.addEventListener('resize', () => {
    clearTimeout(window.__ovxCriticResizeTimer);
    window.__ovxCriticResizeTimer = setTimeout(run, 180);
  });
  if (document.querySelector(ROOT)) schedule();
})();