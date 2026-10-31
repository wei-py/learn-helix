<script setup>
import { nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { commandInteraction } from '../../domain/advanced.js';
import { ARTICLE } from '../../domain/article.js';
import { bindingId, displayKey, keyFromEvent, MODES, parseSequence } from '../../domain/bindings.js';
import { CATEGORIES, LESSONS } from '../../domain/engine.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import { useLearningStore } from '../../stores/learning.js';
import EditorText from './EditorText.vue';
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
 * 真实练习编辑器的焦点节点。
 * @type {import('vue').Ref<HTMLElement|null>}
 */ const editor = ref(null);
/**
 * 真实命令参数表单。
 * @type {import('vue').Ref<HTMLFormElement|null>}
 */ const operandForm = ref(null);
/**
 * 用户实际输入的命令参数。
 * @type {import('vue').Ref<Record<string,string>>}
 */ const operands = ref({});
/**
 * 将焦点移到编辑器且不改变页面滚动。
 * @returns {Promise<void>} 焦点更新完成。
 */
async function focusEditor() { await nextTick(); editor.value?.focus({ preventScroll: true }); }
watch(/**
 * 路由课程标识。
 * @returns {string|string[]} 路由课程标识。
 */ () => route.params.id, /**
  * 浏览器历史或深链接切换课程时初始化相应真实引擎。
  * @param {string|string[]} id 课程标识。
  * @returns {void}
  */ (id) => { if (id && id !== store.lesson.id) store.startLesson(String(id)); }, { immediate: true });
watch(/**
 * 参数命令。
 * @returns {import('../../stores/types.js').BindingAction|null} 参数命令。
 */ () => store.operandAction, /**
  * 焦点更新完成。
  * @param {import('../../stores/types.js').BindingAction|null} action 当前命令。
  * @returns {Promise<void>} 焦点更新完成。
  */ async (action) => { operands.value = {}; await nextTick(); if (action) operandForm.value?.querySelector('input')?.focus({ preventScroll: true }); });
/**
 * 保留 Tab 导航与中文组合输入。
 * @param {KeyboardEvent} event 原生键盘事件。
 * @returns {void}
 */
function keydown(event) {
  if (store.modal || event.isComposing || event.key === 'Tab') return;
  /**
   * 当前按键或新增绑定快捷键。
   * @type {string|null}
   */ const key = keyFromEvent(event); if (!key) return;
  event.preventDefault(); store.feedKey(key, !event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1 ? event.key : undefined);
}
/**
 * 将粘贴作为真实文本插入。
 * @param {ClipboardEvent} event 粘贴事件。
 * @returns {void}
 */
function paste(event) { if (store.editor.mode === 'insert') { event.preventDefault(); store.typeText(event.clipboardData?.getData('text/plain') || ''); } }
/**
 * 提交中文输入法已确认文字。
 * @param {CompositionEvent} event 组合结束事件。
 * @returns {void}
 */
function composition(event) { if (store.editor.mode === 'insert' && event.data) store.typeText(event.data); }
/**
 * 屏幕按键仍走完整序列解析。
 * @param {import('../../stores/types.js').BindingAction} action 用户选择的绑定。
 * @returns {void}
 */
function pressAction(action) { for (/**
 * 当前屏幕按键的顺序与规范化键值。
 * @type {[number,string]}
 */ const [index, key] of parseSequence(store.bindings[bindingId(action)]).entries()) store.feedKey(key, undefined, index === 0); focusEditor(); }
/**
 * 提交真实参数，错误值也会修改文本。
 * @returns {void}
 */
function submitOperands() {
  /**
   * 提交给真实编辑引擎的参数。
   * @type {Record<string,string|number>}
   */ const args = {};
  for (/**
   * 用户填写的参数名与实际值。
   * @type {[string,string]}
   */ const [key, value] of Object.entries(operands.value)) if (value !== '') args[key] = value;
  args.count = Number(store.operandCount);
  if (!Number.isSafeInteger(args.count) || args.count < 1 || args.count > 10000) { store.feedback = { kind: 'error', text: '计数必须为 1–10000 的整数。' }; return; }
  store.executeAction(store.operandAction, args); focusEditor();
}
/**
 * 提交触屏文本而非快捷键。
 * @returns {void}
 */
function insertMobile() { /**
 * 待提交的触屏输入文字。
 * @type {string}
 */ const value = store.insertBuffer; store.insertBuffer = ''; if (value) store.typeText(value); }
/**
 * 前往筛选分类中的下一课。
 * @returns {void}
 */
function nextLesson() {
  /**
   * 当前分类中的完整课程集合。
   * @type {import('../../domain/types.js').Lesson[]}
   */ const list = LESSONS.filter(/**
    * 所属分类。
    * @param {import('../../domain/types.js').Lesson} item 课程。
    * @returns {boolean} 所属分类。
    */ (item) => !route.query.category || route.query.category === 'all' || item.category === route.query.category);
  /**
   * 下一道真实编辑课程。
   * @type {import('../../domain/types.js').Lesson}
   */ const lesson = list[(list.indexOf(store.lesson) + 1) % list.length]; store.startLesson(lesson.id); router.push({ name: 'practice', params: { id: lesson.id }, query: route.query });
}
/**
 * 返回之前的地图筛选与滚动位置。
 * @returns {void}
 */
function returnMap() { router.push(typeof route.query.return === 'string' ? route.query.return : '/map'); }
/**
 * 打开可选寄存器参数。
 * @param {import('../../stores/types.js').BindingAction} action 命令。
 * @returns {void}
 */
function optionalAction(action) { store.beginAction(action, true); }
/**
 * 判断命令是否另有可选寄存器参数。
 * @param {string} command 命令名称。
 * @returns {boolean} 存在可选参数。
 */
function hasOptional(command) { return Boolean(commandInteraction(command, true) && !commandInteraction(command)); }
/**
 * 读取当前真实课程的分类名称。
 * @returns {string} 当前分类名称。
 */
function categoryLabel() { return CATEGORIES.find(
  /**
   * 匹配当前课程分类。
   * @param {typeof CATEGORIES[number]} category 分类记录。
   * @returns {boolean} 是否对应当前课程。
   */ (category) => category.id === store.lesson.category)?.label || ''; }
/**
 * 格式化光标行列。
 * @returns {string} 编辑器光标位置。
 */
function cursorPosition() { return `${store.editor.text.slice(0, store.editor.head).split('\n').length}:${store.editor.head - store.editor.text.lastIndexOf('\n', store.editor.head - 1)}`; }
</script>
<template>
  <section class="practice-panel" aria-labelledby="lesson-title">
    <BaseButton variant="text" @click="returnMap">← 返回课程地图</BaseButton>
    <div class="lesson-header"><div><div class="eyebrow subtle">练习 {{ String(store.lessonIndex + 1).padStart(2,'0') }} / {{ LESSONS.length }}</div><h2 id="lesson-title">{{ store.lesson.title }}</h2></div><span class="topic-chip">{{ categoryLabel() }}</span></div>
    <p class="lesson-description">{{ store.lesson.description }}</p><p class="source-note">依据 <a :href="store.lesson.source.url" target="_blank" rel="noreferrer">{{ store.lesson.source.section }} ↗</a> · <a :href="ARTICLE.url" target="_blank" rel="noreferrer">原文</a></p>
    <div class="editor-chrome"><div class="editor-tab">practice.txt</div></div>
    <div id="editor" ref="editor" class="editor scroll-section" tabindex="0" role="group" :aria-label="`Helix 练习编辑区，当前${MODES[store.editor.mode]}模式。Tab 移至下一个控件。`" aria-describedby="keyboard-help" @keydown="keydown" @paste="paste" @compositionend="composition"><EditorText :state="store.editor" /></div>
    <div class="editor-status"><span class="mode-badge" :class="store.editor.mode">{{ store.editor.mode.toUpperCase() }}</span><span>practice.txt</span><span class="editor-status-right"><b v-if="store.pending.length" class="pending">{{ displayKey(store.pending.join(' ')) }} …</b><span>{{ cursorPosition() }}</span><span>UTF-8</span><span>TXT</span></span></div>
    <div class="feedback" :class="store.success ? 'success' : store.feedback.kind" role="status" aria-live="polite"><span class="feedback-icon" aria-hidden="true"><span v-if="store.success" class="i-carbon-checkmark" /><span v-else-if="store.feedback.kind === 'error'" class="i-carbon-warning-alt" /><span v-else class="i-carbon-arrow-right" /></span><div><strong>{{ store.success ? '本课完成。' : store.feedback.text }}</strong><small id="keyboard-help">点击编辑区输入 · 也可点按键 · Tab 离开</small></div><BaseButton v-if="!store.success" variant="text" @click="focusEditor">聚焦 ↗</BaseButton></div>
    <form v-if="store.editor.mode === 'insert' && !store.success" class="insert-form" @submit.prevent="insertMobile"><label for="mobile-insert">触屏 / 中文输入</label><div><input id="mobile-insert" v-model="store.insertBuffer" autocomplete="off" placeholder="输入文字后点插入"><BaseButton variant="secondary" type="submit">插入文字</BaseButton></div><small>此输入框只提交文字，不处理快捷键。</small></form>
    <form v-if="store.operandAction" ref="operandForm" class="operand-form" @submit.prevent="submitOperands"><h3>{{ commandInteraction(store.operandAction.command,true).prompt }}</h3><p>这是命令参数，不是快捷键。输入真实值后执行；错误值也会作用于文本。</p><label v-for="field in commandInteraction(store.operandAction.command,true).fields" :key="field.name">{{ field.label }}<input :id="`operand-${field.name}`" v-model="operands[field.name]" :name="field.name" :required="field.required" autocomplete="off" spellcheck="false"></label><label>计数<input v-model="store.operandCount" name="count" type="number" min="1" max="10000" required></label><div><BaseButton variant="primary" type="submit">执行命令</BaseButton><BaseButton type="button" variant="text" @click="store.operandAction = null;store.countInput = '';focusEditor()">取消</BaseButton></div></form>
    <p v-if="store.countInput" class="count-pending">计数前缀：{{ store.countInput }}。接着输入命令；Esc 取消。</p><label v-if="store.editor.advanced && !store.success" class="count-control">下一条命令计数（也可直接键入数字前缀）<input v-model="store.countInput" inputmode="numeric" type="number" min="1" max="10000" placeholder="1"></label>
    <div class="keyboard-area"><div class="section-heading"><h3>按键</h3><span>{{ MODES[store.editor.mode] }}</span></div><div class="key-controls"><template v-for="action in store.practiceActions" :key="bindingId(action)"><button class="key-control" :class="{suggested:store.currentStep?.mode === action.mode && (store.currentStep?.action === action.id || store.currentStep?.action === action.command) && !store.success}" :disabled="store.success" @click="pressAction(action)"><kbd>{{ displayKey(store.bindings[bindingId(action)]) }}</kbd><span>{{ action.label }}</span></button><BaseButton v-if="hasOptional(action.command)" :disabled="store.success" variant="text" @click="optionalAction(action)">{{ action.label }}：寄存器…</BaseButton></template></div></div>
    <div class="lesson-footer"><BaseButton variant="text" @click="store.startLesson(store.lesson.id);focusEditor()"><span class="i-carbon-reset" aria-hidden="true" />重新练习</BaseButton><span>{{ store.stepIndex }} / {{ store.lesson.steps.length }} 步</span><BaseButton :variant="store.success ? 'primary' : 'secondary'" @click="nextLesson">{{ store.lessonIndex === LESSONS.length - 1 ? '回到第一课' : '下一课' }} →</BaseButton></div>
  </section>
</template>
