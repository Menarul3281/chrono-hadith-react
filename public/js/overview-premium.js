(() => {
  const ROOT = '[data-ovx-root]';
  const REVEALS = [
    '.ovx-hero-copy',
    '.ovx-index',
    '.ovx-section-heading',
    '.ovx-lens-card',
    '.ovx-chain-intro',
    '.ovx-chain-panel',
    '.ovx-record-card',
    '.ovx-feature',
    '.ovx-integrity-head',
    '.ovx-integrity-grid',
    '.ovx-footer'
  ].join(',');

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionEnabled = () => document.documentElement.dataset.motion !== 'off';

  function installChainFocus(root) {
    const panel = root.querySelector('.ovx-chain-panel');
    if (!panel || panel.dataset.chainFocus === '1') return;
    panel.dataset.chainFocus = '1';
    const steps = [...panel.querySelectorAll('.ovx-chain-step')];

    const activate = (step) => {
      steps.forEach((item) => item.classList.toggle('is-active', item === step));
      panel.classList.add('has-chain-focus');
    };

    const clear = () => {
      steps.forEach((item) => item.classList.remove('is-active'));
      panel.classList.remove('has-chain-focus');
    };

    steps.forEach((step) => {
      step.addEventListener('pointerenter', () => activate(step), { passive: true });
      step.addEventListener('pointerleave', clear, { passive: true });
      step.addEventListener('focusin', () => activate(step));
      step.addEventListener('focusout', (event) => {
        if (!step.contains(event.relatedTarget)) clear();
      });
    });

    panel.addEventListener('pointerleave', clear, { passive: true });
  }

  function installReveals(root) {
    const items = [...root.querySelectorAll(REVEALS)];
    items.forEach((item) => item.classList.add('ovx-reveal'));

    if (reduced() || !motionEnabled() || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });

    items.forEach((item) => observer.observe(item));
    root.querySelectorAll('.ovx-hero-copy,.ovx-index').forEach((item) => item.classList.add('is-visible'));
  }

  function enhance(root) {
    if (!root || root.dataset.ovxEnhanced === '1') return;
    root.dataset.ovxEnhanced = '1';
    root.classList.add('ovx-enhanced');
    installChainFocus(root);
    installReveals(root);
  }

  function scan(scope = document) {
    if (scope.matches?.(ROOT)) enhance(scope);
    scope.querySelectorAll?.(ROOT).forEach(enhance);
  }

  scan();

  window.addEventListener('chrono:overview-rendered', () => scan(document));

  const page = document.getElementById('page');
  if (page) {
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        }
      }
    }).observe(page, { childList: true, subtree: true });
  }
})();