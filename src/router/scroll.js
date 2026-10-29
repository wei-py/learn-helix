import { onBeforeUnmount } from 'vue';

/**
 * 为每个历史条目生成独立标识，兼容不支持 randomUUID 的局域网 HTTP。
 * @returns {string} 一百二十八位随机十六进制标识。
 */
function createEntryKey() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)),
    /**
     * 将随机整数编码为固定宽度，避免历史标识歧义。
     * @param {number} value 随机整数。
     * @returns {string} 八位十六进制片段。
     */
    value => value.toString(16).padStart(8, '0'),
  ).join('');
}

/**
 * 只从具有当前格式的历史记录读取滚动键，不复用未知外部状态。
 * @returns {string|null} 已保存的条目标识，或空。
 */
function savedEntryKey() {
  /**
   * 由当前文档路由管理器写入的标识候选。
   * @type {unknown}
   */
  const candidate = history.state?.helixLearningEntry;
  return typeof candidate === 'string' && /^[a-f\d]{32}$/u.test(candidate) ? candidate : null;
}

/**
 * 把页面滚动策略集中绑定到 Router，而不是由各业务组件控制。
 * @param {{router: import('vue-router').Router, store: import('../stores/types.js').LearningState & {lesson: import('../domain/types.js').Lesson}, scroll: import('../shared/types.js').LearningScroll}} options 应用路由、全局状态和唯一滚动控制器。
 * @returns {void}
 */
