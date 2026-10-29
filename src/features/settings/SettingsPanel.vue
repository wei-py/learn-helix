<script setup>
import { computed, ref } from 'vue';

import { ACTIONS, actionsFor, addBinding, ALL_COMMANDS, bindingId, DEFAULT_BINDINGS, displayKey, MODES, validateBindings } from '../../domain/bindings.js';
import { COMMAND_ZH } from '../../domain/catalog-zh.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import VirtualList from '../../shared/business/VirtualList.vue';
import { useLearningStore } from '../../stores/learning.js';
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 当前设置的编辑器模式。
 * @type {import('vue').Ref<string>}
 */ const mode = ref('normal');
/**
 * 设置中的搜索关键字。
 * @type {import('vue').Ref<string>}
 */ const query = ref('');
/**
 * 设置中的前缀筛选。
 * @type {import('vue').Ref<string>}
 */ const group = ref('');
/**
 * 待新增的官方命令或原生命令序列。
 * @type {import('vue').Ref<string>}
 */ const command = ref('');
/**
 * 当前按键或新增绑定快捷键。
 * @type {import('vue').Ref<string>}
 */ const key = ref('');
/**
 * 全部三模式键位校验结果。
 * @type {import('vue').ComputedRef<ReturnType<typeof validateBindings>>}
 */ const checked = computed(/**
  * 三模式联合校验。
  * @returns {ReturnType<typeof validateBindings>} 三模式联合校验。
  */ () => validateBindings(store.draft));
/**
 * 当前模式的全部配置行。
 * @type {import('vue').ComputedRef<ReturnType<typeof actionsFor>>}
 */ const all = computed(/**
  * 当前模式全部行。
  * @returns {ReturnType<typeof actionsFor>} 当前模式全部行。
  */ () => actionsFor(store.draft).filter(/**
   * 当前模式。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {boolean} 当前模式。
   */ (action) => action.mode === mode.value));
/**
 * 当前筛选后的课程或命令分组。
 * @type {import('vue').ComputedRef<string[]>}
 */ const groups = computed(/**
  * 模式分组。
  * @returns {string[]} 模式分组。
  */ () => [...new Set(all.value.map(/**
   * 分组名。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {string} 分组名。
   */ (action) => action.group || '其他'))]);
/**
 * 当前筛选或分页后的展示行。
 * @type {import('vue').ComputedRef<ReturnType<typeof actionsFor>>}
 */ const rows = computed(/**
  * 可见筛选行。
  * @returns {ReturnType<typeof actionsFor>} 可见筛选行。
  */ () => all.value.filter(/**
   * 匹配筛选。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {boolean} 匹配筛选。
   */ (action) => (!group.value || action.group === group.value) && `${action.label} ${JSON.stringify(action.command)} ${store.draft[bindingId(action)]} ${action.key} ${action.group}`.toLowerCase().includes(query.value.toLowerCase())).map(/**
   * 带稳定虚拟列表标识的行。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {import('../../domain/types.js').BindingAction} 带稳定虚拟列表标识的行。
   */ (action) => ({ ...action, id: bindingId(action) })));
/**
 * 更新草稿而不重建输入节点。
 * @param {Event} event 输入事件。
 * @param {string} id 绑定标识。
 * @returns {void}
 */
function update(event, id) { if (event.target instanceof HTMLInputElement) { store.draft[id] = event.target.value; store.settingsMessage = ''; } }
/**
 * 恢复默认或删除自定义绑定。
 * @param {string} id 绑定标识。
 * @returns {void}
 */
function reset(id) { if (id in DEFAULT_BINDINGS) store.draft[id] = DEFAULT_BINDINGS[id]; else delete store.draft[id]; store.settingsMessage = ''; }
/**
 * 留空移除原生叶绑定，保留行以便恢复。
 * @param {string} id 绑定标识。
 * @returns {void}
 */
function remove(id) { if (id in DEFAULT_BINDINGS) store.draft[id] = ''; else delete store.draft[id]; store.settingsMessage = '已移除，保存后生效。'; }
/**
 * 用现有解析器添加命令或命令序列。
 * @returns {void}
 */
function add() { try { store.draft = addBinding(store.draft, mode.value, command.value, key.value); store.settingsMessage = '已新增，保存后生效。'; query.value = ''; group.value = ''; command.value = ''; key.value = ''; } catch (error) { store.settingsMessage = error instanceof Error ? error.message : String(error); } }
/**
 * 切换模式后重置分组。
 * @param {string} value 模式名。
 * @returns {void}
 */
