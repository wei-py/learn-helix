import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "smol-toml";
import {
  DEFAULT_KEYMAP,
  COMMANDS,
  TYPABLE_COMMANDS,
  CATALOG_META,
} from "../src/catalog.js";
import { COMMAND_ZH } from "../src/catalog-zh.js";
import {
  ACTIONS,
  ALL_COMMANDS,
  DEFAULT_BINDINGS,
  normalizeKey,
  parseSequence,
  validateBindings,
  keyFromEvent,
  exportToml,
  resolveKeyInput,
  bindingId,
  addBinding,
  actionsFor,
  actionForCommand,
  migrateBindings,
} from "../src/bindings.js";
import {
  LESSONS,
  createState,
  selection,
  applyAction,
  insertText,
  backspace,
  goalFor,
  matchesGoal,
  loadSaved,
  saveState,
  STORAGE_KEY,
} from "../src/engine.js";
import { recallQuestion, libraryMarkup } from "../src/catalog-ui.js";
import { commandInteraction } from "../src/advanced.js";
const fixture = (text, cursor = 0) => createState({ text, cursor });
const run = (state, actions) =>
  actions.reduce((s, a) => applyAction(s, a), state);
const bindings = (patch = {}) => ({ ...DEFAULT_BINDINGS, ...patch });
const event = (key, mods = {}) => ({
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});
const leaf = (tree, mode, keys) =>
  keys.reduce((node, key) => node?.[key], tree.keys[mode]);
const memory = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
};

