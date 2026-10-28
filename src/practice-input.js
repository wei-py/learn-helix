import { resolveKeyInput } from "./bindings.js";

// Only an incomplete configured sequence may outlive one input dispatch.
export function resolvePracticeInput({
  bindings, mode, advanced, pending, countInput, key, rawText, fresh = false,
}) {
  const prefix = fresh ? [] : pending;
  const result = resolveKeyInput(bindings, mode, prefix, key);
  const next = {
    ...result,
    pending: result.status === "prefix" ? result.tokens : [],
    countInput,
  };
  if (result.status === "action" || result.status === "prefix") return next;
  if (
    advanced && mode !== "insert" && !prefix.length &&
    (/^[1-9]$/.test(key) || (countInput && /^[0-9]$/.test(key)))
  ) return { status: "count", pending: [], countInput: countInput + key };

  if (key === "esc" && (prefix.length || countInput))
    return { ...next, status: "cancel", countInput: "" };
  if (mode === "insert" && !prefix.length && rawText != null)
    return { ...next, status: "text", text: rawText, countInput: "" };
  return { ...next, countInput: "" };
}

// A completed text step stays editable until the next command is executed.
export function updateTextProgress(steps, stepIndex, typed, text, erase = false) {
  const index = steps[stepIndex]?.type === "text"
    ? stepIndex
    : steps[stepIndex - 1]?.type === "text" ? stepIndex - 1 : -1;
  if (index < 0) return { stepIndex, typed, status: "unexpected" };
  const expected = steps[index].text;
  const value = erase ? typed.slice(0, -1) : typed + text;
  const matched = value === expected;
  return {
    stepIndex: index + (matched ? 1 : 0),
    typed: value,
    expected,
    status: matched ? "matched" : expected.startsWith(value) ? "typing" : "mismatch",
  };
}
