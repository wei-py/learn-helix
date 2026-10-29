<script setup>
/**
 * 课程按章节展示，完成状态只作提示而不锁定入口。
 * @type {Readonly<{title: string, description: string, currentId: string, groups: import('../types.js').CourseGroup[]}>}
 */
const props = defineProps({ title: { type: String, default: '课程地图' }, description: { type: String, default: '' }, currentId: { type: String, default: '' }, groups: { type: Array, required: true } });
/**
 * 向应用路由报告被选择的课程标识。
 * @type {(event: 'select', id: string) => void}
 */
const emit = defineEmits(['select']);

/**
 * 所有课程始终可直接进入，完成状态只作为进度提示。
 * @param {string} id 课程标识。
 * @returns {void}
 */
function select(id) { emit('select', id); }

/**
 * 将业务类型转换为地图中可直接阅读的中文标签。
 * @param {string} [type] 原始课程类型。
 * @returns {string} 中文类型或已提供的中文说明。
 */
function typeLabel(type) {
  if (type === 'practice') return '实操练习';
  if (type === 'reading') return '原理阅读';
  return type ?? '';
}

/**
 * 按完整路线编号，分组不会重置课程的学习顺序。
 * @param {number} groupIndex 章节索引。
 * @param {number} lessonIndex 章内课程索引。
 * @returns {string} 补零后的课程序号。
 */
function number(groupIndex, lessonIndex) {
  /**
   * 累加先前章节的课程数，避免构造重复的地图数据副本。
   * @type {number}
   */
  let ordinal = lessonIndex + 1;
  /**
   * 只遍历目标章节之前的分组。
   * @type {number}
   */
  for (let index = 0; index < groupIndex; index += 1) ordinal += props.groups[index].lessons.length;
  return String(ordinal).padStart(2, '0');
}
</script>

<template>
  <section class="course-map" aria-labelledby="course-map-title">
    <header class="paper-heading">
      <p class="paper-kicker">学习路线 · COURSE MAP</p>
      <h1 id="course-map-title">{{ props.title }}</h1>
      <p v-if="description" class="paper-lead">{{ description }}</p>
    </header>
    <section v-for="(group, groupIndex) in groups" :key="group.id" class="course-group" :aria-labelledby="`course-group-${ group.id}`">
      <header class="course-group__heading"><span class="course-group__number">{{ String(groupIndex + 1).padStart(2, '0') }}</span><div><h2 :id="`course-group-${ group.id}`">{{ group.title }}</h2><p v-if="group.description">{{ group.description }}</p></div></header>
      <ol class="course-lessons">
        <li v-for="(lesson, lessonIndex) in group.lessons" :key="lesson.id">
          <button type="button" class="course-lesson" :class="{ 'course-lesson--completed': lesson.completed, 'course-lesson--current': lesson.id === currentId }" :data-course-id="lesson.id" :aria-current="lesson.id === currentId ? 'step' : undefined" @click="select(lesson.id)">
            <span class="course-lesson__meta"><span class="course-lesson__number">{{ number(groupIndex, lessonIndex) }}</span><span v-if="lesson.type">{{ typeLabel(lesson.type) }}</span><span v-if="lesson.minutes">约 {{ lesson.minutes }} 分钟</span></span>
            <span class="course-lesson__title">{{ lesson.title }}</span>
            <span class="course-lesson__description">{{ lesson.description }}</span>
            <span class="course-lesson__status"><span v-if="lesson.id === currentId" class="course-lesson__current">当前课程</span><span v-if="lesson.completed" class="course-lesson__completed"><span class="i-carbon-checkmark" aria-hidden="true"></span>已完成</span></span>
            <span class="course-lesson__action">{{ lesson.id === currentId ? '继续学习' : lesson.completed ? '再次学习' : '开始学习' }}<span class="i-carbon-arrow-right" aria-hidden="true"></span></span>
          </button>
        </li>
      </ol>
    </section>
  </section>
</template>