test("catalog contains every pinned official leaf and unique command registry", () => {
  assert.equal(DEFAULT_KEYMAP.length, 671);
  assert.deepEqual(
    Object.fromEntries(
      ["normal", "select", "insert"].map((mode) => [
        mode,
        ACTIONS.filter((a) => a.mode === mode).length,
      ]),
    ),
    { normal: 322, select: 322, insert: 27 },
  );
  assert.equal(COMMANDS.length, 305);
  assert.equal(TYPABLE_COMMANDS.length, 89);
  assert.equal(ALL_COMMANDS.length, 394);
  assert.equal(
    new Set(ALL_COMMANDS.map((c) => c.name)).size,
    ALL_COMMANDS.length,
  );
  assert.equal(CATALOG_META.counts.bindings, ACTIONS.length);
  assert.equal(new Set(ACTIONS.map(bindingId)).size, ACTIONS.length);
  assert.equal(validateBindings(DEFAULT_BINDINGS).valid, true);
  for (const row of DEFAULT_KEYMAP)
    assert.ok(
      COMMANDS.some((c) => c.name === row.command),
      row.command,
    );
});
test("all official leaves including nested prefixes export exact command values", () => {
  const tree = parse(exportToml(DEFAULT_BINDINGS));
  for (const row of DEFAULT_KEYMAP)
    assert.deepEqual(
      leaf(tree, row.mode, row.keys),
      row.command,
      `${row.mode} ${row.key}`,
    );
  assert.equal(tree.keys.select.h, "extend_char_left");
  assert.equal(tree.keys.normal.j, "move_visual_line_down");
});
test("Helix key grammar supports complete prefix depth, modifiers and function keys", () => {
  for (const [configured, physical] of [
    ["Escape", event("Escape")],
    ["Space", event(" ")],
    ["Enter", event("Enter")],
    ["left", event("ArrowLeft")],
    ["Ctrl+H", event("h", { ctrlKey: true })],
    ["Shift+h", event("H", { shiftKey: true })],
    ["F12", event("F12")],
    ["S-left", event("ArrowLeft", { shiftKey: true })],
  ])
    assert.equal(normalizeKey(configured), keyFromEvent(physical));
  assert.deepEqual(parseSequence("F6 a b c d"), ["F6", "a", "b", "c", "d"]);
  assert.equal(normalizeKey("A--"), "A-minus");
  for (const key of ["hyper", "C-C-h", "中文", "F25"])
    assert.throws(() => parseSequence(key), undefined, key);
  assert.equal(keyFromEvent(event("Dead")), null);
  for (const row of DEFAULT_KEYMAP)
    assert.equal(parseSequence(row.key).join(" "), row.key, row.key);
});
test("removed bindings are valid and conflicts cover all official prefixes and aliases", () => {
  assert.equal(validateBindings(bindings({ "normal.right": "" })).valid, true);
  let result = validateBindings(bindings({ "normal.right": "h" }));
  assert.ok(result.errors["normal.right"]);
  assert.ok(result.errors["normal.left"]);
  result = validateBindings(bindings({ "normal.right": "space w" }));
  assert.equal(result.valid, false);
  assert.equal(
    validateBindings(
      bindings({ "normal.right": "F6 h", "select.right": "F6 h" }),
    ).valid,
    true,
  );
  assert.equal(
    validateBindings(bindings({ "normal.right": "tab" })).valid,
    false,
  ); // Existing real tab binding conflicts, not browser denial.
});
test("one current mapping powers remapped matcher, hints and native TOML; former key disabled", () => {
  const custom = bindings({ "normal.right": "F6 h" });
  assert.equal(resolveKeyInput(custom, "normal", [], "l").status, "unbound");
  const prefix = resolveKeyInput(custom, "normal", [], "F6");
  assert.equal(prefix.status, "prefix");
  const match = resolveKeyInput(custom, "normal", prefix.tokens, "h");
  assert.equal(match.action.id, "right");
  assert.equal(actionForCommand(custom, "normal", "move_char_right").key, "l");
  assert.equal(
    custom[bindingId(actionForCommand(custom, "normal", "move_char_right"))],
    "F6 h",
  );
  assert.equal(
    resolveKeyInput(custom, "select", [], "l").action.command,
    "extend_char_right",
  );
  const native = parse(exportToml(custom));
  assert.equal(native.keys.normal.F6.h, "move_char_right");
  assert.equal(native.keys.normal.l, "no_op");
});
test("all catalog static and typable commands can receive custom aliases and be removed", () => {
  let custom = addBinding(DEFAULT_BINDINGS, "normal", "select_regex", "F6 a");
  custom = addBinding(custom, "insert", ":write", "F7");
  const regex = actionsFor(custom).find(
    (a) => a.id.startsWith("custom:") && a.command === "select_regex",
  );
  assert.equal(
    resolveKeyInput(custom, "normal", ["F6"], "a").action.command,
    "select_regex",
  );
  assert.equal(validateBindings(custom).valid, true);
  const native = parse(exportToml(custom));
  assert.equal(native.keys.normal.F6.a, "select_regex");
  assert.equal(native.keys.insert.F7, ":write");
  custom[bindingId(regex)] = "";
  assert.equal(
    resolveKeyInput(custom, "normal", ["F6"], "a").status,
    "unbound",
  );
  assert.throws(() => addBinding(custom, "normal", "invented_command", "F9"));
});
test("export handles punctuation escaping and replacing a former prefix with a leaf", () => {
  const custom = bindings({ "normal.right": 'F6 "', "normal.left": "F6 \\" });
  const parsed = parse(exportToml(custom));
  assert.equal(parsed.keys.normal.F6['"'], "move_char_right");
  assert.equal(parsed.keys.normal.F6["\\"], "move_char_left");
  let replaced = { ...DEFAULT_BINDINGS };
  for (const a of ACTIONS.filter(
    (a) => a.mode === "normal" && a.key.startsWith("g "),
  ))
    replaced[bindingId(a)] = "";
  replaced["normal.right"] = "g";
  assert.equal(parse(exportToml(replaced)).keys.normal.g, "move_char_right");
});
test("screen shortcut fresh prefix does not append an outstanding keyboard prefix", () => {
  const custom = bindings({ "normal.right": "F6 h" });
  const prefix = resolveKeyInput(custom, "normal", [], "F6");
  const fresh = resolveKeyInput(custom, "normal", prefix.tokens, "F6", true);
  assert.equal(fresh.status, "prefix");
  assert.equal(
    resolveKeyInput(custom, "normal", fresh.tokens, "h").action.id,
    "right",
  );
});
test("character selection and real delete/undo preserve actual text", () => {
  let state = run(fixture("cat nap"), ["select", "right", "right"]);
  assert.deepEqual(selection(state), [0, 2]);
  state = applyAction(state, "delete");
  assert.equal(state.text, " nap");
  state = applyAction(state, "undo");
  assert.equal(state.text, "cat nap");
  assert.deepEqual(selection(state), [0, 2]);
});
test("word deletion matches independently observed native word boundaries", () => {
  const initial = fixture("learn helix today\n");
  assert.equal(run(initial, ["word", "delete"]).text, "helix today\n");
  assert.equal(run(initial, ["word", "word", "delete"]).text, "learn today\n");
  assert.equal(
    run(initial, ["word", "word", "backword", "delete"]).text,
    "learn today\n",
  );
});
test("vertical movement keeps desired column and word motion clamps edges", () => {
  let state = fixture("abcdef\nx\nabcdef", 4);
  state = applyAction(state, "down");
  assert.equal(state.head, 7);
  state = applyAction(state, "down");
  assert.equal(state.head, 13);
  state = applyAction(state, "up");
  assert.equal(state.head, 7);
  for (let i = 0; i < 20; i++) state = applyAction(state, "word");
  assert.ok(state.head < state.text.length);
  assert.equal(applyAction(fixture(""), "word").head, 0);
});
test("real insert text/backspace/normal/undo maintains edit history", () => {
  let state = applyAction(fixture("world"), "insert");
  state = insertText(state, "hi x");
  state = backspace(state);
  state = applyAction(state, "normal");
  assert.equal(state.text, "hi world");
  assert.equal(state.head, 2);
  state = applyAction(state, "undo");
  assert.equal(state.text, "world");
});
test("all original independent goal fixtures remain unchanged", () => {
  const expected = {
    right: ["hello, helix", 2, 2, "normal"],
    left: ["helix", 3, 3, "normal"],
    vertical: ["read\nselect\nedit", 0, 0, "normal"],
    words: ["learn helix today", 11, 6, "normal"],
    select: ["cat nap", 0, 2, "select"],
    "delete-word": [" blue", 0, 0, "normal"],
    cancel: ["focus", 0, 1, "normal"],
    "delete-char": ["hello", 3, 3, "normal"],
    insert: ["hi world", 2, 2, "normal"],
    undo: ["hello!", 5, 5, "normal"],
    combine: ["cot", 1, 1, "normal"],
  };
  for (const lesson of LESSONS.filter((l) => l.id in expected)) {
    const goal = goalFor(lesson);
    assert.deepEqual(
      [goal.text, goal.anchor, goal.head, goal.mode],
      expected[lesson.id],
    );
  }
});
test("required operands wait for input while default-register commands do not", () => {
  for (const command of ["select_regex", "find_next_char", "surround_replace"]) {
    const interaction = commandInteraction(command);
    assert.ok(interaction.fields.some((field) => field.required));
  }
  for (const command of [
    "change_selection", "delete_selection", "yank", "paste_before",
    "paste_after", "replace_with_yanked", "record_macro", "replay_macro",
  ]) {
    assert.equal(commandInteraction(command), null, command);
    const explicit = commandInteraction(command, true);
    assert.ok(explicit.fields.some((field) => field.name === "register"));
    assert.ok(explicit.fields.every((field) => !field.required));
  }
  assert.equal(commandInteraction("select_all"), null);
});

