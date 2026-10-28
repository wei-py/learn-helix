# Insert-mode input QA

## Diagnosis

The screenshot-reported `⌫ → d 未绑定` is accepted as ground truth, not replayed to reconfirm the failure. Source inspection identified the dispatcher boundary: `feedKey` retained `resolveKeyInput(...).tokens` even for an exact action. `beginAction` handled `delete_char_backward` and `insert_newline` by returning directly to `typeText`, bypassing `executeAction`'s pending reset. The next printable key was consequently resolved as a multi-key sequence, and `hadPrefix` prevented the ordinary insert fallback. The engine never received that character. The same path covers Ctrl-h. This is distinct from expected lesson-step feedback after legitimate text edits.

## Isolation

BrowserOS neo only; own tab 52 at `http://localhost:5174/`, not the existing user tab. Before any progress/settings mutation, the exact `helix-lab-v1` value was read: absent (`null`, `exists: false`). Only this key may be restored. No localStorage-wide clearing, app-state injection, fake DOM completion, or test/build invocation is used. App/tests implementation belongs to the fixing worker; this report is the QA-owned file.

## Post-fix browser results

After the fixing worker's source-freeze signal, the app was reloaded. All editor characters below were delivered by BrowserOS `page.press`, not by injected state. Common setup **P** is lesson 12, focus editor, `% s c a t Enter c`; `cat` goes into the real regex form and Enter submits it. Each case starts with “重新练习”.

| Keys after P | Observed result |
| --- | --- |
| `Backspace d` | INSERT, editor focused, no pending badge; actual text `d +d =d`, carets at offsets 1, 4, 7. No `⌫ → d` error. Backspace legitimately removed preceding separator spaces at later cursors; this is not a goal-completion case. |
| `d x Backspace o g Esc` | Completed, NORMAL, `dog + dog = dog`, three selected `g` characters. |
| `d Enter Backspace o g Esc` | Completed with the same real goal and three selections. |
| `d o g Backspace g Esc` | Late correction completed with the same goal. |
| `d o g x Backspace Esc` | Late extra-character correction completed with the same goal. |
| `x x Backspace Backspace d o g Esc` | Repeated deletion completed with the same goal. |
| `x Ctrl-h d o g Esc` | Ctrl-h deletion then printable input completed with the same goal. |
| `Enter d` | Real newline and `d` inserted at all three cursors; INSERT, focus editor, no pending badge. Expected “文字还不匹配” feedback, not an unbound-key error. |
| `a Z 7 0 ! ? - _ . , /` | Exact `aZ70!?-_.,/` inserted at all three cursors; INSERT, focus editor, no pending badge. Expected lesson text mismatch, not dropped characters. |

Completion observations showed `本课完成。`, focus `editor`, and no pending badge. The final default typo-correction run additionally confirmed the actual selected offsets **2, 8, 14** in `dog + dog = dog`.

### Real custom prefix and remapped exit

Through the settings UI, changed insert-mode `normal_mode` from `esc` to `j k`, then saved. After P:

1. `j` showed `j …`, remained INSERT, preserved text and all three carets.
2. `Esc` cancelled the prefix only: no pending badge, still INSERT, unchanged text.
3. `d o g j` inserted the correct text and retained the genuine `j …` prefix.
4. `k` executed the remapped exit, cleared pending, entered NORMAL, and completed the real goal.

Defaults were restored through the settings UI before the remaining tests. The virtualized binding row/search remained usable; BrowserOS twice reported a fill readback error after an actual successful rerender. Fresh snapshots confirmed each applied value before continuing; this tool discrepancy was reported.

### Mobile and optional register paths

- Own tab only was emulated at 390 × 844. After P, filled the actual “触屏 / 中文输入” field with `dog`, clicked “插入文字”: INSERT, three carets, editor focus, no pending badge. Clicking the actual Esc command button completed `dog + dog = dog` in NORMAL. Device emulation was then cleared.
- After `% s cat Enter`, clicked the explicit “删除选区并进入插入模式：寄存器…” control, filled register `q`, submitted Enter, then physically pressed `d o g Esc`. The form executed, the three-selection goal completed, and no pending badge remained. This checks the optional-form route, not a full register round-trip.

## Restoration and scope

After the final default correction run, removed **only** `helix-lab-v1` to restore the captured absent baseline. Immediate readback confirmed `raw: null`, `exists: false`. No other storage keys or other tabs were changed. The owned tab remains open with the actual completed lesson for inspection; in-memory completion is intentionally visible, while persisted QA progress is removed.

Final inline PNG evidence shows actual corrected text, three selected characters, NORMAL, and “本课完成”; it was captured after scrolling the existing `#scroll-root` to the top, with no DOM/content fabrication. The screenshot tool did not provide a persistent file path. Browser/storage-write ownership is returned to the fixing worker/main agent.

This targeted QA does not claim all 34 lessons or a rerun of the prior layout/router matrix. No app/tests files were edited and no test/build/lint commands were run by this QA worker.
