import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TextToolbar.css';

const STYLE_PRESETS = [
  {
    key: 'heading',
    label: 'Heading',
    fontSize: 56,
    fontFamily: 'Playfair Display, serif',
    fontWeight: 700
  },
  {
    key: 'title',
    label: 'Title',
    fontSize: 40,
    fontFamily: 'Playfair Display, serif',
    fontWeight: 600
  },
  {
    key: 'body',
    label: 'Paragraph',
    fontSize: 20,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400
  }
];

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Segoe UI', value: 'Segoe UI, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' }
];

const DEFAULT_COLOR = '#111827';
const HEX_FULL_REGEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_VIEWPORT_WIDTH = 1440;

const normalizeFontValue = (value) => {
  if (!value) {
    return FONT_OPTIONS[0].value;
  }
  const normalized = value.replace(/"/g, '').trim();
  const exact = FONT_OPTIONS.find((item) => item.value === normalized);
  if (exact) {
    return exact.value;
  }
  const family = normalized.split(',')[0].trim();
  const fallback = FONT_OPTIONS.find((item) => item.value.startsWith(family));
  return fallback ? fallback.value : normalized;
};

const toHex = (value) => {
  if (!value) {
    return DEFAULT_COLOR;
  }
  const prefixed = value.startsWith('#') ? value : `#${value}`;
  if (HEX_FULL_REGEX.test(prefixed)) {
    return prefixed.toUpperCase();
  }
  if (/^#?[0-9a-f]{3}$/i.test(value)) {
    const cleaned = value.replace('#', '');
    const expanded = cleaned
      .split('')
      .map((char) => char + char)
      .join('');
    return `#${expanded}`.toUpperCase();
  }
  return DEFAULT_COLOR;
};

const getScaleForWidth = (width) => {
  if (width <= 480) {
    return 0.58;
  }
  if (width <= 640) {
    return 0.64;
  }
  if (width <= 900) {
    return 0.72;
  }
  if (width <= 1200) {
    return 0.82;
  }
  return 1;
};

const getResponsivePreset = (key, width) => {
  const preset = STYLE_PRESETS.find((item) => item.key === key);
  if (!preset) {
    return null;
  }
  const scale = getScaleForWidth(width || DEFAULT_VIEWPORT_WIDTH);
  const scaledSize = Math.max(12, Math.round(preset.fontSize * scale));
  return { ...preset, fontSize: scaledSize };
};

const TextToolbar = ({
  element,
  editor,
  onUpdate,
  onDelete,
  position = { x: 0, y: 0 },
  isVisible = true
}) => {
  const [presetKey, setPresetKey] = useState('body');
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textColor, setTextColor] = useState(DEFAULT_COLOR);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isAlignmentMenuOpen, setIsAlignmentMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : DEFAULT_VIEWPORT_WIDTH
  );
  const styleMenuRef = useRef(null);
  const alignmentMenuRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const applyUpdate = useCallback((patch) => {
    if (!element || typeof onUpdate !== 'function') {
      return;
    }
    onUpdate(element.id, patch);
  }, [element, onUpdate]);

  const responsivePreset = useCallback(
    (key) => getResponsivePreset(key, viewportWidth),
    [viewportWidth]
  );

  const closeMenus = useCallback(() => {
    setIsStyleMenuOpen(false);
    setIsAlignmentMenuOpen(false);
  }, []);

  const applyPreset = useCallback(
    (key) => {
      const preset = responsivePreset(key);
      if (!preset) {
        return;
      }
      setPresetKey(preset.key);
      setFontSize(preset.fontSize);
      setFontFamily(preset.fontFamily);
      applyUpdate({
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        fontWeight: preset.fontWeight,
        textStyle: preset.key
      });
    },
    [applyUpdate, responsivePreset]
  );

  useEffect(() => {
    if (!element) {
      return;
    }
    const styleKey = element.textStyle && element.textStyle !== 'custom'
      ? element.textStyle
      : null;
    if (!styleKey) {
      return;
    }
    const preset = responsivePreset(styleKey);
    if (!preset) {
      return;
    }
    const currentSize = Math.round(element.fontSize || preset.fontSize);
    if (Math.abs(currentSize - preset.fontSize) > 1) {
      onUpdate?.(element.id, { fontSize: preset.fontSize });
    }
  }, [element, onUpdate, responsivePreset, viewportWidth]);

  useEffect(() => {
    if (!element) {
      return;
    }
    const resolvedFamily = normalizeFontValue(element.fontFamily);
    const resolvedColor = toHex(element.color || DEFAULT_COLOR);
    const resolvedSize = Math.round(element.fontSize || 20);

    setFontFamily(resolvedFamily);
    setFontSize(resolvedSize);
    setTextColor(resolvedColor);

    const matchedPreset =
      STYLE_PRESETS.find(
        (item) =>
          item.fontFamily === resolvedFamily &&
          Math.round(item.fontSize) === resolvedSize
      ) || null;
    
    if (element.textStyle) {
      setPresetKey(element.textStyle);
    } else if (matchedPreset) {
      setPresetKey(matchedPreset.key);
    } else {
      // Detect based on fontSize and fontWeight
      const fontWeight = element.fontWeight || 400;
      if (resolvedSize >= 40) {
        setPresetKey('heading');
      } else if (resolvedSize >= 28 && fontWeight >= 600) {
        setPresetKey('title');
      } else {
        setPresetKey('body'); // Default to paragraph for normal text
      }
    }
  }, [element]);

  const toolbarPosition = useMemo(() => {
    const offsetTop = Math.max(position.y - 8, 8);
    return {
      left: position.x,
      top: offsetTop
    };
  }, [position.x, position.y]);

  const handleHeadingChange = (event) => {
    closeMenus();
    applyPreset(event.target.value);
  };

  const handleFontSizeChange = (value) => {
    closeMenus();
    const numeric = Math.max(8, Math.min(200, Number(value) || fontSize));
    setFontSize(numeric);
    setPresetKey('custom');
    
    // If editor is available and has selection, apply font size to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().setFontSize(numeric).run();
    } else {
      // Fallback to updating entire element
      applyUpdate({ fontSize: numeric, textStyle: 'custom' });
    }
  };

  const handleFontFamilyChange = (value) => {
    closeMenus();
    setFontFamily(value);
    setPresetKey('custom');
    
    // If editor is available and has selection, apply font family to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().setFontFamily(value).run();
    } else {
      // Fallback to updating entire element
      applyUpdate({ fontFamily: value, textStyle: 'custom' });
    }
  };

  const applyColor = (hex) => {
    closeMenus();
    const formatted = toHex(hex);
    setTextColor(formatted);
    setPresetKey('custom');
    
    // If editor is available and has selection, apply color to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().setColor(formatted).run();
    } else {
      // Fallback to updating entire element
      applyUpdate({ color: formatted });
    }
  };

  const handleColorPickerChange = (event) => {
    const value = event.target.value;
    if (value) {
      applyColor(value);
    }
  };

  const toggleBold = useCallback(() => {
    if (!element) {
      return;
    }
    
    setIsStyleMenuOpen(false);

    // If editor is available and has selection, apply bold to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().toggleBold().run();
    } else {
      // Fallback to updating entire element
      const nextBold = !element.bold;
      applyUpdate({
        bold: nextBold,
        fontWeight: nextBold ? Math.max(element.fontWeight || 600, 600) : 400,
        textStyle: 'custom'
      });
    }
  }, [element, editor, applyUpdate]);

  const toggleItalic = useCallback(() => {
    if (!element) {
      return;
    }

    setIsStyleMenuOpen(false);

    // If editor is available and has selection, apply italic to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().toggleItalic().run();
    } else {
      // Fallback to updating entire element
      applyUpdate({
        italic: !element.italic,
        textStyle: 'custom'
      });
    }
  }, [element, editor, applyUpdate]);

  const toggleUnderline = useCallback(() => {
    if (!element) {
      return;
    }

    setIsStyleMenuOpen(false);

    // If editor is available and has selection, apply underline to selected text
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus().toggleUnderline().run();
    } else {
      // Fallback to updating entire element
      applyUpdate({
        underline: !element.underline,
        textStyle: 'custom'
      });
    }
  }, [element, editor, applyUpdate]);

  const handleAlignmentChange = useCallback((alignment) => {
    if (!element) {
      return;
    }

    setIsAlignmentMenuOpen(false);
    setIsStyleMenuOpen(false);

    if (editor) {
      editor.chain().focus().setTextAlign(alignment).run();
    }

    applyUpdate({ textAlign: alignment, textStyle: 'custom' });
  }, [applyUpdate, editor, element]);

  useEffect(() => {
    if (!isStyleMenuOpen) {
      return undefined;
    }

    const handleClickAway = (event) => {
      if (!styleMenuRef.current || styleMenuRef.current.contains(event.target)) {
        return;
      }
      setIsStyleMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickAway);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isStyleMenuOpen]);

  const toggleStyleMenu = () => {
    setIsStyleMenuOpen((current) => {
      const next = !current;
      if (!current) {
        setIsAlignmentMenuOpen(false);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isAlignmentMenuOpen) {
      return undefined;
    }

    const handleClickAway = (event) => {
      if (!alignmentMenuRef.current || alignmentMenuRef.current.contains(event.target)) {
        return;
      }
      setIsAlignmentMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickAway);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isAlignmentMenuOpen]);

  const toggleAlignmentMenu = () => {
    setIsAlignmentMenuOpen((current) => {
      const next = !current;
      if (!current) {
        setIsStyleMenuOpen(false);
      }
      return next;
    });
  };

  const boldActive = (editor && editor.isActive('bold')) || !!element?.bold;
  const italicActive = (editor && editor.isActive('italic')) || !!element?.italic;
  const underlineActive = (editor && editor.isActive('underline')) || !!element?.underline;
  const alignment = editor?.isActive({ textAlign: 'center' })
    ? 'center'
    : editor?.isActive({ textAlign: 'right' })
    ? 'right'
    : element?.textAlign || 'left';
  const alignmentLabel = alignment.charAt(0).toUpperCase() + alignment.slice(1);

  const handleDelete = useCallback(() => {
    if (!element || typeof onDelete !== 'function') {
      return;
    }
    closeMenus();
    onDelete(element.id);
  }, [element, onDelete, closeMenus]);


  if (!isVisible || !element) {
    return null;
  }

  return (
    <div
      className="text-toolbar-wrapper"
      style={{
        left: toolbarPosition.left,
        top: toolbarPosition.top,
        transform: 'translateX(-50%)'
      }}
    >
      <div
        className="text-toolbar-card"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="toolbar-item preset">
          <select
            aria-label="Text preset"
            value={presetKey === 'custom' ? 'body' : presetKey}
            onChange={handleHeadingChange}
          >
            {STYLE_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-item size">
          <input
            aria-label="Font size"
            type="number"
            min={8}
            max={200}
            value={fontSize}
            onChange={(event) => handleFontSizeChange(event.target.value)}
          />
        </div>

        <div className="toolbar-item font">
          <select
            aria-label="Font family"
            value={fontFamily}
            onChange={(event) => handleFontFamilyChange(event.target.value)}
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-item color">
          <input
            aria-label="Text color"
            type="color"
            value={textColor}
            onChange={handleColorPickerChange}
          />
        </div>

        <div className="toolbar-item styles" ref={styleMenuRef}>
          <button
            type="button"
            className={`text-style-trigger${isStyleMenuOpen ? ' is-open' : ''}`}
            onClick={toggleStyleMenu}
            aria-haspopup="true"
            aria-expanded={isStyleMenuOpen}
          >
            <span className="style-trigger-label">Style</span>
            <span className="style-trigger-caret" aria-hidden="true">▾</span>
          </button>
          {isStyleMenuOpen && (
            <div className="text-style-menu" role="menu">
              <label className={`text-style-option${boldActive ? ' is-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={boldActive}
                  onChange={toggleBold}
                />
                <span>B</span>
                <span className="option-label">Bold</span>
              </label>
              <label className={`text-style-option${italicActive ? ' is-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={italicActive}
                  onChange={toggleItalic}
                />
                <span>I</span>
                <span className="option-label">Italic</span>
              </label>
              <label className={`text-style-option${underlineActive ? ' is-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={underlineActive}
                  onChange={toggleUnderline}
                />
                <span>U</span>
                <span className="option-label">Underline</span>
              </label>
            </div>
          )}
        </div>

        <div className="toolbar-item alignment" ref={alignmentMenuRef}>
          <button
            type="button"
            className={`text-alignment-trigger${isAlignmentMenuOpen ? ' is-open' : ''}`}
            onClick={toggleAlignmentMenu}
            aria-haspopup="true"
            aria-expanded={isAlignmentMenuOpen}
          >
            <span className={`alignment-icon alignment-${alignment}`} aria-hidden="true" />
            <span className="alignment-label">{alignmentLabel}</span>
            <span className="style-trigger-caret" aria-hidden="true">▾</span>
          </button>
          {isAlignmentMenuOpen && (
            <div className="text-alignment-menu" role="menu">
              {['left', 'center', 'right'].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`text-alignment-option${alignment === option ? ' is-active' : ''}`}
                  onClick={() => {
                    handleAlignmentChange(option);
                    setIsAlignmentMenuOpen(false);
                  }}
                  role="menuitemradio"
                  aria-checked={alignment === option}
                >
                  <span className={`alignment-icon alignment-${option}`} aria-hidden="true" />
                  <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                  {alignment === option && <span className="alignment-check" aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-item delete">
          <button
            type="button"
            className="text-toolbar-delete"
            onClick={handleDelete}
            disabled={typeof onDelete !== 'function'}
          >
            Delete
          </button>
        </div>

      </div>
    </div>
  );
};

export default React.memo(TextToolbar, (prevProps, nextProps) => {
  // Prevent re-render if element and position haven't changed
  return (
    prevProps.element?.id === nextProps.element?.id &&
    prevProps.element?.fontSize === nextProps.element?.fontSize &&
    prevProps.element?.fontFamily === nextProps.element?.fontFamily &&
    prevProps.element?.color === nextProps.element?.color &&
    prevProps.element?.bold === nextProps.element?.bold &&
    prevProps.element?.italic === nextProps.element?.italic &&
    prevProps.element?.underline === nextProps.element?.underline &&
    prevProps.position?.x === nextProps.position?.x &&
    prevProps.position?.y === nextProps.position?.y &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.editor === nextProps.editor
  );
});