test("default and custom key consumers rename three real selections without a register operand", () => {
  const lesson = LESSONS.find((lesson) => lesson.id === "adv-regex-rename");
  const custom = { ...DEFAULT_BINDINGS };
  custom[bindingId(actionForCommand(custom, "normal", "select_regex"))] = "F6";
  custom[bindingId(actionForCommand(custom, "normal", "change_selection"))] = "F7";
  for (const [configured, regexKey, changeKey] of [
    [DEFAULT_BINDINGS, "s", "c"],
    [custom, "F6", "F7"],
  ]) {
    let state = createState(lesson);
    const press = (key, args = {}) => {
      const resolved = resolveKeyInput(configured, state.mode, [], key);
      assert.equal(resolved.status, "action");
      state = applyAction(state, resolved.action.command, args);
      return resolved.action.command;
    };
    press("%");
    const regex = resolveKeyInput(configured, state.mode, [], regexKey).action;
    assert.equal(commandInteraction(regex.command).fields[0].name, "pattern");
    press(regexKey, { pattern: "cat" });
    assert.deepEqual(state.selections, [
      { anchor: 0, head: 2 }, { anchor: 6, head: 8 }, { anchor: 12, head: 14 },
    ]);
    assert.equal(commandInteraction(press(changeKey)), null);
    assert.equal(state.mode, "insert");
    assert.equal(state.text, " +  = ");
    for (const character of "dog") state = insertText(state, character);
    press("esc");
    assert.equal(state.text, "dog + dog = dog");
    assert.equal(state.mode, "normal");
    assert.deepEqual(state.selections, [
      { anchor: 2, head: 2 }, { anchor: 8, head: 8 }, { anchor: 14, head: 14 },
    ]);
    assert.deepEqual(state.registers['"'], ["cat", "cat", "cat"]);
    assert.equal(matchesGoal(state, goalFor(lesson)), true);
  }
});

