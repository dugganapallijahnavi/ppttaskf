import React, { useCallback, useEffect, useRef, useState } from 'react';
import './EnhancedToolbar.css';

const INSERT_OPTIONS = [
  { key: 'text', label: 'TEXT' },
  { key: 'image', label: 'IMAGE' },
  { key: 'shape', label: 'SHAPES' },
  { key: 'chart', label: 'CHARTS' }
];

const SHAPE_OPTIONS = [
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'circle', label: 'Circle' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'star', label: 'Star' }
];

const CHART_OPTIONS = [
    { key: 'bar', label: 'Bar', description: 'Horizontal bars for ranking data' },
    { key: 'area', label: 'Area', description: 'Filled line chart for totals' },
  { key: 'pie', label: 'Pie', description: 'Show parts of a whole' },
  { key: 'columnLine', label: 'Column + Line', description: 'Combine columns with a trend line' }
];

const EnhancedToolbar = ({
  onInsertElement,
  onDownloadPresentation,
  onStartSlideshow,
  keepInsertEnabled = false,
  onToggleKeepInsert,
  fileName = 'untitled',
  onFileNameChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onExitEditor,
  designOptions = [],
  activeDesignId,
  onSelectDesign,
  onFilesMenuToggle
}) => {
  const [activePanel, setActivePanel] = useState(null);
  const [isDesignPanelOpen, setIsDesignPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const toolbarRef = useRef(null);
  const toolbarLeftRef = useRef(null);
  const designPanelRef = useRef(null);
  const filesMenuRef = useRef(null);
  const [isFilesMenuOpen, setIsFilesMenuOpen] = useState(false);
  const insertButtonRefs = useRef({});
  const [panelPosition, setPanelPosition] = useState({ left: 0 });

  const updatePanelPosition = useCallback((type) => {
    const buttonNode = insertButtonRefs.current?.[type];
    const containerNode = toolbarLeftRef.current;
    if (!buttonNode || !containerNode) {
      return;
    }

    const buttonRect = buttonNode.getBoundingClientRect();
    const containerRect = containerNode.getBoundingClientRect();
    setPanelPosition({
      left: buttonRect.left - containerRect.left + buttonRect.width / 2
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (activePanel === 'shape' || activePanel === 'chart') {
        updatePanelPosition(activePanel);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activePanel, updatePanelPosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const toolbarNode = toolbarRef.current;
      const panelNode = panelRef.current;
      const designNode = designPanelRef.current;
      const filesNode = filesMenuRef.current;
      if (
        toolbarNode &&
        panelNode &&
        !toolbarNode.contains(event.target) &&
        !panelNode.contains(event.target)
      ) {
        setActivePanel(null);
      }

      if (
        designNode &&
        !designNode.contains(event.target) &&
        !toolbarNode?.contains(event.target)
      ) {
        setIsDesignPanelOpen(false);
        setIsFilesMenuOpen(false);
        onFilesMenuToggle?.(false);
      }

      if (filesNode && !filesNode.contains(event.target)) {
        setIsFilesMenuOpen(false);
        onFilesMenuToggle?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onFilesMenuToggle]);

  const handlePrimaryInsert = (type) => {
    setIsDesignPanelOpen(false);
    if (isFilesMenuOpen) {
      setIsFilesMenuOpen(false);
      onFilesMenuToggle?.(false);
    }
    if (type === 'shape' || type === 'chart') {
      if (activePanel === type) {
        setActivePanel(null);
      } else {
        updatePanelPosition(type);
        setActivePanel(type);
      }
      return;
    }

    onInsertElement?.(type);
  };

  const handlePanelInsert = (type, subtype) => {
    onInsertElement?.(type, subtype);
    if (!keepInsertEnabled) {
      setActivePanel(null);
    }
  };

  const handleFileOpen = () => {
    setIsFilesMenuOpen(false);
    onFilesMenuToggle?.(false);
    onExitEditor?.();
  };

  const handleFileSave = () => {
    onDownloadPresentation?.('pptx');
    setIsFilesMenuOpen(false);
    onFilesMenuToggle?.(false);
  };

  const renderPanelContent = () => {
    if (activePanel === 'shape') {
      return (
        <>
          <span className="panel-title">Shapes</span>
          {SHAPE_OPTIONS.map((shape) => (
            <button
              key={shape.key}
              type="button"
              className="panel-option"
              onClick={() => handlePanelInsert('shape', shape.key)}
            >
              {shape.label}
            </button>
          ))}
        </>
      );
    }

    if (activePanel === 'chart') {
      return (
        <>
          <span className="panel-title">Charts</span>
          {CHART_OPTIONS.map((chart) => (
            <button
              key={chart.key}
              type="button"
              className="panel-option"
              onClick={() => handlePanelInsert('chart', chart.key)}
            >
              <span className="panel-option-label">{chart.label}</span>
              <span className="panel-option-help">{chart.description}</span>
            </button>
          ))}
        </>
      );
    }

    return null;
  };

  const getButtonIcon = (key) => {
    switch (key) {
      case 'text':
        return 'T';
      case 'image':
        return <span className="image-icon" aria-hidden="true" />;
      case 'shape':
        return '◇';
      case 'chart':
        return '📊';
      case 'table':
        return '⊞';
      default:
        return '';
    }
  };

  const renderDesignPreview = (design) => {
    if (!design) {
      return null;
    }
    const colors = Array.isArray(design.preview) && design.preview.length
      ? design.preview
      : [design.background, design.accentColor];

    return (
      <div className="design-preview-chip">
        {colors.filter(Boolean).slice(0, 3).map((color, index) => (
          <span
            key={`${design.id}-color-${index}`}
            className="design-preview-swatch"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="enhanced-toolbar" ref={toolbarRef}>
      <div className="toolbar-left" ref={toolbarLeftRef}>
        <div className="files-menu-wrapper" ref={filesMenuRef}>
          <button
            type="button"
            className={`toolbar-button files-button ${isFilesMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setActivePanel(null);
              setIsDesignPanelOpen(false);
              setIsFilesMenuOpen((prev) => {
                const next = !prev;
                onFilesMenuToggle?.(next);
                return next;
              });
            }}
            title="Files"
          >
            <span className="button-icon" aria-hidden="true">📁</span>
            <span className="button-text">Files</span>
          </button>
          {isFilesMenuOpen && (
            <div className="files-menu">
              {typeof onExitEditor === 'function' && (
                <button type="button" onClick={handleFileOpen}>
                  <span className="option-label">Open</span>
                </button>
              )}
              <button type="button" onClick={handleFileSave}>
                <span className="option-label">Save</span>
                <span className="option-hint">(.pptx)</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`toolbar-button design-button ${isDesignPanelOpen ? 'active' : ''}`}
          onClick={() => {
            setActivePanel(null);
            if (isFilesMenuOpen) {
              setIsFilesMenuOpen(false);
              onFilesMenuToggle?.(false);
            }
            setIsDesignPanelOpen((prev) => !prev);
          }}
          title="Designs"
        >
          <span className="button-icon">🎨</span>
          <span className="button-text">Designs</span>
        </button>

        <div className="toolbar-divider" />

        {INSERT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`toolbar-button icon-button ${activePanel === option.key ? 'active' : ''}`}
            onClick={() => handlePrimaryInsert(option.key)}
            ref={(node) => {
              if (node) {
                insertButtonRefs.current[option.key] = node;
              } else {
                delete insertButtonRefs.current[option.key];
              }
            }}
          >
            <span className="button-icon">{getButtonIcon(option.key)}</span>
            <span className="button-text">{option.label.charAt(0) + option.label.slice(1).toLowerCase()}</span>
          </button>
        ))}

        <div className="toolbar-divider" />

        <button
          type="button"
          className="toolbar-button undo-redo-button"
          onClick={() => onUndo?.()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <span className="button-icon">←</span>
          <span className="button-text">Undo</span>
        </button>
        
        <button
          type="button"
          className="toolbar-button undo-redo-button"
          onClick={() => onRedo?.()}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <span className="button-icon">→</span>
          <span className="button-text">Redo</span>
        </button>
        {activePanel && (
          <div
            className="toolbar-panel"
            ref={panelRef}
            style={{ left: panelPosition.left, transform: 'translateX(-50%)' }}
          >
            <div className="panel-options">{renderPanelContent()}</div>
          </div>
        )}
      </div>

      <div className="toolbar-right">
        <input
          type="text"
          className="filename-input"
          placeholder="Enter filename"
          value={fileName}
          onChange={(e) => onFileNameChange?.(e.target.value)}
          maxLength={50}
        />
        <button type="button" className="toolbar-button presentation-button" onClick={() => onStartSlideshow?.()}>
          <span className="button-text">Presentation</span>
        </button>
      </div>

      {isDesignPanelOpen && (
        <div className="design-panel" ref={designPanelRef}>
          <div className="design-panel-header">
            <span className="panel-title">Designs</span>
            <button
              type="button"
              className="close-design-panel"
              onClick={() => setIsDesignPanelOpen(false)}
              aria-label="Close design panel"
            >
              ×
            </button>
          </div>
          <div className="design-list">
            {designOptions.length === 0 && (
              <div className="design-empty-state">No design presets available.</div>
            )}
            {designOptions.map((design) => {
              const isActive = design.id === activeDesignId;
              return (
                <button
                  key={design.id}
                  type="button"
                  className={`design-option ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectDesign?.(design.id);
                    setIsDesignPanelOpen(false);
                  }}
                >
                  {renderDesignPreview(design)}
                  <div className="design-option-info">
                    <span className="design-option-name">{design.name}</span>
                    {design.description && (
                      <span className="design-option-desc">{design.description}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedToolbar;





