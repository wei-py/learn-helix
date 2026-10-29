/**
 * 跨功能共享的纯编辑器与学习记录。
 * 普通与选择模式使用包含两端的 UTF-16 偏移，插入模式使用字符边界。
 * 这些记录保留既有本地存储格式，不改变课程与键位的稳定标识。
 * @typedef {'normal' | 'select' | 'insert'} Mode
 * @typedef {{anchor: number, head: number, goalColumn?: number | null}} Selection
 * @typedef {{from: number, to: number, text: string}} TextEdit
 * @typedef {{count?: number | string, char?: string, object?: string, pattern?: string, register?: string}} CommandArgs
 * @typedef {{type?: 'command', command: string, args: CommandArgs} | {type: 'text', text: string} | {type: 'backspace'}} MacroEvent
 * @typedef {{text: string, anchor: number, head: number, mode: Mode, wordBoundary?: number | null, goalColumn?: number | null, selections?: Selection[], primaryIndex?: number, goalColumns?: (number | null)[]}} EditorSnapshot
 * @typedef {EditorSnapshot & {history: EditorSnapshot[], advanced?: boolean, redo?: EditorSnapshot[], registers?: Record<string, string[]>, macros?: Record<string, MacroEvent[]>, macroRecording?: {register: string, events: MacroEvent[]} | null, macroStack?: string[], searchPattern?: string, lastMotion?: {command: string, args: CommandArgs}, indentWidth?: number}} EditorState
 * @typedef {EditorState & {selections: Selection[], primaryIndex: number, redo: EditorSnapshot[], registers: Record<string, string[]>, macros: Record<string, MacroEvent[]>, macroRecording: {register: string, events: MacroEvent[]} | null}} AdvancedState
 * @typedef {{type?: 'command', mode: Mode, action: string, args?: CommandArgs} | {type: 'text', text: string}} LessonStep
 * @typedef {{id: string, category: string, title: string, description: string, text: string, cursor: number, steps: LessonStep[], goal: EditorSnapshot & {registers?: Record<string, string[]>}, concept: string, tip: string, advanced?: boolean, theme?: string, source?: ArticleSource}} Lesson
 * @typedef {{text: string, cursor: number, advanced?: boolean, category?: string}} StateSeed
 * @typedef {{id: string, label: string, icon: string, description: string}} Category
 * @typedef {{name: string, label: string, required: boolean, defaultValue?: string}} InteractionField
 * @typedef {{kind: string, prompt: string, fields: InteractionField[]}} Interaction
 * @typedef {Record<string, string>} Bindings
 * @typedef {{kind: string, label: string, steps: number}} CatalogInput
 * @typedef {{mode: Mode, key: string, keys: string[], command: string | string[], label: string, description: string, group: string, sourceGroup: string, prefix: string[], sticky: boolean, input?: CatalogInput}} KeymapRow
 * @typedef {{mode: string, id: string, command: string | string[], key: string, label: string | string[], group: string, invalid?: boolean, keys?: string[], description?: string, sourceGroup?: string, prefix?: string[], sticky?: boolean, input?: CatalogInput}} BindingAction
 * @typedef {{name: string, description: string, kind: string, aliases?: string[], minArgs?: number, maxArgs?: number | null}} CatalogCommand
 * @typedef {{mode: Mode, key: string, keys: string[], label: string, group: string, sticky: boolean, inheritsSticky: boolean}} PrefixNode
 * @typedef {{kind: string, url: string, snapshot: string, sha256: string}} CatalogSource
 * @typedef {{version: string, retrievedAt: string, sources: CatalogSource[], counts: Record<string, number>, scope: string, selectResolution: string, parameterMetadataScope: string}} CatalogMeta
 * @typedef {{values: Bindings, errors: Record<string, string>, valid: boolean}} BindingValidation
 * @typedef {{tokens: string[], sequence: string, action?: BindingAction, status: 'action' | 'prefix' | 'unbound'}} KeyResolution
 * @typedef {{children: Map<string, BindingTree>, command?: string | string[]}} BindingTree
 * @typedef {{key: string, code?: string, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean, metaKey?: boolean, getModifierState?: (name: string) => boolean}} KeyEvent
 * @typedef {{title: string, author: string, url: string, section?: string}} ArticleSource
 * @typedef {{id: string, title: string, anchor: string, lessons: string[]}} ArticleChapter
 * @typedef {{name: string}} QuestionOption
 * @typedef {{id: string, type: 'command' | 'concept' | 'binding', description: string, command?: string, answer?: string, options?: QuestionOption[], explanation?: string, source?: ArticleSource, key?: string, mode?: Mode, officialDescription?: string, action?: BindingAction}} RecallQuestion
 * @typedef {{getItem: (key: string) => string | null | undefined}} StorageReader
 * @typedef {{setItem: (key: string, value: string) => void}} StorageWriter
 * @typedef {{bindings: Bindings, completed: string[], restored: boolean, knowledge?: string[], warning?: string}} SavedState
 * @typedef {{version: number, bindings: Bindings, completed: string[], knowledge?: string[]}} SavedPayload
 * @typedef {string | number | boolean | null | JsonValue[] | {[key: string]: JsonValue}} JsonValue
 * @typedef {{bindings: Bindings, mode: Mode, advanced: boolean, pending: string[], countInput: string, key: string, rawText?: string, fresh?: boolean}} PracticeInput
 * @typedef {{status: 'action' | 'prefix' | 'unbound' | 'count' | 'cancel' | 'text', pending: string[], countInput: string, action?: BindingAction, tokens?: string[], sequence?: string, text?: string}} PracticeResolution
 * @typedef {{stepIndex: number, typed: string, expected?: string, status: 'unexpected' | 'matched' | 'typing' | 'mismatch'}} TextProgress
 * @typedef {(position: number, affinity?: 'left' | 'right') => number} OffsetMapper
 * @typedef {{start: number, end: number, endWithNewline: number}} LineExtent
 * @typedef {{start: number, end: number, column: number}} LinePosition
 * @typedef {{kind: 'text' | 'key' | 'control' | 'submit', value: string} | {kind: 'count', value: number | string} | {kind: 'operand', name: string, label: string, value: string | number} | {kind: 'unbound', command: string | string[]}} AnswerOperation
 * @typedef {{mode: Mode, command?: string | string[], operations: AnswerOperation[]}} AnswerStep
 */
export {};
