// Helix 25.07.1 的真实训练子集；普通模式使用包含两端的 UTF-16 偏移，
// 与原训练器保持一致；插入模式的选区位置表示插入边界。
/** 声明命令参数的名称、提示和默认值。
 * @type {(name: string, label: string, required?: boolean, defaultValue?: string) => import('./types.js').InteractionField}
 * @param {string} name - 实际提交给编辑命令的参数字段名。
 * @param {string} label - 参数的中文输入提示。
 * @param {boolean} [required] - 是否必须由用户显式提供。
 * @param {string} [defaultValue] - 未显式提供时使用的默认值；省略时记录中不生成 defaultValue 字段。
 * @returns {import('./types.js').InteractionField} 保留字段名、必填标记和可选默认值的真实参数描述。
 */
const field = (name, label, required = true, defaultValue) => ({
  name,
  label,
  required,
  ...(defaultValue === undefined ? {} : { defaultValue }),
});
/** 组合命令的真实参数输入约定。
 * @type {(arg0: string, arg1: string, arg2: import('./types.js').InteractionField[]) => import('./types.js').Interaction}
 * @param {string} kind - 交互或题目的具体类别。
 * @param {string} prompt - 当前命令要求用户输入的操作说明。
 * @param {import('./types.js').InteractionField[]} fields - 按表单顺序排列的完整参数字段描述，不只是名称字符串。
 * @returns {import('./types.js').Interaction} 包含交互类别、输入提示和有序字段描述的命令输入契约。
 */
const interaction = (kind, prompt, fields) => ({ kind, prompt, fields });
/** 需要正则表达式参数的真实训练命令。
 * @type {string[]}
 */
const patterns = [
  "select_regex",
  "split_selection",
  "keep_selections",
  "remove_selections",
  "search",
  "rsearch",
];
/** 需要单个目标字符参数的训练命令。
 * @type {string[]}
 */
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
/** 允许指定普通文本寄存器的训练命令。
 * @type {string[]}
 */
const registers = [
  "yank",
  "delete_selection",
  "change_selection",
  "paste_before",
  "paste_after",
  "replace_with_yanked",
];
/** 高级训练命令对应的真实参数交互约定。
 * @type {Record<string, import('./types.js').Interaction>}
 */
