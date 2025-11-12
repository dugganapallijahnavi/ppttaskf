import React, { useEffect, useMemo, useState } from 'react';
import './SlidePanel.css';
import { SLIDE_LAYOUTS, DEFAULT_LAYOUT_ID } from '../data/slideLayouts';

const CHART_PREVIEW_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#a855f7',
  '#14b8a6',
  '#f97316'
];

const datasetColor = (dataset, index = 0) => {
  if (dataset) {
    if (Array.isArray(dataset.segmentColors) && dataset.segmentColors[index]) {
      return dataset.segmentColors[index];
    }
    if (dataset.color) {
      return dataset.color;
    }
    if (dataset.backgroundColor) {
      return dataset.backgroundColor;
    }
  }
  return CHART_PREVIEW_COLORS[index % CHART_PREVIEW_COLORS.length];
};

const ensureNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const SLIDE_BASE_WIDTH = 960;
const SLIDE_BASE_HEIGHT = 540;
const THUMBNAIL_WIDTH_DEFAULT = 200;
const getThumbnailWidthForViewport = (width) => {
  if (!Number.isFinite(width)) {
    return THUMBNAIL_WIDTH_DEFAULT;
  }
  if (width <= 600) {
    return 140;
  }
  if (width <= 900) {
    return 160;
  }
  if (width <= 1200) {
    return 180;
  }
  return THUMBNAIL_WIDTH_DEFAULT;
};

const extractChartPreview = (element) => {
  const chartType = element.chartType || element.chartData?.type || 'bar';
  const chartData = element.chartData;

  const fallback = (() => {
    const labels = Array.isArray(chartData?.labels) ? chartData.labels : ['Item 1'];
    const datasets = Array.isArray(chartData?.datasets) && chartData.datasets.length
      ? chartData.datasets
      : [{ id: 'series-0', label: 'Series 1', color: CHART_PREVIEW_COLORS[0], data: labels.map(() => 0) }];
    return { chartType, labels, datasets };
  })();

  if (chartData && Array.isArray(chartData.labels) && chartData.labels.length) {
    return fallback;
  }

  const slideSeries = Array.isArray(element.series) ? element.series : [];
  const slideData = Array.isArray(element.data) ? element.data : [];

  const labels = slideData.length
    ? slideData.map((point, index) => point?.label || `Item ${index + 1}`)
    : fallback.labels;

  let normalizedSeries = slideSeries.map((series, index) => ({
    id: series?.id || `series-${index}`,
    label: series?.name || series?.label || `Series ${index + 1}`,
    color: series?.color || CHART_PREVIEW_COLORS[index % CHART_PREVIEW_COLORS.length]
  }));

  if (!normalizedSeries.length) {
    normalizedSeries = fallback.datasets.map((dataset, index) => ({
      id: dataset.id || `series-${index}`,
      label: dataset.label || `Series ${index + 1}`,
      color: dataset.color || CHART_PREVIEW_COLORS[index % CHART_PREVIEW_COLORS.length]
    }));
  }

  const datasets = normalizedSeries.map((series, seriesIndex) => {
    const seriesId = series.id || `series-${seriesIndex}`;
    const values = slideData.map((point) => {
      if (point && point.values && typeof point.values === 'object') {
        const direct = point.values[seriesId];
        const fallbackValue = series.id ? point.values[series.id] : undefined;
        return ensureNumber(direct ?? fallbackValue);
      }
      return 0;
    });

    return {
      id: seriesId,
      label: series.label,
      color: series.color,
      data: values.length ? values : labels.map(() => 0)
    };
  });

  return {
    chartType,
    labels,
    datasets: datasets.length ? datasets : fallback.datasets
  };
};


