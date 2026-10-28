// Stateful training subset of Helix 25.07.1. Indices are inclusive UTF-16 offsets,
// matching the original trainer; insert-mode selections are insertion points.
const field = (name, label, required = true, defaultValue) => ({
  name,
  label,
  required,
  ...(defaultValue === undefined ? {} : { defaultValue }),
});
const interaction = (kind, prompt, fields) => ({ kind, prompt, fields });
const patterns = [
  "select_regex",
  "split_selection",
  "keep_selections",
  "remove_selections",
  "search",
  "rsearch",
];
const characters = [
  "find_next_char",
  "find_prev_char",
  "find_till_char",
  "till_prev_char",
  "extend_next_char",
  "extend_prev_char",
  "extend_till_char",
  "extend_till_prev_char",
  "replace",
  "surround_add",
];
const registers = [
  "yank",
  "delete_selection",
  "change_selection",
  "paste_before",
  "paste_after",
  "replace_with_yanked",
];
export const ADVANCED_INTERACTIONS = Object.fromEntries([
  ...patterns.map((command) => [
    command,
    interaction(
      "pattern",
      "输入正则表达式（JS Unicode 与 Rust regex 的常用交集；不支持环视、反向引用、Rust 专有语法或零宽匹配）",
      [field("pattern", "正则表达式")],
    ),
  ]),
  ...characters.map((command) => [
    command,
    interaction("character", "输入实际的目标字符", [field("char", "字符")]),
  ]),
  ...[
    "select_textobject_inner",
    "select_textobject_around",
    "surround_delete",
  ].map((command) => [
    command,
    interaction(
      "textobject",
      "简单词/成对符号对象：w / W / ()[]{}<> / 引号 / m；不解析语法树，也不忽略字符串中的括号",
      [field("object", "文本对象")],
    ),
  ]),
  [
    "surround_replace",
    interaction(
      "surround-replace",
      "简单成对符号：先输入原包围字符，再输入新包围字符；不解析语法树",
      [field("object", "原包围字符（或 m）"), field("char", "新包围字符")],
    ),
  ],
  ...registers.map((command) => [
    command,
    interaction("register", "可选：指定命名寄存器", [
      field("register", "寄存器", false, '"'),
    ]),
  ]),
  ...["record_macro", "replay_macro"].map((command) => [
    command,
    interaction("register", "指定宏寄存器；再次录制命令结束录制", [
      field("register", "宏寄存器", false, "@"),
    ]),
  ]),
]);

export function commandInteraction(command, includeOptional = false) {
  const interaction = ADVANCED_INTERACTIONS[command];
  return interaction &&
    (includeOptional || interaction.fields.some((field) => field.required))
    ? interaction
    : null;
}
const SIMPLE_COMMANDS = [
  "normal_mode",
  "exit_select_mode",
  "select_mode",
  "insert_mode",
  "append_mode",
  "insert_at_line_start",
  "insert_at_line_end",
  "delete_selection_noyank",
  "change_selection_noyank",
  "undo",
  "redo",
  "select_all",
  "split_selection_on_newline",
  "collapse_selection",
  "flip_selections",
  "ensure_selections_forward",
  "keep_primary_selection",
  "remove_primary_selection",
  "rotate_selections_forward",
  "rotate_selections_backward",
  "rotate_selection_contents_forward",
  "rotate_selection_contents_backward",
  "merge_selections",
  "merge_consecutive_selections",
  "trim_selections",
  "extend_line",
  "extend_line_below",
  "extend_line_above",
  "extend_to_line_bounds",
  "switch_case",
  "switch_to_uppercase",
  "switch_to_lowercase",
  "indent",
  "unindent",
  "join_selections",
  "join_selections_space",
  "search_next",
  "search_prev",
  "extend_search_next",
  "extend_search_prev",
  "search_selection",
  "repeat_last_motion",
  "move_char_left",
  "move_char_right",
  "extend_char_left",
  "extend_char_right",
  "move_visual_line_down",
  "move_visual_line_up",
  "extend_visual_line_down",
  "extend_visual_line_up",
  "move_line_down",
  "move_line_up",
  "extend_line_down",
  "extend_line_up",
  "goto_file_start",
  "goto_file_end",
  "extend_to_file_start",
  "extend_to_file_end",
  "goto_line_start",
  "goto_line_end",
  "goto_line_end_newline",
  "goto_first_nonwhitespace",
  "extend_to_line_start",
  "extend_to_line_end",
  "goto_column",
  "extend_to_column",
];
const COMMANDS = new Set([
  ...SIMPLE_COMMANDS,
  ...Object.keys(ADVANCED_INTERACTIONS),
]);
export const supportsCommand = (command) => COMMANDS.has(command);
export const ADVANCED_COMMANDS = [...COMMANDS];
const bounds = (range) => [
  Math.min(range.anchor, range.head),
  Math.max(range.anchor, range.head),
];
const clamp = (position, maximum) =>
  Math.max(0, Math.min(position, Math.max(0, maximum)));
const range = (from, to, reverse = false) =>
  reverse ? { anchor: to, head: from } : { anchor: from, head: to };
