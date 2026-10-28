export const VIRTUAL_THRESHOLD = 80;
export const ESTIMATED_ROW_HEIGHT = 156;

export function virtualRange(heights, top, viewport, overscan = 3) {
  const offsets = [0];
  for (const height of heights) offsets.push(offsets.at(-1) + height);
  let start = 0;
  while (start < heights.length && offsets[start + 1] <= top) start++;
  let end = start;
  while (end < heights.length && offsets[end] < top + viewport) end++;
  return {
    start: Math.max(0, start - overscan),
    end: Math.min(heights.length, end + overscan),
    offsets,
  };
}

export function createVirtualLayout(
  items,
  cache,
  estimate = ESTIMATED_ROW_HEIGHT,
) {
  const heights = items.map((item) => cache.get(item.id) || estimate);
  return {
    heights,
    measure(index, height, top, origin) {
      if (height <= 0 || Math.abs(heights[index] - height) <= 0.5) return null;
      const offsets = virtualRange(heights, 0, 0).offsets;
      const adjustment =
        origin + offsets[index + 1] < top ? height - heights[index] : 0;
      heights[index] = height;
      cache.delete(items[index].id);
      cache.set(items[index].id, height);
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      return adjustment;
    },
  };
}

// The dialog is the viewport; the list itself never becomes a nested scroller.
export function mountVirtualList({
  host,
  viewport,
  items,
  renderRow,
  scroll,
  focusId,
  cache = new Map(),
  estimate = ESTIMATED_ROW_HEIGHT,
}) {
  if (items.length <= VIRTUAL_THRESHOLD) {
    host.innerHTML = items.map(renderRow).join("");
    return () => {};
  }
  const layout = createVirtualLayout(items, cache, estimate);
  const { heights } = layout;
  const nodes = new Map();
  let disposed = false;
  let drawing = false;
  const observer = new ResizeObserver((entries) => {
    if (disposed) return;
    let changed = false;
    const before =
      host.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    let adjustment = 0;
    for (const entry of entries) {
      const index = Number(entry.target.dataset.virtualIndex);
      const height = entry.target.getBoundingClientRect().height;
      const delta = layout.measure(index, height, viewport.scrollTop, before);
      if (delta !== null) {
        adjustment += delta;
        changed = true;
      }
    }
    if (changed) {
      viewport.scrollTop += adjustment;
      draw();
    }
  });
  function draw() {
    if (disposed || drawing) return;
    drawing = true;
    const origin =
      host.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    const range = virtualRange(
      heights,
      Math.max(0, viewport.scrollTop - origin),
      viewport.clientHeight,
    );
    const visible = new Set();
    for (let i = range.start; i < range.end; i++) visible.add(i);
    const active = document.activeElement?.closest("[data-virtual-index]");
    const focused = focusId
      ? items.findIndex((item) => `binding-${item.id}` === focusId)
      : -1;
    if (active && host.contains(active))
      visible.add(Number(active.dataset.virtualIndex));
    if (focused >= 0) visible.add(focused);
    const ordered = [...visible].sort((a, b) => a - b);
    for (const [index, node] of nodes) {
      if (!visible.has(index)) {
        observer.unobserve(node);
        node.remove();
        nodes.delete(index);
      }
    }
    host
      .querySelectorAll("[data-virtual-spacer]")
      .forEach((node) => node.remove());
    let previous = 0;
    let cursor = host.firstChild;
    function place(node) {
      if (node !== cursor) host.insertBefore(node, cursor);
      cursor = node.nextSibling;
    }
    function spacer(height) {
      if (height <= 0) return;
      const node = document.createElement("div");
      node.dataset.virtualSpacer = "";
      node.style.height = `${height}px`;
      node.setAttribute("aria-hidden", "true");
      place(node);
    }
    for (const index of ordered) {
      spacer(range.offsets[index] - range.offsets[previous]);
      let node = nodes.get(index);
      if (!node) {
        const template = document.createElement("template");
        template.innerHTML = renderRow(items[index], index);
        node = template.content.firstElementChild;
        node.dataset.virtualIndex = index;
        node.setAttribute("aria-posinset", index + 1);
        node.setAttribute("aria-setsize", items.length);
        nodes.set(index, node);
        observer.observe(node);
      }
      place(node);
      previous = index + 1;
    }
    spacer(range.offsets.at(-1) - range.offsets[previous]);
    focusId = null;
    drawing = false;
  }
  draw();
  const unobserve = scroll.observe(viewport, draw);
  const keydown = (event) => {
    if (event.key !== "Tab") return;
    const row = event.target.closest("[data-virtual-index]");
    if (!row) return;
    const controls = [...row.querySelectorAll("input, button")];
    const boundary = event.shiftKey ? controls[0] : controls.at(-1);
    if (event.target !== boundary) return;
    const next = Number(row.dataset.virtualIndex) + (event.shiftKey ? -1 : 1);
    if (next < 0 || next >= items.length) return;
    event.preventDefault();
    focusId = `binding-${items[next].id}`;
    const origin =
      host.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    const range = virtualRange(heights, 0, 0);
    const rowTop = origin + range.offsets[next];
    if (
      rowTop < viewport.scrollTop ||
      rowTop + heights[next] > viewport.scrollTop + viewport.clientHeight
    )
      viewport.scrollTop = rowTop;
    draw();
    const nextControls = [...nodes.get(next).querySelectorAll("input, button")];
    (event.shiftKey ? nextControls.at(-1) : nextControls[0]).focus({
      preventScroll: true,
    });
  };
  host.addEventListener("keydown", keydown);
  return () => {
    disposed = true;
    unobserve();
    observer.disconnect();
    host.removeEventListener("keydown", keydown);
    nodes.clear();
  };
}
