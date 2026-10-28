export const ARTICLE = {
  title: "【推荐】后现代风格文本编辑器-Helix",
  author: "Tmacy",
  url: "https://www.cnblogs.com/tmacy/p/17916523.html",
};

// Stable lesson IDs preserve saved progress; chapter order follows the article.
export const ARTICLE_CHAPTERS = [
  { id: "install", title: "Helix 安装", anchor: "helix-安装", lessons: [] },
  { id: "basics", title: "Helix 基本操作", anchor: "helix-基本操作", lessons: [] },
  { id: "move", title: "普通模式 · 移动", anchor: "移动", lessons: ["right", "left", "vertical", "words", "adv-count-find", "adv-till"] },
  { id: "modify", title: "普通模式 · 修改", anchor: "修改", lessons: ["delete-char", "undo", "combine", "adv-replace-char", "adv-indent", "adv-redo", "adv-macro"] },
  { id: "shell", title: "普通模式 · Shell命令", anchor: "shell命令", lessons: [] },
  { id: "selection", title: "普通模式 · 选择操作", anchor: "选择操作", lessons: ["select", "delete-word", "adv-regex-rename", "adv-split-filter", "adv-remove-filter", "adv-split-lines", "adv-line-delete", "adv-join", "adv-primary", "adv-rotate-content"] },
  { id: "search", title: "普通模式 · 搜索", anchor: "搜索", lessons: ["adv-search-cycle"] },
  { id: "view", title: "轻模式 · 视图模式", anchor: "视图模式", lessons: [] },
  { id: "goto", title: "轻模式 · 跳转模式", anchor: "跳转模式", lessons: [] },
  { id: "window", title: "轻模式 · 窗口模式", anchor: "窗口模式", lessons: [] },
  { id: "space", title: "轻模式 · 空格模式", anchor: "空格模式", lessons: [] },
  { id: "insert", title: "插入模式", anchor: "插入模式", lessons: ["insert", "adv-multi-insert"] },
  { id: "select-mode", title: "选择模式", anchor: "选择模式", lessons: ["cancel", "adv-search-add"] },
  { id: "picker", title: "选择器", anchor: "选择器", lessons: [] },
  { id: "prompt", title: "提示", anchor: "提示", lessons: [] },
  { id: "surround", title: "特色操作 · 环绕功能", anchor: "环绕功能", lessons: ["adv-surround-replace", "adv-article-surround-batch", "adv-article-surround-nested"] },
  { id: "textobject", title: "特色操作 · 文本对象", anchor: "使用文本对象进行文本选择和操作", lessons: ["adv-inner-change", "adv-around-delete", "adv-nested-object"] },
  { id: "unimpaired", title: "特色操作 · Unimpaired", anchor: "unimpaired", lessons: [] },
  { id: "syntax", title: "特色操作 · 语法感知动作", anchor: "语法感知动作的移动", lessons: [] },
  { id: "registers", title: "寄存器", anchor: "寄存器", lessons: ["adv-register", "adv-replace-yank"] },
];

export function articleSource(chapterId) {
  const chapter = ARTICLE_CHAPTERS.find((chapter) => chapter.id === chapterId);
  return { ...ARTICLE, section: chapter.title, url: `${ARTICLE.url}#${encodeURIComponent(chapter.anchor)}` };
}

const command = (chapter, name, description, alternatives, explanation) => ({
  id: `article:${chapter}-${name}`,
  type: "command",
  command: name,
  description,
  options: [name, ...alternatives.split(" ")].sort().map((name) => ({ name })),
  explanation,
  source: articleSource(chapter),
});
const concept = (chapter, id, description, answer, alternatives, explanation) => ({
  id: `article:${chapter}-${id}`,
  type: "concept",
  description,
  answer,
  options: [answer, ...alternatives].sort().map((name) => ({ name })),
  explanation,
  source: articleSource(chapter),
});

