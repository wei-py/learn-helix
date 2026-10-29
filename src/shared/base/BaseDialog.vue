<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

import { useLearningScroll } from '../composables/useLearningScroll.js';
import BaseButton from './BaseButton.vue';

/**
 * 受控弹窗开关与可访问标题。
 * @type {Readonly<{open: boolean, title: string}>}
 */
const props = defineProps({ open: { type: Boolean, default: false }, title: { type: String, required: true } });
/**
 * 只通知关闭意图，不私自改变父组件状态。
 * @type {(event: 'close') => void}
 */
const emit = defineEmits(['close']);
/**
 * 原生弹窗节点负责焦点圈定和背景惰性状态。
 * @type {import('vue').Ref<HTMLDialogElement | null>}
 */
const dialog = ref(null);
/**
 * 每个弹窗独立的标题关联标识。
 * @type {string}
 */
const titleId = useId();
/**
 * 沿用页面控制器锁定唯一滚动根节点。
 * @type {import('../types.js').LearningScroll}
 */
const scroll = useLearningScroll();
/**
 * 打开前的触发控件，关闭后恢复键盘位置。
 * @type {HTMLElement | null}
 */
let previousFocus = null;
/**
 * 标识本弹窗是否持有滚动锁，避免重复释放。
 * @type {boolean}
 */
let locked = false;

/**
 * 释放当前弹窗拥有的滚动锁，不影响其他弹窗。
 * @returns {void}
 */
function unlock() {
  if (!locked) return;
  locked = false;
  scroll.setOverlay(false);
}

/**
 * 将原生弹窗状态与父组件状态同步。
 * @returns {void}
 */
function synchronize() {
  if (!dialog.value) return;
  if (props.open && !dialog.value.open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.value.showModal();
    if (!locked) {
      locked = true;
      scroll.setOverlay(true);
    }
  } else if (!props.open && dialog.value.open) {
    dialog.value.close();
  }
}

/**
 * 请求父组件关闭弹窗，保持受控状态一致。
 * @returns {void}
 */
function requestClose() { emit('close'); }

/**
 * 关闭后恢复入口焦点和页面滚动状态。
 * @returns {Promise<void>} 焦点恢复完成信号。
 */
async function closed() {
  unlock();
  await nextTick();
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
  if (props.open) emit('close');
}

/**
 * 仅真正点击遮罩区域时关闭，弹窗内留白不会触发关闭。
 * @param {MouseEvent} event 点击事件。
 * @returns {void}
 */
function backdrop(event) {
  if (event.target !== dialog.value || !dialog.value) return;
  /**
   * 用于区分真实遮罩点击和弹窗内部留白。
   * @type {DOMRect}
   */
  const bounds = dialog.value.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
}

watch(
  /**
   * 观察父组件的弹窗开关。
   * @returns {boolean} 当前开关。
   */
  () => props.open,
  synchronize,
  { flush: 'post' },
);
onMounted(synchronize);
onBeforeUnmount(
  /**
   * 卸载时清理原生弹窗、滚动锁和入口焦点。
   * @returns {void}
   */
  () => {
    if (dialog.value?.open) dialog.value.close();
    unlock();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  },
);
</script>

<template>
  <dialog ref="dialog" class="base-dialog" :aria-labelledby="titleId" @cancel.prevent="requestClose" @close="closed" @click="backdrop">
    <header class="base-dialog__header">
      <h2 :id="titleId">{{ title }}</h2>
      <BaseButton icon="close" variant="text" aria-label="关闭对话框" @click="requestClose" />
    </header>
    <div class="base-dialog__body scroll-section" tabindex="0"><slot /></div>
    <footer v-if="$slots.footer" class="base-dialog__footer"><slot name="footer" /></footer>
  </dialog>
</template>
