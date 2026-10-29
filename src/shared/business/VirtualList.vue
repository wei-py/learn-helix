<script setup>
import { computed, nextTick, onScopeDispose, ref, toRef, watch } from 'vue';
import { useEventListener, useVirtualList } from 'vue-hooks-plus';

/**
 * 固定行高与有限视口保证绑定编辑列表的准确窗口化。
 * @type {Readonly<{items: import('../types.js').VirtualItem[], itemHeight: number, height: number, itemKey: string}>}
 */
const props = defineProps({ items: { type: Array, required: true }, itemHeight: { type: Number, default: 112 }, height: { type: Number, default: 448 }, itemKey: { type: String, default: 'id' } });
/**
 * 列表的局部滚动节点，不改变页面滚动位置。
 * @type {import('vue').Ref<HTMLElement | null>}
 */
const viewport = ref(null);
/**
 * 由虚拟列表钩子维护顶部占位和总内容高度。
 * @type {import('vue').Ref<HTMLElement | null>}
 */
const wrapper = ref(null);
/**
 * 最多保留一条正在编辑的行，避免输入光标丢失。
 * @type {import('vue').Ref<number>}
 */
const focusedIndex = ref(-1);
/**
 * 用稳定业务键识别编辑行，过滤后不能把原索引误认成另一条数据。
 * @type {import('vue').Ref<string | number | null>}
 */
const focusedKey = ref(null);
/**
 * 当前排队的窗口计算帧，滚动事件最多每帧更新一次。
 * @type {number}
 */
let scrollFrame = 0;
/**
 * 保留当前帧最后一次滚动事件，不为每次事件分配新的窗口数据。
 * @type {Event | null}
 */
let pendingScroll = null;
/**
 * 直接引用调用方的数据，编辑状态保存在业务模型而非节点中。
 * @type {import('vue').Ref<import('../types.js').VirtualItem[]>}
 */
const items = toRef(props, 'items');
/**
 * vue-hooks-plus 返回的窗口行、容器绑定和定位命令。
 * @type {[import('vue').Ref<import('../types.js').VirtualRow[]>, {ref: (element: HTMLElement | null) => void, onScroll: (event: Event) => void}, (index: number) => void]}
 */
const virtual = useVirtualList(items, { wrapperTarget: wrapper, itemHeight: props.itemHeight, overscan: 6 });
/**
 * 当前窗口以及前后六行缓冲区。
 * @type {import('vue').Ref<import('../types.js').VirtualRow[]>}
 */
const visible = virtual[0];
/**
 * 先挂载目标窗口，再由键盘导航聚焦控件。
 * @type {(index: number) => void}
 */
const scrollTo = virtual[2];
/**
 * 行内可操作控件选择器，保持原生 Tab 顺序。
 * @type {string}
 */
const tabbable = 'input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
/**
 * 窗口行和至多一条焦点保留行，容量随视口而非总数据增长。
 * @type {import('vue').ComputedRef<import('../types.js').VirtualRow[]>}
 */
const rows = computed(
  /**
   * 保留正在编辑的行，滚动窗口变化也不会卸载输入框或丢失光标。
   * @returns {import('../types.js').VirtualRow[]} 可见行以及至多一条焦点保留行。
   */
  () => {
    if (focusedIndex.value < 0 || focusedIndex.value >= items.value.length || visible.value.some(
      /**
       * 判断焦点行是否已在窗口内。
       * @param {import('../types.js').VirtualRow} row 可见行。
       * @returns {boolean} 是否为焦点行。
       */
      (row) => row.index === focusedIndex.value,
    )) return visible.value;
    /**
     * 保留行始终按原始顺序插入，首末行的原生 Tab 出口不会被打乱。
     * @type {import('../types.js').VirtualRow}
     */
    const retained = { data: items.value[focusedIndex.value], index: focusedIndex.value };
    return focusedIndex.value < (visible.value[0]?.index ?? 0) ? [retained, ...visible.value] : [...visible.value, retained];
  },
);
/**
 * 虚拟钩子顶部占位所对应的原始行索引。
 * @type {import('vue').ComputedRef<number>}
 */
