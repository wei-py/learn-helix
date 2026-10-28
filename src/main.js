import "./style.css";
import {
  ACTIONS,
  MODES,
  DEFAULT_BINDINGS,
  bindingId,
  validateBindings,
  parseSequence,
  keyFromEvent,
  displayKey,
  exportToml,
  actionForCommand,
  addBinding,
} from "./bindings.js";
import {
  CATEGORIES,
  LESSONS,
  createState,
  applyAction,
  insertText,
  backspace,
  selection,
  goalFor,
  matchesGoal,
  loadSaved,
  saveState,
} from "./engine.js";
import {
  libraryMarkup,
  recallMarkup,
  recallQuestion,
  settingsMarkup,
  commandName,
  settingsRows,
  bindingRow,
} from "./catalog-ui.js";
import {
  ADVANCED_INTERACTIONS,
  commandInteraction,
  supportsCommand,
} from "./advanced.js";
import { createScrollManager } from "./scroll.js";
import { createNavigation } from "./navigation.js";
import { mountVirtualList } from "./virtual-list.js";
import { resolvePracticeInput, updateTextProgress } from "./practice-input.js";
import { lessonAnswerMarkup } from "./lesson-answer.js";
import { ARTICLE, ARTICLE_QUESTIONS, nextArticleQuestion } from "./article.js";

const root = document.querySelector("#app");
const scrollRoot = document.getElementById("scroll-root");
const scroll = createScrollManager({ root: scrollRoot, body: document.body });
let disposeVirtualList = () => {};
const virtualHeights = new Map();
let navigation;
let libraryEntry = null;
let overlayTrigger = null;
let drawerCleanup = () => {};
const narrow = matchMedia("(max-width: 760px)");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw new Error("unavailable");
    },
    setItem() {
      throw new Error("unavailable");
    },
  };
}
const saved = loadSaved(storage, validateBindings, DEFAULT_BINDINGS);
let bindings = saved.bindings;
let completed = saved.completed;
let knowledge = saved.knowledge || [];
let track = "practice";
let catalogQuery = "",
  catalogMode = "",
  catalogGroup = "",
  catalogKind = "bindings",
  catalogPage = 0;
let settingsQuery = "",
  settingsGroup = "";
let question = null,
  recallAnswer = "",
  recallRevealed = false;
let operandAction = null,
  operandCount = 1,
  countInput = "";
let category = "all";
let lessonIndex = Math.max(
  0,
  LESSONS.findIndex((l) => !completed.includes(l.id)),
);
let lesson = LESSONS[lessonIndex];
let state = createState(lesson);
let stepIndex = 0;
let typed = "";
let pending = [];
let success = false;
let feedback = {
  kind: "neutral",
  text: "点击编辑区，或使用下方按键，开始你的第一步。",
};
let notice = saved.warning || "";
let modal = null;
let draft = { ...bindings };
let settingsMode = "normal";
let settingsMessage = "";
let hintVisible = true;
let answerVisible = false;
let insertBuffer = "";
let mobileMenu = false;

const getAction = (mode, action) =>
  actionForCommand(bindings, mode, action) ||
  ACTIONS.find(
    (a) => a.mode === mode && (a.id === action || a.command === action),
  ) || { mode, id: action, command: action, label: action };
const keyOf = (mode, action) => {
  const found = actionForCommand(bindings, mode, action);
  return found ? bindings[bindingId(found)] : "";
};
function persist() {
  if (!saveState(storage, bindings, completed, knowledge))
    notice = "浏览器未允许本地存储：本次修改仅在当前页面生效。请导出键位备份。";
}
function selectedLessons() {
  return LESSONS.filter((l) => category === "all" || l.category === category);
}
function actionLabel(step) {
  return step.type === "text"
    ? `输入 ${JSON.stringify(step.text)}`
    : getAction(step.mode, step.action).label;
}
function keyBadge(value, extra = "") {
  return `<kbd class="${extra}">${escape(displayKey(value))}</kbd>`;
}
function stepKey(step) {
  return step.type === "text"
    ? `<code class="literal">${escape(step.text.replace(/ /g, "␣"))}</code>`
    : keyBadge(keyOf(step.mode, step.action));
}
function optionalInteraction(command) {
  return commandInteraction(command, true) && !commandInteraction(command);
}
function stepInstruction(step) {
  if (step.type === "text") return `输入 ${JSON.stringify(step.text)}。`;
  const action = getAction(step.mode, step.action);
  const interaction = commandInteraction(action.command, true);
  const explicitParameters =
    optionalInteraction(action.command) &&
    interaction.fields.some((field) => step.args?.[field.name] !== undefined);
  return `${explicitParameters ? `点「${action.label}：寄存器…」` : `按 ${displayKey(keyOf(step.mode, step.action))}`}，${actionLabel(step)}${step.args ? `；参数：${JSON.stringify(step.args)}（需要自己输入${explicitParameters || commandInteraction(action.command) ? "，按 Enter 执行" : ""}）` : ""}。`;
}

