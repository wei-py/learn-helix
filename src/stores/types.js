/**
 * 引用真实编辑引擎的完整状态。
 * @typedef {import('../domain/types.js').EditorState} EditorState
 */
/**
 * 引用当前模式的真实键位操作。
 * @typedef {import('../domain/types.js').BindingAction} BindingAction
 */
/**
 * 引用文章与目录统一回忆题结构。
 * @typedef {import('../domain/types.js').RecallQuestion} RecallQuestion
 */
/**
 * 单个浏览器历史项的回忆草稿，不代表新一轮题目已经回答。
 * @typedef {{answer:string,revealed:boolean}} RecallContext
 */
/**
 * 保存真实学习状态、临时表单和历史页面上下文。
 * @typedef {object} LearningState
 * @property {import('../domain/types.js').Bindings} bindings 当前生效的完整键位。
 * @property {string[]} completed 已完成的真实课程标识。
 * @property {string[]} knowledge 已掌握的文章与目录知识标识。
 * @property {string} notice 存储迁移或持久化失败提示。
 * @property {number} lessonIndex 当前真实课程序号。
 * @property {EditorState} editor 真实编辑引擎状态。
 * @property {number} stepIndex 当前已完成的步骤数。
 * @property {string} typed 当前文字步骤的实际输入。
 * @property {string[]} pending 尚未完成的按键前缀。
 * @property {boolean} success 当前课程是否精确完成。
 * @property {{kind:string,text:string}} feedback 真实操作反馈。
 * @property {BindingAction|null} operandAction 等待用户输入参数的命令。
 * @property {number} operandCount 参数表单中的实际计数。
 * @property {string} countInput 下一条命令的计数前缀。
 * @property {string} insertBuffer 触屏文字输入草稿。
 * @property {boolean} hintVisible 是否显示步骤提示。
 * @property {boolean} answerVisible 是否显示只读答案。
 * @property {string} category 当前课程分类。
 * @property {string} modal 当前打开的独立对话框。
 * @property {import('../domain/types.js').Bindings} draft 尚未保存的键位草稿。
 * @property {string} settingsMessage 设置与导出操作反馈。
 * @property {RecallQuestion|null} question 当前真实回忆题。
 * @property {string} recallAnswer 当前回忆题作答结果。
 * @property {boolean} recallRevealed 是否展开当前回忆题答案。
 * @property {Record<string,RecallContext>} recallContexts 按历史项隔离、最多八十份的临时回忆上下文。
 * @property {string} recallRestoreKey 仅浏览器后退或前进允许恢复的历史项，普通进入为空。
 */
/**
 * 表示包含式选区中的单个字符。
 * @typedef {{position:number,value:string,selected:boolean,head:boolean,caret:boolean,label?:string}} EditorCharacter
 */
/**
 * 表示包含字符光标模型的代码行。
 * @typedef {{number:number,characters:EditorCharacter[]}} EditorLine
 */
export {};
