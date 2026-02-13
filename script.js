// Modern 3D scroll interactions in plain JavaScript.
// 1) Reveal sections with IntersectionObserver
// 2) Apply depth transforms based on scroll position and element data-depth
// 3) Move background orbs for subtle parallax

const sections3D = [...document.querySelectorAll('.section-3d')];
const orbs = [...document.querySelectorAll('.gradient-orb')];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  sections3D.forEach((section) => {
    section.classList.add('is-visible');
    section.style.transform = 'none';
  });
} else {

/**
 * Reveal cards and sections as they enter viewport.
 * This keeps content performant and animated only when needed.
 */
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: '0px 0px -10% 0px'
  }
);

sections3D.forEach((section) => sectionObserver.observe(section));

/**
 * Scroll depth engine:
 * - Reads each section's data-depth value
 * - Maps viewport distance to translateZ + translateY + slight rotateX
 * - Creates sticky depth storytelling without any external libraries
 */
const applyDepthOnScroll = () => {
  const viewportHeight = window.innerHeight;

  sections3D.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const depth = Number(section.dataset.depth || 0.2);

    // Progress around viewport center, in roughly [-1, 1]
    const centerOffset = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;

    // Translate further when farther from center
    const zShift = Math.max(-220, Math.min(220, centerOffset * 380 * depth));
    const yShift = Math.max(-55, Math.min(55, centerOffset * 130 * depth));
    const tilt = Math.max(-6, Math.min(6, centerOffset * -12 * depth));

    if (section.classList.contains('is-visible')) {
      section.style.transform = `translate3d(0, ${yShift.toFixed(1)}px, ${zShift.toFixed(
        1
      )}px) rotateX(${tilt.toFixed(2)}deg)`;
    }
  });

  // Orb parallax tied to full page scroll
  const scrollRatio = window.scrollY / Math.max(1, document.body.scrollHeight - viewportHeight);
  orbs.forEach((orb, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const offsetY = scrollRatio * 120 * direction;
    const offsetX = scrollRatio * 70 * -direction;
    orb.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0)`;
  });
};


// Use requestAnimationFrame for smoothness and to avoid extra layout thrashing.
let ticking = false;
const onScroll = () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      applyDepthOnScroll();
      ticking = false;
    });
    ticking = true;
  }
};

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', applyDepthOnScroll);
  window.addEventListener('load', applyDepthOnScroll);

  // Trigger once immediately for fast first paint alignment.
  applyDepthOnScroll();
}

}