function editorMarkup(editorState, preview = false) {
  const ranges = editorState.selections || [
    { anchor: editorState.anchor, head: editorState.head },
  ];
  let offset = 0;
  return (
    editorState.text
      .split("\n")
      .map((line, index) => {
        const start = offset;
        offset += line.length + 1;
        const chars = (line || " ")
          .split("")
          .map((char, col) => {
            const position = start + col;
            const selected =
              editorState.mode !== "insert" &&
              ranges.some(
                (range) =>
                  position >= Math.min(range.anchor, range.head) &&
                  position <= Math.max(range.anchor, range.head),
              );
            const caret =
              editorState.mode === "insert" &&
              ranges.some((range) => position === range.head);
            return `<span class="char ${selected ? "selected" : ""} ${position === editorState.head && selected ? "head" : ""} ${caret ? "caret" : ""}">${escape(char)}</span>`;
          })
          .join("");
        const endPosition = start + line.length;
        const insertEnd =
          editorState.mode === "insert" &&
          ranges.some((range) => range.head === endPosition);
        const virtualEnd =
          editorState.mode !== "insert" &&
          endPosition === editorState.text.length &&
          ranges.some(
            (range) =>
              Math.min(range.anchor, range.head) <= endPosition &&
              Math.max(range.anchor, range.head) >= endPosition,
          );
        const endCaret =
          line.length > 0 && (insertEnd || virtualEnd)
            ? `<span class="char ${insertEnd ? "caret" : "selected head"}" aria-label="${insertEnd ? "插入点" : "文件末尾虚拟位置"}"> </span>`
            : "";
        return `<div class="code-line"><span class="line-number" aria-hidden="true">${index + 1}</span><span class="line-content">${chars}${endCaret}</span></div>`;
      })
      .join("") +
    (preview
      ? ""
      : '<div class="editor-empty" aria-hidden="true">~<br>~<br>~</div>')
  );
}
function render(focusId) {
  const pageScroll = scrollRoot.scrollTop;
  const previous = document.activeElement;
  const activeId = focusId || previous?.id;
  const inputSelection =
    previous instanceof HTMLInputElement ||
    previous instanceof HTMLTextAreaElement
      ? [previous.selectionStart, previous.selectionEnd]
      : null;
  const dialogScroll = document.getElementById("app-modal")?.scrollTop || 0;
  disposeVirtualList();
  drawerCleanup();
  const total = completed.length;
  const percent = Math.round((total / LESSONS.length) * 100);
  const list = selectedLessons();
  const currentStep = lesson.steps[stepIndex];
  const categoryData = CATEGORIES.find((c) => c.id === lesson.category);
  root.innerHTML = `
    <div class="app-shell">
      <header class="masthead">
        <a href="#practice" class="brand" data-action="home" aria-label="Helix 练习场首页"><span class="brand-name">Helix<span>练习报</span></span></a>
      </header>
      <aside class="sidebar ${mobileMenu ? "is-open" : ""}" aria-label="练习导航">
        <button class="drawer-close button small" data-action="menu" aria-label="关闭课程">关闭</button>
        <div class="index-heading"><h2>课程</h2></div>
        <nav class="category-nav" aria-label="分类">${CATEGORIES.map((c) => `<button data-category="${c.id}" class="category-button ${category === c.id ? "active" : ""}" ${category === c.id ? 'aria-current="true"' : ""}><span class="category-icon">${c.icon}</span><span>${c.label}</span><small>${c.id === "all" ? LESSONS.length : LESSONS.filter((l) => l.category === c.id).length}</small></button>`).join("")}</nav>
        <div class="sidebar-label lesson-heading">练习列表 <span>${list.length} 课</span></div>
        <nav class="lesson-list" aria-label="选择练习">${list.map((l, index) => `${index === 0 || list[index - 1].source.section !== l.source.section ? `<div class="sidebar-label">${escape(l.source.section)}</div>` : ""}<button data-lesson="${l.id}" class="lesson-link ${l.id === lesson.id ? "active" : ""}" ${l.id === lesson.id ? 'aria-current="step"' : ""}><span class="lesson-status ${completed.includes(l.id) ? "done" : ""}">${completed.includes(l.id) ? "✓" : String(LESSONS.indexOf(l) + 1).padStart(2, "0")}</span><span>${l.title}</span>${l.id === lesson.id ? '<span class="tiny-arrow">↗</span>' : ""}</button>`).join("")}</nav>
        <div class="sidebar-bottom"><div class="progress-caption"><span>进度</span><strong>${total}<span> / ${LESSONS.length}</span></strong></div><div class="progress-track"><span style="width:${percent}%"></span></div><button class="text-button muted" data-action="clear-progress">重置进度</button></div>
      </aside>
      ${mobileMenu ? '<button class="drawer-scrim" data-action="menu" aria-label="关闭课程"></button>' : ""}
      <div class="workspace">
        <header class="topbar"><div class="breadcrumb"><button class="menu-button" data-action="menu" aria-label="切换课程" aria-expanded="${mobileMenu}">☰</button><strong>${track === "practice" ? categoryData.label : track === "library" ? "目录" : "回忆"}</strong></div><div class="topbar-actions"><button class="button small" data-action="settings">键位</button><button class="button small" data-action="export">导出</button><button class="button small" data-action="about">帮助</button></div></header>
        <main id="main-content" tabindex="-1">
          <nav class="track-nav" aria-label="学习轨道"><button class="${track === "practice" ? "active" : ""}" data-action="practice">练习 <small>${completed.length}/${LESSONS.length}</small></button><button class="${track === "library" ? "active" : ""}" data-action="library">目录</button><button class="${track === "recall" ? "active" : ""}" data-action="recall-next">文章回忆 <small>${ARTICLE_QUESTIONS.filter((q) => knowledge.includes(q.id)).length}/${ARTICLE_QUESTIONS.length}</small></button></nav>
          ${notice ? `<div class="notice" role="status">${escape(notice)}<button class="text-button" data-action="dismiss-notice" aria-label="关闭提示">×</button></div>` : ""}
          ${
            track === "library"
              ? libraryMarkup({
                  bindings,
                  knowledge,
                  query: catalogQuery,
                  mode: catalogMode,
                  group: catalogGroup,
                  kind: catalogKind,
                  page: catalogPage,
                })
              : track === "recall"
                ? recallMarkup(
                    question,
                    bindings,
                    recallAnswer,
                    recallRevealed,
                    pending,
                  )
                : `<div class="practice-layout">
            <section class="practice-panel" aria-labelledby="lesson-title">
              <div class="lesson-header"><div><div class="eyebrow subtle">练习 ${String(lessonIndex + 1).padStart(2, "0")} <span>/ ${String(LESSONS.length).padStart(2, "0")}</span></div><h2 id="lesson-title">${lesson.title}</h2></div><span class="topic-chip">${categoryData.icon} ${categoryData.label}</span></div>
              <p class="lesson-description">${escape(lesson.description)}</p>
              <p class="source-note">依据 <a href="${escape(lesson.source.url)}" target="_blank" rel="noreferrer">${escape(lesson.source.section)} ↗</a> · <a href="${ARTICLE.url}" target="_blank" rel="noreferrer">原文</a></p>
              <div class="editor-chrome"><div class="editor-tab"><span class="file-dot"></span> practice.txt <span>×</span></div><span class="editor-caption">可交互的练习编辑区</span></div>
              <div id="editor" class="editor" tabindex="0" role="group" aria-label="Helix 练习编辑区，当前${MODES[state.mode]}模式。点击后可使用键盘练习。Tab 移至下一个控件。" aria-describedby="keyboard-help">${editorMarkup(state)}</div>
              <div class="editor-status"><span class="mode-badge ${state.mode}">${state.mode.toUpperCase()}</span><span>practice.txt</span><span class="editor-status-right">${pending.length ? `<b class="pending">${escape(displayKey(pending.join(" ")))} …</b>` : ""}<span>${state.text.slice(0, state.head).split("\n").length}:${state.head - state.text.lastIndexOf("\n", state.head - 1)}</span><span>UTF-8</span><span>TXT</span></span></div>
              <div class="feedback ${success ? "success" : feedback.kind}" role="status" aria-live="polite"><span class="feedback-icon">${success ? "✓" : feedback.kind === "error" ? "!" : "↳"}</span><div><strong>${success ? "本课完成。" : escape(feedback.text)}</strong><small id="keyboard-help">点击编辑区输入 · 也可点按键 · Tab 离开</small></div>${!success ? `<button class="text-button" data-action="focus">聚焦 ↗</button>` : ""}</div>
              ${state.mode === "insert" && !success ? `<form id="mobile-insert-form" class="insert-form"><label for="mobile-insert">触屏 / 中文输入</label><div><input id="mobile-insert" autocomplete="off" placeholder="输入文字后点插入" value="${escape(insertBuffer)}"><button class="button small" type="submit">插入文字</button></div><small>桌面也可直接在编辑区输入。此输入框只提交文字，不处理快捷键。</small></form>` : ""}
              ${operandAction ? operandMarkup() : ""}
              ${countInput ? `<p class="count-pending">计数前缀：${escape(countInput)}。接着输入命令；Esc 取消。</p>` : ""}
              ${state.advanced && !success ? `<label class="count-control">下一条命令计数（也可直接键入数字前缀）<input id="practice-count" inputmode="numeric" type="number" min="1" max="10000" value="${escape(countInput)}" placeholder="1"></label>` : ""}
              <div class="keyboard-area"><div class="section-heading"><h3>按键</h3><span>${MODES[state.mode]} <i class="mode-dot ${state.mode}"></i></span></div><div class="key-controls">${practiceActions()
                .map(
                  (a) =>
                    `<button class="key-control ${currentStep?.mode === a.mode && (currentStep?.action === a.id || currentStep?.action === a.command) && !success ? "suggested" : ""}" data-command="${escape(a.id)}" ${success ? "disabled" : ""}>${keyBadge(bindings[bindingId(a)])}<span>${escape(a.label)}</span></button>${optionalInteraction(a.command) ? `<button class="text-button" data-command-options="${escape(a.id)}" aria-label="${escape(a.label)}：寄存器…" ${success ? "disabled" : ""}>${escape(a.label)}：寄存器…</button>` : ""}`,
                )
                .join("")}</div></div>
              <div class="lesson-footer"><button class="text-button" data-action="restart">↺ 重新练习</button><span>${stepIndex} / ${lesson.steps.length} 步</span><button class="button ${success ? "primary" : ""}" data-action="next">${lessonIndex === LESSONS.length - 1 ? "回到第一课" : "下一课"} <span aria-hidden="true">→</span></button></div>
            </section>
            <aside class="guide-column" aria-label="练习指导">
              <section class="guide-card">
                <div class="section-heading"><h3>步骤</h3><button class="text-button" data-action="hint" aria-expanded="${hintVisible}">${hintVisible ? "收起" : "展开"}</button></div>
                <p class="guide-lead">${success ? "你已完成所有步骤与目标状态。" : !currentStep ? "步骤已完成。请对照目标状态，或重新练习修正多余操作。" : escape(stepInstruction(currentStep))}</p>
                ${hintVisible ? `<ol class="steps">${lesson.steps.map((step, index) => `<li class="${index < stepIndex ? "finished" : index === stepIndex ? "current" : ""}"><span class="step-marker">${index < stepIndex ? "✓" : index + 1}</span><div><span>${escape(actionLabel(step))}</span><small>${step.type === "text" ? "插入模式" : `${MODES[step.mode]}模式`}</small></div>${stepKey(step)}</li>`).join("")}</ol>` : '<p class="hint-hidden">提示已收起。试着凭记忆完成，随时可以展开。</p>'}
              </section>
              <details class="concept-card"><summary>${lesson.concept}</summary><p>${lesson.tip}</p></details>
              ${lessonAnswerMarkup(lesson, bindings, editorMarkup(goalFor(lesson), true), answerVisible)}
            </aside>
          </div>`
          }
        </main>
      </div>
    </div>
    ${modal ? modalMarkup() : ""}`;
  bindModal();
  const dialog = document.getElementById("app-modal");
  if (dialog) dialog.scrollTop = dialogScroll;
  if (modal === "settings") {
    const checked = validateBindings(draft);
    disposeVirtualList = mountVirtualList({
      host: document.getElementById("binding-list"),
      viewport: dialog,
      cache: virtualHeights,
      items: settingsRows(draft, settingsMode, settingsQuery, settingsGroup),
      renderRow: (action) => bindingRow(action, draft, checked.errors),
      scroll,
      focusId: activeId,
    });
    dialog.scrollTop = dialogScroll;
  }
  const sidebar = document.querySelector(".sidebar");
  const drawerOpen = mobileMenu && narrow.matches;
  sidebar.inert = narrow.matches && !drawerOpen;
  document.querySelector(".workspace").inert = drawerOpen;
  document.querySelector(".masthead").inert = drawerOpen;
  if (drawerOpen) drawerCleanup = bindDrawer(sidebar);
  scroll.setOverlay(Boolean(modal) || drawerOpen);
  scroll.scrollTo(pageScroll);
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus({ preventScroll: true });
      if (
        inputSelection &&
        (next instanceof HTMLInputElement ||
          next instanceof HTMLTextAreaElement) &&
        next.type !== "number"
      ) {
        try {
          next.setSelectionRange(...inputSelection);
        } catch {
          /* no selection API on this input type */
        }
      }
    }
  }
}

