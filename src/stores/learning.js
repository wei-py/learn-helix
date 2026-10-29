import { defineStore } from 'pinia';

import { commandInteraction, supportsCommand } from '../domain/advanced.js';
import { nextArticleQuestion } from '../domain/article.js';
import { actionForCommand, ACTIONS, bindingId, DEFAULT_BINDINGS, displayKey, validateBindings } from '../domain/bindings.js';
import { applyAction, backspace, createState, goalFor, insertText, LESSONS, loadSaved, matchesGoal, saveState } from '../domain/engine.js';
import { resolvePracticeInput, updateTextProgress } from '../domain/practice-input.js';
import { recallQuestion } from '../domain/recall.js';

/**
 * 表示已配置的模式绑定与真实命令。
 * @typedef {import('../domain/types.js').BindingAction} BindingAction
 */
/**
 * 表示用户输入的真实命令参数。
 * @typedef {Record<string, string|number>} Operands
 */

/**
 * 安全读取本地存储，隐私限制不阻止应用启动。
 * @returns {Pick<Storage,'getItem'|'setItem'>} 本地存储适配器。
 */
function storageForLearning() {
  try { return window.localStorage; }
  catch { return { /**
   * 读取不可用的本地存储并报告限制。
   * @returns {never} 抛出读取不可用错误。
   */ getItem() { throw new Error('Local storage unavailable'); }, /**
    * 报告浏览器不允许持久化。
    * @returns {void} 抛出存储不可用错误。
    */ setItem() { throw new Error('Local storage unavailable'); } }; }
}

/**
 * 统一管理编辑器与知识进度，只有真实引擎操作才能推进课程。
 * @type {ReturnType<typeof defineStore>}
 */
