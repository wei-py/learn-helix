<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ARTICLE } from '../../domain/article.js';
import { ACTIONS, actionsFor, ALL_COMMANDS, bindingId, displayKey, MODES } from '../../domain/bindings.js';
import { COMMAND_ZH } from '../../domain/catalog-zh.js';
import { CATALOG_META, CATALOG_VERSION } from '../../domain/catalog.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import { useLearningScroll } from '../../shared/composables/useLearningScroll.js';
import { useLearningStore } from '../../stores/learning.js';
/**
 * 表示可搜索和分页的完整目录项。
 * @typedef {{key:string,name:string,search:string,mode?:string,group?:string,label?:string,description:string,aliases?:string[],kind?:string,defaultKey?:string}} CatalogRow
 */
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 当前路由及查询上下文。
 * @type {ReturnType<typeof useRoute>}
 */ const route = useRoute();
/**
 * 应用路由管理器。
 * @type {ReturnType<typeof useRouter>}
 */ const router = useRouter();
/**
 * 唯一页面滚动控制器。
 * @type {ReturnType<typeof useLearningScroll>}
 */ const scroll = useLearningScroll();
/**
 * 目录分页的滚动对齐节点。
 * @type {import('vue').Ref<HTMLElement|null>}
 */ const panel = ref(null);
/**
 * 当前目录显示类型。
 * @type {import('vue').ComputedRef<string>}
 */ const kind = computed(/**
  * 当前目录类型。
  * @returns {string} 当前目录类型。
  */ () => route.query.kind === 'commands' ? 'commands' : 'bindings');
/**
 * 当前筛选后的课程或命令分组。
 * @type {string[]}
 */ const groups = [...new Set(ACTIONS.map(/**
  * 前缀分组。
  * @param {typeof ACTIONS[number]} action 绑定。
  * @returns {string} 前缀分组。
  */ (action) => action.group))];
/**
 * 匹配搜索和模式筛选的完整目录行。
 * @type {import('vue').ComputedRef<CatalogRow[]>}
 */ const filtered = computed(/**
  * 搜索后的目录。
  * @returns {CatalogRow[]} 搜索后的目录。
  */ () => {
  /**
   * 当前目录的完整原始行。
   * @type {CatalogRow[]}
   */ const source = kind.value === 'commands' ? ALL_COMMANDS.map(/**
    * 命令目录项。
    * @param {typeof ALL_COMMANDS[number]} command 官方命令。
    * @returns {CatalogRow} 命令目录项。
    */ (command) => ({ ...command, key: command.name, search: `${COMMAND_ZH[command.name]} ${command.name} ${command.description} ${(command.aliases || []).join(' ')}` })) : actionsFor(store.bindings).map(/**
     * 绑定目录项。
     * @param {import('../../domain/types.js').BindingAction} action 配置绑定。
     * @returns {CatalogRow} 绑定目录项。
     */ (action) => ({ ...action, name: Array.isArray(action.command) ? action.command.join(' → ') : action.command, key: bindingId(action), defaultKey: action.key, search: `${action.label} ${JSON.stringify(action.command)} ${action.description} ${store.bindings[bindingId(action)]} ${action.key} ${action.group}` }));
  return source.filter(/**
   * 匹配全部筛选。
   * @param {CatalogRow} row 目录项。
   * @returns {boolean} 匹配全部筛选。
   */ (row) => (!route.query.mode || row.mode === route.query.mode) && (!route.query.group || row.group === route.query.group) && row.search.toLowerCase().includes(String(route.query.q || '').toLowerCase()));
});
/**
 * 目录结果总页数。
 * @type {import('vue').ComputedRef<number>}
 */ const pages = computed(/**
  * 总页数。
  * @returns {number} 总页数。
  */ () => Math.max(1, Math.ceil(filtered.value.length / 24)));
/**
 * 有效的当前页码。
 * @type {import('vue').ComputedRef<number>}
 */ const page = computed(/**
  * 有效页码。
  * @returns {number} 有效页码。
  */ () => Math.max(0, Math.min(Number(route.query.page) || 0, pages.value - 1)));
/**
 * 当前筛选或分页后的展示行。
 * @type {import('vue').ComputedRef<CatalogRow[]>}
 */ const rows = computed(/**
  * 当前页面。
  * @returns {CatalogRow[]} 当前页面。
  */ () => filtered.value.slice(page.value * 24, (page.value + 1) * 24));
/**
 * 更新 URL 中的过滤上下文，不重置页面焦点。
 * @param {string} key 查询键。
 * @param {string|number} value 查询值。
 * @returns {void}
 */
function filter(key, value) { router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined } }); }
/**
 * 读取原生输入值。
 * @param {Event} event 输入事件。
 * @param {string} key 筛选键。
 * @returns {void}
 */
