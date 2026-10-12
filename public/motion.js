window.createMotionEffects = function () {
  let enabled = false, frame = 0, sceneFrame = 0, target = 0, written = 0, lastTime = 0;
  let hero = null, pointerX = 0, pointerY = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const cancel = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0 };
  function paintScene() {
    sceneFrame = 0;
    if (!hero?.isConnected || !enabled) return;
    const box = hero.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;
    const depth = clamp(-box.top * .19, -22, 85);
    hero.style.setProperty('--parallax-y', `${depth + pointerY * 12}px`);
    hero.style.setProperty('--parallax-x', `${pointerX * 18}px`);
    hero.style.setProperty('--backdrop-y', `${-depth * .45}px`);
  }
  function scene() { if (!sceneFrame && enabled) sceneFrame = requestAnimationFrame(paintScene) }
  function step(time) {
    if (!enabled || document.hidden || document.querySelector('dialog[open]')) { cancel(); return }
    if (Math.abs(scrollY - written) > 3) { cancel(); return }
    const elapsed = lastTime ? Math.min(time - lastTime, 40) : 16.7;
    lastTime = time;
    target = clamp(target, 0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
    const next = scrollY + (target - scrollY) * (1 - Math.exp(-elapsed / 85));
    if (Math.abs(target - scrollY) < 2.5) {
      window.scrollTo({top: target, behavior: 'instant'}); cancel(); scene(); return;
    }
    window.scrollTo({top: next, behavior: 'instant'}); written = scrollY;
    frame = requestAnimationFrame(step);
  }
  function nestedScroll(element) {
    for (let el = element instanceof Element ? element : null; el && el !== document.body; el = el.parentElement) {
      if (el.matches('input,textarea,select,dialog,[contenteditable=true]')) return true;
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
    }
    return false;
  }
  addEventListener('wheel', event => {
    if (!enabled || event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY || matchMedia('(pointer: coarse)').matches || document.querySelector('dialog[open]') || nestedScroll(event.target)) { cancel(); return }
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1);
    if (!frame) { target = scrollY; written = scrollY; lastTime = 0 }
    target = clamp(target + delta, 0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
    if (!frame) frame = requestAnimationFrame(step);
  }, {passive: false});
  addEventListener('scroll', scene, {passive: true});
  addEventListener('resize', scene, {passive: true});
  for (const name of ['pointerdown', 'touchstart', 'keydown', 'hashchange', 'pagehide']) addEventListener(name, cancel, {passive: true});
  document.addEventListener('click', cancel, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() });
  document.addEventListener('pointermove', event => {
    if (!enabled || !hero || event.pointerType === 'touch') return;
    const box = hero.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    pointerX = inside ? (event.clientX - box.left) / box.width - .5 : 0;
    pointerY = inside ? (event.clientY - box.top) / box.height - .5 : 0;
    scene();
  }, {passive: true});
  return {
    sync(value) {
      enabled = value;
      if (!enabled) {
        cancel(); cancelAnimationFrame(sceneFrame); sceneFrame = 0;
        hero?.style.removeProperty('--parallax-y'); hero?.style.removeProperty('--parallax-x'); hero?.style.removeProperty('--backdrop-y');
      } else scene();
    },
    refresh() { cancel(); hero = document.querySelector('.hero'); pointerX = pointerY = 0; scene() }
  };
};