const firstIndex = computed(
  /**
   * 与虚拟列表钩子设置的顶部占位保持一致。
   * @returns {number} 当前窗口首行位置。
   */
  () => visible.value[0]?.index ?? 0,
);

/**
 * 将模板元素交给 vue-hooks-plus 的尺寸和滚动生命周期管理。
 * @param {HTMLElement | null} element 列表容器。
 * @returns {void}
 */
function bindViewport(element) {
  viewport.value = element;
  virtual[1].ref(element);
}

/**
 * 使用业务稳定键保留输入节点，缺少键时仅按列表位置处理。
 * @param {import('../types.js').VirtualRow} row 窗口行。
 * @returns {string | number} Vue 节点键。
 */
function rowKey(row) {
  /**
   * 业务键只接受稳定字符串或数字。
   * @type {unknown}
   */
  const value = row.data[props.itemKey];
  return typeof value === 'number' || typeof value === 'string' ? value : row.index;
}

/**
 * 更新正在编辑的行索引。
 * @param {FocusEvent} event 焦点进入事件。
 * @returns {void}
 */
function rememberFocus(event) {
  if (!(event.target instanceof HTMLElement)) return;
  /**
   * 当前操作关联的行节点，未命中时不改变输入焦点。
   * @type {HTMLElement | null}
   */
  const row = event.target.closest('[data-virtual-index]');
  focusedIndex.value = row ? Number(row.dataset.virtualIndex) : -1;
  focusedKey.value = focusedIndex.value >= 0 && items.value[focusedIndex.value] ? rowKey({ data: items.value[focusedIndex.value], index: focusedIndex.value }) : null;
}

/**
 * 焦点离开列表后释放保留行，缓存规模不会持续增长。
 * @returns {Promise<void>} 焦点检查完成信号。
 */
async function forgetFocus() {
  await nextTick();
  if (!viewport.value?.contains(document.activeElement)) {
    focusedIndex.value = -1;
    focusedKey.value = null;
  }
}

/**
 * 先挂载目标行，再聚焦其输入框或行容器。
 * @param {number} index 目标行索引。
 * @param {boolean} [last] 是否聚焦行内最后一个可操作控件。
 * @returns {Promise<void>} 焦点移动完成信号。
 */
async function focusRow(index, last = false) {
  /**
   * 把键盘目标限制在现有数据范围内。
   * @type {number}
   */
  const bounded = Math.max(0, Math.min(index, items.value.length - 1));
  if (!items.value.length) return;
  focusedIndex.value = bounded;
  scrollTo(bounded);
  await nextTick();
  /**
   * 当前操作关联的行节点，未命中时不改变输入焦点。
   * @type {HTMLElement | null}
   */
  const row = viewport.value?.querySelector(`[data-virtual-index="${  bounded  }"]`) ?? null;
  /**
   * 当前行可操作控件，供跨行 Tab 顺序衔接。
   * @type {HTMLElement[]}
   */
  const controls = row ? Array.from(row.querySelectorAll(tabbable)) : [];
  (last ? controls.at(-1) ?? row : controls[0] ?? row)?.focus({ preventScroll: true });
}

/**
 * 支持跨未挂载行的 Tab 导航，行容器上也可使用方向键和翻页键。
 * @param {KeyboardEvent} event 键盘事件。
 * @returns {void}
 */
