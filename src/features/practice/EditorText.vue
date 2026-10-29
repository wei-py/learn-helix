<script setup>
import { computed } from 'vue';
/**
 * 原生编辑器文本展示参数。
 * @type {{state:import('../../stores/types.js').EditorState,preview?:boolean}}
 */
const props = defineProps({ state: { type: Object, required: true }, preview: Boolean });
/**
 * 选区两端均包含字符，并保留原引擎的文件末尾虚拟位置。
 * @type {import('vue').ComputedRef<import('../../stores/types.js').EditorLine[]>}
 */
const lines = computed(/**
 * 用于展示的代码行。
 * @returns {import('../../stores/types.js').EditorLine[]} 用于展示的代码行。
 */ () => {
  /**
   * 编辑器所有真实选区。
   * @type {{anchor:number,head:number}[]}
   */ const ranges = props.state.selections || [{ anchor: props.state.anchor, head: props.state.head }];
  /**
   * 代码行累计字符偏移。
   * @type {number}
   */ let offset = 0;
  return props.state.text.split('\n').map(/**
   * 代码行展示模型。
   * @param {string} line 文本行。
   * @param {number} index 行序号。
   * @returns {import('../../stores/types.js').EditorLine} 代码行展示模型。
   */ (line, index) => {
    /**
     * 当前代码行起始偏移。
     * @type {number}
     */ const start = offset; offset += line.length + 1;
    /**
     * 代码行内的字符与光标展示模型。
     * @type {import('../../stores/types.js').EditorCharacter[]}
     */ const characters = (line || ' ').split('').map(/**
      * 字符展示状态。
      * @param {string} value UTF-16 显示单元。
      * @param {number} column 字符偏移。
      * @returns {import('../../stores/types.js').EditorCharacter} 字符展示状态。
      */ (value, column) => {
      /**
       * 字符在完整文本中的偏移。
       * @type {number}
       */ const position = start + column;
      /**
       * 字符是否处于包含式选区。
       * @type {boolean}
       */ const selected = props.state.mode !== 'insert' && ranges.some(/**
        * 是否位于包含两端的选区内。
        * @param {{anchor:number,head:number}} range 编辑器选区。
        * @returns {boolean} 是否位于包含两端的选区内。
        */ (range) => position >= Math.min(range.anchor, range.head) && position <= Math.max(range.anchor, range.head));
      return { position, value, selected, head: position === props.state.head && selected, caret: props.state.mode === 'insert' && ranges.some(/**
       * 是否为插入光标。
       * @param {{anchor:number,head:number}} range 编辑器选区。
       * @returns {boolean} 是否为插入光标。
       */ (range) => position === range.head) };
    });
    /**
     * 当前代码行末尾位置。
     * @type {number}
     */ const end = start + line.length;
    /**
     * 行尾是否需要插入光标。
     * @type {boolean}
     */ const insertEnd = props.state.mode === 'insert' && ranges.some(/**
      * 是否在行尾插入。
      * @param {{anchor:number,head:number}} range 编辑器选区。
      * @returns {boolean} 是否在行尾插入。
      */ (range) => range.head === end);
    /**
     * 文件末尾是否需要虚拟选区字符。
     * @type {boolean}
     */ const virtualEnd = props.state.mode !== 'insert' && end === props.state.text.length && ranges.some(/**
      * 是否包含文件末尾虚拟位置。
      * @param {{anchor:number,head:number}} range 编辑器选区。
      * @returns {boolean} 是否包含文件末尾虚拟位置。
      */ (range) => Math.min(range.anchor, range.head) <= end && Math.max(range.anchor, range.head) >= end);
    if (line.length && (insertEnd || virtualEnd)) characters.push({ position: end, value: ' ', selected: !insertEnd, head: !insertEnd, caret: insertEnd, label: insertEnd ? '插入点' : '文件末尾虚拟位置' });
    return { number: index + 1, characters };
  });
});
</script>
<template>
  <div v-for="line in lines" :key="line.number" class="code-line"><span class="line-number" aria-hidden="true">{{ line.number }}</span><span class="line-content"><span v-for="character in line.characters" :key="character.position" class="char" :class="{selected:character.selected,head:character.head,caret:character.caret}" :aria-label="character.label">{{ character.value }}</span></span></div>
  <div v-if="!preview" class="editor-empty" aria-hidden="true">~<br>~<br>~</div>
</template>