const SlidePanel = ({
  slides,
  currentSlide,
  setCurrentSlide,
  addSlide,
  deleteSlide,
  moveSlide,
  thumbnails = {}
}) => {
  const [isLayoutPickerOpen, setIsLayoutPickerOpen] = useState(false);
  const [layoutInsertIndex, setLayoutInsertIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 1440;
    }
    return window.innerWidth || 1440;
  });
  const [thumbnailWidth, setThumbnailWidth] = useState(() => getThumbnailWidthForViewport(viewportWidth));
  const thumbnailHeight = useMemo(
    () => Math.round((SLIDE_BASE_HEIGHT / SLIDE_BASE_WIDTH) * thumbnailWidth),
    [thumbnailWidth]
  );
  const scaleX = useMemo(() => thumbnailWidth / SLIDE_BASE_WIDTH, [thumbnailWidth]);
  const scaleY = useMemo(() => thumbnailHeight / SLIDE_BASE_HEIGHT, [thumbnailHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      const nextWidth = window.innerWidth || 1440;
      setViewportWidth(nextWidth);
      setThumbnailWidth(getThumbnailWidthForViewport(nextWidth));
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLayoutPickerOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLayoutPickerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLayoutPickerOpen]);

  const handleAddClick = (targetIndex = slides.length) => {
    const normalizedIndex = Math.min(Math.max(targetIndex, 0), slides.length);
    setLayoutInsertIndex(normalizedIndex);
    setIsLayoutPickerOpen(true);
  };

  const handleLayoutSelect = (layoutId) => {
    const selectedLayout = layoutId || DEFAULT_LAYOUT_ID;
    if (addSlide) {
      const insertAt = Number.isFinite(layoutInsertIndex) ? layoutInsertIndex : slides.length;
      addSlide(selectedLayout, insertAt);
    }
    setIsLayoutPickerOpen(false);
    setLayoutInsertIndex(null);
  };

  const handleOverlayClick = (event) => {
    if (event.target.classList.contains('layout-picker-overlay')) {
      setIsLayoutPickerOpen(false);
      setLayoutInsertIndex(null);
    }
  };

  const handleClosePicker = () => {
    setIsLayoutPickerOpen(false);
    setLayoutInsertIndex(null);
  };

  const resetDragState = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    setDragPosition(null);
  };

  const handleThumbnailClick = (index) => {
    if (dragIndex !== null) {
      return;
    }
    setCurrentSlide(index);
  };

  const handleDragStart = (index) => (event) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index) => (event) => {
    event.preventDefault();
    if (index === dragIndex) {
      setDragOverIndex(null);
      setDragPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const position = offsetY > rect.height / 2 ? 'after' : 'before';
    setDragOverIndex(index);
    setDragPosition(position);
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (index) => () => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
      setDragPosition(null);
    }
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    const sourceData = event.dataTransfer.getData('text/plain');
    const sourceIndex = dragIndex ?? (sourceData ? parseInt(sourceData, 10) : NaN);
    if (Number.isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= slides.length) {
      resetDragState();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const dropAfter = event.clientY - rect.top > rect.height / 2;
    let targetIndex = dropAfter ? index + 1 : index;

    if (targetIndex > slides.length) {
      targetIndex = slides.length;
    }

    let finalIndex = Math.min(targetIndex, slides.length - 1);
    if (sourceIndex < targetIndex) {
      finalIndex = Math.max(0, targetIndex - 1);
    }

    if (finalIndex !== sourceIndex && typeof moveSlide === 'function') {
      moveSlide(sourceIndex, finalIndex);
    }

    resetDragState();
  };

  const handleDragEnd = () => {
    resetDragState();
  };


  const handleSlideContextMenu = (e, index) => {
    e.preventDefault();
    // Context menu could be implemented here
  };

  const handleDeleteSlide = (event, index) => {
    event.stopPropagation();
    if (typeof deleteSlide === 'function') {
      deleteSlide(index);
    }
  };

  return (
    <div className="slide-panel">
      <div className="slide-panel-header">
        <h3>Slides</h3>
        <button
          type="button"
          className="add-slide-btn"
          onClick={handleAddClick}
          title="Add New Slide"
        >
          +
        </button>
      </div>

      <div className="slides-list">
        {slides.map((slide, index) => {
          const previewImage = thumbnails?.[slide.id];

          return (
            <div
              key={slide.id}
              className={`slide-thumbnail ${currentSlide === index ? 'active' : ''}${
                dragIndex === index ? ' dragging' : ''
              }${
                dragOverIndex === index && dragPosition ? ` drop-${dragPosition}` : ''
              }`}
              onClick={() => handleThumbnailClick(index)}
              onContextMenu={(e) => handleSlideContextMenu(e, index)}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragLeave={handleDragLeave(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
            >
              <div className="slide-card-header">
                <span className="slide-card-title">{`Slide ${index + 1}`}</span>
                {slides.length > 1 && (
                  <button
                    type="button"
                    className="slide-card-delete"
                    onClick={(event) => handleDeleteSlide(event, index)}
                    aria-label={`Delete slide ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>

              <div
                className="slide-card-preview"
                style={{
                  background: previewImage
                    ? 'transparent'
                    : typeof slide.background === 'string'
                        ? slide.background
                        : slide.background?.color || '#ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                  width: `${thumbnailWidth}px`,
                  height: `${thumbnailHeight}px`
                }}
              >
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={`Preview of slide ${index + 1}`}
                    className="slide-card-preview-image"
                  />
                ) : (Array.isArray(slide.content) && slide.content.length === 0) ? (
                  <span className="slide-card-preview-placeholder">Empty slide</span>
                ) : (
                  slide.content.map((element) => {
                    const numericX = ensureNumber(element.x);
                    const numericY = ensureNumber(element.y);
                    const numericWidth = Number.isFinite(element.width) ? element.width : null;
                    const numericHeight = Number.isFinite(element.height) ? element.height : null;
                    const scaledLeft = numericX * scaleX;
                    const scaledTop = numericY * scaleY;
                    const scaledWidth = numericWidth !== null ? Math.max(numericWidth * scaleX, 1) : null;
                    const scaledHeight = numericHeight !== null ? Math.max(numericHeight * scaleY, 1) : null;
                    const baseStyle = {
                      position: 'absolute',
                      left: `${scaledLeft}px`,
                      top: `${scaledTop}px`,
                      width: scaledWidth !== null ? `${scaledWidth}px` : 'auto',
                      height: scaledHeight !== null ? `${scaledHeight}px` : 'auto',
                      pointerEvents: 'none'
                    };

                    if (element.type === 'text') {
                      const baseFontSize = Number.isFinite(element.fontSize)
                        ? element.fontSize
                        : 12;
                      const fontSize = baseFontSize * scaleY;
                      const plainText = element.plainText
                        || (typeof element.text === 'string'
                          ? element.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                          : '');

                      return (
                        <div
                          key={element.id}
                          style={{
                            ...baseStyle,
                            fontSize: `${Math.max(fontSize, 3)}px`,
                            lineHeight: 1.2,
                            color: element.color || '#111827',
                            fontWeight: element.bold ? 700 : element.fontWeight || 400,
                            fontStyle: element.italic ? 'italic' : 'normal',
                            textAlign: element.textAlign || 'left',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            maxWidth: scaledWidth !== null ? `${scaledWidth}px` : undefined
                          }}
                          title={plainText}
                        >
                          {plainText || 'Text'}
                        </div>
                      );
                    }

                    if (element.type === 'shape') {
                      const fillColor = element.color || element.fillColor || '#3b82f6';
                      const borderColor = element.borderColor || fillColor;
                      const borderWidth = Number.isFinite(element.borderWidth)
                        ? Math.max(element.borderWidth * scaleX, 0.5)
                        : 0;
                      const commonStyle = {
                        ...baseStyle,
                        background: fillColor,
                        border: borderWidth ? `${borderWidth}px solid ${borderColor}` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${Math.max(10 * scaleY, 3)}px`,
                        color: element.textColor || '#ffffff',
                        fontWeight: 600,
                        overflow: 'hidden'
                      };

                      if (element.shape === 'circle') {
                        commonStyle.borderRadius = '50%';
                      } else if (element.shape === 'triangle') {
                        commonStyle.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                      } else if (element.shape === 'star') {
                        commonStyle.clipPath =
                          'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
                      } else if (element.shape === 'arrow') {
                        commonStyle.clipPath =
                          'polygon(0% 40%, 70% 40%, 70% 15%, 100% 50%, 70% 85%, 70% 60%, 0% 60%)';
                      } else if (element.shape === 'line') {
                        return (
                          <div
                            key={element.id}
                            style={{
                              ...baseStyle,
                              height: `${Math.max((element.strokeWidth || 2) * scaleY, 1)}px`,
                              background: fillColor,
                              borderRadius: '999px'
                            }}
                          />
                        );
                      } else {
                        const radiusScale = Math.min(scaleX, scaleY);
                        commonStyle.borderRadius = `${Math.max(8 * radiusScale, 2)}px`;
                      }

                      return (
                        <div key={element.id} style={commonStyle}>
                          {element.text && element.shape !== 'line' ? element.text : ''}
                        </div>
                      );
                    }

                    if (element.type === 'chart') {
                      const { chartType, labels, datasets } = extractChartPreview(element);
                      const chartWidth = scaledWidth !== null
                        ? scaledWidth
                        : thumbnailWidth * 0.6;
                      const chartHeight = scaledHeight !== null
                        ? scaledHeight
                        : thumbnailHeight * 0.6;

                      const chartStyle = {
                        ...baseStyle,
                        width: `${chartWidth}px`,
                        height: `${chartHeight}px`,
                        border: '0.5px solid rgba(148, 163, 184, 0.45)',
                        borderRadius: '4px',
                        background: element.background || '#ffffff',
                        padding: '4px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      };

                      if (!datasets.length || !labels.length) {
                        return (
                          <div key={element.id} style={chartStyle}>
                            <div className="chart-preview-placeholder">{chartType.toUpperCase()} chart</div>
                          </div>
                        );
                      }

                      const nonZero = datasets.some((dataset) => dataset.data.some((value) => value > 0));
                      if (!nonZero) {
                        return (
                          <div key={element.id} style={chartStyle}>
                            <div className="chart-preview-placeholder">Add chart data</div>
                          </div>
                        );
                      }

                      if (chartType === 'pie') {
                        const dataset = datasets[0];
                        const total = dataset.data.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
                        let startAngle = 0;
                        const segments = dataset.data.map((value, index) => {
                          const angle = (Math.max(value, 0) / total) * 360;
                          const segment = `${datasetColor(dataset, index)} ${startAngle}deg ${startAngle + angle}deg`;
                          startAngle += angle;
                          return segment;
                        });

                        return (
                          <div key={element.id} style={chartStyle}>
                            <div
                              className="chart-preview-pie"
                              style={{ background: `conic-gradient(${segments.join(', ')})` }}
                            />
                          </div>
                        );
                      }

                      const innerWidth = Math.max(20, chartWidth - 8);
                      const innerHeight = Math.max(20, chartHeight - 12);
                      const maxValue = Math.max(
                        ...datasets.flatMap((dataset) => dataset.data.map((value) => Math.max(value, 0))),
                        1
                      );

                      if (chartType === 'line' || chartType === 'area') {
                        const dataset = datasets[0];
                        const pointCount = Math.max(dataset.data.length, 2);
                        const points = dataset.data.map((value, index) => {
                          const x =
                            pointCount <= 1
                              ? innerWidth / 2
                              : (index / Math.max(pointCount - 1, 1)) * innerWidth;
                          const y = innerHeight - (Math.max(value, 0) / maxValue) * (innerHeight - 4) - 2;
                          return `${x},${y}`;
                        }).join(' ');

                        return (
                          <div key={element.id} style={chartStyle}>
                            <svg width={innerWidth} height={innerHeight} style={{ display: 'block' }}>
                              <polyline
                                points={points}
                                fill={chartType === 'area' ? `${datasetColor(dataset, 0)}40` : 'none'}
                                stroke={datasetColor(dataset, 0)}
                                strokeWidth="1"
                              />
                            </svg>
                          </div>
                        );
                      }

                      const visibleLabels = labels.slice(0, Math.min(labels.length, 5));
                      const barsPerGroup = datasets.length;
                      const groupWidth = Math.max(4, innerWidth / (visibleLabels.length || 1));
                      const barWidth = Math.max(2, groupWidth / Math.max(barsPerGroup, 1) - 2);

                      return (
                        <div key={element.id} style={chartStyle}>
                          <div
                            className="chart-preview-bars"
                            style={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'space-evenly',
                              width: innerWidth,
                              height: innerHeight,
                              gap: '4px'
                            }}
                          >
                            {visibleLabels.map((label, labelIndex) => (
                              <div
                                key={label || labelIndex}
                                className="chart-preview-bar-group"
                                style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}
                              >
                                {datasets.map((dataset, datasetIndex) => {
                                  const value = dataset.data[labelIndex] || 0;
                                  const barHeight = (Math.max(value, 0) / maxValue) * (innerHeight - 6);
                                  return (
                                    <div
                                      key={`${dataset.id}-${labelIndex}`}
                                      className="chart-preview-bar"
                                      style={{
                                        width: `${barWidth}px`,
                                        height: `${Math.max(barHeight, 1)}px`,
                                        background: datasetColor(dataset, datasetIndex)
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (element.type === 'image') {
                      const containerStyle = {
                        ...baseStyle,
                        border: '0.5px solid rgba(148, 163, 184, 0.4)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        background: '#e5e7eb'
                      };

                      const flipStyles = {};
                      if (element.flipHorizontal || element.flipVertical) {
                        flipStyles.transform = `scale(${element.flipHorizontal ? -1 : 1}, ${element.flipVertical ? -1 : 1})`;
                        flipStyles.transformOrigin = 'center center';
                      }

                      return (
                        <div key={element.id} style={containerStyle}>
                          {element.src ? (
                            <img
                              src={element.src}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...flipStyles }}
                            />
                          ) : (
                            <div className="slide-card-preview-placeholder">Image</div>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })
                )}
              </div>
              {hoveredIndex === index && (
                <button
                  type="button"
                  className="slide-hover-insert"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddClick(index + 1);
                  }}
                >
                  + Add slide below
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isLayoutPickerOpen && (
        <div
          className="layout-picker-overlay"
          onClick={handleOverlayClick}
          role="presentation"
        >
          <div className="layout-picker" role="dialog" aria-modal="true">
            <div className="layout-picker-header">
              <h4>Select a layout</h4>
              <button
                type="button"
                className="close-layout-picker"
                onClick={handleClosePicker}
                aria-label="Close layout picker"
              >
                X
              </button>
            </div>
            <div className="layout-picker-grid">
              {SLIDE_LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  className="layout-card"
                  onClick={() => handleLayoutSelect(layout.id)}
                >
                  <div className="layout-card-preview">
                    <div className="layout-card-preview-canvas">
                      {layout.previewBlocks.map((block, blockIndex) => (
                        <span
                          key={`${layout.id}-block-${blockIndex}`}
                          className={`layout-preview-block variant-${block.variant}`}
                          style={{
                            width: block.width,
                            height: block.height,
                            top: block.top,
                            left: block.left
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="layout-card-body">
                    <div className="layout-card-title">{layout.name}</div>
                    <div className="layout-card-description">{layout.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlidePanel;
