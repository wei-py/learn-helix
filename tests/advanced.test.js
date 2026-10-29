import assert from "node:assert/strict";
import test from "node:test";

import { advancedBackspace,
advancedInsertText,
executeAdvanced,
getSelections, } from "../src/domain/advanced.js"

// 使用独立夹具和字面量预期值，刻意不从课程目标推导测试答案。
/** 构造保留方向的独立字面选区。
 * @type {(arg0: number, arg1: number) => import('../src/domain/types.js').Selection}
 * @param {number} anchor - 选区固定端的包含式偏移。
 * @param {number} [head] - 选区光标端的包含式偏移。
 * @returns {import('../src/domain/types.js').Selection} 返回该操作的实际计算结果。
 */
const point = (anchor, head = anchor) => ({ anchor, head });
/** 构造独立高级状态，不从课程目标推导预期值。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {import('../src/domain/types.js').Selection[]} [selections] - 本次操作采用的有序选区集合。
 * @param {number} [primaryIndex] - 需要保留的主选区索引。
 * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
 */
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
/** 用实际高级引擎执行测试命令。
 * @type {(arg0: import('../src/domain/types.js').EditorState, arg1: string, arg2: import('../src/domain/types.js').CommandArgs) => import('../src/domain/types.js').EditorState}
 * @param {import('../src/domain/types.js').EditorState} s - 逐步执行中的真实编辑状态。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {import('../src/domain/types.js').CommandArgs} [args] - 实际交给命令引擎执行的参数。
 * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
 */
const exec = (s, command, args = {}) => executeAdvanced(s, command, args);
/** 提取可直接比较的选区偏移。
 * @type {(arg0: import('../src/domain/types.js').EditorState) => number[][]}
 * @param {import('../src/domain/types.js').EditorState} s - 逐步执行中的真实编辑状态。
 * @returns {number[][]} 返回该操作的实际计算结果。
 */
const spans = (s) => getSelections(s).map(/** 将 getSelections(s) 中的记录转换为本次操作需要的结果。
 * @param {import('../src/domain/types.js').Selection} options - 本次操作的完整参数。
 * @returns {number[]} 返回该操作的实际计算结果。
 */
({ anchor, head }) => [anchor, head]);

test("regex selects actual matches only inside the existing disjoint ranges", /** 验证正则只选择既有不相交范围内部的实际匹配内容。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("a1 b22 c333", [point(0, 1), point(7, 10)]);
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("split drops delimiters from selections without deleting document characters", /** 验证分割只改变选择集合，不删除文档中的分隔字符。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("newline splitting ignores empty segments and keeps independent lines", /** 验证换行分割忽略空片段并保留各独立文本行。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("keep/remove regex filters change selections, not text", /** 验证保留或移除正则匹配仅改变选区而不改变文字。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("invalid and unsupported regex fail without mutating state", /** 验证非法或不支持的正则失败时不修改调用者状态。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("word", [point(0, 3)]);
    /** 用于保证调用者未被修改的独立快照。
     * @type {import('../src/domain/types.js').EditorState}
     */
    const snapshot = structuredClone(before);
  /** 实际输入并用于匹配的正则表达式。
   * @type {string}
   */
  for (const pattern of ["[", "(?=w)", "(w)\\1"])
    assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
     * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
     */
    () => exec(before, "select_regex", { pattern }));
  assert.deepEqual(before, snapshot);
});