// Scenarios are authored from the linked article, not sampled from the full catalog.
// Command spelling and execution semantics follow the app's pinned Helix version.
export const ARTICLE_QUESTIONS = [
  concept("install", "macos", "按文章在 macOS 上用 Homebrew 安装 Helix，应执行哪条命令？", "brew install helix", ["brew install hx-tutor", "hx --grammar build", "cargo install helix-runtime"], "文章的 macOS / Homebrew Core 小节使用 brew install helix。"),
  concept("install", "health", "安装完成后，想检查 Helix 的运行环境和语言支持，应执行哪条命令？", "hx --health", ["hx --tutor", "hx --grammar fetch", "hx --grammar build"], "--health 检查健康状态；grammar fetch / build 分别获取、编译语法库。"),
  concept("basics", "tutor", "已经打开 Helix，想进入内置交互式教程，应输入哪个冒号命令？", ":tutor", [":totur", ":tutorial", ":help-tutor"], "正确拼写是 :tutor；文章中的 :totur 是笔误。终端也可运行 hx --tutor。"),
  concept("basics", "selection-first", "要删除一个词，文章用哪组操作说明 Helix 与 Vim 的核心区别？", "先 w 选择，再 d 删除", ["先 d，再 w 指定范围", "必须先进入插入模式", "先 y 复制，再 u 撤销"], "Helix 先选择、后操作。w 的选区可能包含词后空白，精确边界要观察实际选区。"),
  command("move", "move_next_word_start", "普通模式中，想按单词向前移动到下一个词首，而不是按空白分隔的 WORD 移动，选哪个命令？", "move_next_long_word_start move_prev_word_start move_next_word_end", "默认 w 按 word 移动；W 使用按空白分隔的 WORD 边界。"),
  command("move", "find_next_char", "希望从当前位置选到下一个逗号，并把逗号本身包含在选区内，应使用哪个命令？", "find_till_char find_prev_char move_next_word_end", "f 包含目标字符；t 停在目标之前。文章强调字符查找不限于当前行。"),
  command("move", "find_till_char", "要删除 key:value 中的 key，但保留冒号，先选到冒号之前应使用哪个命令？", "find_next_char find_prev_char select_all", "普通模式按 t，再输入 :；确认选区不包含冒号后执行 d。"),
  command("modify", "change_selection", "已经选中 old，希望删除它并立即输入 new，应选哪个命令？", "delete_selection replace replace_with_yanked", "c 删除当前选区并进入插入模式；r 用同一个字符逐字符替换。"),
  command("modify", "replace", "已选中 123，希望一次操作将它改成 ###，但不进入插入模式，应选哪个命令？", "change_selection replace_with_yanked insert_mode", "r 接收一个字符；三个被选中的字符分别替换为 #。"),
  command("modify", "undo", "刚才的删除有误，想恢复修改前的文字与选区，应使用哪个命令？", "redo earlier later", "默认 u 撤销最近编辑，U 重做；移动本身不等于一次文本编辑。"),
  command("modify", "record_macro", "需要反复执行一段编辑操作，第一步要开始录制宏，选哪个命令？", "replay_macro yank repeat_last_motion", "Q 开始 / 停止宏录制，q 重放；宏保存操作而非预先算好的文本结果。"),
  command("shell", "shell_pipe", "要把选区作为 shell 命令输入，再用命令的标准输出替换选区，应该选哪个命令？", "shell_pipe_to shell_insert_output shell_keep_pipe", "默认 |；Alt-| 忽略输出，! 在选区前插入输出，$ 按退出状态筛选。网页只考知识，不执行 shell。"),
  command("selection", "select_regex", "已经全选文档，想把所有 cat 变成独立选区，再统一改名，应使用哪个命令？", "split_selection keep_selections search", "先 % 全选，再 s 输入 cat 并提交。s 选择匹配本身，S 按匹配的分隔符切分。"),
  command("selection", "split_selection", "已选中 apple,banana,pear，想以逗号为分隔符切成三个选区，逗号不进入新选区，应使用哪个命令？", "select_regex keep_selections merge_selections", "默认 S 后输入逗号；分隔符仍在文档中，不属于拆出的选区。"),
  command("selection", "keep_selections", "已有多个单词选区，只想保留以 b 开头的选区，不删除任何文字，应使用哪个命令？", "remove_selections delete_selection select_regex", "K 按正则保留匹配选区；Alt-K 排除匹配选区。它们改变选择集合，不修改文字。"),
  command("selection", "keep_primary_selection", "已经有多个选区，现在只保留主选区，丢弃其余选择但不删文字，应使用哪个命令？", "collapse_selection remove_primary_selection merge_selections", "默认逗号只保留主选区；分号折叠各选区，不会把多个选区减成一个。"),
  command("search", "search", "想从当前位置向文档后方搜索正则表达式 blue，应使用哪个命令？", "rsearch select_regex search_selection", "默认 / 向前（文档后方）搜索，? 反向搜索。不要将中文的“向前 / 向后”与方向混淆。"),
  command("search", "search_next", "已经搜索过 blue，想复用表达式选择下一个匹配，而不是重新输入正则，应使用哪个命令？", "search_prev search select_regex", "普通模式 n 选择下一匹配，N 选择上一匹配。"),
  concept("view", "sticky", "只想持续滚动视图、不改变选择，并在操作后留在视图模式，默认应按哪个键进入？", "Z", ["z", "v", "g"], "z 进入一次性视图模式；Z 保持视图模式，Esc 退出。"),
  command("goto", "goto_definition", "光标位于一个符号上，想借助语言服务器跳到其定义，应选哪个命令？", "goto_type_definition goto_reference goto_implementation", "默认 g d；此操作依赖 LSP，不在网页编辑器中伪造执行。"),
  command("window", "vsplit", "希望在当前窗口右侧纵向分屏，应使用哪个命令？", "hsplit rotate_view wclose", "默认 C-w v；C-w s 是下方水平分屏。本题为原生窗口操作知识。"),
  command("space", "file_picker", "想打开文件选择器查找并打开项目文件，应使用哪个命令？", "buffer_picker symbol_picker jumplist_picker", "默认 Space f；Space b 是已打开缓冲区列表。"),
  command("space", "global_search", "不是只搜索当前缓冲区，而是搜索工程目录中的文本，应使用哪个命令？", "search rsearch workspace_symbol_picker", "默认 Space / 全局搜索；搜索结果可通过 Space ' 返回。"),
  command("insert", "normal_mode", "正在插入模式输入文字，现在要返回普通模式执行编辑命令，应选哪个命令？", "select_mode insert_mode append_mode", "默认 Esc；若已自定义键位，以当前配置为准。"),
  command("insert", "delete_word_backward", "正在插入模式，想删除插入点之前的一个词，而不是仅删一个字符，应选哪个命令？", "delete_char_backward delete_word_forward kill_to_line_end", "默认 C-w / Alt-Backspace；这是插入模式绑定，不是普通模式窗口前缀。"),
  concept("select-mode", "extend", "普通模式按 v 后再按 l，选择应怎样变化？", "固定选区一端，向右扩展另一端", ["删除右边字符", "只移动单字符选区，不保留原起点", "进入插入模式输入 l"], "选择模式的移动通常扩展选区；不要把普通模式与选择模式混用。文章的 vgl 示例与固定版本有差异，不据此出题。"),
  concept("picker", "background", "文件选择器中，想在后台打开当前项且不关闭选择器，应按哪个键？", "A-ret", ["ret", "esc", "C-v"], "文章写作 Alt-Enter；Helix 规范记法为 A-ret。此题不受编辑模式自定义键位影响。"),
  concept("prompt", "history", "在命令提示输入框中，想切换到上一条历史记录，应按哪组键？", "C-p 或 Up", ["C-n 或 Down", "C-u 或 Home", "C-k 或 End"], "提示框使用自己的键表；C-p / Up 选择上一条历史，C-n / Down 选择下一条。"),
  command("surround", "surround_add", "已选中 hello，希望给选区外面添加一对方括号，应先选哪个命令？", "surround_replace surround_delete select_textobject_around", "默认 m s 后输入 [；添加环绕与选择 around 文本对象不是一回事。"),
  command("surround", "surround_replace", "光标位于 (hello) 内部，希望只把圆括号换成方括号，保留 hello，应选哪个命令？", "surround_add surround_delete replace", "默认 m r，接着输入旧包围符 ( 和新包围符 [。可用计数选择外层。"),
  command("textobject", "select_textobject_inner", "要修改 call(old) 中的 old，保留两侧括号，先选取哪个文本对象命令？", "select_textobject_around surround_delete match_brackets", "m i ( 选括号内部，m a ( 则连括号一起选择。"),
  concept("textobject", "tree-sitter", "想用文本对象选择函数或类型，而不是普通括号 / 单词，文章指出需要什么支持？", "对应语言的 Tree-sitter 语法支持", ["只要有系统剪贴板即可", "必须先录制宏", "只需要将文件全选"], "函数 f、类型 t 等对象依赖 Tree-sitter；网页没有语法树运行时，不冒充实际执行。"),
  command("unimpaired", "goto_next_function", "要按语法结构跳到下一个函数，文章中的 ]f 对应哪个命令？", "goto_prev_function goto_next_class goto_next_parameter", "右方括号方向进入下一个对象，左方括号方向回到前一个；函数跳转依赖 Tree-sitter。"),
  command("unimpaired", "goto_next_diag", "语言服务器报告多个错误，想跳到下一个诊断位置，应选哪个命令？", "goto_prev_diag goto_last_diag goto_first_diag", "默认 ]d；[d 回到上一个，]D / [D 跳最后 / 第一个诊断。"),
  command("syntax", "expand_selection", "语法树里已经选中一个参数，想将选区扩展到父语法节点，应选哪个命令？", "shrink_selection select_next_sibling select_prev_sibling", "默认 Alt-o 扩展；Alt-i 缩小；Alt-n / Alt-p 选择相邻节点。"),
  concept("registers", "named-yank", "已选中一段文字，要在原生 Helix 中复制到命名寄存器 a，应输入哪个序列？", "\"ay", ["\"ap", "\"ad", "\"ac"], "双引号选择寄存器，a 是寄存器名，y 复制。网页编辑挑战用独立的“寄存器…”参数入口。"),
  concept("registers", "search-register", "文章列出的默认寄存器中，哪一个保存最后一次搜索表达式？", "/", [":", "\"", "@"], "/ 保存搜索，: 保存最后命令，双引号保存最后复制文本，@ 保存最后使用的宏。"),
  concept("registers", "black-hole", "希望丢弃写入内容、不保留到普通寄存器，应该使用哪个特殊寄存器？", "_", ["%", "+", "#"], "下划线是黑洞寄存器；+ 对应系统剪贴板，% 是当前文件名，# 是选择序号。"),
];

export function nextArticleQuestion(knowledge, currentId) {
  const start = ARTICLE_QUESTIONS.findIndex((question) => question.id === currentId);
  for (let offset = 1; offset <= ARTICLE_QUESTIONS.length; offset++) {
    const question = ARTICLE_QUESTIONS[(start + offset) % ARTICLE_QUESTIONS.length];
    if (!knowledge.includes(question.id)) return question;
  }
  return ARTICLE_QUESTIONS[(start + 1) % ARTICLE_QUESTIONS.length];
}
