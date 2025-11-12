import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import PresentationApp from './components/PresentationApp';
import {
  generatePresentationId,
  getActivePresentationId,
  setActivePresentationId,
  getRecentPresentations,
  deletePresentation,
  loadPresentationData,
  savePresentationData,
  upsertRecentPresentation
} from './utils/presentationStorage';

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return 'Just now';
  }
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const Landing = ({
  recents,
  onCreateNew,
  onOpenPresentation,
  onDeletePresentation,
  onRenamePresentation
}) => {
  const hasRecents = recents.length > 0;

  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1 className="landing-title">Craft Impactful Presentations</h1>
        <p className="landing-subtitle">
          Build slides with charts, tables, images, and beautiful typography. Save automatically and pick up right where you left off.
        </p>
      </header>

      <section className="landing-actions" aria-label="Start a new presentation">
        <button type="button" className="blank-card" onClick={onCreateNew}>
          <span className="blank-icon">✚</span>
          <span className="blank-label">Blank presentation</span>
        </button>
      </section>

      <section className="landing-recents" aria-label="Recent presentations">
        <div className="recents-header">
          <h2>Recent presentations</h2>
          {hasRecents && <span className="recents-count">{recents.length}</span>}
        </div>

        {hasRecents ? (
          <div className="recents-grid">
            <div className="recents-list-header">
              <span>Name</span>
              <span>Date modified</span>
              <span />
            </div>
            {recents.map((item) => (
              <RecentCard
                key={item.id}
                item={item}
                onOpen={() => onOpenPresentation(item.id)}
                onDelete={() => onDeletePresentation(item.id)}
                onRename={(name) => onRenamePresentation(item.id, name)}
              />
            ))}
          </div>
        ) : (
          <div className="recents-empty">
            <p>You haven't created any presentations yet.</p>
            <p className="recents-empty-help">Start a new deck or reopen one from your device to see it listed here.</p>
          </div>
        )}
      </section>
    </div>
  );
};

const RecentCard = ({ item, onOpen, onDelete, onRename }) => {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(item.name || 'Untitled presentation');

  const handleRenameClick = useCallback((event) => {
    event.stopPropagation();
    setIsRenameOpen(true);
  }, []);

  const handleDelete = useCallback((event) => {
    event.stopPropagation();
    onDelete();
  }, [onDelete]);

  const handleOpen = useCallback(() => {
    onOpen();
  }, [onOpen]);

  const handleRenameSubmit = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const trimmed = draftName.trim();
    const nextName = trimmed || 'Untitled presentation';
    onRename?.(nextName);
    setIsRenameOpen(false);
  }, [draftName, onRename]);

  const handleRenameCancel = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setDraftName(item.name || 'Untitled presentation');
    setIsRenameOpen(false);
  }, [item.name]);

  return (
    <div
      className="recent-row"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => event.key === 'Enter' && handleOpen()}
    >
      <div className="recent-row-title">
        <span className="recent-icon">P</span>
        <div>
          <span>{item.name || 'Untitled presentation'}</span>
          <span className="recent-row-subtitle">Your slides</span>
        </div>
      </div>
      <div className="recent-row-date">{formatTimestamp(item.updatedAt)}</div>
      <div className="recent-row-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="recent-action" onClick={handleRenameClick} aria-label="Rename presentation">
          Rename
        </button>
        <button type="button" className="recent-action danger" onClick={handleDelete} aria-label="Delete presentation">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9 3H15L15.6 5H20V7H4V5H8.4L9 3ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V8H6V19Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {isRenameOpen && (
        <div
          className="recent-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`rename-${item.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="recent-modal-content">
            <h3 id={`rename-${item.id}`}>Rename presentation</h3>
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  handleRenameSubmit(event);
                }
              }}
              autoFocus
            />
            <div className="recent-modal-actions">
              <button type="button" onClick={handleRenameCancel}>Cancel</button>
              <button type="button" onClick={handleRenameSubmit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SESSION_KEYS = {
  isOpen: 'pptts:ui:isEditorOpen'
};

const readSessionFlag = (key, fallback = false) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    return window.sessionStorage.getItem(key) === 'true';
  } catch (error) {
    console.warn('Unable to read session flag', error);
    return fallback;
  }
};

const writeSessionFlag = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value ? 'true' : 'false');
  } catch (error) {
    console.warn('Unable to persist session flag', error);
  }
};

function App() {
  const [activePresentationId, setActivePresentationIdState] = useState(getActivePresentationId());
  const [isPresentationOpen, setIsPresentationOpen] = useState(() => readSessionFlag(SESSION_KEYS.isOpen, false));
  const [recents, setRecents] = useState(() => getRecentPresentations());

  const refreshRecents = useCallback(() => {
    setRecents(getRecentPresentations());
  }, []);

  const handleCreateNew = useCallback(() => {
    const newId = generatePresentationId();
    setActivePresentationId(newId);
    setActivePresentationIdState(newId);
    setIsPresentationOpen(true);
    writeSessionFlag(SESSION_KEYS.isOpen, true);
    refreshRecents();
  }, [refreshRecents]);

  const handleOpenPresentation = useCallback((presentationId) => {
    if (!presentationId) {
      return;
    }
    const data = loadPresentationData(presentationId);
    if (!data) {
      return;
    }
    setActivePresentationId(presentationId);
    setActivePresentationIdState(presentationId);
    setIsPresentationOpen(true);
    writeSessionFlag(SESSION_KEYS.isOpen, true);
  }, []);

  const handleDeletePresentation = useCallback((presentationId) => {
    deletePresentation(presentationId);
    if (activePresentationId === presentationId) {
      setActivePresentationIdState(null);
      setActivePresentationId(null);
      setIsPresentationOpen(false);
      writeSessionFlag(SESSION_KEYS.isOpen, false);
    }
    refreshRecents();
  }, [activePresentationId, refreshRecents]);

  const handleRenamePresentation = useCallback((presentationId, name) => {
    const trimmed = (name || '').trim();
    const nextName = trimmed || 'Untitled presentation';
    const currentData = loadPresentationData(presentationId);
    if (currentData) {
      savePresentationData(presentationId, {
        ...currentData,
        fileName: nextName
      });
    }
    upsertRecentPresentation({ id: presentationId, name: nextName, updatedAt: Date.now() });
    refreshRecents();
  }, [refreshRecents]);

  const handleExitEditor = useCallback(() => {
    setIsPresentationOpen(false);
    writeSessionFlag(SESSION_KEYS.isOpen, false);
    refreshRecents();
  }, [refreshRecents]);

  useEffect(() => {
    refreshRecents();
  }, [refreshRecents]);

  const appClassName = isPresentationOpen && activePresentationId ? 'App app-editor' : 'App app-landing';

  return (
    <div className={appClassName}>
      {isPresentationOpen && activePresentationId ? (
        <PresentationApp
          onExit={handleExitEditor}
          initialPresentationId={activePresentationId}
        />
      ) : (
        <Landing
          recents={recents}
          onCreateNew={handleCreateNew}
          onOpenPresentation={handleOpenPresentation}
          onDeletePresentation={handleDeletePresentation}
          onRenamePresentation={handleRenamePresentation}
        />
      )}
    </div>
  );
}

export default App;