test("multi-selection change and insertion use original offsets then commit one undo transaction", /** 验证多选区修改使用原始偏移，并作为一个完整事务撤销。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("cat + cat", [point(0, 2), point(6, 8)]);
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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
  /** 通过真实撤销恢复的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const undone = exec(after, "undo");
  assert.equal(undone.text, "cat + cat");
  assert.deepEqual(spans(undone), [
    [0, 2],
    [6, 8],
  ]);
  assert.equal(exec(undone, "redo").text, "tiger + tiger");
});

test("multi-cursor backspace does not double-apply shifted offsets", /** 验证多光标退格不会重复计算先前删除造成的位置偏移。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("backspace at buffer start leaves text intact", /** 验证缓冲区开头退格不会删除或改变原有文字。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 通过实际输入得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const inserted = exec(state("abc"), "insert_mode");
  assert.equal(advancedBackspace(inserted).text, "abc");
});

test("named registers capture real text and no-yank deletion preserves them", /** 验证命名寄存器记录真实文字且无复制删除保留寄存器内容。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let after = exec(state("red blue", [point(0, 2)]), "yank", { register: "a" });
  assert.deepEqual(after.registers.a, ["red"]);
  after = { ...after, selections: [point(4, 7)], anchor: 4, head: 7 };
  after = exec(after, "delete_selection_noyank");
  assert.equal(after.text, "red ");
  assert.deepEqual(after.registers.a, ["red"]);
  assert.equal(after.registers['"'], undefined);
});

test("paste count repeats register content and selects pasted characters", /** 验证粘贴计数重复真实寄存器内容并选择实际插入字符。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {{ registers: { a: string[]; }; text: string; anchor: number; head: number; mode: import('../src/domain/types.js').Mode; wordBoundary?: number | null; goalColumn?: number | null; selections?: import('../src/domain/types.js').Selection[]; primaryIndex?: number; goalColumns?: (number | null)[]; history: import('../src/domain/types.js').EditorSnapshot[]; advanced?: boolean; redo?: import('../src/domain/types.js').EditorSnapshot[]; macros?: Record<string, import('../src/domain/types.js').MacroEvent[]>; macroRecording?: { register: string; events: import('../src/domain/types.js').MacroEvent[]; } | null; macroStack?: string[]; searchPattern?: string; lastMotion?: { command: string; args: import('../src/domain/types.js').CommandArgs; }; indentWidth?: number; }}
   */
  const before = { ...state("ab"), registers: { a: ["XY"] } };
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(before, "paste_after", { register: "a", count: 2 });
  assert.equal(after.text, "aXYXYb");
  assert.deepEqual(spans(after), [[1, 4]]);
  assert.equal(exec(after, "undo").text, "ab");
});

test("linewise paste inserts after the current line rather than inside the word", /** 验证整行粘贴落在当前行之后，而不是当前单词内部。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {{ registers: { a: string[]; }; text: string; anchor: number; head: number; mode: import('../src/domain/types.js').Mode; wordBoundary?: number | null; goalColumn?: number | null; selections?: import('../src/domain/types.js').Selection[]; primaryIndex?: number; goalColumns?: (number | null)[]; history: import('../src/domain/types.js').EditorSnapshot[]; advanced?: boolean; redo?: import('../src/domain/types.js').EditorSnapshot[]; macros?: Record<string, import('../src/domain/types.js').MacroEvent[]>; macroRecording?: { register: string; events: import('../src/domain/types.js').MacroEvent[]; } | null; macroStack?: string[]; searchPattern?: string; lastMotion?: { command: string; args: import('../src/domain/types.js').CommandArgs; }; indentWidth?: number; }}
   */
  const before = {
    ...state("one\ntwo", [point(1)]),
    registers: { a: ["X\n"] },
  };
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(before, "paste_after", { register: "a" });
  assert.equal(after.text, "one\nX\ntwo");
  assert.deepEqual(spans(after), [[4, 5]]);
});

