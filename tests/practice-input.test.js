import assert from "node:assert/strict";
import test from "node:test";

import { actionForCommand, addBinding, bindingId, DEFAULT_BINDINGS } from "../src/domain/bindings.js"
import { applyAction, backspace, createState, goalFor, insertText, LESSONS, matchesGoal } from "../src/domain/engine.js"
import { resolvePracticeInput, updateTextProgress } from "../src/domain/practice-input.js"

// 使用与界面相同的输入分发和进度转换，驱动真实编辑引擎。
/** 创建使用真实输入解析与编辑引擎的练习会话。
 * @param {import('../src/domain/types.js').Bindings} [bindings] - 当前有效的完整键位配置。
 * @returns {import('./types.js').PracticeHarness} 返回该操作的实际计算结果。
 */
function practice(bindings = DEFAULT_BINDINGS) {
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson | undefined}
   */
  const lesson = LESSONS.find(/** 在 LESSONS 中定位符合当前条件的真实记录。
   * @param {import('../src/domain/types.js').Lesson} entry - entry 对应的实际输入记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (entry) => entry.id === "adv-regex-rename");
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let state = createState(lesson); /** 尚未完成的已配置按键前缀。
   * @type {string[]}
   */
  let pending = []; /** 尚未消费的命令计数输入。
   * @type {string}
   */
  let countInput = ""; /** 当前课程执行到的真实步骤索引。
   * @type {number}
   */
  let stepIndex = 0; /** 当前文字步骤已经实际输入的内容。
   * @type {string}
   */
  let typed = "";
  /** 通过真实插入和退格更新课程文字进度。
   * @type {(arg0: string, arg1: boolean) => void}
   * @param {string} value - 本次实际输入、读取或比较的值。
   * @param {boolean} [erase] - 是否执行真实退格而非追加文字。
   * @returns {void} 完成状态修改，不返回额外值。
   */
  const text = (value, erase = false) => {
    pending = [];
    countInput = "";
    state = erase ? backspace(state) : insertText(state, value);
    ({ stepIndex, typed } = updateTextProgress(lesson.steps, stepIndex, typed, value, erase));
  };
  /** 模拟按键分发，保留配置前缀并执行真实编辑。
   * @type {(arg0: string, arg1: import('./types.js').PressOptions) => import('../src/domain/types.js').PracticeResolution}
   * @param {string} key - 当前按键或配置键名。
   * @param {import('./types.js').PressOptions} [options] - 本次操作的完整参数。
   * @returns {import('../src/domain/types.js').PracticeResolution} 返回该操作的实际计算结果。
   */
  const press = (key, { rawText = key.length === 1 ? key : undefined, args = {}, fresh = false } = {}) => {
    /** 实际解析或执行得到的结果。
     * @type {import('../src/domain/types.js').PracticeResolution}
     */
    const result = resolvePracticeInput({ bindings, mode: state.mode, advanced: true, pending, countInput, key, rawText, fresh });
    pending = result.pending;
    countInput = result.countInput;
    if (result.status === "text") text(result.text);
    if (result.status === "action") {
      // 无论打开参数表、直接编辑还是发生错误，已消费的命令前缀都必须清空。
      assert.deepEqual(pending, []);
      /** 从配置中解析出的实际命令。
       * @type {string | string[]}
       */
      const command = result.action.command;
      if (state.mode === "insert" && command === "delete_char_backward") text("", true);
      else if (state.mode === "insert" && command === "insert_newline") text("\n");
      else {
        /** 当前文字步骤要求实际输入的文本。
         * @type {import('../src/domain/types.js').LessonStep}
         */
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
    /** 读取当前练习会话的 state 状态。
     * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
     */
    get state() { return state; },
    /** 读取当前练习会话的 pending 状态。
     * @returns {string[]} 返回该操作的实际计算结果。
     */
    get pending() { return pending; },
    /** 读取当前练习会话的 countInput 状态。
     * @returns {string} 返回该操作的实际计算结果。
     */
    get countInput() { return countInput; },
    /** 读取当前练习会话的 stepIndex 状态。
     * @returns {number} 返回该操作的实际计算结果。
     */
    get stepIndex() { return stepIndex; },
    /** 读取当前练习会话的 complete 状态。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    get complete() { return stepIndex === lesson.steps.length && matchesGoal(state, goalFor(lesson)); },
  };
}
/** 通过真实按键选出三个词并进入修改模式。
 * @param {import('./types.js').PracticeHarness} p - 使用真实解析器与引擎的测试练习会话。
 * @returns {void} 完成状态修改，不返回额外值。
 */
function change(p) {
  p.press("%");
  p.press("s", { args: { pattern: "cat" } });
  p.press("c");
  assert.equal(p.state.mode, "insert");
  assert.equal(p.state.text, " +  = ");
  assert.equal(p.stepIndex, 3);
}
/** 逐字符分发测试输入。
 * @type {(arg0: import('./types.js').PracticeHarness, arg1: string) => void}
 * @param {import('./types.js').PracticeHarness} p - 使用真实解析器与引擎的测试练习会话。
 * @param {string} value - 本次实际输入、读取或比较的值。
 * @returns {void} 完成状态修改，不返回额外值。
 */
const type = (p, value) => { /** 当前按键或配置键名。
 * @type {string}
 */
for (const key of value) p.press(key); };
/** 按命令的当前有效动作重映射测试按键。
 * @type {(arg0: import('../src/domain/types.js').Mode, arg1: string, arg2: string, arg3: import('../src/domain/types.js').Bindings) => import('../src/domain/types.js').Bindings}
 * @param {import('../src/domain/types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {string} key - 当前按键或配置键名。
 * @param {import('../src/domain/types.js').Bindings} [bindings] - 当前有效的完整键位配置。
 * @returns {import('../src/domain/types.js').Bindings} 返回该操作的实际计算结果。
 */
const remap = (mode, command, key, bindings = DEFAULT_BINDINGS) => ({
  ...bindings, [bindingId(actionForCommand(bindings, mode, command))]: key,
});

test("consumed Backspace, Enter and Ctrl-h never contaminate the next insertion", /** 验证已消费的退格、回车与控制键不污染下一次实际插入。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前按键或配置键名。
   * @type {string}
   */
  for (const key of ["backspace", "ret", "C-h"]) {
    /** 使用真实输入解析器的练习会话。
     * @type {PracticeHarness}
     */
    const p = practice();
    change(p);
    p.press(key);
    /** 编辑后的实际文本。
     * @type {string}
     */
    const edited = p.state.text;
    /** 操作前各插入点的真实偏移。
     * @type {number[]}
     */
    const locations = p.state.selections.map(/** 将 p.state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('../src/domain/types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {number} 返回该操作的实际计算结果。
     */
    (selection) => selection.head);
    assert.equal(p.press("d").status, "text");
    /** 当前文字步骤要求实际输入的文本。
     * @type {string}
     */
    let expected = edited;
    /** 当前需要插入字符的位置。
     * @type {number}
     */
    for (const at of [...locations].reverse()) expected = `${expected.slice(0, at)  }d${  expected.slice(at)}`;
    assert.equal(p.state.text, expected);
    assert.deepEqual(p.pending, []);
    if (key !== "ret") assert.notEqual(edited, " +  = "); // 必须真实删除分隔字符，不能通过钳位掩盖删除行为。
  }
});

test("real typo correction, repeated deletion and mixed newline correction finish all five steps", /** 验证真实错字、多次删除与换行纠错能够完成全部五个步骤。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于比较的完整规范按键文本。
   * @type {string[]}
   */
  for (const sequence of [
    ["d", "x", "backspace", "o", "g"],
    ["d", "x", "x", "backspace", "backspace", "o", "g"],
    ["d", "ret", "backspace", "o", "g"],
    ["d", "x", "C-h", "o", "g"],
  ]) {
    /** 使用真实输入解析器的练习会话。
     * @type {PracticeHarness}
     */
    const p = practice();
    change(p);
    /** 当前按键或配置键名。
     * @type {string}
     */
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

test("letters, digits, spaces and punctuation are ordinary insert text, not counts", /** 验证插入模式的字母、数字、空格与标点都作为实际文本而非计数。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 使用真实输入解析器的练习会话。
   * @type {PracticeHarness}
   */
  const p = practice();
  change(p);
  type(p, "aZ09!? +-=\"'");
  assert.equal(p.state.text, "aZ09!? +-=\"' + aZ09!? +-=\"' = aZ09!? +-=\"'");
  assert.equal(p.countInput, "");
  assert.deepEqual(p.pending, []);
});

test("text-step completion remains correctable after the first exact match", /** 验证文字首次完全匹配后仍允许继续退格和纠错。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 用于比较的完整规范按键文本。
   * @type {string[]}
   */
  for (const sequence of [["x", "backspace"], ["backspace", "g"]]) {
    /** 使用真实输入解析器的练习会话。
     * @type {PracticeHarness}
     */
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

test("custom editing prefixes complete, cancel and fail without swallowing subsequent letters", /** 验证自定义编辑前缀可完成、取消或失败且不吞掉后续字母。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前回归用例实际使用的键位配置。
   * @type {import('../src/domain/types.js').Bindings}
   */
  const configured = remap("insert", "delete_char_backward", "F6 h");
  /** 使用真实输入解析器的练习会话。
   * @type {PracticeHarness}
   */
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

test("remapped exit and Esc-containing configured prefixes take precedence over cancellation", /** 验证重映射退出键与含 Escape 的已配置前缀优先于取消逻辑。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 本次验证的退出插入模式序列。
   * @type {string}
   */
  for (const exit of ["F7", "F6 esc"]) {
    /** 当前回归用例实际使用的键位配置。
     * @type {import('../src/domain/types.js').Bindings}
     */
    const configured = remap("insert", "normal_mode", exit);
    /** 使用真实输入解析器的练习会话。
     * @type {PracticeHarness}
     */
    const p = practice(configured);
    change(p);
    assert.equal(p.press("esc").status, "unbound");
    type(p, "dog");
    /** 当前按键或配置键名。
     * @type {string}
     */
    for (const key of exit.split(" ")) p.press(key);
    assert.equal(p.complete, true);
  }
});

test("on-screen fresh sequences and count state use the same mapping policy", /** 验证屏幕新序列与命令计数使用同一套当前键位映射。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前回归用例实际使用的键位配置。
   * @type {import('../src/domain/types.js').Bindings}
   */
  let configured = remap("normal", "select_all", "F6 a");
  /** 使用真实输入解析器的练习会话。
   * @type {PracticeHarness}
   */
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

test("a rejected real operand does not leave a consumed command in the next sequence", /** 验证真实参数被拒绝后，已消费命令不会残留到下一输入序列。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 使用真实输入解析器的练习会话。
   * @type {PracticeHarness}
   */
  const p = practice();
  p.press("%");
  assert.throws(/** 调用实际失败路径并断言异常，不替换真实实现。
   * @returns {import('../src/domain/types.js').PracticeResolution} 返回该操作的实际计算结果。
   */
  () => p.press("s", { args: { pattern: "[" } }));
  assert.deepEqual(p.pending, []);
  assert.equal(p.press("s", { args: { pattern: "cat" } }).status, "action");
  p.press("c");
  type(p, "dog");
  p.press("esc");
  assert.equal(p.complete, true);
});
