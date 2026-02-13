/**
 * Scroll Depth Effects
 * Adds subtle 3D depth transforms to existing sections as users scroll.
 * Designed to work with dynamic content and respect reduced motion.
 */
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const targets = Array.from(document.querySelectorAll('.scroll-depth-item'));
  if (!targets.length) return;

  // Assign gentle per-section depth values if none are provided.
  targets.forEach((el, index) => {
    if (!el.dataset.scrollDepth) {
      el.dataset.scrollDepth = (0.14 + (index % 4) * 0.07).toFixed(2);
    }
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in-view');
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  targets.forEach((el) => revealObserver.observe(el));

  const applyDepth = () => {
    const viewportHeight = window.innerHeight || 1;

    targets.forEach((el) => {
      if (!el.classList.contains('is-in-view')) return;

      const depth = Number(el.dataset.scrollDepth || 0.2);
      const rect = el.getBoundingClientRect();
      const centerOffset = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;

      const yShift = Math.max(-32, Math.min(32, centerOffset * 110 * depth));
      const zShift = Math.max(-120, Math.min(70, centerOffset * 280 * depth));
      const tilt = Math.max(-5, Math.min(5, centerOffset * -10 * depth));

      el.style.transform = `perspective(1200px) translate3d(0, ${yShift.toFixed(1)}px, ${zShift.toFixed(
        1
      )}px) rotateX(${tilt.toFixed(2)}deg)`;
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        applyDepth();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', applyDepth);
  window.addEventListener('load', applyDepth);

  // Expose a refresh hook for dynamic section re-rendering.
  window.refreshScrollDepthEffects = applyDepth;
  applyDepth();
})();
