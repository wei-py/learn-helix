# Minimal newspaper and scroll QA

## Scope

BrowserOS neo, isolated QA tab **27**, `http://localhost:5174/`, desktop **1440×1000** and mobile emulation **390×844**. Final behavior exercised after implementation freeze; a formatter-triggered reload interrupted one settings sequence, which was reopened before remaining checks. No application source/tests changed by QA. No build/test/lint runs performed by QA.

Storage baseline: exact `helix-lab-v1` value was **null**. Settings save was exercised, then only that key was removed to restore its original absence, followed by reload. No broad storage clear. Other agents' tabs were not modified. Mobile emulation is not a physical iOS/Android inertia test.

## Copy audit and visual result

Baseline repeated masthead/edition/intro/progress/footer slogans, local-save metadata and catalog/recall scope lectures were identified before implementation. Final screenshots show a single newspaper masthead, compact navigation, lesson-specific description, actual editor, actionable steps and collapsed explanatory details. Essential operand behavior, keyboard Tab guidance and export backup/merge/no_op/sticky limitations remain. Desktop sidebar deliberately remains normal flow: pinning all34 lessons in a second page scroller is not the approved architecture. Rule8 applies to the actual sticky topbar; the modal footer remains normal flow within its dialog, not sticky.

## 29-rule evidence matrix

**Browser** means directly exercised below; **source** means inspected implementation, not an unperformed runtime proof. Conditional absent surfaces are N/A, not placeholder implementations.

| # | Rule | Applicability / final evidence |
|---|---|---|
| 1 | Single primary page scroll container | **Browser + source.** `#scroll-root` height1000, overflow:auto; body/window scroll0; main overflow:visible, not independent scrolling. Local editor/dialog/drawer are bounded exceptions. |
| 2 | Router owns page scrolling; no component window.scrollTo | **Source.** `navigation.js` centralizes push/pop/save/restore through `scroll.js`; component navigation calls the manager. Manager calls root.scrollTo, not window.scrollTo. |
| 3 | List back restores context; ordinary entry starts top | **Browser.** Catalog query`move`, mode`normal`, page2/2, root1200 → recall0 → UI return restores all four; repeated with native browser Back, same result. Ordinary practice entry0. Reload followed by unknown prior entry restored query/mode/page but position0, not an unrelated cached offset. |
| 4 | Layout declares scroll-root | **Source + browser.** Persistent `#scroll-root` wraps application content; `style.css` gives100dvh. Main replacement does not replace that root. |
| 5 | Height-bounded local scroll-section | **Source + browser.** Editor max60dvh, preview max50dvh, modal max90dvh; mobile drawer observed height844 at viewport844. Long code remained within editor. |
| 6 | Modal/Drawer independent scrolling | **Browser.** Dialog reached final settings row at scroll48626 without moving root800; mobile drawer PageDown moved its own scroll while root350 stayed fixed. No nested settings-list viewport: dialog is the virtual viewport. |
| 7 | Overlay locks body/background and restores on close | **Browser.** Modal root/body overflow hidden; backdrop wheel plus PageDown left root800, body/window0. Prior inline body overflow`clip` restored after save/close with root800. Mobile drawer locked root350; Escape restored350 and original empty inline overflow. |
| 8 | Sticky uses correct scroll ancestor | **Browser + source.** Actual sticky topbar top0 at root250. The normal-flow, non-sticky modal footer bottom816.28 stayed inside dialog bottom818.67. Desktop sidebar is intentionally static normal flow, not a failed sticky element. |
| 9 | Table horizontal scroll remains local/unified | **N/A.** No tables. Catalog is paginated articles; no fake table added. |
| 10 | Table fixed columns/headers use component configuration | **N/A.** No table component/fixed table columns or headers. |
| 11 | Above-threshold large lists virtualized | **Browser + source.** Shared threshold80;322 normal settings rows,13 initially mounted,9 at desktop final row321,6 at mobile final row321. Catalog remains24/page. |
| 12 | Central scroll subscription manager/hook | **Source.** `createScrollManager.observe` owns passive subscription registration/disposal. Backtop and virtual list consume it. |
| 13 | Scroll listeners throttled/RAF | **Source.** Manager permits one pending requestAnimationFrame per observer; disposal removes listener and cancels pending frame. Browser scroll-driven virtual rows/backtop updated. |
| 14 | Smooth scrolling only anchors/backtop | **Source + browser.** Manager defaults instant; router entry/restore instant. Skip anchor and backtop request smooth; catalog pagination anchor explicitly false. |
| 15 | Reduced-motion disables scrolling animation | **Browser + source.** CDP prefers-reduced-motion:reduce; backtop went to0, skip anchor landed immediately at intended offset. Manager selects instant when media query matches; CSS disables reduced-motion transitions. |
| 16 | Unified scrollToAnchor; no business scrollIntoView | **Browser + source.** Actual skip-link path invokes manager, focuses main; pagination also calls manager. No business scrollIntoView path. |
| 17 | scroll-margin-top includes fixed navigation | **Browser.** Main margin84px; skip anchor resulted main top84.4375, root82, focus`main-content`. |
| 18 | Backtop local-floating z200 and threshold | **Browser.** Hidden at599; visible at700; computed z-index200; click reached0 and focuses root. |
| 19 | No page horizontal overflow | **Browser.** Mobile root client/scroll width390/390 even with700-character inserted line; editor client/scroll width356/6020. Mobile dialog352/352. Main remained overflow:visible. |
| 20 | iOS/Android touch momentum | **Source + emulated geometry only.** Root/editor/modal/drawer use native overflow with touch momentum/overscroll policy. Physical touch inertia was not exercised; no claim of real-device verification. |
| 21 | Stable skeleton/image/async heights to avoid CLS | **N/A to absent surfaces.** Static app has no skeleton/image/network-async content. Existing input/rerender stability is covered by22; no fake async components. |
| 22 | Data refresh preserves context | **Browser.** Final measured virtual row stayed visible through F→F2→F24 rerenders, caret1/2/3; dialog scroll48626 and input top513.640625 unchanged. Invalid regex operand preserved root400.700-character insertion preserved root250. Catalog context returned as in3. |
| 23 | Request failure preserves scroll and existing data | **N/A.** No request-backed data surface. Real local operand error was tested under22, not mislabeled as network-failure coverage. |
| 24 | Images have explicit dimensions/aspect ratio | **N/A.** No images in app. Evidence screenshots are documentation, not app image surfaces. |
| 25 | Shared virtualization abstraction | **Source + browser.** `virtual-list.js` owns range, overscan, measurement, focus pinning, keyboard boundary handling and cleanup; `main.js` mounts it for settings.321st zero-based row reachable in both viewports. |
| 26 | Manager scroll state; no localStorage scrollTop | **Source.** Scroll positions live in manager Map (limit80); navigation context in history. Persistent app payload remains bindings/progress, not scroll positions. Reload behavior confirmed memory-only offsets. |
| 27 | Avoid blocking large computations; profile if necessary | **Source + measured caveat.** Bounded mounted rows and RAF subscriptions reduce scroll/render work. A narrow PerformanceObserver sample over settings open/close recorded **one78ms self long task**. This does not identify application versus browser/tool overhead; no zero-longtask or complete performance-pass claim is made. |
| 28 | Keyboard scrolling and visible focus | **Browser.** Editor Tab escaped to focus control with solid outline. Root PageDown advanced scroll with body0. Drawer opens focused on close button, workspace inert; Escape restores menu focus, hidden drawer inert. Last-row edited input retained visible outline/caret. |
| 29 | Route-leave cleanup for listeners/cache/events | **Source.** Before navigation disposes virtual list, clears measurement cache, cleans drawer and unlocks overlay; virtual dispose disconnects ResizeObserver, removes keydown/scroll observer and clears nodes. Manager positions bounded80, measured cache1000; pagehide disposes navigation/manager and media listener. Not a heap-leak soak test. |