function keyboard(event) {
  if (!(event.target instanceof HTMLElement) || !viewport.value) return;
  /**
   * 当前操作关联的行节点，未命中时不改变输入焦点。
   * @type {HTMLElement | null}
   */
  const row = event.target.closest('[data-virtual-index]');
  /**
   * 焦点行在原始绑定数据中的索引。
   * @type {number}
   */
  const index = row ? Number(row.dataset.virtualIndex) : 0;
  if (event.key === 'Tab' && row) {
    /**
     * 当前行可操作控件，供跨行 Tab 顺序衔接。
     * @type {HTMLElement[]}
     */
    const controls = Array.from(row.querySelectorAll(tabbable));
    if (!event.shiftKey && event.target === controls.at(-1) && index < items.value.length - 1) {
      event.preventDefault();
      void focusRow(index + 1);
    } else if (event.shiftKey && (event.target === controls[0] || event.target === row) && index > 0) {
      event.preventDefault();
      void focusRow(index - 1, true);
    }
    return;
  }
  if (event.target !== row && event.target !== viewport.value && !event.altKey) return;
  /**
   * 按当前实际视口高度计算单次翻页行数。
   * @type {number}
   */
  const page = Math.max(1, Math.floor(viewport.value.clientHeight / props.itemHeight));
  /**
   * 明确列出支持的导航键，不拦截普通文本编辑。
   * @type {Record<string, number>}
   */
  const destinations = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.value.length - 1, PageDown: index + page, PageUp: index - page };
  if (Object.hasOwn(destinations, event.key)) {
    event.preventDefault();
    void focusRow(destinations[event.key]);
  }
}

/**
 * 合并高频滚动事件，再调用 vue-hooks-plus 的真实窗口计算。
 * @param {Event} event 原生滚动事件。
 * @returns {void}
 */
function observeScroll(event) {
  pendingScroll = event;
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(
    /**
     * 同一帧只处理最后一次位置，并释放事件引用。
     * @returns {void}
     */
    () => {
      scrollFrame = 0;
      if (pendingScroll) virtual[1].onScroll(pendingScroll);
      pendingScroll = null;
    },
  );
}

useEventListener('scroll', observeScroll, { target: viewport, passive: true });
onScopeDispose(
  /**
   * 弹窗或列表卸载时取消排队帧，不保留事件和旧节点。
   * @returns {void}
   */
  () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    pendingScroll = null;
  },
);
useEventListener('keydown', keyboard, { target: viewport });
watch(items,
  /**
   * 按稳定身份重定位保留行；原条目被过滤时将焦点交回列表区域。
   * @param {import('../types.js').VirtualItem[]} nextItems 更新后的业务数据。
   * @returns {void}
   */
  (nextItems) => {
    if (focusedKey.value === null) return;
    /**
     * 索引只用于定位，同一业务键在过滤后可能位于不同位置。
     * @type {number}
     */
    const nextIndex = nextItems.findIndex(
      /**
       * 使用调用方声明的稳定键匹配身份，不比较可变的文本字段。
       * @param {import('../types.js').VirtualItem} item 候选条目。
       * @param {number} index 候选位置，仅在缺少业务键时回退。
       * @returns {boolean} 是否为原焦点条目。
       */
      (item, index) => {
        /**
         * 字符串或数字业务键可安全用于 Vue 节点身份。
         * @type {unknown}
         */
        const key = item[props.itemKey];
        return (typeof key === 'string' || typeof key === 'number' ? key : index) === focusedKey.value;
      },
    );
    focusedIndex.value = nextIndex;
    if (nextIndex < 0) {
      focusedKey.value = null;
      if (viewport.value?.contains(document.activeElement)) viewport.value.focus({ preventScroll: true });
    }
  },
);
defineExpose({ focusRow });
</script>

<template>
  <div :ref="bindViewport" class="virtual-list scroll-section" :style="{ '--virtual-height': `${height }px`, height: `${height }px` }" tabindex="0" role="list" :aria-label="`共 ${ items.length } 项，可使用方向键或 Tab 导航`" @focusin="rememberFocus" @focusout="forgetFocus">
    <div ref="wrapper" class="virtual-list__wrapper">
      <div v-for="row in rows" :key="rowKey(row)" class="virtual-list__row" :style="{ height: `${itemHeight }px`, top: `${(row.index - firstIndex) * itemHeight }px` }" :data-virtual-index="row.index" tabindex="-1" role="listitem" :aria-setsize="items.length" :aria-posinset="row.index + 1"><slot :item="row.data" :index="row.index" /></div>
    </div>
  </div>
</template>