export const useLearningStore = defineStore('helix-learning', {
  /**
   * 沿用原有存储键和迁移协议初始化课程。
   * @returns {import('./types.js').LearningState} 课程初始状态。
   */
  state() {
    /**
     * 浏览器持久化存储适配器。
     * @type {ReturnType<typeof storageForLearning>}
     */
    const storage = storageForLearning();
    /**
     * 迁移后的历史学习记录。
     * @type {ReturnType<typeof loadSaved>}
     */
    const saved = loadSaved(storage, validateBindings, DEFAULT_BINDINGS);
    /**
     * 当前课程序号。
     * @type {number}
     */
    const lessonIndex = Math.max(0, LESSONS.findIndex(/**
     * 是否尚未完成。
     * @param {import('../domain/types.js').Lesson} item 候选课程。
     * @returns {boolean} 是否尚未完成。
     */ (item) => !saved.completed.includes(item.id)));
    return { bindings: saved.bindings, completed: saved.completed, knowledge: saved.knowledge || [], notice: saved.warning || '', lessonIndex, editor: createState(LESSONS[lessonIndex]), stepIndex: 0, typed: '', pending: [], success: false, feedback: { kind: 'neutral', text: '点击编辑区，或使用下方按键，开始你的第一步。' }, operandAction: null, operandCount: 1, countInput: '', insertBuffer: '', hintVisible: true, answerVisible: false, category: 'all', modal: '', draft: { ...saved.bindings }, settingsMessage: '', question: null, recallAnswer: '', recallRevealed: false, recallContexts: {}, recallRestoreKey: '' };
  },
  getters: {
    /**
     * 取得当前真实课程。
     * @param {import('./types.js').LearningState} state 学习状态。
     * @returns {import('../domain/types.js').Lesson} 选中的课程。
     */
    lesson: (state) => LESSONS[state.lessonIndex],
    /**
     * 取得当前引擎目标。
     * @returns {ReturnType<typeof goalFor>} 课程目标状态。
     */
    goal() { return goalFor(this.lesson); },
    /**
     * 取得当前步骤说明。
     * @returns {import('../domain/types.js').LessonStep|undefined} 当前步骤。
     */
    currentStep() { return this.lesson.steps[this.stepIndex]; },
    /**
     * 只显示当前模式与课程相关的真实编辑操作。
     * @returns {BindingAction[]} 可用操作。
     */
    practiceActions() {
      /**
       * 当前课程可用的命令集合。
       * @type {Set<string>}
       */
      const commands = new Set(this.lesson.steps.filter(/**
       * 是否属于当前模式。
       * @param {import('../domain/types.js').LessonStep} step 课程步骤。
       * @returns {boolean} 是否属于当前模式。
       */ (step) => step.mode === this.editor.mode).map(/**
        * 命令名称。
        * @param {import('../domain/types.js').LessonStep} step 课程步骤。
        * @returns {string} 命令名称。
        */ (step) => this.getAction(step.mode, step.action).command));
      for (/**
       * 命令按钮必须保留模式切换与撤销操作。
       * @type {string}
       */ const name of ['normal_mode', 'undo', 'redo']) commands.add(name);
      return [...commands].map(/**
       * 已配置的操作。
       * @param {string} command 命令标识。
       * @returns {BindingAction|undefined} 已配置的操作。
       */ (command) => actionForCommand(this.bindings, this.editor.mode, command)).filter(Boolean);
    },
  },
  actions: {
    /**
     * 解析自定义别名，未绑定时保留步骤说明。
     * @param {string} mode 编辑器模式。
     * @param {string} command 命令或操作标识。
     * @returns {BindingAction} 步骤操作。
     */
    getAction(mode, command) { return actionForCommand(this.bindings, mode, command) || ACTIONS.find(/**
     * 是否匹配命令。
     * @param {BindingAction} action 候选操作。
     * @returns {boolean} 是否匹配命令。
     */ (action) => action.mode === mode && (action.id === command || action.command === command)) || { mode, id: command, command, label: command }; },
    /**
     * 读取优先使用的自定义快捷键。
     * @param {string} mode 编辑器模式。
     * @param {string} command 命令标识。
     * @returns {string} 快捷键或空字符串。
     */
    keyOf(mode, command) { /**
     * 当前解析出的键位操作。
     * @type {BindingAction|undefined}
     */ const action = actionForCommand(this.bindings, mode, command); return action ? this.bindings[bindingId(action)] : ''; },
    /**
     * 使用已有版本化协议保存键位与学习进度。
     * @returns {void}
     */
    persist() { if (!saveState(storageForLearning(), this.bindings, this.completed, this.knowledge)) this.notice = '浏览器未允许本地存储：本次修改仅在当前页面生效。请导出键位备份。'; },
    /**
     * 重新开始课程并保留总进度。
     * @param {string} id 课程标识。
     * @returns {void}
     */
    startLesson(id) {
      /**
       * 候选课程在完整课程表中的位置。
       * @type {number}
       */ const index = LESSONS.findIndex(/**
        * 标识是否一致。
        * @param {import('../domain/types.js').Lesson} item 候选课程。
        * @returns {boolean} 标识是否一致。
        */ (item) => item.id === id);
      if (index < 0) return;
      this.lessonIndex = index; this.editor = createState(this.lesson); this.operandAction = null; this.countInput = ''; this.answerVisible = false; this.stepIndex = 0; this.typed = ''; this.pending = []; this.success = false; this.insertBuffer = ''; this.feedback = { kind: 'neutral', text: '准备好了。按右侧步骤试一试。' };
    },
    /**
     * 同时检查操作顺序与精确目标状态。
     * @returns {void}
     */
    checkComplete() {
      if (this.stepIndex !== this.lesson.steps.length) return;
      if (matchesGoal(this.editor, goalFor(this.lesson))) { this.success = true; if (!this.completed.includes(this.lesson.id)) { this.completed.push(this.lesson.id); this.persist(); } }
      else this.feedback = { kind: 'error', text: '步骤已完成，但文本或选区与目标不同。查看目标状态，或重新练习。' };
    },
    /**
     * 请求用户输入真实参数，不自动填入答案。
     * @param {BindingAction} action 用户请求的操作。
     * @param {boolean} includeOptional 是否显示可选寄存器字段。
     * @returns {void}
     */
    beginAction(action, includeOptional = false) {
      this.pending = []; if (this.success || this.operandAction) return;
      if (this.editor.mode === 'insert' && action.command === 'delete_char_backward') { this.typeText('', true); return; }
      if (this.editor.mode === 'insert' && action.command === 'insert_newline') { this.typeText('\n'); return; }
      /**
       * 用户输入的命令计数。
       * @type {number}
       */ const count = this.countInput ? Number(this.countInput) : 1;
      if (!Number.isSafeInteger(count) || count < 1 || count > 10000) { this.feedback = { kind: 'error', text: '计数必须为 1–10000 的整数。' }; this.countInput = ''; return; }
      if (this.editor.advanced && commandInteraction(action.command, includeOptional)) { this.operandAction = action; this.operandCount = count; this.countInput = ''; return; }
      this.executeAction(action, this.countInput ? { count } : {});
    },
    /**
     * 使用原有引擎状态机执行操作并精确匹配参数。
     * @param {BindingAction} action 用户请求的操作。
     * @param {Operands} args 用户填写的参数。
     * @returns {void}
     */
    executeAction(action, args = {}) {
      if (this.success) return;
      /**
       * 操作执行前的编辑器模式。
       * @type {string}
       */ const previousMode = this.editor.mode;
      /**
       * 本步预期的操作描述。
       * @type {import('../domain/types.js').LessonStep|undefined}
       */ const expected = this.currentStep;
      /**
       * 本步预期的真实命令。
       * @type {string|null}
       */ const expectedCommand = expected && expected.type !== 'text' ? this.getAction(expected.mode, expected.action).command : null;
      /**
       * 基础引擎使用的操作标识。
       * @type {string}
       */ const basicId = ACTIONS.find(/**
        * 模式和命令是否相同。
        * @param {BindingAction} item 候选操作。
        * @returns {boolean} 模式和命令是否相同。
        */ (item) => item.mode === previousMode && item.command === action.command)?.id || action.id;
      try {
        if (Array.isArray(action.command) || (this.editor.advanced ? !supportsCommand(action.command) : !['left','right','up','down','word','backword','select','insert','delete','undo','normal'].includes(basicId))) throw new Error('此命令不在当前真实编辑引擎范围；请在完整目录做知识练习，并在原生 Helix 实际执行。');
        this.editor = applyAction(this.editor, this.editor.advanced ? action.command : basicId, args);
        /**
         * 真实参数与课程要求的精确匹配结果。
         * @type {boolean}
         */ const parametersMatch = !expected?.args || Object.entries(expected.args).every(/**
          * 用户输入是否精确匹配。
          * @param {[string,string|number]} entry 预期参数键值。
          * @returns {boolean} 用户输入是否精确匹配。
          */ (entry) => (args[entry[0]] ?? (entry[0] === 'count' ? 1 : undefined)) === entry[1]);
        if (expected?.mode === previousMode && expectedCommand === action.command && parametersMatch) { this.stepIndex++; this.typed = ''; this.feedback = { kind: 'neutral', text: `已执行：${action.label}。继续下一步。` }; }
        else this.feedback = { kind: 'error', text: `刚执行了 ${Array.isArray(action.command) ? action.command.join(' → ') : action.command}（${JSON.stringify(args)}）。操作已真实生效，但与本步要求不同；可检查文本或重新练习。` };
      } catch (error) { this.feedback = { kind: 'error', text: error instanceof Error ? error.message : String(error) }; }
      this.pending = []; this.countInput = ''; this.operandAction = null; this.checkComplete();
    },
    /**
     * 文本、粘贴、输入法确认与退格统一经过真实课程校验。
     * @param {string} text 已确认的文本。
     * @param {boolean} erase 是否执行退格。
     * @returns {void}
     */
    typeText(text, erase = false) {
      this.pending = []; this.countInput = ''; if (this.editor.mode !== 'insert' || this.success) return;
      this.editor = erase ? backspace(this.editor) : insertText(this.editor, text);
      /**
       * 文本输入的步骤推进结果。
       * @type {ReturnType<typeof updateTextProgress>}
       */ const progress = updateTextProgress(this.lesson.steps, this.stepIndex, this.typed, text, erase);
      this.stepIndex = progress.stepIndex; this.typed = progress.typed;
      if (progress.status === 'matched') this.feedback = { kind: 'neutral', text: '文字输入正确。现在切换回普通模式。' };
      else if (progress.status === 'mismatch') this.feedback = { kind: 'error', text: `文字还不匹配，需要输入 ${JSON.stringify(progress.expected)}。可用 Backspace 修正，或重新练习。` };
      else if (progress.status === 'typing') this.feedback = { kind: 'neutral', text: `已输入 ${this.typed.length} / ${progress.expected.length} 个字符（包括空格）。` };
      else this.feedback = { kind: 'error', text: '文字已插入。请按照当前步骤切换模式，或重新练习。' };
      this.checkComplete();
    },
    /**
     * 在引擎回调前提交按键序列与计数状态，插入快速路径也遵循此顺序。
     * @param {string} key 规范化的按键。
     * @param {string|undefined} rawText 可打印字符。
     * @param {boolean} fresh 是否开始屏幕按钮序列。
     * @returns {void}
     */
    feedKey(key, rawText, fresh = false) {
      if (this.operandAction || this.success) return;
      /**
       * 按键前缀与输入解析结果。
       * @type {ReturnType<typeof resolvePracticeInput>}
       */ const result = resolvePracticeInput({ bindings: this.bindings, mode: this.editor.mode, advanced: this.editor.advanced, pending: this.pending, countInput: this.countInput, key, rawText, fresh });
      this.pending = result.pending; this.countInput = result.countInput;
      if (result.status === 'action') { this.beginAction(result.action); return; }
      if (result.status === 'text') { this.typeText(result.text); return; }
      if (result.status === 'count') return;
      this.feedback = result.status === 'prefix' ? { kind: 'neutral', text: `已输入前缀 ${displayKey(result.sequence)}，请继续按下一键。Esc 可以取消未完成前缀。` } : result.status === 'cancel' ? { kind: 'neutral', text: '已取消按键前缀或计数，练习状态不变。' } : { kind: 'error', text: `${displayKey(result.sequence)} 未绑定到当前模式的练习操作。请查看右侧提示或下方可用按键。` };
    },
    /**
     * 打开独立的可编辑键位草稿。
     * @param {string} modal 对话框名称。
     * @returns {void}
     */
    openModal(modal) { this.modal = modal; this.settingsMessage = ''; this.draft = { ...this.bindings }; },
    /**
     * 联合验证三种模式，只清除已修改绑定的回忆记录。
     * @returns {boolean} 是否保存成功。
     */
    saveBindings() {
      /**
       * 全部三模式键位校验结果。
       * @type {ReturnType<typeof validateBindings>}
       */ const checked = validateBindings(this.draft);
      if (!checked.valid) return false;
      /**
       * 修改前的键位快照。
       * @type {Record<string,string>}
       */ const previous = this.bindings;
      this.bindings = checked.values;
      this.knowledge = this.knowledge.filter(/**
       * 知识记录是否仍有效。
       * @param {string} id 知识题标识。
       * @returns {boolean} 知识记录是否仍有效。
       */ (id) => !id.startsWith('binding:') || previous[id.slice(8)] === this.bindings[id.slice(8)]);
      this.persist(); this.modal = ''; this.startLesson(this.lesson.id); this.feedback = { kind: 'neutral', text: '键位已保存；题目提示与按键已同步更新。本课已重新开始。' }; return true;
    },
    /**
     * 构建文章、绑定与命令题，不伪造原生编辑执行。
     * @param {string} id 知识题标识。
     * @returns {void}
     */
    chooseQuestion(id) {
      this.recallAnswer = ''; this.recallRevealed = false; this.pending = [];
      this.question = recallQuestion(id, this.bindings);
    },
    /**
     * 正确答案仅计入一次进度。
     * @param {boolean} correct 答案是否正确。
     * @returns {void}
     */
    answerQuestion(correct) { this.recallAnswer = correct ? 'correct' : 'wrong'; this.pending = []; if (correct && this.question && !this.knowledge.includes(this.question.id)) { this.knowledge.push(this.question.id); this.persist(); } },
    /**
     * 下一题只从文章题库中选取。
     * @returns {string} 下一道文章题标识。
     */
    nextQuestionId() { return nextArticleQuestion(this.knowledge, this.question?.id).id; },
  },
});
