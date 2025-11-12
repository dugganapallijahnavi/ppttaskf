import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/core';
import './RichTextEditor.css';

const EMPTY_PARAGRAPH = '<p></p>';

// Custom FontSize extension
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace('px', ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}px`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
});

// Custom FontFamily extension
const FontFamily = Extension.create({
  name: 'fontFamily',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily?.replace(/['"]/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontFamily) {
                return {}
              }
              return {
                style: `font-family: ${attributes.fontFamily}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily: fontFamily => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontFamily })
          .run()
      },
      unsetFontFamily: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontFamily: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
});

const RichTextEditor = React.memo(({
  element,
  isSelected,
  onContentChange,
  onFocus,
  onBlur,
  onEditorReady,
  placeholder = 'Write something',
  textScale = 1
}) => {
  const [, forceUpdate] = useState(0);
  const lastSyncedContentRef = useRef(element?.text || '');

  const editor = useEditor(
    {
      extensions: [
        Color.configure({ types: [TextStyle.name] }),
        TextStyle,
        FontSize,
        FontFamily,
        Underline,
        TextAlign.configure({
          defaultAlignment: 'left',
          types: ['heading', 'paragraph']
        }),
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          bulletList: { keepMarks: true, keepAttributes: false },
          orderedList: { keepMarks: true, keepAttributes: false }
        }),
        Placeholder.configure({
          placeholder,
          includeChildren: true
        })
      ],
      content: element?.text || EMPTY_PARAGRAPH,
      editable: Boolean(isSelected),
      editorProps: {
        attributes: {
          class: 'tiptap-editor-content',
          'data-text-editable': 'true',
          spellcheck: 'false',
          translate: 'no'
        }
      },
      onUpdate: ({ editor: activeEditor }) => {
        if (!activeEditor) {
          return;
        }
        const html = activeEditor.getHTML();
        if (html === lastSyncedContentRef.current) {
          return;
        }
        lastSyncedContentRef.current = html;
        const plainText = activeEditor.getText();
        onContentChange?.(html, plainText);
      }
    },
    [element?.id]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    // Notify parent that editor is ready
    onEditorReady?.(editor);

    const handleFocus = () => {
      onFocus?.();
    };
    const handleBlur = () => {
      onBlur?.();
    };
    const handleSelectionUpdate = () => {
      forceUpdate((tick) => tick + 1);
    };

    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('transaction', handleSelectionUpdate);

    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleSelectionUpdate);
    };
  }, [editor, onFocus, onBlur, onEditorReady]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(Boolean(isSelected));
    if (!isSelected) {
      editor.commands.blur();
      return;
    }
    if (!editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [editor, isSelected]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const nextContent = element?.text || EMPTY_PARAGRAPH;
    if (nextContent === lastSyncedContentRef.current) {
      return;
    }
    lastSyncedContentRef.current = nextContent;
    editor.commands.setContent(nextContent, false);
  }, [editor, element?.text, element?.id]);

  const editorStyle = useMemo(() => {
    if (!element) {
      return {};
    }

    const decorations = [];
    if (element.underline) {
      decorations.push('underline');
    }
    if (element.strikethrough) {
      decorations.push('line-through');
    }

    const baseFontSize = element.fontSize || 18;
    const effectiveFontSize = Math.max(Math.round(baseFontSize * textScale), 10);

    return {
      fontFamily: element.fontFamily || 'Inter, sans-serif',
      fontSize: `${effectiveFontSize}px`,
      color: element.color || '#f9fafb',
      textAlign: element.textAlign || 'left',
      fontWeight: element.bold ? 700 : (element.fontWeight || 400),
      fontStyle: element.italic ? 'italic' : 'normal',
      textDecoration: decorations.join(' ') || 'none',
      lineHeight: element.lineHeight ? String(element.lineHeight) : '1.3',
      backgroundColor: element.backgroundColor || 'transparent'
    };
  }, [element, textScale]);

  if (!element) {
    return null;
  }

  return (
    <div className={`rich-text-editor ${isSelected ? 'is-selected' : ''}`} style={editorStyle}>
      <EditorContent editor={editor} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.element?.id === nextProps.element?.id &&
    prevProps.element?.text === nextProps.element?.text &&
    prevProps.element?.fontSize === nextProps.element?.fontSize &&
    prevProps.element?.fontFamily === nextProps.element?.fontFamily &&
    prevProps.element?.color === nextProps.element?.color &&
    prevProps.element?.textAlign === nextProps.element?.textAlign &&
    prevProps.element?.bold === nextProps.element?.bold &&
    prevProps.element?.italic === nextProps.element?.italic &&
    prevProps.element?.underline === nextProps.element?.underline &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.textScale === nextProps.textScale
  );
});

export default RichTextEditor;
