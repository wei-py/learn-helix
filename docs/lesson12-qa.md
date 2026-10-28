# Lesson 12 browser QA

BrowserOS neo, 2026-10-28, `http://localhost:5174/#practice`. Own page 34, group `995FF1A0CE6DF9C64AE1C63B1FC88282`. No source/test edits or test/build execution by this QA worker.

## Diagnosis

Observed keyboard flow before the fix: click editor → `%` (focus `editor`) → `s` (focus `operand-pattern`) → type `cat` → Enter (focus `editor`, 2/5 steps) → `c`. The last action opened the optional register form, focused `operand-register`, retained NORMAL mode and `cat + cat = cat`, and stayed at 2/5. Thus the next typed `dog` would target a register field rather than the document. The original step hint omitted the regex argument/Enter and said `c` enters insert mode without mentioning this blocking form.

## Verified after source freeze

- Physical-key path: click editor → `%` → `s` → type `cat` → Enter → `c` → `d`, `o`, `g` → Escape. Completed 5/5 in NORMAL with actual text `dog + dog = dog`. Three selected `g` characters remained; one carries the primary `.head` class. After `c`, focus stayed in `editor`, text had three insertion positions, and no register form existed.
- Invalid `[` regex: displayed invalid-regex error, retained text, remained 1/5. Valid but incorrect `ca`: applied actual shorter matches, displayed argument mismatch, remained 1/5. Neither faked progress.
- Narrow mobile emulation, 390 × 844: click `%`, click `s`, fill regex `cat`, click execution, click `c`, fill “触屏 / 中文输入” with `dog`, click “插入文字”, click Esc. Completed with exact text and three selected characters. Emulation was cleared afterward. This is desktop Chromium mobile emulation, not a physical phone test.
- Custom mapping through visible settings: changed normal `select_regex` from `s` to `F6`, saved. The next-step hint and command control displayed F6. The full keyboard flow using F6 completed with correct text and three selected characters.
- Neighbor lesson 24: `m`, `i`, type `w`, Enter; explicit yank “寄存器…” form with `a`; End; explicit paste “寄存器…” form with `a`. Completed 4/4 with `red bluered`. Hint explicitly directed the named-register affordance.
- Neighbor lesson 33: explicit start-recording register form `q`; `m`, `i`, `w`, Enter; uppercase button; `j`; explicit stop-recording register form `q`; explicit replay register form `q`, count 2. Completed 6/6 with ONE/TWO/THREE on their respective lines. Both named-register and count values were entered into visible forms, never injected into app state.
- Macro caveat: bare physical Q does stop an active named recording, but the lesson's strict argument comparison does not advance the stop step without `register:q`. The current derived hint correctly requests the explicit form; following it completes. This QA did not change that separate strict-argument behavior.
- Narrow layout observation: body overflow-y hidden; `#scroll-root` overflow-y auto. No router/layout source was changed by QA. Comprehensive route scroll restoration and overlay positioning were not re-tested here.

## State preservation

Before any lesson interaction, exact `helix-lab-v1` baseline was read as absent (`null`), saved in BrowserOS tool output `/Users/wx/.browseros/tool-output/evaluate-1793154893913-ab587e74-809c-44e0-a3a0-1e9e53f8a3c3.txt`. QA completion/remapping changed that app key. At the end only this key was removed to restore its exact absent baseline, and a read confirmed `baselineRestored: true`. Reloading and opening lesson 12 again still returned `baseline: null`. No global reset, storage clear, or other origin/key mutation was used. Device emulation was cleared. Own tab remains on lesson 12 with original default bindings and progress loaded; unrelated pages were untouched.
