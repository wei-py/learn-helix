// 中文学习释义；官方英文描述原样保留在 catalog.js。
import meanings from './catalog-zh-data.json' with { type: 'json' };

/** 以静态命令名或冒号开头的可输入命令名索引的中文释义。
 * @type {Record<string, string>}
 */
export const COMMAND_ZH = meanings;