## Representative retained behavior

- Basic lesson: real keyboard `l` moved right and advanced feedback; editor focus retained.
- Advanced lesson: select-all then select-regex with `[` produced genuine invalid-regex error, not fabricated success; root400 preserved.
- Settings: final row `normal.decrement` changed toF24; search`decrement` returned one row and preserved draft. Save persisted; reopening showedF24; reset draft showedC-x. Export textarea includedF24 with full essential safety warning. No download or clipboard mutation was needed.
- Far-end measurement regression independently used final row321, not the implementation author's index200. Desktop mounted indices313–321; each typed character preserved visible input top513.640625, caret and scroll48626. Mobile unfiltered last row also reachable with6 mounted rows.
- UI/native list back and reload behavior are described in3. No complete34-lesson/671-binding manual rerun was performed.

## Screenshots (saved, opened and visually inspected)

- [Desktop1440×1000](research/minimal-scroll-desktop.png): newspaper masthead, normal-flow course list, editor and concise guide, no redundant hero slogans.
- [Mobile390×844](research/minimal-scroll-mobile.png): contained single-column layout, compact toolbar, readable lesson/editor, no horizontal page overflow.
- [Settings final row](research/minimal-scroll-settings-lastrow.png): real final decrement row visibly focused withF24, add-binding area and footer reachable within modal.

## Limitations / handoff

No unresolved functional regression found in exercised frozen behavior. Static desktop sidebar is an intentional approved decision, not a bug. Physical iOS/Android inertia, heap-soak cleanup and attribution of the observed78ms long task remain outside these browser checks. Main owns final test/build verification.

Supplemental evidence **reported by implementation owner, not independently rerun by QA**: after the localhost freeze, a LAN HTTP key-generation compatibility fix was checked in its own BrowserOS tab28 at `http://192.168.3.21:5174/`. It observed `isSecureContext=false`, unavailable `crypto.randomUUID`, available `getRandomValues`, distinct128-bit navigation keys, and practice→library(top700,24cards)→recall(top0)→browser Back restoring library(top700,24cards) and its original key. No storage writes in that supplemental run.