test("real wrong regex input is not replaced by the rename lesson's answer", () => {
  const lesson = LESSONS.find((lesson) => lesson.id === "adv-regex-rename");
  let state = applyAction(createState(lesson), "select_all");
  state = applyAction(state, "select_regex", { pattern: "c.t" });
  assert.equal(state.selections.length, 3);
  state = applyAction(state, "select_regex", { pattern: "c" });
  assert.deepEqual(state.selections, [
    { anchor: 0, head: 0 }, { anchor: 6, head: 6 }, { anchor: 12, head: 12 },
  ]);
  state = applyAction(state, "change_selection");
  state = insertText(state, "dog");
  state = applyAction(state, "normal_mode");
  assert.equal(state.text, "dogat + dogat = dogat");
  assert.equal(matchesGoal(state, goalFor(lesson)), false);
});
test("goal comparison rejects fake completion with wrong extra selections or register state", () => {
  const goal = {
    text: "a b",
    anchor: 0,
    head: 0,
    mode: "normal",
    selections: [
      { anchor: 0, head: 0 },
      { anchor: 2, head: 2 },
    ],
    registers: { a: ["a"] },
  };
  assert.equal(matchesGoal({ ...goal }, goal), true);
  assert.equal(
    matchesGoal({ ...goal, selections: [{ anchor: 0, head: 0 }] }, goal),
    false,
  );
  assert.equal(matchesGoal({ ...goal, registers: { a: ["b"] } }, goal), false);
});
test("v1 migration preserves customization and disables newly discovered default collisions", () => {
  const old = {
    "normal.right": "g h",
    "normal.left": "h",
    "insert.normal": "C-h",
  };
  const migrated = migrateBindings(old);
  assert.equal(migrated["normal.right"], "g h");
  assert.equal(validateBindings(migrated).valid, true);
  const store = memory();
  store.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      bindings: old,
      completed: ["right", "unknown"],
    }),
  );
  const saved = loadSaved(store, validateBindings, DEFAULT_BINDINGS);
  assert.equal(saved.bindings["normal.right"], "g h");
  assert.deepEqual(saved.completed, ["right"]);
  assert.match(saved.warning, /迁移/);
});
test("v2 storage preserves full keys and independent knowledge progress", () => {
  const store = memory(),
    custom = bindings({ "normal.right": "F6 h" });
  assert.equal(
    saveState(
      store,
      custom,
      ["right", "right", "unknown"],
      ["command:move_char_right"],
    ),
    true,
  );
  const saved = loadSaved(store, validateBindings, DEFAULT_BINDINGS);
  assert.equal(saved.bindings["normal.right"], "F6 h");
  assert.deepEqual(saved.completed, ["right"]);
  assert.deepEqual(saved.knowledge, ["command:move_char_right"]);
  assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version, 2);
});
test("storage corruption or restrictions never crash application", () => {
  for (const raw of [
    "{",
    "null",
    "{}",
    JSON.stringify({ version: 100, bindings: DEFAULT_BINDINGS, completed: [] }),
  ]) {
    const saved = loadSaved(
      { getItem: () => raw },
      validateBindings,
      DEFAULT_BINDINGS,
    );
    assert.equal(saved.restored, false);
    assert.ok(saved.warning);
  }
  assert.equal(
    saveState(
      {
        setItem() {
          throw new Error("quota");
        },
      },
      DEFAULT_BINDINGS,
      [],
    ),
    false,
  );
});
test("every command and leaf can produce an honest recall question, independent of editor execution", () => {
  for (const c of ALL_COMMANDS) {
    const q = recallQuestion(`command:${c.name}`, DEFAULT_BINDINGS);
    assert.equal(q.command, c.name);
    assert.ok(q.options.some((o) => o.name === c.name));
    assert.equal(q.type, "command");
  }
  for (const a of ACTIONS) {
    const q = recallQuestion(`binding:${bindingId(a)}`, DEFAULT_BINDINGS);
    assert.equal(q.key, a.key);
    assert.equal(q.type, "binding");
  }
  const custom = bindings({ "normal.right": "F6 h" });
  assert.equal(recallQuestion("binding:normal.right", custom).key, "F6 h");
});
test("catalog search includes native typable commands", () => {
  const html = libraryMarkup({
    bindings: DEFAULT_BINDINGS,
    knowledge: [],
    query: "write",
    mode: "",
    group: "",
    kind: "commands",
    page: 0,
  });
  assert.match(html, /:write/);
});
test("all394 commands have Chinese learning meanings and preserved English provenance", () => {
  assert.equal(Object.keys(COMMAND_ZH).length, ALL_COMMANDS.length);
  for (const command of ALL_COMMANDS) {
    assert.match(COMMAND_ZH[command.name], /[\u3400-\u9fff]/);
    assert.ok(command.description);
  }
});
test("native uppercase Alt and Shift normalization never collapses distinct command bindings", () => {
  assert.notEqual(normalizeKey("A-c"), normalizeKey("A-C"));
  assert.equal(normalizeKey("A-S-c"), "A-C");
  assert.equal(
    keyFromEvent(event("C", { altKey: true, shiftKey: true })),
    "A-C",
  );
  assert.equal(normalizeKey("C-S-r"), "C-R");
  assert.equal(normalizeKey("Cmd-c"), "Meta-c");
  assert.equal(normalizeKey("Win-c"), "Meta-c");
  assert.throws(() => normalizeKey("D-c"));
  assert.equal(
    resolveKeyInput(DEFAULT_BINDINGS, "normal", [], "A-c").action.command,
    "change_selection_noyank",
  );
  assert.equal(
    resolveKeyInput(DEFAULT_BINDINGS, "normal", [], "A-C").action.command,
    "copy_selection_on_prev_line",
  );
});
test("macOS Option glyphs resolve to the intended Helix commands instead of Unicode shortcuts", () => {
  for (const [key, code, expected] of [
    ["å", "KeyA", "A-a"],
    ["ß", "KeyS", "A-s"],
    ["∂", "KeyD", "A-d"],
    ["ƒ", "KeyF", "A-f"],
    ["ç", "KeyC", "A-c"],
    ["Dead", "KeyI", "A-i"],
    ["…", "Semicolon", "A-;"],
    ["–", "Minus", "A-minus"],
    ["\u00a0", "Space", "A-space"],
  ]) {
    const actual = keyFromEvent(event(key, { code, altKey: true }), "MacIntel");
    assert.equal(actual, expected);
  }
  const lower = keyFromEvent(event("ç", { code: "KeyC", altKey: true }), "MacIntel");
  const upper = keyFromEvent(event("Ç", { code: "KeyC", altKey: true, shiftKey: true }), "MacIntel");
  assert.equal(resolveKeyInput(DEFAULT_BINDINGS, "normal", [], lower).action.command, "change_selection_noyank");
  assert.equal(resolveKeyInput(DEFAULT_BINDINGS, "normal", [], upper).action.command, "copy_selection_on_prev_line");
  assert.equal(keyFromEvent(event("Ú", { code: "Semicolon", altKey: true, shiftKey: true }), "MacIntel"), "A-:");
  assert.equal(keyFromEvent(event("·", { code: "Digit9", altKey: true, shiftKey: true }), "MacIntel"), "A-(");
});
test("Option recovery leaves ordinary Unicode, non-Mac layouts and ASCII logical keys intact", () => {
  assert.equal(keyFromEvent(event("å", { code: "KeyA" }), "MacIntel"), "å");
  assert.equal(keyFromEvent(event("Dead", { code: "KeyI" }), "MacIntel"), null);
  assert.equal(keyFromEvent(event("é", { code: "KeyE", altKey: true }), "Linux"), "A-é");
  assert.equal(keyFromEvent(event("a", { code: "KeyQ", altKey: true }), "MacIntel"), "A-a");
  assert.equal(keyFromEvent(event("Dead", { code: "IntlYen", altKey: true }), "MacIntel"), null);
  assert.equal(keyFromEvent(event("Å", {
    code: "KeyA", altKey: true, getModifierState: (name) => name === "CapsLock",
  }), "MacIntel"), "A-A");
  assert.equal(keyFromEvent(event("å", {
    code: "KeyA", altKey: true, shiftKey: true, getModifierState: (name) => name === "CapsLock",
  }), "MacIntel"), "A-a");
});
test("old19 select Escape migrates to exit_select_mode without clobbering native v alias", () => {
  const old = { "select.normal": "esc", "normal.right": "l" };
  let migrated = migrateBindings(old);
  assert.equal(
    resolveKeyInput(migrated, "select", [], "esc").action.command,
    "exit_select_mode",
  );
  assert.equal(
    resolveKeyInput(migrated, "select", [], "v").action.command,
    "normal_mode",
  );
  assert.equal(parse(exportToml(migrated)).keys.select.v, "normal_mode");
  migrated = migrateBindings({ ...old, "select.normal": "F6" });
  assert.equal(
    resolveKeyInput(migrated, "select", [], "F6").action.command,
    "exit_select_mode",
  );
  assert.equal(
    resolveKeyInput(migrated, "select", [], "esc").status,
    "unbound",
  );
  assert.equal(
    resolveKeyInput(migrated, "select", [], "v").action.command,
    "normal_mode",
  );
});
test("edited aliases are preferred deterministically for current lesson hints", () => {
  const arrow = ACTIONS.find((a) => a.mode === "normal" && a.key === "right");
  const custom = bindings({ [bindingId(arrow)]: "F6" });
  assert.equal(
    custom[bindingId(actionForCommand(custom, "normal", "right"))],
    "F6",
  );
});
test("custom command sequences and typed arguments export real values; malformed records do not throw", () => {
  let custom = addBinding(
    DEFAULT_BINDINGS,
    "normal",
    '["move_char_right","delete_selection"]',
    "F6",
  );
  custom = addBinding(custom, "normal", ':open "hello world.txt"', "F7");
  const native = parse(exportToml(custom));
  assert.deepEqual(native.keys.normal.F6, [
    "move_char_right",
    "delete_selection",
  ]);
  assert.equal(native.keys.normal.F7, ':open "hello world.txt"');
  assert.equal(
    validateBindings({ ...DEFAULT_BINDINGS, "normal.custom:%ZZ~1": "F6" })
      .valid,
    false,
  );
  assert.throws(() =>
    addBinding(DEFAULT_BINDINGS, "normal", '["invented"]', "F6"),
  );
});

test("advanced challenge replays match independently authored text and full-range goals", () => {
  const advanced = LESSONS.filter((lesson) => lesson.advanced);
  for (const lesson of advanced) {
    let actual = createState(lesson);
    for (const step of lesson.steps) {
      assert.ok(
        step.type === "text" || actual.mode === step.mode,
        `${lesson.id}: recipe mode`,
      );
      actual =
        step.type === "text"
          ? insertText(actual, step.text)
          : applyAction(actual, step.action, step.args);
    }
    assert.equal(
      matchesGoal(actual, lesson.goal),
      true,
      `${lesson.id}: literal goal`,
    );
  }
});
