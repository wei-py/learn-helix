import { ref } from 'vue';

/** 主题存储键。 @type {string} */
const STORAGE_KEY = 'helix-theme';
/** 首屏已应用的主题选择。 @type {import('vue').Ref<string>} */
export const theme = ref(document.documentElement.dataset.theme || 'auto');
/** 系统配色偏好。 @type {MediaQueryList} */
const media = window.matchMedia('(prefers-color-scheme: dark)');
/** 设置面板展示的实时系统主题。 @type {import('vue').Ref<boolean>} */
export const systemDark = ref(media.matches);

/**
 * 应用主题；存储不可用时仍保留当前页面选择。
 * @param {string | null} value 主题选择。
 * @returns {void} 无返回值。
 */
export function setTheme(value) {
  theme.value = value === 'light' || value === 'dark' ? value : 'auto';
  applyTheme();
  try {
    if (theme.value === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme.value);
  } catch { /* 禁用站点存储时仅在当前页面生效。 */ }
}

/**
 * 同步根元素及原生控件的主题提示；自动模式由 CSS 跟随系统。
 * @returns {void} 无返回值。
 */
function applyTheme() {
  if (theme.value === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.value;
  document.querySelector('meta[name="color-scheme"]').content = theme.value === 'auto' ? 'light dark' : theme.value;
}

/**
 * 更新设置中显示的系统主题，不改变手动选择。
 * @param {MediaQueryListEvent} event 系统配色变化。
 * @returns {void} 无返回值。
 */
function onSystemChange(event) {
  systemDark.value = event.matches;
}

/**
 * 接收其他标签页的主题选择及清空存储操作。
 * @param {StorageEvent} event 存储变化。
 * @returns {void} 无返回值。
 */
function onStorage(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  theme.value = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'auto';
  applyTheme();
}

media.addEventListener('change', onSystemChange);
window.addEventListener('storage', onStorage);
