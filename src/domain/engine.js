import {
  ADVANCED_LESSONS,
  advancedBackspace,
  advancedInsertText,
  executeAdvanced,
  supportsCommand,
} from "./advanced.js";
import { ARTICLE_CHAPTERS, ARTICLE_QUESTIONS, articleSource } from "./article.js";
import {
  actionForCommand,
  actionsFor,
  ALL_COMMANDS,
  bindingId,
  migrateBindings,
} from "./bindings.js";
/** 保留课程分组标识的分类显示数据。
 * @type {import('./types.js').Category[]}
 */
export const CATEGORIES = [
  {
    id: "all",
    label: "全部练习",
    icon: "◈",
    description: "循序渐进，建立肌肉记忆",
  },
  {
    id: "move",
    label: "光标移动",
    icon: "↗",
    description: "先找到要修改的位置",
  },
  {
    id: "select",
    label: "选择优先",
    icon: "▣",
    description: "先选择，再执行操作",
  },
  {
    id: "edit",
    label: "编辑与模式",
    icon: "⌘",
    description: "在三种模式间自如切换",
  },
  {
    id: "advanced",
    label: "进阶编辑挑战",
    icon: "✳",
    description: "真正改变文本、选区和寄存器",
  },
];
/** 声明可重复的基础命令步骤。
 * @type {(mode: import('./types.js').Mode, action: string, count?: number) => import('./types.js').LessonStep[]}
 * @param {import('./types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string} action - 课程实际执行的基础动作标识，不是动作记录对象。
 * @param {number} [count] - 重复生成相同命令步骤的次数，默认一次。
 * @returns {import('./types.js').LessonStep[]} 按执行顺序展开、模式与动作保持一致的独立课程步骤。
 */
const step = (mode, action, count = 1) =>
  Array.from({ length: count }, /** 按索引生成固定数量的真实记录。
   * @returns {{ mode: import('./types.js').Mode; action: string; }} 返回该操作的实际计算结果。
   */
  () => ({ mode, action })).flat();
/** 声明基础课程的独立目标状态。
 * @type {(text: string, anchor: number, head?: number, mode?: import('./types.js').Mode) => import('./types.js').EditorSnapshot}
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} anchor - 选区固定端的包含式偏移。
 * @param {number} [head] - 选区光标端的包含式偏移。
 * @param {import('./types.js').Mode} [mode] - 当前按键配置所属的编辑模式。
 * @returns {import('./types.js').EditorSnapshot} 返回该操作的实际计算结果。
 */
const goal = (text, anchor, head = anchor, mode = "normal") => ({
  text, anchor, head, mode,
});
/** 具有原始文本与独立目标的完整基础课程。
 * @type {import('./types.js').Lesson[]}
 */
