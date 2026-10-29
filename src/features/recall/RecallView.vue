<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ARTICLE_QUESTIONS } from '../../domain/article.js';
import { actionsFor, bindingId, displayKey, keyFromEvent, MODES, parseSequence } from '../../domain/bindings.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import { useLearningStore } from '../../stores/learning.js';
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
 * 按键回忆的可聚焦输入区域。
 * @type {import('vue').Ref<HTMLElement|null>}
 */ const keyboard = ref(null);
/**
 * 触屏键序列输入值。
 * @type {import('vue').Ref<string>}
 */ const sequence = ref('');
/**
 * 当前命令所有有效配置别名。
 * @type {import('vue').ComputedRef<string[]>}
 */ const mapped = computed(/**
  * 当前有效绑定。
  * @returns {string[]} 当前有效绑定。
  */ () => actionsFor(store.bindings).filter(/**
   * 当前题目命令。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {boolean} 当前题目命令。
   */ (action) => (Array.isArray(action.command) ? action.command.join(' → ') : action.command) === store.question?.command && Boolean(store.bindings[bindingId(action)])).map(/**
   * 模式与按键。
   * @param {import('../../domain/types.js').BindingAction} action 绑定。
   * @returns {string} 模式与按键。
   */ (action) => `${action.mode}: ${displayKey(store.bindings[bindingId(action)])}`));
watch(/**
 * 使用完整路由识别新一轮作答，而不是把同题的所有历史项合并。
 * @returns {string} 当前页面完整路径。
 */ () => route.fullPath, /**
  * 新进入重置作答；只有浏览器历史遍历才恢复那一项的草稿。
  * @returns {Promise<void>} 题目与焦点初始化完成。
  */ async () => {
  /**
   * 路由提供的未校验题目标识；重复参数不冒充单个有效标识。
   * @type {import('vue-router').LocationQueryValue|import('vue-router').LocationQueryValue[]|undefined}
   */
  const id = route.query.id;
  store.chooseQuestion(typeof id === 'string' ? id : store.nextQuestionId()); sequence.value = '';
  /**
   * 只读取本次遍历明确指定的历史项，不复用新一轮同题答案。
   * @type {import('../../stores/types.js').RecallContext|undefined}
   */
  const context = store.recallContexts[store.recallRestoreKey];
  if (context) { store.recallAnswer = context.answer; store.recallRevealed = context.revealed; }
  await nextTick(); keyboard.value?.focus({ preventScroll: true }); }, { immediate: true });
/**
 * 校验键盘完整序列并保留 Esc 取消前缀。
 * @param {KeyboardEvent} event 原生事件。
 * @returns {void}
 */
function keydown(event) {
  if (store.modal || event.isComposing || event.key === 'Tab' || !store.question?.key) return;
  /**
   * 当前按键或新增绑定快捷键。
   * @type {string|null}
   */ const key = keyFromEvent(event); if (!key) return; event.preventDefault();
  if (key === 'esc' && [...store.pending,key].join(' ') !== store.question.key) { store.pending = []; return; }
  store.pending.push(key);
  /**
   * 待提交的触屏输入文字。
   * @type {string}
   */ const value = store.pending.join(' ');
  if (value === store.question.key) store.answerQuestion(true);
  else if (!store.question.key.startsWith(`${value} `)) store.answerQuestion(false);
}
/**
 * 触屏序列和键盘使用相同解析器。
 * @returns {void}
 */
function submitSequence() { try { store.answerQuestion(parseSequence(sequence.value).join(' ') === store.question?.key); } catch { store.answerQuestion(false); } }
/**
 * 下一题始终来自文章题库。
 * @returns {void}
 */
function nextQuestion() { router.push({ name: 'recall', query: { ...route.query, id: store.nextQuestionId() } }); }
/**
 * 恢复目录筛选与分页。
 * @returns {void}
 */
function returnLibrary() { router.push(typeof route.query.return === 'string' ? route.query.return : '/library'); }
/**
 * 生成文章题序号。
 * @returns {number} 文章题序号。
 */
