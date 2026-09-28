(() => {
  const rootSel = '.ov8';
  const revealSel = '.ov8-hero-copy,.ov-graph-mount,.ov8-explore-title,.ov8-explore-sub,.ov8-explore-card,.ov8-scholar,.ov8-footer';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function enhance(root){
    if(!root || root.dataset.premiumOverview==='1') return;
    root.dataset.premiumOverview='1';
    root.classList.add('ov8-premium-ready');

    const hero=root.querySelector('.ov8-hero');
    if(hero && !reduced()){
      let raf=0,x=50,y=20;
      const paint=()=>{raf=0;root.style.setProperty('--ov-mx',x+'%');root.style.setProperty('--ov-my',y+'%')};
      hero.addEventListener('pointermove',e=>{
        const r=hero.getBoundingClientRect();
        x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
        y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));
        if(!raf) raf=requestAnimationFrame(paint);
      },{passive:true});
      hero.addEventListener('pointerleave',()=>{x=50;y=20;if(!raf) raf=requestAnimationFrame(paint)},{passive:true});
    }

    const items=[...root.querySelectorAll(revealSel)];
    items.forEach((el,i)=>{el.classList.add('ov8-premium-reveal');el.style.setProperty('--ov-reveal-delay',Math.min(i*45,220)+'ms')});
    if(reduced() || !('IntersectionObserver' in window)){items.forEach(el=>el.classList.add('is-visible'));return}
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    items.forEach(el=>io.observe(el));
    requestAnimationFrame(()=>root.querySelectorAll('.ov8-hero-copy,.ov-graph-mount').forEach(el=>el.classList.add('is-visible')));
  }

  const scan=node=>{
    if(node.matches?.(rootSel)) enhance(node);
    node.querySelectorAll?.(rootSel).forEach(enhance);
  };
  scan(document);
  const host=document.getElementById('page')||document.body;
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(host,{childList:true,subtree:true});
})();