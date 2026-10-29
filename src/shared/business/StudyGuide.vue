<script setup>
/**
 * 右侧学习提示的标题，可按当前页面覆盖。
 * @type {Readonly<{title: string}>}
 */
const props = defineProps({ title: { type: String, default: '学习提示' } });
</script>

<template>
  <section class="study-guide"><h2>{{ props.title }}</h2><div class="study-guide__content"><slot /></div></section>
</template>
