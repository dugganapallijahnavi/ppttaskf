// src/components/PresentationApp.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './PresentationApp.css';
import { Rnd } from 'react-rnd';
import ChartComponent from './ChartComponent';
import ChartDataEditor from './ChartDataEditor';
import ImageComponent from './ImageComponent';
import RichTextEditor from './RichTextEditor';
import TextToolbar from './TextToolbar';
import ShapeToolbar from './ShapeToolbar';
import ChartToolbar from './ChartToolbar';
import ImageToolbar from './ImageToolbar';

import SlidePanel from './SlidePanel';
import EnhancedToolbar from './EnhancedToolbar';
import { createSlideFromLayout } from '../data/slideLayouts';
import { exportSlidesAsPptx } from '../utils/pptxExport';
import { DESIGN_PRESETS } from '../constants/presets';
import * as htmlToImage from 'html-to-image';
import {
  generatePresentationId,
  getActivePresentationId,
  setActivePresentationId,
  loadPresentationData,
  savePresentationData,
  upsertRecentPresentation
} from '../utils/presentationStorage';

const DEFAULT_BACKGROUND = '#ffffff';
const DEFAULT_DESIGN =
  DESIGN_PRESETS[0] || {
    id: 'default',
    name: 'Default',
    background: DEFAULT_BACKGROUND,
    textColor: '#111111',
    accentColor: '#2563eb'
  };

const TEXT_TOOLBAR_HALF_WIDTH = 200;
const TEXT_TOOLBAR_VERTICAL_OFFSET = 70;
const MIN_TEXT_WIDTH = 120;
const MIN_TEXT_HEIGHT = 40;
const MIN_ELEMENT_SIZE = 60;

const CHART_COLOR_PALETTE = [
  '#111111',
  '#2d2d2d',
  '#515151',
  '#6b6b6b',
  '#868686',
  '#a3a3a3',
  '#c7c7c7'
];

const CHART_DIMENSIONS = {
  bar: { width: 420, height: 280 },
  area: { width: 410, height: 260 },
  pie: { width: 320, height: 320 },
  columnLine: { width: 430, height: 290 }
};

const chartTypeLabels = {
  bar: 'Bar chart',
  area: 'Area chart',
  pie: 'Pie chart',
  columnLine: 'Column + Line chart'
};

const SLIDESHOW_AUTO_ADVANCE_MS = 5000;

const createId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const getPaletteColor = (index) =>
  CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length];

const parseHexColor = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const hex = value.replace('#', '');
  if (![3, 6].includes(hex.length) || Number.isNaN(parseInt(hex, 16))) {
    return null;
  }
  const normalized = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex;
  const intValue = parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
};

const isDarkHexColor = (value) => {
  const rgb = parseHexColor(value);
  if (!rgb) {
    return false;
  }
  const { r, g, b } = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
};

const createDefaultChartData = (chartType) => {
  const type = chartType || 'bar';
  const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

  switch (type) {
    case 'bar':
      return {
        type: 'bar',
        title: 'Bar Chart',
        labels: quarterLabels,
        datasets: [
          {
            id: createId('series'),
            label: 'North',
            data: [48, 38, 44, 52],
            color: getPaletteColor(0),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'South',
            data: [36, 41, 30, 44],
            color: getPaletteColor(1),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'West',
            data: [28, 34, 36, 32],
            color: getPaletteColor(2),
            variant: 'bar'
          }
        ]
      };
    case 'area':
      return {
        type: 'area',
        title: 'Area Chart',
        labels: quarterLabels,
        datasets: [
          {
            id: createId('series'),
            label: 'Organic',
            data: [18, 26, 32, 28],
            color: getPaletteColor(0),
            variant: 'area',
            fill: true
          },
          {
            id: createId('series'),
            label: 'Paid',
            data: [12, 18, 22, 26],
            color: getPaletteColor(1),
            variant: 'area',
            fill: true
          },
          {
            id: createId('series'),
            label: 'Referral',
            data: [8, 12, 18, 20],
            color: getPaletteColor(2),
            variant: 'area',
            fill: true
          }
        ]
      };
    case 'pie': {
      const labels = ['North', 'South', 'East', 'West'];
      return {
        type: 'pie',
        title: 'Pie Chart',
        labels,
        datasets: [
          {
            id: createId('series'),
            label: 'Share',
            data: [32, 26, 18, 24],
            color: getPaletteColor(0),
            variant: 'pie',
            segmentColors: labels.map((_, index) => getPaletteColor(index))
          }
        ]
      };
    }
    case 'columnLine':
      return {
        type: 'columnLine',
        title: 'Column + Line',
        labels: quarterLabels,
        datasets: [
          {
            id: createId('series'),
            label: 'Revenue',
            data: [45, 58, 64, 60],
            color: getPaletteColor(0),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'Costs',
            data: [24, 32, 38, 30],
            color: getPaletteColor(2),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'Conversion',
            data: [28, 34, 42, 48],
            color: getPaletteColor(1),
            variant: 'line'
          }
        ]
      };
    default:
      return {
        type: 'bar',
        title: 'Bar Chart',
        labels: quarterLabels,
        datasets: [
          {
            id: createId('series'),
            label: 'North',
            data: [48, 38, 44, 52],
            color: getPaletteColor(0),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'South',
            data: [36, 41, 30, 44],
            color: getPaletteColor(1),
            variant: 'bar'
          },
          {
            id: createId('series'),
            label: 'West',
            data: [28, 34, 36, 32],
            color: getPaletteColor(2),
            variant: 'bar'
          }
        ]
      };
  }
};

// Deep clone utility for slides - optimized
const deepCloneSlides = (slides) => {
  if (!slides || !Array.isArray(slides)) return [];
  
  return slides.map(slide => {
    const clonedSlide = {
      ...slide,
      background: typeof slide.background === 'object' && slide.background !== null
        ? { ...slide.background }
        : slide.background
    };
    
    if (slide.content && slide.content.length > 0) {
      clonedSlide.content = slide.content.map(item => {
        const clonedItem = { ...item };
        
        // Deep clone chartData if it exists
        if (item.chartData) {
          const cd = item.chartData;
          clonedItem.chartData = {
            type: cd.type,
            title: cd.title,
            labels: cd.labels ? [...cd.labels] : [],
            datasets: cd.datasets ? cd.datasets.map(ds => ({
              id: ds.id,
              label: ds.label,
              data: ds.data ? [...ds.data] : [],
              color: ds.color,
              variant: ds.variant,
              fill: ds.fill,
              segmentColors: ds.segmentColors ? [...ds.segmentColors] : undefined
            })) : []
          };
        }
        
        // Deep clone imageData if it exists
        if (item.imageData) {
          clonedItem.imageData = { ...item.imageData };
        }
        
        return clonedItem;
      });
    } else {
      clonedSlide.content = [];
    }
    
    return clonedSlide;
  });
};

const HISTORY_PERSIST_LIMIT = 20;

const computeSlidesHash = (slides) => {
  try {
    return JSON.stringify(slides);
  } catch (error) {
    console.error('Failed to hash slides', error);
    return '';
  }
};

const logPerf = (label, start) => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  const end = performance.now();
  if (end - start > 30) {
    // eslint-disable-next-line
    console.warn(`[PerfTrace] ${label} took ${(end-start).toFixed(1)}ms`);
  }
};

const createSlide = (index, layoutId = 'title', design = DEFAULT_DESIGN) => {
  const slideData = createSlideFromLayout(layoutId);
  const backgroundColor = design?.background || DEFAULT_BACKGROUND;
  const isDarkBackground = isDarkHexColor(backgroundColor);
  const textColor = design?.textColor || (isDarkBackground ? '#f5f5f5' : '#111111');
  const accentColor = design?.accentColor || '#3b82f6';

  const content = (slideData.content || []).map((item) => {
    if (!item) {
      return item;
    }

    if (item.type === 'text') {
      return {
        ...item,
        color: textColor
      };
    }

    if (item.type === 'shape') {
      return {
        ...item,
        color: accentColor,
        borderColor: accentColor
      };
    }

    if (item.type === 'chart' && item.chartData) {
      const datasets = (item.chartData.datasets || []).map((dataset) => ({
        ...dataset,
        color: accentColor,
        segmentColors: Array.isArray(dataset.segmentColors)
          ? dataset.segmentColors.map(() => accentColor)
          : dataset.segmentColors
      }));

      return {
        ...item,
        chartData: {
          ...item.chartData,
          datasets
        }
      };
    }

    return { ...item };
  });

  return {
    id: Date.now() + index,
    title: `Slide ${index + 1}`,
    content,
    background: {
      color: backgroundColor
    }
  };
};

const applyDesignToSlide = (slide, design) => {
  if (!slide || !design) {
    return slide;
  }
  const backgroundColor = design.background || DEFAULT_BACKGROUND;
  const updatedContent = (slide.content || []).map((item) => {
    if (!item) {
      return item;
    }
    if (item.type === 'text') {
      return {
        ...item,
        color: design.textColor || item.color
      };
    }
    if (item.type === 'shape') {
      return {
        ...item,
        color: design.accentColor || item.color,
        borderColor: design.accentColor || item.borderColor
      };
    }
    if (item.type === 'chart' && item.chartData) {
      const datasets = (item.chartData.datasets || []).map((dataset) => ({
        ...dataset,
        color: design.accentColor || dataset.color,
        segmentColors: Array.isArray(dataset.segmentColors)
          ? dataset.segmentColors.map(() => design.accentColor || dataset.color)
          : dataset.segmentColors
      }));
      return {
        ...item,
        chartData: {
          ...item.chartData,
          datasets
        }
      };
    }
    return { ...item };
  });

  return {
    ...slide,
    background: {
      ...(typeof slide.background === 'object' && slide.background !== null
        ? slide.background
        : {}),
      color: backgroundColor
    },
    content: updatedContent
  };
};

