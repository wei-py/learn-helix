// Helix 25.07.1 官方快照，版权归 Helix 贡献者，采用 MPL-2.0。
// 原始出处保存在 CATALOG_META；许可证见 ../../docs/research/HELIX-LICENSE。
import data from './catalog-data.json' with { type: 'json' };

/** 固定版本的官方出处、收录范围与独立记录的来源数量。
 * @type {import('./types.js').CatalogMeta}
 */
export const CATALOG_META = data.CATALOG_META;
/** 完整官方默认键位叶节点，精确保留原始按键序列。
 * @type {import('./types.js').KeymapRow[]}
 */
export const DEFAULT_KEYMAP = data.DEFAULT_KEYMAP;
/** 固定版本官方键位表中的前缀名称与粘滞标记。
 * @type {import('./types.js').PrefixNode[]}
 */
export const PREFIX_NODES = data.PREFIX_NODES;
/** 全部注册的静态命令及其原始英文描述。
 * @type {import('./types.js').CatalogCommand[]}
 */
export const COMMANDS = data.COMMANDS;
/** 全部注册的可输入命令，包含原生别名和参数约定。
 * @type {import('./types.js').CatalogCommand[]}
 */
export const TYPABLE_COMMANDS = data.TYPABLE_COMMANDS;
/** 所有目录使用者统一采用的精确 Helix 版本。
 * @type {string}
 */
export const CATALOG_VERSION = CATALOG_META.version;
/** 生成目录所依据的官方源码快照。
 * @type {import('./types.js').CatalogSource[]}
 */
export const CATALOG_SOURCES = CATALOG_META.sources;