export const ADVANCED_INTERACTIONS = Object.fromEntries([
  ...patterns.map(/** 将 patterns 中的记录转换为本次操作需要的结果。
   * @param {string} command - 从配置中解析出的实际命令。
   * @returns {(string | import('./types.js').Interaction)[]} 返回该操作的实际计算结果。
   */
  (command) => [
    command,
    interaction(
      "pattern",
      "输入正则表达式（JS Unicode 与 Rust regex 的常用交集；不支持环视、反向引用、Rust 专有语法或零宽匹配）",
      [field("pattern", "正则表达式")],
    ),
  ]),
  ...characters.map(/** 将 characters 中的记录转换为本次操作需要的结果。
   * @param {string} command - 从配置中解析出的实际命令。
   * @returns {(string | import('./types.js').Interaction)[]} 返回该操作的实际计算结果。
   */
  (command) => [
    command,
    interaction("character", "输入实际的目标字符", [field("char", "字符")]),
  ]),
  ...[
    "select_textobject_inner",
    "select_textobject_around",
    "surround_delete",
  ].map(/** 将 [
      "select_textobject_inner",
      "select_textobject_around",
      "surround_delete",
    ] 中的记录转换为本次操作需要的结果。
   * @param {string} command - 从配置中解析出的实际命令。
   * @returns {(string | import('./types.js').Interaction)[]} 返回该操作的实际计算结果。
   */
  (command) => [
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
  ...registers.map(/** 将 registers 中的记录转换为本次操作需要的结果。
   * @param {string} command - 从配置中解析出的实际命令。
   * @returns {(string | import('./types.js').Interaction)[]} 返回该操作的实际计算结果。
   */
  (command) => [
    command,
    interaction("register", "可选：指定命名寄存器", [
      field("register", "寄存器", false, '"'),
    ]),
  ]),
  ...["record_macro", "replay_macro"].map(/** 将 ["record_macro", "replay_macro"] 中的记录转换为本次操作需要的结果。
   * @param {string} command - 从配置中解析出的实际命令。
   * @returns {(string | import('./types.js').Interaction)[]} 返回该操作的实际计算结果。
   */
  (command) => [
    command,
    interaction("register", "指定宏寄存器；再次录制命令结束录制", [
      field("register", "宏寄存器", false, "@"),
    ]),
  ]),
]);

/** 查询命令需要的输入；默认寄存器不强制弹出参数表。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {boolean} [includeOptional] - 是否一并返回可选寄存器参数。
 * @returns {import('./types.js').Interaction | null} 需要显示的参数契约；命令无交互，或仅含默认可选参数而未请求展开时返回 null。
 */
export function commandInteraction(command, includeOptional = false) {
  /** 该命令要求的参数交互约定。
   * @type {import('./types.js').Interaction | undefined}
   */
  const interaction = ADVANCED_INTERACTIONS[command];
  return interaction &&
    (includeOptional || interaction.fields.some(/** 检查 interaction.fields 是否满足当前操作的完整条件。
     * @param {import('./types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (field) => field.required))
    ? interaction
    : null;
}
/** 不需要额外参数交互的已实现高级命令。
 * @type {string[]}
 */
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
/** 已实现命令名称的去重查询集合。
 * @type {Set<string>}
 */
const COMMANDS = new Set([
  ...SIMPLE_COMMANDS,
  ...Object.keys(ADVANCED_INTERACTIONS),
]);
/** 判断训练引擎是否真实实现此命令。
 * @type {(arg0: string) => boolean}
 * @param {string} command - 从配置中解析出的实际命令。
 * @returns {boolean} 只有本地引擎真实实现此命令的文本或选区语义时为真，与完整官方目录是否收录无关。
 */
export const supportsCommand = (command) => COMMANDS.has(command);
/** 对外公开的真实高级命令清单。
 * @type {string[]}
 */
export const ADVANCED_COMMANDS = [...COMMANDS];
/** 取得包含两端的正向选区边界。
 * @type {(arg0: import('./types.js').Selection) => [number, number]}
 * @param {import('./types.js').Selection} range - 保留方向的当前选区。
 * @returns {[number, number]} 从小到大排列的包含式选区边界，不修改原有 anchor/head 方向。
 */
const bounds = (range) => [
  Math.min(range.anchor, range.head),
  Math.max(range.anchor, range.head),
];
/** 把偏移限制在有效缓冲区范围内。
 * @type {(arg0: number, arg1: number) => number}
 * @param {number} position - 当前字符或插入点的原始位置。
 * @param {number} maximum - 缓冲区允许的最大有效偏移。
 * @returns {number} 返回该操作的实际计算结果。
 */
const clamp = (position, maximum) =>
  Math.max(0, Math.min(position, Math.max(0, maximum)));
/** 创建保留方向的选区。
 * @type {(from: number, to: number, reverse?: boolean) => import('./types.js').Selection}
 * @param {number} from - 包含在选区中的起点偏移。
 * @param {number} to - 包含在选区中的终点偏移，不是 TextEdit 使用的排他结束偏移。
 * @param {boolean} [reverse] - 是否交换固定端和光标端以保留反向选择。
 * @returns {import('./types.js').Selection} 方向明确且包含两个端点的选区记录。
 */
const range = (from, to, reverse = false) =>
  reverse ? { anchor: to, head: from } : { anchor: from, head: to };
/** 复制选区；基础状态退化为单一选区。
 * @param {import('./types.js').EditorSnapshot} state - 实际编辑引擎的当前状态。
 * @returns {import('./types.js').Selection[]} 每项均为独立副本的选区集合；缺少多选区时从顶层 anchor/head 构造单选区。
 */
export function getSelections(state) {
  return (
    state.selections?.length
      ? state.selections
      : [{ anchor: state.anchor, head: state.head }]
  ).map(/** 将 (
      state.selections?.length
        ? state.selections
        : [{ anchor: state.anchor, head: state.head }]
    ) 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
   * @returns {{ anchor: number; head: number; goalColumn?: number | null; }} 返回该操作的实际计算结果。
   */
  (selection) => ({ ...selection }));
}
/** 复制编辑状态和可变容器，避免修改调用者。
 * @param {import('./types.js').EditorState} state - 实际编辑引擎的当前状态。
 * @returns {import('./types.js').AdvancedState} 保留文本与偏移，但复制选区、历史、寄存器、宏和录制事件容器的高级状态。
 */
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
/** 排序、合并重叠选区并保持主选区身份。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {import('./types.js').Selection[]} selections - 本次操作采用的有序选区集合。
 * @param {number} [primaryIndex] - 需要保留的主选区索引。
 * @returns {import('./types.js').AdvancedState} 原高级状态对象；其重叠选区已合并，主选区、顶层偏移和目标列已同步。
 */
function setSelections(state, selections, primaryIndex = 0) {
  if (!selections.length) throw new Error("操作后没有剩余选区");
  /** 有效缓冲区的最大偏移。
   * @type {number}
   */
  const maximum = state.text.length;
  /** 按原始位置排序的记录。
   * @type {{ anchor: number; head: number; primary: boolean; goalColumn?: number | null; }[]}
   */
  const sorted = selections
    .map(/** 将 selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @param {number} index - 当前记录在原集合中的索引。
     * @returns {{ anchor: number; head: number; primary: boolean; goalColumn?: number | null; }} 返回该操作的实际计算结果。
     */
    (selection, index) => ({
      ...selection,
      anchor: clamp(selection.anchor, maximum),
      head: clamp(selection.head, maximum),
      primary: index === primaryIndex,
    }))
    .sort(/** 比较 selections
        .map((selection, index) => ({
          ...selection,
          anchor: clamp(selection.anchor, maximum),
          head: clamp(selection.head, maximum),
          primary: index === primaryIndex,
        })) 中的记录以保持确定性顺序。
     * @param {{ anchor: number; head: number; primary: boolean; goalColumn?: number | null; }} a - 当前比较或处理的动作记录。
     * @param {{ anchor: number; head: number; primary: boolean; goalColumn?: number | null; }} b - 用于成对比较的另一个动作记录。
     * @returns {number} 返回该操作的实际计算结果。
     */
    (a, b) => bounds(a)[0] - bounds(b)[0]);
  /** 按原顺序合并并标记主选区的结果。
   * @type {(import('./types.js').Selection & {primary: boolean})[]}
   */
  const merged = [];
  /** 当前处理的包含两端的选区。
   * @type {{ anchor: number; head: number; primary: boolean; goalColumn?: number | null; }}
   */
  for (const selection of sorted) {
    /** 上一条可供恢复或合并的记录。
     * @type {(import('./types.js').Selection & { primary: boolean; }) | undefined}
     */
    const previous = merged.at(-1);
    if (previous && bounds(selection)[0] <= bounds(previous)[1]) {
      /** 当前范围的起始偏移。
       * @type {number}
       */
      const start = bounds(previous)[0];
        /** 当前范围的终止偏移。
         * @type {number}
         */
        const end = Math.max(bounds(previous)[1], bounds(selection)[1]);
      /** 是否保留从后向前的选区方向。
       * @type {boolean}
       */
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
    merged.findIndex(/** 在 merged 中定位符合当前条件的真实记录。
     * @param {import('./types.js').Selection & { primary: boolean; }} selection - 当前处理的包含两端的选区。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (selection) => selection.primary),
  );
  state.goalColumns = merged.map(/** 将 merged 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').Selection & { primary: boolean; }} selection - 当前处理的包含两端的选区。
   * @returns {number | null} 返回该操作的实际计算结果。
   */
  (selection) => selection.goalColumn ?? null);
  state.selections = merged.map(
    /** 将 merged 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection & { primary: boolean; }} options - 本次操作的完整参数。
     * @returns {{ anchor: number; head: number; }} 返回该操作的实际计算结果。
     */
    ({ primary: _primary, goalColumn: _goalColumn, ...selection }) => selection,
  );
  Object.assign(state, state.selections[state.primaryIndex]);
  return state;
}
/** 记录撤销需要的文本与选区快照。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @returns {import('./types.js').EditorSnapshot} 包含真实文本、多选区、主选区和移动边界的撤销快照，不包含寄存器或宏容器。
 */
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
/** 提交撤销快照并清空重做历史。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @returns {void} 完成状态修改，不返回额外值。
 */
function remember(state) {
  state.history.push(capture(state));
  state.redo = [];
}
/** 校验重复次数，拒绝非法或过大的命令计数。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @returns {number} 1 到 10000 的安全整数计数；未提供时为 1，其他值抛出异常。
 */
function countOf(args) {
  /** 本次命令的有效重复次数。
   * @type {number}
   */
  const count = args.count === undefined ? 1 : Number(args.count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw new Error("次数必须是 1 到 10000 的整数");
  return count;
}
/** 读取且校验恰好一个 Unicode 字符的参数。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @param {'char' | 'object'} [key] - 要读取目标字符或文本对象字符的实际参数字段。
 * @returns {string} 恰好包含一个 Unicode 码点的字符；缺失、多字符或非文字值抛出异常。
 */
function character(args, key = "char") {
  if (typeof args[key] !== "string" || [...args[key]].length !== 1)
    throw new Error(
      `${key === "object" ? "文本对象" : "字符"}必须恰好是一个字符`,
    );
  return args[key];
}
/** 校验训练内寄存器名称，不访问系统剪贴板。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @param {string} [fallback] - 参数未提供时使用的实际默认值。
 * @returns {string} 单个字母、数字、双引号或 @ 的训练内寄存器名称，不执行系统剪贴板访问。
 */
function registerName(args, fallback = '"') {
  /** 当前记录的稳定名称。
   * @type {string}
   */
  const name = args.register ?? fallback;
  if (typeof name !== "string" || !/^[a-z0-9"@]$/i.test(name))
    throw new Error(
      '练习寄存器仅支持单个字母、数字、" 或 @（不访问系统剪贴板）',
    );
  return name;
}
/** 编译与 Rust 常用交集一致的正则表达式。
 * @param {string} pattern - 实际输入并用于匹配的正则表达式。
 * @returns {RegExp} 返回该操作的实际计算结果。
 */
function regex(pattern) {
  if (typeof pattern !== "string" || !pattern.length)
    throw new Error("请输入非空正则表达式");
  // Rust 正则不支持反向引用与环视，因此明确拒绝这些表达式，
  // 避免把 JavaScript 专有语法误教为 Helix 语法。
  if (/\\[1-9]|\(\?(?:[=!]|<[=!])/.test(pattern))
    throw new Error("Helix 正则不支持反向引用或环视");
  try {
    return new RegExp(pattern, "gmu");
  } catch (error) {
    throw new Error(`无效正则表达式：${error.message}`);
  }
}
/** 找出非零宽正则匹配并映射到原缓冲区偏移。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {string} pattern - 实际输入并用于匹配的正则表达式。
 * @param {number} [offset] - 此前修改累积造成的位置偏移。
 * @returns {import('./types.js').Selection[]} 原文本中每个非零宽匹配对应的包含式选区，全部偏移已加上传入的基础 offset。
 */
function matches(text, pattern, offset = 0) {
  /** 按包围跨度排序的候选边界。
   * @type {RegExpExecArray[]}
   */
  const found = [...text.matchAll(regex(pattern))];
  if (found.some(/** 检查 found 是否满足当前操作的完整条件。
   * @param {RegExpExecArray} match - 在原文本中查得的实际匹配选区。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (match) => !match[0].length))
    throw new Error(
      "此编辑训练不支持零宽正则匹配；请在原生 Helix 中练习该边界",
    );
  return found.map(/** 将 found 中的记录转换为本次操作需要的结果。
   * @param {RegExpExecArray} match - 在原文本中查得的实际匹配选区。
   * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
   */
  (match) =>
    range(offset + match.index, offset + match.index + match[0].length - 1),
  );
}
/** 取得所在行及其换行符的边界。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} position - 当前字符或插入点的原始位置。
 * @returns {import('./types.js').LineExtent} 返回该操作的实际计算结果。
 */
function lineAt(text, position) {
  /** 当前范围的起始偏移。
   * @type {number}
   */
  const start = position <= 0 ? 0 : text.lastIndexOf("\n", position - 1) + 1;
  /** 本行换行符在缓冲区中的偏移。
   * @type {number}
   */
  const newline = text.indexOf("\n", position);
  return {
    start,
    end: newline < 0 ? text.length : newline,
    endWithNewline: newline < 0 ? text.length : newline + 1,
  };
}
/** 枚举文本中每一行的起点。
 * @param {string} text - 本次实际处理的文字内容。
 * @returns {number[]} 返回该操作的实际计算结果。
 */
function lineStarts(text) {
  /** 涉及行的去重起点集合。
   * @type {number[]}
   */
  const starts = [0];
  /** 顺序遍历的当前索引。
   * @type {number}
   */
  for (let i = 0; i < text.length; i++)
    if (text[i] === "\n") starts.push(i + 1);
  return starts;
}
/** 去重并排序所有选区覆盖的行起点。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @returns {number[]} 返回该操作的实际计算结果。
 */
function selectedLines(state) {
  /** 涉及行的去重起点集合。
   * @type {Set<number>}
   */
  const starts = new Set();
  /** 当前处理的包含两端的选区。
   * @type {import('./types.js').Selection}
   */
  for (const selection of state.selections) {
    /** 按既定顺序解构当前记录的边界、标识或测试参数。
     * @type {[number, number]}
     */
    const [from, to] = bounds(selection);
    /** 当前范围的起始偏移。
     * @type {number}
     */
    let start = lineAt(state.text, from).start;
    while (start <= to) {
      starts.add(start);
      /** 本次操作的后继状态或边界。
       * @type {number}
       */
      const next = state.text.indexOf("\n", start);
      if (next < 0 || next + 1 > to) break;
      start = next + 1;
    }
  }
  return [...starts].sort(/** 比较 [...starts] 中的记录以保持确定性顺序。
   * @param {number} a - 当前比较或处理的动作记录。
   * @param {number} b - 用于成对比较的另一个动作记录。
   * @returns {number} 返回该操作的实际计算结果。
   */
  (a, b) => a - b);
}
// 所有修改都基于同一原始缓冲区，选区偏移仅映射一次；
// 这样早先修改造成的位移不会被后续选区重复计算。
/** 基于同一原始缓冲区应用修改并重映射选区。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {import('./types.js').TextEdit[]} changes - 本次操作基于原缓冲区生成的修改集合。
 * @param {(map: import('./types.js').OffsetMapper) => import('./types.js').Selection[]} [explicitSelections] - 可选的显式目标选区计算；省略时按各原选区端点和边界归属重映射。
 * @returns {import('./types.js').AdvancedState} 原状态对象，所有非重叠修改仅基于同一原始缓冲区应用一次，再统一重映射选区。
 */
function edits(state, changes, explicitSelections) {
  /** 按原始位置排序的记录。
   * @type {{ from: number; to: number; text: string; }[]}
   */
  const sorted = changes
    .map(/** 将 changes 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').TextEdit} change - 基于原缓冲区定位的单次修改。
     * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
     */
    (change) => ({ ...change }))
    .sort(/** 比较 changes
        .map((change) => ({ ...change })) 中的记录以保持确定性顺序。
     * @param {{ from: number; to: number; text: string; }} a - 当前比较或处理的动作记录。
     * @param {{ from: number; to: number; text: string; }} b - 用于成对比较的另一个动作记录。
     * @returns {number} 返回该操作的实际计算结果。
     */
    (a, b) => a.from - b.from || a.to - b.to);
  /** 去重后的实际修改记录。
   * @type {{ from: number; to: number; text: string; }[]}
   */
  const unique = sorted.filter(
    /** 依据实际条件筛选 sorted 中的有效记录。
     * @param {{ from: number; to: number; text: string; }} change - 基于原缓冲区定位的单次修改。
     * @param {number} index - 当前记录在原集合中的索引。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (change, index) =>
      !index ||
      change.from !== sorted[index - 1].from ||
      change.to !== sorted[index - 1].to ||
      change.text !== sorted[index - 1].text,
  );
  /** 顺序遍历的当前索引。
   * @type {number}
   */
  for (let i = 1; i < unique.length; i++)
    if (unique[i].from < unique[i - 1].to)
      throw new Error("修改范围重叠，请先合并选区");
  if (!unique.length) return state;
  /** 操作前用于独立比较的状态或文本。
   * @type {string}
   */
  const before = state.text;
  /** 本次实际处理的文字内容。
   * @type {string}
   */
  let text = "";
    /** 当前范围的终止偏移。
     * @type {number}
     */
    let end = 0;
  /** 基于原缓冲区定位的单次修改。
   * @type {{ from: number; to: number; text: string; }}
   */
  for (const change of unique) {
    text += before.slice(end, change.from) + change.text;
    end = change.to;
  }
  text += before.slice(end);
  /** 将原缓冲区偏移映射到修改后的缓冲区。
   * @type {(arg0: number, arg1: 'left' | 'right') => number}
   * @param {number} position - 当前字符或插入点的原始位置。
   * @param {'left' | 'right'} [affinity] - 落在修改边界时采用的左侧或右侧归属。
   * @returns {number} 返回该操作的实际计算结果。
   */
  const map = (position, affinity = "right") => {
    /** 此前修改累积造成的位置偏移。
     * @type {number}
     */
    let offset = 0;
    /** 基于原缓冲区定位的单次修改。
     * @type {{ from: number; to: number; text: string; }}
     */
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
  /** 本次操作采用的有序选区集合。
   * @type {import('./types.js').Selection[]}
   */
  const selections = explicitSelections
    ? explicitSelections(map)
    : state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
     */
    (selection) => {
        if (state.mode === "insert")
          return range(map(selection.head), map(selection.head));
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
        /** 当前范围的起始偏移。
         * @type {number}
         */
        const start = map(from, "right");
          /** 当前范围的终止偏移。
           * @type {number}
           */
          const end = map(to + 1, "left") - 1;
        return range(
          start,
          Math.max(start, end),
          selection.anchor > selection.head,
        );
      });
  return setSelections(state, selections, state.primaryIndex);
}
/** 用各自文本替换选区并保持插入点或选择方向。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {string[]} values - 规范化后的有效按键配置。
 * @param {{insertion?: boolean}} [options] - 本次操作的完整参数。
 * @returns {import('./types.js').AdvancedState} 返回该操作的实际计算结果。
 */
function replaceSelected(state, values, { insertion = false } = {}) {
  /** 此前修改累积造成的位置偏移。
   * @type {number}
   */
  let offset = 0;
  /** 本次编辑后独立计算的目标选区。
   * @type {import('./types.js').Selection[]}
   */
  const output = [];
  /** 本次操作基于原缓冲区生成的修改集合。
   * @type {{ from: number; to: number; text: string; }[]}
   */
  const changes = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
   * @param {number} index - 当前记录在原集合中的索引。
   * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
   */
  (selection, index) => {
    /** 按既定顺序解构当前记录的边界、标识或测试参数。
     * @type {[number, number]}
     */
    const [from, to] = bounds(selection);
      /** 本次实际处理的文字内容。
       * @type {string}
       */
      const text = values[index];
    /** 当前范围的起始偏移。
     * @type {number}
     */
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
  return edits(state, changes, /** 返回本次编辑显式计算出的结果，不修改调用者输入。
   * @returns {import('./types.js').Selection[]} 返回该操作的实际计算结果。
   */
  () => output);
}
/** 录制真实输入事件而不是最终文本。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {import('./types.js').MacroEvent} event - 当前回放的输入或命令事件。
 * @returns {import('./types.js').AdvancedState} 返回该操作的实际计算结果。
 */
function record(state, event) {
  if (state.macroRecording) state.macroRecording.events.push(event);
  return state;
}
/** 在每个插入点写入文字并记录宏输入。
 * @param {import('./types.js').EditorState} input - 本次操作传入的实际记录。
 * @param {string} text - 本次实际处理的文字内容。
 * @returns {import('./types.js').EditorState} 非插入模式原样返回；插入模式在各真实插入点写入相同文字，并录制文字事件而非结果快照。
 */
export function advancedInsertText(input, text) {
  if (input.mode !== "insert") return input;
  if (typeof text !== "string") throw new Error("插入内容必须是文字");
  /** 实际编辑引擎的当前状态。
   * @type {import('./types.js').AdvancedState}
   */
  const state = clone(input);
  edits(
    state,
    state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
     */
    (selection) => ({
      from: selection.head,
      to: selection.head,
      text,
    })),
  );
  return record(state, { type: "text", text });
}
/** 基于原偏移删除每个插入点前的字符。
 * @param {import('./types.js').EditorState} input - 本次操作传入的实际记录。
 * @returns {import('./types.js').EditorState} 非插入模式原样返回；否则一次性删除各非零插入点前的字符，并录制真实退格事件。
 */
export function advancedBackspace(input) {
  if (input.mode !== "insert") return input;
  /** 实际编辑引擎的当前状态。
   * @type {import('./types.js').AdvancedState}
   */
  const state = clone(input);
  edits(
    state,
    state.selections
      .filter(/** 依据实际条件筛选 state.selections 中的有效记录。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (selection) => selection.head > 0)
      .map(/** 将 state.selections
            .filter((selection) => selection.head > 0) 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
       */
      (selection) => ({
        from: selection.head - 1,
        to: selection.head,
        text: "",
      })),
  );
  return record(state, { type: "backspace" });
}
/** 括号与尖括号对应的开闭字符。
 * @type {Record<string, [string, string]>}
 */
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
/** 解析括号配对，其他字符按对称包围处理。
 * @param {string} char - 用户输入的实际目标字符。
 * @returns {[string, string]} 返回该操作的实际计算结果。
 */
function pairFor(char) {
  return PAIRS[char] || [char, char];
}
/** 寻找包含选区的指定层次包围符。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
 * @param {string} object - 用户指定的实际文本对象字符。
 * @param {number} count - 本次命令的有效重复次数。
 * @returns {[number, number]} 按跨度从内到外计算出的指定层开闭符包含式偏移；找不到对应层时抛出异常。
 */
function enclosing(text, selection, object, count) {
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {[number, number]}
   */
  const [from, to] = bounds(selection);
  /** 可用于寻找外层包围的字符配对。
   * @type {string[]}
   */
  const pairs = object === "m" ? ["(", "[", "{", "<", '"', "'", "`"] : [object];
  /** 按包围跨度排序的候选边界。
   * @type {[number, number][]}
   */
  const found = [];
  /** 当前按键或配置键名。
   * @type {string}
   */
  for (const key of pairs) {
    /** 按既定顺序解构当前记录的边界、标识或测试参数。
     * @type {[string, string]}
     */
    const [open, close] = pairFor(key);
      /** 尚未配对的开括号位置。
       * @type {number[]}
       */
      const stack = [];
    /** 尚未闭合的引号位置。
     * @type {number | null}
     */
    let quote = null;
    /** 顺序遍历的当前索引。
     * @type {number}
     */
    for (let i = 0; i < text.length; i++) {
      if (open === close && text[i] === open) {
        /** 目标引号前连续转义符的数量。
         * @type {number}
         */
        let escapes = 0;
        /** 内层遍历的当前索引。
         * @type {number}
         */
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
          /** 当前范围的起始偏移。
           * @type {number | undefined}
           */
          const start = stack.pop();
          if (start <= from && i >= to) found.push([start, i]);
        }
      }
    }
  }
  found.sort(/** 比较 found 中的记录以保持确定性顺序。
   * @param {[number, number]} a - 当前比较或处理的动作记录。
   * @param {[number, number]} b - 用于成对比较的另一个动作记录。
   * @returns {number} 返回该操作的实际计算结果。
   */
  (a, b) => a[1] - a[0] - (b[1] - b[0]));
  if (!found[count - 1])
    throw new Error(`找不到第 ${count} 层包围「${object}」`);
  return found[count - 1];
}
/** 计算单词或成对符号的内部和外围文本对象。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
 * @param {string} object - 用户指定的实际文本对象字符。
 * @param {boolean} around - 是否包含文本对象的外围符号或空白。
 * @param {number} count - 本次命令的有效重复次数。
 * @returns {import('./types.js').Selection} 维持原选择方向的词或成对符号范围；around 决定是否包含外围字符，找不到支持的对象时抛出异常。
 */
function textObject(state, selection, object, around, count) {
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {[number, number]}
   */
  let [start, end] = bounds(selection);
  if (object === "w" || object === "W") {
    /** 区分空白、单词和标点字符边界。
     * @type {(arg0: string) => number}
     * @param {string} char - 用户输入的实际目标字符。
     * @returns {number} 返回该操作的实际计算结果。
     */
    const kind = (char) =>
      /\s/u.test(char)
        ? 0
        : object === "W" || /[\p{L}\p{N}_]/u.test(char)
          ? 1
          : 2;
    start = end = selection.head;
    /** 起始字符所属的边界类别。
     * @type {number}
     */
    const initial = kind(state.text[start] || " ");
    while (start > 0 && kind(state.text[start - 1]) === initial) start--;
    while (end + 1 < state.text.length && kind(state.text[end + 1]) === initial)
      end++;
    /** 已执行的命令重复次数。
     * @type {number}
     */
    for (let n = 1; n < count; n++) {
      while (end + 1 < state.text.length && /\s/u.test(state.text[end + 1]))
        end++;
      if (end + 1 < state.text.length) {
        /** 本次操作的后继状态或边界。
         * @type {number}
         */
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
/** 执行真实搜索、循环匹配和扩展搜索选区。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @param {number} count - 本次命令的有效重复次数。
 * @returns {import('./types.js').AdvancedState} 已循环定位到真实匹配的原状态对象；扩展搜索新增选区并同步主选区，没有匹配时抛出异常。
 */
function search(state, command, args, count) {
  if (command === "search" || command === "rsearch") {
    regex(args.pattern);
    state.searchPattern = args.pattern;
    state.registers["/"] = [args.pattern];
  }
  /** 实际输入并用于匹配的正则表达式。
   * @type {string}
   */
  const pattern = state.searchPattern || state.registers["/"]?.[0];
  if (!pattern)
    throw new Error("还没有搜索表达式，请先搜索或使用选区作为搜索内容");
  /** 按包围跨度排序的候选边界。
   * @type {import('./types.js').Selection[]}
   */
  const found = matches(state.text, pattern);
  if (!found.length) throw new Error("没有匹配的搜索结果");
  /** 是否沿文本反方向搜索或扩展。
   * @type {boolean}
   */
  const backward = command === "rsearch" || command.endsWith("prev");
  /** 是否保持锚点并扩展选择。
   * @type {boolean}
   */
  const extend = command.startsWith("extend_");
  /** 已执行的命令重复次数。
   * @type {number}
   */
  for (let n = 0; n < count; n++) {
    /** 当前主选区记录。
     * @type {import('./types.js').Selection}
     */
    const primary = state.selections[state.primaryIndex];
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
      const [from, to] = bounds(primary);
    /** 满足移动或匹配条件的候选记录。
     * @type {import('./types.js').Selection | undefined}
     */
    const candidate = backward
      ? found.findLast(/** 在 found 中定位符合当前条件的真实记录。
       * @param {import('./types.js').Selection} match - 在原文本中查得的实际匹配选区。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (match) => bounds(match)[1] < from) || found.at(-1)
      : found.find(/** 在 found 中定位符合当前条件的真实记录。
       * @param {import('./types.js').Selection} match - 在原文本中查得的实际匹配选区。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (match) => bounds(match)[0] > to) || found[0];
    /** 实际解析或执行得到的结果。
     * @type {import('./types.js').Selection}
     */
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
      /** 本次操作采用的有序选区集合。
       * @type {import('./types.js').Selection[]}
       */
      const selections = [...state.selections];
      selections[state.primaryIndex] = result;
      setSelections(state, selections, state.primaryIndex);
    }
  }
  return state;
}
/** 按命令移动选区并保持目标列。
 * @param {import('./types.js').AdvancedState} state - 实际编辑引擎的当前状态。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @param {number} count - 本次命令的有效重复次数。
 * @returns {import('./types.js').AdvancedState} 返回该操作的实际计算结果。
 */
function motion(state, command, args, count) {
  /** 是否保持锚点并扩展选择。
   * @type {boolean}
   */
  const extend = command.startsWith("extend_");
  /** 涉及行的去重起点集合。
   * @type {number[]}
   */
  const starts = lineStarts(state.text);
  return setSelections(
    state,
    state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @param {number} selectionIndex - 当前选区在有序集合中的索引。
     * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
     */
    (selection, selectionIndex) => {
      /** 当前字符或插入点的原始位置。
       * @type {import('./types.js').LineExtent}
       */
      const position = lineAt(state.text, selection.head);
      /** 本次移动最终到达的位置。
       * @type {number}
       */
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
        /** 当前记录在原集合中的索引。
         * @type {number}
         */
        const index = starts.lastIndexOf(position.start);
          /** 跨行移动时保留的目标列。
           * @type {number}
           */
          const column =
            state.goalColumns?.[selectionIndex] ??
            selection.head - position.start;
        /** 本次垂直移动到达的行号。
         * @type {number}
         */
        const row = clamp(
          index + (command.endsWith("down") ? count : -count),
          starts.length - 1,
        );
        /** 目标行的真实文本边界。
         * @type {import('./types.js').LineExtent}
         */
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
/** 实际支持的逐字符、逐行及定位移动命令规则。
 * @type {RegExp}
 */
const MOTIONS =
  /^(?:(?:move|extend)_char_(?:left|right)|(?:move|extend)_(?:visual_)?line_(?:up|down)|goto_(?:file_start|file_end|line_start|line_end|line_end_newline|first_nonwhitespace|column)|extend_to_(?:file_start|file_end|line_start|line_end|column))$/;
/** 在副本上执行命令的文本、选区、寄存器和宏语义。
 * @param {import('./types.js').EditorState} input - 本次操作传入的实际记录。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {import('./types.js').CommandArgs} args - 实际交给命令引擎执行的参数。
 * @param {number} count - 本次命令的有效重复次数。
 * @returns {import('./types.js').AdvancedState} 基于输入副本执行的真实高级状态；撤销、寄存器和宏按命令分别变化，不回填课程预设目标。
 */
function execute(input, command, args, count) {
  /** 实际编辑引擎的当前状态。
   * @type {import('./types.js').AdvancedState}
   */
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
    /** 本次读写的命名寄存器。
     * @type {string}
     */
    const register = registerName(args, "@");
      /** 按录制顺序保存的真实宏事件。
       * @type {import('./types.js').MacroEvent[]}
       */
      const events = state.macros[register];
    if (!events?.length) throw new Error(`宏寄存器 ${register} 为空`);
    if (state.macroStack?.includes(register))
      throw new Error("宏不能递归调用自身");
    /** 宏回放前需要恢复的录制状态。
     * @type {({ register: string; events: import('./types.js').MacroEvent[]; } & { register: string; events: import('./types.js').MacroEvent[]; }) | null}
     */
    const recording = state.macroRecording;
    state.macroRecording = null;
    state.macroStack = [...(state.macroStack || []), register];
    /** 已执行的命令重复次数。
     * @type {number}
     */
    for (let n = 0; n < count; n++)
      /** 当前回放的输入或命令事件。
       * @type {import('./types.js').MacroEvent}
       */
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
    /** 本次撤销或重做读取的历史集合。
     * @type {import('./types.js').EditorSnapshot[]}
     */
    const source = command === "undo" ? state.history : state.redo;
    /** 本次移动最终到达的位置。
     * @type {import('./types.js').EditorSnapshot[]}
     */
    const target = command === "undo" ? state.redo : state.history;
    /** 已执行的命令重复次数。
     * @type {number}
     */
    for (let n = 0; n < count; n++) {
      /** 上一条可供恢复或合并的记录。
       * @type {import('./types.js').EditorSnapshot | undefined}
       */
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
        state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
         * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
         * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
         */
        (selection) =>
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
          /** 当前处理行的文本边界。
           * @type {import('./types.js').LineExtent}
           */
          const line = lineAt(state.text, selection.head);
        /** 当前字符或插入点的原始位置。
         * @type {number}
         */
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
    /** 实际输入并用于匹配的正则表达式。
     * @type {string | undefined}
     */
    const pattern =
      command === "split_selection_on_newline" ? "\\n" : args.pattern;
    regex(pattern);
    /** 本次编辑后独立计算的目标选区。
     * @type {import('./types.js').Selection[]}
     */
    const output = [];
    /** 当前处理的包含两端的选区。
     * @type {import('./types.js').Selection}
     */
    for (const selection of state.selections) {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
      const [from, to] = bounds(selection);
        /** 按包围跨度排序的候选边界。
         * @type {import('./types.js').Selection[]}
         */
        const found = matches(state.text.slice(from, to + 1), pattern, from);
      if (command === "select_regex")
        output.push(
          ...found.map(/** 将 found 中的记录转换为本次操作需要的结果。
           * @param {import('./types.js').Selection} match - 在原文本中查得的实际匹配选区。
           * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
           */
          (match) =>
            range(match.anchor, match.head, selection.anchor > selection.head),
          ),
        );
      else {
        /** 当前范围的起始偏移。
         * @type {number}
         */
        let start = from;
        /** 在原文本中查得的实际匹配选区。
         * @type {import('./types.js').Selection}
         */
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
    /** 实际输入并用于匹配的正则表达式。
     * @type {RegExp}
     */
    const pattern = regex(args.pattern);
    /** 本次编辑后独立计算的目标选区。
     * @type {import('./types.js').Selection[]}
     */
    const output = state.selections.filter(/** 依据实际条件筛选 state.selections 中的有效记录。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (selection) => {
      pattern.lastIndex = 0;
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
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
    /** 转义选区文字，避免搜索时解释为正则语法。
     * @type {(arg0: string) => string}
     * @param {string} text - 本次实际处理的文字内容。
     * @returns {string} 返回该操作的实际计算结果。
     */
    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    state.searchPattern = [
      ...new Set(
        state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
         * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
         * @returns {string} 返回该操作的实际计算结果。
         */
        (selection) => {
          /** 按既定顺序解构当前记录的边界、标识或测试参数。
           * @type {[number, number]}
           */
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
    /** 用户输入的实际目标字符。
     * @type {string}
     */
    const char = character(args);
      /** 是否沿文本反方向搜索或扩展。
       * @type {boolean}
       */
      const backward = command.includes("prev");
      /** 是否在目标字符前停止选择。
       * @type {boolean}
       */
      const till = command.includes("till");
      /** 是否保持锚点并扩展选择。
       * @type {boolean}
       */
      const extend = command.startsWith("extend_");
    /** 本次操作采用的有序选区集合。
     * @type {import('./types.js').Selection[]}
     */
    const selections = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
     */
    (selection) => {
      /** 本次移动最终到达的位置。
       * @type {number}
       */
      let target = selection.head;
      /** 尚需查找的目标字符出现次数。
       * @type {number}
       */
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) =>
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) =>
        range(selection.head, selection.head),
      ),
      state.primaryIndex,
    );
  if (command === "flip_selections")
    return setSelections(
      state,
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {{ anchor: number; head: number; }} 返回该操作的实际计算结果。
       */
      (selection) => ({
        anchor: selection.head,
        head: selection.anchor,
      })),
      state.primaryIndex,
    );
  if (command === "ensure_selections_forward")
    return setSelections(
      state,
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) => range(...bounds(selection))),
      state.primaryIndex,
    );
  if (command === "keep_primary_selection")
    return setSelections(state, [state.selections[state.primaryIndex]]);
  if (command === "remove_primary_selection")
    return setSelections(
      state,
      state.selections.filter(/** 依据实际条件筛选 state.selections 中的有效记录。
       * @param {import('./types.js').Selection} _ - 接口提供但本次计算不使用的参数。
       * @param {number} index - 当前记录在原集合中的索引。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (_, index) => index !== state.primaryIndex),
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
    /** 本次编辑后独立计算的目标选区。
     * @type {import('./types.js').Selection[]}
     */
    const output = [];
    /** 当前处理的包含两端的选区。
     * @type {import('./types.js').Selection}
     */
    for (const selection of state.selections) {
      /** 上一条可供恢复或合并的记录。
       * @type {import('./types.js').Selection | undefined}
       */
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {import('./types.js').Selection} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
          /** 当前范围覆盖的第一条记录。
           * @type {import('./types.js').LineExtent}
           */
          const first = lineAt(state.text, from);
          /** 当前范围覆盖的最后一条记录。
           * @type {import('./types.js').LineExtent}
           */
          const last = lineAt(state.text, to);
          /** 涉及行的去重起点集合。
           * @type {number[]}
           */
          const starts = lineStarts(state.text);
        /** 是否沿文本反方向搜索或扩展。
         * @type {boolean}
         */
        const backward =
          command === "extend_line_above" ||
          (command === "extend_line" && selection.anchor > selection.head);
        /** 当前选区是否已覆盖整行。
         * @type {boolean}
         */
        const full =
          from === first.start &&
          to === Math.max(first.start, last.endWithNewline - 1);
        /** 当前范围的起始偏移。
         * @type {number}
         */
        let start = first.start;
          /** 当前范围的终止偏移。
           * @type {number}
           */
          let end = last.endWithNewline;
        /** 除当前整行外需要扩展的行数。
         * @type {number}
         */
        const extra =
          command === "extend_to_line_bounds" ? 0 : count - (full ? 0 : 1);
        if (backward)
          start = starts[Math.max(0, starts.indexOf(first.start) - extra)];
        else {
          /** 范围末行在行起点集合中的索引。
           * @type {number}
           */
          const lastIndex = starts.indexOf(last.start);
          end = starts[lastIndex + extra + 1] ?? state.text.length;
        }
        return range(start, Math.max(start, end - 1), backward);
      }),
      state.primaryIndex,
    );
  if (command === "yank") {
    /** 本次读写的命名寄存器。
     * @type {string}
     */
    const register = registerName(args);
    state.registers[register] = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {string} 返回该操作的实际计算结果。
     */
    (selection) => {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
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
    /** 基于原缓冲区定位的单次修改。
     * @type {boolean}
     */
    const change = command.startsWith("change_");
    if (!command.endsWith("noyank")) {
      /** 当前记录的稳定名称。
       * @type {string}
       */
      const name = registerName(args);
      state.registers[name] = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
        return state.text.slice(from, to + 1);
      });
      delete state.macros[name];
    }
    remember(state);
    state.mode = change ? "insert" : "normal";
    return replaceSelected(
      state,
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @returns {string} 返回该操作的实际计算结果。
       */
      () => ""),
      { insertion: true },
    );
  }
  if (
    ["paste_before", "paste_after", "replace_with_yanked"].includes(command)
  ) {
    /** 当前记录的稳定名称。
     * @type {string}
     */
    const name = registerName(args);
      /** 规范化后的有效按键配置。
       * @type {string[]}
       */
      const values = state.registers[name];
    if (!values?.length) throw new Error(`寄存器 ${name} 为空`);
    remember(state);
    /** 各选区将实际写入的替换文本。
     * @type {string[]}
     */
    const replacements = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} _ - 接口提供但本次计算不使用的参数。
     * @param {number} index - 当前记录在原集合中的索引。
     * @returns {string} 返回该操作的实际计算结果。
     */
    (_, index) =>
      values[Math.min(index, values.length - 1)].repeat(count),
    );
    state.mode = "normal";
    if (command === "replace_with_yanked")
      return replaceSelected(state, replacements);
    /** 寄存器内容是否要求按整行粘贴。
     * @type {boolean}
     */
    const linewise = values.some(/** 检查 values 是否满足当前操作的完整条件。
     * @param {string} value - 本次实际输入、读取或比较的值。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (value) => value.endsWith("\n"));
    /** 此前修改累积造成的位置偏移。
     * @type {number}
     */
    let offset = 0;
    /** 本次编辑后独立计算的目标选区。
     * @type {import('./types.js').Selection[]}
     */
    const output = [];
    /** 本次操作基于原缓冲区生成的修改集合。
     * @type {{ from: number; to: number; text: string; }[]}
     */
    const changes = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @param {number} index - 当前记录在原集合中的索引。
     * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
     */
    (selection, index) => {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
      const [from, to] = bounds(selection);
      /** 当前字符或插入点的原始位置。
       * @type {number}
       */
      const position = linewise
        ? command === "paste_before"
          ? lineAt(state.text, from).start
          : lineAt(state.text, to).endWithNewline
        : command === "paste_before"
          ? from
          : to + 1;
      /** 本次实际处理的文字内容。
       * @type {string}
       */
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
    // 多个选区可能落在同一个整行粘贴位置；原生 Helix 会归一化这些落点，
    // 而不会重复插入整行内容。
    /** 已处理的目标偏移集合。
     * @type {Set<number>}
     */
    const seen = new Set();
    /** 不同插入落点对应的修改记录。
     * @type {{ from: number; to: number; text: string; }[]}
     */
    const distinct = changes.filter(/** 依据实际条件筛选 changes 中的有效记录。
     * @param {{ from: number; to: number; text: string; }} change - 基于原缓冲区定位的单次修改。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (change) => {
      if (seen.has(change.from)) return false;
      seen.add(change.from);
      return true;
    });
    if (distinct.length !== changes.length)
      throw new Error("多个行式粘贴落点重合，请先保留每行一个选区");
    return edits(state, changes, /** 返回本次编辑显式计算出的结果，不修改调用者输入。
     * @returns {import('./types.js').Selection[]} 返回该操作的实际计算结果。
     */
    () => output);
  }
  if (command === "replace") {
    /** 用户输入的实际目标字符。
     * @type {string}
     */
    const char = character(args);
    remember(state);
    state.mode = "normal";
    return replaceSelected(
      state,
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
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
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
          /** 本次实际处理的文字内容。
           * @type {string}
           */
          const text = state.text.slice(from, to + 1);
        return command === "switch_to_uppercase"
          ? text.toUpperCase()
          : command === "switch_to_lowercase"
            ? text.toLowerCase()
            : [...text]
                .map(/** 将 [...text] 中的记录转换为本次操作需要的结果。
                 * @param {string} char - 用户输入的实际目标字符。
                 * @returns {string} 返回该操作的实际计算结果。
                 */
                (char) =>
                  char === char.toUpperCase()
                    ? char.toLowerCase()
                    : char.toUpperCase(),
                )
                .join("");
      }),
    );
  }
  if (command === "surround_add") {
    /** 按既定顺序解构当前记录的边界、标识或测试参数。
     * @type {[string, string]}
     */
    const [open, close] = pairFor(character(args));
    remember(state);
    state.mode = "normal";
    return replaceSelected(
      state,
      state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
       * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (selection) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {[number, number]}
         */
        const [from, to] = bounds(selection);
        return open + state.text.slice(from, to + 1) + close;
      }),
    );
  }
  if (command === "surround_replace" || command === "surround_delete") {
    /** 用户指定的实际文本对象字符。
     * @type {string}
     */
    const object = character(args, "object");
      /** 本次包围操作使用的开闭字符。
       * @type {string[]}
       */
      const pair =
        command === "surround_replace" ? pairFor(character(args)) : ["", ""];
    /** 本次操作基于原缓冲区生成的修改集合。
     * @type {{ from: number; to: number; text: string; }[]}
     */
    const changes = state.selections.flatMap(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {{ from: number; to: number; text: string; }[]} 返回该操作的实际计算结果。
     */
    (selection) => {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
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
    /** 缩进一级所占的显示列数。
     * @type {number}
     */
    const width = state.indentWidth ?? 2;
    /** 本次操作基于原缓冲区生成的修改集合。
     * @type {{ from: number; to: number; text: string; }[]}
     */
    const changes = selectedLines(state).flatMap(/** 将 selectedLines(state) 中的记录转换为本次操作需要的结果。
     * @param {number} start - 当前范围的起始偏移。
     * @returns {{ from: number; to: number; text: string; }[]} 返回该操作的实际计算结果。
     */
    (start) => {
      /** 当前处理行的文本边界。
       * @type {import('./types.js').LineExtent}
       */
      const line = lineAt(state.text, start);
        /** 当前行去除行边界后的实际文本。
         * @type {string}
         */
        const content = state.text.slice(start, line.end);
      if (!content.trim()) return [];
      if (command === "indent")
        return [{ from: start, to: start, text: " ".repeat(width * count) }];
      /** 当前范围的终止偏移。
       * @type {number}
       */
      let end = start;
        /** 本次退缩进已经消耗的显示列数。
         * @type {number}
         */
        let columns = 0;
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
    /** 需要合并的换行位置集合。
     * @type {Set<number>}
     */
    const positions = new Set();
    /** 当前处理的包含两端的选区。
     * @type {import('./types.js').Selection}
     */
    for (const selection of state.selections) {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
      const [from, to] = bounds(selection);
        /** 当前范围覆盖的第一条记录。
         * @type {import('./types.js').LineExtent}
         */
        const first = lineAt(state.text, from);
        /** 当前范围覆盖的最后一条记录。
         * @type {import('./types.js').LineExtent}
         */
        const last = lineAt(state.text, to);
      /** 循环当前正在处理的行或记录。
       * @type {import('./types.js').LineExtent}
       */
      let current = first;
      /** 本次修改允许处理的最远边界。
       * @type {number}
       */
      const limit =
        first.start === last.start ? first.endWithNewline : last.start;
      while (current.end < state.text.length && current.end < limit) {
        positions.add(current.end);
        current = lineAt(state.text, current.end + 1);
      }
    }
    /** 本次操作基于原缓冲区生成的修改集合。
     * @type {{ from: number; to: number; text: string; }[]}
     */
    const changes = [...positions]
      .sort(/** 比较 [...positions] 中的记录以保持确定性顺序。
       * @param {number} a - 当前比较或处理的动作记录。
       * @param {number} b - 用于成对比较的另一个动作记录。
       * @returns {number} 返回该操作的实际计算结果。
       */
      (a, b) => a - b)
      .map(/** 将 [...positions]
            .sort((a, b) => a - b) 中的记录转换为本次操作需要的结果。
       * @param {number} position - 当前字符或插入点的原始位置。
       * @returns {{ from: number; to: number; text: string; }} 返回该操作的实际计算结果。
       */
      (position) => {
        /** 当前范围的排他结束偏移。
         * @type {number}
         */
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
    /** 此前修改累积造成的位置偏移。
     * @type {number}
     */
    let offset = 0;
    /** 合并换行后生成的空格选区。
     * @type {import('./types.js').Selection[]}
     */
    const spaces = changes.flatMap(/** 将 changes 中的记录转换为本次操作需要的结果。
     * @param {{ from: number; to: number; text: string; }} change - 基于原缓冲区定位的单次修改。
     * @returns {import('./types.js').Selection[]} 返回该操作的实际计算结果。
     */
    (change) => {
      /** 修改后缓冲区中的实际目标位置。
       * @type {number}
       */
      const point = change.from + offset;
      offset += change.text.length - (change.to - change.from);
      return change.text ? [range(point, point)] : [];
    });
    return edits(
      state,
      changes,
      command === "join_selections_space" && spaces.length
        ? /** 返回本次编辑显式计算出的结果，不修改调用者输入。
         * @returns {import('./types.js').Selection[]} 返回该操作的实际计算结果。
         */
        () => spaces
        : undefined,
    );
  }
  if (command.startsWith("rotate_selection_contents_")) {
    /** 规范化后的有效按键配置。
     * @type {string[]}
     */
    const values = state.selections.map(/** 将 state.selections 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').Selection} selection - 当前处理的包含两端的选区。
     * @returns {string} 返回该操作的实际计算结果。
     */
    (selection) => {
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[number, number]}
       */
      const [from, to] = bounds(selection);
      return state.text.slice(from, to + 1);
    });
    /** 每组轮换包含的选区数量。
     * @type {number}
     */
    const size =
        args.count === undefined
          ? values.length
          : Math.min(count, values.length);
      /** 按组旋转后的真实选区文本。
       * @type {string[]}
       */
      const rotated = [];
    /** 顺序遍历的当前索引。
     * @type {number}
     */
    for (let i = 0; i < values.length; i += size) {
      /** 当前处理的选区分组或目录类别。
       * @type {string[]}
       */
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
/** 校验命令参数与计数后执行真实编辑。
 * @param {import('./types.js').EditorState} input - 本次操作传入的实际记录。
 * @param {string} command - 从配置中解析出的实际命令。
 * @param {import('./types.js').CommandArgs} [args] - 实际交给命令引擎执行的参数。
 * @returns {import('./types.js').AdvancedState} 参数、次数和命令支持范围校验通过后的独立高级状态；非法命令或参数抛出异常，调用者输入不被修改。
 */
export function executeAdvanced(input, command, args = {}) {
  if (!supportsCommand(command))
    throw new Error(`当前真实编辑练习不支持命令：${command}`);
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("命令参数必须是对象");
  /** 本次命令的有效重复次数。
   * @type {number}
   */
  const count = countOf(args);
  /** 命令允许接收的参数名称集合。
   * @type {Set<string>}
   */
  const fields = new Set(
    (ADVANCED_INTERACTIONS[command]?.fields || []).map(/** 将 (ADVANCED_INTERACTIONS[command]?.fields || []) 中的记录转换为本次操作需要的结果。
     * @param {import('./types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {string} 返回该操作的实际计算结果。
     */
    (field) => field.name),
  );
  /** 当前按键或配置键名。
   * @type {string}
   */
  for (const key of Object.keys(args))
    if (key !== "count" && !fields.has(key))
      throw new Error(`命令 ${command} 不接受参数 ${key}`);
  /** 该命令是否接受重复次数。
   * @type {boolean}
   */
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
  /** 实际编辑引擎的当前状态。
   * @type {import('./types.js').AdvancedState}
   */
  const state = execute(input, command, args, count);
  state.wordBoundary = null;
  if (!["record_macro"].includes(command))
    record(state, { command, args: { ...args } });
  return state;
}

/** 声明带可选参数的课程命令步骤。
 * @type {(action: string, args?: import('./types.js').CommandArgs, mode?: import('./types.js').Mode) => import('./types.js').LessonStep}
 * @param {string} action - 课程将交给引擎执行的官方命令名，不是动作记录对象。
 * @param {import('./types.js').CommandArgs} [args] - 课程显式要求用户提供的命令参数，省略时步骤中不创建 args 字段。
 * @param {import('./types.js').Mode} [mode] - 执行此步骤前必须处于的编辑模式，默认普通模式。
 * @returns {import('./types.js').LessonStep} 只描述模式、命令与可选参数的命令步骤，不在声明时执行编辑。
 */
const step = (action, args, mode = "normal") => ({
  mode,
  action,
  ...(args ? { args } : {}),
});
/** 声明课程中需要实际输入的文字。
 * @type {(text: string) => import('./types.js').LessonStep}
 * @param {string} text - 用户需要在插入模式实际输入的完整文字。
 * @returns {import('./types.js').LessonStep} 带 type=text 判别字段和原始文字的输入步骤，不把文字当作快捷键。
 */
const textStep = (text) => ({ type: "text", text });
/** 声明独立编写的课程目标状态。
 * @type {(text: string, anchor: number, head?: number, selections?: import('./types.js').Selection[], primaryIndex?: number) => import('./types.js').EditorSnapshot}
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} anchor - 选区固定端的包含式偏移。
 * @param {number} [head] - 选区光标端的包含式偏移。
 * @param {import('./types.js').Selection[]} [selections] - 本次操作采用的有序选区集合。
 * @param {number} [primaryIndex] - 需要保留的主选区索引。
 * @returns {import('./types.js').EditorSnapshot} 独立编写的普通模式目标；省略光标端、选区集合或主索引时采用单光标选区和索引零。
 */
const goal = (
  text,
  anchor,
  head = anchor,
  selections = [range(anchor, head)],
  primaryIndex = 0,
) => ({ text, anchor, head, mode: "normal", selections, primaryIndex });
/** 组合高级课程元数据与真实编辑目标。
 * @type {(arg0: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: number, arg6: import('./types.js').LessonStep[], arg7: import('./types.js').EditorSnapshot, arg8: string, arg9: string) => import('./types.js').Lesson}
 * @param {string} id - 不会覆盖现有配置的稳定记录标识。
 * @param {string} theme - 课程使用的高级编辑主题。
 * @param {string} title - 课程的中文显示标题。
 * @param {string} description - 课程或问题的真实场景说明。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {number} cursor - 初始光标的 UTF-16 偏移。
 * @param {import('./types.js').LessonStep[]} steps - 用户需要真实执行的课程步骤。
 * @param {import('./types.js').EditorSnapshot} expected - 独立编写而非从执行结果推导的目标状态。
 * @param {string} concept - 课程需要掌握的编辑概念。
 * @param {string} tip - 帮助用户理解真实行为的提示。
 * @returns {import('./types.js').Lesson} 带 adv- 稳定标识、独立期望状态和原样步骤数据的高级课程，不运行引擎推导答案。
 */
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
/** 具有独立文本目标的完整高级课程。
 * @type {import('./types.js').Lesson[]}
 */
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
