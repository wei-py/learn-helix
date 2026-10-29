import { ARTICLE_QUESTIONS } from "./article.js";
import { actionsFor, ALL_COMMANDS, bindingId } from "./bindings.js";
import { COMMAND_ZH } from "./catalog-zh.js";

/** 将命令序列转换为可读命令名称。
 * @type {(arg0: string | string[]) => string}
 * @param {string | string[]} command - 从配置中解析出的实际命令。
 * @returns {string} 返回该操作的实际计算结果。
 */
export const commandName = (command) =>
  Array.isArray(command) ? command.join(" → ") : command;

/** 从文章、官方命令或当前键位构造真实知识题。
 * @param {string} id - 不会覆盖现有配置的稳定记录标识。
 * @param {import('./types.js').Bindings} bindings - 当前有效的完整键位配置。
 * @returns {import('./types.js').RecallQuestion | null} 返回该操作的实际计算结果。
 */
export function recallQuestion(id, bindings) {
  if (id.startsWith("article:")) {
    /** 当前需要返回或比较的知识题。
     * @type {import('./types.js').RecallQuestion | undefined}
     */
    const question = ARTICLE_QUESTIONS.find(/** 在 ARTICLE_QUESTIONS 中定位符合当前条件的真实记录。
     * @param {import('./types.js').RecallQuestion} question - 当前需要返回或比较的知识题。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (question) => question.id === id);
    return question ? {
      ...question,
      officialDescription: ALL_COMMANDS.find(/** 在 ALL_COMMANDS 中定位符合当前条件的真实记录。
       * @param {import('./types.js').CatalogCommand} command - 从配置中解析出的实际命令。
       * @returns {boolean} 返回该操作的实际计算结果。
       */
      (command) => command.name === question.command)?.description || "",
    } : null;
  }
  if (id.startsWith("binding:")) {
    /** 当前比较或处理的动作记录。
     * @type {import('./types.js').BindingAction | undefined}
     */
    const a = actionsFor(bindings).find(/** 在 actionsFor(bindings) 中定位符合当前条件的真实记录。
     * @param {import('./types.js').BindingAction} a - 当前比较或处理的动作记录。
     * @returns {boolean} 返回该操作的实际计算结果。
     */
    (a) => bindingId(a) === id.slice(8));
    return a
      ? {
          id,
          type: "binding",
          action: a,
          description: COMMAND_ZH[commandName(a.command)] || a.label,
          officialDescription: a.description,
          command: commandName(a.command),
          mode: a.mode,
          key: bindings[bindingId(a)],
        }
      : null;
  }
  /** 从配置中解析出的实际命令。
   * @type {import('./types.js').CatalogCommand | undefined}
   */
  const command = ALL_COMMANDS.find(/** 在 ALL_COMMANDS 中定位符合当前条件的真实记录。
   * @param {import('./types.js').CatalogCommand} c - 当前遍历的官方命令记录。
   * @returns {boolean} 返回该操作的实际计算结果。
   */
  (c) => c.name === id.slice(8));
  if (!command) return null;
  /** 当前记录在原集合中的索引。
   * @type {number}
   */
  const index = ALL_COMMANDS.indexOf(command);
    /** 当前题目包含正确答案的确定性选项。
     * @type {import('./types.js').CatalogCommand[]}
     */
    const picks = [
      command,
      ...[1, 17, 53].map(
        /** 将 [1, 17, 53] 中的记录转换为本次操作需要的结果。
         * @param {number} n - 已执行的命令重复次数。
         * @returns {import('./types.js').CatalogCommand} 返回该操作的实际计算结果。
         */
        (n) => ALL_COMMANDS[(index + n) % ALL_COMMANDS.length],
      ),
    ];
  picks.sort(/** 比较 picks 中的记录以保持确定性顺序。
   * @param {import('./types.js').CatalogCommand} a - 当前比较或处理的动作记录。
   * @param {import('./types.js').CatalogCommand} b - 用于成对比较的另一个动作记录。
   * @returns {number} 返回该操作的实际计算结果。
   */
  (a, b) => a.name.localeCompare(b.name));
  return {
    id,
    type: "command",
    description: COMMAND_ZH[command.name] || command.description,
    officialDescription: command.description,
    command: command.name,
    options: picks,
  };
}
