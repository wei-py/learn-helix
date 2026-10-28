import {
  ACTIONS,
  ALL_COMMANDS,
  MODES,
  bindingId,
  actionsFor,
  displayKey,
  validateBindings,
} from "./bindings.js";
import { COMMAND_ZH } from "./catalog-zh.js";
import { CATALOG_VERSION, CATALOG_META } from "./catalog.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const commandName = (command) =>
  Array.isArray(command) ? command.join(" → ") : command;
export function settingsRows(draft, mode, query, group) {
  return actionsFor(draft)
    .filter(
      (action) =>
        action.mode === mode &&
        (!group || action.group === group) &&
        `${action.label} ${commandName(action.command)} ${draft[bindingId(action)]} ${action.key} ${action.group}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .map((action) => ({ ...action, id: bindingId(action) }));
}
export function bindingRow(action, draft, errors) {
  const id = action.id;
  return `<div class="binding-row" role="listitem">
    <label for="binding-${esc(id)}"><strong>${esc(action.label)}</strong><code>${esc(commandName(action.command))}</code></label>
    <div class="binding-field"><input id="binding-${esc(id)}" data-binding="${esc(id)}" value="${esc(draft[id])}" aria-label="${MODES[action.mode]}模式：${esc(commandName(action.command))}" ${errors[id] ? 'aria-invalid="true"' : ""} spellcheck="false" autocomplete="off">
    <small class="${errors[id] ? "field-error" : ""}">${esc(errors[id] || `默认：${displayKey(action.key)}`)}</small></div>
    <button class="reset-key" data-reset-key="${esc(id)}" aria-label="恢复 ${esc(commandName(action.command))}">↺</button></div>`;
}
export function settingsMarkup(draft, mode, query, group, message) {
  const checked = validateBindings(draft),
    errors = Object.keys(checked.errors);
  const all = actionsFor(draft).filter((a) => a.mode === mode);
  const groups = [...new Set(all.map((a) => a.group || "其他"))];
  const rows = settingsRows(draft, mode, query, group);
  return `<div class="modal-heading"><h2 id="modal-title">键位设置</h2></div>
    <div class="mode-tabs" role="tablist" aria-label="快捷键模式">${Object.entries(
      MODES,
    )
      .map(
        ([m, label]) =>
          `<button role="tab" aria-selected="${mode === m}" data-mode="${m}" class="${mode === m ? "active" : ""}">${label}模式 <code>${m}</code></button>`,
      )
      .join("")}</div>
    <div class="catalog-filters"><label>搜索键、命令、前缀<input id="settings-search" value="${esc(query)}" placeholder="space w / regex / goto"></label>
    <label>分组<select id="settings-group"><option value="">全部前缀 / 分组</option>${groups.map((g) => `<option ${g === group ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></label></div>
    <details class="syntax-help"><summary>键位写法与范围</summary><p>空格分隔前缀；支持 C-h、A-C、Meta-c、F1–F24。大小写有意义：A-c ≠ A-C。留空移除；Tab 用于网页导航，浏览器保留键可用屏幕输入。</p><p>冲突检测覆盖全部模式。修改的有效别名优先用于提示。移走的默认键导出为 no_op；sticky 属性不能迁移；不含 Picker / prompt 专属键。</p></details>
    <p class="settings-count" role="status">${rows.length} / ${all.length}</p>
    <div id="binding-list" class="binding-list" role="list" aria-label="可编辑键位"></div>
    <form id="add-binding-form" class="add-binding"><h3>新增绑定</h3>
    <label>官方命令 / 原生命令序列<input id="add-command" list="command-options" required placeholder="select_regex / :write file.txt"></label>
    <datalist id="command-options">${ALL_COMMANDS.map((c) => `<option value="${esc(c.name)}">${esc(COMMAND_ZH[c.name])}</option>`).join("")}</datalist>
    <label>新快捷键<input id="add-key" required placeholder="F6 / space z r"></label><button class="button" type="submit">添加到${MODES[mode]}模式</button>
    <details><summary>命令写法</summary><p>支持 <code>:open "file name.txt"</code> 与 JSON 命令数组 <code>["move_char_right","delete_selection"]</code>；系统命令在原生 Helix 执行。先解决重复 / 前缀冲突，再保存。</p></details></form>
    <div class="modal-footer"><button class="text-button" data-action="reset-bindings">恢复默认</button><span class="settings-status ${errors.length ? "field-error" : ""}" role="status">${errors.length ? `${errors.length} 项冲突` : esc(message)}</span><button class="button primary" data-action="save-bindings" ${errors.length ? "disabled" : ""}>保存</button></div>`;
}
export function libraryMarkup({
  bindings,
  knowledge,
  query,
  mode,
  group,
  kind,
  page,
}) {
  const source =
    kind === "commands"
      ? ALL_COMMANDS.map((c) => ({
          ...c,
          search: `${COMMAND_ZH[c.name]} ${c.name} ${c.description} ${(c.aliases || []).join(" ")}`,
          key: c.name,
        }))
      : actionsFor(bindings).map((a) => ({
          ...a,
          name: commandName(a.command),
          search: `${a.label} ${commandName(a.command)} ${a.description} ${bindings[bindingId(a)]} ${a.key} ${a.group}`,
          key: bindingId(a),
        }));
  const filtered = source.filter(
    (row) =>
      (!mode || row.mode === mode) &&
      (!group || row.group === group) &&
      row.search.toLowerCase().includes(query.toLowerCase()),
  );
  const pageSize = 24,
    pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  const cards = rows
    .map(
      (row) => `<article class="catalog-row">
    <div><div class="catalog-meta">${esc(row.mode ? `${row.mode} · ${row.group}` : row.kind === "typable" ? "命令行 · : 前缀" : "静态命令")}${knowledge.includes(`${kind === "commands" ? "command" : "binding"}:${row.key}`) ? " · 已掌握" : ""}</div>
    <h3><code>${esc(row.name)}</code></h3><p>${esc(COMMAND_ZH[row.name] || row.label)}</p><small lang="en">${esc(row.description)}</small>
    ${row.aliases?.length ? `<small>别名：${esc(row.aliases.join(", "))}</small>` : ""}
    ${row.mode ? `<p><kbd>${esc(displayKey(bindings[row.key]))}</kbd><small> 官方默认：${esc(displayKey(ACTIONS.find((a) => bindingId(a) === row.key)?.key))}</small></p>` : ""}</div>
    <button class="button small" data-recall="${esc(`${kind === "commands" ? "command" : "binding"}:${row.key}`)}">${kind === "commands" ? "场景知识题" : "按键回忆"} →</button></article>`,
    )
    .join("");
  return `<section class="catalog-panel">
    <div class="section-heading"><h2>键位与命令</h2><a href="https://docs.helix-editor.com/keymap.html" target="_blank" rel="noreferrer">官方文档 ↗</a></div>
    <div class="mode-tabs"><button data-library-kind="bindings" class="${kind === "bindings" ? "active" : ""}">键位 ${ACTIONS.length}</button><button data-library-kind="commands" class="${kind === "commands" ? "active" : ""}">命令 ${ALL_COMMANDS.length}</button><button data-action="recall-next">回忆练习 →</button></div>
    <div class="catalog-filters"><label>搜索<input id="catalog-search" value="${esc(query)}" placeholder="搜索命令、描述、键、前缀…"></label>
    ${
      kind === "bindings"
        ? `<label>模式<select id="catalog-mode"><option value="">全部模式</option>${Object.entries(
            MODES,
          )
            .map(
              ([m, label]) =>
                `<option value="${m}" ${mode === m ? "selected" : ""}>${label}</option>`,
            )
            .join(
              "",
            )}</select></label><label>前缀 / 分组<select id="catalog-group"><option value="">全部</option>${groups.map((g) => `<option ${g === group ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></label>`
        : ""
    }</div>
    <p class="catalog-result" role="status">找到 ${filtered.length} 项 · 第 ${current + 1} / ${pages} 页</p><div class="catalog-list">${cards}</div>
    <div class="lesson-footer"><button class="button" data-page="${Math.max(0, current - 1)}" ${current === 0 ? "disabled" : ""}>上一页</button><span>${current + 1} / ${pages}</span><button class="button" data-page="${Math.min(pages - 1, current + 1)}" ${current === pages - 1 ? "disabled" : ""}>下一页</button></div>
    <details class="source-note"><summary>版本、覆盖口径与来源</summary><p>精确固定 ${CATALOG_VERSION}。绑定按 mode + 完整序列的每个叶节点计数；同命令多个别名不是多个命令。命令知识题包含全部静态及 typable 命令；不将查阅或按键回忆计为编辑能力。</p><pre>${esc(JSON.stringify(CATALOG_META.counts, null, 2))}</pre></details></section>`;
}
export function recallQuestion(id, bindings) {
  if (id.startsWith("binding:")) {
    const a = actionsFor(bindings).find((a) => bindingId(a) === id.slice(8));
    return a
      ? {
          id,
          type: "binding",
          action: a,
          description: COMMAND_ZH[commandName(a.command)] || a.label,
          officialDescription: a.description,
          command: commandName(a.command),
          mode: a.mode,
          key: bindings[bindingId(a)],
        }
      : null;
  }
  const command = ALL_COMMANDS.find((c) => c.name === id.slice(8));
  if (!command) return null;
  const index = ALL_COMMANDS.indexOf(command),
    picks = [
      command,
      ...[1, 17, 53].map(
        (n) => ALL_COMMANDS[(index + n) % ALL_COMMANDS.length],
      ),
    ];
  picks.sort((a, b) => a.name.localeCompare(b.name));
  return {
    id,
    type: "command",
    description: COMMAND_ZH[command.name] || command.description,
    officialDescription: command.description,
    command: command.name,
    options: picks,
  };
}
export function recallMarkup(question, bindings, answer, revealed, pending) {
  if (!question)
    return '<section class="catalog-panel"><h2>选择一个知识题</h2><button data-action="library" class="button">打开完整目录</button></section>';
  const mapped = actionsFor(bindings).filter(
    (a) =>
      commandName(a.command) === question.command && bindings[bindingId(a)],
  );
  const choices =
    question.type === "command"
      ? `<div class="recall-options">${question.options.map((c) => `<button class="button" data-answer="${esc(c.name)}"><code>${esc(c.name)}</code></button>`).join("")}</div>`
      : `<div id="recall-keyboard" tabindex="0" class="recall-keyboard" role="group" aria-label="按键回忆输入区域">
        ${question.key ? "点击这里，输入当前配置的完整快捷键。Tab 可离开。" : "此绑定已移除；无需输入不存在的键。"}
        <strong>${esc(pending.length ? displayKey(pending.join(" ")) : "等待输入…")}</strong></div>
       ${question.key ? `<form id="recall-sequence-form" class="insert-form"><label for="recall-sequence">触屏 / 浏览器保留键：填写 Helix 键序列</label><div><input id="recall-sequence" required autocomplete="off" spellcheck="false" placeholder="例如 C-w h / tab"><button class="button" type="submit">检查键序列</button></div></form>` : `<p class="scope-note">已禁用的叶绑定不要求回忆不存在的快捷键。可恢复 / 新增配置后再练；这里不会给禁用项伪造完成标记。</p>`}`;
  return `<section class="catalog-panel recall-panel">
    <h2>${question.type === "command" ? "选择命令" : "输入快捷键"}</h2>
    <p class="recall-scenario">${esc(question.description)}</p><small lang="en">${esc(question.officialDescription)}</small>
    ${question.mode ? `<p>${MODES[question.mode]} · <code>${esc(question.command)}</code></p>` : ""}
    ${choices}
    ${answer ? `<p class="feedback ${answer === "correct" ? "success" : "error"}" role="status">${answer === "correct" ? "正确，已记录。" : "不匹配，请重试。"}</p>` : ""}
    <div class="lesson-footer"><button class="text-button" data-action="recall-reveal">${revealed ? "收起答案" : "查看答案"}</button><button class="button primary" data-action="recall-next">下一题 →</button><button class="text-button" data-action="library-return">返回目录</button></div>
    ${
      revealed
        ? `<div class="scope-note"><code>${esc(question.command)}</code><p>${
            mapped.length
              ? mapped
                  .map(
                    (a) => `${a.mode}: ${displayKey(bindings[bindingId(a)])}`,
                  )
                  .map(esc)
                  .join("<br>")
              : "没有默认或已配置绑定。命令行命令可用 : 输入，静态命令可在自定义键位添加。"
          }</p><button class="button small" data-action="settings">编辑键位</button></div>`
        : ""
    }
  </section>`;
}