function setMode(value) { mode.value = value; group.value = ''; }
/**
 * 重置全部草稿但不影响学习进度。
 * @returns {void}
 */
function defaults() { store.draft = { ...DEFAULT_BINDINGS }; store.settingsMessage = '默认键位已填入，保存后生效。学习进度保留。'; }
/**
 * 将命令数组显示为串联操作。
 * @param {string|string[]} value 原生命令。
 * @returns {string} 命令名称。
 */
function commandName(value) { return Array.isArray(value) ? value.join(' → ') : value; }
</script>
<template>
  <div class="mode-tabs" role="tablist" aria-label="快捷键模式"><button v-for="(label,value) in MODES" :key="value" role="tab" :aria-selected="mode === value" :class="{active:mode === value}" @click="setMode(value)">{{ label }}模式 <code>{{ value }}</code></button></div><div class="catalog-filters"><label>搜索键、命令、前缀<input id="settings-search" v-model="query" placeholder="space w / regex / goto"></label><label>分组<select id="settings-group" v-model="group"><option value="">全部前缀 / 分组</option><option v-for="item in groups" :key="item">{{ item }}</option></select></label></div><details class="syntax-help"><summary>键位写法与范围</summary><p>空格分隔前缀；支持 C-h、A-C、Meta-c、F1–F24。大小写有意义：A-c ≠ A-C。留空移除；Tab 用于网页导航，浏览器保留键可用屏幕输入。</p><p>冲突检测覆盖全部模式。修改的有效别名优先用于提示。移走的默认键导出为 no_op；sticky 属性不能迁移；不含 Picker / prompt 专属键。</p></details><p class="settings-count" role="status">{{ rows.length }} / {{ all.length }}（全部默认 {{ ACTIONS.length }} 项）</p>
  <template v-if="rows.length">
    <VirtualList :items="rows" :item-height="160" :height="448" item-key="id"><template #default="{item}"><div class="binding-row" role="listitem"><label class="scroll-section" tabindex="0" :for="`binding-${item.id}`"><strong>{{ item.label }}</strong><code>{{ commandName(item.command) }}</code></label><div class="binding-field"><input :id="`binding-${item.id}`" :value="store.draft[item.id]" :aria-label="`${MODES[item.mode]}模式：${commandName(item.command)}`" :aria-invalid="checked.errors[item.id] ? 'true' : undefined" spellcheck="false" autocomplete="off" @input="update($event,item.id)"><small class="scroll-section" tabindex="0" :class="{'field-error':checked.errors[item.id]}">{{ checked.errors[item.id] || `默认：${displayKey(item.key)}` }}</small></div><div class="binding-row-actions"><button class="reset-key" :aria-label="`恢复 ${commandName(item.command)}`" @click="reset(item.id)"><span class="i-carbon-reset" aria-hidden="true" /></button><button class="reset-key" :aria-label="`移除 ${commandName(item.command)}`" @click="remove(item.id)"><span class="i-carbon-trash-can" aria-hidden="true" /></button></div></div></template></VirtualList>
  </template>
  <p v-else class="settings-empty scope-note" role="status">未找到匹配的键位。请清空搜索，或切换模式与分组。</p>
  <form class="add-binding" @submit.prevent="add"><h3>新增绑定</h3><label>官方命令 / 原生命令序列<input id="add-command" v-model="command" list="command-options" required placeholder="select_regex / :write file.txt"></label><datalist id="command-options"><option v-for="item in ALL_COMMANDS" :key="item.name" :value="item.name">{{ COMMAND_ZH[item.name] }}</option></datalist><label>新快捷键<input id="add-key" v-model="key" required placeholder="F6 / space z r"></label><BaseButton type="submit" variant="secondary">添加到{{ MODES[mode] }}模式</BaseButton><details><summary>命令写法</summary><p>支持 <code>:open "file name.txt"</code> 与 JSON 命令数组 <code>["move_char_right","delete_selection"]</code>；系统命令在原生 Helix 执行。先解决重复 / 前缀冲突，再保存。</p></details></form><div class="modal-footer"><BaseButton variant="text" @click="defaults">恢复默认</BaseButton><span class="settings-status" :class="{'field-error':!checked.valid}" role="status">{{ Object.keys(checked.errors).length ? `${Object.keys(checked.errors).length} 项冲突` : store.settingsMessage }}</span><BaseButton :disabled="!checked.valid" variant="primary" @click="store.saveBindings()">保存</BaseButton></div>
</template>
