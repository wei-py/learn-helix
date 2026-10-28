import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS, createState, applyAction, insertText, matchesGoal } from "../src/engine.js";
import { ACTIONS, DEFAULT_BINDINGS, actionForCommand, actionsFor, bindingId, addBinding, validateBindings } from "../src/bindings.js";
import { commandInteraction } from "../src/advanced.js";
import { resolvePracticeInput } from "../src/practice-input.js";
import { lessonAnswer, lessonAnswerMarkup } from "../src/lesson-answer.js";

// Follow the published operations through the real input resolver and engine,
// without reading the lesson's expected commands/parameters during execution.
function follow(lesson, bindings) {
  let state = createState(lesson), countInput = "", pending = [], form = null;
  function execute(action, args) {
    const basic = ACTIONS.find((a) => a.mode === state.mode && a.command === action.command);
    state = applyAction(state, state.advanced ? action.command : basic.id, args);
    countInput = "";
  }
  for (const step of lessonAnswer(lesson, bindings)) {
    assert.equal(state.mode, step.mode);
    for (const op of step.operations) {
      if (op.kind === "text") state = insertText(state, op.value);
      else if (op.kind === "count") countInput = String(op.value);
      else if (op.kind === "key") {
        for (const key of op.value.split(" ")) {
          const result = resolvePracticeInput({ bindings, mode: state.mode, advanced: state.advanced,
            pending, countInput, key });
          pending = result.pending;
          countInput = result.countInput;
          assert.ok(["prefix", "action"].includes(result.status));
          if (result.status === "action") {
            const args = countInput ? { count: Number(countInput) } : {};
            if (commandInteraction(result.action.command)) form = { action: result.action, args };
            else execute(result.action, args);
          }
        }
      } else if (op.kind === "control") {
        const action = actionsFor(bindings).find((a) => a.mode === state.mode &&
          bindings[bindingId(a)] && `${a.label}：寄存器…` === op.value);
        assert.ok(action, op.value);
        assert.ok(commandInteraction(action.command, true));
        assert.equal(commandInteraction(action.command), null);
        form = { action, args: countInput ? { count: Number(countInput) } : {} };
      } else if (op.kind === "operand") {
        assert.ok(form);
        assert.ok(commandInteraction(form.action.command, true).fields.some((f) => f.name === op.name));
        form.args[op.name] = op.value;
      } else if (op.kind === "submit") {
        assert.equal(op.value, "ret");
        execute(form.action, form.args);
        form = null;
      } else assert.fail(`Unusable answer: ${JSON.stringify(op)}`);
    }
  }
  assert.equal(form, null);
  assert.equal(matchesGoal(state, lesson.goal), true, lesson.id);
  return state;
}

test("all lesson answers are executable against independent literal goals", () => {
  for (const lesson of LESSONS) {
    assert.ok(lesson.goal);
    const before = structuredClone(lesson);
    follow(lesson, DEFAULT_BINDINGS);
    assert.deepEqual(lesson, before);
  }
});

test("every answer follows newly configured multi-key aliases in all modes", () => {
  let bindings = Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map((id) => [id, ""]));
  let index = 0;
  for (const lesson of LESSONS) {
    for (const step of lessonAnswer(lesson, DEFAULT_BINDINGS)) {
      if (!step.command || actionForCommand(bindings, step.mode, step.command)) continue;
      bindings = addBinding(bindings, step.mode, step.command,
        `F24 F${Math.floor(index / 24) + 1} F${index % 24 + 1}`);
      index++;
    }
  }
  assert.equal(validateBindings(bindings).valid, true);
  for (const lesson of LESSONS) follow(lesson, bindings);
});


test("counts, regex escapes, character/object operands and named registers stay literal", () => {
  const operands = LESSONS.flatMap((l) => lessonAnswer(l, DEFAULT_BINDINGS)).flatMap((s) => s.operations);
  for (const [name, value] of [["pattern", "\\w+"], ["pattern", "\\d+"], ["char", ","], ["object", "("], ["register", "a"], ["register", "q"]])
    assert.ok(operands.some((op) => op.kind === "operand" && op.name === name && op.value === value));
  for (const id of ["adv-register", "adv-replace-yank", "adv-macro", "adv-count-find", "adv-nested-object", "adv-indent"])
    follow(LESSONS.find((l) => l.id === id), DEFAULT_BINDINGS);
});

test("removed commands never fall back to default keys, while active aliases remain usable", () => {
  const lesson = LESSONS[0];
  const oneRemoved = { ...DEFAULT_BINDINGS, "normal.right": "" };
  assert.equal(lessonAnswer(lesson, oneRemoved)[0].operations[0].kind, "key");
  const none = { ...DEFAULT_BINDINGS };
  for (const a of ACTIONS.filter((a) => a.mode === "normal" && a.command === "move_char_right")) none[bindingId(a)] = "";
  assert.deepEqual(lessonAnswer(lesson, none)[0].operations,
    [{ kind: "unbound", command: "move_char_right" }]);
});

test("answer rendering is read-only and escapes literal content", () => {
  const lesson = LESSONS.find((l) => l.id === "insert");
  const before = structuredClone({ lesson, bindings: DEFAULT_BINDINGS });
  lessonAnswerMarkup(lesson, DEFAULT_BINDINGS, "", false);
  assert.deepEqual({ lesson, bindings: DEFAULT_BINDINGS }, before);
  const special = { ...lesson, steps: [{ type: "text", text: '<script>"&' }], goal: { ...lesson.goal, text: '<script>"&' } };
  const html = lessonAnswerMarkup(special, DEFAULT_BINDINGS, "");
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;&quot;&amp;"));
});

