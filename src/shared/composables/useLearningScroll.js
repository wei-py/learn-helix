import { getCurrentInstance, inject, nextTick, onMounted, onScopeDispose, provide, ref, shallowRef } from 'vue';
import { useEventListener } from 'vue-hooks-plus';

/**
 * 注入键只标识当前应用的统一滚动上下文。
 * @type {import('vue').InjectionKey<import('../types.js').LearningScroll>}
 */
const scrollKey = Symbol('learning-scroll');
/**
 * 以应用为弱键共享实例，独立挂载的应用不会互相覆盖滚动根节点。
 * @type {WeakMap<import('vue').App, import('../types.js').LearningScroll>}
 */
const controllers = new WeakMap();

/**
 * 等待布局更新完成，避免恢复滚动时读取旧高度。
 * @returns {Promise<void>} 下一帧完成信号。
 */
async function layoutReady() {
  await nextTick();
  await new Promise(
    /**
     * 在下一动画帧完成布局等待。
     * @param {(value?: void) => void} resolve 帧完成回调。
     * @returns {void}
     */
    (resolve) => {
      requestAnimationFrame(
        /**
         * 通知调用方可以读取更新后的布局。
         * @returns {void}
         */
        () => resolve(),
      );
    },
  );
}

/**
 * 创建当前应用唯一的滚动控制器，并将事件清理绑定到调用方生命周期。
 * @returns {import('../types.js').LearningScroll} 共享控制器。
 * @throws {Error} 在组件 setup 之外使用时抛出明确的生命周期错误。
 */
