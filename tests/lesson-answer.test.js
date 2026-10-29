import assert from "node:assert/strict";
import test from "node:test";

import { commandInteraction } from "../src/domain/advanced.js"
import { actionForCommand, ACTIONS, actionsFor, addBinding, bindingId, DEFAULT_BINDINGS, validateBindings } from "../src/domain/bindings.js"
import { applyAction, createState, insertText, LESSONS, matchesGoal } from "../src/domain/engine.js"
import { lessonAnswer } from "../src/domain/lesson-answer.js"
import { resolvePracticeInput } from "../src/domain/practice-input.js"

// 通过真实输入解析器与编辑引擎执行已发布的答案操作，
// 执行过程中不读取课程预期命令或参数来替代实际输入。
/** 只读取发布的答案操作，使用实际解析器验证目标。
 * @param {import('../src/domain/types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
 * @param {import('../src/domain/types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @returns {import('../src/domain/types.js').EditorState} 返回该操作的实际计算结果。
 */
function follow(lesson, bindings) {
  /** 实际编辑引擎的当前状态。
   * @type {import('../src/domain/types.js').EditorState}
   */
  let state = createState(lesson); /** 尚未消费的命令计数输入。
   * @type {string}
   */
  let countInput = ""; /** 尚未完成的已配置按键前缀。
   * @type {string[]}
   */
  let pending = []; /** 等待真实参数提交的命令表单。
   * @type {{action: import('../src/domain/types.js').BindingAction, args: import('../src/domain/types.js').CommandArgs} | null}
   */
  let form = null;
  /** 执行答案解析出的动作并消费计数前缀。
   * @param {import('../src/domain/types.js').BindingAction} action - 当前配置解析出的真实动作记录。
   * @param {import('../src/domain/types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
   * @returns {void} 完成状态修改，不返回额外值。
   */
  function execute(action, args) {
    /** 基础动作所对应的官方命令记录。
     * @type {import('../src/domain/types.js').BindingAction | undefined}
     */
    const basic = ACTIONS.find(/** 在 ACTIONS 中定位符合当前条件的真实记录。
     * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.mode === state.mode && a.command === action.command);
    state = applyAction(state, state.advanced ? action.command : basic.id, args);
    countInput = "";
  }
  /** 当前需要实际执行的课程步骤。
   * @type {import('../src/domain/types.js').AnswerStep}
   */
  for (const step of lessonAnswer(lesson, bindings)) {
    assert.equal(state.mode, step.mode);
    /** 答案中需要实际执行的单个操作。
     * @type {import('../src/domain/types.js').AnswerOperation}
     */
    for (const op of step.operations) {
      if (op.kind === "text") state = insertText(state, op.value);
      else if (op.kind === "count") countInput = String(op.value);
      else if (op.kind === "key") {
        /** 当前按键或配置键名。
         * @type {string}
         */
        for (const key of op.value.split(" ")) {
          /** 实际解析或执行得到的结果。
           * @type {import('../src/domain/types.js').PracticeResolution}
           */
          const result = resolvePracticeInput({ bindings, mode: state.mode, advanced: state.advanced,
            pending, countInput, key });
          pending = result.pending;
          countInput = result.countInput;
          assert.ok(["prefix", "action"].includes(result.status));
          if (result.status === "action") {
            /** 本次命令实际提交的参数。
             * @type {{ count: number; } | { count?: undefined; }}
             */
            const args = countInput ? { count: Number(countInput) } : {};
            if (commandInteraction(result.action.command)) form = { action: result.action, args };
            else execute(result.action, args);
          }
        }
      } else if (op.kind === "control") {
        /** 当前配置解析出的真实动作记录。
         * @type {import('../src/domain/types.js').BindingAction | undefined}
         */
        const action = actionsFor(bindings).find(/** 在 actionsFor(bindings) 中定位符合当前条件的真实记录。
         * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
         * @returns {boolean | ""} 返回该操作的实际计算结果。
         */
        (a) => a.mode === state.mode &&
          bindings[bindingId(a)] && `${a.label}：寄存器…` === op.value);
        assert.ok(action, op.value);
        assert.ok(commandInteraction(action.command, true));
        assert.equal(commandInteraction(action.command), null);
        form = { action, args: countInput ? { count: Number(countInput) } : {} };
      } else if (op.kind === "operand") {
        assert.ok(form);
        assert.ok(commandInteraction(form.action.command, true).fields.some(/** 检查 commandInteraction(form.action.command, true).fields 是否满足当前操作的完整条件。
         * @param {import('../src/domain/types.js').InteractionField} f - f 对应的实际输入记录。
         * @returns {boolean} 返回该操作的实际计算结果。
         */
        (f) => f.name === op.name));
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

test("all lesson answers are executable against independent literal goals", /** 通过真实输入解析器执行全部课程答案并比较独立字面量目标。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  for (const lesson of LESSONS) {
    assert.ok(lesson.goal);
    /** 操作前用于独立比较的状态或文本。
     * @type {import('../src/domain/types.js').Lesson}
     */
    const before = structuredClone(lesson);
    follow(lesson, DEFAULT_BINDINGS);
    assert.deepEqual(lesson, before);
  }
});

test("every answer follows newly configured multi-key aliases in all modes", /** 验证所有模式的答案都遵循新配置的多键命令别名。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前有效的完整键位配置。
   * @type {{ [k: string]: string; }}
   */
  let bindings = Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(/** 将 Object.keys(DEFAULT_BINDINGS) 中的记录转换为本次操作需要的结果。
   * @param {string} id - 不会覆盖现有配置的稳定记录标识。
   * @returns {[string, string]} 返回该操作的实际计算结果。
   */
  (id) => [id, ""]));
  /** 当前记录在原集合中的索引。
   * @type {number}
   */
  let index = 0;
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  for (const lesson of LESSONS) {
    /** 当前需要实际执行的课程步骤。
     * @type {import('../src/domain/types.js').AnswerStep}
     */
    for (const step of lessonAnswer(lesson, DEFAULT_BINDINGS)) {
      if (!step.command || actionForCommand(bindings, step.mode, step.command)) continue;
      bindings = addBinding(bindings, step.mode, step.command,
        `F24 F${Math.floor(index / 24) + 1} F${index % 24 + 1}`);
      index++;
    }
  }
  assert.equal(validateBindings(bindings).valid, true);
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  for (const lesson of LESSONS) follow(lesson, bindings);
});


test("counts, regex escapes, character/object operands and named registers stay literal", /** 验证答案原样保留计数、正则转义、字符对象与命名寄存器参数。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 所有答案步骤中原样保留的参数输入。
   * @type {import('../src/domain/types.js').AnswerOperation[]}
   */
  const operands = LESSONS.flatMap(/** 将 LESSONS 中的记录转换为本次操作需要的结果。
   * @param {import('../src/domain/types.js').Lesson} l - l 对应的实际输入记录。
   * @returns {import('../src/domain/types.js').AnswerStep[]} 返回该操作的实际计算结果。
   */
  (l) => lessonAnswer(l, DEFAULT_BINDINGS)).flatMap(/** 将 LESSONS.flatMap((l) => lessonAnswer(l, DEFAULT_BINDINGS)) 中的记录转换为本次操作需要的结果。
   * @param {import('../src/domain/types.js').AnswerStep} s - 逐步执行中的真实编辑状态。
   * @returns {import('../src/domain/types.js').AnswerOperation[]} 返回该操作的实际计算结果。
   */
  (s) => s.operations);
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {string[]}
   */
  for (const [name, value] of [["pattern", "\\w+"], ["pattern", "\\d+"], ["char", ","], ["object", "("], ["register", "a"], ["register", "q"]])
    assert.ok(operands.some(/** 检查 operands 是否满足当前操作的完整条件。
     * @param {import('../src/domain/types.js').AnswerOperation} op - 答案中需要实际执行的单个操作。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (op) => op.kind === "operand" && op.name === name && op.value === value));
  /** 不会覆盖现有配置的稳定记录标识。
   * @type {string}
   */
  for (const id of ["adv-register", "adv-replace-yank", "adv-macro", "adv-count-find", "adv-nested-object", "adv-indent"])
    follow(LESSONS.find(/** 在 LESSONS 中定位符合当前条件的真实记录。
     * @param {import('../src/domain/types.js').Lesson} l - l 对应的实际输入记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (l) => l.id === id), DEFAULT_BINDINGS);
});

test("removed commands never fall back to default keys, while active aliases remain usable", /** 验证移除命令后不退回默认键，仍然有效的其他别名可以继续使用。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 保留稳定标识与独立目标的课程。
   * @type {import('../src/domain/types.js').Lesson}
   */
  const lesson = LESSONS[0];
  /** 只删除一个默认别名后的配置。
   * @type {{ "normal.right": string; }}
   */
  const oneRemoved = { ...DEFAULT_BINDINGS, "normal.right": "" };
  assert.equal(lessonAnswer(lesson, oneRemoved)[0].operations[0].kind, "key");
  /** 删除同命令全部有效别名后的配置。
   * @type {{ [x: string]: string; }}
   */
  const none = { ...DEFAULT_BINDINGS };
  /** 当前比较或处理的动作记录。
   * @type {import('../src/domain/types.js').BindingAction}
   */
  for (const a of ACTIONS.filter(/** 依据实际条件筛选 ACTIONS 中的有效记录。
   * @param {import('../src/domain/types.js').BindingAction} a - 当前比较或处理的动作记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (a) => a.mode === "normal" && a.command === "move_char_right")) none[bindingId(a)] = "";
  assert.deepEqual(lessonAnswer(lesson, none)[0].operations,
    [{ kind: "unbound", command: "move_char_right" }]);
});

test("answer operations preserve literal content without mutating input", /** 验证只读答案保留特殊文字的字面值且不修改输入记录。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => { /** 保留稳定标识与独立目标的课程。
 * @type {import('../src/domain/types.js').Lesson | undefined}
 */
const lesson = LESSONS.find(/** 在 LESSONS 中定位符合当前条件的真实记录。
 * @param {import('../src/domain/types.js').Lesson} l - l 对应的实际输入记录。
 * @returns {boolean} 返回该操作的实际计算结果。
 */
(l) => l.id === "insert"); /** 操作前用于独立比较的状态或文本。
 * @type {{ lesson: import('../src/domain/types.js').Lesson | undefined; bindings: import('../src/domain/types.js').Bindings; }}
 */
const before = structuredClone({lesson, bindings: DEFAULT_BINDINGS}); lessonAnswer(lesson, DEFAULT_BINDINGS); assert.deepEqual({lesson, bindings: DEFAULT_BINDINGS}, before); /** 含特殊字符的独立只读文字用例。
 * @type {{ steps: { type: string; text: string; }[]; id?: string | undefined; category?: string | undefined; title?: string | undefined; description?: string | undefined; text?: string | undefined; cursor?: number | undefined; goal?: (import('../src/domain/types.js').EditorSnapshot & { registers?: Record<string, string[]>; }) | undefined; concept?: string | undefined; tip?: string | undefined; advanced?: boolean; theme?: string; source?: import('../src/domain/types.js').ArticleSource; }}
 */
const special = {...lesson, steps: [{type: "text", text: '<script>"&'}]}; assert.equal(lessonAnswer(special, DEFAULT_BINDINGS)[0].operations[0].value, '<script>"&'); });

