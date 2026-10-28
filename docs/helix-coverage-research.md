# Helix 全量键位与命令覆盖研究

研究日期：2026-10-28。保留 `docs/reference-research.md` 原报告；本报告不将旧应用的 11 课 / 19 操作描述为全量实现。

## 固定版本与权威来源

应用目录固定为 **Helix 25.07.1**，不是浮动 master。所有网页读取均使用 BrowserOS neo；源代码取自 GitHub 页面 textarea 或由该页 Raw 链接进入的完整正文。

- [默认键位 default.rs](https://github.com/helix-editor/helix/blob/25.07.1/helix-term/src/keymap/default.rs)：所有 normal/select/insert 叶子与前缀。
- [静态命令 commands.rs](https://github.com/helix-editor/helix/blob/25.07.1/helix-term/src/commands.rs)：`static_commands!` 注册名、英文说明、参数交互。
- [冒号命令 typed.rs](https://github.com/helix-editor/helix/blob/25.07.1/helix-term/src/commands/typed.rs)：`TYPABLE_COMMAND_LIST` 正式名称、别名、说明、参数数量。
- [键图 keymap.rs](https://github.com/helix-editor/helix/blob/25.07.1/helix-term/src/keymap.rs)：递归合并与 sticky 语义。
- [输入解析 input.rs](https://github.com/helix-editor/helix/blob/25.07.1/helix-view/src/input.rs)：修饰符、特殊键、规范化。
- [在线 Keymap 文档](https://docs.helix-editor.com/keymap.html)：辅助阅读，未标注发布版本，不能覆盖固定版本源码。2026-10-28 提取的文档静态命令名没有发现不在本版注册表中的名称；这不等于逐项证明在线文档与本版行为完全相同。

前四份快照 SHA-256 记录在 `CATALOG_META.sources`。原始源码保存在 `docs/research/helix-25.07.1-*.rs`，属于上游来源证据，不是本项目 Rust 实现。

上游 Helix 项目及其贡献者的这些源文件采用 [Mozilla Public License 2.0](https://github.com/helix-editor/helix/blob/25.07.1/LICENSE)。完整原版许可已通过 neo 获取并保留为 `docs/research/HELIX-LICENSE`；原始源文件未为本项目改写。生成目录中的命令说明取自这些源码，来源与版本保持可追溯。

## 精确覆盖数量

| 项目 | 数量 |
| --- | ---: |
| normal 叶子（别名展开） | 322 |
| select 叶子（继承与覆盖后） | 322 |
| insert 叶子 | 27 |
| 叶子总计 | **671** |
| 多键序列叶子 | 410 |
| 前缀节点（按模式分别计算） | 26 |
| 静态命令注册名 | **305** |
| 默认绑定涉及的不同静态命令 | 261 |
| 无默认绑定的静态命令 | **44** |
| 冒号命令正式名 | **89** |
| 冒号命令别名 | 69 |
| 冒号命令可识别名总数 | 158 |
| 默认键图内宏向量 / 冒号命令叶子 | 0 / 0 |

别名各算一个可输入路径，不按不同命令去重。normal 与 select 各有 13 个前缀：`g`、`m`、`[`、`]`、`C-w`、`C-w n`、`space`、`space G`、`space G s`、`space w`、`space w n`、`z`、`Z`。insert 没有前缀节点。

## 数据接口与边界

- `src/catalog.js`：导出 `DEFAULT_KEYMAP`、`PREFIX_NODES`、`COMMANDS`、`TYPABLE_COMMANDS`、`CATALOG_META`、`CATALOG_VERSION`、`CATALOG_SOURCES`。
- `docs/research/helix-25.07.1-catalog.json`：同内容的机器可读研究数据。
- 每个绑定含 `mode`、`key`、`keys`、`command`、官方 `label/description`、中文 `group`、原始 `sourceGroup`、`prefix`、`sticky`。`keys` 才是无歧义的逐键数组；`key` 是以空格连接的展示文本，`space` 是一个键，不能拆成字母。原始标点与 `A-minus` 保留。
- `command` 数据模型允许字符串或命令数组；本版默认源码恰好全部为静态单命令。用户自定义宏向量不能因此被当成前缀或冒号字符串。
- `input` 明确区分 find/till 后续字符、寄存器、文本对象、surround（替换为两步）、双字符跳转标签、正则、shell、冒号提示符。它们不是缺失的默认键图叶子，也不能把 `m i` 当成已经完成文本对象操作。
- 参数标注是上述交互的源码证据，不声称建模所有 picker、LSP、DAP 的后续界面。官方英文说明原样保留；`src/catalog-zh.js` 另导出 `COMMAND_ZH`，包含全部 **394** 个命令的中文学习含义（305 个静态键名、89 个带 `:` 的冒号命令名）。中文不是上游官方译文。`goto_prev_tabstop` 的官方说明误写 next，中文按实际函数的 Backward 分支译为“上一个”。
- 无默认绑定的 44 个命令仍暴露在 COMMANDS；可供搜索、定制和语义记忆训练。命令库覆盖、快捷键回忆与真实状态编辑挑战必须分开表述。
- 数字计数不是默认键表中的数字叶子；不能给 671 数量再加上 0–9，也不能把 `3 w` 当作已定义的多键绑定。计数行为属于编辑器输入分派。
- 此范围不包括 picker/prompt 专用键表、任意文本输入字符的无限集合、运行时 Tree-sitter 查询目录、所有语言服务器行为或完整编辑器模拟。

### 其他界面键位与在线文档差异

在线文档快照 `docs/research/helix-keymap-docs-2026-10-28.json` 完整保存 19 张表，包括 Picker、Prompt、Popup、Completion Menu 和 Signature-help Popup。这些界面交互不属于三模式 `default.rs` 叶子，文档标注当前不支持重映射，不计入 671。

其中 Picker 表有 12 行动作（含多个按键别名），Prompt 表有 20 行动作；此外文档说明 prompt 键在 picker 中也有效，冲突时以 picker 为准。Popup 有 2 行滚动动作，Completion Menu 有 4 行，Signature-help Popup 有 2 行。这些参考资料已保存，但应用三模式键库不能宣称已覆盖其专用交互模拟或允许导出其重映射。

确实观察到在线说明与固定源码的差异：insert Up/Down 文档写 `move_line_up/down`，本版源码为 `move_visual_line_up/down`；select 文档说 `vgl` 扩展到行尾，而本版 select 覆盖没有修改 `g l`，它仍继承 `goto_line_end`。导出及题库以固定源码为准，不用浮动文档改写这些叶子。

## select、别名与导出关键语义

源码先 `normal.clone()`，再递归合并 select 的 **32** 个覆盖叶子，其余 **290** 个继承不变；没有删除。特别是 select 的 `g g` → `extend_to_file_start`、`g |` → `extend_to_column`，但 `g h` 仍继承 `goto_line_start`。不能用规则把所有 `goto_*` 都改成猜测的 `extend_*`。

`Z` 与 `space G` 为内置 sticky 前缀；`space G s` 自身不声明 sticky，但位于 sticky 上下文内。`KeyTrieNode` 的 TOML 反序列化只接收键到节点的映射，没有 `sticky=true` 配置项。覆盖同一内置前缀的叶子经递归合并会保留内置 sticky；将其移到新路径不能凭空导出 sticky 属性。

自定义配置与默认值合并：删除定制项只恢复默认，不等于禁用内置键；禁用应显式映射 `no_op`。前缀路径可用 `[keys.normal."C-w"]`，叶子键独立引用；不得把 `"C-w h"` 作为单个键写入根表。

输入解析接受 `S/A/C` 与 `Meta/Cmd/Win`（后三者为同一 SUPER 修饰符），不接受 `D`。同一修饰符重复报错；ASCII 小写带 Shift 规范化为大写并移除 Shift，例如 `C-S-r` 与 `C-R` 相同。修饰符顺序不影响语义。`-` 可单独使用，带修饰符必须 `A-minus` 而非 `A--`；`lt/gt` 是 `<`/`>` 的别名。函数键范围 F1–F24。实际终端可能无法区分部分按键；`tab` 与 `C-i` 是源码两个键事件条目，不因此删掉别名。

## 已执行的独立数据检查

`docs/research/helix-25.07.1-comparison.json` 保存检查结果与代表项。首次递归解析宏语法得到键图后，另用独立逐行缩进解析重建 normal、select 覆盖和 insert；**全部 671 行逐项相同**。同时检查：模式+键路径唯一、所有叶子均为已注册命令、静态注册表全部消耗无未解析残余、158 个冒号名称/别名唯一、sticky 节点与源码一致。代表项包括 select 继承 `g h`、select 覆盖 `g g/g |/esc`、`A-minus`、`space w n C-v`、`space G s f`、insert `S-backspace`。

这些是源码抽取/对照检查，不是应用测试、浏览器交互或真实 hx 行为实验。集成应用的构建、测试与新版浏览器 QA 尚由主代理安排，未在此报告中宣称通过。

### 抽取可复现步骤

1. 在 neo 打开上述固定 tag 页面；短文件读取完整 textarea，长文件通过真实 Raw 链接读取完整文本，不使用虚拟滚动代码区的局部 DOM。保存原始字节并计算 SHA-256。
2. 去除 `default.rs` 行注释；按字符串、`=>`、标识符、花括号、方括号、逗号和别名 `|` 分词。递归解析 `keymap!`，展开别名，保留节点名称与 sticky 标志；深复制 normal 后按 `merge` 的规则应用 select 覆盖。
3. 从 `static_commands!` 提取每一个名称/说明对，检查宏体无未消费条目；从 `TYPABLE_COMMAND_LIST` 提取正式名、aliases、doc、positionals，处理 Rust 字符串的续行。以注册名连接每个叶子的官方说明。
4. 展平为模式+键数组；将前缀单独输出。中文分组与输入参数说明为明确附加层，不参与官方键路径生成；中文命令含义保存在独立模块，检查其键集与 305+89 注册名完全相同。
5. 使用与递归分词器独立的逐行缩进解析器重新抽取三个源码段；按键路径比较完整 normal、normal+select 覆盖、insert 映射，保存 `comparison.json` 的全部数量与代表项。

## 本机 hx 可用性与架构决定

实际执行 `hx --version` 得到 `helix 25.07.1 (a05c151b)`；`hx --health` 显示已安装运行时，路径为 `/Users/wx/.local/share/mise/installs/helix/25.07.1/helix-25.07.1-aarch64-macos/runtime`，系统剪贴板为 pbpaste/pbcopy。Rust、C/C++、Swift 等语言服务器可用，许多其他 LSP、DAP 和格式化器未安装。`hx --help` 提供 tutor、health、config、日志、文件与分屏入口，没有公开的机器可读命令/键图导出参数。

最终获批架构为静态全量学习：应用运行时不启动持久 PTY、hx 交互后端或新服务，不实现完整编辑器克隆。源码目录用于权威全集。本机 hx 除提供版本与环境证据外，也按明确授权用于一次性隔离临时 PTY 验证配置接受、宏数组、带参数命令、重映射禁用与实际编辑边界；验证进程及临时文件随检查清理，具体结果见 `comprehensive-qa.md`。
