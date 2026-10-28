export function createEntryKey(random = globalThis.crypto) {
  return Array.from(random.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

export function createNavigation({
  history,
  location,
  events,
  scroll,
  readContext,
  applyContext,
  render,
  beforeNavigate = () => {},
  createKey = createEntryKey,
}) {
  let key = createKey();
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  const url = (context) =>
    `${location.pathname}${location.search}#${context.track}`;
  const entry = () => ({ helix: true, key, context: readContext() });
  history.replaceState(entry(), "", url(readContext()));
  function save() {
    scroll.remember(key);
    history.replaceState(entry(), "", url(readContext()));
  }
  const pop = (event) => {
    if (!event.state?.helix) return;
    scroll.remember(key);
    beforeNavigate();
    key = event.state.key;
    applyContext(event.state.context);
    render();
    scroll.restore(key);
  };
  events.addEventListener("popstate", pop);
  return {
    replace() {
      save();
    },
    push(change, { restore = false } = {}) {
      save();
      beforeNavigate();
      change();
      key = createKey();
      history.pushState(entry(), "", url(readContext()));
      render();
      if (restore) scroll.restore(restore);
      else scroll.top();
    },
    get key() {
      return key;
    },
    dispose() {
      events.removeEventListener("popstate", pop);
      history.scrollRestoration = previousRestoration;
    },
  };
}
