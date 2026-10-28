import test from "node:test";
import assert from "node:assert/strict";
import { createScrollManager, POSITION_LIMIT } from "../src/scroll.js";
import { createNavigation } from "../src/navigation.js";
import { virtualRange, createVirtualLayout } from "../src/virtual-list.js";
import { settingsRows } from "../src/catalog-ui.js";
import {
  DEFAULT_BINDINGS,
  validateBindings,
  resolveKeyInput,
} from "../src/bindings.js";

class ScrollTarget extends EventTarget {
  style = { overflow: "" };
  scrollTop = 0;
  max = 100000;
  calls = [];
  scrollTo(options) {
    this.calls.push(options);
    this.scrollTop = Math.min(this.max, Math.max(0, options.top));
  }
  getBoundingClientRect() {
    return { top: 0 };
  }
}
function scrollFixture(reducedMotion = false) {
  const root = new ScrollTarget();
  const body = { style: { overflow: "clip" } };
  const frames = new Map();
  let serial = 0;
  const scroll = createScrollManager({
    root,
    body,
    reducedMotion: () => reducedMotion,
    frame: (fn) => {
      frames.set(++serial, fn);
      return serial;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  return {
    root,
    body,
    frames,
    scroll,
    flush() {
      for (const [id, fn] of frames) {
        frames.delete(id);
        fn();
      }
    },
  };
}
class MemoryHistory {
  scrollRestoration = "auto";
  entries = [];
  index = -1;
  constructor(events) {
    this.events = events;
  }
  replaceState(state) {
    if (this.index < 0) this.index = 0;
    this.entries[this.index] = structuredClone(state);
  }
  pushState(state) {
    this.entries.splice(++this.index);
    this.entries.push(structuredClone(state));
  }
  go(delta) {
    this.index += delta;
    const event = new Event("popstate");
    event.state = structuredClone(this.entries[this.index]);
    this.events.dispatchEvent(event);
  }
}
function navigationFixture() {
  const fixture = scrollFixture();
  const events = new EventTarget();
  const history = new MemoryHistory(events);
  let context = { track: "practice", query: "", mode: "", page: 0 };
  let serial = 0;
  let renders = 0;
  const options = {
    history,
    events,
    scroll: fixture.scroll,
    location: { pathname: "/", search: "" },
    readContext: () => ({ ...context }),
    applyContext: (next) => {
      context = { ...next };
    },
    render: () => {
      renders++;
    },
    createKey: () => `unique-${++serial}`,
  };
  return {
    ...fixture,
    events,
    history,
    options,
    get context() {
      return context;
    },
    get renders() {
      return renders;
    },
    navigation: createNavigation(options),
  };
}

test("ordinary navigation tops; native back/forward restore list filters, page and entry position", () => {
  const f = navigationFixture();
  f.root.scrollTop = 180;
  f.navigation.push(() => {
    f.context.track = "library";
  });
  assert.equal(f.root.scrollTop, 0);
  Object.assign(f.context, { query: "move", mode: "select", page: 2 });
  f.root.scrollTop = 1250;
  f.navigation.replace();
  f.navigation.push(() => {
    f.context.track = "recall";
  });
  f.root.scrollTop = 240;
  f.history.go(-1);
  assert.deepEqual(f.context, {
    track: "library",
    query: "move",
    mode: "select",
    page: 2,
  });
  assert.equal(f.root.scrollTop, 1250);
  f.history.go(1);
  assert.equal(f.context.track, "recall");
  assert.equal(f.root.scrollTop, 240);
  f.navigation.dispose();
  assert.equal(f.history.scrollRestoration, "auto");
});

test("search replaces one entry and explicit list-return restores its saved position", () => {
  const f = navigationFixture();
  f.navigation.push(() => {
    f.context.track = "library";
  });
  const libraryKey = f.navigation.key;
  for (const query of ["m", "mo", "move"]) {
    f.context.query = query;
    f.navigation.replace();
  }
  assert.equal(f.history.entries.length, 2);
  f.context.page = 3;
  f.root.scrollTop = 1600;
  f.navigation.replace();
  f.navigation.push(() => {
    f.context.track = "recall";
  });
  f.navigation.push(
    () => {
      f.context.track = "library";
    },
    { restore: libraryKey },
  );
  assert.equal(f.root.scrollTop, 1600);
  assert.equal(f.context.query, "move");
  assert.equal(f.context.page, 3);
});

test("new document uses unique entry identities; unknown old positions never collide after reload", () => {
  const f = navigationFixture();
  f.navigation.push(() => {
    f.context.track = "library";
  });
  const oldKey = f.navigation.key;
  f.root.scrollTop = 1900;
  f.navigation.push(() => {
    f.context.track = "recall";
  });
  f.navigation.dispose();
  f.scroll.dispose();
  const next = scrollFixture();
  const reloaded = createNavigation({ ...f.options, scroll: next.scroll });
  assert.notEqual(reloaded.key, oldKey);
  next.root.scrollTop = 777;
  reloaded.replace();
  f.history.go(-1);
  assert.equal(f.context.track, "library");
  assert.equal(next.root.scrollTop, 0);
});

test("overlay locks both surfaces, restores previous overflow and position, and is idempotent", () => {
  const f = scrollFixture();
  f.root.style.overflow = "auto";
  f.root.scrollTop = 850;
  f.scroll.setOverlay(true);
  f.scroll.setOverlay(true);
  assert.equal(f.body.style.overflow, "hidden");
  assert.equal(f.root.style.overflow, "hidden");
  f.root.scrollTop = 0;
  f.scroll.setOverlay(false);
  assert.equal(f.body.style.overflow, "clip");
  assert.equal(f.root.style.overflow, "auto");
  assert.equal(f.root.scrollTop, 850);
  f.scroll.setOverlay(false);
  assert.equal(f.root.scrollTop, 850);
});

test("position memory is bounded and restores retained context", () => {
  const f = scrollFixture();
  for (let i = 0; i <= POSITION_LIMIT; i++) {
    f.root.scrollTop = i + 100;
    f.scroll.remember(`entry-${i}`);
  }
  f.scroll.restore("entry-0");
  assert.equal(f.root.scrollTop, 0);
  f.scroll.restore(`entry-${POSITION_LIMIT}`);
  assert.equal(f.root.scrollTop, POSITION_LIMIT + 100);
});

test("scroll observers coalesce frames and cleanup cancels queued work", () => {
  const f = scrollFixture();
  const seen = [];
  const dispose = f.scroll.observe(f.root, (top) => seen.push(top));
  f.root.dispatchEvent(new Event("scroll"));
  f.root.scrollTop = 99;
  f.root.dispatchEvent(new Event("scroll"));
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.deepEqual(seen, [99]);
  f.root.dispatchEvent(new Event("scroll"));
  dispose();
  assert.equal(f.frames.size, 0);
  f.root.dispatchEvent(new Event("scroll"));
  f.flush();
  assert.deepEqual(seen, [99]);
});

test("smooth is opt-in and reduced motion disables it", () => {
  const normal = scrollFixture();
  normal.scroll.top();
  assert.equal(normal.root.calls.at(-1).behavior, "instant");
  normal.scroll.top(true);
  assert.equal(normal.root.calls.at(-1).behavior, "smooth");
  const reduced = scrollFixture(true);
  reduced.scroll.top(true);
  assert.equal(reduced.root.calls.at(-1).behavior, "instant");
});

test("virtual ranges include final row without mounting the whole collection", () => {
  const heights = Array(322).fill(156);
  const last = virtualRange(heights, 49600, 600);
  assert.equal(last.end, 322);
  assert.ok(last.start > 300);
  const middle = virtualRange(heights, 31200, 600);
  assert.ok(middle.start <= 200 && middle.end > 200);
  assert.ok(middle.end - middle.start < 14);
});

test("measured row sizes survive redraw; measurement above viewport adjusts the visible anchor", () => {
  const items = Array.from({ length: 322 }, (_, id) => ({ id: String(id) }));
  const cache = new Map();
  let layout = createVirtualLayout(items, cache);
  assert.equal(layout.measure(3, 100, 30000, 200), -56);
  assert.equal(layout.measure(200, 185, 30000, 200), 0);
  const offsets = virtualRange(layout.heights, 0, 0).offsets;
  layout = createVirtualLayout(items, cache);
  assert.equal(layout.heights[3], 100);
  assert.equal(layout.heights[200], 185);
  assert.deepEqual(virtualRange(layout.heights, 0, 0).offsets, offsets);
  assert.equal(layout.measure(200, 185, 30000, 200), null);
});

test("editing the last virtual row persists across filtering and redraw and changes real binding resolution", () => {
  const draft = { ...DEFAULT_BINDINGS };
  const rows = settingsRows(draft, "normal", "", "");
  const last = rows.at(-1);
  const heights = new Map([[last.id, 142]]);
  draft[last.id] = "F24 z";
  assert.equal(validateBindings(draft).errors[last.id], undefined);
  const filtered = settingsRows(draft, "normal", "F24 z", "");
  assert.deepEqual(
    filtered.map((row) => row.id),
    [last.id],
  );
  const redrawn = settingsRows(draft, "normal", "", "");
  assert.equal(draft[redrawn.at(-1).id], "F24 z");
  const layout = createVirtualLayout(redrawn, heights);
  assert.equal(layout.heights.at(-1), 142);
  const prefix = resolveKeyInput(draft, "normal", [], "F24");
  const result = resolveKeyInput(draft, "normal", prefix.tokens, "z");
  assert.equal(result.status, "action");
  assert.equal(result.action.command, last.command);
});
