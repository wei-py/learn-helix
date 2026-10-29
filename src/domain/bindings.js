import { COMMAND_ZH } from "./catalog-zh.js";
import {
  CATALOG_VERSION,
  COMMANDS,
  DEFAULT_KEYMAP,
  TYPABLE_COMMANDS,
} from "./catalog.js";
/** 三种编辑模式的中文显示名称。
 * @type {Record<import('./types.js').Mode, string>}
 */
export const MODES = { normal: "普通", select: "选择", insert: "插入" };
/** 官方命令到历史基础动作标识的兼容映射。
 * @type {Record<string, string>}
 */
const legacy = {
  move_char_left: "left",
  move_visual_line_down: "down",
  move_visual_line_up: "up",
  move_char_right: "right",
  move_next_word_start: "word",
  move_prev_word_start: "backword",
  select_mode: "select",
  insert_mode: "insert",
  delete_selection: "delete",
  undo: "undo",
  normal_mode: "normal",
  extend_char_left: "left",
  extend_visual_line_down: "down",
  extend_visual_line_up: "up",
  extend_char_right: "right",
  extend_next_word_start: "word",
  extend_prev_word_start: "backword",
};
/** 历史基础动作的中文提示。
 * @type {Record<string, string>}
 */
const labels = {
  left: "向左移动",
  right: "向右移动",
  up: "向上移动",
  down: "向下移动",
  word: "下一个词首",
  backword: "上一个词首",
  select: "进入选择模式",
  insert: "在选择前插入",
  delete: "删除选区",
  undo: "撤销编辑",
  normal: "返回普通模式",
};
/** 已经分配基础标识的模式与动作组合。
 * @type {Set<string>}
 */
const seen = new Set();
/** 为完整官方键位分配稳定标识后的动作记录。
 * @type {import('./types.js').BindingAction[]}
 */
export const ACTIONS = DEFAULT_KEYMAP.map(/** 将 DEFAULT_KEYMAP 中的记录转换为本次操作需要的结果。
 * @param {import('./types.js').KeymapRow} row - 本次垂直移动到达的行号。
 * @param {number} index - 当前记录在原集合中的索引。
 * @returns {{ id: string; label: string; mode: import('./types.js').Mode; key: string; keys: string[]; command: string | string[]; description: string; group: string; sourceGroup: string; prefix: string[]; sticky: boolean; input?: import('./types.js').CatalogInput; }} 返回该操作的实际计算结果。
 */
(row, index) => {
  /** 单命令或命令序列的可读名称。
   * @type {string}
   */
  const commandName =
    typeof row.command === "string" ? row.command : row.command.join(" → ");
  /** 保持历史进度兼容的基础动作标识。
   * @type {string}
   */
  const base =
    row.mode === "select" && commandName === "exit_select_mode"
      ? "normal"
      : row.mode === "select" && commandName === "normal_mode"
        ? "normal_mode"
        : legacy[commandName] || commandName;
  /** 当前范围覆盖的第一条记录。
   * @type {boolean}
   */
  const first = !seen.has(`${row.mode}.${base}`);
  seen.add(`${row.mode}.${base}`);
  return {
    ...row,
    id: first ? base : `${base}~${index}`,
    label:
      COMMAND_ZH[commandName] || labels[base] || row.description || commandName,
  };
});
/** 组合稳定的模式与动作标识以兼容旧存储。
 * @type {(arg0: import('./types.js').BindingAction) => string}
 * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
 * @returns {string} 返回该操作的实际计算结果。
 */
export const bindingId = (action) => `${action.mode}.${action.id}`;
/** 以稳定动作标识索引的完整默认按键配置。
 * @type {import('./types.js').Bindings}
 */
export const DEFAULT_BINDINGS = Object.fromEntries(
  ACTIONS.map(/** 将 ACTIONS 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
   * @returns {[string, string]} 返回该操作的实际计算结果。
   */
  (a) => [bindingId(a), a.key]),
);
/** 合并静态与冒号命令后的完整官方命令清单。
 * @type {import('./types.js').CatalogCommand[]}
 */