const BASIC_LESSONS = [
  {
    id: "right",
    category: "move",
    title: "从一个字符开始",
    description:
      "把光标从 h 移到 l（第 3 个字符）。Helix 的普通模式也始终有一个选区。",
    text: "hello, helix",
    cursor: 0,
    steps: step("normal", "right", 2),
    goal: goal("hello, helix", 2),
    concept: "单字符也是选区",
    tip: "高亮方块就是当前选区。移动时，选择也随之移动。",
  },
  {
    id: "left",
    category: "move",
    title: "往回走一步",
    description: "把光标从 x 移到 i，熟悉左右移动。",
    text: "helix",
    cursor: 4,
    steps: step("normal", "left", 1),
    goal: goal("helix", 3),
    concept: "手指留在主键区",
    tip: "不需要方向键，主键区就能完成基本移动。",
  },
  {
    id: "vertical",
    category: "move",
    title: "在行间穿梭",
    description: "先向下，再向上，回到第一行的起点。",
    text: "read\nselect\nedit",
    cursor: 0,
    steps: [...step("normal", "down"), ...step("normal", "up")],
    goal: goal("read\nselect\nedit", 0),
    concept: "保持所在列",
    tip: "上下移动会保留目标列；短行会把光标限制在行尾。",
  },
  {
    id: "words",
    category: "move",
    title: "以单词为单位",
    description:
      "连续两次向前移动到下一个词首，再反向移动一次。观察移动经过的文字如何变成选区。",
    text: "learn helix today",
    cursor: 0,
    steps: [...step("normal", "word", 2), ...step("normal", "backword")],
    goal: goal("learn helix today", 11, 6),
    concept: "让移动更有语义",
    tip: "向前词移动选择到下一个词首之前，包含词后的空格，但不包含下一个词的第一个字符。光标显示在选区内最后一个字符上。",
  },
  {
    id: "select",
    category: "select",
    title: "先选择，再行动",
    description: "进入选择模式，再向右扩展两次，选中 cat。",
    text: "cat nap",
    cursor: 0,
    steps: [...step("normal", "select"), ...step("select", "right", 2)],
    goal: goal("cat nap", 0, 2, "select"),
    concept: "选择 → 操作",
    tip: "选择模式会固定一端，移动另一端。Helix 的核心不是“做什么”，而是先明确“对什么做”。",
  },
  {
    id: "delete-word",
    category: "select",
    title: "让多余的词消失",
    description: "选中 red（三个字符），然后删除。空格会保留。",
    text: "red blue",
    cursor: 0,
    steps: [
      ...step("normal", "select"),
      ...step("select", "right", 2),
      ...step("select", "delete"),
    ],
    goal: goal(" blue", 0),
    concept: "操作作用于选区",
    tip: "删除作用于整个选区，而不只是光标所在的字符。删除后返回普通模式。",
  },
  {
    id: "cancel",
    category: "select",
    title: "退出选择模式",
    description: "进入选择模式，向右扩展一次，再返回普通模式。",
    text: "focus",
    cursor: 0,
    steps: [
      ...step("normal", "select"),
      ...step("select", "right"),
      ...step("select", "normal"),
    ],
    goal: goal("focus", 0, 1),
    concept: "模式改变按键含义",
    tip: "返回普通模式不会自动清空选区；下一次逐字符移动才会折叠选区。",
  },
  {
    id: "delete-char",
    category: "edit",
    title: "删除一个多余字符",
    description: "删掉 helllo 中选中的多余 l，得到 hello。",
    text: "helllo",
    cursor: 3,
    steps: step("normal", "delete"),
    goal: goal("hello", 3),
    concept: "普通模式也能编辑",
    tip: "普通模式中的单字符选区同样可以直接删除。",
  },
  {
    id: "insert",
    category: "edit",
    title: "写下第一个字符",
    description:
      "在 world 前插入 hi ，然后返回普通模式。注意 hi 后面有一个空格。",
    text: "world",
    cursor: 0,
    steps: [
      ...step("normal", "insert"),
      { type: "text", text: "hi " },
      ...step("insert", "normal"),
    ],
    goal: goal("hi world", 2),
    concept: "插入模式才输入文字",
    tip: "先进入插入模式，再输入文字。退出后，新输入的末尾字符成为选区。",
  },
  {
    id: "undo",
    category: "edit",
    title: "放心尝试，随时撤销",
    description: "删除选中的 !，再撤销这次编辑。",
    text: "hello!",
    cursor: 5,
    steps: [...step("normal", "delete"), ...step("normal", "undo")],
    goal: goal("hello!", 5),
    concept: "编辑可以反悔",
    tip: "撤销恢复上一次编辑前的内容和选区。移动本身不进入撤销历史。",
  },
  {
    id: "combine",
    category: "edit",
    title: "一次完整的小修改",
    description:
      "向右移到 a，删除它；进入插入模式输入 o，再返回普通模式。把 cat 改成 cot。",
    text: "cat",
    cursor: 0,
    steps: [
      ...step("normal", "right"),
      ...step("normal", "delete"),
      ...step("normal", "insert"),
      { type: "text", text: "o" },
      ...step("insert", "normal"),
    ],
    goal: goal("cot", 1),
    concept: "定位 → 选择 → 编辑",
    tip: "这是一个真正的小编辑任务：光标移动、删除、插入和模式切换组合在一起。",
  },
];
/** 按稳定课程标识索引的基础与高级课程。
 * @type {Map<string, import('./types.js').Lesson>}
 */
