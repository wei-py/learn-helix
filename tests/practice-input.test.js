import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BINDINGS, actionForCommand, bindingId, addBinding } from "../src/bindings.js";
import { LESSONS, createState, applyAction, insertText, backspace, matchesGoal, goalFor } from "../src/engine.js";
import { resolvePracticeInput, updateTextProgress } from "../src/practice-input.js";

// Exercise the same dispatch/progress transitions used by main against the real engine.
function practice(bindings = DEFAULT_BINDINGS) {
  const lesson = LESSONS.find((entry) => entry.id === "adv-regex-rename");
  let state = createState(lesson), pending = [], countInput = "", stepIndex = 0, typed = "";
  const text = (value, erase = false) => {
    pending = [];
    countInput = "";
    state = erase ? backspace(state) : insertText(state, value);
    ({ stepIndex, typed } = updateTextProgress(lesson.steps, stepIndex, typed, value, erase));
  };
  const press = (key, { rawText = key.length === 1 ? key : undefined, args = {}, fresh = false } = {}) => {
    const result = resolvePracticeInput({ bindings, mode: state.mode, advanced: true, pending, countInput, key, rawText, fresh });
    pending = result.pending;
    countInput = result.countInput;
    if (result.status === "text") text(result.text);
    if (result.status === "action") {
      // This invariant is required before operand forms, editing fast paths or errors.
      assert.deepEqual(pending, []);
      const command = result.action.command;
      if (state.mode === "insert" && command === "delete_char_backward") text("", true);
      else if (state.mode === "insert" && command === "insert_newline") text("\n");
      else {
        const expected = lesson.steps[stepIndex];
        state = applyAction(state, command, countInput ? { count: Number(countInput), ...args } : args);
        if (expected?.mode === result.action.mode && expected.action === command) {
          stepIndex++;
          typed = "";
        }
        countInput = "";
      }
    }
    return result;
  };
  return {
    press, text,
    get state() { return state; },
    get pending() { return pending; },
    get countInput() { return countInput; },
    get stepIndex() { return stepIndex; },
    get complete() { return stepIndex === lesson.steps.length && matchesGoal(state, goalFor(lesson)); },
  };
}
function change(p) {
  p.press("%");
  p.press("s", { args: { pattern: "cat" } });
  p.press("c");
  assert.equal(p.state.mode, "insert");
  assert.equal(p.state.text, " +  = ");
  assert.equal(p.stepIndex, 3);
}
const type = (p, value) => { for (const key of value) p.press(key); };
const remap = (mode, command, key, bindings = DEFAULT_BINDINGS) => ({
  ...bindings, [bindingId(actionForCommand(bindings, mode, command))]: key,
});

test("consumed Backspace, Enter and Ctrl-h never contaminate the next insertion", () => {
  for (const key of ["backspace", "ret", "C-h"]) {
    const p = practice();
    change(p);
    p.press(key);
    const edited = p.state.text;
    const locations = p.state.selections.map((selection) => selection.head);
    assert.equal(p.press("d").status, "text");
    let expected = edited;
    for (const at of [...locations].reverse()) expected = expected.slice(0, at) + "d" + expected.slice(at);
    assert.equal(p.state.text, expected);
    assert.deepEqual(p.pending, []);
    if (key !== "ret") assert.notEqual(edited, " +  = "); // Real separator deletion is not clamped away.
  }
});

test("real typo correction, repeated deletion and mixed newline correction finish all five steps", () => {
  for (const sequence of [
    ["d", "x", "backspace", "o", "g"],
    ["d", "x", "x", "backspace", "backspace", "o", "g"],
    ["d", "ret", "backspace", "o", "g"],
    ["d", "x", "C-h", "o", "g"],
  ]) {
    const p = practice();
    change(p);
    for (const key of sequence) p.press(key);
    p.press("esc");
    assert.equal(p.state.text, "dog + dog = dog");
    assert.deepEqual(p.state.selections, [{ anchor: 2, head: 2 }, { anchor: 8, head: 8 }, { anchor: 14, head: 14 }]);
    assert.equal(p.stepIndex, 5);
    assert.equal(p.complete, true);
    p.press("u");
    assert.equal(p.state.text, "cat + cat = cat");
  }
});

