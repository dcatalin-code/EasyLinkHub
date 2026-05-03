import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { safeLoad } from "../shared/crmShared.jsx";
import NotesTree from "../components/notepad/NotesTree.jsx";
import EditorToolbar from "../components/notepad/EditorToolbar.jsx";

function uid() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return "id_" + Math.random().toString(36).slice(2);
}

const fonts = [
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Lato",
  "Space Grotesk",
  "Playfair Display",
  "Fira Code",
  "DM Sans",
  "Nunito",
  "Merriweather",
  "Source Sans 3",
  "Libre Baskerville",
  "IBM Plex Sans",
  "IBM Plex Serif",
  "JetBrains Mono",
];

const DEFAULT_COLOR_PRESETS = [
  "#111827",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

const FONT_STACKS = {
  Inter: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  Poppins: '"Trebuchet MS", "Avenir Next", Avenir, system-ui, sans-serif',
  Roboto: 'Roboto, "Helvetica Neue", Arial, sans-serif',
  Montserrat: 'Montserrat, Verdana, Geneva, sans-serif',
  "Open Sans": '"Open Sans", Arial, "Helvetica Neue", sans-serif',
  Lato: 'Lato, Arial, "Helvetica Neue", sans-serif',
  "Space Grotesk": '"Space Grotesk", "Trebuchet MS", Verdana, sans-serif',
  "Playfair Display": '"Playfair Display", Georgia, "Times New Roman", serif',
  "Fira Code": '"Fira Code", "SFMono-Regular", Menlo, Consolas, monospace',
  "DM Sans": '"DM Sans", "Avenir Next", system-ui, sans-serif',
  Nunito: 'Nunito, "Trebuchet MS", system-ui, sans-serif',
  Merriweather: 'Merriweather, Georgia, "Times New Roman", serif',
  "Source Sans 3": '"Source Sans 3", "Segoe UI", Arial, sans-serif',
  "Libre Baskerville": '"Libre Baskerville", Georgia, "Times New Roman", serif',
  "IBM Plex Sans": '"IBM Plex Sans", "Segoe UI", Arial, sans-serif',
  "IBM Plex Serif": '"IBM Plex Serif", Georgia, "Times New Roman", serif',
  "JetBrains Mono": '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
};

function getFontStack(font) {
  return FONT_STACKS[String(font || "").trim()] || FONT_STACKS.Inter;
}


function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function sortFolders(folders, mode) {
  const items = [...folders];

  if (mode === "title") {
    return items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
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

function normalizeHex(value) {
  if (!value) return null;
  let v = String(value).trim().replace(/[^0-9a-fA-F#]/g, "");
  if (!v) return null;
  if (!v.startsWith("#")) v = "#" + v;

  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (v.length === 7) return v.toLowerCase();
  return null;
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const int = parseInt(normalized.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 50 };

  let { r, g, b } = rgb;
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6);
        break;
      case g:
        h = 60 * ((b - r) / d + 2);
        break;
      default:
        h = 60 * ((r - g) / d + 4);
        break;
    }
  }

  if (h < 0) h += 360;

  return {
    h,
    s: s * 100,
    l: l * 100,
  };
}

function getDescendantIds(list, noteId) {
  const result = new Set();
  const stack = [noteId];

  while (stack.length) {
    const current = stack.pop();
    for (const note of list) {
      if (note.parentId === current && !result.has(note.id)) {
        result.add(note.id);
        stack.push(note.id);
      }
    }
  }

  return result;
}

function getSubtreeIdsInOrder(list, noteId) {
  const descendants = getDescendantIds(list, noteId);
  const ids = new Set([noteId, ...descendants]);
  return list.filter((n) => ids.has(n.id)).map((n) => n.id);
}

function getLastSubtreeIndex(list, noteId) {
  const ids = new Set(getSubtreeIdsInOrder(list, noteId));
  let last = -1;

  for (let i = 0; i < list.length; i += 1) {
    if (ids.has(list[i].id)) last = i;
  }

  return last;
}

function isDescendant(list, parentId, possibleDescendantId) {
  if (!parentId || !possibleDescendantId) return false;
  return getDescendantIds(list, parentId).has(possibleDescendantId);
}

function deleteNoteTree(list, id) {
  const descendants = getDescendantIds(list, id);
  const blocked = new Set([id, ...descendants]);
  return list.filter((n) => !blocked.has(n.id));
}

function normalizeNotes(rawNotes) {
  return (rawNotes || []).map((note) => ({
    parentId: null,
    textColor: null,
    highlightColor: null,
    tags: [],
    ...note,
    tags: Array.isArray(note?.tags)
      ? [...new Set(note.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
      : [],
  }));
}

function folderStyle(active) {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: active ? "var(--panel2)" : "transparent",
    minWidth: 0,
    border: "1px solid var(--stroke)",
    position: "relative",
  };
}

function UiIcon({ children, size = 16, stroke = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function EditIcon() {
  return (
    <UiIcon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </UiIcon>
  );
}

function TrashIcon() {
  return (
    <UiIcon>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </UiIcon>
  );
}

function NotesIcon() {
  return (
    <UiIcon>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </UiIcon>
  );
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function normalizeTagValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map(normalizeTagValue).filter(Boolean))];
}

function noteMatchesTagFilters(note, selectedTags, mode = "and") {
  if (!selectedTags.length) return true;

  const noteTags = Array.isArray(note?.tags) ? note.tags : [];

  if (mode === "or") {
    return selectedTags.some((tag) => noteTags.includes(tag));
  }

  return selectedTags.every((tag) => noteTags.includes(tag));
}

function getAncestorIds(list, noteId) {
  const result = [];
  const byId = new Map(list.map((note) => [note.id, note]));

  let current = byId.get(noteId);

  while (current && current.parentId) {
    result.push(current.parentId);
    current = byId.get(current.parentId);
  }

  return result;
}

function getSearchVisibleIds(list, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const visibleIds = new Set();

  for (const note of list) {
    const titleText = (note.title || "").toLowerCase();
    const bodyText = stripHtml(note.body || "").toLowerCase();
    const tagsText = Array.isArray(note.tags) ? note.tags.join(" ").toLowerCase() : "";
    const matches =
      titleText.includes(normalizedQuery) ||
      bodyText.includes(normalizedQuery) ||
      tagsText.includes(normalizedQuery);

    if (matches) {
      visibleIds.add(note.id);

      const ancestors = getAncestorIds(list, note.id);
      ancestors.forEach((id) => visibleIds.add(id));
    }
  }

  return visibleIds;
}

export default function Notepad({ data: appData, setData: setAppData } = {}) {
    
  const [data, setLocalData] = useState(() => {
    const loaded = appData || safeLoad();
    return {
      ...loaded,
      notes: normalizeNotes(loaded?.notes || []),
      colorPresets: loaded?.colorPresets || DEFAULT_COLOR_PRESETS,
    };

  });

  useEffect(() => {
    if (!appData) return;
    setLocalData({
      ...appData,
      notes: normalizeNotes(appData?.notes || []),
      colorPresets: appData?.colorPresets || DEFAULT_COLOR_PRESETS,
    });
  }, [appData]);


  const [activeId, setActiveId] = useState(null);
  const [activeFolder, setActiveFolder] = useState("all");

  const [dragItem, setDragItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const [folderModal, setFolderModal] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [folderSortMenuOpen, setFolderSortMenuOpen] = useState(false);
  const [noteSortMenuOpen, setNoteSortMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [colorMode, setColorMode] = useState("text");
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [activeAlignment, setActiveAlignment] = useState("left");
  const [collapsedMap, setCollapsedMap] = useState({});

  const [folderSort, setFolderSort] = useState("manual");
  const [noteSort, setNoteSort] = useState("manual");
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [tagFilterMode, setTagFilterMode] = useState("and");

  const [colorState, setColorState] = useState({ h: 0, s: 100, l: 50 });
  const [hexInput, setHexInput] = useState("#6366f1");
  const [editorLineCount, setEditorLineCount] = useState(1);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageMode, setImageMode] = useState("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [toolbarState, setToolbarState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
  });

  const editorRef = useRef(null);
  const searchInputRef = useRef(null);
  const fontMenuRef = useRef(null);
  const folderSortRef = useRef(null);
  const noteSortRef = useRef(null);
  const colorMenuRef = useRef(null);
  const alignMenuRef = useRef(null);
  const colorWheelRef = useRef(null);
  const imageInputRef = useRef(null);
  const selectionRangeRef = useRef(null);
  const isPickingColorRef = useRef(false);
  const lastSyncedNoteIdRef = useRef(null);

  const notes = normalizeNotes(data.notes || []);
  const folders = data.folders || [];
  const colorPresets = data.colorPresets || DEFAULT_COLOR_PRESETS;
  const activeNote = notes.find((n) => n.id === activeId);

  const folderScopedNotes = useMemo(
  () => notes.filter((n) => (activeFolder === "all" ? true : n.folderId === activeFolder)),
  [notes, activeFolder]
);

const availableTags = useMemo(() => {
  const tagMap = new Map();

  for (const note of folderScopedNotes) {
    const tags = Array.isArray(note.tags) ? note.tags : [];
    for (const tag of tags) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }

  return Array.from(tagMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}, [folderScopedNotes]);

const tagFilteredNotes = useMemo(() => {
  if (!selectedTagFilters.length) return folderScopedNotes;
  return folderScopedNotes.filter((note) =>
    noteMatchesTagFilters(note, selectedTagFilters, tagFilterMode)
  );
}, [folderScopedNotes, selectedTagFilters, tagFilterMode]);

const searchVisibleIds = useMemo(
  () => getSearchVisibleIds(tagFilteredNotes, noteSearch),
  [tagFilteredNotes, noteSearch]
);

const visibleNotesScoped = useMemo(() => {
  if (!searchVisibleIds) return tagFilteredNotes;
  return tagFilteredNotes.filter((note) => searchVisibleIds.has(note.id));
}, [tagFilteredNotes, searchVisibleIds]);

const visibleNoteIdsInOrder = useMemo(
  () => visibleNotesScoped.map((note) => note.id),
  [visibleNotesScoped]
);

  const visibleFolders = sortFolders(folders, folderSort);
  const lineHeightPx = 16 * 1.6;
  const wheelAngle = ((colorState.h - 90) * Math.PI) / 180;
  const markerLeft = 50 + Math.cos(wheelAngle) * (colorState.s / 2);
  const markerTop = 50 + Math.sin(wheelAngle) * (colorState.s / 2);
    useEffect(() => {
    const hasFolders = folders.length > 0;
    const ensuredFolders = hasFolders
      ? folders
      : [{ id: "default", name: "General", color: "#6C63FF" }];

    if (!hasFolders) {
      setActiveFolder("default");
    }

    if (!notes.length) {
      const first = {
        id: uid(),
        title: "My first note",
        body: "",
        updatedAt: Date.now(),
        pinned: false,
        folderId: "default",
        parentId: null,
        font: "Inter",
        fontSize: 16,
        textColor: null,
        highlightColor: "#fff59d",
      };

      save([first], ensuredFolders);
      setActiveId(first.id);
      return;
    }

    if (!hasFolders) {
      save(notes, ensuredFolders);
    }

    if (!activeId && notes[0]?.id) {
      setActiveId(notes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!editorRef.current || !activeNote) return;

    const noteChanged = lastSyncedNoteIdRef.current !== activeNote.id;
    const editorFocused = document.activeElement === editorRef.current;
    const targetHtml = activeNote.body || "";

    if (noteChanged || !editorFocused) {
      if (editorRef.current.innerHTML !== targetHtml) {
        editorRef.current.innerHTML = targetHtml;
      }
      applyEditorNoteStyles(activeNote);
      lastSyncedNoteIdRef.current = activeNote.id;
      syncEditorMetrics();
      editorRef.current.scrollTop = 0;
      setEditorScrollTop(0);
    }
  }, [activeId, activeNote?.id, activeNote?.body]);

  useEffect(() => {
    const query = noteSearch.trim();
    if (!query) return;
    if (visibleNotesScoped.length !== 1) return;

    const onlyMatch = visibleNotesScoped[0];
    if (onlyMatch && onlyMatch.id !== activeId) {
      setActiveId(onlyMatch.id);
    }
  }, [noteSearch, visibleNotesScoped, activeId]);

  useEffect(() => {
    function onDown(e) {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target)) {
        setFontMenuOpen(false);
      }
      if (folderSortRef.current && !folderSortRef.current.contains(e.target)) {
        setFolderSortMenuOpen(false);
      }
      if (noteSortRef.current && !noteSortRef.current.contains(e.target)) {
        setNoteSortMenuOpen(false);
      }
      if (alignMenuRef.current && !alignMenuRef.current.contains(e.target)) {
        setAlignMenuOpen(false);
      }
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target) &&
        !isPickingColorRef.current
      ) {
        setColorMenuOpen(false);
      }
    }

    function onUp() {
      isPickingColorRef.current = false;
      updateToolbarState();
    }

    function onSelectionChange() {
      if (selectionInsideEditor()) {
        saveSelection();
      }
      updateToolbarState();
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("selectionchange", onSelectionChange);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const isShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (!isShortcut) return;

      e.preventDefault();

      const input = searchInputRef.current;
      if (!input) return;

      input.focus();
      input.select();
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

    useEffect(() => {
    function onTreeNavigationKeyDown(e) {
      const target = e.target;
      const tagName = target?.tagName;

      const isTypingTarget =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) return;
      if (!visibleNoteIdsInOrder.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveNoteByOffset(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveNoteByOffset(-1);
        return;
      }

      if (e.key === "Enter" && activeId) {
        e.preventDefault();
        requestAnimationFrame(() => {
          focusEditorAtEnd();
        });
      }
    }

    document.addEventListener("keydown", onTreeNavigationKeyDown);

    return () => {
      document.removeEventListener("keydown", onTreeNavigationKeyDown);
    };
  }, [visibleNoteIdsInOrder, activeId]);

  useEffect(() => {
    setTagInput("");
  }, [activeId]);

  useEffect(() => {
    const availableTagSet = new Set(availableTags.map((item) => item.tag));
    setSelectedTagFilters((prev) => prev.filter((tag) => availableTagSet.has(tag)));
  }, [availableTags]);

  useEffect(() => {
    applyEditorNoteStyles(activeNote);
  }, [activeNote?.id, activeNote?.font, activeNote?.fontSize]);


  function save(updatedNotes, updatedFolders = folders, extra = {}) {
    const normalizedNotes = normalizeNotes(updatedNotes);
    const updated = {
      ...data,
      notes: normalizedNotes,
      folders: updatedFolders,
      colorPresets,
      ...extra,
    };
    setLocalData(updated);
    setAppData?.(updated);
  }

  function selectionInsideEditor() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return false;
    const range = selection.getRangeAt(0);
    return editorRef.current.contains(range.commonAncestorContainer);
  }

   function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    selectionRangeRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (selectionRangeRef.current) {
      selection.addRange(selectionRangeRef.current);
    }
  }

    function ensureEditorSelection() {
    const selection = window.getSelection();

    if (
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current &&
      editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      return true;
    }

    if (selectionRangeRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRangeRef.current);
      return true;
    }

    return false;
  }

  function handleToolbarMouseDown(e) {
    e.preventDefault();
  }

  function stripInlineStyleFromFragment(fragment, styleProp) {
    if (!fragment || !styleProp) return;

    const clearElementStyle = (el, prop) => {
      if (!el?.style?.removeProperty) return;
      el.style.removeProperty(prop);

      if (prop === "background-color") {
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
      }
    };

    const visit = (node) => {
      if (!node) return;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        clearElementStyle(el, styleProp);

        if (el.tagName === "MARK" && el.parentNode) {
          const parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          return;
        }

        if (el.getAttribute && el.getAttribute("style") === "") {
          el.removeAttribute("style");
        }
      }

      Array.from(node.childNodes || []).forEach(visit);
    };

    Array.from(fragment.childNodes || []).forEach(visit);
  }

  function resetSelectedColorToDefault(mode) {
    if (!editorRef.current || !activeId) return;

    editorRef.current.focus();

    const selection = window.getSelection();
    const storedRange = selectionRangeRef.current?.cloneRange?.() || null;
    const liveRange = getSelectionRangeInEditor();
    const range = liveRange || storedRange;

    if (!range || range.collapsed) return;
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const styleProp = mode === "highlight" ? "background-color" : "color";
    const editorStyles = window.getComputedStyle(editorRef.current);
    const defaultTextColor = editorStyles.color || "var(--text)";

    const resolveResetHighlightColor = () => {
      let node = editorRef.current;
      while (node && node instanceof HTMLElement) {
        const bg = window.getComputedStyle(node).backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return bg;
        node = node.parentElement;
      }
      return "rgb(24, 26, 36)";
    };

    try {
      const fragment = range.extractContents();
      stripInlineStyleFromFragment(fragment, styleProp);

      const resetSpan = document.createElement("span");
      if (mode === "highlight") {
        resetSpan.style.background = "none";
        resetSpan.style.backgroundImage = "none";
        resetSpan.style.backgroundColor = resolveResetHighlightColor();
      } else {
        resetSpan.style.color = defaultTextColor;
      }
      resetSpan.appendChild(fragment);
      range.insertNode(resetSpan);

      if (selection) {
        const newRange = document.createRange();
        newRange.selectNodeContents(resetSpan);
        selection.removeAllRanges();
        selection.addRange(newRange);
        selectionRangeRef.current = newRange.cloneRange();
      }

      handleEditorInput();
      saveSelection();
      updateToolbarState();
    } catch {}
  }

    function getSelectionRangeInEditor() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return null;

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return null;

    return range;
  }

  function wrapSelectionWithInlineStyle(styleObject) {
    const range = getSelectionRangeInEditor();
    if (!range || range.collapsed) return false;

    const span = document.createElement("span");
    Object.entries(styleObject).forEach(([key, value]) => {
      span.style[key] = value;
    });

    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);
      selectionRangeRef.current = newRange.cloneRange();

      return true;
    } catch {
      return false;
    }
  }
 
    function getActiveAlignment() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return "left";

    let node = selection.anchorNode;
    if (!node) return "left";

    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const style = window.getComputedStyle(node);
        const align = style.textAlign;

        if (
          align === "center" ||
          align === "right" ||
          align === "left" ||
          align === "justify"
        ) {
          return align === "justify" ? "left" : align;
        }
      }

      node = node.parentElement;
    }

    return "left";
  }

  function updateToolbarState() {
    if (!selectionInsideEditor()) {
      setToolbarState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
      });
      setActiveAlignment("left");
      return;
    }

    setToolbarState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
    });

    setActiveAlignment(getActiveAlignment());
  }

  function updateNote(field, value) {
    save(
      notes.map((n) =>
        n.id === activeId ? { ...n, [field]: value, updatedAt: Date.now() } : n
      )
    );
  }

  function togglePin(noteId) {
  save(
    notes.map((n) =>
      n.id === noteId
        ? { ...n, pinned: !n.pinned, updatedAt: Date.now() }
        : n
    )
  );
}

  function updateActiveNoteMeta(partial) {
    save(
      notes.map((n) =>
        n.id === activeId
          ? {
              ...n,
              ...partial,
              updatedAt: Date.now(),
            }
          : n
      )
    );
  }

    function updateActiveNoteTags(nextTags) {
    const normalizedTags = normalizeTagList(nextTags);

    save(
      notes.map((n) =>
        n.id === activeId
          ? {
              ...n,
              tags: normalizedTags,
              updatedAt: Date.now(),
            }
          : n
      )
    );
  }

  function addTagToActiveNote(rawTag) {
    if (!activeId) return;

    const nextTag = normalizeTagValue(rawTag);
    if (!nextTag) return;

    const currentTags = Array.isArray(activeNote?.tags) ? activeNote.tags : [];
    if (currentTags.includes(nextTag)) return;

    updateActiveNoteTags([...currentTags, nextTag]);
    setTagInput("");
  }

  function removeTagFromActiveNote(tagToRemove) {
    if (!activeId) return;

    const currentTags = Array.isArray(activeNote?.tags) ? activeNote.tags : [];
    updateActiveNoteTags(currentTags.filter((tag) => tag !== tagToRemove));
  }

  function handleTagInputKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagToActiveNote(tagInput);
    }

    if (e.key === "Backspace" && !tagInput.trim() && activeNote?.tags?.length) {
      removeTagFromActiveNote(activeNote.tags[activeNote.tags.length - 1]);
    }
  }

    function toggleTagFilter(tag) {
    setSelectedTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function clearTagFilters() {
    setSelectedTagFilters([]);
  }

    function toggleTagFilterMode() {
    setTagFilterMode((prev) => (prev === "and" ? "or" : "and"));
  }

    function focusEditorAtEnd() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
    selectionRangeRef.current = range.cloneRange();
  }

  function moveActiveNoteByOffset(offset) {
    if (!visibleNoteIdsInOrder.length) return;

    const currentIndex = visibleNoteIdsInOrder.indexOf(activeId);
    const fallbackIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.max(
      0,
      Math.min(visibleNoteIdsInOrder.length - 1, fallbackIndex + offset)
    );

    const nextId = visibleNoteIdsInOrder[nextIndex];
    if (nextId && nextId !== activeId) {
      setActiveId(nextId);
    }
  }

  function syncEditorMetrics() {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const computed = window.getComputedStyle(editor);
    const lineHeight = parseFloat(computed.lineHeight) || 25.6;
    const count = Math.max(1, Math.round(editor.scrollHeight / lineHeight));
    setEditorLineCount(count);
    setEditorScrollTop(editor.scrollTop || 0);
  }

  function applyEditorNoteStyles(note = activeNote) {
    if (!editorRef.current || !note) return;

    editorRef.current.style.fontFamily = getFontStack(note.font || "Inter");
    editorRef.current.style.fontSize = `${note.fontSize || 16}px`;
  }


  function handleEditorInput() {
    if (!editorRef.current || !activeId) return;
    syncEditorMetrics();
    updateNote("body", editorRef.current.innerHTML);
    updateToolbarState();
  }

    function applyFormat(command) {
    if (!editorRef.current || !activeId) return;

    editorRef.current.focus();

    const hasSelection = ensureEditorSelection();
    if (!hasSelection) return;

    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, null);

    updateNote("body", editorRef.current.innerHTML);
    syncEditorMetrics();

    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
    }

    requestAnimationFrame(() => {
      updateToolbarState();
    });
  }


  function applyInlineFontFamily(fontFamily) {
    const safeFontFamily = String(fontFamily || "").trim() || "Inter";
    const fontStack = getFontStack(safeFontFamily);

    if (!editorRef.current || !activeId) return;

    editorRef.current.focus();
    restoreSelection();

    const selection = window.getSelection();
    const hasLiveEditorSelection =
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer);

    if (hasLiveEditorSelection) {
      const range = selection.getRangeAt(0);

      if (!range.collapsed) {
        const span = document.createElement("span");
        span.style.fontFamily = fontStack;

        try {
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);

          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          selection.removeAllRanges();
          selection.addRange(newRange);
          selectionRangeRef.current = newRange.cloneRange();

          updateActiveNoteMeta({ font: safeFontFamily });
          updateNote("body", editorRef.current.innerHTML);
          applyEditorNoteStyles({ ...activeNote, font: safeFontFamily });
          syncEditorMetrics();

          requestAnimationFrame(() => {
            saveSelection();
            updateToolbarState();
          });
          return;
        } catch {
          // fall through to note-level font update
        }
      } else {
        selectionRangeRef.current = range.cloneRange();
      }
    }

    updateActiveNoteMeta({ font: safeFontFamily });

    requestAnimationFrame(() => {
      applyEditorNoteStyles({ ...activeNote, font: safeFontFamily });
      saveSelection();
      updateToolbarState();
      syncEditorMetrics();
    });
  }

   function applyInlineFontSize(size) {
    const px = Math.max(5, Math.min(100, Number(size) || 16));

    if (!editorRef.current || !activeId) return;

    editorRef.current.focus();

    const selection = window.getSelection();
    const hasLiveEditorSelection =
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current.contains(selection.getRangeAt(0).commonAncestorContainer);

    if (hasLiveEditorSelection) {
      const range = selection.getRangeAt(0);

      if (!range.collapsed) {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;

        try {
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);

          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          selection.removeAllRanges();
          selection.addRange(newRange);
          selectionRangeRef.current = newRange.cloneRange();

          updateNote("body", editorRef.current.innerHTML);
          updateActiveNoteMeta({ fontSize: px });
          syncEditorMetrics();

          requestAnimationFrame(() => {
            updateToolbarState();
          });
          return;
        } catch {
          // fall through to default note font size
        }
      } else {
        selectionRangeRef.current = range.cloneRange();
      }
    }

    updateActiveNoteMeta({ fontSize: px });

    requestAnimationFrame(() => {
      saveSelection();
      updateToolbarState();
      syncEditorMetrics();
    });
  }

  function createFolder() {
    setFolderName("");
    setFolderModal({ type: "create" });
  }

  function renameFolder(id) {
    const f = folders.find((x) => x.id === id);
    setFolderName(f?.name || "");
    setFolderModal({ type: "rename", folderId: id });
  }

  function handleSaveFolder() {
    if (!folderName.trim()) return;

    if (folderModal.type === "create") {
      const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
      save(notes, [...folders, { id: uid(), name: folderName.trim(), color }]);
    }

    if (folderModal.type === "rename") {
      save(
        notes,
        folders.map((f) =>
          f.id === folderModal.folderId ? { ...f, name: folderName.trim() } : f
        )
      );
    }

    setFolderModal(null);
    setFolderName("");
  }

  function deleteFolder(id) {
    const updatedNotes = notes.map((n) =>
      n.folderId === id ? { ...n, folderId: "default" } : n
    );
    save(updatedNotes, folders.filter((f) => f.id !== id));
    if (activeFolder === id) setActiveFolder("default");
  }

  function createNote() {
const newNote = {
  id: uid(),
  title: "New Note",
  body: "",
  updatedAt: Date.now(),
  pinned: false,
  folderId: activeFolder === "all" ? "default" : activeFolder,
  parentId: null,
  font: "Inter",
  fontSize: 16,
  textColor: null,
  highlightColor: "#fff59d",
  tags: [],
};

    save([newNote, ...notes]);
    setActiveId(newNote.id);
  }

  function createSubnote(parentId) {
    const parent = notes.find((n) => n.id === parentId);
    if (!parent) return;

    const newNote = {
      id: uid(),
      title: "New Subnote",
      body: "",
      updatedAt: Date.now(),
      pinned: false,
      folderId: parent.folderId,
      parentId: parent.id,
      font: parent.font || "Inter",
      fontSize: parent.fontSize || 16,
      textColor: parent.textColor || null,
      highlightColor: parent.highlightColor || "#fff59d",
      tags: Array.isArray(parent.tags) ? [...parent.tags] : [],
    };

    const lastIndex = getLastSubtreeIndex(notes, parent.id);
    const next = [...notes];
    next.splice(lastIndex + 1, 0, newNote);

    save(next);
    setCollapsedMap((prev) => ({ ...prev, [parent.id]: false }));
    setActiveId(newNote.id);
  }

  function deleteNote(id) {
    const updated = deleteNoteTree(notes, id);
    save(updated);

    if (activeId === id || isDescendant(notes, id, activeId)) {
      setActiveId(updated[0]?.id || null);
    }
  }

  function handleDragStart(e, type, id) {
    setDragItem({ type, id });
    setDropTarget(null);

    const node = e.currentTarget;
    const clone = node.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.top = "-1000px";
    clone.style.left = "-1000px";
    clone.style.width = `${node.offsetWidth}px`;
    clone.style.transform = "scale(1.01)";
    clone.style.boxShadow = "0 18px 40px rgba(0,0,0,.28)";
    clone.style.border = "1px solid rgba(108,99,255,.35)";
    clone.style.opacity = "0.96";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.setDragImage(clone, 20, 20);

    setTimeout(() => {
      if (document.body.contains(clone)) document.body.removeChild(clone);
    }, 0);
  }
    function moveFolderByDrop(draggedId, targetId, placement = "before") {
    const fromIndex = folders.findIndex((x) => x.id === draggedId);
    const toIndex = folders.findIndex((x) => x.id === targetId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return folders;

    const insertIndex =
      placement === "after"
        ? toIndex + (fromIndex < toIndex ? 0 : 1)
        : toIndex + (fromIndex < toIndex ? -1 : 0);

    return moveItem(folders, fromIndex, Math.max(0, insertIndex));
  }

  function handleFolderDrop(targetFolderId, placement = "before") {
    if (!dragItem) return;

    if (dragItem.type === "folder") {
      if (folderSort !== "manual") return;
      if (dragItem.id === targetFolderId) return;

      const reordered = moveFolderByDrop(dragItem.id, targetFolderId, placement);
      save(notes, reordered);
      setDragItem(null);
      setDropTarget(null);
      return;
    }

    if (dragItem.type === "note") {
      if (noteSort !== "manual") return;

      const subtreeIds = new Set(getSubtreeIdsInOrder(notes, dragItem.id));
      const updated = notes.map((n) =>
        subtreeIds.has(n.id)
          ? {
              ...n,
              folderId: targetFolderId,
              parentId: n.id === dragItem.id ? null : n.parentId,
              updatedAt: Date.now(),
            }
          : n
      );

      const blockIds = new Set(getSubtreeIdsInOrder(updated, dragItem.id));
      const block = updated.filter((n) => blockIds.has(n.id));
      const remaining = updated.filter((n) => !blockIds.has(n.id));
      const next = [...remaining, ...block];

      save(next, folders);
      setDragItem(null);
      setDropTarget(null);
    }
  }

  function moveNoteByDrop(draggedId, targetId, placement) {
    if (draggedId === targetId) return notes;
    if (isDescendant(notes, draggedId, targetId)) return notes;

    const dragged = notes.find((n) => n.id === draggedId);
    const target = notes.find((n) => n.id === targetId);
    if (!dragged || !target) return notes;

    const subtreeIds = new Set(getSubtreeIdsInOrder(notes, draggedId));
    const subtree = notes.filter((n) => subtreeIds.has(n.id));
    const remaining = notes.filter((n) => !subtreeIds.has(n.id));

    if (!subtree.length) return notes;

    const movedRoot = {
      ...subtree[0],
      folderId: target.folderId,
      parentId: placement === "inside" ? target.id : target.parentId ?? null,
      updatedAt: Date.now(),
    };

    const movedSubtree = subtree.map((n, i) =>
      i === 0
        ? movedRoot
        : {
            ...n,
            folderId: target.folderId,
          }
    );

    let insertIndex = 0;

    if (placement === "before") {
      insertIndex = remaining.findIndex((n) => n.id === targetId);
      if (insertIndex < 0) return notes;
    } else if (placement === "after") {
      const lastIndex = getLastSubtreeIndex(remaining, targetId);
      if (lastIndex < 0) return notes;
      insertIndex = lastIndex + 1;
    } else {
      const lastIndex = getLastSubtreeIndex(remaining, targetId);
      if (lastIndex < 0) return notes;
      insertIndex = lastIndex + 1;
    }

    const next = [...remaining];
    next.splice(insertIndex, 0, ...movedSubtree);
    return next;
  }

  function handleNoteDrop(targetNoteId, placement = "before") {
    if (!dragItem || dragItem.type !== "note") return;
    if (noteSort !== "manual") return;
    if (dragItem.id === targetNoteId) return;

    const updated = moveNoteByDrop(dragItem.id, targetNoteId, placement);
    save(updated, folders);

    if (placement === "inside") {
      setCollapsedMap((prev) => ({ ...prev, [targetNoteId]: false }));
    }

    setDragItem(null);
    setDropTarget(null);
  }

  function handleNoteDropToFolder(folderId) {
    if (!dragItem || dragItem.type !== "note") return;
    if (noteSort !== "manual") return;

    const subtreeIds = new Set(getSubtreeIdsInOrder(notes, dragItem.id));
    const updated = notes.map((n) =>
      subtreeIds.has(n.id)
        ? {
            ...n,
            folderId,
            parentId: n.id === dragItem.id ? null : n.parentId,
            updatedAt: Date.now(),
          }
        : n
    );

    const blockIds = new Set(getSubtreeIdsInOrder(updated, dragItem.id));
    const block = updated.filter((n) => blockIds.has(n.id));
    const remaining = updated.filter((n) => !blockIds.has(n.id));
    const next = [...remaining, ...block];

    save(next, folders);
    setDragItem(null);
    setDropTarget(null);
  }

  function openColorMenu(mode) {
    saveSelection();

    const baseColor =
      mode === "highlight"
        ? activeNote?.highlightColor || "#fff59d"
        : activeNote?.textColor || "#6366f1";

    const normalized = normalizeHex(baseColor) || "#6366f1";
    const hsl = hexToHsl(normalized);

    setColorMode(mode);
    setHexInput(normalized);
    setColorState({
      h: hsl.h,
      s: hsl.s,
      l: 50,
    });
    setColorMenuOpen((prev) => (colorMode === mode ? !prev : true));
  }

  function applyChosenColor(hex, mode = colorMode) {
    const normalized = normalizeHex(hex);
    if (!normalized) return;

    const hsl = hexToHsl(normalized);
    setHexInput(normalized);
    setColorState({ h: hsl.h, s: hsl.s, l: 50 });

    restoreSelection();
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, true);

    if (mode === "highlight") {
      document.execCommand("hiliteColor", false, normalized);
      updateActiveNoteMeta({ highlightColor: normalized });
    } else {
      document.execCommand("foreColor", false, normalized);
      updateActiveNoteMeta({ textColor: normalized });
    }

    handleEditorInput();
    saveSelection();
  }

  function handleWheelPointer(clientX, clientY) {
    const wheel = colorWheelRef.current;
    if (!wheel) return;

    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, radius);
    const saturation = (clampedDistance / radius) * 100;
    let hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (hue < 0) hue += 360;
    if (hue >= 360) hue -= 360;

    const nextHex = hslToHex(hue, saturation, 50);
    setColorState({ h: hue, s: saturation, l: 50 });
    setHexInput(nextHex);
    applyChosenColor(nextHex);
  }

  function startWheelDrag(e) {
    e.preventDefault();
    isPickingColorRef.current = true;

    const move = (event) => {
      if ("touches" in event && event.touches?.[0]) {
        handleWheelPointer(event.touches[0].clientX, event.touches[0].clientY);
      } else {
        handleWheelPointer(event.clientX, event.clientY);
      }
    };

    const stop = () => {
      isPickingColorRef.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };

    move(e.nativeEvent || e);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
  }

  function saveCurrentColorPreset() {
    const normalized = normalizeHex(hexInput);
    if (!normalized) return;

    const nextPresets = [normalized, ...colorPresets.filter((c) => c !== normalized)].slice(
      0,
      18
    );

    const updated = {
      ...data,
      colorPresets: nextPresets,
    };
    setLocalData(updated);
    setAppData?.(updated);
  }

  function applyHexInput() {
    const normalized = normalizeHex(hexInput);
    if (!normalized) return;
    applyChosenColor(normalized);
  }

  function applyHighlightWithCurrentColor() {
    const normalized =
      normalizeHex(activeNote?.highlightColor || hexInput || "#fff59d") || "#fff59d";
    saveSelection();
    setColorMode("highlight");
    applyChosenColor(normalized, "highlight");
  }

  function clearSelectedTextColor() {
    resetSelectedColorToDefault("text");
  }

  function clearSelectedHighlightColor() {
    if (!editorRef.current || !activeId) return;

    editorRef.current.focus();
    restoreSelection();

    const selection = window.getSelection();
    const range = getSelectionRangeInEditor() || selectionRangeRef.current;
    if (!range || range.collapsed) return;

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand("styleWithCSS", false, true);
    document.execCommand("hiliteColor", false, "transparent");
    document.execCommand("backColor", false, "transparent");

    handleEditorInput();
    saveSelection();
    updateToolbarState();
  }

  function applyAlign(type) {
    const command =
      type === "center"
        ? "justifyCenter"
        : type === "right"
        ? "justifyRight"
        : "justifyLeft";

    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, null);
    handleEditorInput();

    requestAnimationFrame(() => {
      saveSelection();
      setActiveAlignment(type);
      updateToolbarState();
    });
  }

  function applyLink() {
    saveSelection();
    restoreSelection();
    editorRef.current?.focus();

    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim();

    if (!selectedText) return;

    const url = window.prompt("Enter link URL");
    if (!url) return;

    const safeUrl =
      /^https?:\/\//i.test(url) || /^mailto:/i.test(url) ? url : `https://${url}`;

    document.execCommand("createLink", false, safeUrl);
    handleEditorInput();
    saveSelection();
  }

    function insertImageHtml(src, alt = "Inserted image") {
    if (!src) return;

    editorRef.current?.focus();
    restoreSelection();

    const safeAlt = String(alt).replace(/"/g, "&quot;");
    const safeSrc = String(src).replace(/"/g, "&quot;");

    document.execCommand(
      "insertHTML",
      false,
      `<img src="${safeSrc}" alt="${safeAlt}" style="max-width: 100%; display: block; border-radius: 12px; margin: 10px 0;" />`
    );

    handleEditorInput();

    requestAnimationFrame(() => {
      saveSelection();
      updateToolbarState();
    });
  }

  function handleImageFile(file) {
    if (!file || !file.type?.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      insertImageHtml(reader.result, file.name || "Uploaded image");
      setImageModalOpen(false);
      setImageUrlInput("");
      if (imageInputRef.current) imageInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  function insertImageFromUrl() {
    const url = imageUrlInput.trim();
    if (!url) return;

    const safeUrl =
      /^https?:\/\//i.test(url) || /^data:image\//i.test(url) ? url : `https://${url}`;

    insertImageHtml(safeUrl, "Inserted image");
    setImageModalOpen(false);
    setImageUrlInput("");
  }

  function openImageModal() {
    saveSelection();
    setImageModalOpen(true);
    setImageMode("upload");
    setImageUrlInput("");
  }

  function handleEditorPaste(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type?.startsWith("image/"));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      handleImageFile(file);
      return;
    }
  }

function insertImage() {
    openImageModal();
  }
    return (
    <>
      <style>{`
        .btn {
          height: 36px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid var(--stroke);
          background: color-mix(in srgb, var(--panel) 94%, rgba(20,20,28,.72) 6%);
          color: var(--text);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition:
            background .18s ease,
            border-color .18s ease,
            color .18s ease,
            opacity .18s ease,
            box-shadow .18s ease,
            transform .18s ease,
            filter .18s ease;
          box-shadow:
            inset 0 0 0 0 rgba(108,99,255,0),
            0 0 0 rgba(0,0,0,0);
          transform: translateX(0);
          position: relative;
          isolation: isolate;
          flex: 0 0 auto;
        }

        .btn:hover {
          transform: translateX(1px);
          background: color-mix(in srgb, var(--panel2) 90%, rgba(30,30,40,.4) 10%);
          border-color: color-mix(in srgb, var(--stroke) 64%, #6C63FF 36%);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.16),
            0 10px 22px rgba(0,0,0,.10);
          filter: saturate(1.03);
        }

        .btn:active {
          transform: translateX(0);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.12),
            0 4px 12px rgba(0,0,0,.08);
        }

        .btn:focus-visible {
          outline: none;
          border-color: color-mix(in srgb, #6C63FF 55%, var(--stroke) 45%);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.18),
            0 0 0 3px rgba(108,99,255,.18);
        }

        .btnSelected {
          background: color-mix(in srgb, var(--panel2) 94%, rgba(38,38,60,.4) 6%) !important;
          border-color: color-mix(in srgb, #6C63FF 62%, var(--stroke) 38%) !important;
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.18),
            0 10px 22px rgba(108,99,255,.12) !important;
          color: white;
        }

        .btnPrimary {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, #6C63FF 92%, white 8%),
            color-mix(in srgb, #6C63FF 84%, black 16%)
          );
          border-color: color-mix(in srgb, #6C63FF 70%, var(--stroke) 30%);
          color: white;
        }

        .btnPrimary:hover {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, #6C63FF 96%, white 4%),
            color-mix(in srgb, #6C63FF 86%, black 14%)
          );
          border-color: color-mix(in srgb, #6C63FF 84%, white 16%);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.10),
            0 12px 24px rgba(108,99,255,.24);
        }

        .iconBtn {
          width: 34px;
          min-width: 34px;
          padding: 0;
        }

        .formatSwatchBtn {
          position: relative;
          width: 36px;
          min-width: 36px;
          padding: 0;
          font-weight: 700;
        }

        .formatSwatchBar {
          position: absolute;
          left: 7px;
          right: 7px;
          bottom: 6px;
          height: 4px;
          border-radius: 999px;
          background: var(--swatch, #6366f1);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
        }

        .highlightBtnGlyph {
          position: relative;
          line-height: 1;
        }

        .highlightBtnGlyph::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -4px;
          height: 6px;
          border-radius: 999px;
          background: var(--swatch, #fff59d);
          opacity: .95;
        }

        .motionCard {
          transition:
            border-color .16s ease,
            background .16s ease,
            opacity .16s ease,
            box-shadow .16s ease,
            transform .16s ease;
          will-change: transform, opacity;
          position: relative;
          overflow: visible;
        }

        .motionCard:hover {
          transform: translateX(2px);
          border-color: color-mix(in srgb, var(--stroke) 68%, white 32%);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.10),
            0 10px 24px rgba(0,0,0,.08);
        }

        .motionCardActive {
          background: var(--panel2) !important;
          border-color: color-mix(in srgb, var(--stroke) 55%, #6C63FF 45%) !important;
          box-shadow: inset 0 0 0 1px rgba(108,99,255,.12);
        }

        .draggingItem {
          opacity: .42;
          transform: scale(.99);
        }

        .dropIndicatorTop::before,
        .dropIndicatorBottom::after {
          content: "";
          position: absolute;
          left: 10px;
          right: 10px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(108,99,255,.92), rgba(108,99,255,.45));
          box-shadow: 0 0 0 1px rgba(108,99,255,.16), 0 6px 16px rgba(108,99,255,.18);
          pointer-events: none;
          z-index: 3;
        }

        .dropIndicatorTop::before {
          top: -2px;
        }

        .dropIndicatorBottom::after {
          bottom: -2px;
        }

        .insideDropGlow {
          border-color: color-mix(in srgb, #6C63FF 58%, var(--stroke) 42%) !important;
          background: color-mix(in srgb, var(--panel2) 82%, #6C63FF 18%) !important;
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.16),
            0 12px 28px rgba(0,0,0,.08);
        }

        .folderDropGlow {
          border-color: color-mix(in srgb, #6C63FF 52%, var(--stroke) 48%) !important;
          background: color-mix(in srgb, var(--panel2) 82%, #6C63FF 18%) !important;
          box-shadow: inset 0 0 0 1px rgba(108,99,255,.15), 0 12px 26px rgba(0,0,0,.08);
        }

        .treeHandle {
          width: 18px;
          height: 18px;
          border: none;
          background: transparent;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          cursor: default;
          flex: 0 0 auto;
          opacity: .35;
          transition: background .15s ease, color .15s ease, opacity .15s ease;
        }

        .treeHandleVisible {
          cursor: pointer;
          opacity: 1;
        }

        .treeHandleVisible:hover {
          background: color-mix(in srgb, var(--panel2) 76%, transparent);
          color: var(--text);
        }

        .themeSelectLike {
          width: 180px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--stroke);
          background: color-mix(in srgb, var(--panel) 96%, rgba(16,16,24,.45) 4%);
          color: var(--text);
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
          transition:
            transform .16s ease,
            background .16s ease,
            border-color .16s ease,
            box-shadow .16s ease;
        }

        .themeSelectLike:hover {
          transform: translateX(1px);
          background: color-mix(in srgb, var(--panel2) 92%, rgba(18,18,28,.35) 8%);
          border-color: color-mix(in srgb, var(--stroke) 72%, #6C63FF 28%);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.12),
            0 10px 24px rgba(0,0,0,.08);
        }

        .themeMenu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 220px;
          max-height: 280px;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--stroke) 82%, white 18%);
          background: rgba(34, 36, 46, 0.94);
          box-shadow:
            0 22px 54px rgba(0,0,0,.38),
            inset 0 1px 0 rgba(255,255,255,.05);
          padding: 6px;
          z-index: 120;
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
        }

        .themeMenuItem {
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
          color: var(--text);
        }

        .themeMenuItem:hover {
          background: rgba(255,255,255,.08);
          transform: translateX(1px);
        }

        .themeDropdownLike {
          position: relative;
          min-width: 120px;
        }

        .themeDropdownButton {
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--stroke);
          background: color-mix(in srgb, var(--panel) 96%, rgba(16,16,24,.45) 4%);
          color: var(--text);
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
          gap: 10px;
          transition:
            transform .16s ease,
            background .15s ease,
            border-color .15s ease,
            box-shadow .15s ease;
        }

        .themeDropdownButton:hover {
          transform: translateX(1px);
          background: color-mix(in srgb, var(--panel2) 92%, rgba(18,18,28,.35) 8%);
          border-color: color-mix(in srgb, var(--stroke) 70%, #6C63FF 30%);
          box-shadow:
            inset 0 0 0 1px rgba(108,99,255,.10),
            0 10px 24px rgba(0,0,0,.08);
        }

        .themeDropdownMenu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 100%;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--stroke) 82%, white 18%);
          background: rgba(34, 36, 46, 0.94);
          box-shadow:
            0 22px 54px rgba(0,0,0,.38),
            inset 0 1px 0 rgba(255,255,255,.05);
          padding: 6px;
          z-index: 120;
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
        }

        .themeDropdownItem {
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
          color: var(--text);
        }

        .themeDropdownItem:hover {
          background: rgba(255,255,255,.08);
          transform: translateX(1px);
        }

        .toolbarRow {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          position: relative;
          z-index: 130;
        }

        .toolbarFormatGroup {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          position: relative;
          overflow: visible;
        }

        .colorMenuWrap {
          position: relative;
          overflow: visible;
        }

        .colorSwatchButtons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .colorDefaultBtn {
          position: relative;
          overflow: hidden;
        }

        .colorDefaultGlyph {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          border: 1px solid var(--stroke);
          background:
            linear-gradient(135deg, transparent 0 42%, rgba(255,255,255,.9) 42% 48%, transparent 48% 100%),
            color-mix(in srgb, var(--panel2) 88%, rgba(255,255,255,.08) 12%);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
        }

        .colorPickerPopup {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          left: auto;
          width: 280px;
          border-radius: 18px;
          border: 1px solid color-mix(in srgb, var(--stroke) 82%, white 18%);
          background: rgba(34, 36, 46, 0.96);
          box-shadow:
            0 24px 58px rgba(0,0,0,.42),
            inset 0 1px 0 rgba(255,255,255,.05);
          backdrop-filter: blur(24px) saturate(145%);
          -webkit-backdrop-filter: blur(24px) saturate(145%);
          padding: 14px;
          z-index: 200;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .colorPickerHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          color: var(--muted);
        }

        .colorWheel {
          width: 188px;
          height: 188px;
          margin: 0 auto;
          border-radius: 50%;
          position: relative;
          cursor: crosshair;
          background:
            radial-gradient(circle at center, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,.06) 100%),
            conic-gradient(
              from 0deg,
              #ff0000,
              #ffff00,
              #00ff00,
              #00ffff,
              #0000ff,
              #ff00ff,
              #ff0000
            );
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.08),
            0 8px 24px rgba(0,0,0,.16);
        }

        .colorWheel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(255,255,255,.92) 0%, rgba(255,255,255,0) 55%);
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .colorWheelMarker {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,.28);
          transform: translate(-50%, -50%);
          pointer-events: none;
          background: transparent;
        }

        .colorPreviewRow {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .colorPreviewSwatch {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid var(--stroke);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
          flex: 0 0 auto;
        }

        .colorHexInput {
          flex: 1;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--stroke);
          background: rgba(255,255,255,.04);
          color: var(--text);
          padding: 0 12px;
          outline: none;
          font-family: "JetBrains Mono", monospace;
        }

        .presetGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
        }

        .presetSwatch {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,.14);
          transition: transform .16s ease, box-shadow .16s ease;
        }

        .presetSwatch:hover {
          transform: scale(1.08);
          box-shadow: 0 8px 18px rgba(0,0,0,.18);
        }

        .editorShell {
          flex: 1;
          min-height: 220px;
          border-radius: 12px;
          border: 1px solid var(--stroke);
          background: transparent;
          overflow: hidden;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
        }

        .editorGutter {
          border-right: 1px solid color-mix(in srgb, var(--stroke) 70%, transparent);
          background: color-mix(in srgb, var(--panel) 84%, rgba(20,20,30,.16) 16%);
          color: var(--muted);
          user-select: none;
          overflow: hidden;
          position: relative;
        }

        .editorGutterInner {
          position: absolute;
          inset: 0;
          transform: translateY(calc(-1 * var(--scrollTop, 0px)));
          padding-top: 12px;
          padding-bottom: 12px;
        }

        .editorLineNumber {
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding-right: 12px;
          font-size: 12px;
          line-height: 1.6;
          opacity: .9;
          height: var(--lineHeight, 25.6px);
          box-sizing: border-box;
        }

        .editorContent {
          padding: 12px;
          outline: none;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-y: auto;
          background: transparent;
          text-align: left;
          font-size: 16px;
          line-height: 1.6;
        }

        .editorContent * {
          text-align: inherit;
        }

        .fadeInPanel {
          animation: fadeInUp .16s ease both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px) scale(.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 320px minmax(0, 1fr)",
          gap: 16,
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          className="glass fadeInPanel"
          style={{
            padding: 12,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={createFolder} title="Create a folder">
              + Folder
            </button>

            <div className="themeDropdownLike" ref={folderSortRef} style={{ flex: 1 }}>
              <div
                className="themeDropdownButton"
                onClick={() => setFolderSortMenuOpen((v) => !v)}
                title="Sort folders"
              >
                <span>{folderSort === "manual" ? "Manual" : "A-Z"}</span>
                <span style={{ opacity: 0.7 }}>▾</span>
              </div>

              {folderSortMenuOpen && (
                <div className="themeDropdownMenu">
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setFolderSort("manual");
                      setFolderSortMenuOpen(false);
                    }}
                  >
                    Manual
                  </div>
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setFolderSort("title");
                      setFolderSortMenuOpen(false);
                    }}
                  >
                    A-Z
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            onClick={() => setActiveFolder("all")}
            style={folderStyle(activeFolder === "all")}
            className={`motionCard ${activeFolder === "all" ? "motionCardActive" : ""}`}
            title="Show all notes"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <NotesIcon />
  <span>All Notes</span>
</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "auto",
              minHeight: 0,
              paddingRight: 2,
              paddingTop: 2,
            }}
          >
            {visibleFolders.map((f) => {
              const isDragging = dragItem?.type === "folder" && dragItem.id === f.id;
              const isFolderDropTarget =
                dropTarget?.type === "folder" && dropTarget.id === f.id;
              const isNoteFolderDropTarget =
                dropTarget?.type === "note-folder" && dropTarget.id === f.id;

              const folderDropPlacement =
                isFolderDropTarget && dropTarget?.placement === "after"
                  ? "dropIndicatorBottom"
                  : isFolderDropTarget
                  ? "dropIndicatorTop"
                  : "";

              return (
                <div
                  key={f.id}
                  draggable={folderSort === "manual"}
                  onDragStart={(e) => handleDragStart(e, "folder", f.id)}
                  onDragEnd={() => {
                    setDragItem(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();

                    if (dragItem?.type === "folder" && folderSort === "manual") {
                      const placement = getVerticalPlacement(e);
                      setDropTarget({
                        type: "folder",
                        id: f.id,
                        placement: placement === "inside" ? "before" : placement,
                      });
                    }

                    if (dragItem?.type === "note" && noteSort === "manual") {
                      setDropTarget({ type: "note-folder", id: f.id });
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();

                    if (dragItem?.type === "folder") {
                      const placement = getVerticalPlacement(e);
                      handleFolderDrop(f.id, placement === "inside" ? "before" : placement);
                    }

                    if (dragItem?.type === "note") {
                      handleNoteDropToFolder(f.id);
                    }
                  }}
                  onClick={() => setActiveFolder(f.id)}
                  style={folderStyle(activeFolder === f.id)}
                  className={[
                    "motionCard",
                    activeFolder === f.id ? "motionCardActive" : "",
                    isDragging ? "draggingItem" : "",
                    isNoteFolderDropTarget ? "folderDropGlow" : "",
                    folderDropPlacement,
                  ].join(" ")}
                  title={`Open folder: ${f.name}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: f.color,
                        flex: "0 0 auto",
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                    <button
                      className="btn iconBtn"
                      title="Rename folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameFolder(f.id);
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="btn iconBtn"
                      title="Delete folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(f.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
                <div
          className="glass fadeInPanel"
          style={{
            padding: 12,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 170px",
              gap: 8,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <button
              className="btn"
              onClick={createNote}
              title="Create a new note"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              + New Note
            </button>

            <div className="themeDropdownLike" ref={noteSortRef} style={{ minWidth: 0 }}>
              <div
                className="themeDropdownButton"
                onClick={() => setNoteSortMenuOpen((v) => !v)}
                title="Sort notes"
              >
                <span>
                  {noteSort === "manual"
                    ? "Manual"
                    : noteSort === "title"
                    ? "A-Z"
                    : noteSort === "recent"
                    ? "Recent"
                    : "Pinned"}
                </span>
                <span style={{ opacity: 0.7 }}>▾</span>
              </div>

              {noteSortMenuOpen && (
                <div className="themeDropdownMenu">
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setNoteSort("manual");
                      setNoteSortMenuOpen(false);
                    }}
                  >
                    Manual
                  </div>
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setNoteSort("title");
                      setNoteSortMenuOpen(false);
                    }}
                  >
                    A-Z
                  </div>
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setNoteSort("recent");
                      setNoteSortMenuOpen(false);
                    }}
                  >
                    Recent
                  </div>
                  <div
                    className="themeDropdownItem"
                    onClick={() => {
                      setNoteSort("pinned");
                      setNoteSortMenuOpen(false);
                    }}
                  >
                    Pinned
                  </div>
                </div>
              )}
            </div>
          </div>

                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative", minWidth: 0 }}>
              <input
                ref={searchInputRef}
                className="input"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes..."
                title="Search notes"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minWidth: 0,
                  paddingRight: noteSearch.trim() ? 40 : undefined,
                }}
              />

              {noteSearch.trim() && (
                <button
                  className="btn iconBtn"
                  onClick={() => setNoteSearch("")}
                  title="Clear search"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 4,
                    transform: "translateY(-50%)",
                    width: 30,
                    minWidth: 30,
                    height: 30,
                    borderRadius: 8,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {!!availableTags.length && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Tag filters
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={toggleTagFilterMode}
                    title={`Current mode: ${tagFilterMode.toUpperCase()}`}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 999,
                      fontSize: 12,
                    }}
                  >
                    {tagFilterMode.toUpperCase()}
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    minWidth: 0,
                    maxHeight: 72,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {availableTags.map(({ tag, count }) => {
                    const isSelected = selectedTagFilters.includes(tag);

                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`btn ${isSelected ? "btnSelected" : ""}`}
                        onClick={() => toggleTagFilter(tag)}
                        title={`Filter by tag: ${tag}`}
                        style={{
                          height: 30,
                          padding: "0 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          gap: 6,
                        }}
                      >
                        <span>#{tag}</span>
                        <span style={{ opacity: 0.7 }}>{count}</span>
                      </button>
                    );
                  })}

                  {!!selectedTagFilters.length && (
                    <button
                      type="button"
                      className="btn"
                      onClick={clearTagFilters}
                      title="Clear tag filters"
                      style={{
                        height: 30,
                        padding: "0 10px",
                        borderRadius: 999,
                        fontSize: 12,
                      }}
                    >
                      Clear tags
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                padding: "0 4px",
                minHeight: 16,
              }}
            >
              {noteSearch.trim() || selectedTagFilters.length
                ? `${visibleNotesScoped.length} result${visibleNotesScoped.length === 1 ? "" : "s"}${
                    selectedTagFilters.length ? ` • ${tagFilterMode.toUpperCase()}` : ""
                  }`
                : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "auto",
              minHeight: 0,
              paddingRight: 2,
              paddingBottom: 6,
              paddingTop: 2,
              borderRadius: 12,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragItem?.type === "note" && noteSort === "manual" && !visibleNotesScoped.length) {
                setDropTarget({
                  type: "note-list",
                  id: activeFolder === "all" ? "default" : activeFolder,
                });
              }
            }}
            onDrop={() => {
              if (dragItem?.type === "note" && noteSort === "manual" && !visibleNotesScoped.length) {
                handleNoteDropToFolder(activeFolder === "all" ? "default" : activeFolder);
              }
            }}
          >
            <NotesTree
              notes={visibleNotesScoped}
              activeId={activeId}
              dragItem={dragItem}
              dropTarget={dropTarget}
              noteSort={noteSort}
              collapsedMap={collapsedMap}
              setCollapsedMap={setCollapsedMap}
              setDropTarget={setDropTarget}
              setActiveId={setActiveId}
              setDragItem={setDragItem}
              handleDragStart={handleDragStart}
              handleNoteDrop={handleNoteDrop}
              createSubnote={createSubnote}
              noteSearch={noteSearch}
              togglePin={togglePin}
            />

            {!visibleNotesScoped.length && (
              <div
                className="motionCard"
                style={{
                  minHeight: 120,
                  borderRadius: 12,
                  border: "1px dashed var(--stroke)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--muted)",
                  background:
                    dropTarget?.type === "note-list"
                      ? "color-mix(in srgb, var(--panel2) 78%, #6C63FF 22%)"
                      : "transparent",
                }}
              >
                                {noteSearch.trim() || selectedTagFilters.length
                  ? "No notes match the current filters"
                  : "Drop a note here"}
              </div>
            )}
          </div>
        </div>

        <div
          className="glass fadeInPanel"
          style={{
            padding: 12,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
            overflow: "visible",
          }}
        >
          {activeNote && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
                minHeight: 0,
                overflow: "visible",
              }}
            >
                <EditorToolbar
                activeNote={activeNote}
                toolbarState={toolbarState}
                fontMenuOpen={fontMenuOpen}
                setFontMenuOpen={setFontMenuOpen}
                fontMenuRef={fontMenuRef}
                fonts={fonts}
                updateNote={updateNote}
                applyInlineFontFamily={applyInlineFontFamily}
                applyInlineFontSize={applyInlineFontSize}
                applyFormat={applyFormat}
                openColorMenu={openColorMenu}
                applyHighlightWithCurrentColor={applyHighlightWithCurrentColor}
                colorMenuOpen={colorMenuOpen}
                colorMenuRef={colorMenuRef}
                colorMode={colorMode}
                setColorMode={setColorMode}
                colorWheelRef={colorWheelRef}
                startWheelDrag={startWheelDrag}
                markerLeft={markerLeft}
                markerTop={markerTop}
                hexInput={hexInput}
                setHexInput={setHexInput}
                applyHexInput={applyHexInput}
                applyChosenColor={applyChosenColor}
                saveCurrentColorPreset={saveCurrentColorPreset}
                colorPresets={colorPresets}
                clearSelectedTextColor={clearSelectedTextColor}
                clearSelectedHighlightColor={clearSelectedHighlightColor}
                applyAlign={applyAlign}
                applyLink={applyLink}
                insertImage={insertImage}
                handleToolbarMouseDown={handleToolbarMouseDown}
                alignMenuOpen={alignMenuOpen}
                setAlignMenuOpen={setAlignMenuOpen}
                alignMenuRef={alignMenuRef}
                activeAlignment={activeAlignment}
              />

              <input
                className="input"
                value={activeNote.title}
                onChange={(e) => updateNote("title", e.target.value)}
                title="Edit note title"
              />

                            <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "color-mix(in srgb, var(--panel) 92%, rgba(18,18,28,.24) 8%)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Tags
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0,}}>
                  {(activeNote.tags || []).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="btn"
                      onClick={() => removeTagFromActiveNote(tag)}
                      title={`Remove tag: ${tag}`}
                      style={{
                        height: 30,
                        padding: "0 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        background:
                          "color-mix(in srgb, var(--panel2) 84%, rgba(108,99,255,.16) 16%)",
                      }}
                    >
                      #{tag} ×
                    </button>
                  ))}

                  {!activeNote.tags?.length && (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      No tags yet
                    </div>
                  )}
                </div>

                <input
                  className="input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                 onBlur={(e) => {
  if (e.relatedTarget?.tagName === "BUTTON") return;
  if (tagInput.trim()) addTagToActiveNote(tagInput);
}}
                  placeholder="Type a tag and press Enter"
                  title="Add tag"
                />
              </div>

              <div className="editorShell">
                <div
                  className="editorGutter"
                  style={{
                    "--lineHeight": `${lineHeightPx}px`,
                    "--scrollTop": `${editorScrollTop}px`,
                  }}
                >
                  <div className="editorGutterInner">
                    {Array.from({ length: editorLineCount }, (_, i) => (
                      <div key={i} className="editorLineNumber">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>

                                <div
                  ref={editorRef}
                  className="editorContent"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onMouseUp={() => {
                    saveSelection();
                    updateToolbarState();
                  }}
                  onKeyUp={() => {
                    saveSelection();
                    syncEditorMetrics();
                    updateToolbarState();
                  }}
                  onFocus={() => {
                    saveSelection();
                    updateToolbarState();
                  }}
                  onPaste={handleEditorPaste}
                  onScroll={syncEditorMetrics}
                  style={{
                    fontFamily: getFontStack(activeNote.font || "Inter"),
                    fontSize: `${activeNote.fontSize || 16}px`,
                    lineHeight: 1.6,
                    caretColor: "var(--text)",
                    color: "var(--text)",
                  }}
                  title="Write your note here"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                {activeNote.parentId && (
                  <button
                    className="btn"
                    onClick={() => {
                      const parent = notes.find((n) => n.id === activeNote.parentId);
                      if (parent) {
                        setCollapsedMap((prev) => ({ ...prev, [parent.id]: false }));
                        setActiveId(parent.id);
                      }
                    }}
                    title="Go to parent note"
                  >
                    Parent
                  </button>
                )}

                {!activeNote.parentId && (
                  <button
                    className="btn"
                    onClick={() => createSubnote(activeNote.id)}
                    title="Create subnote"
                  >
                    + Subnote
                  </button>
                )}

                <button
                  className="btn iconBtn"
                  onClick={() => deleteNote(activeNote.id)}
                  title="Delete note"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
            {imageModalOpen && (
        <div
          className="fadeInPanel"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
          onMouseDown={() => setImageModalOpen(false)}
        >
          <div
            className="glass fadeInPanel"
            style={{
              width: 420,
              maxWidth: "calc(100vw - 24px)",
              padding: 20,
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Insert image</h3>
              <button className="btn iconBtn" onClick={() => setImageModalOpen(false)} title="Close">
                ×
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`btn ${imageMode === "upload" ? "btnSelected" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setImageMode("upload")}
              >
                Upload
              </button>
              <button
                className={`btn ${imageMode === "url" ? "btnSelected" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setImageMode("url")}
              >
                URL
              </button>
            </div>

            {imageMode === "upload" ? (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />

                <div
                  style={{
                    border: "1px dashed var(--stroke)",
                    borderRadius: 12,
                    padding: 14,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  Choose an image from your computer, or copy an image and paste it directly into the editor.
                </div>
              </>
            ) : (
              <>
                <input
                  className="input"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png"
                  autoFocus
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn" onClick={() => setImageModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btnPrimary" onClick={insertImageFromUrl}>
                    Insert
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
            {folderModal && (
        <div
          className="fadeInPanel"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            className="glass fadeInPanel"
            style={{
              width: 320,
              padding: 20,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>
              {folderModal.type === "create" ? "New Folder" : "Rename Folder"}
            </h3>

            <input
              className="input"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              title="Folder name"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setFolderModal(null)} title="Cancel">
                Cancel
              </button>
              <button className="btn btnPrimary" onClick={handleSaveFolder} title="Save folder">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}