test("replace with yanked values maps unequal-length edits at each original range", /** 验证不等长寄存器替换基于各选区的原始范围计算偏移。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {{ registers: { a: string[]; }; text: string; anchor: number; head: number; mode: import('../src/domain/types.js').Mode; wordBoundary?: number | null; goalColumn?: number | null; selections?: import('../src/domain/types.js').Selection[]; primaryIndex?: number; goalColumns?: (number | null)[]; history: import('../src/domain/types.js').EditorSnapshot[]; advanced?: boolean; redo?: import('../src/domain/types.js').EditorSnapshot[]; macros?: Record<string, import('../src/domain/types.js').MacroEvent[]>; macroRecording?: { register: string; events: import('../src/domain/types.js').MacroEvent[]; } | null; macroStack?: string[]; searchPattern?: string; lastMotion?: { command: string; args: import('../src/domain/types.js').CommandArgs; }; indentWidth?: number; }}
   */
  const before = {
    ...state("a bb ccc", [point(0), point(2, 3), point(5, 7)]),
    registers: { a: ["XX", "Y", "ZZZZ"] },
  };
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(before, "replace_with_yanked", { register: "a" });
  assert.equal(after.text, "XX Y ZZZZ");
  assert.deepEqual(spans(after), [
    [0, 1],
    [3, 3],
    [5, 8],
  ]);
});

test("undo/redo restores primary selection and a new edit clears redo history", /** 验证撤销与重做恢复主选区，分支编辑会清空旧重做历史。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("a b", [point(0), point(2)], 1);
  /** 物理位置恢复是否应采用大写字符。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const upper = exec(before, "switch_to_uppercase");
  /** 通过真实撤销恢复的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const undone = exec(upper, "undo");
  assert.equal(undone.text, "a b");
  assert.equal(undone.primaryIndex, 1);
  assert.deepEqual(spans(undone), [
    [0, 0],
    [2, 2],
  ]);
  /** 撤销后重新编辑形成的新历史分支。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const branched = exec(undone, "replace", { char: "#" });
  assert.equal(branched.text, "# #");
  assert.equal(exec(branched, "redo").text, "# #");
});

test("counted character find and till differ on delimiter inclusion", /** 验证带计数的字符查找与截止查找对目标分隔符的包含规则不同。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("a,b,c,d");
  /** 按包围跨度排序的候选边界。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const found = exec(before, "find_next_char", { char: ",", count: 2 });
  assert.deepEqual(spans(found), [[0, 3]]);
  assert.equal(exec(found, "delete_selection").text, "c,d");
  /** 是否在目标字符前停止选择。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const till = exec(before, "find_till_char", { char: ",", count: 2 });
  assert.deepEqual(spans(till), [[0, 4]]);
});

test("backward find preserves a reverse selection", /** 验证反向字符查找保留真实的反向选区。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(state("a,b,c", [point(4)]), "find_prev_char", {
    char: ",",
  });
  assert.deepEqual(spans(after), [[4, 3]]);
  assert.equal(exec(after, "delete_selection").text, "a,b");
});

test("counted movement clamps at line boundaries and extension retains anchor", /** 验证带计数的移动受行边界限制，扩展操作保留锚点。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
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

test("invalid counts and missing characters cannot mutate the caller", /** 验证非法计数与缺失字符参数不能修改调用者状态。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("abc");
    /** 用于保证调用者未被修改的独立快照。
     * @type {import('../src/domain/types.js').EditorState}
     */
    const snapshot = structuredClone(before);
  /** 本次命令的有效重复次数。
   * @type {number}
   */
  for (const count of [0, -1, 1.5, 10001, Infinity])
    assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
     * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
     */
    () => exec(before, "move_char_right", { count }));
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
   */
  () => exec(before, "find_next_char", { char: "ab" }));
  assert.deepEqual(before, snapshot);
});

