import tailwindcss from '@tailwindcss/vite';
import presetIcons from '@unocss/preset-icons';
import UnoCSS from '@unocss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite-plus';

/**
 * 相对部署路径、Vue 模板编译、Tailwind 与仅图标 UnoCSS 的统一配置。
 * @type {import('vite').UserConfig}
 */
const config = {
  base: './',
  plugins: [vue(), tailwindcss(), UnoCSS({ presets: [presetIcons({ scale: 1.1, warn: true })] })],
};

export default defineConfig(config);
