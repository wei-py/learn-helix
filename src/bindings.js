import {
  DEFAULT_KEYMAP,
  COMMANDS,
  TYPABLE_COMMANDS,
  CATALOG_VERSION,
} from "./catalog.js";
import { COMMAND_ZH } from "./catalog-zh.js";
export const MODES = { normal: "普通", select: "选择", insert: "插入" };
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
const seen = new Set();
export const ACTIONS = DEFAULT_KEYMAP.map((row, index) => {
  const commandName =
    typeof row.command === "string" ? row.command : row.command.join(" → ");
  const base =
    row.mode === "select" && commandName === "exit_select_mode"
      ? "normal"
      : row.mode === "select" && commandName === "normal_mode"
        ? "normal_mode"
        : legacy[commandName] || commandName;
  const first = !seen.has(`${row.mode}.${base}`);
  seen.add(`${row.mode}.${base}`);
  return {
    ...row,
    id: first ? base : `${base}~${index}`,
    label:
      COMMAND_ZH[commandName] || labels[base] || row.description || commandName,
  };
});
export const bindingId = (action) => `${action.mode}.${action.id}`;
export const DEFAULT_BINDINGS = Object.fromEntries(
  ACTIONS.map((a) => [bindingId(a), a.key]),
);
export const ALL_COMMANDS = [
  ...COMMANDS,
  ...TYPABLE_COMMANDS.map((c) => ({ ...c, name: `:${c.name}` })),
];
const commandNames = new Set(ALL_COMMANDS.map((c) => c.name));
const typableNames = new Set(
  TYPABLE_COMMANDS.flatMap((command) => [
    command.name,
    ...(command.aliases || []),
  ]),
);
export function parseCommand(value) {
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
  const commands = Array.isArray(command) ? command : [command];
  if (
    !commands.length ||
    commands.some(
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
export function actionsFor(bindings = DEFAULT_BINDINGS) {
  return [
    ...ACTIONS,
    ...Object.keys(bindings)
      .filter((id) => id.includes(".custom:"))
      .map((id) => {
        const [mode, ...rest] = id.split(".");
        let command, invalid;
        try {
          const encoded = rest.join(".").slice(7);
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
export function addBinding(bindings, mode, command, key) {
  if (!MODES[mode]) throw new Error("请选择有效模式");
  command = parseCommand(command);
  let suffix = 1;
  let id;
  const encoded = encodeURIComponent(
    Array.isArray(command) ? JSON.stringify(command) : command,
  );
  do {
    id = `${mode}.custom:${encoded}~${suffix++}`;
  } while (id in bindings);
  return { ...bindings, [id]: key };
}
export function actionForCommand(bindings = DEFAULT_BINDINGS, mode, command) {
  const rows = actionsFor(bindings).filter((action) => action.mode === mode);
  const exact = rows.find((action) => action.id === command);
  if (exact?.id.startsWith("custom:") && bindings[bindingId(exact)])
    return exact;
  const canonical = exact?.command || command;
  const candidates = rows.filter(
    (action) => action.command === canonical && bindings[bindingId(action)],
  );
  return (
    candidates.find((action) => bindings[bindingId(action)] !== action.key) ||
    candidates[0]
  );
}
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
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
]);
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
export function normalizeKey(input) {
  if (input === " ") return "space";
  let key = input
    .trim()
    .replace(
      /(?:control|ctrl)[+]([A-Z])$/gi,
      (_, letter) => `C-${letter.toLowerCase()}`,
    )
    .replace(/control[+-]|ctrl[+-]/gi, "C-")
    .replace(/alt[+-]/gi, "A-")
    .replace(/shift[+-]/gi, "S-")
    .replace(/super[+-]|meta[+-]|cmd[+-]|win[+-]/gi, "Meta-");
  const mods = [];
  while (/^(?:C|A|S|Meta)-/.test(key)) {
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
    ...["C", "A", "S", "Meta"].filter((modifier) => mods.includes(modifier)),
    key,
  ].join("-");
}
export function parseSequence(value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("快捷键不能为空");
  return value.trim().split(/\s+/).map(normalizeKey);
}
export function validateBindings(input) {
  const values = {},
    errors = {};
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { values, errors: { root: "无效键位配置" }, valid: false };
  const actions = actionsFor(input);
  for (const a of actions) {
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
  for (const id of Object.keys(input))
    if (!actions.some((a) => bindingId(a) === id)) errors[id] = "未知键位记录";
  for (const mode of Object.keys(MODES)) {
    const active = actions
      .filter((a) => a.mode === mode && values[bindingId(a)])
      .sort((a, b) => values[bindingId(a)].localeCompare(values[bindingId(b)]));
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = bindingId(active[i]),
          b = bindingId(active[j]),
          x = values[a],
          y = values[b];
        if (x === y || x.startsWith(y + " ") || y.startsWith(x + " "))
          errors[a] = errors[b] = "同模式重复绑定或前缀冲突";
      }
  }
  return { values, errors, valid: !Object.keys(errors).length };
}
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
export function keyFromEvent(event, platform = globalThis.navigator?.platform || "") {
  let rawKey = event.key;
  // macOS Option can report a composed glyph or dead key, not the shortcut key.
  // Keep layout-provided ASCII keys; recover US/ABC positions only when needed.
  if (
    /Mac/.test(platform) &&
    event.altKey &&
    (rawKey === "Dead" || /^[^\x00-\x7f]$/u.test(rawKey))
  ) {
    if (/^Key[A-Z]$/.test(event.code)) {
      const upper = Boolean(event.shiftKey) !== Boolean(event.getModifierState?.("CapsLock"));
      rawKey = upper ? event.code.slice(3) : event.code.slice(3).toLowerCase();
    } else if (/^Digit[0-9]$/.test(event.code)) {
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
  let key = aliases[rawKey.toLowerCase()] || rawKey;
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
export function displayKey(sequence = "") {
  if (!sequence) return "未绑定";
  return sequence
    .split(" ")
    .map(
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
export function resolveKeyInput(bindings, mode, pending, key, fresh = false) {
  const tokens = [...(fresh ? [] : pending), key],
    sequence = tokens.join(" ");
  const actions = actionsFor(bindings).filter(
    (a) => a.mode === mode && bindings[bindingId(a)],
  );
  const action = actions.find((a) => bindings[bindingId(a)] === sequence);
  return {
    tokens,
    sequence,
    action,
    status: action
      ? "action"
      : actions.some((a) => bindings[bindingId(a)].startsWith(sequence + " "))
        ? "prefix"
        : "unbound",
  };
}
export function exportToml(bindings) {
  const checked = validateBindings(bindings);
  if (!checked.valid) throw new Error("请先修正快捷键冲突");
  const lines = [
    `# Helix ${CATALOG_VERSION} · 完整键位配置片段`,
    "# 合并到 config.toml；保留其他 editor/theme 配置。",
    "# 已移走或移除的默认键显式 no_op；no_op 仅用于禁用，不是练习实现。",
    "",
  ];
  for (const mode of Object.keys(MODES)) {
    const root = { children: new Map() };
    const put = (sequence, command, overwrite = true) => {
      let node = root;
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
    // Emit current bindings before disabling vacated defaults: never disable a new prefix.
    for (const a of actionsFor(bindings).filter((a) => a.mode === mode))
      if (checked.values[bindingId(a)])
        put(checked.values[bindingId(a)], a.command);
    for (const a of ACTIONS.filter((a) => a.mode === mode))
      if (checked.values[bindingId(a)] !== a.key) put(a.key, "no_op", false);
    const emit = (node, prefix) => {
      lines.push(
        `[keys.${mode}${prefix.map((k) => "." + JSON.stringify(k)).join("")}]`,
      );
      for (const [key, child] of node.children)
        if (child.command)
          lines.push(
            `${JSON.stringify(key)} = ${JSON.stringify(child.command)}`,
          );
      lines.push("");
      for (const [key, child] of node.children)
        if (child.children.size) emit(child, [...prefix, key]);
    };
    emit(root, []);
  }
  return lines.join("\n");
}
export function migrateBindings(old) {
  const result = { ...DEFAULT_BINDINGS };
  for (const [id, key] of Object.entries(old || {}))
    if (id in result) result[id] = key;
  // Old training-only prefixes may collide with newly enumerated real defaults.
  // Keep user choices, explicitly remove colliding default leaves, never discard silently.
  const customized = Object.entries(old || {}).filter(
    ([id, key]) => id in result && key !== DEFAULT_BINDINGS[id],
  );
  for (const [id, key] of customized)
    for (const a of ACTIONS) {
      const other = bindingId(a);
      if (
        other === id ||
        a.mode !== id.split(".")[0] ||
        customized.some(([x]) => x === other)
      )
        continue;
      const candidate = result[other];
      if (
        candidate &&
        (candidate === key ||
          candidate.startsWith(key + " ") ||
          key.startsWith(candidate + " "))
      )
        result[other] = "";
    }
  return result;
}
