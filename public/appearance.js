(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback } catch { return fallback } };
  let theme = read('component-theme', 'system');
  if (!['light', 'dark', 'system'].includes(theme)) theme = 'system';
  let motion = read('component-motion', 'system');
  if (!['on', 'off', 'system'].includes(motion)) motion = 'system';
  const effects = window.createMotionEffects();
  let observer, lastPage;
  const save = (key, value) => { try { localStorage.setItem(key, value) } catch {} };
  function apply() {
    root.dataset.theme = theme === 'system' ? (system.matches ? 'dark' : 'light') : theme;
    root.dataset.motion = motion === 'on' || (motion === 'system' && !reduced.matches) ? 'on' : 'off';
    effects.sync(root.dataset.motion === 'on');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'dark' ? '#101827' : '#0866ff');
    document.querySelectorAll('[data-theme-choice]').forEach(el => { el.value = theme });
    document.querySelectorAll('[data-motion-choice]').forEach(el => { el.value = motion; el.querySelector('[value=system]').textContent = reduced.matches ? 'Система: выкл.' : 'Система: вкл.'; el.title = 'Плавная прокрутка, параллакс и анимации' });
  }
  apply();
  system.addEventListener('change', apply);
  reduced.addEventListener('change', apply);
  addEventListener('storage', event => {
    if (event.key === 'component-theme') theme = ['light', 'dark', 'system'].includes(event.newValue) ? event.newValue : 'system';
    if (event.key === 'component-motion') motion = ['on', 'off', 'system'].includes(event.newValue) ? event.newValue : 'system';
    apply();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-theme-choice]')) { theme = event.target.value; save('component-theme', theme); apply() }
    if (event.target.matches('[data-motion-choice]')) { motion = event.target.value; save('component-motion', motion); apply(); window.componentAppearance.afterRender(true) }
  });
  const behavior = () => root.dataset.motion === 'on' ? 'smooth' : 'instant';
  document.addEventListener('click', event => {
    if (event.target.closest('#back-to-top')) { window.scrollTo({top: 0, behavior: behavior()}); document.querySelector('.brand')?.focus({preventScroll: true}) }
  });
  function updateScroll() { const button = document.getElementById('back-to-top'); if (button) button.hidden = scrollY < 500 }
  addEventListener('scroll', updateScroll, {passive: true});
  window.componentAppearance = {
    behavior,
    controls: () => `<div class="appearance-controls"><label class="theme-control">Тема <select data-theme-choice aria-label="Цветовая тема"><option value="system">Как в системе</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label><label class="motion-control">Эффекты <select data-motion-choice aria-label="Эффекты и плавная прокрутка"><option value="system">Как в системе</option><option value="on">Включены</option><option value="off">Выключены</option></select></label></div>`,
    afterRender(force = false) {
      apply(); updateScroll(); observer?.disconnect(); effects.refresh();
      const page = location.hash.split('?')[0] || '#home';
      if ((!force && page === lastPage) || root.dataset.motion === 'off') { lastPage = page; return }
      lastPage = page;
      if (!('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('appear'); observer.unobserve(entry.target);
      }), {threshold: 0.08});
      document.querySelectorAll('#main .hero-copy, #main .product-card, #main .promo, #main .trust-item, #main .part-product, #main .ai-orb').forEach((el, i) => {
        el.style.setProperty('--enter-delay', `${Math.min(i % 4, 3) * 45}ms`); observer.observe(el);
      });
    }
  };
})();
