import test from "node:test";
import assert from "node:assert/strict";
import {
  executeAdvanced,
  advancedInsertText,
  advancedBackspace,
  getSelections,
} from "../src/advanced.js";

// Independent fixtures and literal expectations, deliberately not derived from lesson goals.
const point = (anchor, head = anchor) => ({ anchor, head });
function state(text, selections = [point(0)], primaryIndex = 0) {
  return {
    text,
    mode: "normal",
    selections,
    primaryIndex,
    ...selections[primaryIndex],
    history: [],
    redo: [],
    registers: {},
    macros: {},
    macroRecording: null,
  };
}
const exec = (s, command, args = {}) => executeAdvanced(s, command, args);
const spans = (s) => getSelections(s).map(({ anchor, head }) => [anchor, head]);

test("regex selects actual matches only inside the existing disjoint ranges", () => {
  const before = state("a1 b22 c333", [point(0, 1), point(7, 10)]);
  const after = exec(before, "select_regex", { pattern: "\\d+" });
  assert.equal(after.text, "a1 b22 c333");
  assert.deepEqual(spans(after), [
    [1, 1],
    [8, 10],
  ]);
  assert.deepEqual(spans(before), [
    [0, 1],
    [7, 10],
  ]);
});

test("split drops delimiters from selections without deleting document characters", () => {
  const after = exec(state("a,,bb,c", [point(0, 6)]), "split_selection", {
    pattern: ",",
  });
  assert.equal(after.text, "a,,bb,c");
  assert.deepEqual(spans(after), [
    [0, 0],
    [3, 4],
    [6, 6],
  ]);
});

test("newline splitting ignores empty segments and keeps independent lines", () => {
  const after = exec(
    state("a\n\nb\n", [point(0, 4)]),
    "split_selection_on_newline",
  );
  assert.deepEqual(spans(after), [
    [0, 0],
    [3, 3],
  ]);
  assert.equal(after.text, "a\n\nb\n");
});

test("keep/remove regex filters change selections, not text", () => {
  const before = state("red blue rose", [
    point(0, 2),
    point(4, 7),
    point(9, 12),
  ]);
  assert.deepEqual(spans(exec(before, "keep_selections", { pattern: "^r" })), [
    [0, 2],
    [9, 12],
  ]);
  assert.deepEqual(
    spans(exec(before, "remove_selections", { pattern: "^r" })),
    [[4, 7]],
  );
  assert.equal(before.text, "red blue rose");
});

test("invalid and unsupported regex fail without mutating state", () => {
  const before = state("word", [point(0, 3)]),
    snapshot = structuredClone(before);
  for (const pattern of ["[", "(?=w)", "(w)\\1"])
    assert.throws(() => exec(before, "select_regex", { pattern }));
  assert.deepEqual(before, snapshot);
});

test("multi-selection change and insertion use original offsets then commit one undo transaction", () => {
  const before = state("cat + cat", [point(0, 2), point(6, 8)]);
  let after = exec(before, "change_selection");
  assert.equal(after.text, " + ");
  assert.deepEqual(spans(after), [
    [0, 0],
    [3, 3],
  ]);
  after = advancedInsertText(after, "tiger");
  after = exec(after, "normal_mode");
  assert.equal(after.text, "tiger + tiger");
  assert.deepEqual(spans(after), [
    [4, 4],
    [12, 12],
  ]);
  assert.deepEqual(after.registers['"'], ["cat", "cat"]);
  const undone = exec(after, "undo");
  assert.equal(undone.text, "cat + cat");
  assert.deepEqual(spans(undone), [
    [0, 2],
    [6, 8],
  ]);
  assert.equal(exec(undone, "redo").text, "tiger + tiger");
});

test("multi-cursor backspace does not double-apply shifted offsets", () => {
  let after = exec(state("ab\ncd", [point(1), point(4)]), "append_mode");
  after = advancedInsertText(after, "!");
  assert.equal(after.text, "ab!\ncd!");
  after = advancedBackspace(after);
  assert.equal(after.text, "ab\ncd");
  after = exec(after, "normal_mode");
  assert.deepEqual(spans(after), [
    [1, 1],
    [4, 4],
  ]);
});

test("backspace at buffer start leaves text intact", () => {
  const inserted = exec(state("abc"), "insert_mode");
  assert.equal(advancedBackspace(inserted).text, "abc");
});

