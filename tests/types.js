/**
 * 回归测试使用的内存存储、输入会话和原生配置树。
 * @typedef {import('../src/domain/types.js').EditorState} EditorState
 * @typedef {import('../src/domain/types.js').PracticeResolution} PracticeResolution
 * @typedef {import('../src/domain/types.js').CommandArgs} CommandArgs
 * @typedef {{[key: string]: string | string[] | TomlFixture}} TomlFixture
 * @typedef {{map: Map<string, string>, getItem: (key: string) => string | null, setItem: (key: string, value: string) => void}} MemoryStorage
 * @typedef {{rawText?: string, args?: CommandArgs, fresh?: boolean}} PressOptions
 * @typedef {{press: (key: string, options?: PressOptions) => PracticeResolution, text: (value: string, erase?: boolean) => void, readonly state: EditorState, readonly pending: string[], readonly countInput: string, readonly stepIndex: number, readonly complete: boolean}} PracticeHarness
 */
export {};