function input(event, key) { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) filter(key, event.target.value); }
/**
 * 切换目录时清空类型专属筛选。
 * @param {string} value 目录类型。
 * @returns {void}
 */
function setKind(value) { router.replace({ query: { ...route.query, kind: value, mode: undefined, group: undefined, page: undefined } }); }
/**
 * 切页后以共享滚动控制器对齐目录标题。
 * @param {number} value 页码。
 * @returns {Promise<void>} 路由更新完成。
 */
async function paginate(value) { await router.replace({ query: { ...route.query, page: value } }); scroll.scrollToAnchor(panel.value, { smooth: false }); }
/**
 * 打开目录自测并记录返回 URL。
 * @param {CatalogRow} row 目录项。
 * @returns {void}
 */
function recall(row) { router.push({ name: 'recall', query: { id: `${kind.value === 'commands' ? 'command' : 'binding'}:${row.key}`, return: route.fullPath } }); }
watch(/**
 * 目录筛选上下文。
 * @returns {string} 目录筛选上下文。
 */ () => route.fullPath, /**
  * 清除未完成输入前缀。
  * @returns {void} 清除未完成输入前缀。
  */ () => { store.pending = []; });
</script>
<template>
  <section ref="panel" class="catalog-panel"><div class="section-heading"><h2>键位与命令</h2><a href="https://docs.helix-editor.com/keymap.html" target="_blank" rel="noreferrer">官方文档 ↗</a></div><div class="mode-tabs"><button :class="{active:kind === 'bindings'}" @click="setKind('bindings')">键位 {{ ACTIONS.length }}</button><button :class="{active:kind === 'commands'}" @click="setKind('commands')">命令 {{ ALL_COMMANDS.length }}</button><button @click="router.push({name:'recall'})">文章回忆 →</button></div><div class="catalog-filters"><label>搜索<input id="catalog-search" :value="route.query.q || ''" placeholder="搜索命令、描述、键、前缀…" @input="input($event,'q')"></label><template v-if="kind === 'bindings'"><label>模式<select id="catalog-mode" :value="route.query.mode || ''" @change="input($event,'mode')"><option value="">全部模式</option><option v-for="(label,mode) in MODES" :key="mode" :value="mode">{{ label }}</option></select></label><label>前缀 / 分组<select id="catalog-group" :value="route.query.group || ''" @change="input($event,'group')"><option value="">全部</option><option v-for="group in groups" :key="group">{{ group }}</option></select></label></template></div><p class="catalog-result" role="status">找到 {{ filtered.length }} 项 · 第 {{ page + 1 }} / {{ pages }} 页</p><p v-if="!rows.length" class="catalog-empty scope-note" role="status">未找到匹配的条目。请清空搜索，或调整模式与分组。</p><div v-else class="catalog-list"><article v-for="row in rows" :key="row.key" class="catalog-row"><div><div class="catalog-meta">{{ row.mode ? `${row.mode} · ${row.group}` : row.kind === 'typable' ? '命令行 · : 前缀' : '静态命令' }}{{ store.knowledge.includes(`${kind === 'commands' ? 'command' : 'binding'}:${row.key}`) ? ' · 已掌握' : '' }}</div><h3><code>{{ row.name }}</code></h3><p>{{ COMMAND_ZH[row.name] || row.label }}</p><small lang="en">{{ row.description }}</small><small v-if="row.aliases?.length">别名：{{ row.aliases.join(', ') }}</small><p v-if="row.mode"><kbd>{{ displayKey(store.bindings[row.key]) }}</kbd><small>官方默认：{{ displayKey(row.defaultKey) }}</small></p></div><BaseButton variant="secondary" @click="recall(row)">{{ kind === 'commands' ? '场景知识题' : '按键回忆' }} →</BaseButton></article></div><div v-if="rows.length" class="lesson-footer"><BaseButton :disabled="page === 0" variant="secondary" @click="paginate(page - 1)">上一页</BaseButton><span>{{ page + 1 }} / {{ pages }}</span><BaseButton :disabled="page === pages - 1" variant="secondary" @click="paginate(page + 1)">下一页</BaseButton></div><details class="source-note"><summary>版本、覆盖口径与来源</summary><p>目录精确固定 {{ CATALOG_VERSION }}；「文章回忆 / 下一题」只从<a :href="ARTICLE.url" target="_blank" rel="noreferrer">指定文章</a>改编的题库出题，不从完整目录抽题。绑定按 mode + 完整序列的每个叶节点计数；同命令多个别名不是多个命令。不将查阅或按键回忆计为编辑能力。</p><pre class="scroll-section" tabindex="0">{{ JSON.stringify(CATALOG_META.counts,null,2) }}</pre></details></section>
</template>