export const ALL_COMMANDS = [
  ...COMMANDS,
  ...TYPABLE_COMMANDS.map(/** 将 TYPABLE_COMMANDS 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').CatalogCommand} c - 当前遍历的官方命令记录。
   * @returns {{ name: string; description: string; kind: string; aliases?: string[]; minArgs?: number; maxArgs?: number | null; }} 返回该操作的实际计算结果。
   */
  (c) => ({ ...c, name: `:${c.name}` })),
];
/** 用于校验命令输入的官方名称集合。
 * @type {Set<string>}
 */
const commandNames = new Set(ALL_COMMANDS.map(/** 将 ALL_COMMANDS 中的记录转换为本次操作需要的结果。
 * @param {import('./types.js').CatalogCommand} c - 当前遍历的官方命令记录。
 * @returns {string} 返回该操作的实际计算结果。
 */
(c) => c.name));
/** 可输入命令及其原生别名的名称集合。
 * @type {Set<string>}
 */
const typableNames = new Set(
  TYPABLE_COMMANDS.flatMap(/** 将 TYPABLE_COMMANDS 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').CatalogCommand} command - 从配置中解析出的实际命令。
   * @returns {string[]} 返回该操作的实际计算结果。
   */
  (command) => [
    command.name,
    ...(command.aliases || []),
  ]),
);
/** 校验官方命令、冒号参数和真实命令序列。
 * @param {string | string[]} value - 官方命令、含参数的冒号命令，或命令数组及其 JSON 文本。
 * @returns {string | string[]} 校验后的原单命令或命令数组；未注册的命令和非法 JSON 序列抛出异常。
 */
