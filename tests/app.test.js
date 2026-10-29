import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "smol-toml";

import { commandInteraction } from "../src/domain/advanced.js"
import { actionForCommand,
ACTIONS,
actionsFor,
addBinding,
ALL_COMMANDS,
bindingId,
DEFAULT_BINDINGS,
exportToml,
keyFromEvent,
migrateBindings,
normalizeKey,
parseSequence,
resolveKeyInput,
validateBindings, } from "../src/domain/bindings.js"
import { COMMAND_ZH } from "../src/domain/catalog-zh.js"
import { CATALOG_META,
COMMANDS,
DEFAULT_KEYMAP,
TYPABLE_COMMANDS, } from "../src/domain/catalog.js"
import { applyAction,
backspace,
createState,
goalFor,
insertText,
LESSONS,
loadSaved,
matchesGoal,
saveState,
selection,
STORAGE_KEY, } from "../src/domain/engine.js"
import { recallQuestion } from "../src/domain/recall.js"
/** 从字面文本建立独立基础编辑状态。
 * @type {(arg0: string, arg1: number) => import('../src/domain/types.js').EditorState}
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} [cursor] - 初始光标的 UTF-16 偏移。
 * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
 */
const fixture = (text, cursor = 0) => createState({ text, cursor });
/** 按顺序执行真实基础动作。
 * @type {(arg0: import('../src/domain/types.js').EditorState, arg1: string[]) => import('../src/domain/types.js').EditorState}
 * @param {import('../src/domain/types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @param {string[]} actions - 当前配置实际可用的动作集合。
 * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
 */
const run = (state, actions) =>
  actions.reduce(/** 依次累积 actions 中的实际操作结果。
   * @param {import('../src/domain/types.js').EditorState} s - 逐步执行中的真实编辑状态。
   * @param {string} a - 当前比较或处理的动作记录。
   * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
   */
  (s, a) => applyAction(s, a), state);
/** 在完整默认键位上叠加测试自定义配置。
 * @type {(arg0: import('../src/domain/types.js').Bindings) => import('../src/domain/types.js').Bindings}
 * @param {import('../src/domain/types.js').Bindings} [patch] - 覆盖默认配置的明确自定义键位。
 * @returns {import('../src/domain/types.js').Bindings} 返回该操作的实际计算结果。
 */
const bindings = (patch = {}) => ({ ...DEFAULT_BINDINGS, ...patch });
/** 构造具有明确修饰键的键盘事件记录。
 * @type {(arg0: string, arg1: Partial<import('../src/domain/types.js').KeyEvent>) => import('../src/domain/types.js').KeyEvent}
 * @param {string} key - 当前按键或配置键名。
 * @param {Partial<import('../src/domain/types.js').KeyEvent>} [mods] - 该事件实际按下的修饰键。
 * @returns {import('../src/domain/types.js').KeyEvent} 返回该操作的实际计算结果。
 */
const event = (key, mods = {}) => ({
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});
/** 沿导出的 TOML 树定位实际命令叶节点。
 * @type {(arg0: import('./types.js').TomlFixture, arg1: import('../src/domain/types.js').Mode, arg2: string[]) => string | string[] | import('./types.js').TomlFixture | undefined}
 * @param {import('./types.js').TomlFixture} tree - 由实际导出 TOML 解析得到的配置树。
 * @param {import('../src/domain/types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string[]} keys - 需要沿配置树查找的原始按键序列。
 * @returns {string | string[] | import('./types.js').TomlFixture | undefined} 返回该操作的实际计算结果。
 */
const leaf = (tree, mode, keys) =>
  keys.reduce(/** 依次累积 keys 中的实际操作结果。
   * @param {import('./types.js').TomlFixture | undefined} node - 当前遍历到的命令前缀树节点。
   * @param {string} key - 当前按键或配置键名。
   * @returns {string | string[] | import('./types.js').TomlFixture | undefined} 返回该操作的实际计算结果。
   */
  (node, key) => node?.[key], tree.keys[mode]);
/** 建立与本地存储接口兼容的独立内存记录。
 * @type {() => import('./types.js').MemoryStorage}
 * @returns {import('./types.js').MemoryStorage} 返回该操作的实际计算结果。
 */