const lessonsById = new Map(
  [...BASIC_LESSONS, ...ADVANCED_LESSONS].map(/** 将 [...BASIC_LESSONS, ...ADVANCED_LESSONS] 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
   * @returns {[string, import('./types.js').Lesson]} 返回该操作的实际计算结果。
   */
  (lesson) => [lesson.id, lesson]),
);
/** 按原文章节顺序排列的全部课程。
 * @type {import('./types.js').Lesson[]}
 */
export const LESSONS = ARTICLE_CHAPTERS.flatMap(/** 将 ARTICLE_CHAPTERS 中的记录转换为本次操作需要的结果。
 * @param {import('./types.js').ArticleChapter} chapter - 原文章节的稳定标识。
 * @returns {{ source: import('./types.js').ArticleSource; id?: string | undefined; category?: string | undefined; title?: string | undefined; description?: string | undefined; text?: string | undefined; cursor?: number | undefined; steps?: import('./types.js').LessonStep[] | undefined; goal?: (import('./types.js').EditorSnapshot & { registers?: Record<string, string[]>; }) | undefined; concept?: string | undefined; tip?: string | undefined; advanced?: boolean; theme?: string; }[]} 返回该操作的实际计算结果。
 */
(chapter) =>
  chapter.lessons.map(/** 将 chapter.lessons 中的记录转换为本次操作需要的结果。
   * @param {string} id - 不会覆盖现有配置的稳定记录标识。
   * @returns {{ source: import('./types.js').ArticleSource; id?: string | undefined; category?: string | undefined; title?: string | undefined; description?: string | undefined; text?: string | undefined; cursor?: number | undefined; steps?: import('./types.js').LessonStep[] | undefined; goal?: (import('./types.js').EditorSnapshot & { registers?: Record<string, string[]>; }) | undefined; concept?: string | undefined; tip?: string | undefined; advanced?: boolean; theme?: string; }} 返回该操作的实际计算结果。
   */
  (id) => ({
    ...lessonsById.get(id),
    source: articleSource(chapter.id),
  })),
);

/** 从课程初始文本创建可持久练习的编辑状态。
 * @param {import('./types.js').StateSeed} lesson - 包含初始文本与独立目标的完整课程。
 * @returns {import('./types.js').EditorState} 普通模式、空撤销历史和初始光标；仅高级课程额外初始化多选区、寄存器和重做容器。
 */
export function createState(lesson) {
  return {
    text: lesson.text,
    anchor: lesson.cursor,
    head: lesson.cursor,
    mode: "normal",
    history: [],
    goalColumn: null,
    wordBoundary: null,
    ...(lesson.advanced || lesson.category === "advanced"
      ? {
          selections: [{ anchor: lesson.cursor, head: lesson.cursor }],
          registers: {},
          redo: [],
          advanced: true,
        }
      : {}),
  };
}
/** 取得基础选区包含两端的正向边界。
 * @param {import('./types.js').EditorSnapshot} state - 实际编辑引擎的当前状态。
 * @returns {[number, number]} 不改变选区方向、仅按从小到大排列的包含式起止偏移。
 */
export function selection(state) {
  return [
    Math.min(state.anchor, state.head),
    Math.max(state.anchor, state.head),
  ];
}
/** 保存基础编辑撤销所需的状态。
 * @param {import('./types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @returns {import('./types.js').EditorSnapshot} 返回该操作的实际计算结果。
 */