function bindDrawer(sidebar) {
  sidebar.setAttribute("role", "dialog");
  sidebar.setAttribute("aria-modal", "true");
  const keydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      mobileMenu = false;
      render();
      document.querySelector(".menu-button")?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      const controls = [
        ...sidebar.querySelectorAll("button, a, input, select, [tabindex='0']"),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  sidebar.addEventListener("keydown", keydown);
  return () => sidebar.removeEventListener("keydown", keydown);
}

function modalMarkup() {
  let body;
  if (modal === "settings") {
    body = settingsMarkup(
      draft,
      settingsMode,
      settingsQuery,
      settingsGroup,
      settingsMessage,
    );
  } else if (modal === "export") {
    body = `<div class="modal-heading"><h2 id="modal-title">导出键位</h2></div>
      <div class="export-warning"><strong>这是键位片段，不是整个 config.toml。</strong><p>先备份，再合并到 <code>~/.config/helix/config.toml</code> 对应表；保留其他 editor/theme 设置，不要重复表头。</p><p>片段覆盖全部三模式默认叶绑定以及自定义项。移走 / 删除的旧默认键显式设为 no_op，避免原生编辑器继续把旧键当作别名。未改动的其他别名仍有效。</p><p>默认 sticky 前缀属性由 Helix 原配置合并保留；TOML 不能把 sticky 属性迁移到新前缀。更换该类前缀时，这里只承诺键序列与命令映射，不冒充原生 sticky 菜单。Picker / prompt 专属键位不在此编辑模式配置中。</p></div>
      <label class="export-label" for="export-preview">helix-keys.toml <span>UTF-8 · TOML</span></label><textarea id="export-preview" class="export-preview" readonly spellcheck="false">${escape(exportToml(bindings))}</textarea>
      <div class="modal-footer"><a class="text-button" href="https://docs.helix-editor.com/remapping.html" target="_blank" rel="noreferrer">官方键位文档 ↗</a><span id="copy-status" role="status">${escape(settingsMessage)}</span><button class="button" data-action="copy">复制配置</button><button class="button primary" data-action="download">↓ 下载片段</button></div>`;
  } else {
    body = `<div class="modal-heading"><div class="eyebrow subtle">THREE HONEST LEARNING TRACKS</div><h2 id="modal-title">全量学习，真实练习。</h2><p>完整目录与编辑挑战各司其职，知识掌握不冒充原生编辑执行。</p></div><div class="about-content"><h3>实际编辑</h3><p>基础和进阶任务直接改变文本、模式、多个选区、寄存器与历史。参数必须自己输入，错误操作不会被正确答案覆盖。只有操作与目标状态都匹配才完成。</p><h3>全量目录与回忆</h3><p>完整固定版本默认键位、嵌套前缀、静态命令、命令行命令均可搜索。场景知识题和当前配置按键回忆分别计数。窗口、buffer、LSP、调试器、文件系统、shell 等需原生环境的命令仅用于知识学习，不模拟执行。在真实项目使用 hx 和所需语言服务器练习。</p><h3>键位和保存</h3><p>完整三模式键位可增删、改键和改前缀，导出同一数据的 TOML。Tab 保留网页焦点导航；浏览器拦截键可使用屏幕按钮。进度保存在本地，旧版本记录自动迁移。导出为键位配置片段，不覆盖 theme/editor 等其他设置。</p><h3>继续学习</h3><p><a href="https://docs.helix-editor.com/keymap.html" target="_blank" rel="noreferrer">官方键位表 ↗</a> · <a href="https://docs.helix-editor.com/remapping.html" target="_blank" rel="noreferrer">重映射说明 ↗</a> · <code>hx --tutor</code></p></div>
    <div class="modal-footer"><button class="button primary" data-action="close">关闭</button></div>`;
  }
  return `<dialog id="app-modal" class="modal ${modal === "about" ? "about-modal" : ""}" aria-labelledby="modal-title"><button class="close-modal" data-action="close" aria-label="关闭对话框">×</button>${body}</dialog>`;
}
function bindModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  dialog.showModal();
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModal();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        closeModal();
    }
  });
}
function openModal(type) {
  overlayTrigger = document.activeElement?.dataset.action || type;
  modal = type;
  settingsMessage = "";
  draft = { ...bindings };
  render();
  document.querySelector(".close-modal")?.focus({ preventScroll: true });
}
function closeModal() {
  modal = null;
  virtualHeights.clear();
  render();
  document
    .querySelector(`[data-action="${overlayTrigger || "settings"}"]`)
    ?.focus({ preventScroll: true });
}
function startLesson(id, navigate = true) {
  if (navigate && navigation) {
    navigation.push(() => startLesson(id, false));
    return;
  }
  lessonIndex = LESSONS.findIndex((l) => l.id === id);
  track = "practice";
  operandAction = null;
  countInput = "";
  lesson = LESSONS[lessonIndex];
  state = createState(lesson);
  answerVisible = false;
  stepIndex = 0;
  typed = "";
  pending = [];
  success = false;
  insertBuffer = "";
  mobileMenu = false;
  feedback = { kind: "neutral", text: "准备好了。按右侧步骤试一试。" };
  if (navigate) render("editor");
}
function practiceActions() {
  const ids = new Set(
    lesson.steps
      .filter((step) => step.mode === state.mode)
      .map((step) => getAction(step.mode, step.action).command),
  );
  for (const name of ["normal_mode", "undo", "redo"]) ids.add(name);
  return [...ids]
    .map((command) => actionForCommand(bindings, state.mode, command))
    .filter(Boolean);
}
function operandMarkup() {
  const interaction = ADVANCED_INTERACTIONS[operandAction.command];
  return `<form id="operand-form" class="operand-form"><h3>${escape(interaction.prompt)}</h3><p>这是命令参数，不是快捷键。输入真实值后执行；错误值也会作用于文本。</p>
    ${interaction.fields.map((field) => `<label>${escape(field.label)}<input name="${escape(field.name)}" id="operand-${escape(field.name)}" ${field.required ? "required" : ""} autocomplete="off" spellcheck="false"></label>`).join("")}
    <label>计数<input name="count" type="number" min="1" max="10000" value="${operandCount}"></label>
    <div><button class="button primary" type="submit">执行命令</button><button class="text-button" type="button" data-action="cancel-operand">取消</button></div></form>`;
}
function beginAction(action, includeOptional = false) {
  pending = [];
  if (success || operandAction) return;
  if (state.mode === "insert" && action.command === "delete_char_backward")
    return typeText("", true);
  if (state.mode === "insert" && action.command === "insert_newline")
    return typeText("\n");
  const count = countInput ? Number(countInput) : 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000) {
    feedback = { kind: "error", text: "计数必须为 1–10000 的整数。" };
    countInput = "";
    render("editor");
    return;
  }
  if (state.advanced && commandInteraction(action.command, includeOptional)) {
    operandAction = action;
    operandCount = count;
    pending = [];
    countInput = "";
    render();
    document.querySelector("#operand-form input")?.focus();
    return;
  }
  executeAction(action, countInput ? { count } : {});
}
function chooseQuestion(id) {
  if (track === "library") libraryEntry = navigation.key;
  navigation.push(() => {
    question = recallQuestion(id, bindings);
    track = "recall";
    recallAnswer = "";
    recallRevealed = false;
    pending = [];
  });
  document.getElementById("recall-keyboard")?.focus({ preventScroll: true });
}
function answerQuestion(correct) {
  recallAnswer = correct ? "correct" : "wrong";
  pending = [];
  if (correct && !knowledge.includes(question.id)) {
    knowledge.push(question.id);
    persist();
  }
  render(question.type === "binding" ? "recall-keyboard" : undefined);
}
function checkComplete() {
  if (stepIndex === lesson.steps.length) {
    if (matchesGoal(state, goalFor(lesson))) {
      success = true;
      if (!completed.includes(lesson.id)) {
        completed.push(lesson.id);
        persist();
      }
    } else
      feedback = {
        kind: "error",
        text: "步骤已完成，但文本或选区与目标不同。查看目标状态，或重新练习。",
      };
  }
}
function executeAction(action, args = {}) {
  if (success) return;
  const previousMode = state.mode;
  const expected = lesson.steps[stepIndex];
  const expectedCommand =
    expected && expected.type !== "text"
      ? getAction(expected.mode, expected.action).command
      : null;
  const basicId =
    ACTIONS.find((a) => a.mode === previousMode && a.command === action.command)
      ?.id || action.id;
  const basicSupported = [
    "left",
    "right",
    "up",
    "down",
    "word",
    "backword",
    "select",
    "insert",
    "delete",
    "undo",
    "normal",
  ];
  try {
    if (
      Array.isArray(action.command) ||
      (state.advanced
        ? !supportsCommand(action.command)
        : !basicSupported.includes(basicId))
    ) {
      throw new Error(
        "此命令不在当前真实编辑引擎范围；请在完整目录做知识练习，并在原生 Helix 实际执行。",
      );
    }
    state = applyAction(state, state.advanced ? action.command : basicId, args);
    const parametersMatch =
      !expected?.args ||
      Object.entries(expected.args).every(
        ([key, value]) =>
          (args[key] ?? (key === "count" ? 1 : undefined)) === value,
      );
    if (
      expected?.mode === previousMode &&
      expectedCommand === action.command &&
      parametersMatch
    ) {
      stepIndex++;
      typed = "";
      feedback = {
        kind: "neutral",
        text: `已执行：${action.label}。继续下一步。`,
      };
    } else
      feedback = {
        kind: "error",
        text: `刚执行了 ${commandName(action.command)}（${JSON.stringify(args)}）。操作已真实生效，但与本步要求不同；可检查文本或重新练习。`,
      };
  } catch (error) {
    feedback = { kind: "error", text: error.message };
  }
  pending = [];
  countInput = "";
  operandAction = null;
  checkComplete();
  render("editor");
}
function typeText(text, erase = false) {
  pending = [];
  countInput = "";
  if (state.mode !== "insert" || success) return;
  state = erase ? backspace(state) : insertText(state, text);
  const progress = updateTextProgress(lesson.steps, stepIndex, typed, text, erase);
  stepIndex = progress.stepIndex;
  typed = progress.typed;
  if (progress.status === "matched")
    feedback = {
      kind: "neutral",
      text: "文字输入正确。现在切换回普通模式。",
    };
  else if (progress.status === "mismatch")
    feedback = {
      kind: "error",
      text: `文字还不匹配，需要输入 ${JSON.stringify(progress.expected)}。可用 Backspace 修正，或重新练习。`,
    };
  else if (progress.status === "typing")
    feedback = {
      kind: "neutral",
      text: `已输入 ${typed.length} / ${progress.expected.length} 个字符（包括空格）。`,
    };
  else
    feedback = {
      kind: "error",
      text: "文字已插入。请按照当前步骤切换模式，或重新练习。",
    };
  checkComplete();
  render("editor");
}
function feedKey(key, rawText, fresh = false) {
  if (operandAction || success) return;
  const result = resolvePracticeInput({
    bindings, mode: state.mode, advanced: state.advanced,
    pending, countInput, key, rawText, fresh,
  });
  // Commit sequence state before any callback, including insert editing fast paths.
  pending = result.pending;
  countInput = result.countInput;
  if (result.status === "action") return beginAction(result.action);
  if (result.status === "text") return typeText(result.text);
  if (result.status === "count") {
    render("editor");
    return;
  }
  if (result.status === "prefix") {
    feedback = {
      kind: "neutral",
      text: `已输入前缀 ${displayKey(result.sequence)}，请继续按下一键。Esc 可以取消未完成前缀。`,
    };
    render("editor");
    return;
  }
  if (result.status === "cancel") {
    feedback = { kind: "neutral", text: "已取消按键前缀或计数，练习状态不变。" };
    render("editor");
    return;
  }
  feedback = {
    kind: "error",
    text: `${displayKey(result.sequence)} 未绑定到当前模式的练习操作。请查看右侧提示或下方可用按键。`,
  };
  render("editor");
}

