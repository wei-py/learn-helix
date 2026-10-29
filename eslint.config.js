import antfu from '@antfu/eslint-config';
import jsdoc from 'eslint-plugin-jsdoc';

import declarationDocumentation from './tooling/declaration-documentation.js';

/**
 * 项目源码、Vue 脚本和测试统一执行具体类型与中文说明检查。
 * @type {import('eslint').Linter.Config}
 */
const documentation = {
  files: ['**/*.js', '**/*.vue'],
  plugins: { documentation: { rules: { declarations: declarationDocumentation } }, jsdoc },
  settings: { jsdoc: { mode: 'typescript' } },
  rules: {
    'documentation/declarations': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/valid-types': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-returns-type': 'error',
    'jsdoc/require-returns-description': 'error',
    'jsdoc/match-description': ['error', {
      matchDescription: '[\u3400-\u9FFF]',
      message: 'JSDoc 职责与业务说明必须使用中文。',
      tags: { param: true, property: true, returns: '^$|[\u3400-\u9FFF]', throws: true },
    }],
    'jsdoc/require-property-type': 'error',
    'jsdoc/require-property-description': 'error',
    'jsdoc/reject-any-type': 'error',
    'jsdoc/reject-function-type': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'antfu/top-level-function': 'off',
    'antfu/if-newline': 'off',
    'curly': 'off',
    'no-console': 'off',
    'perfectionist/sort-imports': ['error', { groups: ['type', 'builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'style', 'side-effect', 'unknown'] }],
    'perfectionist/sort-named-imports': 'error',
    'perfectionist/sort-exports': 'error',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off',
  },
};

export default antfu({
  typescript: false,
  vue: true,
  stylistic: false,
  jsdoc: false,
  test: false,
  jsonc: false,
  yaml: false,
  markdown: false,
  ignores: ['dist/**', 'node_modules/**'],
}, documentation);