test("named registers capture real text and no-yank deletion preserves them", () => {
  let after = exec(state("red blue", [point(0, 2)]), "yank", { register: "a" });
  assert.deepEqual(after.registers.a, ["red"]);
  after = { ...after, selections: [point(4, 7)], anchor: 4, head: 7 };
  after = exec(after, "delete_selection_noyank");
  assert.equal(after.text, "red ");
  assert.deepEqual(after.registers.a, ["red"]);
  assert.equal(after.registers['"'], undefined);
});

test("paste count repeats register content and selects pasted characters", () => {
  const before = { ...state("ab"), registers: { a: ["XY"] } };
  const after = exec(before, "paste_after", { register: "a", count: 2 });
  assert.equal(after.text, "aXYXYb");
  assert.deepEqual(spans(after), [[1, 4]]);
  assert.equal(exec(after, "undo").text, "ab");
});

test("linewise paste inserts after the current line rather than inside the word", () => {
  const before = {
    ...state("one\ntwo", [point(1)]),
    registers: { a: ["X\n"] },
  };
  const after = exec(before, "paste_after", { register: "a" });
  assert.equal(after.text, "one\nX\ntwo");
  assert.deepEqual(spans(after), [[4, 5]]);
});

test("replace with yanked values maps unequal-length edits at each original range", () => {
  const before = {
    ...state("a bb ccc", [point(0), point(2, 3), point(5, 7)]),
    registers: { a: ["XX", "Y", "ZZZZ"] },
  };
  const after = exec(before, "replace_with_yanked", { register: "a" });
  assert.equal(after.text, "XX Y ZZZZ");
  assert.deepEqual(spans(after), [
    [0, 1],
    [3, 3],
    [5, 8],
  ]);
});

test("undo/redo restores primary selection and a new edit clears redo history", () => {
  const before = state("a b", [point(0), point(2)], 1);
  const upper = exec(before, "switch_to_uppercase");
  const undone = exec(upper, "undo");
  assert.equal(undone.text, "a b");
  assert.equal(undone.primaryIndex, 1);
  assert.deepEqual(spans(undone), [
    [0, 0],
    [2, 2],
  ]);
  const branched = exec(undone, "replace", { char: "#" });
  assert.equal(branched.text, "# #");
  assert.equal(exec(branched, "redo").text, "# #");
});

test("counted character find and till differ on delimiter inclusion", () => {
  const before = state("a,b,c,d");
  const found = exec(before, "find_next_char", { char: ",", count: 2 });
  assert.deepEqual(spans(found), [[0, 3]]);
  assert.equal(exec(found, "delete_selection").text, "c,d");
  const till = exec(before, "find_till_char", { char: ",", count: 2 });
  assert.deepEqual(spans(till), [[0, 4]]);
});

test("backward find preserves a reverse selection", () => {
  const after = exec(state("a,b,c", [point(4)]), "find_prev_char", {
    char: ",",
  });
  assert.deepEqual(spans(after), [[4, 3]]);
  assert.equal(exec(after, "delete_selection").text, "a,b");
});

test("counted movement clamps at line boundaries and extension retains anchor", () => {
  assert.deepEqual(
    spans(exec(state("ab\ncd", [point(1)]), "move_char_right", { count: 20 })),
    [[1, 1]],
  );
  assert.deepEqual(
    spans(exec(state("abcd", [point(1)]), "extend_char_right", { count: 2 })),
    [[1, 3]],
  );
  assert.deepEqual(
    spans(exec(state("abcd", [point(2)]), "move_char_left", { count: 99 })),
    [[0, 0]],
  );
});

test("invalid counts and missing characters cannot mutate the caller", () => {
  const before = state("abc"),
    snapshot = structuredClone(before);
  for (const count of [0, -1, 1.5, 10001, Infinity])
    assert.throws(() => exec(before, "move_char_right", { count }));
  assert.throws(() => exec(before, "find_next_char", { char: "ab" }));
  assert.deepEqual(before, snapshot);
});

test("search cycles through real matches, wraps, and supports reverse traversal", () => {
  let after = exec(state("x aa y aa"), "search", { pattern: "aa" });
  assert.deepEqual(spans(after), [[2, 3]]);
  after = exec(after, "search_next");
  assert.deepEqual(spans(after), [[7, 8]]);
  after = exec(after, "search_next");
  assert.deepEqual(spans(after), [[2, 3]]);
  assert.deepEqual(spans(exec(after, "search_prev")), [[7, 8]]);
});

