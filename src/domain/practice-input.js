import { resolveKeyInput } from "./bindings.js";

// 只有尚未完成的已配置序列可以跨越本次输入分发保留。
/** 解析输入优先级，仅保留未完成的配置前缀。
 * @param {import('./types.js').PracticeInput} options - 本次操作的完整参数。
 * @returns {import('./types.js').PracticeResolution} 返回该操作的实际计算结果。
 */
export function resolvePracticeInput({
  bindings, mode, advanced, pending, countInput, key, rawText, fresh = false,
}) {
  /** 本次按键前尚未完成的配置序列。
   * @type {string[]}
   */
  const prefix = fresh ? [] : pending;
  /** 实际解析或执行得到的结果。
   * @type {import('./types.js').KeyResolution}
   */
  const result = resolveKeyInput(bindings, mode, prefix, key);
  /** 本次操作的后继状态或边界。
   * @type {{ pending: string[]; countInput: string; tokens: string[]; sequence: string; action?: import('./types.js').BindingAction; status: "action" | "prefix" | "unbound"; }}
   */
  const next = {
    ...result,
    pending: result.status === "prefix" ? result.tokens : [],
    countInput,
  };
  if (result.status === "action" || result.status === "prefix") return next;
  if (
    advanced && mode !== "insert" && !prefix.length &&
    (/^[1-9]$/.test(key) || (countInput && /^\d$/.test(key)))
  ) return { status: "count", pending: [], countInput: countInput + key };

  if (key === "esc" && (prefix.length || countInput))
    return { ...next, status: "cancel", countInput: "" };
  if (mode === "insert" && !prefix.length && rawText != null)
    return { ...next, status: "text", text: rawText, countInput: "" };
  return { ...next, countInput: "" };
}

// 已完成的文字步骤仍可继续纠错，直到下一条命令真正执行。
/** 按真实输入和退格更新文字步骤，允许完成后继续纠错。
 * @param {import('./types.js').LessonStep[]} steps - 用户需要真实执行的课程步骤。
 * @param {number} stepIndex - 当前课程执行到的真实步骤索引。
 * @param {string} typed - 当前文字步骤已经实际输入的内容。
 * @param {string} text - 本次实际处理的文字内容。
 * @param {boolean} [erase] - 是否执行真实退格而非追加文字。
 * @returns {import('./types.js').TextProgress} 返回该操作的实际计算结果。
 */
export function updateTextProgress(steps, stepIndex, typed, text, erase = false) {
  /** 当前记录在原集合中的索引。
   * @type {number}
   */
  const index = steps[stepIndex]?.type === "text"
    ? stepIndex
    : steps[stepIndex - 1]?.type === "text" ? stepIndex - 1 : -1;
  if (index < 0) return { stepIndex, typed, status: "unexpected" };
  /** 当前文字步骤要求实际输入的文本。
   * @type {string}
   */
  const expected = steps[index].text;
  /** 本次实际输入、读取或比较的值。
   * @type {string}
   */
  const value = erase ? typed.slice(0, -1) : typed + text;
  /** 实际输入是否完整等于要求的文字。
   * @type {boolean}
   */
  const matched = value === expected;
  return {
    stepIndex: index + (matched ? 1 : 0),
    typed: value,
    expected,
    status: matched ? "matched" : expected.startsWith(value) ? "typing" : "mismatch",
  };
}
