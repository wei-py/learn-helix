import {
  ADVANCED_LESSONS,
  executeAdvanced,
  supportsCommand,
  advancedInsertText,
  advancedBackspace,
} from "./advanced.js";
import {
  actionForCommand,
  migrateBindings,
  ALL_COMMANDS,
  actionsFor,
  bindingId,
} from "./bindings.js";
import { ARTICLE_CHAPTERS, ARTICLE_QUESTIONS, articleSource } from "./article.js";
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
const step = (mode, action, count = 1) =>
  Array.from({ length: count }, () => ({ mode, action })).flat();
const goal = (text, anchor, head = anchor, mode = "normal") => ({
  text, anchor, head, mode,
});
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
const lessonsById = new Map(
  [...BASIC_LESSONS, ...ADVANCED_LESSONS].map((lesson) => [lesson.id, lesson]),
);
export const LESSONS = ARTICLE_CHAPTERS.flatMap((chapter) =>
  chapter.lessons.map((id) => ({
    ...lessonsById.get(id),
    source: articleSource(chapter.id),
  })),
);

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
export function selection(state) {
  return [
    Math.min(state.anchor, state.head),
    Math.max(state.anchor, state.head),
  ];
}
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
const clamp = (value, max) => Math.max(0, Math.min(value, Math.max(0, max)));
function linePosition(text, position) {
  const start = position <= 0 ? 0 : text.lastIndexOf("\n", position - 1) + 1;
  const next = text.indexOf("\n", position);
  return {
    start,
    end: next < 0 ? text.length : next,
    column: position - start,
  };
}
function wordNext(text, position) {
  let i = position;
  const kind = (c) => (/[\p{L}\p{N}_]/u.test(c) ? 1 : /\s/u.test(c) ? 0 : 2);
  const initial = kind(text[i] || " ");
  while (i < text.length && kind(text[i]) === initial) i++;
  while (i < text.length && /\s/u.test(text[i])) i++;
  return clamp(i, text.length);
}
function wordPrevious(text, position) {
  let i = Math.max(0, position - 1);
  while (i > 0 && /\s/u.test(text[i])) i--;
  const kind = (c) => (/[\p{L}\p{N}_]/u.test(c) ? 1 : 2);
  const initial = kind(text[i] || " ");
  while (i > 0 && !/\s/u.test(text[i - 1]) && kind(text[i - 1]) === initial)
    i--;
  return i;
}
export function applyAction(state, action, args = {}) {
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
  const next = { ...state, history: [...state.history] };
  if (action === "undo") {
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
    const [from, to] = selection(next);
    next.text = next.text.slice(0, from) + next.text.slice(to + 1);
    next.head = next.anchor = clamp(from, next.text.length - 1);
    next.mode = "normal";
    next.goalColumn = null;
    next.wordBoundary = null;
    return next;
  }
  let target = next.head;
  const position = linePosition(next.text, next.head);
  if (action === "right")
    target = Math.min(
      next.head + 1,
      Math.max(position.start, position.end - 1),
    );
  if (action === "left") target = Math.max(position.start, next.head - 1);
  if (action === "word" || action === "backword") {
    // Word motions retain an exclusive boundary; the rendered head is inclusive.
    const origin = next.wordBoundary ?? next.head;
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
    const column = next.goalColumn ?? position.column;
    let start = position.start;
    if (action === "down" && position.end < next.text.length)
      start = position.end + 1;
    if (action === "up" && start > 0)
      start = next.text.lastIndexOf("\n", Math.max(-1, start - 2)) + 1;
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
export function goalFor(lesson) {
  return { ...createState(lesson), ...lesson.goal };
}
export function matchesGoal(state, goal) {
  return (
    ["text", "head", "anchor", "mode"].every(
      (key) => state[key] === goal[key],
    ) &&
    (!goal.selections ||
      JSON.stringify(state.selections) === JSON.stringify(goal.selections)) &&
    (!goal.registers ||
      Object.entries(goal.registers).every(
        ([key, value]) =>
          JSON.stringify(state.registers?.[key]) === JSON.stringify(value),
      )) &&
    (goal.primaryIndex === undefined ||
      (state.primaryIndex || 0) === goal.primaryIndex)
  );
}

export const STORAGE_KEY = "helix-lab-v1";
export function loadSaved(storage, validate, defaults) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw)
      return { bindings: { ...defaults }, completed: [], restored: false };
    const data = JSON.parse(raw);
    if (![1, 2].includes(data?.version) || !Array.isArray(data.completed))
      throw new Error("invalid saved data");
    const restoredBindings =
      data.version === 1 ? migrateBindings(data.bindings) : data.bindings;
    if (!validate(restoredBindings).valid)
      throw new Error("invalid saved bindings");
    const knownKnowledge = new Set([
      ...ARTICLE_QUESTIONS.map((question) => question.id),
      ...ALL_COMMANDS.map((command) => `command:${command.name}`),
      ...actionsFor(restoredBindings).map(
        (action) => `binding:${bindingId(action)}`,
      ),
    ]);
    return {
      bindings: validate(restoredBindings).values,
      completed: [
        ...new Set(
          data.completed.filter((id) => LESSONS.some((l) => l.id === id)),
        ),
      ],
      restored: true,
      knowledge: Array.isArray(data.knowledge)
        ? [...new Set(data.knowledge.filter((id) => knownKnowledge.has(id)))]
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