test("extended search adds disjoint matches and changes only the selected occurrences", () => {
  let after = exec(state("x aa aa aa"), "search", { pattern: "aa" });
  after = exec(after, "extend_search_next");
  assert.deepEqual(spans(after), [
    [2, 3],
    [5, 6],
  ]);
  assert.equal(after.primaryIndex, 1);
  assert.equal(exec(after, "switch_to_uppercase").text, "x AA AA aa");
});

test("selection-as-search escapes regex metacharacters", () => {
  const after = exec(state("a.b aXb a.b", [point(0, 2)]), "search_selection");
  assert.equal(after.searchPattern, "a\\.b");
  assert.deepEqual(spans(exec(after, "search_next")), [[8, 10]]);
});

test("nested textobjects honor count and inner versus around boundaries", () => {
  const before = state("(a(b)c)", [point(3)]);
  assert.deepEqual(
    spans(exec(before, "select_textobject_inner", { object: "(" })),
    [[3, 3]],
  );
  assert.deepEqual(
    spans(exec(before, "select_textobject_inner", { object: "(", count: 2 })),
    [[1, 5]],
  );
  assert.deepEqual(
    spans(exec(before, "select_textobject_around", { object: "(", count: 2 })),
    [[0, 6]],
  );
});

test("word versus WORD textobjects distinguish punctuation", () => {
  const before = state("one.two tail", [point(1)]);
  assert.deepEqual(
    spans(exec(before, "select_textobject_inner", { object: "w" })),
    [[0, 2]],
  );
  assert.deepEqual(
    spans(exec(before, "select_textobject_inner", { object: "W" })),
    [[0, 6]],
  );
  assert.deepEqual(
    spans(exec(before, "select_textobject_around", { object: "W" })),
    [[0, 7]],
  );
});

test("surround add edits each selection; replace and delete preserve interior cursor", () => {
  const added = exec(state("a bb", [point(0), point(2, 3)]), "surround_add", {
    char: "[",
  });
  assert.equal(added.text, "[a] [bb]");
  assert.deepEqual(spans(added), [
    [0, 2],
    [4, 7],
  ]);
  let after = exec(state("(hello)", [point(3)]), "surround_replace", {
    object: "(",
    char: "[",
  });
  assert.equal(after.text, "[hello]");
  assert.deepEqual(spans(after), [[3, 3]]);
  after = exec(after, "surround_delete", { object: "[" });
  assert.equal(after.text, "hello");
  assert.deepEqual(spans(after), [[2, 2]]);
});

test("surround delete deduplicates the same pair for multiple interior selections", () => {
  const after = exec(state("(a b)", [point(1), point(3)]), "surround_delete", {
    object: "(",
  });
  assert.equal(after.text, "a b");
  assert.deepEqual(spans(after), [
    [0, 0],
    [2, 2],
  ]);
});

test("missing structural objects fail without modifying text or history", () => {
  const before = state("plain"),
    snapshot = structuredClone(before);
  assert.throws(() => exec(before, "surround_delete", { object: "(" }));
  assert.throws(() => exec(before, "select_textobject_inner", { object: "f" }));
  assert.deepEqual(before, snapshot);
});

test("line selection includes newline so deleting a middle line joins surrounding lines", () => {
  const selected = exec(
    state("top\nmiddle\nend", [point(6)]),
    "extend_line_below",
  );
  assert.deepEqual(spans(selected), [[4, 10]]);
  assert.equal(exec(selected, "delete_selection").text, "top\nend");
});

test("indent affects each touched line once even with two selections on it", () => {
  const before = state("ab\ncd", [point(0), point(1), point(3)]);
  const after = exec(before, "indent", { count: 2 });
  assert.equal(after.text, "    ab\n    cd");
  assert.equal(exec(after, "unindent", { count: 2 }).text, "ab\ncd");
});

test("join strips following indentation and exposes inserted spaces as selections", () => {
  const after = exec(
    state("a\n  bb\n c", [point(0, 8)]),
    "join_selections_space",
  );
  assert.equal(after.text, "a bb c");
  assert.deepEqual(spans(after), [
    [1, 1],
    [4, 4],
  ]);
});

test("rotating primary and rotating unequal content are distinct operations", () => {
  const before = state("a bb ccc", [point(0), point(2, 3), point(5, 7)]);
  const primary = exec(before, "rotate_selections_forward");
  assert.equal(primary.text, "a bb ccc");
  assert.equal(primary.primaryIndex, 1);
  assert.deepEqual(spans(exec(primary, "keep_primary_selection")), [[2, 3]]);
  const content = exec(before, "rotate_selection_contents_forward");
  assert.equal(content.text, "ccc a bb");
  assert.deepEqual(spans(content), [
    [0, 2],
    [4, 4],
    [6, 7],
  ]);
});

