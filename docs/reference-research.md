# 参考研究与 Helix 导出依据

研究日期：2026-10-27。网站访问仅使用 BrowserOS neo MCP；未使用 HTTP 抓取或替代浏览器。

## 练习站访问限制

- 访问 https://ltywk.github.io/wubi-practice 后，neo 快照显示 Chrome「无法访问此网站」，实际文档 URL 为 `chrome-error://chromewebdata/`。
- 改为末尾带 `/` 的地址后导航达到 30 秒超时；未观察到练习界面。错误页及最近 100 条浏览历史未提供可发现的对应 GitHub 仓库链接。
- 因此没有可证实的原站布局、学习流程或反馈交互；不能将产品设计表述为已复刻原站。课程分组、即时反馈、快捷键提示属于本项目建议，而非参考站观察。

## 已读取的官方依据

1. [Key remapping](https://docs.helix-editor.com/remapping.html)：neo 页面正文及示例。
2. [Keymap](https://docs.helix-editor.com/keymap.html)：neo `read('main')`，包含正常、插入、选择模式说明。
3. [官方命令源码](https://github.com/helix-editor/helix/blob/master/helix-term/src/commands.rs)：从 remapping 页真实链接发现，neo 内容搜索核对 `extend_*` 命令名。源码为 master，未将其宣称为特定已发布版本。

## 导出规则

- 使用 TOML `[keys.normal]`、`[keys.insert]`、`[keys.select]`，每个同名节最多一次。
- 多键序列使用嵌套表，例如 `[keys.normal.g]` 下 `a = "code_action"`，或 `[keys.normal]` 下 `g = { a = "code_action" }`。不得把 `"g.a"` 或 `"g a"` 当作单个按键字符串输出；TOML 点路径与字面按键不同。
- 修饰符为 `C-`、`S-`、`A-`，可组合，例如 `C-S-esc`。Super 支持 `Meta-`、`Cmd-`、`Win-` 同义前缀，但需终端增强键盘协议支持。
- 特殊键：`backspace space ret left right up down home end pageup pagedown tab del ins null esc`。
- 文档明确允许 `?`、`!`、`-` 等字面标点。带修饰符的减号必须写为 `A-minus`，`A--` 不接受。
- 禁用键的真实命令是 **`no_op`**，不是 `no-op`。
- 自定义键配置不是完整默认键位清单。界面需明确冲突检测只覆盖本训练命令集，不代表与全部 Helix 内置绑定无冲突。保留旧默认别名或显式禁用旧键必须说明，不应暗示两者等价。

## 命令核对

| 默认键 | normal 命令 | select 中移动应使用的命令 |
| --- | --- | --- |
| h / l | `move_char_left` / `move_char_right` | `extend_char_left` / `extend_char_right` |
| j / k | `move_visual_line_down` / `move_visual_line_up` | `extend_visual_line_down` / `extend_visual_line_up` |
| w / b | `move_next_word_start` / `move_prev_word_start` | `extend_next_word_start` / `extend_prev_word_start` |
| i / a | `insert_mode` / `append_mode` | — |
| v | `select_mode` | — |
| d | `delete_selection` | — |
| u | `undo` | — |
| x | `extend_line_below` | — |
| X | `extend_to_line_bounds` | — |

- `x`：选择当前行，已选择时延伸至下一行；`X`：扩展到行边界。两者不可混淆。
- 插入模式 Escape 对应 `normal_mode`；文档说明其他模式可按 Escape 返回 normal。
- select 模式文档原文：移动会扩展选区，而不是替换选区；goto 移动也转为扩展。因此导出 select 不能直接复制 normal 的 `move_*` 命令。
- `w/b` 的官方键表描述是下一个/上一个词首。本次未执行真实 Helix 逐字符实验，不声称已经验证模拟器的所有词边界、标点或跨行选区细节。

## 保留的浏览器证据

neo 会话名：`helix reference research`；标签组 ID：`CD8A2DE1705B7C6A63054E83FDFFC986`。参考站错误页、两份官方文档及命令源码标签均保留，供继续查看。此阶段未验证应用、构建或测试。
