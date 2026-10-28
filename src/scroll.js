export const POSITION_LIMIT = 80;

export function createScrollManager({
  root,
  body,
  frame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches,
}) {
  const positions = new Map();
  const subscriptions = new Set();
  let lock = null;
  function remember(key) {
    positions.delete(key);
    positions.set(key, root.scrollTop);
    if (positions.size > POSITION_LIMIT)
      positions.delete(positions.keys().next().value);
  }
  function scrollTo(top, smooth = false) {
    root.scrollTo({
      top,
      left: 0,
      behavior: smooth && !reducedMotion() ? "smooth" : "instant",
    });
  }
  function observe(target, callback) {
    let pending = null;
    const listener = () => {
      if (pending !== null) return;
      pending = frame(() => {
        pending = null;
        callback(target.scrollTop);
      });
    };
    target.addEventListener("scroll", listener, { passive: true });
    const dispose = () => {
      target.removeEventListener("scroll", listener);
      if (pending !== null) cancelFrame(pending);
      subscriptions.delete(dispose);
    };
    subscriptions.add(dispose);
    return dispose;
  }
  function unlock() {
    if (!lock) return;
    body.style.overflow = lock.bodyOverflow;
    root.style.overflow = lock.rootOverflow;
    const top = lock.top;
    lock = null;
    scrollTo(top);
  }
  return {
    remember,
    restore(key) {
      scrollTo(positions.get(key) || 0);
    },
    top(smooth = false) {
      scrollTo(0, smooth);
    },
    scrollTo,
    scrollToAnchor(element, { smooth = true, focus = false } = {}) {
      if (!element) return;
      const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
      scrollTo(
        root.scrollTop +
          element.getBoundingClientRect().top -
          root.getBoundingClientRect().top -
          margin,
        smooth,
      );
      if (focus) element.focus({ preventScroll: true });
    },
    observe,
    setOverlay(open) {
      if (open && !lock) {
        lock = {
          top: root.scrollTop,
          bodyOverflow: body.style.overflow,
          rootOverflow: root.style.overflow,
        };
        body.style.overflow = "hidden";
        root.style.overflow = "hidden";
      } else if (!open) unlock();
    },
    dispose() {
      unlock();
      for (const dispose of [...subscriptions]) dispose();
      positions.clear();
    },
  };
}
