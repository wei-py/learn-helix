<script setup>
import { computed } from 'vue';

import { commandInteraction } from '../../domain/advanced.js';
import { displayKey, MODES } from '../../domain/bindings.js';
import { lessonAnswer } from '../../domain/lesson-answer.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import StudyGuide from '../../shared/business/StudyGuide.vue';
import { useLearningStore } from '../../stores/learning.js';
import EditorText from './EditorText.vue';
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 只读答案操作说明。
 * @type {import('vue').ComputedRef<ReturnType<typeof lessonAnswer>>}
 */ const answers = computed(/**
  * 只读答案步骤。
  * @returns {ReturnType<typeof lessonAnswer>} 只读答案步骤。
  */ () => lessonAnswer(store.lesson, store.bindings));
/**
 * 显示步骤名称，不代替用户执行。
 * @param {import('../../domain/types.js').LessonStep} step 课程步骤。
 * @returns {string} 操作说明。
 */
function label(step) { return step.type === 'text' ? `输入 ${JSON.stringify(step.text)}` : store.getAction(step.mode, step.action).label; }
/**
 * 根据可选寄存器和绑定生成当前提示。
 * @returns {string} 步骤提示。
 */
function instruction() {
  if (store.success) return '你已完成所有步骤与目标状态。';
  /**
   * 当前待完成的课程步骤。
   * @type {typeof store.currentStep}
   */ const step = store.currentStep;
  if (!step) return '步骤已完成。请对照目标状态，或重新练习修正多余操作。';
  if (step.type === 'text') return `输入 ${JSON.stringify(step.text)}。`;
  /**
   * 当前解析出的键位操作。
   * @type {import('../../stores/types.js').BindingAction}
   */ const action = store.getAction(step.mode, step.action);
  /**
   * 当前命令参数交互说明。
   * @type {ReturnType<typeof commandInteraction>}
   */ const interaction = commandInteraction(action.command, true);
  /**
   * 当前步骤是否显式要求可选寄存器。
   * @type {boolean}
   */ const explicit = Boolean(interaction && !commandInteraction(action.command) && interaction.fields.some(/**
    * 步骤显式指定。
    * @param {{name:string}} field 参数字段。
    * @returns {boolean} 步骤显式指定。
    */ (field) => step.args?.[field.name] !== undefined));
  return `${explicit ? `点「${action.label}：寄存器…」` : `按 ${displayKey(store.keyOf(step.mode,step.action))}`}，${label(step)}${step.args ? `；参数：${JSON.stringify(step.args)}（需要自己输入${explicit || commandInteraction(action.command) ? '，按 Enter 执行' : ''}）` : ''}。`;
}
/**
 * 格式化包含末尾虚拟位置的行列。
 * @param {string} text 目标文本。
 * @param {number} offset 字符偏移。
 * @returns {string} 行列位置。
 */
function position(text, offset) { return `${text.slice(0, offset).split('\n').length}:${offset - text.lastIndexOf('\n', offset - 1)}`; }
/**
 * 同步原生详情展开状态。
 * @param {Event} event 切换事件。
 * @returns {void}
 */
function toggleAnswer(event) { store.answerVisible = event.target instanceof HTMLDetailsElement && event.target.open; }
</script>
<template>
  <StudyGuide title="练习指导">
    <section class="guide-card"><div class="section-heading"><h3>步骤</h3><BaseButton :aria-expanded="store.hintVisible" variant="text" @click="store.hintVisible = !store.hintVisible">{{ store.hintVisible ? '收起' : '展开' }}</BaseButton></div><p class="guide-lead">{{ instruction() }}</p><ol v-if="store.hintVisible" class="steps"><li v-for="(step,index) in store.lesson.steps" :key="index" :class="{finished:index < store.stepIndex,current:index === store.stepIndex}"><span class="step-marker"><span v-if="index < store.stepIndex" class="i-carbon-checkmark" aria-hidden="true" /><span v-else>{{ index + 1 }}</span></span><div><span>{{ label(step) }}</span><small>{{ step.type === 'text' ? '插入模式' : `${MODES[step.mode]}模式` }}</small></div><code v-if="step.type === 'text'" class="literal">{{ step.text.replace(/ /g,'␣') }}</code><kbd v-else>{{ displayKey(store.keyOf(step.mode,step.action)) }}</kbd></li></ol><p v-else class="hint-hidden">提示已收起。试着凭记忆完成，随时可以展开。</p></section>
    <details class="concept-card"><summary>{{ store.lesson.concept }}</summary><p>{{ store.lesson.tip }}</p></details>
    <details id="lesson-answer" class="goal-preview lesson-answer" :open="store.answerVisible" @toggle="toggleAnswer"><summary>查看答案</summary><ol class="answer-steps"><li v-for="(step,index) in answers" :key="index"><small>{{ MODES[step.mode] }}模式</small>：<template v-for="(operation,operationIndex) in step.operations" :key="operationIndex"><span v-if="operationIndex"> → </span><template v-if="operation.kind === 'count'">在「下一条命令计数」填 <code>{{ operation.value }}</code>（未绑定数字时也可键入计数前缀）</template><template v-else-if="operation.kind === 'key'">按 <kbd>{{ displayKey(operation.value) }}</kbd></template><template v-else-if="operation.kind === 'control'">点「{{ operation.value }}」</template><template v-else-if="operation.kind === 'operand'">{{ operation.label }}填 <code class="answer-literal">{{ operation.value }}</code>（参数，不是快捷键）</template><template v-else-if="operation.kind === 'submit'">按 <kbd>{{ displayKey(operation.value) }}</kbd> 提交参数</template><template v-else-if="operation.kind === 'text'">输入文字 <code class="answer-literal">{{ operation.value }}</code>（{{ operation.value.length }} 字符，空格 / 换行也需输入）</template><template v-else>未绑定：先在「键位」为本模式的 <code>{{ operation.command }}</code> 配置快捷键，再按新键</template></template></li></ol><h4>最终状态 · {{ MODES[store.goal.mode] }}模式</h4><div class="mini-editor scroll-section" tabindex="0" aria-label="目标文本与选区预览"><EditorText :state="store.goal" preview /></div><ul class="answer-selections"><li v-for="(range,index) in (store.goal.selections || [{anchor:store.goal.anchor,head:store.goal.head}])" :key="index">选区 {{ index + 1 }}{{ index === (store.goal.primaryIndex || 0) ? '（主）' : '' }}：锚点 {{ position(store.goal.text,range.anchor) }} → 光标 {{ position(store.goal.text,range.head) }}{{ range.head === store.goal.text.length ? '（文件末尾虚拟位置）' : '' }}</li></ul></details>
  </StudyGuide>
</template>
