<script setup>
import BaseButton from '../base/BaseButton.vue';
import { provideLearningScroll } from '../composables/useLearningScroll.js';

import 'virtual:uno.css';
import '../styles/tokens.css';

/**
 * 学习页面的品牌、路由和进度展示数据。
 * @type {Readonly<{brand: string, active: string, progressLabel: string}>}
 */
const props = defineProps({ brand: { type: String, required: true }, active: { type: String, default: 'map' }, progressLabel: { type: String, default: '' } });
/**
 * 仅转发导航与工具意图，具体业务由应用处理。
 * @type {(event: 'navigate' | 'settings' | 'help' | 'export', route?: string) => void}
 */
const emit = defineEmits(['navigate', 'settings', 'help', 'export']);
/**
 * 布局与子页面共用唯一滚动控制器。
 * @type {import('../types.js').LearningScroll}
 */
const scroll = provideLearningScroll();
/**
 * 模板绑定的唯一页面滚动节点。
 * @type {import('vue').ShallowRef<HTMLElement | null>}
 */
const root = scroll.root;
/**
 * 滚动采样位置用于按需显示返回顶部按钮。
 * @type {import('vue').Ref<number>}
 */
const position = scroll.position;
/**
 * 顶栏始终可访问的四个主要页面，不生成抽屉侧栏。
 * @type {{id: string, title: string}[]}
 */
const routes = [
  { id: 'map', title: '课程' },
  { id: 'practice', title: '练习' },
  { id: 'library', title: '速查' },
  { id: 'recall', title: '回忆' },
];

/**
 * 将键盘用户直接带到本页主要内容。
 * @returns {void}
 */
function skipToMain() { scroll.scrollToAnchor(document.getElementById('main-content'), { focus: true }); }

/**
 * 从顶栏切换页面，由应用路由管理器决定目标课程。
 * @param {string} route 页面名称。
 * @returns {void}
 */
function navigate(route) { emit('navigate', route); }

/**
 * 返回唯一内容根节点顶部并保留键盘滚动焦点。
 * @returns {void}
 */
function backToTop() {
  scroll.top(true);
  root.value?.focus({ preventScroll: true });
}
</script>

<template>
  <a href="#main-content" class="skip-link" @click.prevent="skipToMain">跳到主要内容</a>
  <div id="scroll-root" ref="root" class="learning-shell" tabindex="0" role="region" aria-label="学习页面">
    <header class="learning-topbar">
      <div class="learning-topbar__inner">
        <button type="button" class="learning-brand" @click="navigate('map')"><span class="learning-brand__mark" aria-hidden="true">&gt;_</span>{{ brand }}</button>
        <nav class="learning-nav" aria-label="主要导航">
          <BaseButton v-for="route in routes" :key="route.id" variant="text" :aria-current="props.active === route.id ? 'page' : undefined" @click="navigate(route.id)">{{ route.title }}</BaseButton>
        </nav>
        <div class="learning-tools" aria-label="学习工具">
          <BaseButton variant="text" @click="emit('help')">帮助</BaseButton>
          <BaseButton variant="text" @click="emit('settings')">设置</BaseButton>
          <BaseButton variant="text" @click="emit('export')">导出 ↗</BaseButton>
        </div>
      </div>
    </header>
    <div v-if="progressLabel" class="learning-meta"><span class="learning-progress" aria-live="polite">{{ progressLabel }}</span></div>
    <div v-if="$slots.notice" class="learning-notice" role="status"><slot name="notice" /></div>
    <div class="learning-columns" :class="{ 'learning-columns--guide': Boolean($slots.guide) }">
      <main id="main-content" class="learning-main" tabindex="-1"><slot /></main>
      <aside v-if="$slots.guide" class="learning-guide" aria-label="学习提示"><slot name="guide" /></aside>
    </div>
    <BaseButton v-show="position > 320" class="learning-backtop" icon="up" aria-label="返回顶部" @click="backToTop">顶部</BaseButton>
  </div>
</template>