root.addEventListener("toggle", (event) => {
  if (event.target.id === "lesson-answer" && event.target.isConnected)
    answerVisible = event.target.open;
}, true);
root.addEventListener("click", async (event) => {
  const button = event.target.closest(
    "[data-action], [data-category], [data-lesson], [data-command], [data-command-options], [data-mode], [data-reset-key], [data-library-kind], [data-page], [data-recall], [data-answer]",
  );
  if (!button) return;
  if (button.dataset.recall) return chooseQuestion(button.dataset.recall);
  if (button.dataset.answer)
    return answerQuestion(button.dataset.answer === (question?.answer ?? question?.command));
  if (button.dataset.libraryKind) {
    catalogKind = button.dataset.libraryKind;
    catalogPage = 0;
    catalogMode = "";
    catalogGroup = "";
    render();
    navigation.replace();
    return;
  }
  if (button.dataset.page !== undefined) {
    catalogPage = Number(button.dataset.page);
    render();
    navigation.replace();
    scroll.scrollToAnchor(document.querySelector(".catalog-panel"), {
      smooth: false,
    });
    return;
  }
  if (button.dataset.category) {
    const nextCategory = button.dataset.category;
    navigation.push(() => {
      category = nextCategory;
      track = "practice";
      const list = selectedLessons();
      if (!list.includes(lesson))
        startLesson(
          list.find((l) => !completed.includes(l.id))?.id || list[0].id,
          false,
        );
    });
    return;
  }
  if (button.dataset.lesson) return startLesson(button.dataset.lesson);
  if (button.dataset.commandOptions)
    return beginAction(getAction(state.mode, button.dataset.commandOptions), true);
  if (button.dataset.command) {
    const action = getAction(state.mode, button.dataset.command);
    parseSequence(keyOf(action.mode, action.id)).forEach((key, index) =>
      feedKey(key, undefined, index === 0),
    );
    return;
  }
  if (button.dataset.mode) {
    settingsMode = button.dataset.mode;
    settingsGroup = "";
    render();
    document.querySelector(`[data-mode="${settingsMode}"]`)?.focus();
    return;
  }
  if (button.dataset.resetKey) {
    if (button.dataset.resetKey in DEFAULT_BINDINGS)
      draft[button.dataset.resetKey] =
        DEFAULT_BINDINGS[button.dataset.resetKey];
    else delete draft[button.dataset.resetKey];
    settingsMessage = "";
    render();
    return;
  }
  switch (button.dataset.action) {
    case "practice":
      navigation.push(() => {
        track = "practice";
        pending = [];
      });
      break;
    case "library":
      navigation.push(() => {
        track = "library";
        pending = [];
      });
      break;
    case "library-return":
      navigation.push(
        () => {
          track = "library";
          pending = [];
        },
        { restore: libraryEntry },
      );
      break;
    case "recall-next": {
      chooseQuestion(nextArticleQuestion(knowledge, question?.id).id);
      break;
    }
    case "recall-reveal":
      recallRevealed = !recallRevealed;
      render();
      break;
    case "cancel-operand":
      operandAction = null;
      countInput = "";
      render("editor");
      break;
    case "home":
      event.preventDefault();
      category = "all";
      startLesson(LESSONS[0].id);
      break;
    case "menu":
      mobileMenu = !mobileMenu;
      render();
      document
        .querySelector(mobileMenu ? ".drawer-close" : ".menu-button")
        ?.focus({ preventScroll: true });
      break;
    case "settings":
      openModal("settings");
      break;
    case "export":
      openModal("export");
      break;
    case "about":
      openModal("about");
      break;
    case "close":
      closeModal();
      break;
    case "focus":
      document.getElementById("editor")?.focus();
      break;
    case "restart":
      startLesson(lesson.id);
      break;
    case "hint":
      hintVisible = !hintVisible;
      render();
      break;
    case "next": {
      const list = selectedLessons();
      const index = list.indexOf(lesson);
      startLesson(list[(index + 1) % list.length].id);
      break;
    }
    case "dismiss-notice":
      notice = "";
      render();
      break;
    case "clear-progress":
      if (window.confirm("清除所有已完成标记？自定义键位会保留。")) {
        completed = [];
        knowledge = [];
        persist();
        startLesson(lesson.id);
      }
      break;
    case "reset-bindings":
      draft = { ...DEFAULT_BINDINGS };
      settingsMessage = "默认键位已填入，保存后生效。学习进度保留。";
      render();
      break;
    case "save-bindings": {
      const checked = validateBindings(draft);
      if (!checked.valid) return;
      const previousBindings = bindings;
      bindings = checked.values;
      knowledge = knowledge.filter(
        (id) =>
          !id.startsWith("binding:") ||
          previousBindings[id.slice(8)] === bindings[id.slice(8)],
      );
      persist();
      modal = null;
      startLesson(lesson.id, false);
      feedback = {
        kind: "neutral",
        text: "键位已保存；题目提示与按键已同步更新。本课已重新开始。",
      };
      render("editor");
      break;
    }
    case "copy":
      try {
        await navigator.clipboard.writeText(exportToml(bindings));
        settingsMessage = "已复制到剪贴板";
      } catch {
        settingsMessage = "无法自动复制，请在预览框中全选后手动复制";
      }
      render();
      break;
    case "download": {
      const url = URL.createObjectURL(
        new Blob([exportToml(bindings)], {
          type: "application/toml;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "helix-keys.toml";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      settingsMessage = "已发起下载：helix-keys.toml";
      render();
      break;
    }
  }
});
root.addEventListener("input", (event) => {
  if (event.target.dataset.binding) {
    draft[event.target.dataset.binding] = event.target.value;
    settingsMessage = "";
    render();
  }
  if (event.target.id === "mobile-insert") insertBuffer = event.target.value;
  if (event.target.id === "settings-search") {
    settingsQuery = event.target.value;
    render();
  }
  if (event.target.id === "catalog-search") {
    catalogQuery = event.target.value;
    catalogPage = 0;
    render();
    navigation.replace();
  }
  if (event.target.id === "practice-count") countInput = event.target.value;
});
root.addEventListener("change", (event) => {
  if (event.target.id === "settings-group") {
    settingsGroup = event.target.value;
    render();
  }
  if (event.target.id === "catalog-mode") {
    catalogMode = event.target.value;
    catalogPage = 0;
    render();
    navigation.replace();
  }
  if (event.target.id === "catalog-group") {
    catalogGroup = event.target.value;
    catalogPage = 0;
    render();
    navigation.replace();
  }
});
root.addEventListener("submit", (event) => {
  if (event.target.id === "recall-sequence-form") {
    event.preventDefault();
    try {
      answerQuestion(
        parseSequence(document.getElementById("recall-sequence").value).join(
          " ",
        ) === question.key,
      );
    } catch {
      answerQuestion(false);
    }
    return;
  }
  if (event.target.id === "operand-form") {
    event.preventDefault();
    const form = new FormData(event.target),
      args = {};
    for (const [key, value] of form)
      if (value !== "") args[key] = key === "count" ? Number(value) : value;
    executeAction(operandAction, args);
    return;
  }
  if (event.target.id === "add-binding-form") {
    event.preventDefault();
    try {
      draft = addBinding(
        draft,
        settingsMode,
        document.getElementById("add-command").value,
        document.getElementById("add-key").value,
      );
      settingsMessage = "已新增，保存后生效。";
      settingsQuery = "";
      settingsGroup = "";
    } catch (error) {
      settingsMessage = error.message;
    }
    render();
    return;
  }
  if (event.target.id === "mobile-insert-form") {
    event.preventDefault();
    const value = insertBuffer;
    insertBuffer = "";
    if (value) typeText(value);
  }
});
root.addEventListener("keydown", (event) => {
  if (
    event.target.id === "recall-keyboard" &&
    !modal &&
    !event.isComposing &&
    event.key !== "Tab"
  ) {
    const key = keyFromEvent(event);
    if (!key) return;
    event.preventDefault();
    if (key === "esc" && [...pending, key].join(" ") !== question.key) {
      pending = [];
      render("recall-keyboard");
      return;
    }
    pending.push(key);
    const sequence = pending.join(" ");
    if (sequence === question.key) return answerQuestion(true);
    if (!question.key?.startsWith(sequence + " ")) return answerQuestion(false);
    render("recall-keyboard");
    return;
  }
  if (
    event.target.id !== "editor" ||
    modal ||
    event.isComposing ||
    event.key === "Tab"
  )
    return;
  const key = keyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  const rawText =
    !event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1
      ? event.key
      : undefined;
  feedKey(key, rawText);
});
root.addEventListener("paste", (event) => {
  if (event.target.id === "editor" && state.mode === "insert") {
    event.preventDefault();
    typeText(event.clipboardData.getData("text/plain"));
  }
});
function restoreContext(context) {
  if (context.lessonId !== lesson.id) startLesson(context.lessonId, false);
  ({
    track,
    category,
    catalogQuery,
    catalogMode,
    catalogGroup,
    catalogKind,
    catalogPage,
    recallAnswer,
    recallRevealed,
  } = context);
  question = context.questionId
    ? recallQuestion(context.questionId, bindings)
    : null;
  pending = [];
}
if (history.state?.helix) restoreContext(history.state.context);
else if (location.hash === "#library") track = "library";
else if (location.hash === "#recall") {
  track = "recall";
  question = recallQuestion(nextArticleQuestion(knowledge).id, bindings);
}
navigation = createNavigation({
  history: window.history,
  location: window.location,
  events: window,
  scroll,
  readContext: () => ({
    track,
    category,
    lessonId: lesson.id,
    catalogQuery,
    catalogMode,
    catalogGroup,
    catalogKind,
    catalogPage,
    questionId: question?.id,
    recallAnswer,
    recallRevealed,
  }),
  applyContext: restoreContext,
  beforeNavigate: () => {
    modal = null;
    mobileMenu = false;
    disposeVirtualList();
    virtualHeights.clear();
    drawerCleanup();
    scroll.setOverlay(false);
  },
  render,
});
const backTop = document.getElementById("back-top");
const disposeBackTop = scroll.observe(scrollRoot, (top) => {
  backTop.hidden = top < 600;
});
backTop.addEventListener("click", () => {
  scroll.top(true);
  scrollRoot.focus({ preventScroll: true });
});
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  scroll.scrollToAnchor(document.getElementById("main-content"), {
    focus: true,
  });
});
const resizeDrawer = () => {
  mobileMenu = false;
  render();
};
narrow.addEventListener("change", resizeDrawer);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposeVirtualList();
  drawerCleanup();
  disposeBackTop();
  navigation.dispose();
  scroll.dispose();
  narrow.removeEventListener("change", resizeDrawer);
});
render();
