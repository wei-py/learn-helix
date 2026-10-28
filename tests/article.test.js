import test from "node:test";
import assert from "node:assert/strict";
import { ARTICLE_QUESTIONS, nextArticleQuestion } from "../src/article.js";
import { DEFAULT_BINDINGS, validateBindings } from "../src/bindings.js";
import { loadSaved, saveState } from "../src/engine.js";

test("article progression skips mastered questions and moves past an unanswered current question", () => {
  const [first, second, third] = ARTICLE_QUESTIONS;
  assert.equal(nextArticleQuestion([], undefined).id, first.id);
  assert.equal(nextArticleQuestion([], first.id).id, second.id);
  assert.equal(nextArticleQuestion([second.id], first.id).id, third.id);
  assert.equal(nextArticleQuestion([first.id, second.id], "command:undo").id, third.id);
  const last = ARTICLE_QUESTIONS.at(-1);
  assert.equal(nextArticleQuestion([], last.id).id, first.id);
});

test("mastering the article cycles within its questions rather than falling back to the catalog", () => {
  const mastered = ARTICLE_QUESTIONS.map((question) => question.id);
  const last = ARTICLE_QUESTIONS.at(-1);
  assert.equal(nextArticleQuestion(mastered, last.id).id, ARTICLE_QUESTIONS[0].id);
  assert.equal(nextArticleQuestion(mastered, ARTICLE_QUESTIONS[0].id).id, ARTICLE_QUESTIONS[1].id);
});

test("article progress survives reload alongside legacy lesson and catalog progress", () => {
  let raw;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const articleId = ARTICLE_QUESTIONS[0].id;
  assert.equal(saveState(storage, DEFAULT_BINDINGS, ["adv-regex-rename", "right"],
    [articleId, "command:undo", "binding:normal.right", "article:unknown"]), true);
  const saved = loadSaved(storage, validateBindings, DEFAULT_BINDINGS);
  assert.deepEqual(saved.completed, ["adv-regex-rename", "right"]);
  assert.deepEqual(saved.knowledge, [articleId, "command:undo", "binding:normal.right"]);
  assert.equal(nextArticleQuestion(saved.knowledge).id, ARTICLE_QUESTIONS[1].id);
});
