import { useMemo } from "react";


function PinIcon({ filled = false, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3l7 7-3 1-3 5-2-2-5 3-1-1 3-5-2-2 5-3z" />
      <path d="M5 19l-2 2" />
    </svg>
  );
}

function sortNotes(notes, mode) {
  const items = [...notes];

  if (mode === "title") {
    return items.sort((a, b) =>
      (a.title || "Untitled").localeCompare(b.title || "Untitled")
    );
  }

  if (mode === "recent") {
    return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  if (mode === "pinned") {
    return items.sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinDiff !== 0) return pinDiff;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  return items;
}

function getVerticalPlacement(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = rect.height ? y / rect.height : 0.5;

  if (ratio < 0.26) return "before";
  if (ratio > 0.74) return "after";
  return "inside";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text, query) {
  const safeText = text || "Untitled";
  const safeQuery = (query || "").trim();

  if (!safeQuery) return safeText;

  const parts = safeText.split(new RegExp(`(${escapeRegExp(safeQuery)})`, "gi"));

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === safeQuery.toLowerCase();

    if (!isMatch) return <span key={index}>{part}</span>;

    return (
      <mark
        key={index}
        style={{
          background: "rgba(108,99,255,.22)",
          color: "inherit",
          padding: "0 2px",
          borderRadius: 4,
        }}
      >
        {part}
      </mark>
    );
  });
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function getNoteSnippet(body, query, maxLength = 80) {
  const text = stripHtml(body || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const safeQuery = (query || "").trim();
  if (!safeQuery) {
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
  }

  const contextBefore = 24;
  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;

  return snippet;
}

export default function NotesTree({
  notes,
  activeId,
  dragItem,
  dropTarget,
  noteSort,
  collapsedMap,
  setCollapsedMap,
  setDropTarget,
  setActiveId,
  setDragItem,
  handleDragStart,
  handleNoteDrop,
  createSubnote,
  noteSearch,
  togglePin,
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map();

    for (const note of notes) {
      const key = note.parentId || "__root__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(note);
    }

    return map;
  }, [notes]);

  function getChildren(parentId) {
    const key = parentId || "__root__";
    return sortNotes(childrenByParent.get(key) || [], noteSort);
  }

  function splitPinned(items) {
    return {
      pinned: items.filter((note) => note.pinned),
      regular: items.filter((note) => !note.pinned),
    };
  }

  function toggleCollapse(id, e) {
    e.stopPropagation();
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderNoteItem(note, depth = 0) {
    const children = getChildren(note.id);
    const hasChildren = children.length > 0;
    const isSearching = Boolean(noteSearch.trim());
    const isCollapsed = isSearching ? false : Boolean(collapsedMap[note.id]);

    const canCreateSubnote = !note.parentId;

    const isDragging = dragItem?.type === "note" && dragItem.id === note.id;
    const isDropTarget = dropTarget?.type === "note" && dropTarget.id === note.id;
    const isInsideDrop = isDropTarget && dropTarget?.placement === "inside";

    const dropPlacementClass =
      isDropTarget && dropTarget?.placement === "after"
        ? "dropIndicatorBottom"
        : isDropTarget && dropTarget?.placement === "before"
        ? "dropIndicatorTop"
        : "";

    return (
      <div key={note.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          draggable={noteSort === "manual"}
          onDragStart={(e) => handleDragStart(e, "note", note.id)}
          onDragEnd={() => {
            setDropTarget(null);
            setDragItem(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragItem?.type === "note" && noteSort === "manual") {
              setDropTarget({
                type: "note",
                id: note.id,
                placement: getVerticalPlacement(e),
              });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleNoteDrop(note.id, getVerticalPlacement(e));
          }}
          onClick={() => setActiveId(note.id)}
          title={`Open note: ${note.title || "Untitled"}`}
          style={{
            marginLeft: depth * 18,
            padding: "10px 10px 10px 12px",
            borderRadius: 14,
            border: "1px solid var(--stroke)",
            cursor: noteSort === "manual" ? "grab" : "pointer",
            background:
    note.id === activeId
      ? "var(--panel2)"
      : note.pinned
      ? "color-mix(in srgb, var(--panel2) 55%, transparent)"
      : "transparent",
            minWidth: 0,
            position: "relative",
          }}
          className={[
            "motionCard",
            note.id === activeId ? "motionCardActive" : "",
            isDragging ? "draggingItem" : "",
            dropPlacementClass,
            isInsideDrop ? "insideDropGlow" : "",
          ].join(" ")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              className={`treeHandle ${hasChildren ? "treeHandleVisible" : ""}`}
              onClick={(e) => hasChildren && toggleCollapse(note.id, e)}
              title={hasChildren ? (isCollapsed ? "Expand subnotes" : "Collapse subnotes") : ""}
              tabIndex={hasChildren ? 0 : -1}
            >
              {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
            </button>

            <div
              title="Drag to reorder"
              style={{
                width: 22,
                height: 22,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
                flex: "0 0 auto",
                cursor: noteSort === "manual" ? "grab" : "default",
                background:
                  dragItem?.type === "note" && dragItem.id === note.id
                    ? "color-mix(in srgb, var(--panel2) 85%, transparent)"
                    : "transparent",
              }}
            >
              ⋮⋮
            </div>
            {!!depth && (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--muted) 60%, transparent)",
                  flex: "0 0 auto",
                }}
              />
            )}

                      <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                }}
              >
                {renderHighlightedText(note.title || "Untitled", noteSearch)}
              </div>

              {!!note.tags?.length && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  {note.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 11,
                        lineHeight: 1,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid var(--stroke)",
                        color: "var(--muted)",
                        background: "color-mix(in srgb, var(--panel2) 70%, transparent)",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                  {note.tags.length > 3 && (
                    <span
                      style={{
                        fontSize: 11,
                        lineHeight: 1,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid var(--stroke)",
                        color: "var(--muted)",
                      }}
                    >
                      +{note.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {!!getNoteSnippet(note.body, noteSearch) && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {renderHighlightedText(getNoteSnippet(note.body, noteSearch), noteSearch)}
                </div>
              )}
            </div>

            <button
  className="btn iconBtn"
  onClick={(e) => {
    e.stopPropagation();
    togglePin(note.id);
  }}
  title={note.pinned ? "Unpin note" : "Pin note"}
  style={{
    opacity: note.pinned ? 1 : 0.5,
  }}
>
  <PinIcon filled={note.pinned} />
</button>

            {canCreateSubnote && (
              <button
                className="btn iconBtn"
                title="Create subnote"
                onClick={(e) => {
                  e.stopPropagation();
                  createSubnote(note.id);
                }}
              >
                +
              </button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {children.map((child) => renderNoteItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

    const rootNotes = getChildren(null);
  const { pinned: pinnedRootNotes, regular: regularRootNotes } = splitPinned(rootNotes);
  const showPinnedSection = noteSort !== "pinned" && pinnedRootNotes.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {showPinnedSection && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              padding: "2px 4px",
            }}
          >
            Pinned
          </div>

          {pinnedRootNotes.map((n) => renderNoteItem(n, 0))}
        </div>
      )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showPinnedSection && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              padding: "6px 4px 2px",
            }}
          >
            All Notes
          </div>
        )}

        {(showPinnedSection ? regularRootNotes : rootNotes).map((n) => renderNoteItem(n, 0))}
      </div>
    </div>
  );
}