function controller() {
  /**
   * 当前组件所属应用决定控制器的隔离范围。
   * @type {import('vue').App | undefined}
   */
  const app = getCurrentInstance()?.appContext.app;
  if (!app) throw new Error('滚动控制器必须在 Vue 组件 setup 中使用。');
  /**
   * 应用根组件和布局复用既有实例，避免重复注册滚动监听。
   * @type {import('../types.js').LearningScroll | undefined}
   */
  const existing = controllers.get(app);
  if (existing) return existing;
  /**
   * 唯一页面滚动容器；模板尚未挂载时为空。
   * @type {import('vue').ShallowRef<HTMLElement | null>}
   */
  const root = shallowRef(null);
  /**
   * 按动画帧更新的位置，供返回顶部控件使用。
   * @type {import('vue').Ref<number>}
   */
  const position = ref(0);
  /**
   * 仅保存在内存中的路由位置，容量限制为八十项。
   * @type {Map<string, number>}
   */
  const positions = new Map();
  /**
   * 待执行的滚动采样帧，零表示没有排队任务。
   * @type {number}
   */
  let frame = 0;
  /**
   * 正在占用页面滚动锁的弹窗数量。
   * @type {number}
   */
  let overlays = 0;
  /**
   * 只记录首次加锁时的真实节点、溢出声明与双轴坐标。
   * @type {import('../types.js').OverflowSnapshot[]}
   */
  let overflowSnapshots = [];
  /**
   * 递增序号用于丢弃已被后续导航覆盖的异步恢复。
   * @type {number}
   */
  let navigationVersion = 0;

  /**
   * 保存溢出相关的实际行内声明，避免丢失独立轴声明和 important。
   * @param {HTMLElement} element 即将锁定的节点。
   * @returns {import('../types.js').OverflowSnapshot} 原始样式与坐标。
   */
  function snapshotOverflow(element) {
    /**
     * 保留 CSSOM 中的声明顺序，恢复时不会颠倒简写与长写优先关系。
     * @type {import('../types.js').OverflowDeclaration[]}
     */
    const declarations = [];
    /**
     * 逐一检查已有行内声明，不复制无关的动态样式。
     * @type {number}
     */
    for (let index = 0; index < element.style.length; index += 1) {
      /**
       * 仅三个溢出属性属于弹窗滚动锁的管理范围。
       * @type {string}
       */
      const name = element.style.item(index);
      if (name === 'overflow' || name === 'overflow-x' || name === 'overflow-y') declarations.push({ name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) });
    }
    return { element, declarations, top: element.scrollTop, left: element.scrollLeft };
  }

  /**
   * 按原顺序恢复溢出声明与坐标，保留弹窗期间其他行内样式更新。
   * @param {import('../types.js').OverflowSnapshot} snapshot 原始节点状态。
   * @returns {void}
   */
  function restoreOverflow(snapshot) {
    snapshot.element.style.removeProperty('overflow');
    snapshot.element.style.removeProperty('overflow-x');
    snapshot.element.style.removeProperty('overflow-y');
    /**
     * 逐条恢复原始值及优先级，不能降级 important 声明。
     * @type {import('../types.js').OverflowDeclaration}
     */
    for (const declaration of snapshot.declarations) snapshot.element.style.setProperty(declaration.name, declaration.value, declaration.priority);
    snapshot.element.scrollTo({ top: snapshot.top, left: snapshot.left, behavior: 'instant' });
  }

  /**
   * 尊重系统减少动态效果的偏好。
   * @param {boolean} smooth 是否请求平滑滚动。
   * @returns {ScrollBehavior} 浏览器滚动行为。
   */
  function behavior(smooth) {
    return smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant';
  }

  /**
   * 将纵向位置限制在当前根节点可滚动的范围。
   * @param {number} value 目标位置。
   * @param {boolean} [smooth] 是否平滑移动。
   * @param {number} [left] 需要恢复的横向位置。
   * @returns {void}
   */
  function move(value, smooth = false, left = 0) {
    if (!root.value) return;
    root.value.scrollTo({ top: Math.min(Math.max(value, 0), Math.max(0, root.value.scrollHeight - root.value.clientHeight)), left, behavior: behavior(smooth) });
  }

  /**
   * 合并高频滚动事件，不在每次事件中触发布局更新。
   * @returns {void}
   */
  function observe() {
    if (frame) return;
    frame = requestAnimationFrame(
      /**
       * 每帧最多同步一次当前位置。
       * @returns {void}
       */
      () => {
        frame = 0;
        position.value = root.value?.scrollTop ?? 0;
      },
    );
  }
  useEventListener('scroll', observe, { target: root, passive: true });

  /**
   * 所有页面共用的滚动命令，禁止直接操作窗口滚动。
   * @type {import('../types.js').LearningScroll}
   */
  const result = {
    root,
    position,
    /**
     * 保留非导航更新前的位置。
     * @param {() => unknown | Promise<unknown>} callback 内容更新操作。
     * @returns {Promise<void>} 恢复完成信号。
     * @throws {unknown} 原样传递内容更新抛出的错误，恢复位置后仍由调用方处理。
     */
    async preserve(callback) {
      /**
       * 非导航更新前的双轴坐标，即使内容更新失败也必须恢复。
       * @type {{top: number, left: number}}
       */
      const previous = { top: root.value?.scrollTop ?? 0, left: root.value?.scrollLeft ?? 0 };
      try {
        await callback();
      } finally {
        await layoutReady();
        move(previous.top, false, previous.left);
      }
    },
    /**
     * 缓存即将离开的路由，最多保留八十个页面。
     * @param {string} key 路由缓存键。
     * @returns {void}
     */
    beforeNavigation(key) {
      navigationVersion += 1;
      positions.delete(key);
      positions.set(key, root.value?.scrollTop ?? 0);
      if (positions.size > 80) positions.delete(positions.keys().next().value ?? '');
    },
    /**
     * 仅历史导航恢复缓存，主动导航从顶部开始。
     * @param {string} key 目标路由键。
     * @param {{restore?: boolean}} [options] 是否恢复历史位置。
     * @returns {Promise<void>} 恢复完成信号。
     */
    async afterNavigation(key, options = {}) {
      /**
       * 当前导航的异步恢复凭据。
       * @type {number}
       */
      const version = ++navigationVersion;
      await layoutReady();
      if (version !== navigationVersion) return;
      move(options.restore ? positions.get(key) ?? 0 : 0);
    },
    /**
     * 在固定顶栏下定位锚点，不滚动浏览器窗口。
     * @param {HTMLElement | null} element 目标元素。
     * @param {{smooth?: boolean, focus?: boolean}} [options] 移动及聚焦选项。
     * @returns {void}
     */
    scrollToAnchor(element, options = {}) {
      if (!root.value || !element) return;
      /**
       * 顶栏留白高度，确保锚点不会被固定导航遮挡。
       * @type {number}
       */
      const offset = Number.parseFloat(getComputedStyle(root.value).getPropertyValue('--shell-sticky-offset')) || 96;
      move(element.getBoundingClientRect().top - root.value.getBoundingClientRect().top + root.value.scrollTop - offset, options.smooth);
      if (options.focus) element.focus({ preventScroll: true });
    },
    /**
     * 返回内容顶部。
     * @param {boolean} [smooth] 是否平滑移动。
     * @returns {void}
     */
    top(smooth = false) { move(0, smooth); },
    /**
     * 对原生弹窗使用可重入的页面滚动锁。
     * @param {boolean} open 当前弹窗是否打开。
     * @returns {void}
     */
    setOverlay(open) {
      if (open) {
        overlays += 1;
        if (overlays !== 1) return;
        overflowSnapshots = [snapshotOverflow(document.body)];
        if (root.value) overflowSnapshots.push(snapshotOverflow(root.value));
        /**
         * 对两个实际节点加锁，不修改页面其他布局声明。
         * @type {import('../types.js').OverflowSnapshot}
         */
        for (const snapshot of overflowSnapshots) snapshot.element.style.setProperty('overflow', 'hidden', 'important');
      } else {
        if (!overlays) return;
        overlays -= 1;
        if (overlays) return;
        /**
         * 最后一个弹窗关闭后才还原首次加锁时的状态。
         * @type {import('../types.js').OverflowSnapshot}
         */
        for (const snapshot of overflowSnapshots) restoreOverflow(snapshot);
        overflowSnapshots = [];
      }
    },
  };
  controllers.set(app, result);
  onMounted(
    /**
     * 应用根组件先调用时，也能在挂载后接入布局节点。
     * @returns {void}
     */
    () => {
      root.value ??= document.getElementById('scroll-root');
      observe();
    },
  );
  onScopeDispose(
    /**
     * 应用卸载时取消帧、清空缓存并释放仍持有的滚动锁。
     * @returns {void}
     */
    () => {
      if (frame) cancelAnimationFrame(frame);
      positions.clear();
      if (overlays) {
        overlays = 1;
        result.setOverlay(false);
      }
      controllers.delete(app);
    },
  );
  return result;
}

/**
 * 由布局组件提供同一个根节点控制器；应用根组件可先使用安全回退实例。
 * @returns {import('../types.js').LearningScroll} 共享控制器。
 * @throws {Error} 在组件 setup 之外调用时无法建立生命周期。
 */
export function provideLearningScroll() {
  /**
   * 向布局后代提供与应用根组件相同的控制器。
   * @type {import('../types.js').LearningScroll}
   */
  const value = controller();
  provide(scrollKey, value);
  return value;
}

/**
 * 取得应用滚动控制器，不创建额外的页面滚动区域或重复监听器。
 * @returns {import('../types.js').LearningScroll} 共享控制器。
 * @throws {Error} 在组件 setup 之外调用时无法建立生命周期。
 */
export function useLearningScroll() {
  return inject(scrollKey, null) ?? controller();
}