export function parseCommand(value) {
  /** 从配置中解析出的实际命令。
   * @type {string | string[]}
   */
  let command = value;
  if (typeof command === "string" && command.trim().startsWith("[")) {
    try {
      command = JSON.parse(command);
    } catch {
      throw new Error(
        '命令序列请使用 JSON 数组，例如 ["move_char_right","delete_selection"]',
      );
    }
  }
  /** 待校验的单命令或命令序列。
   * @type {string[]}
   */
  const commands = Array.isArray(command) ? command : [command];
  if (
    !commands.length ||
    commands.some(
      /** 检查 commands 是否满足当前操作的完整条件。
       * @param {string} name - 当前记录的稳定名称。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (name) =>
        typeof name !== "string" ||
        (!commandNames.has(name) &&
          !(
            name.startsWith(":") &&
            typableNames.has(name.slice(1).split(/\s/)[0])
          )),
    )
  ) {
    throw new Error(
      "请选择有效静态命令，或 :命令 参数；序列中每项都必须是官方命令",
    );
  }
  return command;
}
/** 合并官方动作与配置中的自定义动作记录。
 * @param {import('./types.js').Bindings} [bindings] - 当前有效的完整键位配置。
 * @returns {import('./types.js').BindingAction[]} 全部官方动作与解码后的自定义记录；保留无效模式和损坏命令供后续校验报告，不静默丢弃。
 */
export function actionsFor(bindings = DEFAULT_BINDINGS) {
  return [
    ...ACTIONS,
    ...Object.keys(bindings)
      .filter(/** 依据实际条件筛选 Object.keys(bindings) 中的有效记录。
       * @param {string} id - 不会覆盖现有配置的稳定记录标识。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (id) => id.includes(".custom:"))
      .map(/** 将 Object.keys(bindings)
            .filter((id) => id.includes(".custom:")) 中的记录转换为本次操作需要的结果。
       * @param {string} id - 不会覆盖现有配置的稳定记录标识。
       * @returns {import('./types.js').BindingAction} 返回该操作的实际计算结果。
       */
      (id) => {
        /** 按既定顺序解构当前记录的边界、标识或测试参数。
         * @type {string[]}
         */
        const [mode, ...rest] = id.split(".");
        /** 从配置中解析出的实际命令。
         * @type {string | string[]}
         */
        let command, /** 自定义命令记录的无效标记。
         * @type {boolean | undefined}
         */
        invalid;
        try {
          /** 编码进自定义记录标识的命令文本。
           * @type {string}
           */
          const encoded = rest.join(".").slice(7);
          /** 从自定义记录标识解码出的命令文本。
           * @type {string}
           */
          const decoded = decodeURIComponent(
            encoded.slice(0, encoded.lastIndexOf("~")),
          );
          command = parseCommand(decoded);
        } catch {
          command = "无效命令记录";
          invalid = true;
        }
        return {
          mode,
          id: id.slice(mode.length + 1),
          command,
          invalid,
          key: "",
          label: COMMAND_ZH[command] || command,
          group: "自定义",
        };
      }),
  ];
}
/** 添加不覆盖现有记录的自定义命令绑定。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @param {import('./types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string | string[]} command - 从配置中解析出的实际命令。
 * @param {string} key - 当前按键或配置键名。
 * @returns {import('./types.js').Bindings} 添加唯一自定义记录标识后的新配置，不修改输入，不在此阶段消除按键冲突。
 */
export function addBinding(bindings, mode, command, key) {
  if (!MODES[mode]) throw new Error("请选择有效模式");
  command = parseCommand(command);
  /** 避免覆盖已有记录的递增编号。
   * @type {number}
   */
  let suffix = 1;
  /** 不会覆盖现有配置的稳定记录标识。
   * @type {string | undefined}
   */
  let id;
  /** 编码进自定义记录标识的命令文本。
   * @type {string}
   */
  const encoded = encodeURIComponent(
    Array.isArray(command) ? JSON.stringify(command) : command,
  );
  do {
    id = `${mode}.custom:${encoded}~${suffix++}`;
  } while (id in bindings);
  return { ...bindings, [id]: key };
}
/** 优先解析当前有效且被用户修改的命令别名。
 * @param {import('./types.js').Bindings} [bindings] - 当前有效的完整键位配置。
 * @param {import('./types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string | string[]} command - 从配置中解析出的实际命令。
 * @returns {import('./types.js').BindingAction | undefined} 当前有效动作，优先显式自定义和被修改的别名；没有有效绑定时返回 undefined。
 */
export function actionForCommand(bindings = DEFAULT_BINDINGS, mode, command) {
  /** 按当前配置生成的动作记录集合。
   * @type {import('./types.js').BindingAction[]}
   */
  const rows = actionsFor(bindings).filter(/** 依据实际条件筛选 actionsFor(bindings) 中的有效记录。
   * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (action) => action.mode === mode);
  /** 直接匹配稳定标识的动作。
   * @type {import('./types.js').BindingAction | undefined}
   */
  const exact = rows.find(/** 在 rows 中定位符合当前条件的真实记录。
   * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (action) => action.id === command);
  if (exact?.id.startsWith("custom:") && bindings[bindingId(exact)])
    return exact;
  /** 基础动作对应的官方命令名称。
   * @type {string | string[]}
   */
  const canonical = exact?.command || command;
  /** 当前模式下仍然绑定的有效别名候选。
   * @type {import('./types.js').BindingAction[]}
   */
  const candidates = rows.filter(
    /** 依据实际条件筛选 rows 中的有效记录。
     * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
     * @returns {string | false} 返回该操作的实际计算结果。
     */
    (action) => action.command === canonical && bindings[bindingId(action)],
  );
  return (
    candidates.find(/** 在 candidates 中定位符合当前条件的真实记录。
     * @param {import('./types.js').BindingAction} action - 当前配置解析出的真实动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (action) => bindings[bindingId(action)] !== action.key) ||
    candidates[0]
  );
}
/** Helix 支持的命名按键与功能键名称。
 * @type {Set<string>}
 */
const named = new Set([
  "space",
  "esc",
  "ret",
  "tab",
  "backspace",
  "del",
  "ins",
  "left",
  "right",
  "up",
  "down",
  "home",
  "end",
  "pageup",
  "pagedown",
  "minus",
  "null",
  "capslock",
  "numlock",
  "scrolllock",
  "printscreen",
  "pause",
  "menu",
  "keypadbegin",
  "play",
  "pausemedia",
  "playpause",
  "stop",
  "reverse",
  "fastforward",
  "rewind",
  "tracknext",
  "trackprevious",
  "record",
  "lowervolume",
  "raisevolume",
  "mutevolume",
  "leftshift",
  "leftcontrol",
  "leftalt",
  "leftsuper",
  "lefthyper",
  "leftmeta",
  "rightshift",
  "rightcontrol",
  "rightalt",
  "rightsuper",
  "righthyper",
  "rightmeta",
  "isolevel3shift",
  "isolevel5shift",
  ...Array.from({ length: 24 }, /** 按索引生成固定数量的真实记录。
   * @param {undefined} _ - 接口提供但本次计算不使用的参数。
   * @param {number} i - 顺序遍历的当前索引。
   * @returns {string} 返回该操作的实际计算结果。
   */
  (_, i) => `F${i + 1}`),
]);
/** 浏览器与常用用户写法到规范按键名称的映射。
 * @type {Record<string, string>}
 */
const aliases = {
  escape: "esc",
  enter: "ret",
  return: "ret",
  delete: "del",
  insert: "ins",
  " ": "space",
  "-": "minus",
  spacebar: "space",
  pgup: "pageup",
  pgdn: "pagedown",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  arrowdown: "down",
};
/** 规范 Helix 修饰键语法且保留大小写语义。
 * @param {string} input - 本次操作传入的实际记录。
 * @returns {string} 返回该操作的实际计算结果。
 */
export function normalizeKey(input) {
  if (input === " ") return "space";
  /** 当前按键或配置键名。
   * @type {string}
   */
  let key = input
    .trim()
    .replace(
      /(?:control|ctrl)\+([A-Z])$/gi,
      /** 规范化匹配的实际文本片段，保留原字符语义。
       * @param {string} _ - 接口提供但本次计算不使用的参数。
       * @param {string} letter - 匹配到的原始字母字符。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (_, letter) => `C-${letter.toLowerCase()}`,
    )
    .replace(/control[+-]|ctrl[+-]/gi, "C-")
    .replace(/alt[+-]/gi, "A-")
    .replace(/shift[+-]/gi, "S-")
    .replace(/super[+-]|meta[+-]|cmd[+-]|win[+-]/gi, "Meta-");
  /** 按规范顺序收集的修饰键。
   * @type {string[]}
   */
  const mods = [];
  while (/^(?:[CAS]|Meta)-/.test(key)) {
    /** 当前规范化的单个修饰键。
     * @type {string}
     */
    const modifier = key.slice(0, key.indexOf("-"));
    if (mods.includes(modifier)) throw new Error("修饰键不能重复");
    mods.push(modifier);
    key = key.slice(modifier.length + 1);
  }
  key =
    aliases[key.toLowerCase()] ||
    { lt: "<", gt: ">" }[key.toLowerCase()] ||
    (/^f(?:[1-9]|1\d|2[0-4])$/i.test(key)
      ? key.toUpperCase()
      : named.has(key.toLowerCase())
        ? key.toLowerCase()
        : key);
  if (!named.has(key) && (Array.from(key).length !== 1 || /\s/u.test(key)))
    throw new Error(`不支持的 Helix 按键「${input}」`);
  if (mods.includes("S") && /^[a-z]$/.test(key)) {
    key = key.toUpperCase();
    mods.splice(mods.indexOf("S"), 1);
  }
  return [
    ...["C", "A", "S", "Meta"].filter(/** 依据实际条件筛选 ["C", "A", "S", "Meta"] 中的有效记录。
     * @param {string} modifier - 当前规范化的单个修饰键。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (modifier) => mods.includes(modifier)),
    key,
  ].join("-");
}
/** 校验并拆分完整按键序列。
 * @param {string} value - 本次实际输入、读取或比较的值。
 * @returns {string[]} 按输入顺序排列的规范按键 token；空序列或非法按键抛出异常。
 */
export function parseSequence(value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("快捷键不能为空");
  return value.trim().split(/\s+/).map(normalizeKey);
}
/** 校验模式、命令和同模式下的重复及前缀冲突。
 * @param {import('./types.js').Bindings | import('./types.js').JsonValue | undefined} input - 用户设置或本地记录中的待校验键位；非记录值会返回根级错误。
 * @returns {import('./types.js').BindingValidation} 规范化配置、按稳定动作标识索引的全部错误，以及只有无错误时才为真的 valid。
 */
export function validateBindings(input) {
  /** 规范化后的有效按键配置。
   * @type {import('./types.js').Bindings}
   */
  const values = {};
    /** 按动作标识记录的校验错误。
     * @type {Record<string, string>}
     */
    const errors = {};
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { values, errors: { root: "无效键位配置" }, valid: false };
  /** 当前配置实际可用的动作集合。
   * @type {import('./types.js').BindingAction[]}
   */
  const actions = actionsFor(input);
  /** 当前比较或处理的动作记录。
   * @type {import('./types.js').BindingAction}
   */
  for (const a of actions) {
    /** 不会覆盖现有配置的稳定记录标识。
     * @type {string}
     */
    const id = bindingId(a);
    if (input[id] === "" || input[id] === undefined) {
      values[id] = "";
      continue;
    }
    try {
      if (!MODES[a.mode]) throw new Error("未知模式");
      if (a.invalid) throw new Error("无效命令记录");
      if (id.includes(".custom:")) parseCommand(a.command);
      values[id] = parseSequence(input[id]).join(" ");
    } catch (e) {
      errors[id] = e.message;
    }
  }
  /** 不会覆盖现有配置的稳定记录标识。
   * @type {string}
   */
  for (const id of Object.keys(input))
    if (!actions.some(/** 检查 actions 是否满足当前操作的完整条件。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => bindingId(a) === id)) errors[id] = "未知键位记录";
  /** 当前按键配置所属的编辑模式。
   * @type {string}
   */
  for (const mode of Object.keys(MODES)) {
    /** 当前模式下非空且有序的绑定记录。
     * @type {import('./types.js').BindingAction[]}
     */
    const active = actions
      .filter(/** 依据实际条件筛选 actions 中的有效记录。
       * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
       * @returns {string | false} 返回该操作的实际计算结果。
       */
      (a) => a.mode === mode && values[bindingId(a)])
      .sort(/** 比较 actions
            .filter((a) => a.mode === mode && values[bindingId(a)]) 中的记录以保持确定性顺序。
       * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
       * @param {import('./types.js').BindingAction} b - 用于成对比较的另一个动作记录。
       * @returns {number} 返回该操作的实际计算结果。
       */
      (a, b) => values[bindingId(a)].localeCompare(values[bindingId(b)]));
    /** 顺序遍历的当前索引。
     * @type {number}
     */
    for (let i = 0; i < active.length; i++)
      /** 内层遍历的当前索引。
       * @type {number}
       */
      for (let j = i + 1; j < active.length; j++) {
        /** 当前比较或处理的动作记录。
         * @type {string}
         */
        const a = bindingId(active[i]);
          /** 用于成对比较的另一个动作记录。
           * @type {string}
           */
          const b = bindingId(active[j]);
          /** 第一条绑定的规范序列。
           * @type {string}
           */
          const x = values[a];
          /** 第二条绑定的规范序列。
           * @type {string}
           */
          const y = values[b];
        if (x === y || x.startsWith(`${y  } `) || y.startsWith(`${x  } `))
          errors[a] = errors[b] = "同模式重复绑定或前缀冲突";
      }
  }
  return { values, errors, valid: !Object.keys(errors).length };
}
/** US/ABC 布局中符号物理键的普通与 Shift 字符。
 * @type {Record<string, [string, string]>}
 */
const optionSymbols = {
  Backquote: ["`", "~"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Space: [" ", " "],
};
/** 规范实际键盘事件并恢复 macOS Option 物理键。
 * @param {import('./types.js').KeyEvent} event - 浏览器报告的逻辑键、物理编码与修饰键状态。
 * @param {string} [platform] - 实际运行平台，用于决定 Option 恢复规则。
 * @returns {string | null} 保留大小写语义的规范 Helix 按键；纯修饰键、死键或不支持的输入返回 null。
 */
export function keyFromEvent(event, platform = globalThis.navigator?.platform || "") {
  /** 浏览器实际报告的逻辑按键。
   * @type {string}
   */
  let rawKey = event.key;
  // macOS Option 可能报告组合字符或死键，而不是实际快捷键。
  // 保留布局提供的 ASCII 逻辑键，仅在必要时恢复 US/ABC 物理位置。
  if (
    /Mac/.test(platform) &&
    event.altKey &&
    (rawKey === "Dead" || /^\P{ASCII}$/u.test(rawKey))
  ) {
    if (/^Key[A-Z]$/.test(event.code)) {
      /** 物理位置恢复是否应采用大写字符。
       * @type {boolean}
       */
      const upper = Boolean(event.shiftKey) !== Boolean(event.getModifierState?.("CapsLock"));
      rawKey = upper ? event.code.slice(3) : event.code.slice(3).toLowerCase();
    } else if (/^Digit\d$/.test(event.code)) {
      /** 数字键物理编码中的数字字符。
       * @type {string}
       */
      const digit = event.code.slice(5);
      rawKey = event.shiftKey ? ")!@#$%^&*("[Number(digit)] : digit;
    } else {
      rawKey = optionSymbols[event.code]?.[event.shiftKey ? 1 : 0] || rawKey;
    }
  }
  if (
    [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "Dead",
      "Process",
      "Unidentified",
    ].includes(rawKey)
  )
    return null;
  /** 当前按键或配置键名。
   * @type {string}
   */
  const key = aliases[rawKey.toLowerCase()] || rawKey;
  /** 按规范顺序收集的修饰键。
   * @type {(string | false | undefined)[]}
   */
  const mods = [
    event.ctrlKey && "C",
    event.altKey && "A",
    event.shiftKey && Array.from(key).length !== 1 && "S",
    event.metaKey && "Meta",
  ].filter(Boolean);
  try {
    return normalizeKey([...mods, key].join("-"));
  } catch {
    return null;
  }
}
/** 将规范按键序列转换为可读提示。
 * @param {string} [sequence] - 需要显示或写入的规范按键序列。
 * @returns {string} 人类可读的完整按键序列；空绑定显示“未绑定”，不替用户恢复默认键。
 */
export function displayKey(sequence = "") {
  if (!sequence) return "未绑定";
  return sequence
    .split(" ")
    .map(
      /** 将 sequence
          .split(" ") 中的记录转换为本次操作需要的结果。
       * @param {string} k - k 对应的实际输入记录。
       * @returns {string} 返回该操作的实际计算结果。
       */
      (k) =>
        ({
          esc: "Esc",
          space: "Space",
          ret: "Enter",
          tab: "Tab",
          backspace: "⌫",
          left: "←",
          right: "→",
          up: "↑",
          down: "↓",
        })[k] ||
        k
          .replace("C-", "Ctrl+")
          .replace("A-", "Alt+")
          .replace("S-", "Shift+")
          .replace("Meta-", "Meta+"),
    )
    .join(" → ");
}
/** 按当前绑定识别完整动作、未完成前缀或未绑定按键。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @param {import('./types.js').Mode} mode - 当前按键配置所属的编辑模式。
 * @param {string[]} pending - 当前尚未完成的配置按键前缀。
 * @param {string} key - 当前按键或配置键名。
 * @param {boolean} [fresh] - 是否忽略旧前缀并从新序列开始。
 * @returns {import('./types.js').KeyResolution} 原样保留本次 token 序列，并区分命中动作、仍可续接的前缀和未绑定输入。
 */
export function resolveKeyInput(bindings, mode, pending, key, fresh = false) {
  /** 本次输入累积的规范按键序列。
   * @type {string[]}
   */
  const tokens = [...(fresh ? [] : pending), key];
    /** 用于比较的完整规范按键文本。
     * @type {string}
     */
    const sequence = tokens.join(" ");
  /** 当前配置实际可用的动作集合。
   * @type {import('./types.js').BindingAction[]}
   */
  const actions = actionsFor(bindings).filter(
    /** 依据实际条件筛选 actionsFor(bindings) 中的有效记录。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {string | false} 返回该操作的实际计算结果。
     */
    (a) => a.mode === mode && bindings[bindingId(a)],
  );
  /** 当前配置解析出的真实动作记录。
   * @type {import('./types.js').BindingAction | undefined}
   */
  const action = actions.find(/** 在 actions 中定位符合当前条件的真实记录。
   * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (a) => bindings[bindingId(a)] === sequence);
  return {
    tokens,
    sequence,
    action,
    status: action
      ? "action"
      : actions.some(/** 检查 actions 是否满足当前操作的完整条件。
       * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (a) => bindings[bindingId(a)].startsWith(`${sequence  } `))
        ? "prefix"
        : "unbound",
  };
}
/** 输出真实 Helix TOML 并显式禁用腾出的默认键。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @returns {string} 可合并到原生 config.toml 的真实键位表；存在冲突时抛出异常，腾出的默认键显式输出 no_op。
 */
export function exportToml(bindings) {
  /** 完整键位校验得到的结果。
   * @type {import('./types.js').BindingValidation}
   */
  const checked = validateBindings(bindings);
  if (!checked.valid) throw new Error("请先修正快捷键冲突");
  /** 最终导出的原生 TOML 文本行。
   * @type {string[]}
   */
  const lines = [
    `# Helix ${CATALOG_VERSION} · 完整键位配置片段`,
    "# 合并到 config.toml；保留其他 editor/theme 配置。",
    "# 已移走或移除的默认键显式 no_op；no_op 仅用于禁用，不是练习实现。",
    "",
  ];
  /** 当前按键配置所属的编辑模式。
   * @type {string}
   */
  for (const mode of Object.keys(MODES)) {
    /** 用于输出原生配置的命令前缀树。
     * @type {import('./types.js').BindingTree}
     */
    const root = { children: new Map() };
    /** 将序列写入命令树并处理叶节点和前缀覆盖。
     * @type {(sequence: string, command: string | string[], overwrite?: boolean) => void}
     * @param {string} sequence - 需要显示或写入的规范按键序列。
     * @param {string | string[]} command - 从配置中解析出的实际命令。
     * @param {boolean} [overwrite] - 是否允许叶节点与前缀互相覆盖。
     * @returns {void} 完成状态修改，不返回额外值。
     */
    const put = (sequence, command, overwrite = true) => {
      /** 当前遍历到的命令前缀树节点。
       * @type {import('./types.js').BindingTree}
       */
      let node = root;
      /** 当前按键序列中的单个规范按键。
       * @type {string}
       */
      for (const token of parseSequence(sequence)) {
        if (node.command) {
          if (!overwrite) return;
          delete node.command;
        }
        if (!node.children.has(token))
          node.children.set(token, { children: new Map() });
        node = node.children.get(token);
      }
      if (!overwrite && (node.command || node.children.size)) return;
      node.command = command;
      if (overwrite) node.children.clear();
    };
    // 先输出当前绑定，再禁用腾出的默认键，避免禁用新的有效前缀。
    /** 当前比较或处理的动作记录。
     * @type {import('./types.js').BindingAction}
     */
    for (const a of actionsFor(bindings).filter(/** 依据实际条件筛选 actionsFor(bindings) 中的有效记录。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.mode === mode))
      if (checked.values[bindingId(a)])
        put(checked.values[bindingId(a)], a.command);
    /** 当前比较或处理的动作记录。
     * @type {import('./types.js').BindingAction}
     */
    for (const a of ACTIONS.filter(/** 依据实际条件筛选 ACTIONS 中的有效记录。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.mode === mode))
      if (checked.values[bindingId(a)] !== a.key) put(a.key, "no_op", false);
    /** 递归输出原生 Helix 命令树的 TOML 表。
     * @type {(arg0: import('./types.js').BindingTree, arg1: string[]) => void}
     * @param {import('./types.js').BindingTree} node - 当前遍历到的命令前缀树节点。
     * @param {string[]} prefix - 本次按键前尚未完成的配置序列。
     * @returns {void} 完成状态修改，不返回额外值。
     */
    const emit = (node, prefix) => {
      lines.push(
        `[keys.${mode}${prefix.map(/** 将 prefix 中的记录转换为本次操作需要的结果。
         * @param {string} k - k 对应的实际输入记录。
         * @returns {string} 返回该操作的实际计算结果。
         */
        (k) => `.${  JSON.stringify(k)}`).join("")}]`,
      );
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[string, import('./types.js').BindingTree]}
       */
      for (const [key, child] of node.children)
        if (child.command)
          lines.push(
            `${JSON.stringify(key)} = ${JSON.stringify(child.command)}`,
          );
      lines.push("");
      /** 按既定顺序解构当前记录的边界、标识或测试参数。
       * @type {[string, import('./types.js').BindingTree]}
       */
      for (const [key, child] of node.children)
        if (child.children.size) emit(child, [...prefix, key]);
    };
    emit(root, []);
  }
  return lines.join("\n");
}
/** 保留旧自定义键并禁用新增默认键造成的冲突。
 * @param {import('./types.js').Bindings | undefined} old - 需要兼容迁移的旧版键位配置。
 * @returns {import('./types.js').Bindings} 保留旧版自定义值并仅禁用与其冲突的新增默认绑定的完整配置副本。
 */
export function migrateBindings(old) {
  /** 实际解析或执行得到的结果。
   * @type {{ [x: string]: string; }}
   */
  const result = { ...DEFAULT_BINDINGS };
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {[string, string]}
   */
  for (const [id, key] of Object.entries(old || {}))
    if (id in result) result[id] = key;
  // 旧训练专用前缀可能与新枚举出的真实默认键冲突。
  // 保留用户选择并显式移除冲突的默认叶节点，不静默丢弃用户配置。
  /** 需要优先保留的用户自定义旧键位。
   * @type {[string, string][]}
   */
  const customized = Object.entries(old || {}).filter(
    /** 依据实际条件筛选 Object.entries(old || {}) 中的有效记录。
     * @param {[string, string]} options - 本次操作的完整参数。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    ([id, key]) => id in result && key !== DEFAULT_BINDINGS[id],
  );
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {[string, string]}
   */
  for (const [id, key] of customized)
    /** 当前比较或处理的动作记录。
     * @type {import('./types.js').BindingAction}
     */
    for (const a of ACTIONS) {
      /** 可能与用户旧键发生冲突的默认动作标识。
       * @type {string}
       */
      const other = bindingId(a);
      if (
        other === id ||
        a.mode !== id.split(".")[0] ||
        customized.some(/** 检查 customized 是否满足当前操作的完整条件。
         * @param {[string, string]} options - 本次操作的完整参数。
         * @returns {boolean} 返回该操作的实际计算结果。
         */
        ([x]) => x === other)
      )
        continue;
      /** 满足移动或匹配条件的候选记录。
       * @type {string}
       */
      const candidate = result[other];
      if (
        candidate &&
        (candidate === key ||
          candidate.startsWith(`${key  } `) ||
          key.startsWith(`${candidate  } `))
      )
        result[other] = "";
    }
  return result;
}
