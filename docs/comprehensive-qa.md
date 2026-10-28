# 全量学习扩展 QA

日期：2026-10-28。仅记录实际执行的检查；未完成的集成浏览器检查不算通过。

## 数据来源与覆盖检查

见 `helix-coverage-research.md` 及 `research/helix-25.07.1-comparison.json`：完整 671 叶子（normal 322 / select 322 / insert 27）、26 前缀、305 静态命令、89 冒号命令及 69 别名。独立递归语法解析与逐行缩进解析得到的所有叶子逐项一致；394 个中文学习含义与注册名集合完全一致。

## 原生 Helix 配置接受检查：通过

真实版本：`helix 25.07.1 (a05c151b)`。检查当前 `src/bindings.js` 导出的：

1. `exportToml(DEFAULT_BINDINGS)`：完整默认键位，17,620 字符。
2. `exportToml(addBinding(DEFAULT_BINDINGS, 'normal', ':write', 'F6'))`：添加功能键上的冒号命令，17,636 字符。

分别写入独立临时配置，通过 30×120 PTY 运行真实 `hx -c <config> <scratch>`；观察到编辑器渲染 scratch/NORMAL 后输入 `:quit!`。两次退出码均为 **0**，捕获输出未出现 error / invalid / failed。完整输出证据保存于 `research/helix-native-export-smoke.json`。临时文件与进程已清理，未启动持久编辑后端。

此检查证明配置被原生编辑器接受，不代表逐条执行了 671 个命令；F6 的 `:write` 本身没有触发，避免写入操作。

## 只读源码审查反馈

对 `src/bindings.js` 快照 538F 的已通知实现者事项：

- `actionsFor` 的 `decodeURIComponent` 位于 `validateBindings` 内部捕获之外，畸形导入键如 `normal.custom:%ZZ~1` 可抛出 URIError。后续修复状态以最终集成检查为准。
- 当时 `addBinding` 仅接受注册名称字符串；命令数组及带参数冒号命令尚不在该 API 中，已告知实现者对照用户完整导出需求处理。
- 当时 `A--` 被作为友好输入规范化为 `A-minus`；Helix 原生语法拒绝 `A--`。不能将友好别名接受规则描述为原生语法。
- 迁移代码保留旧版自定义 `normal.right='g h'` 并解除冲突的内置叶子；尚须浏览器确认冲突提示、进度与题目均正确。

## 原生执行与真实下载

- `research/helix-native-command-execution.json`：独立临时 PTY 实际执行 F6 → `["move_char_right","delete_selection"]`，`abc` 变为 `ac\n`；F7 → `:write <临时目标>`，目标为 `abc\n`，源文件保持 `abc`。保存时 Helix 添加末尾换行。
- 将 `l` 移到 F8：导出 `l = "no_op"`。真实编辑中 `l d` 得到 `bc\n`，F8 后 `d` 得到 `ac\n`，证明旧键确实禁用、新键实际生效。
- `research/helix-terminal-delete-oracle.json`：原生 `abc` 最后字符删除后插入 `!` 得到 `ab!\n`，确认虚拟 EOF 的位置语义。两个较早的 `helix-eof-delete*oracle.json` 多提示输入尝试不具结论性；没有把它们当作筛选行为证据。
- 新版网页实际点击下载 `/Users/wx/Downloads/helix-keys (1).toml`（17,814 字节）。检查含 F8、F6 数组、F7 带参数命令、`l = "no_op"`，以及彼此不同的 `A-c` / `A-C`。真实 hx 加载该下载文件、渲染并退出 0；证据 `research/helix-browser-download-smoke.json`。此轮未触发下载文件中的 F7。

## 集成浏览器：新版实际执行

地址 `http://localhost:5174/`，独立 BrowserOS neo 页 30。仅在 URL-ready 后检查，最后三项修复回归在实现者冻结源码后执行。

| 检查 | 实际结果 |
| --- | --- |
| 全量可见性 | 34 个真实编辑课、671 个默认叶绑定、394 个命令知识题分别显示；不是把目录题冒充编辑课。 |
| 分页与过滤 | 671 项第 1/28 页切到第 2/28 页；normal + 跳转得到 23 项。切命令页后隐藏模式/组筛选，不残留过滤，恢复 394 项、1/17 页。 |
| 搜索 | 中文“寄存器”得到 8 项；原始 `move_prev_sub_word_end` 得到 1 项；`:write` 得到 10 项；`space d` 找到 normal/select 下大小写不同的 d/D 路径。搜索本身不区分大小写，展示的键位仍区分。 |
| 知识与编辑隔离 | `:write` 题选错 `:goto` 不计进度，答对只写 knowledge。无默认绑定的 `move_prev_sub_word_end` 能进入专属知识题并答对。编辑完成数不因这些答题而增加。 |
| 自定义回忆 | 默认 l 改为 F8 后，实际编辑提示使用 F8 而非未修改的 right 别名；回忆题输入 l 判错，F8 判对。 |
| 完整编辑参数 | 正则输入 zzz 不生成选区、不推进；正确 cat + change + 输入 dog + Escape 得到 `dog + dog = dog`，完成真实编辑课。 |
| 修复回归：完整行 | 第 27 课 x、d 得到 `first\nlast`，完成。 |
| 修复回归：筛选删除 | 第 14 课 `%`、s 输入 `\w+`、Alt-K 输入 `^keep$`、d 得到 `keep  keep`，完成，终端 EOF 游标可表示。 |
| 修复回归：搜索扩选 | 第 19 课 /one、v、n、v、Alt-反引号得到 `x ONE ONE one`，完成。 |
| 自定义高级导出 | 设置接受 F6 命令数组、F7 带路径参数 `:write`、F8 单命令；保存、真实下载与 hx 接受均通过。 |
| 旧版 19 项迁移 | 精确 v1 夹具 `normal.right='g h'` 与 `completed=['right']` 保留；显示 1/34 和迁移冲突提示；自定义 g h 保留，内置 goto_line_start 的冲突 g h 解除但 home 别名保留。select 的 normal_mode 为 v、exit_select_mode 为 esc。 |
| 设置可达性 | 手机对话框宽 352、高约 768，位于 390×844 视口内，overflow-y:auto；搜索输入过滤至 2 个右移项；Tab 可导航，Escape 关闭。 |
| 手机布局 | 390px 视口文档 scrollWidth=390，无水平溢出。 |

截图：`research/expanded-desktop.png`（新版真实搜索多选完成状态）、`research/expanded-mobile.png`（390px 全量目录与 671/394 指标）。不是旧应用截图。

## 独立引擎回归与检查边界

`tests/advanced.test.js` 独立写明实际文本、选区、寄存器、撤销/重做、宏与计数等预期；不是把课程步骤运行结果当作预期。最初 33 项实际运行全通过；随后增加前导空行、逆向整行、EOF 删除后插入、有效但错误正则实际修改四项，最终整套测试由主实现者统一执行。

本轮没有在浏览器手工逐个执行 671 个叶绑定，也没有声称原生执行所有 394 命令；全量语法/目录覆盖依据源码比较及测试，浏览器抽查真实流程。宏、包围、计数的独立行为覆盖在引擎测试，其他浏览器通关记录见实现者 QA 报告。Picker/prompt 等辅助界面 40 个文档行不属于三模式 671 可配置叶子，来源与边界见覆盖研究。

夹具仅改动 localhost:5174 的 `helix-lab-v1`。结束后已恢复最初值 null、刷新确认 0/34，并取消手机仿真（恢复 1920px）；未清除其他存储键或接触用户其他页面。
