import { commandInteraction } from "./advanced.js";
import { actionForCommand, ACTIONS, bindingId } from "./bindings.js";

// 仅生成只读提示；这些说明从不自动执行命令或填入参数。
/** 按当前有效键位生成只读、可实际执行的课程答案步骤。
 * @param {import('./types.js').Lesson} lesson - 包含初始文本与独立目标的完整课程。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @returns {import('./types.js').AnswerStep[]} 返回该操作的实际计算结果。
 */
export function lessonAnswer(lesson, bindings) {
  return lesson.steps.map(/** 将 lesson.steps 中的记录转换为本次操作需要的结果。
   * @param {import('./types.js').LessonStep} step - 当前需要实际执行的课程步骤。
   * @returns {{ mode: "insert"; operations: { kind: "text"; value: string; }[]; command?: undefined; } | { mode: import('./types.js').Mode; command: string | string[]; operations: import('./types.js').AnswerOperation[]; }} 返回该操作的实际计算结果。
   */
  (step) => {
    if (step.type === "text")
      return { mode: "insert", operations: [{ kind: "text", value: step.text }] };
    /** 当前配置解析出的真实动作记录。
     * @type {import('./types.js').BindingAction | undefined}
     */
    const action = actionForCommand(bindings, step.mode, step.action);
    /** 只用于显示官方命令名称的默认动作记录。
     * @type {import('./types.js').BindingAction | undefined}
     */
    const fallback = ACTIONS.find(/** 在 ACTIONS 中定位符合当前条件的真实记录。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => a.mode === step.mode &&
      (a.id === step.action || a.command === step.action));
    /** 从配置中解析出的实际命令。
     * @type {string | string[]}
     */
    const command = action?.command || fallback?.command || step.action;
    /** 该命令要求的参数交互约定。
     * @type {import('./types.js').Interaction | null}
     */
    const interaction = commandInteraction(command, true);
    /** 该命令是否仅含可选寄存器参数。
     * @type {boolean | null}
     */
    const optional = interaction && !commandInteraction(command);
    /** 课程是否显式指定可选寄存器参数。
     * @type {boolean | null}
     */
    const explicit = optional && interaction.fields.some(/** 检查 interaction.fields 是否满足当前操作的完整条件。
     * @param {import('./types.js').InteractionField} field - 当前命令参数的真实输入约定。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (field) =>
      step.args?.[field.name] !== undefined);
    /** 按当前键位与真实参数生成的答案操作。
     * @type {import('./types.js').AnswerOperation[]}
     */
    const operations = [];
    if (step.args?.count !== undefined)
      operations.push({ kind: "count", value: step.args.count });
    if (!action) operations.push({ kind: "unbound", command });
    else operations.push(explicit
      ? { kind: "control", value: `${action.label}：寄存器…` }
      : { kind: "key", value: bindings[bindingId(action)] });
    if (interaction && (!optional || explicit)) {
      /** 当前命令参数的真实输入约定。
       * @type {import('./types.js').InteractionField}
       */
      for (const field of interaction.fields)
        operations.push({ kind: "operand", name: field.name, label: field.label,
          value: step.args?.[field.name] ?? field.defaultValue ?? "" });
      operations.push({ kind: "submit", value: "ret" });
    }
    return { mode: step.mode, command, operations };
  });
}