export function useRouteScroll(options) {
  /**
   * 当前应用的 Router 实例。
   * @type {import('vue-router').Router}
   */
  const router = options.router;
  /**
   * 学习上下文在导航时统一关闭弹窗并保存回忆草稿。
   * @type {import('../stores/types.js').LearningState & {lesson: import('../domain/types.js').Lesson}}
   */
  const store = options.store;
  /**
   * 所有位置保存和移动都交给共享根控制器。
   * @type {import('../shared/types.js').LearningScroll}
   */
  const scroll = options.scroll;
  /**
   * 同一地址的不同历史项也必须各自保存滚动位置。
   * @type {string}
   */
  let currentKey = savedEntryKey() || createEntryKey();
  /**
   * Router 的历史序号用来区分 push 和原地 replace。
   * @type {number}
   */
  let currentPosition = Number(history.state?.position ?? 0);
  /**
   * 历史监听仅标识真正的浏览器遍历，不把普通重进误判成恢复。
   * @type {boolean}
   */
  let traversing = false;
  /**
   * 当前导航是否来自后退或前进，直到对应 afterEach 消费。
   * @type {boolean}
   */
  let pendingTraversal = false;
  /**
   * 丢弃已被更新导航取代的异步聚焦任务。
   * @type {number}
   */
  let revision = 0;
  /**
   * 只有列表允许显式返回旧上下文，且最多保留八十项。
   * @type {Map<string, string>}
   */
  const recentLists = new Map();
  /**
   * 离开应用时归还浏览器原来的恢复策略。
   * @type {ScrollRestoration}
   */
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, helixLearningEntry: currentKey }, '', location.href);

  /**
   * 记录可返回的列表筛选和条目，避免无限累积历史缓存。
   * @param {import('vue-router').RouteLocationNormalized} route 当前路由。
   * @param {string} key 对应历史条目标识。
   * @returns {void}
   */
  function rememberList(route, key) {
    if (route.name !== 'map' && route.name !== 'library') return;
    recentLists.delete(route.fullPath);
    recentLists.set(route.fullPath, key);
    if (recentLists.size > 80) recentLists.delete(recentLists.keys().next().value ?? '');
  }

  /**
   * 在 Router 自身处理 pop 后、守卫微任务执行前标记遍历来源。
   * @returns {void}
   */
  function markTraversal() { traversing = true; }

  /**
   * 历史遍历订阅的清理函数。
   * @type {() => void}
   */
  const removeHistory = router.options.history.listen(markTraversal);

  /**
   * 离开前保存唯一滚动根、列表和题目草稿，不在组件中移动窗口。
   * @param {import('vue-router').RouteLocationNormalized} _to 目标路由。
   * @param {import('vue-router').RouteLocationNormalized} from 即将离开的路由。
   * @returns {void}
   */
  function beforeNavigation(_to, from) {
    revision += 1;
    pendingTraversal = traversing;
    traversing = false;
    store.recallRestoreKey = pendingTraversal ? savedEntryKey() || '' : '';
    scroll.beforeNavigation(currentKey);
    rememberList(from, currentKey);
    store.modal = '';
    store.pending = [];
    if (from.name === 'map') store.category = String(from.query.category || 'all');
    if (from.name === 'recall') {
      delete store.recallContexts[currentKey];
      store.recallContexts[currentKey] = { answer: store.recallAnswer, revealed: store.recallRevealed };
      /**
       * 按最近访问顺序保留有界草稿，避免目录题长期累积。
       * @type {string[]}
       */
      const keys = Object.keys(store.recallContexts);
      if (keys.length > 80) delete store.recallContexts[keys[0]];
    }
  }

  /**
   * 后退前进按历史项恢复，列表返回按筛选恢复，普通进入始终置顶。
   * @param {import('vue-router').RouteLocationNormalized} to 目标路由。
   * @param {import('vue-router').RouteLocationNormalized} from 原路由。
   * @param {import('vue-router').NavigationFailure|void} failure 导航失败信息。
   * @returns {Promise<void>} 布局更新、恢复和聚焦完成。
   */
  async function afterNavigation(to, from, failure) {
    if (failure) { pendingTraversal = false; store.recallRestoreKey = ''; return; }
    /**
     * 捕获本次完成任务的导航版本，防止快速切换后抢回焦点。
     * @type {number}
     */
    const version = revision;
    /**
     * 历史序号在 Router 完成 push/replace 后读取。
     * @type {number}
     */
    const nextPosition = Number(history.state?.position ?? 0);
    /**
     * 原地筛选不会生成新条目，也不能跳回页面顶部。
     * @type {boolean}
     */
    const replacing = !pendingTraversal && nextPosition === currentPosition;
    /**
     * 浏览器遍历读取原条目，新 push 必须分配新标识。
     * @type {string}
     */
    const nextKey = pendingTraversal ? savedEntryKey() || createEntryKey() : replacing ? currentKey : createEntryKey();
    /**
     * 普通页面的重复地址不代表返回；只允许遍历或列表使用缓存。
     * @type {string|undefined}
     */
    const restoreKey = pendingTraversal ? nextKey : to.name === 'map' || to.name === 'library' ? recentLists.get(to.fullPath) : undefined;
    pendingTraversal = false;
    currentKey = nextKey;
    currentPosition = nextPosition;
    history.replaceState({ ...history.state, helixLearningEntry: nextKey }, '', location.href);
    if (replacing && to.name === 'library' && to.path === from.path) {
      if (recentLists.get(from.fullPath) === nextKey) recentLists.delete(from.fullPath);
      rememberList(to, nextKey);
      return;
    }
    await scroll.afterNavigation(restoreKey || nextKey, { restore: Boolean(restoreKey) });
    if (version !== revision) return;
    scroll.beforeNavigation(nextKey);
    rememberList(to, nextKey);
    /**
     * 返回地图后保留当前课程焦点，其他路由聚焦主要内容。
     * @type {HTMLElement|null}
     */
    const destination = to.name === 'map' && from.name === 'practice'
      ? document.querySelector(`[data-course-id="${CSS.escape(store.lesson.id)}"]`) || document.getElementById('main-content')
      : document.getElementById('main-content');
    destination?.focus({ preventScroll: true });
  }

  /**
   * 导航守卫订阅的清理函数。
   * @type {() => void}
   */
  const removeBefore = router.beforeEach(beforeNavigation);
  /**
   * 导航完成订阅的清理函数。
   * @type {() => void}
   */
  const removeAfter = router.afterEach(afterNavigation);
  onBeforeUnmount(
    /**
     * 卸载后不保留事件、列表索引或过期的异步恢复任务。
     * @returns {void}
     */
    () => {
      revision += 1;
      removeBefore();
      removeAfter();
      removeHistory();
      recentLists.clear();
      store.recallContexts = {};
      store.recallRestoreKey = '';
      history.scrollRestoration = previousRestoration;
    },
  );
}
