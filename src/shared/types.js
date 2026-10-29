/**
 * 共享滚动控制器，页面和原生弹窗使用同一个内容根节点。
 * @typedef {object} LearningScroll
 * @property {import('vue').ShallowRef<HTMLElement | null>} root 页面滚动根节点。
 * @property {import('vue').Ref<number>} position 当前纵向位置。
 * @property {(callback: () => unknown | Promise<unknown>) => Promise<void>} preserve 更新内容时保留位置。
 * @property {(key: string) => void} beforeNavigation 保存离开页面的位置。
 * @property {(key: string, options?: {restore?: boolean}) => Promise<void>} afterNavigation 恢复或重置目标页面。
 * @property {(element: HTMLElement | null, options?: {smooth?: boolean, focus?: boolean}) => void} scrollToAnchor 定位内容内锚点。
 * @property {(smooth?: boolean) => void} top 返回内容顶部。
 * @property {(open: boolean) => void} setOverlay 更新弹窗滚动锁。
 */

/**
 * 课程地图中的一节课程。
 * @typedef {object} CourseLesson
 * @property {string} id 课程标识。
 * @property {string} title 课程标题。
 * @property {string} description 课程说明。
 * @property {string} [type] 课程类型。
 * @property {number} [minutes] 预计学习分钟数。
 * @property {boolean} completed 是否已完成。
 */

/**
 * 课程地图中的章节。
 * @typedef {object} CourseGroup
 * @property {string} id 章节标识。
 * @property {string} title 章节标题。
 * @property {string} [description] 章节说明。
 * @property {CourseLesson[]} lessons 本章课程。
 */

/**
 * 虚拟列表支持的稳定行数据；业务字段由调用方维护。
 * @typedef {{id?: string | number, [key: string]: unknown}} VirtualItem
 */

/**
 * 窗口化后的一行数据。
 * @typedef {object} VirtualRow
 * @property {VirtualItem} data 原始行数据。
 * @property {number} index 原始列表位置。
 */

/**
 * 需要原样恢复的行内溢出声明，包含原始优先级。
 * @typedef {object} OverflowDeclaration
 * @property {'overflow' | 'overflow-x' | 'overflow-y'} name CSS 属性名称。
 * @property {string} value 原始声明值。
 * @property {string} priority 原始 important 优先级。
 */

/**
 * 弹窗打开前的元素滚动状态，不覆盖其他动态行内样式。
 * @typedef {object} OverflowSnapshot
 * @property {HTMLElement} element 被锁定的真实节点。
 * @property {OverflowDeclaration[]} declarations 原始顺序的溢出声明。
 * @property {number} top 原始纵向滚动位置。
 * @property {number} left 原始横向滚动位置。
 */

export {};
