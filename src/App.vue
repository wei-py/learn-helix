<script setup>
import { useRoute, useRouter } from 'vue-router';

import { ARTICLE_QUESTIONS } from './domain/article.js';
import { LESSONS } from './domain/engine.js';
import PracticeGuide from './features/practice/PracticeGuide.vue';
import LearningDialogs from './features/settings/LearningDialogs.vue';
import { useRouteScroll } from './router/scroll.js';
import BaseButton from './shared/base/BaseButton.vue';
import { useLearningScroll } from './shared/composables/useLearningScroll.js';
import LearningShell from './shared/layout/LearningShell.vue';
import { useLearningStore } from './stores/learning.js';
/**
 * 当前路由及查询上下文。
 * @type {ReturnType<typeof useRoute>}
 */ const route = useRoute();
/**
 * 应用路由管理器。
 * @type {ReturnType<typeof useRouter>}
 */ const router = useRouter();
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 唯一页面滚动控制器。
 * @type {ReturnType<typeof useLearningScroll>}
 */ const scroll = useLearningScroll();
useRouteScroll({ router, store, scroll });
/**
 * 顶栏导航保留当前练习和文章题。
 * @param {string} name 轨道名称。
 * @returns {void}
 */
function navigate(name) { if (name === 'map') { router.push(route.name === 'practice' && typeof route.query.return === 'string' ? route.query.return : { name: 'map', query: { category: store.category } }); return; } if (name === 'practice') router.push({ name, params: { id: store.lesson.id } }); else if (name === 'recall') router.push({ name, query: { id: store.nextQuestionId() } }); else router.push({ name }); }
/**
 * 汇总文章掌握数。
 * @returns {number} 已完成文章题数。
 */
function articleProgress() { return ARTICLE_QUESTIONS.filter(/**
 * 已掌握。
 * @param {typeof ARTICLE_QUESTIONS[number]} question 文章题。
 * @returns {boolean} 已掌握。
 */ (question) => store.knowledge.includes(question.id)).length; }
</script>
<template>
  <LearningShell brand="Helix 练习报" subtitle="选择优先 · 真实编辑 · 自由学习" :active="String(route.name || 'map')" :progress-label="`课程 ${store.completed.length}/${LESSONS.length} · 文章 ${articleProgress()}/${ARTICLE_QUESTIONS.length}`" @navigate="navigate" @settings="store.openModal('settings')" @export="store.openModal('export')" @help="store.openModal('about')">
    <template v-if="store.notice" #notice><div class="notice" role="status">{{ store.notice }}<BaseButton aria-label="关闭提示" variant="text" icon="close" @click="store.notice = ''"></BaseButton></div></template>
    <RouterView />
    <template v-if="route.name === 'practice'" #guide><PracticeGuide /></template>
  </LearningShell>
  <LearningDialogs />
</template>
