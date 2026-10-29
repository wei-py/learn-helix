import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_QUESTIONS, nextArticleQuestion } from "../src/domain/article.js"
import { DEFAULT_BINDINGS, validateBindings } from "../src/domain/bindings.js"
import { loadSaved, saveState } from "../src/domain/engine.js"

test("article progression skips mastered questions and moves past an unanswered current question", /** 验证文章题目跳过已掌握记录，并越过当前未答题继续学习。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 按既定顺序解构当前记录的边界、标识或测试参数。
   * @type {import('../src/domain/types.js').RecallQuestion[]}
   */
  const [first, second, third] = ARTICLE_QUESTIONS;
  assert.equal(nextArticleQuestion([], undefined).id, first.id);
  assert.equal(nextArticleQuestion([], first.id).id, second.id);
  assert.equal(nextArticleQuestion([second.id], first.id).id, third.id);
  assert.equal(nextArticleQuestion([first.id, second.id], "command:undo").id, third.id);
  /** 当前范围覆盖的最后一条记录。
   * @type {import('../src/domain/types.js').RecallQuestion | undefined}
   */
  const last = ARTICLE_QUESTIONS.at(-1);
  assert.equal(nextArticleQuestion([], last.id).id, first.id);
});

test("mastering the article cycles within its questions rather than falling back to the catalog", /** 验证掌握全部文章题目后仍在原题集内循环，不切换到目录题。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 当前已经掌握的知识题标识。
   * @type {string[]}
   */
  const mastered = ARTICLE_QUESTIONS.map(/** 将 ARTICLE_QUESTIONS 中的记录转换为本次操作需要的结果。
   * @param {import('../src/domain/types.js').RecallQuestion} question - 当前需要返回或比较的知识题。
   * @returns {string} 返回该操作的实际计算结果。
   */
  (question) => question.id);
  /** 当前范围覆盖的最后一条记录。
   * @type {import('../src/domain/types.js').RecallQuestion | undefined}
   */
  const last = ARTICLE_QUESTIONS.at(-1);
  assert.equal(nextArticleQuestion(mastered, last.id).id, ARTICLE_QUESTIONS[0].id);
  assert.equal(nextArticleQuestion(mastered, ARTICLE_QUESTIONS[0].id).id, ARTICLE_QUESTIONS[1].id);
});

test("article progress survives reload alongside legacy lesson and catalog progress", /** 验证刷新后保留文章、历史课程与目录知识的独立学习进度。
 * @returns {void} 完成状态修改，不返回额外值。
 */
() => {
  /** 模拟刷新前后保留的序列化记录。
   * @type {string | undefined}
   */
  let raw;
  /** 可读写的测试本地存储接口。
   * @type {import('../src/domain/types.js').StorageReader & import('../src/domain/types.js').StorageWriter}
   */
  const storage = { getItem: /** 实现 getItem 所要求的真实存储操作。
   * @returns {string | undefined} 返回该操作的实际计算结果。
   */
  () => raw, setItem: /** 实现 setItem 所要求的真实存储操作。
   * @param {string} _key - _key 对应的实际输入记录。
   * @param {string} value - 本次实际输入、读取或比较的值。
   * @returns {void} 完成状态修改，不返回额外值。
   */
  (_key, value) => { raw = value; } };
  /** 需要保存并恢复的稳定文章题目标识。
   * @type {string}
   */
  const articleId = ARTICLE_QUESTIONS[0].id;
  assert.equal(saveState(storage, DEFAULT_BINDINGS, ["adv-regex-rename", "right"],
    [articleId, "command:undo", "binding:normal.right", "article:unknown"]), true);
  /** 从真实序列化记录恢复的状态。
   * @type {import('../src/domain/types.js').SavedState}
   */
  const saved = loadSaved(storage, validateBindings, DEFAULT_BINDINGS);
  assert.deepEqual(saved.completed, ["adv-regex-rename", "right"]);
  assert.deepEqual(saved.knowledge, [articleId, "command:undo", "binding:normal.right"]);
  assert.equal(nextArticleQuestion(saved.knowledge).id, ARTICLE_QUESTIONS[1].id);
});