function snapshot(state) {
  return {
    text: state.text,
    anchor: state.anchor,
    head: state.head,
    mode: "normal",
    wordBoundary: state.wordBoundary,
    goalColumn: state.goalColumn,
  };
}
/** 将光标偏移限制在缓冲区范围内。
 * @type {(arg0: number, arg1: number) => number}
 * @param {number} value - 本次实际输入、读取或比较的值。
 * @param {number} max - max 对应的实际输入记录。
 * @returns {number} 返回该操作的实际计算结果。
 */
const clamp = (value, max) => Math.max(0, Math.min(value, Math.max(0, max)));
/** 计算当前行起点、结尾和列号。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} position - 当前字符或插入点的原始位置。
 * @returns {import('./types.js').LinePosition} 返回该操作的实际计算结果。
 */
function linePosition(text, position) {
  /** 当前范围的起始偏移。
   * @type {number}
   */
  const start = position <= 0 ? 0 : text.lastIndexOf("\n", position - 1) + 1;
  /** 本次操作的后继状态或边界。
   * @type {number}
   */
  const next = text.indexOf("\n", position);
  return {
    start,
    end: next < 0 ? text.length : next,
    column: position - start,
  };
}
/** 按字符类别选择到下一个词首之前。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} position - 当前字符或插入点的原始位置。
 * @returns {number} 返回该操作的实际计算结果。
 */
function wordNext(text, position) {
  /** 顺序遍历的当前索引。
   * @type {number}
   */
  let i = position;
  /** 区分单词、空白及标点字符。
   * @type {(arg0: string) => number}
   * @param {string} c - 当前遍历的官方命令记录。
   * @returns {number} 返回该操作的实际计算结果。
   */
  const kind = (c) => (/[\p{L}\p{N}_]/u.test(c) ? 1 : /\s/u.test(c) ? 0 : 2);
  /** 起始字符所属的边界类别。
   * @type {number}
   */
  const initial = kind(text[i] || " ");
  while (i < text.length && kind(text[i]) === initial) i++;
  while (i < text.length && /\s/u.test(text[i])) i++;
  return clamp(i, text.length);
}
/** 跳过空白并找到前一个同类词的起点。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} position - 当前字符或插入点的原始位置。
 * @returns {number} 返回该操作的实际计算结果。
 */
function wordPrevious(text, position) {
  /** 顺序遍历的当前索引。
   * @type {number}
   */
  let i = Math.max(0, position - 1);
  while (i > 0 && /\s/u.test(text[i])) i--;
  /** 区分单词、空白及标点字符。
   * @type {(arg0: string) => number}
   * @param {string} c - 当前遍历的官方命令记录。
   * @returns {number} 返回该操作的实际计算结果。
   */
  const kind = (c) => (/[\p{L}\p{N}_]/u.test(c) ? 1 : 2);
  /** 起始字符所属的边界类别。
   * @type {number}
   */
  const initial = kind(text[i] || " ");
  while (i > 0 && !/\s/u.test(text[i - 1]) && kind(text[i - 1]) === initial)
    i--;
  return i;
}
/** 执行基础动作或转交真实高级命令引擎。
 * @param {import('./types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @param {string} action - 基础动作标识或已实现的高级官方命令名，不是绑定记录对象。
 * @param {import('./types.js').CommandArgs} [args] - 实际交给命令引擎执行的参数。
 * @returns {import('./types.js').EditorState} 原状态副本上的真实移动或编辑结果；未实现的命令抛出异常，不伪造完成状态。
 */