test("search cycles through real matches, wraps, and supports reverse traversal", /** 验证搜索沿真实匹配循环，并支持反向遍历和末尾回绕。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let after = exec(state("x aa y aa"), "search", { pattern: "aa" });
  assert.deepEqual(spans(after), [[2, 3]]);
  after = exec(after, "search_next");
  assert.deepEqual(spans(after), [[7, 8]]);
  after = exec(after, "search_next");
  assert.deepEqual(spans(after), [[2, 3]]);
  assert.deepEqual(spans(exec(after, "search_prev")), [[7, 8]]);
});

test("extended search adds disjoint matches and changes only the selected occurrences", /** 验证扩展搜索只增加不相交匹配并仅修改选中的实际出现位置。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let after = exec(state("x aa aa aa"), "search", { pattern: "aa" });
  after = exec(after, "extend_search_next");
  assert.deepEqual(spans(after), [
    [2, 3],
    [5, 6],
  ]);
  assert.equal(after.primaryIndex, 1);
  assert.equal(exec(after, "switch_to_uppercase").text, "x AA AA aa");
});

test("selection-as-search escapes regex metacharacters", /** 验证将选区用作搜索时正确转义正则元字符。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(state("a.b aXb a.b", [point(0, 2)]), "search_selection");
  assert.equal(after.searchPattern, "a\\.b");
  assert.deepEqual(spans(exec(after, "search_next")), [[8, 10]]);
});

test("nested textobjects honor count and inner versus around boundaries", /** 验证嵌套文本对象遵循层级计数，并区分内部与外围边界。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("word versus WORD textobjects distinguish punctuation", /** 验证单词与空白分隔词文本对象对标点的处理不同。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("surround add edits each selection; replace and delete preserve interior cursor", /** 验证添加包围分别修改各选区，替换和删除保留内部光标。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 实际添加包围符后的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const added = exec(state("a bb", [point(0), point(2, 3)]), "surround_add", {
    char: "[",
  });
  assert.equal(added.text, "[a] [bb]");
  assert.deepEqual(spans(added), [
    [0, 2],
    [4, 7],
  ]);
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("surround delete deduplicates the same pair for multiple interior selections", /** 验证多个内部选区指向同一包围对时不会重复删除符号。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(state("(a b)", [point(1), point(3)]), "surround_delete", {
    object: "(",
  });
  assert.equal(after.text, "a b");
  assert.deepEqual(spans(after), [
    [0, 0],
    [2, 2],
  ]);
});

test("missing structural objects fail without modifying text or history", /** 验证找不到结构对象时不修改原文本或撤销历史。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("plain");
    /** 用于保证调用者未被修改的独立快照。
     * @type {import('../src/domain/types.js').EditorState}
     */
    const snapshot = structuredClone(before);
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
   */
  () => exec(before, "surround_delete", { object: "(" }));
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
   */
  () => exec(before, "select_textobject_inner", { object: "f" }));
  assert.deepEqual(before, snapshot);
});