test("selection flip, collapse and consecutive merge have concrete range effects", () => {
  const before = state("abcdef", [point(0, 1), point(2, 3), point(5)]);
  assert.deepEqual(spans(exec(before, "flip_selections")), [
    [1, 0],
    [3, 2],
    [5, 5],
  ]);
  assert.deepEqual(spans(exec(before, "collapse_selection")), [
    [1, 1],
    [3, 3],
    [5, 5],
  ]);
  assert.deepEqual(spans(exec(before, "merge_consecutive_selections")), [
    [0, 3],
    [5, 5],
  ]);
});

test("recorded macro re-evaluates actual current words and count repeats events", () => {
  let after = exec(state("red\nblue\ngreen"), "record_macro", {
    register: "q",
  });
  after = exec(after, "select_textobject_inner", { object: "w" });
  after = exec(after, "switch_to_uppercase");
  after = exec(after, "move_visual_line_down");
  after = exec(after, "record_macro", { register: "q" });
  assert.equal(after.text, "RED\nblue\ngreen");
  assert.equal(after.macros.q.length, 3);
  after = exec(after, "replay_macro", { register: "q", count: 2 });
  assert.equal(after.text, "RED\nBLUE\nGREEN");
  assert.equal(after.macroRecording, null);
});

test("macro records inserted text and backspace rather than final buffer snapshots", () => {
  let after = exec(state("ab"), "record_macro", { register: "q" });
  after = exec(after, "insert_mode");
  after = advancedInsertText(after, "XY");
  after = advancedBackspace(after);
  after = exec(after, "normal_mode");
  after = exec(after, "record_macro", { register: "q" });
  assert.equal(after.text, "Xab");
  after = exec(after, "goto_line_end");
  after = exec(after, "replay_macro", { register: "q" });
  assert.equal(after.text, "XaXb");
});

test("missing and recursively self-invoking macros fail without changing input", () => {
  const before = state("abc");
  assert.throws(() => exec(before, "replay_macro", { register: "q" }));
  const recursive = {
    ...before,
    macros: { q: [{ command: "replay_macro", args: { register: "q" } }] },
  };
  assert.throws(
    () => exec(recursive, "replay_macro", { register: "q" }),
    /递归/,
  );
  assert.equal(recursive.text, "abc");
});

test("leading empty line can be selected and extended without skipping its newline", () => {
  // commands.rs:2706–2720: a one-character newline selection is already the
  // complete empty line, so x extends to the following line immediately.
  assert.deepEqual(spans(exec(state("\na\nb"), "extend_line_below")), [[0, 2]]);
  const first = exec(state("\na\nb"), "extend_to_line_bounds");
  assert.deepEqual(spans(first), [[0, 0]]);
  const second = exec(first, "extend_line_below");
  assert.deepEqual(spans(second), [[0, 2]]);
  assert.equal(exec(second, "delete_selection").text, "b");
});

test("backward line extension includes the previous complete line", () => {
  const after = exec(state("a\nbb\nccc", [point(3)]), "extend_line_above", {
    count: 2,
  });
  assert.deepEqual(spans(after), [[4, 0]]);
  assert.equal(exec(after, "delete_selection").text, "ccc");
});

test("terminal deletion retains virtual EOF insertion position, matching native hx", () => {
  const deleted = exec(state("abc", [point(2)]), "delete_selection");
  assert.equal(deleted.text, "ab");
  assert.deepEqual(spans(deleted), [[2, 2]]);
  const inserted = advancedInsertText(exec(deleted, "insert_mode"), "!");
  assert.equal(inserted.text, "ab!");
});

test("a valid but wrong regex operand performs its own edit, never substitutes lesson answer", () => {
  const selected = exec(
    state("cat + cat = cat", [point(0, 14)]),
    "select_regex",
    { pattern: "a" },
  );
  assert.deepEqual(spans(selected), [
    [1, 1],
    [7, 7],
    [13, 13],
  ]);
  const changed = advancedInsertText(exec(selected, "change_selection"), "dog");
  assert.equal(changed.text, "cdogt + cdogt = cdogt");
  assert.notEqual(changed.text, "dog + dog = dog");
});