export function applyAction(state, action, args = {}) {
  /** 从配置中解析出的实际命令。
   * @type {string | string[]}
   */
  const command =
    actionForCommand(undefined, state.mode, action)?.command || action;
  if (state.advanced && supportsCommand(command))
    return executeAdvanced(state, command, args);
  if (
    state.advanced ||
    ![
      "left",
      "right",
      "up",
      "down",
      "word",
      "backword",
      "select",
      "normal",
      "insert",
      "delete",
      "undo",
    ].includes(action)
  ) {
    throw new Error(`当前编辑引擎未实现命令：${command}`);
  }
  /** 本次操作的后继状态或边界。
   * @type {{ history: import('./types.js').EditorSnapshot[]; text: string; anchor: number; head: number; mode: import('./types.js').Mode; wordBoundary?: number | null; goalColumn?: number | null; selections?: import('./types.js').Selection[]; primaryIndex?: number; goalColumns?: (number | null)[]; advanced?: boolean; redo?: import('./types.js').EditorSnapshot[]; registers?: Record<string, string[]>; macros?: Record<string, import('./types.js').MacroEvent[]>; macroRecording?: { register: string; events: import('./types.js').MacroEvent[]; } | null; macroStack?: string[]; searchPattern?: string; lastMotion?: { command: string; args: import('./types.js').CommandArgs; }; indentWidth?: number; }}
   */
  const next = { ...state, history: [...state.history] };
  if (action === "undo") {
    /** 上一条可供恢复或合并的记录。
     * @type {import('./types.js').EditorSnapshot | undefined}
     */
    const previous = next.history.pop();
    if (previous) Object.assign(next, previous);
    return next;
  }
  if (action === "select") {
    next.mode = "select";
    return next;
  }
  if (action === "normal") {
    if (next.mode === "insert")
      next.head = next.anchor = clamp(next.head - 1, next.text.length - 1);
    next.mode = "normal";
    return next;
  }
  if (action === "insert") {
    next.history.push(snapshot(next));
    next.head = next.anchor = selection(next)[0];
    next.wordBoundary = null;
    next.mode = "insert";
    return next;
  }
  if (action === "delete") {
    next.history.push(snapshot(next));
    /** 按既定顺序解构当前记录的边界、标识或测试参数。
     * @type {[number, number]}
     */
    const [from, to] = selection(next);
    next.text = next.text.slice(0, from) + next.text.slice(to + 1);
    next.head = next.anchor = clamp(from, next.text.length - 1);
    next.mode = "normal";
    next.goalColumn = null;
    next.wordBoundary = null;
    return next;
  }
  /** 本次移动最终到达的位置。
   * @type {number}
   */
  let target = next.head;
  /** 当前字符或插入点的原始位置。
   * @type {import('./types.js').LinePosition}
   */
  const position = linePosition(next.text, next.head);
  if (action === "right")
    target = Math.min(
      next.head + 1,
      Math.max(position.start, position.end - 1),
    );
  if (action === "left") target = Math.max(position.start, next.head - 1);
  if (action === "word" || action === "backword") {
    // 词移动保留排他边界，显示的光标端点则包含在选区内。
    /** 上一次词移动保留的排他边界。
     * @type {number}
     */
    const origin = next.wordBoundary ?? next.head;
    /** 本次词移动得到的排他边界。
     * @type {number}
     */
    const boundary =
      action === "word"
        ? wordNext(next.text, origin)
        : wordPrevious(next.text, origin);
    if (next.mode !== "select")
      next.anchor = clamp(
        action === "word" ? origin : Math.max(boundary, origin - 1),
        next.text.length - 1,
      );
    next.head = clamp(
      action === "word" ? Math.max(origin, boundary - 1) : boundary,
      next.text.length - 1,
    );
    next.wordBoundary = boundary;
    next.goalColumn = null;
    return next;
  }
  next.wordBoundary = null;
  if (action === "down" || action === "up") {
    /** 跨行移动时保留的目标列。
     * @type {number}
     */
    const column = next.goalColumn ?? position.column;
    /** 当前范围的起始偏移。
     * @type {number}
     */
    let start = position.start;
    if (action === "down" && position.end < next.text.length)
      start = position.end + 1;
    if (action === "up" && start > 0)
      start = next.text.lastIndexOf("\n", Math.max(-1, start - 2)) + 1;
    /** 当前范围的终止偏移。
     * @type {number}
     */
    const end = next.text.indexOf("\n", start);
    target = Math.min(
      start + column,
      Math.max(start, (end < 0 ? next.text.length : end) - 1),
    );
    next.goalColumn = column;
  } else next.goalColumn = null;
  if (next.mode !== "select") next.anchor = target;
  next.head = target;
  return next;
}