test("line selection includes newline so deleting a middle line joins surrounding lines", /** 验证整行选择包含换行，删除中间行会连接前后文本。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实选择命令得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const selected = exec(
    state("top\nmiddle\nend", [point(6)]),
    "extend_line_below",
  );
  assert.deepEqual(spans(selected), [[4, 10]]);
  assert.equal(exec(selected, "delete_selection").text, "top\nend");
});

test("indent affects each touched line once even with two selections on it", /** 验证同一行包含多个选区时只缩进一次。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("ab\ncd", [point(0), point(1), point(3)]);
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(before, "indent", { count: 2 });
  assert.equal(after.text, "    ab\n    cd");
  assert.equal(exec(after, "unindent", { count: 2 }).text, "ab\ncd");
});

test("join strips following indentation and exposes inserted spaces as selections", /** 验证连接行会移除后续缩进并把插入空格暴露为真实选区。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("rotating primary and rotating unequal content are distinct operations", /** 验证轮换主选区与轮换不等长文本内容是不同操作。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("a bb ccc", [point(0), point(2, 3), point(5, 7)]);
  /** 当前主选区记录。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const primary = exec(before, "rotate_selections_forward");
  assert.equal(primary.text, "a bb ccc");
  assert.equal(primary.primaryIndex, 1);
  assert.deepEqual(spans(exec(primary, "keep_primary_selection")), [[2, 3]]);
  /** 当前行去除行边界后的实际文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const content = exec(before, "rotate_selection_contents_forward");
  assert.equal(content.text, "ccc a bb");
  assert.deepEqual(spans(content), [
    [0, 2],
    [4, 4],
    [6, 7],
  ]);
});

test("selection flip, collapse and consecutive merge have concrete range effects", /** 验证翻转、折叠与合并连续选区产生精确的实际范围。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("recorded macro re-evaluates actual current words and count repeats events", /** 验证宏按当前实际文字重新执行事件，计数重复事件而非快照。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("macro records inserted text and backspace rather than final buffer snapshots", /** 验证宏记录实际插入与退格事件，而不是最终缓冲区结果。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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

test("missing and recursively self-invoking macros fail without changing input", /** 验证缺失与递归宏失败时保持输入状态不变。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 操作前用于独立比较的状态或文本。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const before = state("abc");
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
   */
  () => exec(before, "replay_macro", { register: "q" }));
  /** 包含递归宏事件的独立失败用例。
   * @type {{ macros: { q: { command: string; args: { register: string; }; }[]; }; text: string; anchor: number; head: number; mode: import('../src/domain/types.js').Mode; wordBoundary?: number | null; goalColumn?: number | null; selections?: import('../src/domain/types.js').Selection[]; primaryIndex?: number; goalColumns?: (number | null)[]; history: import('../src/domain/types.js').EditorSnapshot[]; advanced?: boolean; redo?: import('../src/domain/types.js').EditorSnapshot[]; registers?: Record<string, string[]>; macroRecording?: { register: string; events: import('../src/domain/types.js').MacroEvent[]; } | null; macroStack?: string[]; searchPattern?: string; lastMotion?: { command: string; args: import('../src/domain/types.js').CommandArgs; }; indentWidth?: number; }}
   */
  const recursive = {
    ...before,
    macros: { q: [{ command: "replay_macro", args: { register: "q" } }] },
  };
  assert.throws(
    /** 调用实际失败路径并断言异常，不替换真实实现。
     * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
     */
    () => exec(recursive, "replay_macro", { register: "q" }),
    /递归/,
  );
  assert.equal(recursive.text, "abc");
});

test("leading empty line can be selected and extended without skipping its newline", /** 验证开头空行可以被选择和扩展，不能跳过其换行符。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  // commands.rs:2706–2720：单个换行符选区已经覆盖完整空行，
  // 因而 x 会直接扩展到下一行。
  assert.deepEqual(spans(exec(state("\na\nb"), "extend_line_below")), [[0, 2]]);
  /** 当前范围覆盖的第一条记录。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const first = exec(state("\na\nb"), "extend_to_line_bounds");
  assert.deepEqual(spans(first), [[0, 0]]);
  /** 独立用例中的第二条记录。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const second = exec(first, "extend_line_below");
  assert.deepEqual(spans(second), [[0, 2]]);
  assert.equal(exec(second, "delete_selection").text, "b");
});

test("backward line extension includes the previous complete line", /** 验证反向行扩展包含前一完整行的字符与换行。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实操作后用于独立比较的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const after = exec(state("a\nbb\nccc", [point(3)]), "extend_line_above", {
    count: 2,
  });
  assert.deepEqual(spans(after), [[4, 0]]);
  assert.equal(exec(after, "delete_selection").text, "ccc");
});

test("terminal deletion retains virtual EOF insertion position, matching native hx", /** 验证末尾删除保留与原生编辑器一致的虚拟文件末尾插入位置。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 通过真实删除得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const deleted = exec(state("abc", [point(2)]), "delete_selection");
  assert.equal(deleted.text, "ab");
  assert.deepEqual(spans(deleted), [[2, 2]]);
  /** 通过实际输入得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const inserted = advancedInsertText(exec(deleted, "insert_mode"), "!");
  assert.equal(inserted.text, "ab!");
});

test("a valid but wrong regex operand performs its own edit, never substitutes lesson answer", /** 验证合法但错误的正则参数执行自身编辑，不能替换成课程答案。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 真实选择命令得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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
  /** 通过实际修改得到的编辑状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const changed = advancedInsertText(exec(selected, "change_selection"), "dog");
  assert.equal(changed.text, "cdogt + cdogt = cdogt");
  assert.notEqual(changed.text, "dog + dog = dog");
});
