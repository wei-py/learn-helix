<script setup>
import { computed } from 'vue';

/**
 * 共享按钮的表现与原生提交行为，由调用方显式控制。
 * @type {Readonly<{variant: string, type: 'button' | 'submit' | 'reset', disabled: boolean, icon: string}>}
 */
const props = defineProps({
  variant: { type: String, default: 'secondary' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  icon: { type: String, default: '' },
});
/**
 * 静态 Carbon 图标白名单，构建时可完整提取。
 * @type {Readonly<Record<string, string>>}
 */
const icons = Object.freeze({
  map: 'i-carbon-map',
  practice: 'i-carbon-terminal',
  library: 'i-carbon-book',
  recall: 'i-carbon-flash',
  settings: 'i-carbon-settings',
  help: 'i-carbon-help',
  export: 'i-carbon-download',
  close: 'i-carbon-close',
  up: 'i-carbon-arrow-up',
  check: 'i-carbon-checkmark',
  arrow: 'i-carbon-arrow-right',
});
/**
 * 未知图标不渲染，避免生成不可扫描的动态类名。
 * @type {import('vue').ComputedRef<string>}
 */
const iconClass = computed(
  /**
   * 只使用预先声明的 Carbon 图标类，不拼接动态类名。
   * @returns {string} 图标样式类。
   */
  () => icons[props.icon] ?? '',
);
</script>

<template>
  <button :type="type" :disabled="disabled" class="base-button" :class="`base-button--${ variant}`">
    <span v-if="iconClass" :class="iconClass" class="base-button__icon" aria-hidden="true"></span>
    <slot />
  </button>
</template>