const memory = () => {
  /** 测试使用的键值内存存储。
   * @type {Map<string, string>}
   */
  const map = new Map();
  return {
    map,
    getItem: /** 实现 getItem 所要求的真实存储操作。
     * @param {string} key - 当前按键或配置键名。
     * @returns {string | null} 返回该操作的实际计算结果。
     */
    (key) => map.get(key) || null,
    setItem: /** 实现 setItem 所要求的真实存储操作。
     * @param {string} key - 当前按键或配置键名。
     * @param {string} value - 本次实际输入、读取或比较的值。
     * @returns {Map<string, string>} 返回该操作的实际计算结果。
     */
    (key, value) => map.set(key, value),
  };
};

test("catalog contains every pinned official leaf and unique command registry", /** 验证固定版本的完整官方叶节点、模式分布和命令注册数量。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  assert.equal(DEFAULT_KEYMAP.length, 671);
  assert.deepEqual(
    Object.fromEntries(
      ["normal", "select", "insert"].map(/** 将 ["normal", "select", "insert"] 中的记录转换为本次操作需要的结果。
       * @param {string} mode - 当前按键配置所属的编辑模式。
       * @returns {[string, number]} 返回该操作的实际计算结果。
       */
      (mode) => [
        mode,
        ACTIONS.filter(/** 依据实际条件筛选 ACTIONS 中的有效记录。
         * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
         * @returns {boolean} 返回该操作的实际计算结果。
         */
        (a) => a.mode === mode).length,
      ]),
    ),
    { normal: 322, select: 322, insert: 27 },
  );
  assert.equal(COMMANDS.length, 305);
  assert.equal(TYPABLE_COMMANDS.length, 89);
  assert.equal(ALL_COMMANDS.length, 394);
  assert.equal(
    new Set(ALL_COMMANDS.map(/** 将 ALL_COMMANDS 中的记录转换为本次操作需要的结果。
     * @param {import('../src/domain/types.js').CatalogCommand} c - 当前遍历的官方命令记录。
     * @returns {string} 返回该操作的实际计算结果。
     */
    (c) => c.name)).size,
    ALL_COMMANDS.length,
  );
  assert.equal(CATALOG_META.counts.bindings, ACTIONS.length);
  assert.equal(new Set(ACTIONS.map(bindingId)).size, ACTIONS.length);
  assert.equal(validateBindings(DEFAULT_BINDINGS).valid, true);
  /** 本次垂直移动到达的行号。
   * @type {import('../src/domain/types.js').KeymapRow}
   */
  for (const row of DEFAULT_KEYMAP)
    assert.ok(
      COMMANDS.some(/** 检查 COMMANDS 是否满足当前操作的完整条件。
       * @param {import('../src/domain/types.js').CatalogCommand} c - 当前遍历的官方命令记录。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (c) => c.name === row.command),
      row.command,
    );
});
test("all official leaves including nested prefixes export exact command values", /** 验证包含深层前缀的全部键位都导出精确的原生命令值。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 由实际导出 TOML 解析得到的配置树。
   * @type {TomlTable}
   */
  const tree = parse(exportToml(DEFAULT_BINDINGS));
  /** 本次垂直移动到达的行号。
   * @type {import('../src/domain/types.js').KeymapRow}
   */
  for (const row of DEFAULT_KEYMAP)
    assert.deepEqual(
      leaf(tree, row.mode, row.keys),
      row.command,
      `${row.mode} ${row.key}`,
    );
  assert.equal(tree.keys.select.h, "extend_char_left");
  assert.equal(tree.keys.normal.j, "move_visual_line_down");
});
test("Helix key grammar supports complete prefix depth, modifiers and function keys", /** 验证完整按键深度、修饰键与功能键使用同一 Helix 语法。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {(string | import('../src/domain/types.js').KeyEvent)[]}
   */
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
  /** 当前按键或配置键名。
   * @type {string}
   */
  for (const key of ["hyper", "C-C-h", "中文", "F25"])
    assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
     * @returns {string[]} 返回该操作的实际计算结果。
     */
    () => parseSequence(key), undefined, key);
  assert.equal(keyFromEvent(event("Dead")), null);
  /** 本次垂直移动到达的行号。
   * @type {import('../src/domain/types.js').KeymapRow}
   */
  for (const row of DEFAULT_KEYMAP)
    assert.equal(parseSequence(row.key).join(" "), row.key, row.key);
});
test("removed bindings are valid and conflicts cover all official prefixes and aliases", /** 验证空绑定合法，并检测全部官方前缀及别名之间的冲突。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  assert.equal(validateBindings(bindings({ "normal.right": "" })).valid, true);
  /** 实际解析或执行得到的结果。
   * @type {import('../src/domain/types.js').BindingValidation}
   */
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
  ); // 冲突来自现有的真实 Tab 绑定，而不是浏览器限制。
});
test("one current mapping powers remapped matcher, hints and native TOML; former key disabled", /** 验证匹配、课程提示和原生配置统一使用当前重映射结果。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const custom = bindings({ "normal.right": "F6 h" });
  assert.equal(resolveKeyInput(custom, "normal", [], "l").status, "unbound");
  /** 本次按键前尚未完成的配置序列。
   * @type {import('../src/domain/types.js').KeyResolution}
   */
  const prefix = resolveKeyInput(custom, "normal", [], "F6");
  assert.equal(prefix.status, "prefix");
  /** 在原文本中查得的实际匹配选区。
   * @type {import('../src/domain/types.js').KeyResolution}
   */
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
  /** 实际导出后重新解析的原生 Helix 配置。
   * @type {TomlTable}
   */
  const native = parse(exportToml(custom));
  assert.equal(native.keys.normal.F6.h, "move_char_right");
  assert.equal(native.keys.normal.l, "no_op");
});
test("all catalog static and typable commands can receive custom aliases and be removed", /** 验证全部静态与可输入命令都支持新增和移除自定义别名。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  let custom = addBinding(DEFAULT_BINDINGS, "normal", "select_regex", "F6 a");
  custom = addBinding(custom, "insert", ":write", "F7");
  /** 从当前配置解析出的正则选择动作。
   * @type {import('../src/domain/types.js').BindingAction | undefined}
   */
  const regex = actionsFor(custom).find(
    /** 在 actionsFor(custom) 中定位符合当前条件的真实记录。
     * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.id.startsWith("custom:") && a.command === "select_regex",
  );
  assert.equal(
    resolveKeyInput(custom, "normal", ["F6"], "a").action.command,
    "select_regex",
  );
  assert.equal(validateBindings(custom).valid, true);
  /** 实际导出后重新解析的原生 Helix 配置。
   * @type {TomlTable}
   */
  const native = parse(exportToml(custom));
  assert.equal(native.keys.normal.F6.a, "select_regex");
  assert.equal(native.keys.insert.F7, ":write");
  custom[bindingId(regex)] = "";
  assert.equal(
    resolveKeyInput(custom, "normal", ["F6"], "a").status,
    "unbound",
  );
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').Bindings} 返回该操作的实际计算结果。
   */
  () => addBinding(custom, "normal", "invented_command", "F9"));
});
test("export handles punctuation escaping and replacing a former prefix with a leaf", /** 验证原生配置转义标点并正确处理前缀与叶节点的互换。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const custom = bindings({ "normal.right": 'F6 "', "normal.left": "F6 \\" });
  /** 真实序列化内容解析得到的记录。
   * @type {TomlTable}
   */
  const parsed = parse(exportToml(custom));
  assert.equal(parsed.keys.normal.F6['"'], "move_char_right");
  assert.equal(parsed.keys.normal.F6["\\"], "move_char_left");
  /** 替换默认前缀后的完整键位配置。
   * @type {{ [x: string]: string; }}
   */
  const replaced = { ...DEFAULT_BINDINGS };
  /** 当前比较或处理的动作记录。
   * @type {import('../src/domain/types.js').BindingAction}
   */
  for (const a of ACTIONS.filter(
    /** 依据实际条件筛选 ACTIONS 中的有效记录。
     * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.mode === "normal" && a.key.startsWith("g "),
  ))
    replaced[bindingId(a)] = "";
  replaced["normal.right"] = "g";
  assert.equal(parse(exportToml(replaced)).keys.normal.g, "move_char_right");
});
test("screen shortcut fresh prefix does not append an outstanding keyboard prefix", /** 验证屏幕快捷键的新序列不会追加尚未完成的键盘前缀。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const custom = bindings({ "normal.right": "F6 h" });
  /** 本次按键前尚未完成的配置序列。
   * @type {import('../src/domain/types.js').KeyResolution}
   */
  const prefix = resolveKeyInput(custom, "normal", [], "F6");
  /** 不追加旧前缀的新输入解析结果。
   * @type {import('../src/domain/types.js').KeyResolution}
   */
  const fresh = resolveKeyInput(custom, "normal", prefix.tokens, "F6", true);
  assert.equal(fresh.status, "prefix");
  assert.equal(
    resolveKeyInput(custom, "normal", fresh.tokens, "h").action.id,
    "right",
  );
});
test("character selection and real delete/undo preserve actual text", /** 验证选择字符、真实删除和撤销能够恢复原始文本。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let state = run(fixture("cat nap"), ["select", "right", "right"]);
  assert.deepEqual(selection(state), [0, 2]);
  state = applyAction(state, "delete");
  assert.equal(state.text, " nap");
  state = applyAction(state, "undo");
  assert.equal(state.text, "cat nap");
  assert.deepEqual(selection(state), [0, 2]);
});
test("word deletion matches independently observed native word boundaries", /** 用独立观察的原生词边界验证真实词删除行为。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 起始字符所属的边界类别。
   * @type {import('../src/domain/types.js').EditorState}
   */
  const initial = fixture("learn helix today\n");
  assert.equal(run(initial, ["word", "delete"]).text, "helix today\n");
  assert.equal(run(initial, ["word", "word", "delete"]).text, "learn today\n");
  assert.equal(
    run(initial, ["word", "word", "backword", "delete"]).text,
    "learn today\n",
  );
});
test("vertical movement keeps desired column and word motion clamps edges", /** 验证垂直移动保留目标列，词移动不能越出缓冲区边界。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let state = fixture("abcdef\nx\nabcdef", 4);
  state = applyAction(state, "down");
  assert.equal(state.head, 7);
  state = applyAction(state, "down");
  assert.equal(state.head, 13);
  state = applyAction(state, "up");
  assert.equal(state.head, 7);
  /** 顺序遍历的当前索引。
   * @type {number}
   */
  for (let i = 0; i < 20; i++) state = applyAction(state, "word");
  assert.ok(state.head < state.text.length);
  assert.equal(applyAction(fixture(""), "word").head, 0);
});
test("real insert text/backspace/normal/undo maintains edit history", /** 验证实际插入、退格、模式切换和撤销共享正确的编辑历史。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let state = applyAction(fixture("world"), "insert");
  state = insertText(state, "hi x");
  state = backspace(state);
  state = applyAction(state, "normal");
  assert.equal(state.text, "hi world");
  assert.equal(state.head, 2);
  state = applyAction(state, "undo");
  assert.equal(state.text, "world");
});
test("all original independent goal fixtures remain unchanged", /** 验证原有全部基础课程的独立字面量目标保持不变。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前文字步骤要求实际输入的文本。
   * @type {{ right: (string | number)[]; left: (string | number)[]; vertical: (string | number)[]; words: (string | number)[]; select: (string | number)[]; "delete-word": (string | number)[]; cancel: (string | number)[]; "delete-char": (string | number)[]; insert: (string | number)[]; undo: (string | number)[]; combine: (string | number)[]; }}
   */
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
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  for (const lesson of LESSONS.filter(/** 依据实际条件筛选 LESSONS 中的有效记录。
   * @param {import('../src/domain/types.js').Lesson} l - l 对应的实际输入记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (l) => l.id in expected)) {
    /** 课程要求达到的独立目标状态。
     * @type {import('../src/domain/types.js').EditorState}
     */
    const goal = goalFor(lesson);
    assert.deepEqual(
      [goal.text, goal.anchor, goal.head, goal.mode],
      expected[lesson.id],
    );
  }
});
test("required operands wait for input while default-register commands do not", /** 验证必填参数等待真实输入，默认寄存器命令无需额外表单。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 从配置中解析出的实际命令。
   * @type {string}
   */
  for (const command of ["select_regex", "find_next_char", "surround_replace"]) {
    /** 该命令要求的参数交互约定。
     * @type {import('../src/domain/types.js').Interaction | null}
     */
    const interaction = commandInteraction(command);
    assert.ok(interaction.fields.some(/** 检查 interaction.fields 是否满足当前操作的完整条件。
     * @param {import('../src/domain/types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (field) => field.required));
  }
  /** 从配置中解析出的实际命令。
   * @type {string}
   */
  for (const command of [
    "change_selection", "delete_selection", "yank", "paste_before",
    "paste_after", "replace_with_yanked", "record_macro", "replay_macro",
  ]) {
    assert.equal(commandInteraction(command), null, command);
    /** 课程是否显式指定可选寄存器参数。
     * @type {import('../src/domain/types.js').Interaction | null}
     */
    const explicit = commandInteraction(command, true);
    assert.ok(explicit.fields.some(/** 检查 explicit.fields 是否满足当前操作的完整条件。
     * @param {import('../src/domain/types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (field) => field.name === "register"));
    assert.ok(explicit.fields.every(/** 检查 explicit.fields 是否满足当前操作的完整条件。
     * @param {import('../src/domain/types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (field) => !field.required));
  }
  assert.equal(commandInteraction("select_all"), null);
});

test("default and custom key consumers rename three real selections without a register operand", /** 验证默认与自定义键位都能真实重命名三个独立选区。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson | undefined}
   */
  const lesson = LESSONS.find(/** 在 LESSONS 中定位符合当前条件的真实记录。
   * @param {import('../src/domain/types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (lesson) => lesson.id === "adv-regex-rename");
  /** 用于回归验证的用户自定义键位。
   * @type {{ [x: string]: string; }}
   */
  const custom = { ...DEFAULT_BINDINGS };
  custom[bindingId(actionForCommand(custom, "normal", "select_regex"))] = "F6";
  custom[bindingId(actionForCommand(custom, "normal", "change_selection"))] = "F7";
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {(string | import('../src/domain/types.js').Bindings)[]}
   */
  for (const [configured, regexKey, changeKey] of [
    [DEFAULT_BINDINGS, "s", "c"],
    [custom, "F6", "F7"],
  ]) {
    /** 实际编辑引擎的当前状态。
     * @type {import('../src/domain/types.js').EditorState}
     */
    let state = createState(lesson);
    /** 通过当前键位解析并执行真实命令。
     * @type {(arg0: string, arg1: import('../src/domain/types.js').CommandArgs) => string | string[]}
     * @param {string} key - 当前按键或配置键名。
     * @param {import('../src/domain/types.js').CommandArgs} [args] - 实际交给命令引擎执行的参数。
     * @returns {string | string[]} 返回该操作的实际计算结果。
     */
    const press = (key, args = {}) => {
      /** 实际按键解析得到的动作结果。
       * @type {import('../src/domain/types.js').KeyResolution}
       */
      const resolved = resolveKeyInput(configured, state.mode, [], key);
      assert.equal(resolved.status, "action");
      state = applyAction(state, resolved.action.command, args);
      return resolved.action.command;
    };
    press("%");
    /** 从当前配置解析出的正则选择动作。
     * @type {import('../src/domain/types.js').BindingAction | undefined}
     */
    const regex = resolveKeyInput(configured, state.mode, [], regexKey).action;
    assert.equal(commandInteraction(regex.command).fields[0].name, "pattern");
    press(regexKey, { pattern: "cat" });
    assert.deepEqual(state.selections, [
      { anchor: 0, head: 2 }, { anchor: 6, head: 8 }, { anchor: 12, head: 14 },
    ]);
    assert.equal(commandInteraction(press(changeKey)), null);
    assert.equal(state.mode, "insert");
    assert.equal(state.text, " +  = ");
    /** 逐字符实际输入的文字。
     * @type {string}
     */
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

test("real wrong regex input is not replaced by the rename lesson's answer", /** 验证错误但有效的正则输入不会被替换成课程预设答案。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson | undefined}
   */
  const lesson = LESSONS.find(/** 在 LESSONS 中定位符合当前条件的真实记录。
   * @param {import('../src/domain/types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (lesson) => lesson.id === "adv-regex-rename");
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
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
test("goal comparison rejects fake completion with wrong extra selections or register state", /** 验证错误的额外选区或寄存器内容不能冒充完成目标。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 课程要求达到的独立目标状态。
   * @type {{ text: string; anchor: number; head: number; mode: string; selections: { anchor: number; head: number; }[]; registers: { a: string[]; }; }}
   */
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
test("v1 migration preserves customization and disables newly discovered default collisions", /** 验证旧版迁移保留自定义键位并显式禁用新增默认冲突。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于兼容迁移的旧版键位记录。
   * @type {{ "normal.right": string; "normal.left": string; "insert.normal": string; }}
   */
  const old = {
    "normal.right": "g h",
    "normal.left": "h",
    "insert.normal": "C-h",
  };
  /** 保留旧自定义键位的迁移结果。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const migrated = migrateBindings(old);
  assert.equal(migrated["normal.right"], "g h");
  assert.equal(validateBindings(migrated).valid, true);
  /** 用于回归验证的独立存储容器。
   * @type {MemoryStorage}
   */
  const store = memory();
  store.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      bindings: old,
      completed: ["right", "unknown"],
    }),
  );
  /** 从真实序列化记录恢复的状态。
   * @type {import('../src/domain/types.js').SavedState}
   */
  const saved = loadSaved(store, validateBindings, DEFAULT_BINDINGS);
  assert.equal(saved.bindings["normal.right"], "g h");
  assert.deepEqual(saved.completed, ["right"]);
  assert.match(saved.warning, /迁移/);
});
test("v2 storage preserves full keys and independent knowledge progress", /** 验证版本二存储保留完整键位和独立的知识学习进度。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的独立存储容器。
   * @type {MemoryStorage}
   */
  const store = memory();
    /** 用于回归验证的用户自定义键位。
     * @type {import('../src/domain/types.js').Bindings}
     */
    const custom = bindings({ "normal.right": "F6 h" });
  assert.equal(
    saveState(
      store,
      custom,
      ["right", "right", "unknown"],
      ["command:move_char_right"],
    ),
    true,
  );
  /** 从真实序列化记录恢复的状态。
   * @type {import('../src/domain/types.js').SavedState}
   */
  const saved = loadSaved(store, validateBindings, DEFAULT_BINDINGS);
  assert.equal(saved.bindings["normal.right"], "F6 h");
  assert.deepEqual(saved.completed, ["right"]);
  assert.deepEqual(saved.knowledge, ["command:move_char_right"]);
  assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version, 2);
});
test("storage corruption or restrictions never crash application", /** 验证损坏记录与存储配额限制不会导致学习流程崩溃。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 模拟刷新前后保留的序列化记录。
   * @type {string}
   */
  for (const raw of [
    "{",
    "null",
    "{}",
    JSON.stringify({ version: 100, bindings: DEFAULT_BINDINGS, completed: [] }),
  ]) {
    /** 从真实序列化记录恢复的状态。
     * @type {import('../src/domain/types.js').SavedState}
     */
    const saved = loadSaved(
      { getItem: /** 实现 getItem 所要求的真实存储操作。
       * @returns {string} 返回该操作的实际计算结果。
       */
      () => raw },
      validateBindings,
      DEFAULT_BINDINGS,
    );
    assert.equal(saved.restored, false);
    assert.ok(saved.warning);
  }
  assert.equal(
    saveState(
      {
        /** 模拟存储拒绝写入时的真实失败路径。
         * @returns {never} 返回该操作的实际计算结果。
         */
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
test("every command and leaf can produce an honest recall question, independent of editor execution", /** 验证每个真实命令与键位都能生成不冒充编辑执行的知识题。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前遍历的官方命令记录。
   * @type {import('../src/domain/types.js').CatalogCommand}
   */
  for (const c of ALL_COMMANDS) {
    /** 从真实命令或绑定生成的知识题。
     * @type {import('../src/domain/types.js').RecallQuestion | null}
     */
    const q = recallQuestion(`command:${c.name}`, DEFAULT_BINDINGS);
    assert.equal(q.command, c.name);
    assert.ok(q.options.some(/** 检查 q.options 是否满足当前操作的完整条件。
     * @param {import('../src/domain/types.js').QuestionOption} o - o 对应的实际输入记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (o) => o.name === c.name));
    assert.equal(q.type, "command");
  }
  /** 当前比较或处理的动作记录。
   * @type {import('../src/domain/types.js').BindingAction}
   */
  for (const a of ACTIONS) {
    /** 从真实命令或绑定生成的知识题。
     * @type {import('../src/domain/types.js').RecallQuestion | null}
     */
    const q = recallQuestion(`binding:${bindingId(a)}`, DEFAULT_BINDINGS);
    assert.equal(q.key, a.key);
    assert.equal(q.type, "binding");
  }
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const custom = bindings({ "normal.right": "F6 h" });
  assert.equal(recallQuestion("binding:normal.right", custom).key, "F6 h");
});
;
test("all394 commands have Chinese learning meanings and preserved English provenance", /** 验证全部命令都有中文释义且保留官方英文出处。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  assert.equal(Object.keys(COMMAND_ZH).length, ALL_COMMANDS.length);
  /** 从配置中解析出的实际命令。
   * @type {import('../src/domain/types.js').CatalogCommand}
   */
  for (const command of ALL_COMMANDS) {
    assert.match(COMMAND_ZH[command.name], /[\u3400-\u9FFF]/);
    assert.ok(command.description);
  }
});
test("native uppercase Alt and Shift normalization never collapses distinct command bindings", /** 验证 Alt 与 Shift 的大小写规范化不会合并不同命令绑定。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  assert.notEqual(normalizeKey("A-c"), normalizeKey("A-C"));
  assert.equal(normalizeKey("A-S-c"), "A-C");
  assert.equal(
    keyFromEvent(event("C", { altKey: true, shiftKey: true })),
    "A-C",
  );
  assert.equal(normalizeKey("C-S-r"), "C-R");
  assert.equal(normalizeKey("Cmd-c"), "Meta-c");
  assert.equal(normalizeKey("Win-c"), "Meta-c");
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {string} 返回该操作的实际计算结果。
   */
  () => normalizeKey("D-c"));
  assert.equal(
    resolveKeyInput(DEFAULT_BINDINGS, "normal", [], "A-c").action.command,
    "change_selection_noyank",
  );
  assert.equal(
    resolveKeyInput(DEFAULT_BINDINGS, "normal", [], "A-C").action.command,
    "copy_selection_on_prev_line",
  );
});
test("macOS Option glyphs resolve to the intended Helix commands instead of Unicode shortcuts", /** 验证 macOS Option 组合字符恢复到预期的实际快捷键。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {string[]}
   */
  for (const [key, code, expected] of [
    ["å", "KeyA", "A-a"],
    ["ß", "KeyS", "A-s"],
    ["∂", "KeyD", "A-d"],
    ["ƒ", "KeyF", "A-f"],
    ["ç", "KeyC", "A-c"],
    ["Dead", "KeyI", "A-i"],
    ["…", "Semicolon", "A-;"],
    ["–", "Minus", "A-minus"],
    ["\u00A0", "Space", "A-space"],
  ]) {
    /** 真实引擎得到的当前结果。
     * @type {string | null}
     */
    const actual = keyFromEvent(event(key, { code, altKey: true }), "MacIntel");
    assert.equal(actual, expected);
  }
  /** 恢复后的不带 Shift 的 Option 按键。
   * @type {string | null}
   */
  const lower = keyFromEvent(event("ç", { code: "KeyC", altKey: true }), "MacIntel");
  /** 物理位置恢复是否应采用大写字符。
   * @type {string | null}
   */
  const upper = keyFromEvent(event("Ç", { code: "KeyC", altKey: true, shiftKey: true }), "MacIntel");
  assert.equal(resolveKeyInput(DEFAULT_BINDINGS, "normal", [], lower).action.command, "change_selection_noyank");
  assert.equal(resolveKeyInput(DEFAULT_BINDINGS, "normal", [], upper).action.command, "copy_selection_on_prev_line");
  assert.equal(keyFromEvent(event("Ú", { code: "Semicolon", altKey: true, shiftKey: true }), "MacIntel"), "A-:");
  assert.equal(keyFromEvent(event("·", { code: "Digit9", altKey: true, shiftKey: true }), "MacIntel"), "A-(");
});
test("Option recovery leaves ordinary Unicode, non-Mac layouts and ASCII logical keys intact", /** 验证 Option 恢复不改变普通 Unicode、非 Mac 布局与 ASCII 逻辑键。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  assert.equal(keyFromEvent(event("å", { code: "KeyA" }), "MacIntel"), "å");
  assert.equal(keyFromEvent(event("Dead", { code: "KeyI" }), "MacIntel"), null);
  assert.equal(keyFromEvent(event("é", { code: "KeyE", altKey: true }), "Linux"), "A-é");
  assert.equal(keyFromEvent(event("a", { code: "KeyQ", altKey: true }), "MacIntel"), "A-a");
  assert.equal(keyFromEvent(event("Dead", { code: "IntlYen", altKey: true }), "MacIntel"), null);
  assert.equal(keyFromEvent(event("Å", {
    code: "KeyA", altKey: true, getModifierState: /** 实现 getModifierState 所要求的真实存储操作。
     * @param {string} name - 当前记录的稳定名称。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (name) => name === "CapsLock",
  }), "MacIntel"), "A-A");
  assert.equal(keyFromEvent(event("å", {
    code: "KeyA", altKey: true, shiftKey: true, getModifierState: /** 实现 getModifierState 所要求的真实存储操作。
     * @param {string} name - 当前记录的稳定名称。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (name) => name === "CapsLock",
  }), "MacIntel"), "A-a");
});
test("old19 select Escape migrates to exit_select_mode without clobbering native v alias", /** 验证旧选择模式 Escape 正确迁移且不覆盖原生选择模式别名。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于兼容迁移的旧版键位记录。
   * @type {{ "select.normal": string; "normal.right": string; }}
   */
  const old = { "select.normal": "esc", "normal.right": "l" };
  /** 保留旧自定义键位的迁移结果。
   * @type {import('../src/domain/types.js').Bindings}
   */
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
test("edited aliases are preferred deterministically for current lesson hints", /** 验证当前课程提示确定性地优先采用用户修改过的有效别名。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前模式下的方向键动作别名。
   * @type {import('../src/domain/types.js').BindingAction | undefined}
   */
  const arrow = ACTIONS.find(/** 在 ACTIONS 中定位符合当前条件的真实记录。
   * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (a) => a.mode === "normal" && a.key === "right");
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const custom = bindings({ [bindingId(arrow)]: "F6" });
  assert.equal(
    custom[bindingId(actionForCommand(custom, "normal", "right"))],
    "F6",
  );
});
test("custom command sequences and typed arguments export real values; malformed records do not throw", /** 验证命令序列与冒号参数原样导出，损坏自定义记录按实际规则拒绝。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于回归验证的用户自定义键位。
   * @type {import('../src/domain/types.js').Bindings}
   */
  let custom = addBinding(
    DEFAULT_BINDINGS,
    "normal",
    '["move_char_right","delete_selection"]',
    "F6",
  );
  custom = addBinding(custom, "normal", ':open "hello world.txt"', "F7");
  /** 实际导出后重新解析的原生 Helix 配置。
   * @type {TomlTable}
   */
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
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').Bindings} 返回该操作的实际计算结果。
   */
  () =>
    addBinding(DEFAULT_BINDINGS, "normal", '["invented"]', "F6"),
  );
});

test("advanced challenge replays match independently authored text and full-range goals", /** 逐步回放全部高级课程并比较独立编写的完整选区与文本目标。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前目录中声明为高级训练的课程集合。
   * @type {import('../src/domain/types.js').Lesson[]}
   */
  const advanced = LESSONS.filter(/** 依据实际条件筛选 LESSONS 中的有效记录。
   * @param {import('../src/domain/types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
   * @returns {boolean | undefined} 返回该操作的实际计算结果。
   */
  (lesson) => lesson.advanced);
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  for (const lesson of advanced) {
    /** 真实引擎得到的当前结果。
     * @type {import('../src/domain/types.js').EditorState}
     */
    let actual = createState(lesson);
    /** 当前需要实际执行的课程步骤。
     * @type {import('../src/domain/types.js').LessonStep}
     */
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


test('最后一条默认绑定的修改仍驱动真实多键解析', /**
 * 保留旧虚拟列表测试中与界面实现无关的真实键位行为。
 * @returns {void} 完成末条绑定可修改及真实命令解析断言。
 */
() => {
  /** 最后一条普通模式官方动作。
   * @type {import('../src/domain/types.js').BindingAction}
   */
  const last = ACTIONS.filter(/**
   * 定位原设置列表中的普通模式动作。
   * @param {import('../src/domain/types.js').BindingAction} action 当前官方动作。
   * @returns {boolean} 当前动作是否属于普通模式。
   */
  action => action.mode === 'normal').at(-1);
  /** 模拟在设置中修改最后一条动作后的完整配置。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const draft = { ...DEFAULT_BINDINGS, [bindingId(last)]: 'F24 z' };
  assert.equal(validateBindings(draft).errors[bindingId(last)], undefined);
  /** 第一键必须被识别为真实未完成前缀。
   * @type {import('../src/domain/types.js').KeyResolution}
   */
  const prefix = resolveKeyInput(draft, 'normal', [], 'F24');
  assert.equal(prefix.status, 'prefix');
  assert.equal(resolveKeyInput(draft, 'normal', prefix.tokens, 'z').action.command, last.command);
});
