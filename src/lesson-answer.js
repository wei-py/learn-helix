import { ACTIONS, MODES, actionForCommand, bindingId, displayKey } from "./bindings.js";
import { commandInteraction } from "./advanced.js";

const esc = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Presentation only: these instructions never dispatch commands or fill inputs.
export function lessonAnswer(lesson, bindings) {
  return lesson.steps.map((step) => {
    if (step.type === "text")
      return { mode: "insert", operations: [{ kind: "text", value: step.text }] };
    const action = actionForCommand(bindings, step.mode, step.action);
    const fallback = ACTIONS.find((a) => a.mode === step.mode &&
      (a.id === step.action || a.command === step.action));
    const command = action?.command || fallback?.command || step.action;
    const interaction = commandInteraction(command, true);
    const optional = interaction && !commandInteraction(command);
    const explicit = optional && interaction.fields.some((field) =>
      step.args?.[field.name] !== undefined);
    const operations = [];
    if (step.args?.count !== undefined)
      operations.push({ kind: "count", value: step.args.count });
    if (!action) operations.push({ kind: "unbound", command });
    else operations.push(explicit
      ? { kind: "control", value: `${action.label}：寄存器…` }
      : { kind: "key", value: bindings[bindingId(action)] });
    if (interaction && (!optional || explicit)) {
      for (const field of interaction.fields)
        operations.push({ kind: "operand", name: field.name, label: field.label,
          value: step.args?.[field.name] ?? field.defaultValue ?? "" });
      operations.push({ kind: "submit", value: "ret" });
    }
    return { mode: step.mode, command, operations };
  });
}

function operationMarkup(op) {
  switch (op.kind) {
    case "count": return `在「下一条命令计数」填 <code>${esc(op.value)}</code>（未绑定数字时也可先键入计数前缀 <kbd>${esc(op.value)}</kbd>）`;
    case "key": return `按 <kbd>${esc(displayKey(op.value))}</kbd>`;
    case "control": return `点「${esc(op.value)}」`;
    case "operand": return `${esc(op.label)}填 <code class="answer-literal">${esc(op.value)}</code>（参数，不是快捷键）`;
    case "submit": return `按 <kbd>${displayKey(op.value)}</kbd> 提交参数`;
    case "text": return `输入文字 <code class="answer-literal">${esc(op.value)}</code>（${op.value.length} 字符，空格 / 换行也需输入）`;
    case "unbound": return `未绑定：先在「键位」为本模式的 <code>${esc(op.command)}</code> 配置快捷键，再按新键`;
  }
}
const position = (text, offset) => {
  const before = text.slice(0, offset);
  return `${before.split("\n").length}:${offset - text.lastIndexOf("\n", offset - 1)}`;
};
export function lessonAnswerMarkup(lesson, bindings, preview, open = false) {
  const goal = lesson.goal;
  const ranges = goal.selections || [{ anchor: goal.anchor, head: goal.head }];
  return `<details id="lesson-answer" class="goal-preview lesson-answer"${open ? " open" : ""}>
    <summary>查看答案</summary>
    <ol class="answer-steps">${lessonAnswer(lesson, bindings).map((step) =>
      `<li><small>${MODES[step.mode]}模式</small>：${step.operations.map(operationMarkup).join(" → ")}</li>`).join("")}</ol>
    <h4>最终状态 · ${MODES[goal.mode]}模式</h4>
    <div class="mini-editor">${preview}</div>
    <ul class="answer-selections">${ranges.map((range, index) =>
      `<li>选区 ${index + 1}${index === (goal.primaryIndex || 0) ? "（主）" : ""}：锚点 ${position(goal.text, range.anchor)} → 光标 ${position(goal.text, range.head)}${range.head === goal.text.length ? "（文件末尾虚拟位置）" : ""}</li>`).join("")}</ul>
  </details>`;
}