/** 在插入模式写入用户实际输入的文本。
 * @param {import('./types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @param {string} text - 本次实际处理的文字内容。
 * @returns {import('./types.js').EditorState} 插入后的文本与新插入点；非插入模式返回原对象，高级状态使用多光标插入语义。
 */
export function insertText(state, text) {
  if (state.advanced) return advancedInsertText(state, text);
  if (state.mode !== "insert") return state;
  return {
    ...state,
    text: state.text.slice(0, state.head) + text + state.text.slice(state.head),
    head: state.head + text.length,
    anchor: state.head + text.length,
  };
}
/** 删除插入点前的字符并更新选区。
 * @param {import('./types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @returns {import('./types.js').EditorState} 真实删除后的文本与插入点；非插入模式或基础状态光标位于零时原样返回。
 */
export function backspace(state) {
  if (state.advanced) return advancedBackspace(state);
  if (state.mode !== "insert" || state.head === 0) return state;
  return {
    ...state,
    text: state.text.slice(0, state.head - 1) + state.text.slice(state.head),
    head: state.head - 1,
    anchor: state.head - 1,
  };
}
/** 将课程独立目标补齐为完整编辑状态。
 * @param {import('./types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
 * @returns {import('./types.js').EditorState} 以初始状态补齐容器、再叠加独立目标文本与选区的完整比较目标。
 */
export function goalFor(lesson) {
  return { ...createState(lesson), ...lesson.goal };
}
/** 比较文本、方向、模式及要求的多选区和寄存器。
 * @param {import('./types.js').EditorSnapshot & {registers?: Record<string, string[]>}} state - 实际编辑引擎的当前状态。
 * @param {import('./types.js').EditorSnapshot & {registers?: Record<string, string[]>}} goal - 课程要求达到的独立目标状态。
 * @returns {boolean} 文本、两端偏移、模式以及目标明确要求的选区、寄存器和主选区全部一致时为真。
 */
export function matchesGoal(state, goal) {
  return (
    ["text", "head", "anchor", "mode"].every(
      /** 检查 ["text", "head", "anchor", "mode"] 是否满足当前操作的完整条件。
       * @param {string} key - 当前按键或配置键名。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (key) => state[key] === goal[key],
    ) &&
    (!goal.selections ||
      JSON.stringify(state.selections) === JSON.stringify(goal.selections)) &&
    (!goal.registers ||
      Object.entries(goal.registers).every(
        /** 检查 Object.entries(goal.registers) 是否满足当前操作的完整条件。
         * @param {[string, string[]]} options - 本次操作的完整参数。
         * @returns {boolean} 返回该操作的实际计算结果。
         */
        ([key, value]) =>
          JSON.stringify(state.registers?.[key]) === JSON.stringify(value),
      )) &&
    (goal.primaryIndex === undefined ||
      (state.primaryIndex || 0) === goal.primaryIndex)
  );
}

/** 与既有本地学习进度兼容的存储键。
 * @type {string}
 */
export const STORAGE_KEY = "helix-lab-v1";
/** 读取原存储格式并迁移旧版键位与已知进度。
 * @param {import('./types.js').StorageReader} storage - 本地记录的实际读写接口。
 * @param {(input: import('./types.js').Bindings | import('./types.js').JsonValue | undefined) => import('./types.js').BindingValidation} validate - 校验未信任存储配置、返回规范化键位与错误的纯函数。
 * @param {import('./types.js').Bindings} defaults - 与旧记录兼容的完整默认键位。
 * @returns {import('./types.js').SavedState} 有效记录的去重课程与知识进度；缺失记录用默认值，损坏或受限存储额外返回明确 warning。
 */
