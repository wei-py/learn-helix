<script setup>
import { exportToml } from '../../domain/bindings.js';
import BaseButton from '../../shared/base/BaseButton.vue';
import BaseDialog from '../../shared/base/BaseDialog.vue';
import { useLearningStore } from '../../stores/learning.js';
import SettingsPanel from './SettingsPanel.vue';
/**
 * 共享学习状态。
 * @type {ReturnType<typeof useLearningStore>}
 */ const store = useLearningStore();
/**
 * 复制真实配置片段，失败时提示手动复制。
 * @returns {Promise<void>} 复制完成。
 */
async function copy() { try { await navigator.clipboard.writeText(exportToml(store.bindings)); store.settingsMessage = '已复制到剪贴板'; } catch { store.settingsMessage = '无法自动复制，请在预览框中全选后手动复制'; } }
/**
 * 下载与预览同一份 TOML，不覆盖其他编辑器设置。
 * @returns {void}
 */
function download() {
  /**
   * 下载配置片段的临时对象地址。
   * @type {string}
   */ const url = URL.createObjectURL(new Blob([exportToml(store.bindings)], { type: 'application/toml;charset=utf-8' }));
  /**
   * 浏览器原生下载链接。
   * @type {HTMLAnchorElement}
   */ const link = document.createElement('a'); link.href = url; link.download = 'helix-keys.toml'; link.click();
  window.setTimeout(/**
   * 释放下载地址。
   * @returns {void} 释放下载地址。
   */ () => URL.revokeObjectURL(url), 1000); store.settingsMessage = '已发起下载：helix-keys.toml';
}
</script>
<template>
  <BaseDialog :open="Boolean(store.modal)" :title="store.modal === 'settings' ? '键位设置' : store.modal === 'export' ? '导出键位' : '帮助'" @close="store.modal = ''">
    <SettingsPanel v-if="store.modal === 'settings'" />
    <template v-else-if="store.modal === 'export'"><div class="export-warning"><strong>这是键位片段，不是整个 config.toml。</strong><p>先备份，再合并到 <code>~/.config/helix/config.toml</code> 对应表；保留其他 editor/theme 设置，不要重复表头。</p><p>片段覆盖全部三模式默认叶绑定以及自定义项。移走 / 删除的旧默认键显式设为 no_op，避免原生编辑器继续把旧键当作别名。未改动的其他别名仍有效。</p><p>默认 sticky 前缀属性由 Helix 原配置合并保留；TOML 不能把 sticky 属性迁移到新前缀。更换该类前缀时，这里只承诺键序列与命令映射，不冒充原生 sticky 菜单。Picker / prompt 专属键位不在此编辑模式配置中。</p></div><label class="export-label" for="export-preview">helix-keys.toml <span>UTF-8 · TOML</span></label><textarea id="export-preview" class="export-preview scroll-section" :value="exportToml(store.bindings)" readonly spellcheck="false" /><div class="modal-footer"><a class="text-button" href="https://docs.helix-editor.com/remapping.html" target="_blank" rel="noreferrer">官方键位文档 ↗</a><span role="status">{{ store.settingsMessage }}</span><BaseButton variant="secondary" @click="copy">复制配置</BaseButton><BaseButton variant="primary" @click="download">下载片段</BaseButton></div></template>
    <div v-else class="about-content"><h3>练习</h3><p>在编辑区输入或点按屏幕按键。Tab 切换网页焦点；浏览器拦截的组合键可用屏幕按钮。参数需自行填写，错误操作会保留；步骤和目标状态都匹配才算完成。</p><h3>学习范围</h3><p>速查支持默认键位、前缀与命令搜索。文章回忆与目录自测独立记录。窗口、buffer、LSP、调试器、文件系统和 shell 仅供知识学习，需在原生 Helix 中执行。</p><h3>设置与保存</h3><p>进度自动保存在本地，旧记录自动迁移。设置可增删键位、改键和前缀；导出 TOML 仅含键位片段，不覆盖 theme/editor 等设置。</p><h3>参考</h3><p><a href="https://docs.helix-editor.com/keymap.html" target="_blank" rel="noreferrer">官方键位表 ↗</a> · <a href="https://docs.helix-editor.com/remapping.html" target="_blank" rel="noreferrer">键位重映射 ↗</a></p><BaseButton variant="primary" @click="store.modal = ''">关闭</BaseButton></div>
  </BaseDialog>
</template>