function articleNumber() { return ARTICLE_QUESTIONS.findIndex(/**
 * 当前题目。
 * @param {typeof ARTICLE_QUESTIONS[number]} item 文章题。
 * @returns {boolean} 当前题目。
 */ (item) => item.id === store.question?.id) + 1; }
</script>
<template>
  <section v-if="store.question" class="catalog-panel recall-panel"><h2>{{ store.question.type === 'concept' ? '文章理解' : store.question.type === 'command' ? '选择命令' : '输入快捷键' }}</h2><p v-if="store.question.source" class="source-note">文章题 {{ articleNumber() }} / {{ ARTICLE_QUESTIONS.length }} · <a :href="store.question.source.url" target="_blank" rel="noreferrer">{{ store.question.source.section }} ↗</a></p><p v-else class="source-note">目录自测 · 下一题返回文章题库</p><p class="recall-scenario">{{ store.question.description }}</p><small v-if="store.question.officialDescription" lang="en">{{ store.question.officialDescription }}</small><p v-if="store.question.mode">{{ MODES[store.question.mode] }} · <code>{{ store.question.command }}</code></p><div v-if="store.question.type !== 'binding'" class="recall-options"><BaseButton v-for="choice in store.question.options" :key="choice.name" variant="secondary" @click="store.answerQuestion(choice.name === (store.question.answer ?? store.question.command))"><code>{{ choice.name }}</code></BaseButton></div><template v-else><div id="recall-keyboard" ref="keyboard" tabindex="0" class="recall-keyboard" role="group" aria-label="按键回忆输入区域" @keydown="keydown">{{ store.question.key ? '点击这里，输入当前配置的完整快捷键。Tab 可离开。' : '此绑定已移除；无需输入不存在的键。' }}<strong>{{ store.pending.length ? displayKey(store.pending.join(' ')) : '等待输入…' }}</strong></div><form v-if="store.question.key" class="insert-form" @submit.prevent="submitSequence"><label for="recall-sequence">触屏 / 浏览器保留键：填写 Helix 键序列</label><div><input id="recall-sequence" v-model="sequence" required autocomplete="off" spellcheck="false" placeholder="例如 C-w h / tab"><BaseButton variant="secondary" type="submit">检查键序列</BaseButton></div></form><p v-else class="scope-note">已禁用的叶绑定不要求回忆不存在的快捷键。可恢复 / 新增配置后再练；这里不会给禁用项伪造完成标记。</p></template><p v-if="store.recallAnswer" class="feedback" :class="store.recallAnswer === 'correct' ? 'success' : 'error'" role="status">{{ store.recallAnswer === 'correct' ? '正确，已记录。' : '不匹配，请重试。' }}</p><div class="lesson-footer"><BaseButton variant="text" @click="store.recallRevealed = !store.recallRevealed">{{ store.recallRevealed ? '收起答案' : '查看答案' }}</BaseButton><BaseButton variant="primary" @click="nextQuestion">下一题 →</BaseButton><BaseButton variant="text" @click="returnLibrary">返回目录</BaseButton></div><div v-if="store.recallRevealed" class="scope-note"><strong v-if="store.question.type === 'concept'">{{ store.question.answer }}</strong><code v-else>{{ store.question.command }}</code><p v-if="store.question.explanation">{{ store.question.explanation }}</p><template v-if="store.question.type !== 'concept'"><p v-if="mapped.length"><span v-for="binding in mapped" :key="binding" class="binding-answer">{{ binding }}</span></p><p v-else>没有默认或已配置绑定。命令行命令可用 : 输入，静态命令可在自定义键位添加。</p><BaseButton variant="secondary" @click="store.openModal('settings')">编辑键位</BaseButton></template></div></section><section v-else class="catalog-panel"><h2>选择一个知识题</h2><BaseButton variant="secondary" @click="returnLibrary">打开完整目录</BaseButton></section>
</template>
