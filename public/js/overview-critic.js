(() => {
  const REPORT_ID = 'overviewCritiqueReport';
  const MAX_WAIT_MS = 4500;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const px = (value) => Number.parseFloat(value || '0') || 0;
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function ruleTextContains(fragment) {
    const visit = (rules) => {
      for (const rule of rules || []) {
        if (String(rule.cssText || '').includes(fragment)) return true;
        if (rule.cssRules && visit(rule.cssRules)) return true;
      }
      return false;
    };

    for (const sheet of [...document.styleSheets]) {
      try {
        if (visit(sheet.cssRules)) return true;
      } catch {
        // Cross-origin font stylesheets are intentionally unreadable.
      }
    }
    return false;
  }

  function overflowed(elements) {
    return elements.filter((el) =>
      el.scrollWidth > el.clientWidth + 3 ||
      el.scrollHeight > el.clientHeight + 6
    );
  }

  function scoreHierarchy(root, details) {
    let score = 0;
    const title = qs('.ov8-title', root);
    const lead = qs('.ov8-lead', root);
    const hero = qs('.ov8-hero', root);
    const cards = qsa('.ov8-explore-card', root);

    if (title && px(getComputedStyle(title).fontSize) >= (innerWidth < 700 ? 40 : 52)) score += .28;
    else details.push('Hero title needs stronger display scale.');

    if (lead && px(getComputedStyle(lead).fontSize) >= 16 && px(getComputedStyle(lead).lineHeight) >= 24) score += .22;
    else details.push('Lead copy is too small or tightly set.');

    if (hero && px(getComputedStyle(hero).borderRadius) >= 22) score += .2;
    else details.push('Hero surface lacks the intended premium radius.');

    if (cards.length >= 2 && cards.every((card) => px(getComputedStyle(card).paddingLeft) >= 22)) score += .15;
    else details.push('Explore cards need more breathing room.');

    const visibleSections = qsa('.ov8-hero,.ov8-explore,.ov8-scholar,.ov8-footer', root)
      .filter((el) => getComputedStyle(el).display !== 'none');
    if (visibleSections.length >= 4) score += .15;
    else details.push('Overview hierarchy is missing a major section.');

    return clamp(score, 0, 1);
  }

  function scoreUsability(root, details) {
    let score = 0;
    const controls = qsa('a,button,input,[role="button"]', root)
      .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');

    const tooSmall = controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 34 || r.height < 34;
    });

    if (controls.length && tooSmall.length / controls.length <= .12) score += .28;
    else details.push(`${tooSmall.length} visible controls are below the 34px interaction floor.`);

    const unlabeled = controls.filter((el) => {
      if (el.tagName === 'INPUT') return !el.getAttribute('aria-label') && !document.querySelector(`label[for="${el.id}"]`);
      return !String(el.getAttribute('aria-label') || el.textContent || '').trim();
    });
    if (!unlabeled.length) score += .2;
    else details.push(`${unlabeled.length} controls need accessible names.`);

    if (qs('h1', root) && qsa('h2,h3', root).length >= 2) score += .17;
    else details.push('Heading hierarchy is incomplete.');

    const focusStyle = ruleTextContains(':focus-visible');
    if (focusStyle) score += .18;
    else details.push('No explicit :focus-visible treatment was detected.');

    const reducedMotion = ruleTextContains('prefers-reduced-motion');
    if (reducedMotion) score += .17;
    else details.push('Reduced-motion fallback was not detected.');

    return clamp(score, 0, 1);
  }

  function scoreMotion(root, details) {
    let score = 0;
    const reveal = qsa('.ov8-premium-reveal', root);
    const transitions = qsa('.ov8-explore-card,.ov8 .dsh-btn,.ov-graph-mount .node', root)
      .filter((el) => getComputedStyle(el).transitionDuration !== '0s');
    const animated = qsa('*', root).filter((el) => {
      const style = getComputedStyle(el);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });

    if (reveal.length >= 5) score += .28;
    else details.push('Scroll reveal system is not fully attached.');

    if (transitions.length >= 3) score += .22;
    else details.push('Interactive elements need smoother state transitions.');

    if (animated.length <= 54) score += .2;
    else details.push(`Too many simultaneous animated elements (${animated.length}); motion may feel noisy.`);

    const transitionAll = qsa('.ov8-explore-card,.ov8 .dsh-btn,.ov-graph-mount', root)
      .filter((el) => getComputedStyle(el).transitionProperty.split(',').map((x) => x.trim()).includes('all'));
    if (!transitionAll.length) score += .15;
    else details.push('Avoid transition: all on primary premium surfaces.');

    if (ruleTextContains('cubic-bezier(.16,1,.3,1)') || ruleTextContains('cubic-bezier(.16, 1, .3, 1)')) score += .15;
    else details.push('Premium spring easing was not detected.');

    return clamp(score, 0, 1);
  }

  function scoreStability(root, details) {
    let score = 0;
    const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (docOverflow <= 3) score += .3;
    else details.push(`Page has ${Math.round(docOverflow)}px horizontal overflow.`);

    const important = qsa('.ov8-title,.ov8-lead,.ov8-explore-card-title,.ov8-explore-card-desc,.ov8-scholar-name,.ov8-scholar-desc', root);
    const clipped = overflowed(important);
    if (!clipped.length) score += .22;
    else details.push(`${clipped.length} key text blocks appear clipped.`);

    const graph = qs('.ov-graph-mount', root);
    if (graph) {
      const rect = graph.getBoundingClientRect();
      if (rect.width >= Math.min(320, innerWidth - 40) && rect.height >= 260) score += .2;
      else details.push('Knowledge atlas mount is too small for legible interaction.');
    } else {
      details.push('Knowledge atlas mount is missing.');
    }

    const layout = qs('.ov8-hero', root);
    if (layout && layout.getBoundingClientRect().width <= innerWidth + 2) score += .13;
    else details.push('Hero is wider than the viewport.');

    if (ruleTextContains('@media') && ruleTextContains('max-width: 620px')) score += .15;
    else details.push('Compact mobile breakpoint was not detected.');

    return clamp(score, 0, 1);
  }

  function scorePolish(root, details) {
    let score = 0;
    const hero = qs('.ov8-hero', root);
    const explore = qsa('.ov8-explore-card', root);
    const scholar = qs('.ov8-scholar', root);
    const footer = qs('.ov8-footer', root);

    const surfaces = [hero, ...explore, scholar, footer].filter(Boolean);
    const radiusValues = surfaces.map((el) => Math.round(px(getComputedStyle(el).borderRadius)));
    const coherent = radiusValues.length >= 4 && radiusValues.every((r) => r >= 20 && r <= 36);
    if (coherent) score += .24;
    else details.push('Surface radii are not visually coherent.');

    const oldTheme = document.documentElement.dataset.theme || 'light';
    const before = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    document.documentElement.dataset.theme = oldTheme === 'dark' ? 'light' : 'dark';
    const after = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    document.documentElement.dataset.theme = oldTheme;
    if (before && after && before !== after) score += .22;
    else details.push('Light/dark semantic surface tokens do not visibly diverge.');

    const glass = surfaces.filter((el) => {
      const style = getComputedStyle(el);
      return style.backdropFilter !== 'none' || style.webkitBackdropFilter !== 'none';
    });
    if (glass.length >= 3) score += .16;
    else details.push('Premium material treatment is inconsistent.');

    const particles = qsa('.ov8-particles span', root).length;
    if (particles <= 30) score += .14;
    else details.push('Atmospheric particles are overused.');

    const titleWeight = qs('.ov8-title', root) ? Number.parseInt(getComputedStyle(qs('.ov8-title', root)).fontWeight, 10) : 0;
    if (titleWeight >= 550 && titleWeight <= 750) score += .12;
    else details.push('Display weight is outside the restrained premium range.');

    const duplicateGlow = qsa('.ov8 *', root).filter((el) => {
      const shadow = getComputedStyle(el).boxShadow;
      return shadow && (shadow.match(/rgb\(/g) || []).length >= 5;
    });
    if (duplicateGlow.length <= 3) score += .12;
    else details.push('Too many elements use stacked glow/shadow effects.');

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
    const root = qs('.ov8');
    if (!root) return null;

    const categories = {};
    const issues = [];

    categories.hierarchy = scoreHierarchy(root, issues);
    categories.usability = scoreUsability(root, issues);
    categories.motion = scoreMotion(root, issues);
    categories.stability = scoreStability(root, issues);
    categories.polish = scorePolish(root, issues);

    const score = Object.values(categories).reduce((sum, value) => sum + value, 0);
    const report = {
      score: Number(score.toFixed(2)),
      max: 5,
      passed: score >= 4,
      categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Number(value.toFixed(2))])),
      issues,
      viewport: { width: innerWidth, height: innerHeight },
      theme: document.documentElement.dataset.theme || 'unknown',
      timestamp: new Date().toISOString()
    };

    publish(report);
    return report;
  }

  function schedule() {
    const started = performance.now();
    const tick = () => {
      const root = qs('.ov8');
      const graph = qs('.ov-graph-mount');
      if (root && (graph?.children.length || performance.now() - started > MAX_WAIT_MS)) {
        requestAnimationFrame(() => requestAnimationFrame(run));
        return;
      }
      if (performance.now() - started <= MAX_WAIT_MS) setTimeout(tick, 120);
    };
    tick();
  }

  window.ChronoOverviewCritic = { run };
  schedule();

  const page = document.getElementById('page');
  if (page) {
    const observer = new MutationObserver(() => {
      if (qs('.ov8') && !qs('#' + REPORT_ID)) schedule();
    });
    observer.observe(page, { childList: true, subtree: true });
  }
})();