test("letters, digits, spaces and punctuation are ordinary insert text, not counts", () => {
  const p = practice();
  change(p);
  type(p, "aZ09!? +-=\"'");
  assert.equal(p.state.text, "aZ09!? +-=\"' + aZ09!? +-=\"' = aZ09!? +-=\"'");
  assert.equal(p.countInput, "");
  assert.deepEqual(p.pending, []);
});

test("text-step completion remains correctable after the first exact match", () => {
  for (const sequence of [["x", "backspace"], ["backspace", "g"]]) {
    const p = practice();
    change(p);
    type(p, "dog");
    assert.equal(p.stepIndex, 4);
    p.press(sequence[0]);
    assert.equal(p.stepIndex, 3);
    p.press(sequence[1]);
    assert.equal(p.stepIndex, 4);
    p.press("esc");
    assert.equal(p.complete, true);
  }
});

test("custom editing prefixes complete, cancel and fail without swallowing subsequent letters", () => {
  const configured = remap("insert", "delete_char_backward", "F6 h");
  const p = practice(configured);
  change(p);
  assert.equal(p.press("C-h").status, "unbound");
  assert.equal(p.state.text, " +  = ");
  type(p, "dx");
  assert.equal(p.press("F6").status, "prefix");
  assert.deepEqual(p.pending, ["F6"]);
  assert.equal(p.press("h").status, "action");
  type(p, "og");
  assert.equal(p.state.text, "dog + dog = dog");
  assert.equal(p.press("F6").status, "prefix");
  assert.equal(p.press("esc").status, "cancel");
  assert.equal(p.state.mode, "insert");
  assert.equal(p.press("F6").status, "prefix");
  assert.equal(p.press("q").status, "unbound");
  assert.equal(p.press("x").status, "text");
  p.press("F6");
  p.press("h");
  p.press("esc");
  assert.equal(p.complete, true);
});

test("remapped exit and Esc-containing configured prefixes take precedence over cancellation", () => {
  for (const exit of ["F7", "F6 esc"]) {
    const configured = remap("insert", "normal_mode", exit);
    const p = practice(configured);
    change(p);
    assert.equal(p.press("esc").status, "unbound");
    type(p, "dog");
    for (const key of exit.split(" ")) p.press(key);
    assert.equal(p.complete, true);
  }
});

test("on-screen fresh sequences and count state use the same mapping policy", () => {
  let configured = remap("normal", "select_all", "F6 a");
  let p = practice(configured);
  assert.equal(p.press("F6").status, "prefix");
  p.press("F6", { fresh: true });
  p.press("a");
  assert.equal(p.stepIndex, 1);
  assert.deepEqual(p.pending, []);
  p = practice();
  p.press("2"); p.press("0");
  assert.equal(p.countInput, "20");
  assert.equal(p.press("F24").status, "unbound");
  assert.equal(p.countInput, "");
  configured = addBinding(DEFAULT_BINDINGS, "normal", "select_all", "2");
  p = practice(configured);
  assert.equal(p.press("2").status, "action");
  assert.equal(p.stepIndex, 1);
});

test("a rejected real operand does not leave a consumed command in the next sequence", () => {
  const p = practice();
  p.press("%");
  assert.throws(() => p.press("s", { args: { pattern: "[" } }));
  assert.deepEqual(p.pending, []);
  assert.equal(p.press("s", { args: { pattern: "cat" } }).status, "action");
  p.press("c");
  type(p, "dog");
  p.press("esc");
  assert.equal(p.complete, true);
});