const PresentationApp = ({ onExit, initialPresentationId }) => {
  const [presentationId, setPresentationId] = useState(() => initialPresentationId || getActivePresentationId() || generatePresentationId());
  const [activeDesign, setActiveDesign] = useState(DEFAULT_DESIGN);
  const [slides, setSlides] = useState([applyDesignToSlide(createSlide(0, 'title'), DEFAULT_DESIGN)]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [shapeToolbarPosition, setShapeToolbarPosition] = useState(null);
  const [chartToolbarPosition, setChartToolbarPosition] = useState(null);
  const [imageToolbarPosition, setImageToolbarPosition] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [chartEditorId, setChartEditorId] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textEditors, setTextEditors] = useState({});
  const [thumbnails, setThumbnails] = useState({});
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440
  );
  const clearThumbnail = useCallback((slideId) => {
    if (!slideId) {
      return;
    }
    setThumbnails((prev) => {
      if (!prev || !prev[slideId]) {
        return prev;
      }
      const { [slideId]: removed, ...rest } = prev;
      return rest;
    });
  }, [setThumbnails]);
  const [keepInsertEnabled, setKeepInsertEnabled] = useState(false);
  const [fileName, setFileName] = useState('untitled');
  // Undo/Redo history
  const defaultSlide = applyDesignToSlide(createSlide(0, 'title'), DEFAULT_DESIGN);
  const [history, setHistory] = useState([[defaultSlide]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  // Defer element placement until user clicks on slide
  const [pendingInsert, setPendingInsert] = useState(null);
  const [pendingInsertPos, setPendingInsertPos] = useState(null);
  const imageInputRef = useRef(null);
  const cancelPendingInsert = useCallback(() => {
    setPendingInsert(null);
    setPendingInsertPos(null);
  }, []);
  const slideRef = useRef(null);
  const slideshowRef = useRef(null);
  const slideshowIntervalRef = useRef(null);
  const elementRefs = useRef({});
  const thumbnailCaptureFrame = useRef(null);
  const thumbnailDebounceTimeout = useRef(null);
  const isUndoRedoAction = useRef(false);
  const historyTimeoutRef = useRef(null);
  const lastSavedStateRef = useRef(null);
  const isMutatingRef = useRef(false);
  const endMutatingTimeoutRef = useRef(null);
  const [interactingElementId, setInteractingElementId] = useState(null);
  const slidesRef = useRef(slides);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const persistenceTimeoutRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth || 1440);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const textScale = useMemo(() => {
    if (viewportWidth <= 900) {
      return 0.72;
    }
    if (viewportWidth <= 1200) {
      return 0.82;
    }
    if (viewportWidth <= 1440) {
      return 0.9;
    }
    return 1;
  }, [viewportWidth]);

  // Add to history
  const addToHistory = useCallback((nextSlides) => {
    if (isUndoRedoAction.current || !Array.isArray(nextSlides)) {
      isUndoRedoAction.current = false;
      return;
    }

    const snapshot = deepCloneSlides(nextSlides);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndexRef.current + 1);
      const updated = [...truncated, snapshot];
      if (updated.length > HISTORY_PERSIST_LIMIT) {
        updated.shift();
      }
      return updated;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, HISTORY_PERSIST_LIMIT - 1));
  }, []);

  // Undo function
  const handleUndo = useCallback(() => {
    const t0 = performance.now();
    if (historyIndex > 0 && history[historyIndex - 1]) {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      // Clone to prevent reference issues
      const restoredState = deepCloneSlides(prevState);
      setSlides(restoredState);
      setHistoryIndex((prev) => prev - 1);
      setSelectedElement(null);
      setEditingTextId(null);
      setShapeToolbarPosition(null);
      setChartToolbarPosition(null);
      setImageToolbarPosition(null);
      logPerf('handleUndo', t0);
    }
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    const t0 = performance.now();
    if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      // Clone to prevent reference issues
      const restoredState = deepCloneSlides(nextState);
      setSlides(restoredState);
      setHistoryIndex((prev) => prev + 1);
      setSelectedElement(null);
      setEditingTextId(null);
      setShapeToolbarPosition(null);
      setChartToolbarPosition(null);
      setImageToolbarPosition(null);
      logPerf('handleRedo', t0);
    }
  }, [history, historyIndex]);

  const registerElementRef = useCallback(
    (id) => (node) => {
      if (node) {
        elementRefs.current[id] = node;
      } else {
        delete elementRefs.current[id];
      }
    },
    []
  );

  const focusTextElement = useCallback((elementId, attempt = 0) => {
    if (!elementId) {
      return;
    }

    const run = () => {
      const wrapper = elementRefs.current[elementId];
      if (!wrapper) {
        if (attempt < 6) {
          setTimeout(() => focusTextElement(elementId, attempt + 1), 32);
        }
        return;
      }

      const editable = wrapper.querySelector('[data-text-editable="true"]');
      if (!editable) {
        if (attempt < 6) {
          setTimeout(() => focusTextElement(elementId, attempt + 1), 32);
        }
        return;
      }

      if (editable !== document.activeElement) {
        editable.focus({ preventScroll: false });
      }

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          selection.addRange(range);
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  }, []);

  const updateTextToolbarPosition = useCallback(
    (elementId) => {
      const slideNode = slideRef.current;
      const elementNode = elementRefs.current[elementId];
      if (!slideNode || !elementNode) {
        return;
      }

      const slideRect = slideNode.getBoundingClientRect();
      const elementRect = elementNode.getBoundingClientRect();
      const centerX =
        elementRect.left - slideRect.left + elementRect.width / 2;
      const clampedX = Math.max(
        TEXT_TOOLBAR_HALF_WIDTH,
        Math.min(centerX, slideRect.width - TEXT_TOOLBAR_HALF_WIDTH)
      );
      const relativeTop = Math.max(
        elementRect.top - slideRect.top - TEXT_TOOLBAR_VERTICAL_OFFSET,
        8
      );
      setToolbarPosition({
        x: clampedX,
        y: relativeTop
      });
    },
    [setToolbarPosition]
  );

  const updateShapeToolbarPosition = useCallback(
    (elementId) => {
      const slideNode = slideRef.current;
      const elementNode = elementRefs.current[elementId];
      if (!slideNode || !elementNode) {
        return;
      }

      const slideRect = slideNode.getBoundingClientRect();
      const elementRect = elementNode.getBoundingClientRect();
      const centerX = elementRect.left - slideRect.left + elementRect.width / 2;
      const clampedX = Math.max(24, Math.min(centerX, slideRect.width - 24));
      const relativeTop = Math.max(elementRect.top - slideRect.top, 0);

      setShapeToolbarPosition({
        x: clampedX,
        y: relativeTop
      });
    },
    []
  );

  const updateImageToolbarPosition = useCallback(
    (elementId) => {
      const slideNode = slideRef.current;
      const elementNode = elementRefs.current[elementId];
      if (!slideNode || !elementNode) {
        return;
      }

      const slideRect = slideNode.getBoundingClientRect();
      const elementRect = elementNode.getBoundingClientRect();
      const centerX = elementRect.left - slideRect.left + elementRect.width / 2;
      const clampedX = Math.max(100, Math.min(centerX, slideRect.width - 100));
      const relativeTop = Math.max(elementRect.top - slideRect.top - 48, 8);

      setImageToolbarPosition({
        x: clampedX,
        y: relativeTop
      });
    },
    []
  );

  // Keyboard navigation and click outside
  const startSlideshow = useCallback(() => {
    if (slidesRef.current?.length) {
      setCurrentSlideIndex(0);
    }
    setIsSlideshowPaused(false);
    setIsSlideshow(true);
  }, []);

  const toggleSlideshowPause = useCallback(() => {
    setIsSlideshowPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      const isNextKey =
        e.key === 'ArrowDown' ||
        (isSlideshow && e.key === 'ArrowRight');
      const isPrevKey =
        e.key === 'ArrowUp' ||
        (isSlideshow && e.key === 'ArrowLeft');

      if (isNextKey && currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(currentSlideIndex + 1);
      } else if (isPrevKey && currentSlideIndex > 0) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (!isSlideshow) {
          startSlideshow();
        }
      } else if ((e.key === ' ' || e.key === 'Spacebar') && isSlideshow) {
        e.preventDefault();
        toggleSlideshowPause();
      } else if (e.key === 'Escape') {
        if (isSlideshow) {
          setIsSlideshow(false);
        } else if (activeDropdown) {
          setActiveDropdown(null);
        } else if (editingImage) {
          setEditingImage(null);
        } else if (pendingInsert) {
          cancelPendingInsert();
        } else {
          setSelectedElement(null);
        }
      }
    };

    const handleClickOutside = (e) => {
      if (activeDropdown && !e.target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
      if (editingImage && !e.target.closest('.image-editing-container')) {
        setEditingImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [
    currentSlideIndex,
    slides.length,
    isSlideshow,
    activeDropdown,
    editingImage,
    pendingInsert,
    cancelPendingInsert,
    handleUndo,
    handleRedo,
    startSlideshow,
    toggleSlideshowPause,
    isSlideshowPaused
  ]);

  useEffect(() => {
    if (!isSlideshow) {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
        slideshowIntervalRef.current = null;
      }
      if (isSlideshowPaused) {
        setIsSlideshowPaused(false);
      }
      const activeFullscreenEl = document.fullscreenElement;
      const containerNode = slideshowRef.current;
      if (activeFullscreenEl && (activeFullscreenEl === containerNode || activeFullscreenEl === document.documentElement)) {
        document.exitFullscreen().catch((error) => {
          console.error('Failed to exit fullscreen', error);
        });
      }
      return;
    }

    const containerNode = slideshowRef.current;
    const activeFullscreenEl = document.fullscreenElement;
    if (containerNode && containerNode.requestFullscreen) {
      if (activeFullscreenEl !== containerNode) {
        containerNode.requestFullscreen().catch((error) => {
          console.error('Failed to enter fullscreen', error);
        });
      }
    } else if (!activeFullscreenEl && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((error) => {
        console.error('Failed to enter fullscreen', error);
      });
    }

    if (slideshowIntervalRef.current) {
      clearInterval(slideshowIntervalRef.current);
    }

    const stopSlideshow = (exit = true) => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
        slideshowIntervalRef.current = null;
      }
      if (exit) {
        setIsSlideshow(false);
      }
    };

    const scheduleNextAdvance = () => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
      }

      if (isSlideshowPaused) {
        return;
      }

      slideshowIntervalRef.current = setInterval(() => {
        setCurrentSlideIndex((prevIndex) => {
          const total = slidesRef.current?.length || 0;
          if (total <= 1) {
            stopSlideshow();
            return prevIndex;
          }
          const nextIndex = prevIndex + 1;
          if (nextIndex >= total) {
            stopSlideshow();
            return prevIndex;
          }
          return nextIndex;
        });
      }, SLIDESHOW_AUTO_ADVANCE_MS);
    };

    scheduleNextAdvance();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (slideshowIntervalRef.current) {
          clearInterval(slideshowIntervalRef.current);
          slideshowIntervalRef.current = null;
        }
      } else {
        scheduleNextAdvance();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
        slideshowIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSlideshow, isSlideshowPaused, slides.length, setIsSlideshow]);

  useEffect(() => () => {
    if (slideshowIntervalRef.current) {
      clearInterval(slideshowIntervalRef.current);
      slideshowIntervalRef.current = null;
    }
    const activeFullscreenEl = document.fullscreenElement;
    const containerNode = slideshowRef.current;
    if (activeFullscreenEl && (activeFullscreenEl === containerNode || activeFullscreenEl === document.documentElement)) {
      document.exitFullscreen().catch((error) => {
        console.error('Failed to exit fullscreen', error);
      });
    }
  }, []);

  const addSlide = useCallback((layoutId = 'title', insertIndex) => {
    const targetIndex = Number.isFinite(insertIndex) ? insertIndex : slides.length;
    const clampedIndex = Math.min(Math.max(targetIndex, 0), slides.length);
    const newSlide = createSlide(clampedIndex, layoutId, activeDesign);
    const nextSlides = [...slides];
    nextSlides.splice(clampedIndex, 0, newSlide);

    const renumberedSlides = nextSlides.map((slide, idx) => (
      typeof slide.title === 'string' && /^Slide \d+$/.test(slide.title)
        ? { ...slide, title: `Slide ${idx + 1}` }
        : slide
    ));

    setSlides(renumberedSlides);
    setCurrentSlideIndex(clampedIndex);
  }, [slides, activeDesign]);

  const deleteSlide = useCallback((index) => {
    if (slides.length <= 1) {
      return;
    }

    const nextSlides = slides.filter((_, i) => i !== index);
    const renumberedSlides = nextSlides.map((slide, idx) => (
      typeof slide.title === 'string' && /^Slide \d+$/.test(slide.title)
        ? { ...slide, title: `Slide ${idx + 1}` }
        : slide
    ));

    setSlides(renumberedSlides);

    if (!renumberedSlides.length) {
      setCurrentSlideIndex(0);
    } else if (currentSlideIndex >= renumberedSlides.length) {
      setCurrentSlideIndex(renumberedSlides.length - 1);
    } else if (currentSlideIndex > index) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [slides, currentSlideIndex]);

  const moveSlide = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) {
      return;
    }

    const nextSlides = [...slides];
    const [movedSlide] = nextSlides.splice(fromIndex, 1);

    if (!movedSlide) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(toIndex, nextSlides.length));
    nextSlides.splice(clampedIndex, 0, movedSlide);

    const renumberedSlides = nextSlides.map((slide, idx) => (
      typeof slide.title === 'string' && /^Slide \d+$/.test(slide.title)
        ? { ...slide, title: `Slide ${idx + 1}` }
        : slide
    ));

    setSlides(renumberedSlides);

    if (fromIndex === currentSlideIndex) {
      setCurrentSlideIndex(clampedIndex);
    } else if (fromIndex < currentSlideIndex && clampedIndex >= currentSlideIndex) {
      setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
    } else if (fromIndex > currentSlideIndex && clampedIndex <= currentSlideIndex) {
      setCurrentSlideIndex(Math.min(renumberedSlides.length - 1, currentSlideIndex + 1));
    }
  }, [slides, currentSlideIndex]);

  const captureThumbnail = useCallback(() => {
    const node = slideRef.current;
    const slide = slides[currentSlideIndex];
    if (!node || !slide || isSlideshow) {
      return;
    }

    if (thumbnailCaptureFrame.current) {
      cancelAnimationFrame(thumbnailCaptureFrame.current);
      thumbnailCaptureFrame.current = null;
    }

    thumbnailCaptureFrame.current = requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const width = rect.width || node.clientWidth || node.offsetWidth;
      const height = rect.height || node.clientHeight || node.offsetHeight;
      if (!width || !height) {
        return;
      }

      const backgroundColor =
        typeof slide.background === 'string'
          ? slide.background
          : slide.background?.color || DEFAULT_BACKGROUND;

      const filterNode = (el) => {
        try {
          const cls = el?.classList;
          if (!cls) return true;
          if (
            cls.contains('text-toolbar-wrapper') ||
            cls.contains('shape-toolbar-wrapper') ||
            cls.contains('chart-toolbar-wrapper') ||
            cls.contains('image-delete-button') ||
            cls.contains('element-controls') ||
            cls.contains('react-rnd-handle')
          ) {
            return false;
          }
        } catch (_) {
          // ignore
        }
        return true;
      };

      const pixelRatio = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      const exportWidth = Math.max(1, Math.round(width));
      const exportHeight = Math.max(1, Math.round(height));
      const computedStyle = typeof window !== 'undefined' ? window.getComputedStyle(node) : null;
      const borderRadius = computedStyle?.borderRadius || '12px';
      const border = computedStyle?.border || '1px solid #e2e8f0';

      node.classList.add('thumbnail-capture');
      htmlToImage
        .toPng(node, {
          cacheBust: true,
          backgroundColor,
          width: exportWidth,
          height: exportHeight,
          pixelRatio,
          style: {
            margin: '0',
            boxShadow: 'none',
            borderRadius,
            border,
            width: `${exportWidth}px`,
            height: `${exportHeight}px`,
            transform: 'none'
          },
          filter: filterNode
        })
        .then((dataUrl) => {
          setThumbnails((prev) => {
            if (prev[slide.id] === dataUrl) {
              return prev;
            }
            return {
              ...prev,
              [slide.id]: dataUrl
            };
          });
        })
        .catch((error) => {
          console.error('Failed to capture slide thumbnail', error);
        })
        .finally(() => {
          node.classList.remove('thumbnail-capture');
        });
    });
  }, [slides, currentSlideIndex, isSlideshow]);

  // Debounced scheduler for thumbnails to avoid heavy captures on every keystroke
  const scheduleThumbnailCapture = useCallback(() => {
    if (thumbnailDebounceTimeout.current) {
      clearTimeout(thumbnailDebounceTimeout.current);
      thumbnailDebounceTimeout.current = null;
    }
    // Increased debounce time to 800ms for better performance
    thumbnailDebounceTimeout.current = setTimeout(() => {
      captureThumbnail();
      thumbnailDebounceTimeout.current = null;
    }, 800);
  }, [captureThumbnail]);

  const applyDesignPreset = useCallback((designId) => {
    const design = DESIGN_PRESETS.find((preset) => preset.id === designId);
    if (!design) {
      return;
    }

    setActiveDesign(design);
    setSlides((prevSlides) => {
      const updatedSlides = prevSlides.map((slide) => applyDesignToSlide(slide, design));
      scheduleThumbnailCapture();
      return updatedSlides;
    });
  }, [scheduleThumbnailCapture]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const updateSlide = useCallback((index, updatedSlide) => {
    setSlides((prevSlides) => {
      const nextSlides = [...prevSlides];
      nextSlides[index] = updatedSlide;
      return nextSlides;
    });
    scheduleThumbnailCapture();
  }, [scheduleThumbnailCapture]);

  const updateElement = useCallback((elementId, updates) => {
    if (!elementId || !updates || typeof updates !== 'object') {
      return;
    }

    let targetSlideId = null;
    let shouldClearThumbnail = false;
    let didMutate = false;

    setSlides((prevSlides) => {
      const slide = prevSlides?.[currentSlideIndex];
      if (!slide) {
        return prevSlides;
      }

      const updatedContent = (slide.content || []).map((item) => {
        if (item.id !== elementId) {
          return item;
        }

        const keys = Object.keys(updates);
        if (!keys.length) {
          return item;
        }

        let needsUpdate = false;
        for (const key of keys) {
          if (!Object.is(item[key], updates[key])) {
            needsUpdate = true;
            break;
          }
        }

        if (!needsUpdate) {
          return item;
        }

        if (
          item.type === 'image' &&
          ((Object.prototype.hasOwnProperty.call(updates, 'src') && updates.src !== item.src) ||
            (Object.prototype.hasOwnProperty.call(updates, 'imageData') && updates.imageData !== item.imageData))
        ) {
          shouldClearThumbnail = true;
        }

        didMutate = true;
        return { ...item, ...updates };
      });

      if (!didMutate) {
        return prevSlides;
      }

      targetSlideId = slide.id;
      const nextSlides = [...prevSlides];
      nextSlides[currentSlideIndex] = { ...slide, content: updatedContent };
      return nextSlides;
    });

    if (!didMutate) {
      return;
    }

    setSelectedElement((current) =>
      current && current.id === elementId ? { ...current, ...updates } : current
    );
    scheduleThumbnailCapture();

    if (shouldClearThumbnail && targetSlideId) {
      clearThumbnail(targetSlideId);
    }
  }, [clearThumbnail, currentSlideIndex, scheduleThumbnailCapture]);

  const toggleElementFlip = useCallback(
    (elementId, axis) => {
      if (!elementId || !axis) {
        return;
      }
      const isHorizontal = axis === 'horizontal';
      const isVertical = axis === 'vertical';
      if (!isHorizontal && !isVertical) {
        return;
      }

      setSlides((prevSlides) => {
        const nextSlides = [...prevSlides];
        const slide = nextSlides[currentSlideIndex];
        if (!slide) {
          return prevSlides;
        }

        const updatedContent = (slide.content || []).map((item) => {
          if (item.id !== elementId) {
            return item;
          }

          const nextItem = { ...item };
          if (isHorizontal) {
            nextItem.flipHorizontal = !nextItem.flipHorizontal;
          }
          if (isVertical) {
            nextItem.flipVertical = !nextItem.flipVertical;
          }
          return nextItem;
        });

        nextSlides[currentSlideIndex] = {
          ...slide,
          content: updatedContent
        };

        return nextSlides;
      });

      setSelectedElement((current) => {
        if (!current || current.id !== elementId) {
          return current;
        }
        return {
          ...current,
          flipHorizontal: isHorizontal ? !current.flipHorizontal : current.flipHorizontal,
          flipVertical: isVertical ? !current.flipVertical : current.flipVertical
        };
      });

      scheduleThumbnailCapture();
    },
    [currentSlideIndex, scheduleThumbnailCapture]
  );

  const handleFlipImage = useCallback((elementId, axis) => {
    if (!elementId || !axis) {
      return;
    }
    const isHorizontal = axis === 'horizontal';
    const isVertical = axis === 'vertical';
    if (!isHorizontal && !isVertical) {
      return;
    }

    toggleElementFlip(elementId, axis);
  }, [toggleElementFlip]);

  const handleElementPointerDown = useCallback(
    (event, element) => {
      if (pendingInsert) {
        return;
      }
      event.stopPropagation();
      setSelectedElement(element);
      if (element.type === 'text') {
        setHoveredElement(element.id);
        updateTextToolbarPosition(element.id);
        setShapeToolbarPosition(null);
        setImageToolbarPosition(null);
      } else if (element.type === 'shape') {
        updateShapeToolbarPosition(element.id);
        setToolbarPosition({ x: 0, y: 0 });
        setImageToolbarPosition(null);
      } else if (element.type === 'image') {
        updateImageToolbarPosition(element.id);
        setToolbarPosition({ x: 0, y: 0 });
        setShapeToolbarPosition(null);
      }
    },
    [pendingInsert, updateShapeToolbarPosition, updateTextToolbarPosition, updateImageToolbarPosition]
  );

  const handleDragStart = useCallback(
    (element) => {
      if (pendingInsert) {
        return;
      }
      isMutatingRef.current = true;
      setInteractingElementId(element.id);
      if (endMutatingTimeoutRef.current) {
        clearTimeout(endMutatingTimeoutRef.current);
        endMutatingTimeoutRef.current = null;
      }
      setSelectedElement(element);
      if (element.type === 'text') {
        setHoveredElement(element.id);
        updateTextToolbarPosition(element.id);
        setShapeToolbarPosition(null);
      } else if (element.type === 'shape') {
        updateShapeToolbarPosition(element.id);
        setToolbarPosition({ x: 0, y: 0 });
      }
      setEditingTextId((current) => (current === element.id ? null : current));
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
    },
    [pendingInsert, updateShapeToolbarPosition, updateTextToolbarPosition]
  );

  const pushSnapshot = useCallback(() => {
    const latestSlides = slidesRef.current;
    if (!latestSlides || !latestSlides.length) {
      return;
    }
    const hash = computeSlidesHash(latestSlides);
    if (lastSavedStateRef.current !== hash) {
      addToHistory(latestSlides);
      lastSavedStateRef.current = hash;
    }
  }, [addToHistory]);

  const handleDragStop = useCallback(
    (element, position) => {
      if (pendingInsert) {
        return;
      }
      setInteractingElementId(null);
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
      if (element.type === 'text') {
        setHoveredElement(element.id);
        updateTextToolbarPosition(element.id);
      } else if (element.type === 'shape') {
        updateShapeToolbarPosition(element.id);
      }
      updateElement(element.id, {
        x: Math.round(position.x),
        y: Math.round(position.y)
      });

      if (endMutatingTimeoutRef.current) {
        clearTimeout(endMutatingTimeoutRef.current);
      }
      endMutatingTimeoutRef.current = setTimeout(() => {
        isMutatingRef.current = false;
        pushSnapshot();
        endMutatingTimeoutRef.current = null;
      }, 200);
    },
    [pendingInsert, updateElement, updateShapeToolbarPosition, updateTextToolbarPosition, pushSnapshot]
  );

  const handleResizeStart = useCallback(
    (element) => {
      if (pendingInsert) {
        return;
      }
      isMutatingRef.current = true;
      setInteractingElementId(element.id);
      if (endMutatingTimeoutRef.current) {
        clearTimeout(endMutatingTimeoutRef.current);
        endMutatingTimeoutRef.current = null;
      }
      setSelectedElement(element);
      if (element.type === 'text') {
        setHoveredElement(element.id);
        updateTextToolbarPosition(element.id);
        setShapeToolbarPosition(null);
      } else if (element.type === 'shape') {
        updateShapeToolbarPosition(element.id);
        setToolbarPosition({ x: 0, y: 0 });
      }
      setEditingTextId((current) => (current === element.id ? null : current));
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'nwse-resize';
      }
    },
    [pendingInsert, updateShapeToolbarPosition, updateTextToolbarPosition]
  );

  const handleResizeStop = useCallback(
    (element, direction, ref, position) => {
      if (pendingInsert) {
        return;
      }
      setInteractingElementId(null);
      updateElement(element.id, {
        width: Math.round(ref.offsetWidth),
        height: Math.round(ref.offsetHeight),
        x: Math.round(position.x),
        y: Math.round(position.y)
      });
      if (element.type === 'text') {
        updateTextToolbarPosition(element.id);
      } else if (element.type === 'shape') {
        updateShapeToolbarPosition(element.id);
      }

      if (endMutatingTimeoutRef.current) {
        clearTimeout(endMutatingTimeoutRef.current);
      }
      endMutatingTimeoutRef.current = setTimeout(() => {
        isMutatingRef.current = false;
        pushSnapshot();
        endMutatingTimeoutRef.current = null;
      }, 200);
    },
    [pendingInsert, updateElement, updateShapeToolbarPosition, updateTextToolbarPosition, pushSnapshot]
  );

  const deleteElement = useCallback((elementId) => {
    setSlides((prevSlides) => {
      const nextSlides = [...prevSlides];
      const slide = nextSlides[currentSlideIndex];
      if (!slide) {
        return prevSlides;
      }
      nextSlides[currentSlideIndex] = {
        ...slide,
        content: (slide.content || []).filter((item) => item.id !== elementId)
      };
      return nextSlides;
    });
    setSelectedElement((current) => (current && current.id === elementId ? null : current));
    setHoveredElement((current) => (current === elementId ? null : current));
    if (selectedElement && selectedElement.id === elementId) {
      setShapeToolbarPosition(null);
      setChartToolbarPosition(null);
      setToolbarPosition({ x: 0, y: 0 });
    }
    if (editingImage === elementId) {
      setEditingImage(null);
    }
    setChartEditorId((current) => (current === elementId ? null : current));

    // Clean up text editor instance
    setTextEditors((prev) => {
      const { [elementId]: removed, ...rest } = prev;
      return rest;
    });
  }, [currentSlideIndex, editingImage, selectedElement]);

  const duplicateElement = useCallback((elementId) => {
    setSlides((prevSlides) => {
      const nextSlides = [...prevSlides];
      const slide = nextSlides[currentSlideIndex];
      if (!slide) {
        return prevSlides;
      }
      
      const elementToDuplicate = (slide.content || []).find((item) => item.id === elementId);
      if (!elementToDuplicate) {
        return prevSlides;
      }
      
      // Create a duplicate with a new ID and offset position
      const duplicatedElement = {
        ...elementToDuplicate,
        id: `${elementToDuplicate.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: (elementToDuplicate.x || 0) + 20,
        y: (elementToDuplicate.y || 0) + 20
      };
      
      nextSlides[currentSlideIndex] = {
        ...slide,
        content: [...(slide.content || []), duplicatedElement]
      };
      
      return nextSlides;
    });
    
    scheduleThumbnailCapture();
  }, [currentSlideIndex, scheduleThumbnailCapture]);

  const currentSlide = useMemo(
    () => slides[currentSlideIndex] || {},
    [slides, currentSlideIndex]
  );
  const activeSlideBackground = useMemo(() => {
    if (!currentSlide || !currentSlide.background) {
      return DEFAULT_BACKGROUND;
    }
    if (typeof currentSlide.background === 'string') {
      return currentSlide.background;
    }
    return currentSlide.background.color || DEFAULT_BACKGROUND;
  }, [currentSlide]);

  const activeShapeElement = useMemo(() => {
    if (selectedElement?.type === 'shape') {
      return selectedElement;
    }
    if (hoveredElement) {
      return (
        currentSlide.content?.find(
          (item) => item.id === hoveredElement && item.type === 'shape'
        ) || null
      );
    }
    return null;
  }, [currentSlide, hoveredElement, selectedElement]);

  const handleToggleKeepInsert = (enabled) => {
    setKeepInsertEnabled(enabled);
    if (!enabled) {
      cancelPendingInsert();
    }
  };

  const chartEditorElement = useMemo(() => {
    if (!chartEditorId) {
      return null;
    }
    const slide = slides[currentSlideIndex];
    return slide?.content?.find((item) => item.id === chartEditorId && item.type === 'chart') || null;
  }, [chartEditorId, slides, currentSlideIndex]);

  const closeChartEditor = useCallback(() => {
    setChartEditorId(null);
  }, []);

  useEffect(() => {
    if (chartEditorId && !chartEditorElement) {
      closeChartEditor();
    }
  }, [chartEditorId, chartEditorElement, closeChartEditor]);

  // Track slides changes for history with debouncing
  useEffect(() => {
    if (!slides || slides.length === 0) {
      return undefined;
    }

    // Skip auto history while dragging/resizing to avoid snapshot storms
    if (isMutatingRef.current) {
      return undefined;
    }

    const currentHash = computeSlidesHash(slides);

    if (isUndoRedoAction.current) {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      lastSavedStateRef.current = currentHash;
      isUndoRedoAction.current = false;
      return undefined;
    }

    if (lastSavedStateRef.current !== currentHash) {
      addToHistory(slides);
      lastSavedStateRef.current = currentHash;
    }

    return undefined;
  }, [slides, addToHistory]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    scheduleThumbnailCapture();
    return () => {
      if (thumbnailCaptureFrame.current) {
        cancelAnimationFrame(thumbnailCaptureFrame.current);
        thumbnailCaptureFrame.current = null;
      }
      if (thumbnailDebounceTimeout.current) {
        clearTimeout(thumbnailDebounceTimeout.current);
        thumbnailDebounceTimeout.current = null;
      }
    };
  }, [scheduleThumbnailCapture]);

  const handleChartEditorSave = useCallback((updatedChartData) => {
    if (!chartEditorElement) {
      return;
    }
    updateElement(chartEditorElement.id, {
      chartData: updatedChartData,
      chartType: updatedChartData.type || chartEditorElement.chartType || 'bar'
    });
    closeChartEditor();
  }, [chartEditorElement, updateElement, closeChartEditor]);

  const handleChartEditorChange = useCallback((updatedChartData) => {
    if (!chartEditorElement) {
      return;
    }
    updateElement(chartEditorElement.id, {
      chartData: updatedChartData,
      chartType: updatedChartData.type || chartEditorElement.chartType || 'bar'
    });
  }, [chartEditorElement, updateElement]);

  const describeInsertTarget = (config) => {
    if (!config) {
      return '';
    }
    const toTitle = (value) => value.charAt(0).toUpperCase() + value.slice(1);
    if (config.type === 'shape') {
      return toTitle(config.subtype || 'shape');
    }
    return toTitle(config.type);
  };

  useEffect(() => {
    if (!currentSlide) {
      setSelectedElement(null);
      setHoveredElement(null);
      setEditingTextId(null);
      setShapeToolbarPosition(null);
      setToolbarPosition({ x: 0, y: 0 });
      return;
    }

    const content = currentSlide.content || [];
    const selectedId = selectedElement?.id;
    const selectionStillValid =
      selectedId && content.some((item) => item.id === selectedId);

    if (selectionStillValid) {
      if (selectedElement?.type === 'text') {
        updateTextToolbarPosition(selectedElement.id);
        setShapeToolbarPosition(null);
      } else if (selectedElement?.type === 'shape') {
        updateShapeToolbarPosition(selectedElement.id);
        setToolbarPosition({ x: 0, y: 0 });
      }
      return;
    }

    setSelectedElement(null);
    setHoveredElement(null);
    setEditingTextId(null);
    setShapeToolbarPosition(null);
    setToolbarPosition({ x: 0, y: 0 });
  }, [
    currentSlide,
    selectedElement,
    updateShapeToolbarPosition,
    updateTextToolbarPosition
  ]);

  useEffect(() => {
    if (editingTextId && selectedElement?.id !== editingTextId) {
      setEditingTextId(null);
    }
  }, [editingTextId, selectedElement?.id]);

  useEffect(() => {
    if (!editingTextId) {
      return;
    }
    const slideContent = currentSlide?.content || [];
    if (!slideContent.some((item) => item.id === editingTextId)) {
      return;
    }
    focusTextElement(editingTextId);
    updateTextToolbarPosition(editingTextId);
  }, [currentSlide, editingTextId, focusTextElement, updateTextToolbarPosition]);

  const addElement = (type, subtype = null, options = {}) => {
    const defaultTextColor = activeDesign.textColor || (isDarkHexColor(activeSlideBackground) ? '#f5f5f5' : '#111111');
    const defaultAccentColor = activeDesign.accentColor || '#3b82f6';
    const id = `element-${Date.now()}`;
    let newElement = null;

    // Default center position
    const centerX = 120;
    const centerY = 120;

    if (type === 'text') {
      newElement = {
        id,
        type: 'text',
        x: centerX,
        y: centerY,
        width: 320,
        height: 60,
        fontSize: 20,
        color: defaultTextColor,
        fontFamily: 'Playfair Display',
        text: '<p>Click to edit text</p>',
        plainText: 'Click to edit text',
        textAlign: 'left',
        fontWeight: 400,
        bold: false,
        italic: false,
        underline: false,
        textStyle: 'body',
        flipHorizontal: false,
        flipVertical: false
      };

      updateSlide(currentSlideIndex, {
        ...currentSlide,
        content: [...(currentSlide.content || []), newElement]
      });

      setSelectedElement(newElement);
      setHoveredElement(newElement.id);
      setEditingTextId(newElement.id);
      focusTextElement(newElement.id);
      updateTextToolbarPosition(newElement.id);
      setPendingInsert(null);
      setPendingInsertPos(null);
      setActiveDropdown(null);
      return;
    }

    if (type === 'shape') {
      newElement = {
        id,
        type: 'shape',
        shape: subtype || 'rectangle',
        x: centerX,
        y: centerY,
        width: 160,
        height: 100,
        color: defaultAccentColor,
        borderColor: defaultAccentColor,
        borderWidth: 2
      };
    } else if (type === 'chart') {
      const chartType = subtype || 'bar';
      const defaultChart = createDefaultChartData(chartType);
      const dimensions = CHART_DIMENSIONS[chartType] || { width: 360, height: 240 };
      const clonedDatasets = (defaultChart.datasets || []).map((dataset) => ({
        ...dataset,
        data: Array.isArray(dataset.data) ? [...dataset.data] : [],
        color: activeDesign.accentColor || dataset.color,
        segmentColors: Array.isArray(dataset.segmentColors)
          ? dataset.segmentColors.map(() => activeDesign.accentColor || dataset.color)
          : dataset.segmentColors
      }));

      newElement = {
        id,
        type: 'chart',
        x: centerX,
        y: centerY,
        width: dimensions.width,
        height: dimensions.height,
        chartType,
        chartData: {
          ...defaultChart,
          datasets: clonedDatasets
        }
      };
    } else if (type === 'image') {
      // Directly open file picker for images
      const id = `element-${Date.now()}`;
      setPendingInsertPos({
        x: centerX,
        y: centerY,
        id,
        type: 'image',
        subtype: subtype || null
      });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
        imageInputRef.current.click();
      }
      setActiveDropdown(null);
      return;
    }

    if (newElement) {
      updateSlide(currentSlideIndex, {
        ...currentSlide,
        content: [...(currentSlide.content || []), newElement]
      });

      setSelectedElement(newElement);
      setHoveredElement(newElement.id);
      setPendingInsert(null);
      setPendingInsertPos(null);
      setActiveDropdown(null);
    }
  };

  const placeElementAt = (clientX, clientY, hostRect = null) => {
    if (!pendingInsert) {
      return;
    }

    const insertConfig = pendingInsert;
    const nextInsertConfig = {
      type: insertConfig.type,
      subtype: insertConfig.subtype || null
    };

    let rect = hostRect;
    if (!rect) {
      const slideEl = document.querySelector('.editor-layout .slide-editor .slide');
      if (!slideEl) {
        return;
      }
      rect = slideEl.getBoundingClientRect();
    }

    const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 10));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height - 10));

    const id = `element-${Date.now()}`;
    let newElement = null;
    const defaultTextColor = isDarkHexColor(activeSlideBackground)
      ? '#f5f5f5'
      : '#111111';
    const defaultAccentColor = activeDesign.accentColor || '#3b82f6';

    switch (insertConfig.type) {
      case 'text':
        newElement = {
          id,
          type: 'text',
          x,
          y,
          width: 320,
          height: 60,
          fontSize: 20,
          color: defaultTextColor,
          fontFamily: 'Playfair Display, serif',
          text: '<p>Click to edit text</p>',
          plainText: 'Click to edit text',
          textAlign: 'left',
          fontWeight: 400,
          bold: false,
          italic: false,
          underline: false,
          textStyle: 'body'
        };
        break;
      case 'shape':
        newElement = {
          id,
          type: 'shape',
          shape: insertConfig.subtype || 'rectangle',
          x,
          y,
          width: 160,
          height: 100,
          color: defaultAccentColor,
          borderColor: defaultAccentColor,
          borderWidth: 2
        };
        break;
      case 'line':
        newElement = {
          id,
          type: 'line',
          x,
          y,
          width: 220,
          height: 2,
          color: '#ffffff',
          strokeWidth: 2
        };
        break;
      case 'chart': {
        const chartType = insertConfig.subtype || 'bar';
        const defaultChart = createDefaultChartData(chartType);
        const dimensions = CHART_DIMENSIONS[chartType] || { width: 360, height: 240 };
        const clonedDatasets = (defaultChart.datasets || []).map((dataset) => ({
          ...dataset,
          data: Array.isArray(dataset.data) ? [...dataset.data] : [],
          color: activeDesign.accentColor || dataset.color,
          segmentColors: Array.isArray(dataset.segmentColors)
            ? dataset.segmentColors.map(() => activeDesign.accentColor || dataset.color)
            : dataset.segmentColors
        }));

        newElement = {
          id,
          type: 'chart',
          x,
          y,
          width: dimensions.width,
          height: dimensions.height,
          chartType,
          chartData: {
            ...defaultChart,
            datasets: clonedDatasets
          }
        };
        break;
      }
      case 'image':
        setPendingInsertPos({
          x,
          y,
          id,
          type: insertConfig.type,
          subtype: insertConfig.subtype || null
        });
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
          imageInputRef.current.click();
        }
        setPendingInsert(keepInsertEnabled ? nextInsertConfig : null);
        return;
      default:
        break;
    }

    if (newElement) {
      updateSlide(currentSlideIndex, {
        ...currentSlide,
        content: [...(currentSlide.content || []), newElement]
      });
      setSelectedElement(newElement);
      if (newElement.type === 'text') {
        setHoveredElement(newElement.id);
        setEditingTextId(newElement.id);
        focusTextElement(newElement.id);
        updateTextToolbarPosition(newElement.id);
      }
    }

    setPendingInsert(keepInsertEnabled ? nextInsertConfig : null);
    setPendingInsertPos(null);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (!keepInsertEnabled) {
        cancelPendingInsert();
      }
      return;
    }

    if (!pendingInsertPos) {
      return;
    }

    const insertInfo = pendingInsertPos;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageSrc = event.target.result;
      const meta = {
        src: imageSrc,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      };
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const maxWidth = 400;
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) { width = maxWidth; height = width / aspectRatio; }
        if (height > maxHeight) { height = maxHeight; width = height * aspectRatio; }
        const imageElement = {
          id: insertInfo.id || `element-${Date.now()}`,
          type: 'image',
          x: insertInfo.x,
          y: insertInfo.y,
          width,
          height,
          src: imageSrc,
          imageData: meta,
          alt: file.name
        };
        updateSlide(currentSlideIndex, {
          ...currentSlide,
          content: [...(currentSlide.content || []), imageElement]
        });
        setSelectedElement(imageElement);
        setPendingInsertPos(null);
        if (!keepInsertEnabled) {
          setPendingInsert(null);
        }

        const activeSlide = slidesRef.current?.[currentSlideIndex];
        if (activeSlide?.id) {
          clearThumbnail(activeSlide.id);
        }
      };
      img.src = imageSrc;
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const persistCurrentState = useCallback((updatedSlides, updatedDesign, updatedFileName) => {
    if (!isInitialLoadComplete) {
      return;
    }
    const snapshotSlides = deepCloneSlides(updatedSlides ?? slidesRef.current ?? slides);
    const designSnapshot = updatedDesign ?? activeDesign;
    const nameSnapshot = updatedFileName ?? fileName;
    const historyStack = historyRef.current || [];
    const totalEntries = historyStack.length;
    const startIndex = totalEntries > HISTORY_PERSIST_LIMIT ? totalEntries - HISTORY_PERSIST_LIMIT : 0;
    const trimmedHistory = historyStack.slice(startIndex);
    const historySnapshot = trimmedHistory.map((entry) => deepCloneSlides(entry));
    const relativeIndex = Math.max((historyIndexRef.current ?? trimmedHistory.length - 1) - startIndex, 0);
    const historyIndexSnapshot = Math.min(relativeIndex, Math.max(historySnapshot.length - 1, 0));
    const payload = {
      slides: snapshotSlides,
      design: designSnapshot,
      fileName: nameSnapshot,
      updatedAt: Date.now(),
      history: historySnapshot,
      historyIndex: historyIndexSnapshot
    };
    savePresentationData(presentationId, payload);
    upsertRecentPresentation({
      id: presentationId,
      name: nameSnapshot,
      updatedAt: payload.updatedAt,
      preview: thumbnails[slidesRef.current?.[currentSlideIndex]?.id]
    });
  }, [activeDesign, currentSlideIndex, fileName, isInitialLoadComplete, presentationId, slides, thumbnails]);

  const savePresentation = useCallback(async () => {
    try {
      const sanitizedFileName = fileName.trim() || 'untitled';
      if (persistenceTimeoutRef.current) {
        clearTimeout(persistenceTimeoutRef.current);
        persistenceTimeoutRef.current = null;
      }
      persistCurrentState();
      await exportSlidesAsPptx(slides, `${sanitizedFileName}.pptx`);
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to export presentation', error);
      window.alert('Unable to export the presentation. Please try again.');
    }
  }, [slides, fileName, persistCurrentState]);

  useEffect(() => {
    setActivePresentationId(presentationId);
  }, [presentationId]);

  useEffect(() => {
    if (initialPresentationId && initialPresentationId !== presentationId) {
      setPresentationId(initialPresentationId);
    }
  }, [initialPresentationId, presentationId]);

  useEffect(() => {
    setIsInitialLoadComplete(false);
    const stored = loadPresentationData(presentationId);
    if (stored && stored.slides && Array.isArray(stored.slides)) {
      const restoredSlides = deepCloneSlides(stored.slides);
      setSlides(restoredSlides);
      slidesRef.current = restoredSlides;
      setActiveDesign(stored.design || DEFAULT_DESIGN);
      setFileName(stored.fileName || 'untitled');
      if (Array.isArray(stored.history) && stored.history.length > 0) {
        const normalizedHistory = stored.history
          .filter((entry) => Array.isArray(entry))
          .map((entry) => deepCloneSlides(entry));
        setHistory(normalizedHistory);
        historyRef.current = normalizedHistory;
        const restoredIndex = typeof stored.historyIndex === 'number' ? stored.historyIndex : normalizedHistory.length - 1;
        const clampedIndex = Math.min(Math.max(restoredIndex, 0), normalizedHistory.length - 1);
        setHistoryIndex(clampedIndex);
        historyIndexRef.current = clampedIndex;
        const activeSnapshot = normalizedHistory[clampedIndex] || restoredSlides;
        setSlides(activeSnapshot);
        slidesRef.current = activeSnapshot;
      } else {
        const initialHistory = [restoredSlides];
        setHistory(initialHistory);
        historyRef.current = initialHistory;
        setHistoryIndex(0);
        historyIndexRef.current = 0;
      }
      lastSavedStateRef.current = computeSlidesHash(slidesRef.current);
      setIsInitialLoadComplete(true);
    } else {
      const freshSlide = applyDesignToSlide(createSlide(0, 'title'), DEFAULT_DESIGN);
      setSlides([freshSlide]);
      slidesRef.current = [freshSlide];
      setActiveDesign(DEFAULT_DESIGN);
      setFileName('untitled');
      setHistory([[freshSlide]]);
      historyRef.current = [[freshSlide]];
      setHistoryIndex(0);
      historyIndexRef.current = 0;
      lastSavedStateRef.current = computeSlidesHash([freshSlide]);
      setIsInitialLoadComplete(true);
    }
  }, [presentationId]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (persistenceTimeoutRef.current) {
          clearTimeout(persistenceTimeoutRef.current);
          persistenceTimeoutRef.current = null;
        }
        persistCurrentState();
        savePresentation();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [persistCurrentState, savePresentation]);

  const schedulePersistence = useCallback(() => {
    if (!isInitialLoadComplete) {
      return;
    }
    if (persistenceTimeoutRef.current) {
      clearTimeout(persistenceTimeoutRef.current);
    }
    persistenceTimeoutRef.current = setTimeout(() => {
      persistenceTimeoutRef.current = null;
      persistCurrentState();
    }, 700);
  }, [isInitialLoadComplete, persistCurrentState]);

  useEffect(() => {
    schedulePersistence();
  }, [slides, activeDesign, fileName, schedulePersistence]);

  useEffect(() => () => {
    if (persistenceTimeoutRef.current) {
      clearTimeout(persistenceTimeoutRef.current);
      persistenceTimeoutRef.current = null;
      persistCurrentState();
    }
  }, [persistCurrentState]);

  return (
    <>
      <div className="presentation-app">
        {!isSlideshow ? (
          <div className="editor-layout">
            <EnhancedToolbar
              onInsertElement={addElement}
              onDownloadPresentation={savePresentation}
              onStartSlideshow={startSlideshow}
              keepInsertEnabled={keepInsertEnabled}
              onToggleKeepInsert={handleToggleKeepInsert}
              fileName={fileName}
              onFileNameChange={setFileName}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onExitEditor={onExit}
              designOptions={DESIGN_PRESETS}
              activeDesignId={activeDesign?.id}
              onSelectDesign={applyDesignPreset}
            />

            {/* Main Content Area */}
            <main className="main-content">
              {/* Left Sidebar */}
              <SlidePanel
                slides={slides}
                currentSlide={currentSlideIndex}
                setCurrentSlide={setCurrentSlideIndex}
                addSlide={addSlide}
                deleteSlide={deleteSlide}
                moveSlide={moveSlide}
                thumbnails={thumbnails}
              />

              {/* Center - Slide Editor */}
              <div
                className={`slide-editor${chartEditorElement ? ' has-chart-editor' : ''}`}
              >
                <div className="slide-editor-canvas">
                  <div
                    className="slide"
                    style={{
                      backgroundColor: currentSlide.background?.color || DEFAULT_BACKGROUND,
                      cursor: pendingInsert ? 'crosshair' : 'default'
                    }}
                    ref={slideRef}
                    onClick={(e) => {
                      if (pendingInsert) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        placeElementAt(e.clientX, e.clientY, rect);
                      } else {
                        setSelectedElement(null);
                        setImageToolbarPosition(null);
                      }
                    }}
                  >
                  {currentSlide.content?.map((element) => {
                    const isSelected = selectedElement?.id === element.id;

                    const handleElementClick = (event) => {
                      if (pendingInsert) {
                        event.stopPropagation();
                        const slideNode = event.currentTarget.closest('.slide');
                        if (slideNode) {
                          const slideRect = slideNode.getBoundingClientRect();
                          placeElementAt(event.clientX, event.clientY, slideRect);
                        }
                        return;
                      }

                      event.stopPropagation();
                      setSelectedElement(element);
                      if (element.type === 'text') {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const slideRect = slideRef.current?.getBoundingClientRect();
                        if (slideRect) {
                          const centerX = rect.left - slideRect.left + rect.width / 2;
                          const clampedX = Math.max(
                            TEXT_TOOLBAR_HALF_WIDTH,
                            Math.min(centerX, slideRect.width - TEXT_TOOLBAR_HALF_WIDTH)
                          );
                          const relativeTop = Math.max(
                            rect.top - slideRect.top - TEXT_TOOLBAR_VERTICAL_OFFSET,
                            8
                          );
                          setHoveredElement(element.id);
                          setToolbarPosition({
                            x: clampedX,
                            y: relativeTop
                          });
                        }
                        return;
                      } else if (element.type === 'chart') {
                        setHoveredElement(element.id);
                        
                        // Calculate position directly from the event

                        const rect = event.currentTarget.getBoundingClientRect();
                        const slideRect = slideRef.current?.getBoundingClientRect();
                        if (slideRect) {
                          const centerX = rect.left - slideRect.left + rect.width / 2;
                          const clampedX = Math.max(100, Math.min(centerX, slideRect.width - 100));
                          const relativeTop = Math.max(rect.top - slideRect.top - 48, 8);
                          
                          setChartToolbarPosition({
                            x: clampedX,
                            y: relativeTop
                          });
                        }
                        setToolbarPosition({ x: 0, y: 0 });
                        setShapeToolbarPosition(null);
                        setImageToolbarPosition(null);
                        return;
                      } else if (element.type === 'image') {
                        setHoveredElement(element.id);

                        const rect = event.currentTarget.getBoundingClientRect();
                        const slideRect = slideRef.current?.getBoundingClientRect();
                        if (slideRect) {
                          const centerX = rect.left - slideRect.left + rect.width / 2;
                          const clampedX = Math.max(100, Math.min(centerX, slideRect.width - 100));
                          const relativeTop = Math.max(rect.top - slideRect.top - 48, 8);

                          setImageToolbarPosition({
                            x: clampedX,
                            y: relativeTop
                          });
                        }

                        setToolbarPosition({ x: 0, y: 0 });
                        setShapeToolbarPosition(null);
                        return;
                      } else if (element.type === 'shape') {
                        setHoveredElement(element.id);

                        const rect = event.currentTarget.getBoundingClientRect();
                        const slideRect = slideRef.current?.getBoundingClientRect();
                        if (slideRect) {
                          const centerX = rect.left - slideRect.left + rect.width / 2;
                          const clampedX = Math.max(24, Math.min(centerX, slideRect.width - 24));
                          const relativeTop = Math.max(rect.top - slideRect.top, 0);

                          setShapeToolbarPosition({ x: clampedX, y: relativeTop });
                        }

                        setToolbarPosition({ x: 0, y: 0 });
                        setImageToolbarPosition(null);
                        return;
                      }

                      setToolbarPosition({ x: 0, y: 0 });
                      setShapeToolbarPosition(null);
                      setImageToolbarPosition(null);
                    };

                    const handleWrapperEnter = (event) => {
                      const slideRect = slideRef.current?.getBoundingClientRect();
                      if (!slideRect) {
                        return;
                      }
                      if (element.type === 'text') {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const centerX = rect.left - slideRect.left + rect.width / 2;
                        const clampedX = Math.max(
                          TEXT_TOOLBAR_HALF_WIDTH,
                          Math.min(centerX, slideRect.width - TEXT_TOOLBAR_HALF_WIDTH)
                        );
                        const relativeTop = Math.max(
                          rect.top - slideRect.top - TEXT_TOOLBAR_VERTICAL_OFFSET,
                          8
                        );
                        setHoveredElement(element.id);
                        setToolbarPosition({ x: clampedX, y: relativeTop });
                        setShapeToolbarPosition(null);
                        setImageToolbarPosition(null);
                      } else if (element.type === 'chart') {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const centerX = rect.left - slideRect.left + rect.width / 2;
                        const clampedX = Math.max(100, Math.min(centerX, slideRect.width - 100));
                        const relativeTop = Math.max(rect.top - slideRect.top - 48, 8);
                        setHoveredElement(element.id);
                        setChartToolbarPosition({ x: clampedX, y: relativeTop });
                        setToolbarPosition({ x: 0, y: 0 });
                        setShapeToolbarPosition(null);
                        setImageToolbarPosition(null);
                      } else if (element.type === 'image') {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const centerX = rect.left - slideRect.left + rect.width / 2;
                        const clampedX = Math.max(100, Math.min(centerX, slideRect.width - 100));
                        const relativeTop = Math.max(rect.top - slideRect.top - 48, 8);
                        setHoveredElement(element.id);
                        setImageToolbarPosition({ x: clampedX, y: relativeTop });
                        setToolbarPosition({ x: 0, y: 0 });
                        setShapeToolbarPosition(null);
                      } else if (element.type === 'shape') {
                        if (selectedElement?.id === element.id) {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const centerX = rect.left - slideRect.left + rect.width / 2;
                          const clampedX = Math.max(24, Math.min(centerX, slideRect.width - 24));
                          const relativeTop = Math.max(rect.top - slideRect.top, 0);
                          setHoveredElement(element.id);
                          setShapeToolbarPosition({ x: clampedX, y: relativeTop });
                          setToolbarPosition({ x: 0, y: 0 });
                          setImageToolbarPosition(null);
                        }
                      }
                    };

                    const handleWrapperLeave = () => {
                      if (selectedElement?.id !== element.id) {
                        setHoveredElement((current) => (current === element.id ? null : current));
                        if (element.type === 'shape') {
                          setShapeToolbarPosition(null);
                        } else if (element.type === 'chart') {
                          setChartToolbarPosition(null);
                        } else if (element.type === 'image') {
                          setImageToolbarPosition(null);
                        }
                      }
                    };

                    const numericX =
                      typeof element.x === 'number' && Number.isFinite(element.x)
                        ? element.x
                        : 0;
                    const numericY =
                      typeof element.y === 'number' && Number.isFinite(element.y)
                        ? element.y
                        : 0;
                    const chartConfig =
                      element.chartData ||
                      createDefaultChartData(element.chartType || 'bar');
                    const chartType =
                      chartConfig.type || element.chartType || 'bar';
                    const presetDimensions =
                      CHART_DIMENSIONS[chartType] || {};
                    const defaultChartWidth = presetDimensions.width || 360;
                    const defaultChartHeight = presetDimensions.height || 240;
                    const elementWidth =
                      typeof element.width === 'number' &&
                      Number.isFinite(element.width)
                        ? element.width
                        : element.type === 'chart'
                        ? defaultChartWidth
                        : element.type === 'text'
                        ? 320
                        : element.type === 'image'
                        ? 320
                        : 240;
                    const elementHeight =
                      typeof element.height === 'number' &&
                      Number.isFinite(element.height)
                        ? element.height
                        : element.type === 'text'
                        ? 80
                        : element.type === 'chart'
                        ? defaultChartHeight
                        : 160;
                    const minWidth =
                      element.type === 'text' 
                        ? MIN_TEXT_WIDTH 
                        : MIN_ELEMENT_SIZE;
                    const minHeight =
                      element.type === 'text'
                        ? MIN_TEXT_HEIGHT
                        : MIN_ELEMENT_SIZE;
                    const lockAspectRatio =
                      element.type === 'image' && element.maintainAspect
                        ? (Number.isFinite(element.aspectRatio)
                            ? element.aspectRatio
                            : true)
                        : false;
                    const disableDragging =
                      pendingInsert ||
                      (element.type === 'text' && editingTextId === element.id) ||
                      (element.type === 'image' && pendingInsert);
                    const enableResizing = pendingInsert
                      ? false
                      : {
                          top: true,
                          right: true,
                          bottom: true,
                          left: true,
                          topLeft: true,
                          topRight: true,
                          bottomLeft: true,
                          bottomRight: true
                        };

                    const renderContent = () => {
                      if (element.type === 'text') {
                        const isEmptyText = !(element.plainText && element.plainText.trim());
                        const flipScaleX = element.flipHorizontal ? -1 : 1;
                        const flipScaleY = element.flipVertical ? -1 : 1;
                        const flipStyle =
                          flipScaleX === 1 && flipScaleY === 1
                            ? {}
                            : {
                                transform: `scale(${flipScaleX}, ${flipScaleY})`,
                                transformOrigin: 'center center'
                              };
                        const baseFontSize = Number.isFinite(element.fontSize) ? element.fontSize : 20;
                        const scaledFontSize = Math.max(Math.round(baseFontSize * textScale), 10);
                        return (
                          <div
                            className="text-element-content-wrapper"
                            style={flipStyle}
                          >
                            {!isSelected && isEmptyText && (
                              <div
                                className="text-placeholder-visual"
                                style={{
                                  fontSize: `${scaledFontSize}px`,
                                  lineHeight: element.lineHeight ? String(element.lineHeight) : '1.3'
                                }}
                              >
                                {element.placeholder || 'Click to add text'}
                              </div>
                            )}
                            <RichTextEditor
                              element={element}
                              isSelected={isSelected}
                              textScale={textScale}
                              onContentChange={(html, plainTextValue) => {
                                updateElement(element.id, {
                                  text: html,
                                  plainText: plainTextValue.trim()
                                });
                              }}
                              onEditorReady={(editor) => {
                                setTextEditors((prev) => ({
                                  ...prev,
                                  [element.id]: editor
                                }));
                              }}
                              onFocus={() => {
                                setSelectedElement(element);
                                setHoveredElement(element.id);
                                setEditingTextId(element.id);
                                updateTextToolbarPosition(element.id);
                              }}
                              onBlur={() => {
                                setEditingTextId((current) =>
                                  current === element.id ? null : current
                                );
                                setHoveredElement((current) =>
                                  current === element.id ? null : current
                                );
                              }}
                              placeholder={element.placeholder || 'Click to add text'}
                            />
                          </div>
                        );
                      }

                      if (element.type === 'chart') {
                        return (
                          <div className="chart-element-content">
                            <ChartComponent
                              type={chartType}
                              data={{
                                labels: chartConfig.labels,
                                datasets: (chartConfig.datasets || []).map((dataset, index) => ({
                                  ...dataset,
                                  color: dataset.color || getPaletteColor(index)
                                }))
                              }}
                              options={{
                                plugins: {
                                  title: {
                                    display: !!chartConfig.title,
                                    text:
                                      chartConfig.title ||
                                      chartTypeLabels[chartType]
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                height: '100%'
                              }}
                            />
                          </div>
                        );
                      }

                      if (element.type === 'shape') {
                        const baseStyle = {
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '14px',
                          color: '#ffffff'
                        };

                        if (element.shape === 'line') {
                          return (
                            <div
                              style={{
                                width: '100%',
                                height: `${element.strokeWidth || 2}px`,
                                backgroundColor: element.color || '#ffffff',
                                borderRadius: '999px'
                              }}
                            />
                          );
                        }

                        const shapeStyle = {
                          ...baseStyle,
                          backgroundColor: element.color || '#3b82f6',
                          borderRadius: element.shape === 'circle' ? '50%' : '18px',
                          clipPath:
                            element.shape === 'triangle'
                              ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                              : element.shape === 'arrow'
                              ? 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)'
                              : element.shape === 'star'
                              ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                              : 'none'
                        };

                        return (
                          <div className="shape-element-content" style={shapeStyle}>
                            {element.text && element.shape !== 'line' && element.text}
                          </div>
                        );
                      }

                      if (element.type === 'image') {
                        return (
                          <div className="image-element-content">
                            <ImageComponent
                              element={element}
                              onUpdate={(updatedElement) => updateElement(element.id, updatedElement)}
                              onClose={() => setEditingImage(null)}
                              isEditing={editingImage === element.id}
                            />
                          </div>
                        );
                      }

                      return null;
                    };

                    return (
                      <Rnd
                        key={element.id}
                        className={`slide-element-wrapper ${element.type} ${isSelected ? 'selected' : ''} ${interactingElementId === element.id ? 'interacting' : ''}`}
                        data-shape-element={element.type === 'shape' ? 'true' : undefined}
                        data-image-element={element.type === 'image' ? 'true' : undefined}
                        innerRef={registerElementRef(element.id)}
                        bounds="parent"
                        size={{ width: elementWidth, height: elementHeight }}
                        position={{ x: numericX, y: numericY }}
                        minWidth={minWidth}
                        minHeight={minHeight}
                        lockAspectRatio={lockAspectRatio}
                        disableDragging={disableDragging}
                        enableResizing={enableResizing}
                        style={{ zIndex: isSelected ? 2 : 1 }}
                        onMouseDown={(event) => handleElementPointerDown(event, element)}
                        onClick={handleElementClick}
                        onMouseEnter={handleWrapperEnter}
                        onMouseLeave={handleWrapperLeave}
                        onDragStart={() => handleDragStart(element)}
                        onDragStop={(event, data) => handleDragStop(element, data)}
                        onResizeStart={() => handleResizeStart(element)}
                        onResizeStop={(event, direction, ref, delta, position) =>
                          handleResizeStop(element, direction, ref, position)
                        }
                      >
                        {renderContent()}
                        {isSelected &&
                          element.type !== 'chart' &&
                          element.type !== 'text' &&
                          element.type !== 'shape' &&
                          element.type !== 'image' && (
                          <div className="element-controls">
                            <button
                              type="button"
                              className="element-control-button delete"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteElement(element.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </Rnd>
                    );
                  })}

                  {selectedElement?.type === 'text' && (
                    <TextToolbar
                      element={selectedElement}
                      editor={textEditors[selectedElement.id]}
                      onUpdate={updateElement}
                      onDelete={deleteElement}
                      position={{ x: toolbarPosition.x, y: toolbarPosition.y }}
                      isVisible
                    />
                  )}

                  {shapeToolbarPosition && activeShapeElement && (
                    <ShapeToolbar
                      element={activeShapeElement}
                      onUpdate={updateElement}
                      onDelete={deleteElement}
                      onDuplicate={() => duplicateElement(activeShapeElement.id)}
                      position={shapeToolbarPosition}
                      isVisible
                      onDismiss={() => {
                        setShapeToolbarPosition(null);
                        setHoveredElement(null);
                      }}
                    />
                  )}

                  {chartToolbarPosition && selectedElement?.type === 'chart' && (
                    <ChartToolbar
                      element={selectedElement}
                      position={chartToolbarPosition}
                      isVisible
                      onDuplicate={() => duplicateElement(selectedElement.id)}
                      onChangeType={(id, type) => {
                        const currentChartData = selectedElement.chartData || {};
                        const defaultData = createDefaultChartData(type);
                        
                        // For columnLine, use default datasets to ensure proper variants
                        const updatedDatasets = type === 'columnLine' 
                          ? defaultData.datasets 
                          : currentChartData.datasets;
                        
                        updateElement(id, { 
                          chartType: type,
                          chartData: {
                            ...currentChartData,
                            type: type,
                            title: defaultData.title,
                            datasets: updatedDatasets
                          }
                        });
                      }}
                      onEditData={() => setChartEditorId(selectedElement.id)}
                      onDelete={() => deleteElement(selectedElement.id)}
                      onDismiss={() => {
                        setChartToolbarPosition(null);
                        setHoveredElement(null);
                      }}
                    />
                  )}

                  {imageToolbarPosition && selectedElement?.type === 'image' && (
                    <ImageToolbar
                      element={selectedElement}
                      position={imageToolbarPosition}
                      isVisible
                      onDuplicate={() => duplicateElement(selectedElement.id)}
                      onFlip={handleFlipImage}
                      onDelete={() => deleteElement(selectedElement.id)}
                      onDismiss={() => {
                        setImageToolbarPosition(null);
                        setHoveredElement(null);
                      }}
                    />
                  )}

                  {pendingInsert && (
                    <div className="insert-hint">
                      Click on the slide to add {describeInsertTarget(pendingInsert)}.
                      {keepInsertEnabled
                        ? ' Press Esc to stop inserting.'
                        : ' Press Esc to cancel.'}
                    </div>
                  )}

                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={imageInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />
                </div>

                {chartEditorElement && (
                  <ChartDataEditor
                    isOpen
                    data={chartEditorElement.chartData || createDefaultChartData(chartEditorElement.chartType || 'bar')}
                    chartTypeLabels={chartTypeLabels}
                    palette={CHART_COLOR_PALETTE}
                    onClose={closeChartEditor}
                    onSave={handleChartEditorSave}
                    onChange={handleChartEditorChange}
                  />
                )}
              </div>
            </main>
          </div>
        ) : (
          <div className="slideshow">
            <div className="slideshow-header">
              <div className="slideshow-info">
                <span className="slide-counter">{currentSlideIndex + 1} / {slides.length}</span>
                <span className="slideshow-title">Presentation Mode</span>
              </div>
              <div className="slideshow-actions">
                <button
                  className={`slideshow-btn ${isSlideshowPaused ? 'resume' : 'pause'}`}
                  onClick={toggleSlideshowPause}
                  title={isSlideshowPaused ? 'Resume Slideshow (Space)' : 'Pause Slideshow (Space)'}
                >
                  {isSlideshowPaused ? '▶' : '⏸'}
                </button>
                <button
                  className="slideshow-btn exit"
                  onClick={() => {
                    setIsSlideshowPaused(false);
                    setIsSlideshow(false);
                  }}
                  title="Exit Slideshow (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="slideshow-content">
              <div className="slide" style={{ backgroundColor: currentSlide.background?.color || DEFAULT_BACKGROUND }}>
                {currentSlide.content?.map((element) => {
                  if (element.type === 'text') {
                    return (
                      <div
                        key={element.id}
                        className="slide-element"
                        style={{
                          position: 'absolute',
                          left: `${element.x}px`,
                          top: `${element.y}px`,
                          width: `${element.width}px`,
                          minHeight: `${element.height}px`,
                          padding: '8px',
                          fontSize: `${element.fontSize}px`,
                          color: element.color,
                          fontFamily: element.fontFamily,
                          textAlign: element.textAlign || 'left',
                          fontWeight: element.bold ? 'bold' : element.fontWeight || 'normal',
                          fontStyle: element.italic ? 'italic' : 'normal',
                          textDecoration: element.underline ? 'underline' : 'none',
                          lineHeight: element.lineHeight || '1.4',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          display: 'block',
                          backgroundColor: 'transparent'
                        }}
                        dangerouslySetInnerHTML={{ __html: element.text || '' }}
                      />
                    );
                  } else if (element.type === 'shape') {
                    const getShapeStyle = () => {
                      const baseStyle = {
                        position: 'absolute',
                        left: `${element.x}px`,
                        top: `${element.y}px`,
                        width: `${element.width}px`,
                        height: `${element.height}px`,
                        backgroundColor: element.color || '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '500'
                      };

                      switch (element.shape) {
                        case 'circle':
                          return { ...baseStyle, borderRadius: '50%' };
                        case 'triangle':
                          return {
                            ...baseStyle,
                            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                          };
                        case 'arrow':
                          return {
                            ...baseStyle,
                            clipPath: 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)'
                          };
                        case 'star':
                          return {
                            ...baseStyle,
                            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                          };
                        case 'line':
                          return {
                            ...baseStyle,
                            backgroundColor: element.color || '#ffffff',
                            borderRadius: '0',
                            height: `${element.strokeWidth || 2}px`,
                            width: `${element.width}px`
                          };
                        default:
                          return { ...baseStyle, borderRadius: '8px' };
                      }
                    };

                    return (
                      <div 
                        key={element.id}
                        className="slide-element"
                        style={getShapeStyle()}
                      >
                        {element.text && element.shape !== 'line' && element.text}
                      </div>
                    );
                  } else if (element.type === 'chart') {
                    const chartData = element.chartData || createDefaultChartData(element.chartType || 'bar');
                    return (
                      <div
                        key={element.id}
                        style={{
                          position: 'absolute',
                          left: `${element.x}px`,
                          top: `${element.y}px`,
                          width: `${element.width}px`,
                          height: `${element.height}px`
                        }}
                      >
                        <ChartComponent
                          type={chartData.type || element.chartType || 'bar'}
                          data={{
                            labels: chartData.labels,
                            datasets: (chartData.datasets || []).map((dataset, index) => ({
                              ...dataset,
                              color: dataset.color || getPaletteColor(index)
                            }))
                          }}
                          options={{
                            plugins: {
                              title: {
                                display: !!chartData.title,
                                text: chartData.title || chartTypeLabels[chartData.type || element.chartType || 'bar']
                              }
                            }
                          }}
                        />
                      </div>
                    );
                  } else if (element.type === 'image' && element.src) {
                    return (
                      <div
                        key={element.id}
                        style={{
                          position: 'absolute',
                          left: `${element.x}px`,
                          top: `${element.y}px`,
                          width: `${element.width}px`,
                          height: `${element.height}px`,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px'
                        }}
                      >
                        <img
                          src={element.src}
                          alt=""
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                        />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            <div className="slideshow-footer">
              <div className="slide-navigation">
                <button 
                  className="nav-btn"
                  onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentSlideIndex === 0}
                >
                  ⬅️ Previous
                </button>
                <button 
                  className="nav-btn"
                  onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                  disabled={currentSlideIndex === slides.length - 1}
                >
                  Next ➡️
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PresentationApp;
