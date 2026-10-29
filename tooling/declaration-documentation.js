/**
 * 规则使用的带父节点 ESTree 节点，兼容 Vue 脚本解析结果。
 * @typedef {import('estree').Node & {parent?: import('estree').Node, params?: import('estree').Pattern[], declarations?: import('estree').VariableDeclarator[]}} DocumentedNode
 */

/**
 * 从标签中读取完整类型，支持嵌套对象和函数签名。
 * @param {string} text 文档文本。
 * @param {string} tag 标签名称。
 * @returns {string[]} 找到的完整类型。
 */
function typesFor(text, tag) {
  /**
   * 保存括号完整匹配的类型文本，避免截断对象签名。
   * @type {string[]}
   */
  const types = [];
  /**
   * 按指定标签查找类型起始位置。
   * @type {RegExp}
   */
  const pattern = new RegExp(`@${  tag  }\\s*\\{`, 'gu');
  /**
   * 记录当前标签匹配，逐一处理而不跳过局部声明。
   * @type {RegExpExecArray | null}
   */
  let match = pattern.exec(text);
  while (match) {
    /**
     * 类型内容起始位置，不包含外层花括号。
     * @type {number}
     */
    const start = match.index + match[0].length;
    /**
     * 对象签名的花括号深度，归零才算完整类型。
     * @type {number}
     */
    let depth = 1;
    /**
     * 当前类型扫描位置。
     * @type {number}
     */
    let cursor = start;
    for (; cursor < text.length && depth; cursor += 1) {
      if (text[cursor] === '{') depth += 1;
      if (text[cursor] === '}') depth -= 1;
    }
    if (!depth) types.push(text.slice(start, cursor - 1).trim());
    match = pattern.exec(text);
  }
  return types;
}

/**
 * 针对全部声明实施文档覆盖，不限于导出 API。
 * @type {import('eslint').Rule.RuleModule}
 */
const declarationDocumentation = {
  meta: {
    type: 'problem',
    docs: { description: '要求所有变量、函数和回调具有完整的中文 JSDoc 类型契约' },
    schema: [],
    messages: {
      variable: '每个变量声明都必须使用包含具体类型的 @type JSDoc。',
      function: '每个函数及回调必须有 JSDoc、对应参数的 @param 类型和 @returns 类型。',
      concrete: 'JSDoc 不允许 any、通配符或没有成员约束的 Object、object、Array、Function。',
      chinese: 'JSDoc 的职责与参数说明必须使用中文。',
    },
  },
  /**
   * 对全部 JavaScript 和 Vue 脚本声明执行覆盖检查。
   * @param {import('eslint').Rule.RuleContext} context ESLint 检查上下文。
   * @returns {import('eslint').Rule.RuleListener} AST 访问器。
   */
  create(context) {
    /**
     * 统一使用当前文件的解析文本与注释。
     * @type {import('eslint').SourceCode}
     */
    const source = context.sourceCode;
    /**
     * 允许声明外层的有限包装节点，禁止借用外层函数文档。
     * @type {Set<string>}
     */
    const wrappers = new Set(['VariableDeclarator', 'VariableDeclaration', 'ExportNamedDeclaration', 'ExportDefaultDeclaration', 'Property', 'PropertyDefinition', 'MethodDefinition', 'ExpressionStatement', 'CallExpression', 'ForOfStatement', 'ForInStatement', 'ForStatement', 'AssignmentExpression']);

    /**
     * 仅寻找紧贴声明或包装表达式的文档，不能借用外层函数的注释。
     * @param {DocumentedNode} original 当前声明。
     * @returns {string} 紧邻文档文本。
     */
    function documentation(original) {
      /**
       * 沿有限包装节点寻找紧邻文档。
       * @type {DocumentedNode | undefined}
       */
      let node = original;
      while (node) {
        /**
         * 当前声明前最后一个注释，必须为紧邻 JSDoc。
         * @type {import('estree').Comment | undefined}
         */
        const comment = source.getCommentsBefore(node).at(-1);
        if (comment?.type === 'Block' && comment.value.startsWith('*') && !source.text.slice(comment.range[1], node.range[0]).trim()) return comment.value;
        if (!node.parent || !wrappers.has(node.parent.type)) break;
        node = node.parent;
      }
      return '';
    }

    /**
     * 检查所有局部变量，包含循环声明与解构声明。
     * @param {DocumentedNode} node 变量声明。
     * @returns {void}
     */
    function variable(node) {
      /**
       * 变量自己的完整文档必须同时说明业务约束，不能只写类型标签。
       * @type {string}
       */
      const text = documentation(node);
      if (typesFor(text, 'type').length === 0) context.report({ node, messageId: 'variable' });
      if (!/[\u3400-\u9FFF]/u.test(text.split('@')[0])) context.report({ node, messageId: 'chinese' });
    }

    /**
     * 检查函数声明、对象方法和匿名回调，不只检查导出函数。
     * @param {DocumentedNode} node 函数节点。
     * @returns {void}
     */
    function callable(node) {
      /**
       * 当前函数自己的文档，不继承父函数契约。
       * @type {string}
       */
      const text = documentation(node);
      /**
       * 实际声明的参数类型标签数量。
       * @type {number}
       */
      const params = typesFor(text, 'param').length;
      if (!text || params < (node.params?.length ?? 0) || typesFor(text, 'returns?').length === 0) context.report({ node, messageId: 'function' });
      if (!/[\u3400-\u9FFF]/u.test(text.split('@')[0])) context.report({ node, messageId: 'chinese' });
    }

    return {
      /**
       * 扫描所有文档类型并拒绝失去约束的宽泛类型。
       * @returns {void}
       */
      Program() {
        /**
         * 当前声明前最后一个注释，必须为紧邻 JSDoc。
         * @type {import('estree').Comment}
         */
        for (const comment of source.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) continue;
          /**
           * 保存括号完整匹配的类型文本，避免截断对象签名。
           * @type {string[]}
           */
          const types = typesFor(comment.value, '(?:type|typedef|param|returns?|property)');
          /**
           * 逐个检查的显式类型签名。
           * @type {string}
           */
          for (const type of types) {
            /**
             * 字符串字面量是允许的具体类型，不能把其中的单词误判为宽泛类型。
             * @type {string}
             */
            const signature = type.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/gu, '');
            if (/\bany\b(?!\s*(?:\?\s*)?:)|(?:^|[<|,:( ])\*(?=$|[>|,): \]])|\b(?:Object|Array|Function|object)\b(?!\s*(?:[<.:]|\?\s*:))/u.test(signature) && !(type === 'object' && /@typedef\b/u.test(comment.value) && /@property\b/u.test(comment.value))) {
              context.report({ loc: comment.loc, messageId: 'concrete' });
              break;
            }
          }
          if (/@(?:type|param|returns?|property|description)\b/u.test(comment.value) && !/[\u3400-\u9FFF]/u.test(comment.value.split('@')[0])) context.report({ loc: comment.loc, messageId: 'chinese' });
        }
      },
      VariableDeclaration: variable,
      FunctionDeclaration: callable,
      FunctionExpression: callable,
      ArrowFunctionExpression: callable,
    };
  },
};

export default declarationDocumentation;