export function getSelections(state) {
  return (
    state.selections?.length
      ? state.selections
      : [{ anchor: state.anchor, head: state.head }]
  ).map((selection) => ({ ...selection }));
}
function clone(state) {
  return {
    ...state,
    selections: getSelections(state),
    primaryIndex: state.primaryIndex ?? 0,
    history: [...(state.history || [])],
    redo: [...(state.redo || [])],
    registers: { ...(state.registers || {}) },
    macros: { ...(state.macros || {}) },
    macroRecording: state.macroRecording
      ? { ...state.macroRecording, events: [...state.macroRecording.events] }
      : null,
  };
}
function setSelections(state, selections, primaryIndex = 0) {
  if (!selections.length) throw new Error("操作后没有剩余选区");
  const maximum = state.text.length;
  const sorted = selections
    .map((selection, index) => ({
      ...selection,
      anchor: clamp(selection.anchor, maximum),
      head: clamp(selection.head, maximum),
      primary: index === primaryIndex,
    }))
    .sort((a, b) => bounds(a)[0] - bounds(b)[0]);
  const merged = [];
  for (const selection of sorted) {
    const previous = merged.at(-1);
    if (previous && bounds(selection)[0] <= bounds(previous)[1]) {
      const start = bounds(previous)[0],
        end = Math.max(bounds(previous)[1], bounds(selection)[1]);
      const reverse =
        (selection.primary ? selection : previous).anchor >
        (selection.primary ? selection : previous).head;
      Object.assign(previous, range(start, end, reverse), {
        primary: previous.primary || selection.primary,
      });
    } else merged.push(selection);
  }
  state.primaryIndex = Math.max(
    0,
    merged.findIndex((selection) => selection.primary),
  );
  state.goalColumns = merged.map((selection) => selection.goalColumn ?? null);
  state.selections = merged.map(
    ({ primary, goalColumn, ...selection }) => selection,
  );
  Object.assign(state, state.selections[state.primaryIndex]);
  return state;
}
function capture(state) {
  return {
    text: state.text,
    selections: getSelections(state),
    primaryIndex: state.primaryIndex ?? 0,
    anchor: state.anchor,
    head: state.head,
    mode: "normal",
    goalColumn: state.goalColumn ?? null,
    goalColumns: [...(state.goalColumns || [])],
    wordBoundary: state.wordBoundary ?? null,
  };
}
function remember(state) {
  state.history.push(capture(state));
  state.redo = [];
}
function countOf(args) {
  const count = args.count === undefined ? 1 : Number(args.count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw new Error("次数必须是 1 到 10000 的整数");
  return count;
}
function character(args, key = "char") {
  if (typeof args[key] !== "string" || [...args[key]].length !== 1)
    throw new Error(
      `${key === "object" ? "文本对象" : "字符"}必须恰好是一个字符`,
    );
  return args[key];
}
function registerName(args, fallback = '"') {
  const name = args.register ?? fallback;
  if (typeof name !== "string" || !/^[a-zA-Z0-9"@]$/.test(name))
    throw new Error(
      '练习寄存器仅支持单个字母、数字、" 或 @（不访问系统剪贴板）',
    );
  return name;
}
function regex(pattern) {
  if (typeof pattern !== "string" || !pattern.length)
    throw new Error("请输入非空正则表达式");
  // Rust regex does not support backreferences/look-around; reject instead of
  // silently teaching JavaScript-only patterns as if they were Helix patterns.
  if (/\\[1-9]|\(\?(?:[=!]|<[=!])/.test(pattern))
    throw new Error("Helix 正则不支持反向引用或环视");
  try {
    return new RegExp(pattern, "gmu");
  } catch (error) {
    throw new Error(`无效正则表达式：${error.message}`);
  }
}
function matches(text, pattern, offset = 0) {
  const found = [...text.matchAll(regex(pattern))];
  if (found.some((match) => !match[0].length))
    throw new Error(
      "此编辑训练不支持零宽正则匹配；请在原生 Helix 中练习该边界",
    );
  return found.map((match) =>
    range(offset + match.index, offset + match.index + match[0].length - 1),
  );
}
function lineAt(text, position) {
  const start = position <= 0 ? 0 : text.lastIndexOf("\n", position - 1) + 1;
  const newline = text.indexOf("\n", position);
  return {
    start,
    end: newline < 0 ? text.length : newline,
    endWithNewline: newline < 0 ? text.length : newline + 1,
  };
}
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text[i] === "\n") starts.push(i + 1);
  return starts;
}
function selectedLines(state) {
  const starts = new Set();
  for (const selection of state.selections) {
    const [from, to] = bounds(selection);
    let start = lineAt(state.text, from).start;
    while (start <= to) {
      starts.add(start);
      const next = state.text.indexOf("\n", start);
      if (next < 0 || next + 1 > to) break;
      start = next + 1;
    }
  }
  return [...starts].sort((a, b) => a - b);
}
// Apply every change against the SAME original buffer; selection offsets are
// mapped once. This is essential when later selections move after earlier edits.
function edits(state, changes, explicitSelections) {
  const sorted = changes
    .map((change) => ({ ...change }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const unique = sorted.filter(
    (change, index) =>
      !index ||
      change.from !== sorted[index - 1].from ||
      change.to !== sorted[index - 1].to ||
      change.text !== sorted[index - 1].text,
  );
  for (let i = 1; i < unique.length; i++)
    if (unique[i].from < unique[i - 1].to)
      throw new Error("修改范围重叠，请先合并选区");
  if (!unique.length) return state;
  const before = state.text;
  let text = "",
    end = 0;
  for (const change of unique) {
    text += before.slice(end, change.from) + change.text;
    end = change.to;
  }
  text += before.slice(end);
  const map = (position, affinity = "right") => {
    let offset = 0;
    for (const change of unique) {
      if (
        position < change.from ||
        (position === change.from && affinity === "left")
      )
        break;
      if (
        position < change.to ||
        (change.from === change.to && position === change.from)
      )
        return (
          change.from + offset + (affinity === "right" ? change.text.length : 0)
        );
      offset += change.text.length - (change.to - change.from);
    }
    return position + offset;
  };
  state.text = text;
  const selections = explicitSelections
    ? explicitSelections(map)
    : state.selections.map((selection) => {
        if (state.mode === "insert")
          return range(map(selection.head), map(selection.head));
        const [from, to] = bounds(selection);
        const start = map(from, "right"),
          end = map(to + 1, "left") - 1;
        return range(
          start,
          Math.max(start, end),
          selection.anchor > selection.head,
        );
      });
  return setSelections(state, selections, state.primaryIndex);
}
function replaceSelected(state, values, { insertion = false } = {}) {
  let offset = 0;
  const output = [];
  const changes = state.selections.map((selection, index) => {
    const [from, to] = bounds(selection),
      text = values[index];
    const start = from + offset;
    output.push(
      insertion
        ? range(start, start)
        : range(
            start,
            start + Math.max(0, text.length - 1),
            selection.anchor > selection.head,
          ),
    );
    offset += text.length - (Math.min(state.text.length, to + 1) - from);
    return { from, to: Math.min(state.text.length, to + 1), text };
  });
  return edits(state, changes, () => output);
}
function record(state, event) {
  if (state.macroRecording) state.macroRecording.events.push(event);
  return state;
}
export function advancedInsertText(input, text) {
  if (input.mode !== "insert") return input;
  if (typeof text !== "string") throw new Error("插入内容必须是文字");
  const state = clone(input);
  edits(
    state,
    state.selections.map((selection) => ({
      from: selection.head,
      to: selection.head,
      text,
    })),
  );
  return record(state, { type: "text", text });
}
export function advancedBackspace(input) {
  if (input.mode !== "insert") return input;
  const state = clone(input);
  edits(
    state,
    state.selections
      .filter((selection) => selection.head > 0)
      .map((selection) => ({
        from: selection.head - 1,
        to: selection.head,
        text: "",
      })),
  );
  return record(state, { type: "backspace" });
}
const PAIRS = {
  "(": ["(", ")"],
  ")": ["(", ")"],
  "[": ["[", "]"],
  "]": ["[", "]"],
  "{": ["{", "}"],
  "}": ["{", "}"],
  "<": ["<", ">"],
  ">": ["<", ">"],
};
function pairFor(char) {
  return PAIRS[char] || [char, char];
}
function enclosing(text, selection, object, count) {
  const [from, to] = bounds(selection);
  const pairs = object === "m" ? ["(", "[", "{", "<", '"', "'", "`"] : [object];
  const found = [];
  for (const key of pairs) {
    const [open, close] = pairFor(key),
      stack = [];
    let quote = null;
    for (let i = 0; i < text.length; i++) {
      if (open === close && text[i] === open) {
        let escapes = 0;
        for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) escapes++;
        if (escapes % 2) continue;
        if (quote === null) quote = i;
        else {
          if (quote <= from && i >= to) found.push([quote, i]);
          quote = null;
        }
      } else if (open !== close) {
        if (text[i] === open) stack.push(i);
        if (text[i] === close && stack.length) {
          const start = stack.pop();
          if (start <= from && i >= to) found.push([start, i]);
        }
      }
    }
  }
  found.sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
  if (!found[count - 1])
    throw new Error(`找不到第 ${count} 层包围「${object}」`);
  return found[count - 1];
}
function textObject(state, selection, object, around, count) {
  let [start, end] = bounds(selection);
  if (object === "w" || object === "W") {
    const kind = (char) =>
      /\s/u.test(char)
        ? 0
        : object === "W" || /[\p{L}\p{N}_]/u.test(char)
          ? 1
          : 2;
    start = end = selection.head;
    const initial = kind(state.text[start] || " ");
    while (start > 0 && kind(state.text[start - 1]) === initial) start--;
    while (end + 1 < state.text.length && kind(state.text[end + 1]) === initial)
      end++;
    for (let n = 1; n < count; n++) {
      while (end + 1 < state.text.length && /\s/u.test(state.text[end + 1]))
        end++;
      if (end + 1 < state.text.length) {
        const next = kind(state.text[++end]);
        while (
          end + 1 < state.text.length &&
          kind(state.text[end + 1]) === next
        )
          end++;
      }
    }
    if (around) {
      if (end + 1 < state.text.length && /[ \t]/u.test(state.text[end + 1]))
        while (
          end + 1 < state.text.length &&
          /[ \t]/u.test(state.text[end + 1])
        )
          end++;
      else while (start > 0 && /[ \t]/u.test(state.text[start - 1])) start--;
    }
  } else {
    if (!PAIRS[object] && !['"', "'", "`", "m"].includes(object))
      throw new Error(
        "此练习支持 w、W、括号、引号和 m；语法树文本对象需要真实语言服务",
      );
    [start, end] = enclosing(state.text, selection, object, count);
    if (!around) {
      start++;
      end--;
      if (end < start) throw new Error("包围内部为空，无法生成非空字符选区");
    }
  }
  return range(start, end, selection.anchor > selection.head);
}
function search(state, command, args, count) {
  if (command === "search" || command === "rsearch") {
    regex(args.pattern);
    state.searchPattern = args.pattern;
    state.registers["/"] = [args.pattern];
  }
  const pattern = state.searchPattern || state.registers["/"]?.[0];
  if (!pattern)
    throw new Error("还没有搜索表达式，请先搜索或使用选区作为搜索内容");
  const found = matches(state.text, pattern);
  if (!found.length) throw new Error("没有匹配的搜索结果");
  const backward = command === "rsearch" || command.endsWith("prev");
  const extend = command.startsWith("extend_");
  for (let n = 0; n < count; n++) {
    const primary = state.selections[state.primaryIndex],
      [from, to] = bounds(primary);
    const candidate = backward
      ? found.findLast((match) => bounds(match)[1] < from) || found.at(-1)
      : found.find((match) => bounds(match)[0] > to) || found[0];
    const result = range(
      candidate.anchor,
      candidate.head,
      primary.anchor > primary.head,
    );
    if (extend)
      setSelections(
        state,
        [...state.selections, result],
        state.selections.length,
      );
    else {
      const selections = [...state.selections];
      selections[state.primaryIndex] = result;
      setSelections(state, selections, state.primaryIndex);
    }
  }
  return state;
}
function motion(state, command, args, count) {
  const extend = command.startsWith("extend_");
  const starts = lineStarts(state.text);
  return setSelections(
    state,
    state.selections.map((selection, selectionIndex) => {
      const position = lineAt(state.text, selection.head);
      let target = selection.head;
      if (command.endsWith("char_left"))
        target = Math.max(position.start, target - count);
      else if (command.endsWith("char_right"))
        target =
          target === state.text.length
            ? target
            : Math.min(
                Math.max(position.start, position.end - 1),
                target + count,
              );
      else if (/(?:visual_)?line_(?:up|down)$/.test(command)) {
        const index = starts.lastIndexOf(position.start),
          column =
            state.goalColumns?.[selectionIndex] ??
            selection.head - position.start;
        const row = clamp(
          index + (command.endsWith("down") ? count : -count),
          starts.length - 1,
        );
        const destination = lineAt(state.text, starts[row]);
        target = Math.min(
          starts[row] + column,
          Math.max(starts[row], destination.end - 1),
        );
        return {
          ...range(extend ? selection.anchor : target, target),
          goalColumn: column,
        };
      } else if (command.endsWith("file_start"))
        target = starts[Math.min(count - 1, starts.length - 1)];
      else if (command.endsWith("file_end")) target = state.text.length;
      else if (command.endsWith("line_start")) target = position.start;
      else if (command.endsWith("line_end_newline")) target = position.end;
      else if (command.endsWith("line_end"))
        target = Math.max(position.start, position.end - 1);
      else if (command === "goto_first_nonwhitespace")
        target =
          position.start +
          (state.text.slice(position.start, position.end).match(/^[ \t]*/)?.[0]
            .length || 0);
      else if (command.endsWith("column"))
        target = Math.min(
          position.start + count - 1,
          Math.max(position.start, position.end - 1),
        );
      return range(extend ? selection.anchor : target, target);
    }),
    state.primaryIndex,
  );
}
const MOTIONS =
  /^(?:(?:move|extend)_char_(?:left|right)|(?:move|extend)_(?:visual_)?line_(?:up|down)|goto_(?:file_start|file_end|line_start|line_end|line_end_newline|first_nonwhitespace|column)|extend_to_(?:file_start|file_end|line_start|line_end|column))$/;
function execute(input, command, args, count) {
  let state = clone(input);
  if (command === "record_macro") {
    if (state.macroRecording) {
      state.macros[state.macroRecording.register] = state.macroRecording.events;
      state.macroRecording = null;
    } else
      state.macroRecording = { register: registerName(args, "@"), events: [] };
    return state;
  }
  if (command === "replay_macro") {
    const register = registerName(args, "@"),
      events = state.macros[register];
    if (!events?.length) throw new Error(`宏寄存器 ${register} 为空`);
    if (state.macroStack?.includes(register))
      throw new Error("宏不能递归调用自身");
    const recording = state.macroRecording;
    state.macroRecording = null;
    state.macroStack = [...(state.macroStack || []), register];
    for (let n = 0; n < count; n++)
      for (const event of events)
        state =
          event.type === "text"
            ? advancedInsertText(state, event.text)
            : event.type === "backspace"
              ? advancedBackspace(state)
              : executeAdvanced(state, event.command, event.args);
    state.macroStack = state.macroStack.slice(0, -1);
    state.macroRecording = recording;
    return state;
  }
  if (command === "undo" || command === "redo") {
    const source = command === "undo" ? state.history : state.redo;
    const target = command === "undo" ? state.redo : state.history;
    for (let n = 0; n < count; n++) {
      const previous = source.pop();
      if (!previous) break;
      target.push(capture(state));
      Object.assign(state, previous);
    }
    return setSelections(state, getSelections(state), state.primaryIndex);
  }
  if (command === "exit_select_mode") {
    if (state.mode === "select") state.mode = "normal";
    return state;
  }
  if (command === "normal_mode") {
    if (state.mode === "insert") {
      state.mode = "normal";
      setSelections(
        state,
        state.selections.map((selection) =>
          range(
            Math.max(0, selection.head - 1),
            Math.max(0, selection.head - 1),
          ),
        ),
        state.primaryIndex,
      );
    }
    state.mode = "normal";
    return state;
  }
  if (command === "select_mode") {
    state.mode = "select";
    return state;
  }
  if (
    [
      "insert_mode",
      "append_mode",
      "insert_at_line_start",
      "insert_at_line_end",
    ].includes(command)
  ) {
    if (state.mode !== "insert") remember(state);
    state.mode = "insert";
    return setSelections(
      state,
      state.selections.map((selection) => {
        const [from, to] = bounds(selection),
          line = lineAt(state.text, selection.head);
        const position =
          command === "insert_mode"
            ? from
            : command === "append_mode"
              ? Math.min(state.text.length, to + 1)
              : command === "insert_at_line_end"
                ? line.end
                : line.start +
                  state.text.slice(line.start, line.end).match(/^[ \t]*/)[0]
                    .length;
        return range(position, position);
      }),
      state.primaryIndex,
    );
  }
  if (MOTIONS.test(command)) return motion(state, command, args, count);
  if (command === "select_all")
    return setSelections(state, [range(0, Math.max(0, state.text.length - 1))]);
  if (
    command === "select_regex" ||
    command === "split_selection" ||
    command === "split_selection_on_newline"
  ) {
    const pattern =
      command === "split_selection_on_newline" ? "\\n" : args.pattern;
    regex(pattern);
    const output = [];
    for (const selection of state.selections) {
      const [from, to] = bounds(selection),
        found = matches(state.text.slice(from, to + 1), pattern, from);
      if (command === "select_regex")
        output.push(
          ...found.map((match) =>
            range(match.anchor, match.head, selection.anchor > selection.head),
          ),
        );
      else {
        let start = from;
        for (const match of found) {
          if (start < match.anchor)
            output.push(
              range(start, match.anchor - 1, selection.anchor > selection.head),
            );
          start = match.head + 1;
        }
        if (start <= to)
          output.push(range(start, to, selection.anchor > selection.head));
      }
    }
    if (!output.length) throw new Error("表达式没有生成非空选区");
    if (command !== "split_selection_on_newline") {
      state.searchPattern = pattern;
      state.registers["/"] = [pattern];
    }
    return setSelections(state, output);
  }
  if (command === "keep_selections" || command === "remove_selections") {
    const pattern = regex(args.pattern);
    const output = state.selections.filter((selection) => {
      pattern.lastIndex = 0;
      const [from, to] = bounds(selection);
      return (
        pattern.test(state.text.slice(from, to + 1)) !==
        (command === "remove_selections")
      );
    });
    state.registers["/"] = [args.pattern];
    return setSelections(state, output);
  }
  if (
    [
      "search",
      "rsearch",
      "search_next",
      "search_prev",
      "extend_search_next",
      "extend_search_prev",
    ].includes(command)
  )
    return search(state, command, args, count);
  if (command === "search_selection") {
    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    state.searchPattern = [
      ...new Set(
        state.selections.map((selection) => {
          const [from, to] = bounds(selection);
          return escape(state.text.slice(from, to + 1));
        }),
      ),
    ].join("|");
    state.registers["/"] = [state.searchPattern];
    return state;
  }
  if (
    /^(?:find_|till_|extend_(?:next_char|prev_char|till_char|till_prev_char))/.test(
      command,
    )
  ) {
    const char = character(args),
      backward = command.includes("prev"),
      till = command.includes("till"),
      extend = command.startsWith("extend_");
    const selections = state.selections.map((selection) => {
      let target = selection.head;
      let remaining =
        count +
        (till && state.text[selection.head + (backward ? -1 : 1)] === char
          ? 1
          : 0);
      while (remaining--) {
        target = backward
          ? state.text.lastIndexOf(char, target - 1)
          : state.text.indexOf(char, target + 1);
        if (target < 0) throw new Error(`找不到第 ${count} 个字符「${char}」`);
      }
      if (till) target += backward ? 1 : -1;
      return range(extend ? selection.anchor : selection.head, target);
    });
    state.lastMotion = { command, args: { ...args } };
    return setSelections(state, selections, state.primaryIndex);
  }
  if (command === "repeat_last_motion") {
    if (!state.lastMotion) throw new Error("还没有可重复的查找动作");
    return execute(
      state,
      state.lastMotion.command,
      { ...state.lastMotion.args, count },
      count,
    );
  }
  if (
    command === "select_textobject_inner" ||
    command === "select_textobject_around"
  )
    return setSelections(
      state,
      state.selections.map((selection) =>
        textObject(
          state,
          selection,
          character(args, "object"),
          command.endsWith("around"),
          count,
        ),
      ),
      state.primaryIndex,
    );
  if (command === "collapse_selection")
    return setSelections(
      state,
      state.selections.map((selection) =>
        range(selection.head, selection.head),
      ),
      state.primaryIndex,
    );
  if (command === "flip_selections")
    return setSelections(
      state,
      state.selections.map((selection) => ({
        anchor: selection.head,
        head: selection.anchor,
      })),
      state.primaryIndex,
    );
  if (command === "ensure_selections_forward")
    return setSelections(
      state,
      state.selections.map((selection) => range(...bounds(selection))),
      state.primaryIndex,
    );
  if (command === "keep_primary_selection")
    return setSelections(state, [state.selections[state.primaryIndex]]);
  if (command === "remove_primary_selection")
    return setSelections(
      state,
      state.selections.filter((_, index) => index !== state.primaryIndex),
    );
  if (command.startsWith("rotate_selections_"))
    return setSelections(
      state,
      state.selections,
      (state.primaryIndex +
        (command.endsWith("forward")
          ? count
          : state.selections.length - (count % state.selections.length))) %
        state.selections.length,
    );
  if (command === "merge_selections")
    return setSelections(state, [
      range(bounds(state.selections[0])[0], bounds(state.selections.at(-1))[1]),
    ]);
  if (command === "merge_consecutive_selections") {
    const output = [];
    for (const selection of state.selections) {
      const previous = output.at(-1);
      if (previous && bounds(selection)[0] === bounds(previous)[1] + 1)
        previous.head = bounds(selection)[1];
      else output.push(range(...bounds(selection)));
    }
    return setSelections(state, output);
  }
  if (command === "trim_selections")
    return setSelections(
      state,
      state.selections.map((selection) => {
        let [from, to] = bounds(selection);
        while (from <= to && /\s/u.test(state.text[from])) from++;
        while (to >= from && /\s/u.test(state.text[to])) to--;
        if (to < from) throw new Error("不能把纯空白选区裁剪为非空选区");
        return range(from, to, selection.anchor > selection.head);
      }),
      state.primaryIndex,
    );
  if (
    [
      "extend_line",
      "extend_line_above",
      "extend_line_below",
      "extend_to_line_bounds",
    ].includes(command)
  )
    return setSelections(
      state,
      state.selections.map((selection) => {
        const [from, to] = bounds(selection),
          first = lineAt(state.text, from),
          last = lineAt(state.text, to),
          starts = lineStarts(state.text);
        const backward =
          command === "extend_line_above" ||
          (command === "extend_line" && selection.anchor > selection.head);
        const full =
          from === first.start &&
          to === Math.max(first.start, last.endWithNewline - 1);
        let start = first.start,
          end = last.endWithNewline;
        const extra =
          command === "extend_to_line_bounds" ? 0 : count - (full ? 0 : 1);
        if (backward)
          start = starts[Math.max(0, starts.indexOf(first.start) - extra)];
        else {
          const lastIndex = starts.indexOf(last.start);
          end = starts[lastIndex + extra + 1] ?? state.text.length;
        }
        return range(start, Math.max(start, end - 1), backward);
      }),
      state.primaryIndex,
    );
  if (command === "yank") {
    const register = registerName(args);
    state.registers[register] = state.selections.map((selection) => {
      const [from, to] = bounds(selection);
      return state.text.slice(from, to + 1);
    });
    delete state.macros[register];
    state.mode = "normal";
    return state;
  }
  if (
    [
      "delete_selection",
      "delete_selection_noyank",
      "change_selection",
      "change_selection_noyank",
    ].includes(command)
  ) {
    const change = command.startsWith("change_");
    if (!command.endsWith("noyank")) {
      const name = registerName(args);
      state.registers[name] = state.selections.map((selection) => {
        const [from, to] = bounds(selection);
        return state.text.slice(from, to + 1);
      });
      delete state.macros[name];
    }
    remember(state);
    state.mode = change ? "insert" : "normal";
    return replaceSelected(
      state,
      state.selections.map(() => ""),
      { insertion: true },
    );
  }
  if (
    ["paste_before", "paste_after", "replace_with_yanked"].includes(command)
  ) {
    const name = registerName(args),
      values = state.registers[name];
    if (!values?.length) throw new Error(`寄存器 ${name} 为空`);
    remember(state);
    const replacements = state.selections.map((_, index) =>
      values[Math.min(index, values.length - 1)].repeat(count),
    );
    state.mode = "normal";
    if (command === "replace_with_yanked")
      return replaceSelected(state, replacements);
    const linewise = values.some((value) => value.endsWith("\n"));
    let offset = 0;
    const output = [];
    const changes = state.selections.map((selection, index) => {
      const [from, to] = bounds(selection);
      const position = linewise
        ? command === "paste_before"
          ? lineAt(state.text, from).start
          : lineAt(state.text, to).endWithNewline
        : command === "paste_before"
          ? from
          : to + 1;
      const text = replacements[index];
      output.push(
        range(
          position + offset,
          position + offset + Math.max(0, text.length - 1),
          selection.anchor > selection.head,
        ),
      );
      offset += text.length;
      return { from: position, to: position, text };
    });
    // Multiple selections can target the same linewise paste position: Helix
    // normalizes these to one insertion rather than duplicating the line.
    const seen = new Set();
    const distinct = changes.filter((change) => {
      if (seen.has(change.from)) return false;
      seen.add(change.from);
      return true;
    });
    if (distinct.length !== changes.length)
      throw new Error("多个行式粘贴落点重合，请先保留每行一个选区");
    return edits(state, changes, () => output);
  }
  if (command === "replace") {
    const char = character(args);
    remember(state);
    state.mode = "normal";
    return replaceSelected(
      state,
      state.selections.map((selection) => {
        const [from, to] = bounds(selection);
        return char.repeat([...state.text.slice(from, to + 1)].length);
      }),
    );
  }
  if (
    ["switch_case", "switch_to_uppercase", "switch_to_lowercase"].includes(
      command,
    )
  ) {
    remember(state);
    state.mode = "normal";
    return replaceSelected(
      state,
      state.selections.map((selection) => {
        const [from, to] = bounds(selection),
          text = state.text.slice(from, to + 1);
        return command === "switch_to_uppercase"
          ? text.toUpperCase()
          : command === "switch_to_lowercase"
            ? text.toLowerCase()
            : [...text]
                .map((char) =>
                  char === char.toUpperCase()
                    ? char.toLowerCase()
                    : char.toUpperCase(),
                )
                .join("");
      }),
    );
  }
  if (command === "surround_add") {
    const [open, close] = pairFor(character(args));
    remember(state);
    state.mode = "normal";
    return replaceSelected(
      state,
      state.selections.map((selection) => {
        const [from, to] = bounds(selection);
        return open + state.text.slice(from, to + 1) + close;
      }),
    );
  }
  if (command === "surround_replace" || command === "surround_delete") {
    const object = character(args, "object"),
      pair =
        command === "surround_replace" ? pairFor(character(args)) : ["", ""];
    const changes = state.selections.flatMap((selection) => {
      const [from, to] = enclosing(state.text, selection, object, count);
      return [
        { from, to: from + 1, text: pair[0] },
        { from: to, to: to + 1, text: pair[1] },
      ];
    });
    remember(state);
    state.mode = "normal";
    return edits(state, changes);
  }
  if (command === "indent" || command === "unindent") {
    const width = state.indentWidth ?? 2;
    const changes = selectedLines(state).flatMap((start) => {
      const line = lineAt(state.text, start),
        content = state.text.slice(start, line.end);
      if (!content.trim()) return [];
      if (command === "indent")
        return [{ from: start, to: start, text: " ".repeat(width * count) }];
      let end = start,
        columns = 0;
      while (
        end < line.end &&
        columns < width * count &&
        /[ \t]/.test(state.text[end])
      ) {
        columns += state.text[end] === "\t" ? width - (columns % width) : 1;
        end++;
      }
      return end > start ? [{ from: start, to: end, text: "" }] : [];
    });
    if (changes.length) remember(state);
    state.mode = "normal";
    return edits(state, changes);
  }
  if (command === "join_selections" || command === "join_selections_space") {
    const positions = new Set();
    for (const selection of state.selections) {
      const [from, to] = bounds(selection),
        first = lineAt(state.text, from),
        last = lineAt(state.text, to);
      let current = first;
      const limit =
        first.start === last.start ? first.endWithNewline : last.start;
      while (current.end < state.text.length && current.end < limit) {
        positions.add(current.end);
        current = lineAt(state.text, current.end + 1);
      }
    }
    const changes = [...positions]
      .sort((a, b) => a - b)
      .map((position) => {
        let to = position + 1;
        while (/[ \t]/.test(state.text[to] || "x")) to++;
        return {
          from: position,
          to,
          text: state.text[to] === "\n" || to === state.text.length ? "" : " ",
        };
      });
    if (changes.length) remember(state);
    state.mode = "normal";
    let offset = 0;
    const spaces = changes.flatMap((change) => {
      const point = change.from + offset;
      offset += change.text.length - (change.to - change.from);
      return change.text ? [range(point, point)] : [];
    });
    return edits(
      state,
      changes,
      command === "join_selections_space" && spaces.length
        ? () => spaces
        : undefined,
    );
  }
  if (command.startsWith("rotate_selection_contents_")) {
    const values = state.selections.map((selection) => {
      const [from, to] = bounds(selection);
      return state.text.slice(from, to + 1);
    });
    const size =
        args.count === undefined
          ? values.length
          : Math.min(count, values.length),
      rotated = [];
    for (let i = 0; i < values.length; i += size) {
      const group = values.slice(i, i + size);
      if (command.endsWith("forward")) group.unshift(group.pop());
      else group.push(group.shift());
      rotated.push(...group);
    }
    remember(state);
    return replaceSelected(state, rotated);
  }
  throw new Error(`尚未实现编辑命令：${command}`);
}
export function executeAdvanced(input, command, args = {}) {
  if (!supportsCommand(command))
    throw new Error(`当前真实编辑练习不支持命令：${command}`);
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("命令参数必须是对象");
  const count = countOf(args);
  const fields = new Set(
    (ADVANCED_INTERACTIONS[command]?.fields || []).map((field) => field.name),
  );
  for (const key of Object.keys(args))
    if (key !== "count" && !fields.has(key))
      throw new Error(`命令 ${command} 不接受参数 ${key}`);
  const countable =
    MOTIONS.test(command) ||
    /^(?:find_|till_|extend_(?:next_char|prev_char|till_char|till_prev_char))/.test(
      command,
    ) ||
    [
      "undo",
      "redo",
      "replay_macro",
      "repeat_last_motion",
      "select_textobject_inner",
      "select_textobject_around",
      "surround_replace",
      "surround_delete",
      "paste_before",
      "paste_after",
      "replace_with_yanked",
      "indent",
      "unindent",
      "extend_line",
      "extend_line_above",
      "extend_line_below",
      "search",
      "rsearch",
      "search_next",
      "search_prev",
      "extend_search_next",
      "extend_search_prev",
      "rotate_selections_forward",
      "rotate_selections_backward",
      "rotate_selection_contents_forward",
      "rotate_selection_contents_backward",
    ].includes(command);
  if (count !== 1 && !countable)
    throw new Error(`此训练中的 ${command} 不接受重复计数`);
  const state = execute(input, command, args, count);
  state.wordBoundary = null;
  if (!["record_macro"].includes(command))
    record(state, { command, args: { ...args } });
  return state;
}

const step = (action, args, mode = "normal") => ({
  mode,
  action,
  ...(args ? { args } : {}),
});
const textStep = (text) => ({ type: "text", text });
const goal = (
  text,
  anchor,
  head = anchor,
  selections = [range(anchor, head)],
  primaryIndex = 0,
) => ({ text, anchor, head, mode: "normal", selections, primaryIndex });
const lesson = (
  id,
  theme,
  title,
  description,
  text,
  cursor,
  steps,
  expected,
  concept,
  tip,
) => ({
  id: `adv-${id}`,
  advanced: true,
  category: "advanced",
  theme,
  title,
  description,
  text,
  cursor,
  steps,
  goal: expected,
  concept,
  tip,
});
export const ADVANCED_LESSONS = [
  lesson(
    "regex-rename",
    "select",
    "正则多选与批量改名",
    "选中整个文档，用正则 cat 选出三个匹配，一次 change 后输入 dog。",
    "cat + cat = cat",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "cat" }),
      step("change_selection"),
      textStep("dog"),
      step("normal_mode", null, "insert"),
    ],
    goal("dog + dog = dog", 2, 2, [range(2, 2), range(8, 8), range(14, 14)]),
    "一个动作作用于所有选区",
    "正则只在当前选区内查找；change 会同时打开三个插入点。",
  ),
  lesson(
    "split-filter",
    "select",
    "分割、筛选，再统一大小写",
    "按逗号分割整个文档，保留以 b 开头的项，再转成大写。",
    "apple,banana,berry,pear",
    0,
    [
      step("select_all"),
      step("split_selection", { pattern: "," }),
      step("keep_selections", { pattern: "^b" }),
      step("switch_to_uppercase"),
    ],
    goal("apple,BANANA,BERRY,pear", 6, 11, [range(6, 11), range(13, 17)]),
    "选区可以像数据一样过滤",
    "分割表达式本身不进入新选区，逗号仍保留在文档里。",
  ),
  lesson(
    "remove-filter",
    "select",
    "排除不需要的匹配",
    "选出所有单词，排除 keep，删除剩余的 drop。",
    "keep drop keep drop",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "\\w+" }),
      step("remove_selections", { pattern: "^keep$" }),
      step("delete_selection"),
    ],
    goal("keep  keep ", 5, 5, [range(5, 5), range(11, 11)]),
    "过滤选区不改变文字",
    "remove_selections 删除的是选区；delete_selection 才真正删除文字。末尾删除留下虚拟 EOF 选区，可在那里继续插入。",
  ),
  lesson(
    "split-lines",
    "select",
    "每行一个选区",
    "全选，按换行拆开，再给每行加方括号。",
    "red\ngreen\nblue",
    0,
    [
      step("select_all"),
      step("split_selection_on_newline"),
      step("surround_add", { char: "[" }),
    ],
    goal("[red]\n[green]\n[blue]", 0, 4, [
      range(0, 4),
      range(6, 12),
      range(14, 19),
    ]),
    "多行编辑不必逐行重复",
    "换行不在新选区里，包围操作会保留原来的行结构。",
  ),
  lesson(
    "count-find",
    "move",
    "计数定位第二个逗号",
    "使用 count=2 向前查找逗号，删除从光标到第二个逗号的整个选区。",
    "a,b,c,d",
    0,
    [step("find_next_char", { char: ",", count: 2 }), step("delete_selection")],
    goal("c,d", 0),
    "计数与字符查找组合",
    "find 会选中过去的字符，包含目标；till 则停在目标之前。",
  ),
  lesson(
    "till",
    "move",
    "停在分隔符之前",
    "查找到冒号之前，然后删除 key；冒号保留。",
    "key:value",
    0,
    [step("find_till_char", { char: ":" }), step("delete_selection")],
    goal(":value", 0),
    "包含与不包含目标",
    "t 和 f 的差别直接决定分隔符是否会被删除。",
  ),
  lesson(
    "search-cycle",
    "move",
    "搜索、前进与回绕",
    "搜索 blue，跳到下一处，再向前一处，最终选中第一处 blue。",
    "red blue red blue",
    0,
    [
      step("search", { pattern: "blue" }),
      step("search_next"),
      step("search_prev"),
    ],
    goal("red blue red blue", 4, 7),
    "搜索保留可重复的表达式",
    "n / N 重复搜索；搜索只改变选区，不修改文档。",
  ),
  lesson(
    "search-add",
    "select",
    "把搜索结果加入多选",
    "搜索 one，进入选择模式追加下一处匹配；返回普通模式，再把这两处改成大写。",
    "x one one one",
    0,
    [
      step("search", { pattern: "one" }),
      step("select_mode"),
      step("extend_search_next", null, "select"),
      step("normal_mode", null, "select"),
      step("switch_to_uppercase"),
    ],
    goal("x ONE ONE one", 6, 8, [range(2, 4), range(6, 8)], 1),
    "追加搜索不是扩成长选区",
    "中间的空格不在任何选区里，第三个 one 也不受影响。",
  ),
  lesson(
    "inner-change",
    "edit",
    "只修改括号内部",
    "选取括号内部，用 change 输入 new，保留两侧括号。",
    "call(old)",
    6,
    [
      step("select_textobject_inner", { object: "(" }),
      step("change_selection"),
      textStep("new"),
      step("normal_mode", null, "insert"),
    ],
    goal("call(new)", 7),
    "文本对象理解结构边界",
    "mi( 选择内部，ma( 则包含括号本身。",
  ),
  lesson(
    "around-delete",
    "edit",
    "连同括号一起删除",
    "选取当前方括号及其内容，一次删除。",
    "a [remove] b",
    5,
    [
      step("select_textobject_around", { object: "[" }),
      step("delete_selection"),
    ],
    goal("a  b", 2),
    "around 包含分隔符",
    "与 inner 相比，around 的作用范围包括包围字符。",
  ),
  lesson(
    "nested-object",
    "select",
    "选择第二层嵌套",
    "使用 count=2 选择两层括号的内部，再转换大写。",
    "(a(b)c)",
    3,
    [
      step("select_textobject_inner", { object: "(", count: 2 }),
      step("switch_to_uppercase"),
    ],
    goal("(A(B)C)", 1, 5),
    "计数选择外层结构",
    "最近的一层是 (b)，第二层是整个外括号。",
  ),
  lesson(
    "surround-replace",
    "edit",
    "替换包围，而非重写内容",
    "把 hello 外面的圆括号替换成方括号，再删除方括号。",
    "(hello)",
    3,
    [
      step("surround_replace", { object: "(", char: "[" }),
      step("surround_delete", { object: "[" }),
    ],
    goal("hello", 2),
    "包围可以独立编辑",
    "输入原包围字符和新字符；内部文字、光标相对位置都保留。",
  ),
  lesson(
    "register",
    "edit",
    "命名寄存器复制",
    "选中 red，复制到 a 寄存器，到行尾粘贴一次。",
    "red blue",
    1,
    [
      step("select_textobject_inner", { object: "w" }),
      step("yank", { register: "a" }),
      step("goto_line_end"),
      step("paste_after", { register: "a" }),
    ],
    goal("red bluered", 8, 10),
    "寄存器保存真实选区内容",
    "粘贴不是硬编码答案；a 寄存器存的是刚才选中的文字。",
  ),
  lesson(
    "replace-yank",
    "edit",
    "寄存器替换选区",
    "复制 red 到 a，用它替换 blue。",
    "red blue",
    0,
    [
      step("select_textobject_inner", { object: "w" }),
      step("yank", { register: "a" }),
      step("search", { pattern: "blue" }),
      step("replace_with_yanked", { register: "a" }),
    ],
    goal("red red", 4, 6),
    "复制与替换组合",
    "replace_with_yanked 替换整个目标选区，不是在它旁边插入。",
  ),
  lesson(
    "replace-char",
    "edit",
    "逐字符替换",
    "选中三个数字，使用 r 和 # 把每个字符分别替换。",
    "id=123;",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "\\d+" }),
      step("replace", { char: "#" }),
    ],
    goal("id=###;", 3, 5),
    "replace 不等于 change",
    "r 重复一个字符填满选区；c 则删除选区并进入插入模式。",
  ),
  lesson(
    "line-delete",
    "edit",
    "完整行选择包含换行",
    "选中并删除 middle 一整行，保留前后行。",
    "first\nmiddle\nlast",
    8,
    [step("extend_line_below"), step("delete_selection")],
    goal("first\nlast", 6),
    "行选择包含行尾换行",
    "删掉行内容和换行后，下一行移动到原来的位置。",
  ),
  lesson(
    "indent",
    "edit",
    "多行缩进是一次事务",
    "全选两行，缩进两级，再减少一级；最终每行保留两个空格。",
    "one\ntwo",
    0,
    [step("select_all"), step("indent", { count: 2 }), step("unindent")],
    goal("  one\n  two", 2, 10),
    "按涉及的行去重编辑",
    "训练缓冲区使用两个空格一级；同一行不会因为多个选区而重复缩进。",
  ),
  lesson(
    "join",
    "edit",
    "合并行并选择连接空格",
    "全选并合并三行，去掉后续行缩进，选中新插入的空格。",
    "one\n  two\n  three",
    0,
    [step("select_all"), step("join_selections_space")],
    goal("one two three", 3, 3, [range(3, 3), range(7, 7)]),
    "结构修改也产生可继续操作的选区",
    "合并后的空格是真实选区，可以继续替换成逗号等分隔符。",
  ),
  lesson(
    "redo",
    "edit",
    "撤销后重做批量编辑",
    "正则选中两个 x，转大写，撤销，再重做。",
    "x + x",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "x" }),
      step("switch_to_uppercase"),
      step("undo"),
      step("redo"),
    ],
    goal("X + X", 0, 0, [range(0, 0), range(4, 4)]),
    "一次动作对应一次撤销事务",
    "撤销和重做同时恢复文字、所有选区以及主选区。",
  ),
  lesson(
    "primary",
    "select",
    "轮换并保留主选区",
    "选出三个单词，轮换到第二个主选区，只保留它并转大写。",
    "one two three",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "\\w+" }),
      step("rotate_selections_forward"),
      step("keep_primary_selection"),
      step("switch_to_uppercase"),
    ],
    goal("one TWO three", 4, 6),
    "多个选区中仍有一个主选区",
    "轮换主选区不会移动其他选区，也不会改变文字。",
  ),
  lesson(
    "rotate-content",
    "edit",
    "轮换选区内容",
    "选出三个词，向前轮换内容；长度变化也要保留正确选区。",
    "a bb ccc",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "\\w+" }),
      step("rotate_selection_contents_forward"),
    ],
    goal("ccc a bb", 0, 2, [range(0, 2), range(4, 4), range(6, 7)]),
    "内容轮换不是光标轮换",
    "每个词的原位置接收前一选区的内容，偏移由事务统一修正。",
  ),
  lesson(
    "macro",
    "edit",
    "录制并重放实际编辑宏",
    "录制：选中当前词、转大写、向下移动；停止录制并重放两次。",
    "one\ntwo\nthree",
    0,
    [
      step("record_macro", { register: "q" }),
      step("select_textobject_inner", { object: "w" }),
      step("switch_to_uppercase"),
      step("move_visual_line_down"),
      step("record_macro", { register: "q" }),
      step("replay_macro", { register: "q", count: 2 }),
    ],
    goal("ONE\nTWO\nTHREE", 12),
    "宏重放的是操作序列",
    "每次重放都重新读取当前词，并在当前位置执行；不是重放预先计算好的结果。",
  ),
  lesson(
    "multi-insert",
    "edit",
    "多插入点与退格",
    "每行选出一个词，进入行尾插入，统一添加 ! 并退出。",
    "one\ntwo\nthree",
    0,
    [
      step("select_all"),
      step("split_selection_on_newline"),
      step("insert_at_line_end"),
      textStep("!"),
      step("normal_mode", null, "insert"),
    ],
    goal("one!\ntwo!\nthree!", 3, 3, [range(3, 3), range(8, 8), range(15, 15)]),
    "插入模式也支持多个光标",
    "每个插入点都根据同一个原始缓冲区计算，不会被前面的插入扰乱。",
  ),
  lesson(
    "article-surround-batch",
    "edit",
    "文章例题：批量替换 use 的包围",
    "按文章的环绕示例：全选，用正则 use 建立多选区，把每处 (use) 改为 [use]。",
    "(use) + (use)",
    0,
    [
      step("select_all"),
      step("select_regex", { pattern: "use" }),
      step("surround_replace", { object: "(", char: "[" }),
    ],
    goal("[use] + [use]", 1, 3, [range(1, 3), range(9, 11)]),
    "同一个环绕操作作用于所有选区",
    "对应原文的 % → s → use → Enter → mr([；网页中旧包围符和新包围符通过参数表单输入。",
  ),
  lesson(
    "article-surround-nested",
    "edit",
    "文章例题：只替换第二层方括号",
    "光标位于 abc 内，使用计数 2，把 [[[abc]]] 的第二层方括号替换为圆括号，得到 [([abc])]。",
    "[[[abc]]]",
    4,
    [step("surround_replace", { object: "[", char: "(", count: 2 })],
    goal("[([abc])]", 4),
    "计数指定包围层级",
    "对应原文的 2mr[(。从光标向外数，最近的一层是第 1 层；其余两层保持不变。",
  ),
];