export function loadSaved(storage, validate, defaults) {
  try {
    /** 从真实本地存储读取、尚未进行 JSON 解析的原始记录。
     * @type {string | null | undefined}
     */
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw)
      return { bindings: { ...defaults }, completed: [], restored: false };
    /** 尚未校验版本、结构或字段内容的 JSON 值，可为空值、标量、数组或记录。
     * @type {import('./types.js').JsonValue}
     */
    const data = JSON.parse(raw);
    if (![1, 2].includes(data?.version) || !Array.isArray(data.completed))
      throw new Error("invalid saved data");
    /** 按旧版兼容规则恢复后的完整键位。
     * @type {import('./types.js').Bindings}
     */
    const restoredBindings =
      data.version === 1 ? migrateBindings(data.bindings) : data.bindings;
    if (!validate(restoredBindings).valid)
      throw new Error("invalid saved bindings");
    /** 当前应用实际识别的知识进度标识集合。
     * @type {Set<string>}
     */
    const knownKnowledge = new Set([
      ...ARTICLE_QUESTIONS.map(/** 将 ARTICLE_QUESTIONS 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').RecallQuestion} question - 当前需要返回或比较的知识题。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (question) => question.id),
      ...ALL_COMMANDS.map(/** 将 ALL_COMMANDS 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').CatalogCommand} command - 从配置中解析出的实际命令。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (command) => `command:${command.name}`),
      ...actionsFor(restoredBindings).map(
        /** 将 actionsFor(restoredBindings) 中的记录转换为本次操作需要的结果。
         * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
         * @returns {string} 返回该操作的实际计算结果。
         */
        (action) => `binding:${bindingId(action)}`,
      ),
    ]);
    return {
      bindings: validate(restoredBindings).values,
      completed: [
        ...new Set(
          data.completed.filter(/** 依据实际条件筛选 data.completed 中的有效记录。
           * @param {string} id - 不会覆盖现有配置的稳定记录标识。
           * @returns {boolean} 返回该操作的实际计算结果。
           */
          (id) => LESSONS.some(/** 检查 LESSONS 是否满足当前操作的完整条件。
           * @param {import('./types.js').Lesson} l - l 对应的实际输入记录。
           * @returns {boolean} 返回该操作的实际计算结果。
           */
          (l) => l.id === id)),
        ),
      ],
      restored: true,
      knowledge: Array.isArray(data.knowledge)
        ? [...new Set(data.knowledge.filter(/** 依据实际条件筛选 data.knowledge 中的有效记录。
         * @param {string} id - 不会覆盖现有配置的稳定记录标识。
         * @returns {boolean} 返回该操作的实际计算结果。
         */
        (id) => knownKnowledge.has(id)))]
        : [],
      warning:
        data.version === 1
          ? "旧版记录已迁移到完整键位库；保留自定义键，冲突的其他默认键已移除。请在设置中检查。"
          : "",
    };
  } catch {
    return {
      bindings: { ...defaults },
      completed: [],
      restored: false,
      warning: "无法读取本地记录，已使用默认键位。当前练习仍可正常使用。",
    };
  }
}
/** 保存原版本二格式；存储受限时明确返回失败。
 * @param {import('./types.js').StorageWriter} storage - 本地记录的实际读写接口。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @param {string[]} completed - 已经完成的稳定课程标识。
 * @param {string[]} [knowledge] - 已经掌握的稳定知识题标识。
 * @returns {boolean} 版本二记录写入成功时为真；存储受限或序列化失败时为假，不更换旧存储键。
 */
export function saveState(storage, bindings, completed, knowledge = []) {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, bindings, completed, knowledge }),
    );
    return true;
  } catch {
    return false;
  }
}
