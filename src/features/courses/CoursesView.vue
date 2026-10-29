<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { CATEGORIES, LESSONS } from '../../domain/engine.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import BaseDialog from '../../shared/base/BaseDialog.vue';
import CourseMap from '../../shared/business/CourseMap.vue';
import { useLearningStore } from '../../stores/learning.js';
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 应用路由管理器。
 * @type {ReturnType<typeof useRouter>}
 */ const router = useRouter();
/**
 * 当前路由及查询上下文。
 * @type {ReturnType<typeof useRoute>}
 */ const route = useRoute();
/**
 * 重置前由用户明确确认，不使用无法统一滚动和风格的浏览器提示框。
 * @type {import('vue').Ref<boolean>}
 */
const confirmingReset = ref(false);
/**
 * 仅打开确认弹窗，不修改任何学习记录。
 * @returns {void}
 */
function requestReset() { confirmingReset.value = true; }
/**
 * 取消重置并保留自定义键位、完成记录和当前练习。
 * @returns {void}
 */
function cancelReset() { confirmingReset.value = false; }
/**
 * 当前筛选后的课程或命令分组。
 * @type {import('vue').ComputedRef<import('../../shared/types.js').CourseGroup[]>}
 */
const groups = computed(/**
 * 按文章章节组织的课程。
 * @returns {import('../../shared/types.js').CourseGroup[]} 按文章章节组织的课程。
 */ () => {
  /**
   * 按文章章节组织的开放课程。
   * @type {Map<string,import('../../shared/types.js').CourseGroup>}
   */ const chapters = new Map();
  for (/**
   * 当前遍历的完整课程记录。
   * @type {import('../../domain/types.js').Lesson}
   */ const lesson of LESSONS) {
    if ((route.query.category || 'all') !== 'all' && lesson.category !== route.query.category) continue;
    if (!chapters.has(lesson.source.section)) chapters.set(lesson.source.section, { id: lesson.source.section, title: lesson.source.section, lessons: [] });
    chapters.get(lesson.source.section).lessons.push({ id: lesson.id, title: lesson.title, description: lesson.description, completed: store.completed.includes(lesson.id), type: `${lesson.steps.length} 步${lesson.id === store.lesson.id ? ' · 当前练习' : ''}` });
  }
  return [...chapters.values()];
});
/**
 * 前往任意开放课程。
 * @param {string} id 课程标识。
 * @returns {void}
 */
function start(id) { store.startLesson(id); router.push({ name: 'practice', params: { id }, query: { category: route.query.category || 'all', return: route.fullPath } }); }
/**
 * 在地图顶部筛选课程分类。
 * @param {string} category 分类标识。
 * @returns {void}
 */
function filter(category) { store.category = category; router.push({ name: 'map', query: { category } }); }
/**
 * 经用户明确确认后仅清除学习进度。
 * @returns {void}
 */
function resetProgress() { store.completed = []; store.knowledge = []; store.persist(); store.startLesson(store.lesson.id); confirmingReset.value = false; }
/**
 * 统计分类中的真实课程数。
 * @param {string} id 分类标识。
 * @returns {number} 分类课程数。
 */
function countLessons(id) {
  return id === 'all' ? LESSONS.length : LESSONS.filter(
    /**
     * 匹配课程分类。
     * @param {import('../../domain/types.js').Lesson} item 完整课程。
     * @returns {boolean} 是否属于该分类。
     */
    (item) => item.category === id,
  ).length;
}
/**
 * 继续未结束的真实练习，不重置编辑状态。
 * @returns {void} 交给路由恢复当前课程。
 */
function resumePractice() {
  router.push({ name: 'practice', params: { id: store.lesson.id }, query: { category: route.query.category === store.lesson.category ? store.lesson.category : 'all', return: route.fullPath } });
}
</script>
<template>
  <div class="course-controls"><nav class="category-filters" aria-label="课程分类"><BaseButton v-for="category in CATEGORIES" :key="category.id" :variant="(route.query.category || 'all') === category.id ? 'primary' : 'secondary'" :aria-pressed="(route.query.category || 'all') === category.id" @click="filter(category.id)">{{ category.label }} <small>{{ countLessons(category.id) }}</small></BaseButton></nav><BaseButton @click="resumePractice">继续练习</BaseButton><BaseButton variant="text" @click="requestReset">重置进度</BaseButton></div>
  <CourseMap title="关卡地图" description="全部 36 课开放。按文章章节学习，也可以从任意一课开始。" :groups="groups" :current-id="store.lesson.id" @select="start" />
  <BaseDialog :open="confirmingReset" title="重置学习进度" @close="cancelReset">
    <p>清除所有课程完成标记和知识掌握记录？自定义键位会保留，此操作不能撤销。</p>
    <template #footer><BaseButton @click="cancelReset">保留进度</BaseButton><BaseButton variant="primary" @click="resetProgress">确认重置进度</BaseButton></template>
  </BaseDialog>
</template>
