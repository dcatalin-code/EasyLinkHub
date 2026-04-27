import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CLIENT_TEXT = {
  manual: "Manual",
  name: "Name",
  status: "Status",
  updated: "Updated",
  tag: "Tag",
  tagWithValue: "Tag: {{value}}",
  column: "Column",
  columnWithValue: "Column: {{value}}",
  sort: "Sort",
  typeTag: "Type a tag...",
  add: "Add",
  suggestions: "Suggestions",
  current: "Current",
  nextmonth: "Next month",
  "tag presence": "Tag presence",
  direction: "Direction",
  "choose tag": "Choose tag",
  "Choose column": "Choose column",
  "Client deleted": "Client deleted",
  "Delete client": "Delete client",
  Delete: "Delete",
  Client: "Client",
  "Client duplicated": "Client duplicated",
  "Client added": "Client added",
  "Column added": "Column added",
  addClient: "Add client",
  addColumn: "Add column",
  search: "Search...",
  hideArchived: "Hide archived",
  showArchived: "Show archived",
  shown: "shown",
  tags: "Tags",
  notes: "Notes",
  actions: "Actions",
  Name: "Name",
  notesPlaceholder: "Notes...",
  "column name": "Column name",
  type: "Type",
  "add client": "Add client",
  Remove: "Remove",
  "Click to remove": "Click to remove",
};

function txt(key, vars = {}) {
  let value = CLIENT_TEXT[key] || key;
  Object.keys(vars).forEach((name) => {
    value = value.replace(`{{${name}}}`, vars[name]);
  });
  return value;
}


function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return "id_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

function clamp(n, a, b) {
  return Math.min(Math.max(n, a), b);
}

function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

function startWeekdayMonday(d) {
  const js = d.getDay(); // 0 Sun..6 Sat
  return (js + 6) % 7; // 0..6 (Mon..Sun)
}

function sanitizeNumberText(s) {
  if (s == null) return "";
  s = String(s);
  s = s.replace(/[^\d\.\-]/g, "");
  s = s.replace(/(?!^)-/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  return s;
}

function hexToRgba(hex, a = 0.18) {
  try {
    if (!hex) return `rgba(201,53,114,${a})`;
    let h = String(hex).trim();
    if (h[0] === "#") h = h.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6) return `rgba(201,53,114,${a})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch {
    return `rgba(201,53,114,${a})`;
  }
}

function IconChevronDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSort({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3M4.5 8.5h15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 5.5h11c1.1046 0 2 .8954 2 2v12c0 1.1046-.8954 2-2 2h-11c-1.1046 0-2-.8954-2-2v-12c0-1.1046.8954-2 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMinus({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function useOutsidePointerDown(refs, onOutside, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e) => {
      const t = e.target;
      for (const r of refs) {
        const el = r?.current;
        if (el && el.contains(t)) return;
      }
      onOutside?.(e);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [enabled, onOutside, refs]);
}

function Popover({ open, anchorRef, onClose, children, width = 260, maxHeight = 340, className = "" }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0, w: width });

  useEffect(() => {
    if (!open) return;

    const recalc = () => {
      const r = anchorRef?.current?.getBoundingClientRect?.();
      if (!r) return;

      const menuW = Math.max(220, typeof width === "number" ? width : r.width);
      const pad = 12;
      const gutter = 18;
      const measured = menuRef.current?.scrollHeight || 0;
      const menuH = clamp(Math.min(maxHeight, measured || maxHeight, 380), 120, 380);

      const maxX = Math.max(pad, (window.innerWidth || 0) - menuW - pad - gutter);
      const maxY = Math.max(pad, (window.innerHeight || 0) - menuH - pad);

      const x = clamp(r.left, pad, maxX);
      const preferredY = r.bottom + 8;
      const yDown = clamp(preferredY, pad, maxY);
      const yUp = clamp(r.top - menuH - 8, pad, maxY);
      const y = (preferredY + menuH > (window.innerHeight || 0) - pad) ? yUp : yDown;

      setPos({ x, y, w: menuW });
    };

    recalc();
    requestAnimationFrame(recalc);
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open, width, maxHeight, anchorRef]);

  useOutsidePointerDown([anchorRef, menuRef], () => onClose?.(), open);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`portalPopover crmPopover ${className}`}
      style={{ position: "fixed", zIndex: 9999, left: pos.x, top: pos.y, width: pos.w, padding: 6, maxHeight, overflow: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

function Cb({ checked, onChange, title, ariaLabel }) {
  return (
    <button
      type="button"
      className={"cb" + (checked ? " cbOn" : "") + " crmCbBtn"}
      onClick={() => onChange?.(!checked)}
      title={title}
      aria-label={ariaLabel}
    >
      <span className="cbBox" aria-hidden="true">
        <span className="cbTick" />
      </span>
    </button>
  );
}

function AutoTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = next + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="input crmTextarea"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={1}
    />
  );
}

function StatusSelect({ value, options, statusMap, onChange, width = 170 }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value) || options[0];
  const color = statusMap?.[selected?.value]?.color || "#60a5fa";
  const tint = hexToRgba(color, 0.14);
  const border = hexToRgba(color, 0.30);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="crmSelectBtn crmStatusBtn"
        style={{ width, background: tint, borderColor: border }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="crmStatusDot" style={{ background: color }} />
        <span className="crmSelectText">{selected?.label || "Status"}</span>
        <span className="crmSelectRight" aria-hidden="true">
          <IconChevronDown size={16} />
        </span>
      </button>

      <Popover open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={typeof width === "number" ? Math.max(220, width) : "auto"} maxHeight={340}>
        {options.map((o) => {
          const isSel = o.value === value;
          const col = statusMap?.[o.value]?.color || "#60a5fa";
          return (
            <button
              key={o.value}
              type="button"
              className={"crmMenuItem" + (isSel ? " isSelected" : "")}
              onClick={() => {
                onChange?.(o.value);
                setOpen(false);
              }}
            >
              <span className="crmMenuLeft">
                <span className="crmStatusDot" style={{ background: col }} />
                <span>{o.label}</span>
              </span>
              <span className="crmMenuRight">{isSel ? "✓" : ""}</span>
            </button>
          );
        })}
      </Popover>
    </>
  );
}

function TagsEditor({ tags, allTags, onChange }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const normalized = (s) => String(s || "").toLowerCase().trim();

  const suggestions = useMemo(() => {
    const have = new Set((tags || []).map((t) => normalized(t)));
    const query = normalized(q);
    const list = (allTags || [])
      .filter(Boolean)
      .filter((t) => !have.has(normalized(t)))
      .filter((t) => !query || normalized(t).includes(query))
      .slice(0, 10);
    return list;
  }, [tags, allTags, q]);

  function addTag(raw) {
    const t = String(raw || "").trim();
    if (!t) return;
    const next = Array.from(new Set([...(tags || []), t]));
    onChange?.(next);
    setQ("");
  }

  function removeTag(t) {
    const next = (tags || []).filter((x) => x !== t);
    onChange?.(next);
  }

  return (
    <>
      <div className="crmTagsWrap">
        {(tags || []).map((t) => (
          <span key={t} className="crmTagChip" title={t}>
            <span className="crmTagText">{t}</span>
            <button type="button" className="crmTagX" onClick={() => removeTag(t)} aria-label={txt("Remove")}>
              ✕
            </button>
          </span>
        ))}
        <button
          ref={btnRef}
          type="button"
          className="crmTagAdd"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          + {txt("tag")}
          <span aria-hidden="true" style={{ display: "inline-flex", opacity: 0.9 }}>
            <IconChevronDown size={14} />
          </span>
        </button>
      </div>

      <Popover open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={280} maxHeight={360}>
        <div style={{ padding: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={txt("typeTag")}
              style={{ width: "100%" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(q);
                }
                if (e.key === "Escape") setOpen(false);
              }}
              autoFocus
            />
            <button
              className="btn"
              type="button"
              onClick={() => addTag(q)}
              style={{ padding: "10px 12px", borderRadius: 12 }}
            >
             + {txt("add")}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="crmHint">{txt("suggestions")}</div>
              <div className="crmSugList">
                {suggestions.map((t) => (
                  <button key={t} type="button" className="crmSug" onClick={() => addTag(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(tags || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="crmHint">{txt("current")}</div>
              <div className="crmSugList">
                {(tags || []).map((t) => (
                  <button key={t} type="button" className="crmSug crmSugOn" onClick={() => removeTag(t)} title={txt("Click to remove")}>
                    {t}
                    <span style={{ marginLeft: 6, opacity: 0.75 }}>✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}

function BasicSelect({ value, options, onChange, width = 220, placeholder = "Select" }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value) || null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="crmSelectBtn"
        style={{ width }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="crmSelectText">{selected?.label || placeholder}</span>
        <span className="crmSelectRight" aria-hidden="true">
          <IconChevronDown size={16} />
        </span>
      </button>

      <Popover open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={typeof width === "number" ? Math.max(220, width) : 260} maxHeight={340}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="crmMenuItem"
            onClick={() => {
              onChange?.(o.value);
              setOpen(false);
            }}
          >
            <span className="crmMenuLeft"><span>{o.label}</span></span>
            <span className="crmMenuRight">{o.value === value ? "✓" : ""}</span>
          </button>
        ))}
      </Popover>
    </>
  );
}

function DatePicker({ value, onChange, width = 240 }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);

  const initial = useMemo(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d) ? new Date() : d;
  }, [value]);

  const [view, setView] = useState(() => monthKey(initial));

  useEffect(() => {
    if (!open) return;
    setView(monthKey(initial));
  }, [open, initial]);

  const [pos, setPos] = useState({ x: 0, y: 0, w: 320 });

  useEffect(() => {
    if (!open) return;
    const recalc = () => {
      const r = btnRef.current?.getBoundingClientRect?.();
      if (!r) return;
      const w = Math.max(300, r.width);
      const h = 340;
      const pad = 12;
      const gutter = 18;
      const maxX = Math.max(pad, (window.innerWidth || 0) - w - pad - gutter);
      const maxY = Math.max(pad, (window.innerHeight || 0) - h - pad);

      const x = clamp(r.left, pad, maxX);
      const preferredY = r.bottom + 8;
      const yDown = clamp(preferredY, pad, maxY);
      const yUp = clamp(r.top - h - 8, pad, maxY);
      const y = (preferredY + h > (window.innerHeight || 0) - pad) ? yUp : yDown;

      setPos({ x, y, w });
    };

    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open]);

  useOutsidePointerDown([btnRef, popRef], () => setOpen(false), open);

  const [yStr, mStr] = view.split("-");
  const y = Number(yStr);
  const m0 = Number(mStr) - 1;
  const dim = daysInMonth(y, m0);
  const first = new Date(y, m0, 1);
  const offset = startWeekdayMonday(first);

  const selectedIso = value || "";
  const label = value ? formatDateLabel(value) : "Pick date";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="crmSelectBtn crmDateBtn"
        onClick={() => setOpen((v) => !v)}
        style={{ width }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={"crmSelectText" + (value ? "" : " crmMuted")}>{label}</span>
        <span className="crmSelectRight" aria-hidden="true">
          <IconCalendar size={16} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover crmPopover"
            style={{ position: "fixed", zIndex: 9999, left: pos.x, top: pos.y, width: pos.w, padding: 10 }}
          >
            <div className="crmCalTop">
              <button
                className="iconBtn"
                type="button"
                title="Previous month"
                onClick={() => {
                  const d = new Date(y, m0, 1);
                  d.setMonth(d.getMonth() - 1);
                  setView(monthKey(d));
                }}
              >
                ‹
              </button>

              <div className="crmCalTitle">
                {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(y, m0, 1))}
              </div>

              <button
                className="iconBtn"
                type="button"
                title={txt("nextmonth")}
                onClick={() => {
                  const d = new Date(y, m0, 1);
                  d.setMonth(d.getMonth() + 1);
                  setView(monthKey(d));
                }}
              >
                ›
              </button>
            </div>

            <div className="crmCalendarGrid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <div key={w} className="crmCalDow">
                  {w}
                </div>
              ))}

              {Array.from({ length: offset }).map((_, i) => (
                <div key={"e" + i} />
              ))}

              {Array.from({ length: dim }).map((_, i) => {
                const day = i + 1;
                const iso = `${yStr}-${String(m0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSel = iso === selectedIso;
                const isToday = iso === new Date().toISOString().slice(0, 10);

                return (
                  <button
                    key={iso}
                    type="button"
                    className={"crmCalDay" + (isSel ? " isSelected" : "") + (isToday ? " isToday" : "")}
                    onClick={() => {
                      onChange?.(iso);
                      setOpen(false);
                    }}
                    title={iso}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  onChange?.("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  onChange?.(today);
                  setOpen(false);
                }}
                style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Modal({ title, children, onClose, width = 860 }) {
  const ref = useRef(null);

  // Keep modal open when interacting with portaled popovers (date pickers / dropdowns).
  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      const card = ref.current;
      if (card && card.contains(t)) return;

      // If click is inside any portal popover, do NOT close the modal.
      // (Those popovers are rendered outside the modal DOM via createPortal.)
      const pop = t?.closest?.(".portalPopover");
      if (pop) return;

      onClose?.();
    };

    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  return createPortal(
    <div className="modalOverlay" style={{ zIndex: 9999 }}>
      <div
        ref={ref}
        className="modalCard"
        style={{
          width: "min(" + width + "px, calc(100vw - 28px))",
          maxHeight: "calc(100vh - 28px)",
          overflow: "auto",
          padding: 18,
        }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button className="iconBtn" type="button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function fieldValue(client, colId) {
  const f = client?.fields || {};
  return f[colId] ?? "";
}

function setFieldValue(setData, clientId, colId, val) {
  setData((d) => {
    const next = (d.clients || []).map((c) => {
      if (c.id !== clientId) return c;
      const fields = { ...(c.fields || {}) };
      if (val === "" || val == null) delete fields[colId];
      else fields[colId] = val;
      return { ...c, fields, updatedAt: Date.now() };
    });
    return { ...d, clients: next };
  });
}

function reorderWithPos(setData, dragId, dropId, pos) {
  if (!dragId || !dropId || dragId === dropId) return;
  setData((d) => {
    const list = [...(d.clients || [])];
    list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    const from = list.findIndex((x) => x.id === dragId);
    let to = list.findIndex((x) => x.id === dropId);
    if (from < 0 || to < 0) return d;

    const item = list.splice(from, 1)[0];
    if (from < to) to -= 1;
    if (pos === "bottom") to += 1;

    to = clamp(to, 0, list.length);
    list.splice(to, 0, item);

    const next = list.map((c, i) => ({ ...c, orderIndex: i }));
    return { ...d, clients: next };
  });
}

function sortLabel(sortMode, tagSort, columns) {
  if (!sortMode || !sortMode.type) return txt("manual");

  if (sortMode.type === "Manual") return txt("manual");
  if (sortMode.type === "Name") return txt("name");
  if (sortMode.type === "Status") return txt("status");
  if (sortMode.type === "Updated") return txt("updated");

  if (sortMode.type === "Tag") {
    return tagSort
      ? txt("tagWithValue", { value: tagSort })
      : txt("tag");
  }

  if (sortMode.type === "Column") {
    const col = (columns || []).find((c) => c.id === sortMode.key);

    return col?.name
      ? txt("columnWithValue", { value: col.name })
      : txt("column");
  }

  return txt(sortMode.type.toLowerCase());
}

function SortMenu({ sortMode, setSortMode, tagSort, setTagSort, allTags, columns }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("root"); // root | tag | col

  const label = sortLabel(sortMode, tagSort, columns) || "";

  function chooseType(type) {
    if (type === "Column" && columns.length && !sortMode.key) {
      setSortMode((s) => ({ ...s, type: "Column", key: columns[0].id }));
      return;
    }
    setSortMode((s) => ({ ...s, type }));
  }

  const canDir = sortMode.type !== "Manual";

  return (
    <>
      <button
        ref={btnRef}
        className="btn"
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setView("root");
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconSort size={16} />
        {txt("sort")}
        <span className="crmSortMeta">{label}</span>
        <IconChevronDown size={16} />
      </button>

      <Popover open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={320} maxHeight={420}>
        {view !== "root" && (
          <button
            className="crmMenuItem"
            type="button"
            onClick={() => setView("root")}
            style={{ justifyContent: "flex-start" }}
          >
            ← Back
          </button>
        )}

        {view === "root" && (
          <>
            <button className={"crmMenuItem" + (sortMode.type === "Manual" ? " isSelected" : "")} type="button" onClick={() => { chooseType("Manual"); setOpen(false); }}>
              <span className="crmMenuLeft"><span>{txt("manual")}</span></span>
              <span className="crmMenuRight">{sortMode.type === "Manual" ? "✓" : ""}</span>
            </button>
            <button className={"crmMenuItem" + (sortMode.type === "Name" ? " isSelected" : "")} type="button" onClick={() => { chooseType("Name"); setOpen(false); }}>
              <span className="crmMenuLeft"><span>{txt("name")}</span></span>
              <span className="crmMenuRight">{sortMode.type === "Name" ? "✓" : ""}</span>
            </button>
            <button className={"crmMenuItem" + (sortMode.type === "Status" ? " isSelected" : "")} type="button" onClick={() => { chooseType("Status"); setOpen(false); }}>
              <span className="crmMenuLeft"><span>{txt("status")}</span></span>
              <span className="crmMenuRight">{sortMode.type === "Status" ? "✓" : ""}</span>
            </button>
            <button className={"crmMenuItem" + (sortMode.type === "Updated" ? " isSelected" : "")} type="button" onClick={() => { chooseType("Updated"); setOpen(false); }}>
              <span className="crmMenuLeft"><span>{txt("updated")}</span></span>
              <span className="crmMenuRight">{sortMode.type === "Updated" ? "✓" : ""}</span>
            </button>

            {allTags.length > 0 && (
              <button
                className={"crmMenuItem" + (sortMode.type === "Tag" ? " isSelected" : "")}
                type="button"
                onClick={() => {
                  chooseType("Tag");
                  if (!tagSort && allTags[0]) setTagSort(allTags[0]);
                  setView("tag");
                }}
              >
                <span className="crmMenuLeft"><span>{txt("tag presence")}</span></span>
                <span className="crmMenuRight">→</span>
              </button>
            )}

            {columns.length > 0 && (
              <button
                className={"crmMenuItem" + (sortMode.type === "Column" ? " isSelected" : "")}
                type="button"
                onClick={() => {
                  chooseType("Column");
                  setView("col");
                }}
              >
                <span className="crmMenuLeft"><span>{txt("column")}</span></span>
                <span className="crmMenuRight">→</span>
              </button>
            )}

            {canDir && (
              <div className="crmMenuSection">
                <div className="crmHint">{txt("direction")}</div>
                <div className="crmDirRow">
                  <button
                    className={"crmDirBtn" + (sortMode.dir !== "desc" ? " isOn" : "")}
                    type="button"
                    onClick={() => setSortMode((s) => ({ ...s, dir: "asc" }))}
                  >
                    Asc
                  </button>
                  <button
                    className={"crmDirBtn" + (sortMode.dir === "desc" ? " isOn" : "")}
                    type="button"
                    onClick={() => setSortMode((s) => ({ ...s, dir: "desc" }))}
                  >
                    Desc
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {view === "tag" && (
          <div style={{ padding: 6 }}>
            <div className="crmHint">{txt("choose tag")}</div>
            <div className="crmPickList">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={"crmPick" + (t === tagSort ? " isSelected" : "")}
                  onClick={() => {
                    setTagSort(t);
                    setOpen(false);
                  }}
                >
                  {t}
                  <span>{t === tagSort ? "✓" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "col" && (
          <div style={{ padding: 6 }}>
            <div className="crmHint">{txt("Choose column")}</div>
            <div className="crmPickList">
              {columns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={"crmPick" + (c.id === sortMode.key ? " isSelected" : "")}
                  onClick={() => {
                    setSortMode((s) => ({ ...s, type: "Column", key: c.id }));
                    setOpen(false);
                  }}
                >
                  {c.name || "Column"}
                  <span>{c.id === sortMode.key ? "✓" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
    </>
  );
}

export default function ClientsPage({ data, setData, statusMap, setConfirm, toastOk, actionsRef }) {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Table-only zoom controls (persisted)
  const [tableZoom, setTableZoom] = useState(() => {
    try {
      const raw = localStorage.getItem("clientsTableZoom");
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0) return clamp(v, 0.8, 1.4);
    } catch {}
    return 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem("clientsTableZoom", String(tableZoom));
    } catch {}
  }, [tableZoom]);

  const [sortMode, setSortMode] = useState({ type: "Manual", dir: "asc", key: "" });
  const [tagSort, setTagSort] = useState("");

  const [selected, setSelected] = useState(() => new Set());

  const [dragId, setDragId] = useState("");
  const [dragOverId, setDragOverId] = useState("");
  const [dropPos, setDropPos] = useState("middle"); // top | bottom | middle

  const [ctx, setCtx] = useState(null); // {x,y,id}
  const ctxMenuRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [colOpen, setColOpen] = useState(false);
  const [colDraft, setColDraft] = useState({ name: "", type: "text" });

  // Sticky horizontal scrollbar (always accessible)
  const tableCardRef = useRef(null);
  const tableScrollRef = useRef(null);
  const gridRef = useRef(null);
  const stickyHScrollRef = useRef(null);
  const stickyHInnerRef = useRef(null);
  const [showStickyHScroll, setShowStickyHScroll] = useState(false);
  const [hasHOverflow, setHasHOverflow] = useState(false);

  // Expose stable actions to the parent (App topbar) so those buttons can
  // open the Clients modals without duplicating UI controls.
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      openAddClient: () => setAddOpen(true),
      openAddColumn: () => {
        setColDraft({ name: "", type: "text" });
        setColOpen(true);
      },
    };
    return () => {
      if (actionsRef.current) actionsRef.current = null;
    };
  }, [actionsRef]);

  const columns = data?.columns || [];
  const statuses = data?.statuses || [];

  const statusOptions = useMemo(() => {
    const opts = (statuses || []).map((s) => ({ value: s.id, label: s.name }));
    return opts.length ? opts : [{ value: "lead", label: "Lead" }];
  }, [statuses]);

  const allTags = useMemo(() => {
    const set = new Set();
    (data.clients || []).forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.clients]);

  const normalized = (s) => String(s || "").toLowerCase().trim();

  const filtered = useMemo(() => {
    const q = normalized(search);
    const list = (data.clients || []).filter((c) => {
      if (!showArchived && c.archived) return false;
      if (!q) return true;

      const hay = [
        c.name,
        c.notes,
        c.status,
        ...(c.tags || []),
        ...Object.values(c.fields || {}).map(String),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    const dirMul = sortMode.dir === "desc" ? -1 : 1;
    const type = sortMode.type;

    if (type === "Name") {
      list.sort((a, b) => dirMul * String(a.name || "").localeCompare(String(b.name || "")));
    } else if (type === "Status") {
      list.sort((a, b) => dirMul * String(a.status || "").localeCompare(String(b.status || "")));
    } else if (type === "Updated") {
      list.sort((a, b) => dirMul * ((a.updatedAt ?? 0) - (b.updatedAt ?? 0)));
    } else if (type === "Tag") {
      const t = tagSort || "";
      list.sort((a, b) => {
        const av = (a.tags || []).includes(t) ? 1 : 0;
        const bv = (b.tags || []).includes(t) ? 1 : 0;
        return dirMul * (bv - av);
      });
    } else if (type === "Column" && sortMode.key) {
      const key = sortMode.key;
      list.sort((a, b) => dirMul * String(fieldValue(a, key)).localeCompare(String(fieldValue(b, key))));
    }

    return list;
  }, [data.clients, search, showArchived, sortMode, tagSort]);

  function toast(msg) {
    try {
      toastOk?.(msg);
    } catch {}
  }

  function confirmDeleteClient(id) {
    const c = (data.clients || []).find((x) => x.id === id);
    const name = c?.name || "client";
    const doDelete = () => {
      setData((d) => ({ ...d, clients: (d.clients || []).filter((x) => x.id !== id) }));
      toast(txt("Client deleted"));
      if (setConfirm) setConfirm(null);
    };

    if (setConfirm) {
      setConfirm({
        title: txt("Delete client"),
        message: txt(`Delete \"${name}\"? This cannot be undone.`),
        confirmText: txt("Delete"),
        onConfirm: doDelete,
      });
      return;
    }

    if (window.confirm(txt(`Delete \"${name}\"?`))) doDelete();
  }

  function duplicateClient(id) {
    const c = (data.clients || []).find((x) => x.id === id);
    if (!c) return;
    setData((d) => {
      const list = [...(d.clients || [])];
      const nextIndex = list.reduce((m, x) => Math.max(m, x.orderIndex ?? 0), 0) + 1;
      const copy = {
        ...c,
        id: uid(),
        name: (c.name || txt("Client")) + " (copy)",
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        orderIndex: nextIndex,
      };
      list.push(copy);
      return { ...d, clients: list };
    });
    toast(txt("Client duplicated"));
  }

  function toggleArchive(id) {
    setData((d) => {
      const next = (d.clients || []).map((c) => (c.id === id ? { ...c, archived: !c.archived, updatedAt: Date.now() } : c));
      return { ...d, clients: next };
    });
  }

  function moveClient(id, delta) {
    setData((d) => {
      const list = [...(d.clients || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      const i = list.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return d;
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
      const next = list.map((c, idx) => ({ ...c, orderIndex: idx }));
      return { ...d, clients: next };
    });
  }

  function openContextMenu(e, id) {
    e.preventDefault();
    e.stopPropagation();

    const menuW = 260;
    const menuH = 260;
    const pad = 12;
    const gutter = 18;

    const maxX = Math.max(pad, (window.innerWidth || 0) - menuW - pad - gutter);
    const maxY = Math.max(pad, (window.innerHeight || 0) - menuH - pad);

    const x = clamp(e.clientX, pad, maxX);
    const y = clamp(e.clientY, pad, maxY);

    setCtx({ x, y, id });
  }

  useEffect(() => {
    if (!ctx) return;
    const onKey = (e) => {
      if (e.key === "Escape") setCtx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctx]);

  useOutsidePointerDown([ctxMenuRef], () => setCtx(null), !!ctx);

  function toggleSelectAll(checked) {
    if (!checked) return setSelected(new Set());
    const s = new Set(filtered.map((c) => c.id));
    setSelected(s);
  }

  function toggleSelectOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateClient(id, patch) {
    setData((d) => {
      const next = (d.clients || []).map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
      return { ...d, clients: next };
    });
  }

  const gridTemplateColumns = useMemo(() => {
    const selectW = "44px";
    const dragW = "44px";
    const nameW = "260px";
    const statusW = "190px";
    const tagsW = "260px";
    const notesW = "minmax(420px, 1.8fr)";
    const parts = [selectW, dragW, nameW, statusW, tagsW, notesW];
    for (let i = 0; i < columns.length; i++) parts.push("240px");
    parts.push("104px");
    return parts.join(" ");
  }, [columns.length, tableZoom]);

  const [draft, setDraft] = useState({ name: "", status: "lead", tags: [], notes: "", fields: {} });

  useEffect(() => {
    if (!addOpen) return;
    setDraft({ name: "", status: statuses?.[0]?.id || "lead", tags: [], notes: "", fields: {} });
  }, [addOpen, statuses]);

  useEffect(() => {
    if (!colOpen) return;
    setColDraft({ name: "", type: "text" });
  }, [colOpen]);

  // Keep the sticky horizontal scrollbar visible only while the table is on screen.
  useEffect(() => {
    const el = tableCardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShowStickyHScroll(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries?.some((x) => x.isIntersecting) || false;
        setShowStickyHScroll(vis);
      },
      { root: null, threshold: 0 }
    );

    io.observe(el);
    return () => {
      try {
        io.disconnect();
      } catch {}
    };
  }, []);

  // Sync sticky horizontal scrollbar with the table's actual scroll container.
  useEffect(() => {
    const main = tableScrollRef.current;
    const grid = gridRef.current;
    const bar = stickyHScrollRef.current;
    const inner = stickyHInnerRef.current;
    if (!main || !grid || !bar || !inner) return;

    let lock = false;

    const syncFromMain = () => {
      if (lock) return;
      lock = true;
      try {
        bar.scrollLeft = main.scrollLeft;
      } finally {
        lock = false;
      }
    };

    const syncFromBar = () => {
      if (lock) return;
      lock = true;
      try {
        main.scrollLeft = bar.scrollLeft;
      } finally {
        lock = false;
      }
    };

    const updateMetrics = () => {
      const w = grid.scrollWidth || 0;
      inner.style.width = w + "px";

      const fits = w <= (main.clientWidth || 0) + 1;
      setHasHOverflow((prev) => (prev !== !fits ? !fits : prev));

      // Keep bar in sync even if layout changes.
      syncFromMain();
    };

    updateMetrics();

    main.addEventListener("scroll", syncFromMain, { passive: true });
    bar.addEventListener("scroll", syncFromBar, { passive: true });

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateMetrics());
      try {
        ro.observe(grid);
        ro.observe(main);
      } catch {}
    }

    window.addEventListener("resize", updateMetrics);
    return () => {
      try {
        main.removeEventListener("scroll", syncFromMain);
        bar.removeEventListener("scroll", syncFromBar);
      } catch {}
      try {
        window.removeEventListener("resize", updateMetrics);
      } catch {}
      try {
        ro?.disconnect?.();
      } catch {}
    };
  }, [columns.length]);

  function addClient() {
    const name = String(draft.name || "").trim();
    if (!name) return;

    setData((d) => {
      const list = [...(d.clients || [])];
      const nextIndex = list.reduce((m, x) => Math.max(m, x.orderIndex ?? 0), -1) + 1;

      const c = {
        id: uid(),
        name,
        status: draft.status || "lead",
        tags: draft.tags || [],
        notes: draft.notes || "",
        fields: draft.fields || {},
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        orderIndex: nextIndex,
      };

      list.push(c);
      return { ...d, clients: list };
    });

    setAddOpen(false);
    toast(txt("Client added"));
  }


  function addColumn() {
    const name = String(colDraft.name || "").trim();
    const type = (colDraft.type || "text").toLowerCase();
    if (!name) return;

    setData((d) => ({
      ...d,
      columns: [
        ...(d.columns || []),
        { id: uid(), name, type: type === "number" ? "number" : type === "date" ? "date" : "text" },
      ],
    }));

    setColOpen(false);
    toast(txt("Column added"));
  }

  // Drag-over throttling (smooth + stable)
  const rafRef = useRef(0);
  const overRef = useRef({ id: "", pos: "middle" });

  const injectedCss = `
    .modalOverlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px;
      backdrop-filter: blur(10px);
    }
    .modalCard {
      background: rgba(18,18,22,0.86);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 22px;
      box-shadow: 0 18px 60px rgba(0,0,0,0.55);
    }

    
    .crmTableScroll {
      overflow: auto;
      position: relative;
      scrollbar-gutter: stable;
      /* Extra space so the sticky bottom scrollbar doesn't cover the last row */
      padding-bottom: 46px;
      padding-right: 0px;
      background: rgba(18,18,22,0.38);
      -webkit-overflow-scrolling: touch;
    }

    /* Clients table scrollbars (always visible / high-contrast) */
    .crmTableScroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.34) rgba(255,255,255,0.08); }
    .crmTableScroll::-webkit-scrollbar { width: 12px; height: 12px; }
    .crmTableScroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.08); }
    .crmTableScroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.34);
      border-radius: 999px;
      border: 3px solid rgba(255,255,255,0.08);
      background-clip: padding-box;
    }
    .crmTableScroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.44); }

    [data-theme="light"] .crmTableScroll { background: rgba(255,255,255,0.72); scrollbar-color: rgba(0,0,0,0.34) rgba(0,0,0,0.08); }
    [data-theme="light"] .crmTableScroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.08); }
    [data-theme="light"] .crmTableScroll::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.32);
      border: 3px solid rgba(0,0,0,0.08);
    }
    [data-theme="light"] .crmTableScroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.42); }

    /* Table-only zoom wrapper (affects the grid/table only, not the toolbar) */
    .crmZoomWrap { display: inline-block; width: max-content; transform-origin: top left; }
    @supports (zoom: 1) {
      .crmZoomWrap { zoom: var(--crmZoom, 1); transform: none; }
    }
    @supports not (zoom: 1) {
      .crmZoomWrap { transform: scale(var(--crmZoom, 1)); }
    }

    /* Sticky bottom horizontal scrollbar (mirror of .crmTableScroll's scrollLeft) */
    .crmStickyHBar {
      position: sticky;
      bottom: 0;
      z-index: 40;
      height: 40px;
      margin-top: -40px;
      background: rgba(18,18,22,0.78);
      border-top: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      padding: 0 12px;
      box-sizing: border-box;
    }
    .crmStickyHBar.isHidden { opacity: 0; pointer-events: none; }
    [data-theme="light"] .crmStickyHBar { background: rgba(255,255,255,0.88); border-top-color: rgba(0,0,0,0.12); }

    .crmStickyHScroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-gutter: stable;
    }
    .crmStickyHInner { height: 1px; }

    /* Make the sticky bottom scrollbar easier to grab/click */
    .crmStickyHScroll { scrollbar-width: auto; scrollbar-color: rgba(255,255,255,0.48) rgba(255,255,255,0.10); }
    .crmStickyHScroll::-webkit-scrollbar { height: 18px; }
    .crmStickyHScroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.10); border-radius: 999px; }
    .crmStickyHScroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.48);
      border-radius: 999px;
      border: 4px solid rgba(255,255,255,0.10);
      background-clip: padding-box;
    }
    .crmStickyHScroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.60); }

    [data-theme="light"] .crmStickyHScroll { scrollbar-color: rgba(0,0,0,0.40) rgba(0,0,0,0.10); }
    [data-theme="light"] .crmStickyHScroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.10); }
    [data-theme="light"] .crmStickyHScroll::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.40);
      border: 4px solid rgba(0,0,0,0.10);
    }
    [data-theme="light"] .crmStickyHScroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.54); }

    .crmGrid {
      min-width: max-content;
      display: flex;
      flex-direction: column;
      padding-right: 0px;
    }

    .fieldLabel {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,255,255,0.72);
      margin-bottom: 8px;
    }
    [data-theme="light"] .fieldLabel { color: rgba(0,0,0,0.70); }

    .crmRow {
      display: grid;
      grid-template-columns: ${gridTemplateColumns};
      align-items: stretch;
      position: relative;
    }

    
    .crmCell {
      padding: 10px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 56px;
      overflow: hidden;
      background: rgba(0,0,0,0.00);
    }
    .crmRow > .crmCell:last-child { border-right: 0; }
    [data-theme="light"] .crmCell { border-bottom-color: rgba(0,0,0,0.08); border-right-color: rgba(0,0,0,0.08); }


    .crmRow:hover .crmCell { background: rgba(255,255,255,0.012); }

    .crmHeader {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(18,18,22,0.78);
      border-bottom: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(10px);
    }
    [data-theme="light"] .crmHeader { background: rgba(255,255,255,0.88); border-bottom-color: rgba(0,0,0,0.12); }


    .crmHeader .crmCell {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.70);
      background: rgba(18,18,22,0.78);
      border-bottom: 1px solid rgba(255,255,255,0.10);
    }
    [data-theme="light"] .crmHeader .crmCell { color: rgba(0,0,0,0.70); background: rgba(255,255,255,0.88); border-bottom-color: rgba(0,0,0,0.12); }


    
    .crmStickyRight {
      position: sticky;
      right: 0px;
      z-index: 15;
      background: rgba(18,18,22,0.72);
      border-left: 1px solid rgba(255,255,255,0.12);
      justify-content: center;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    [data-theme="light"] .crmStickyRight {
      background: rgba(255,255,255,0.78);
      border-left-color: rgba(0,0,0,0.14);
    }


    .crmHeader .crmStickyRight { z-index: 25; }

    /* Make the sticky Actions column feel like a true continuation (no visual gap) */
    .crmHeader .crmStickyRight { border-top-right-radius: 22px; }
    .crmRow:last-child .crmStickyRight { border-bottom-right-radius: 22px; }

    .crmDragGhost { opacity: 0.28; }

    .crmDropLineTop::before,
    .crmDropLineBottom::after {
      content: "";
      position: absolute;
      left: 10px;
      right: 10px;
      height: 3px;
      background: rgba(201,53,114,0.90);
      box-shadow: 0 0 0 1px rgba(201,53,114,0.35), 0 0 18px rgba(201,53,114,0.22);
      border-radius: 999px;
      pointer-events: none;
      z-index: 30;
    }
    .crmDropLineTop::before { top: -1px; }
    .crmDropLineBottom::after { bottom: -1px; }

    .crmSelectBtn {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      cursor: pointer;
      transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
      line-height: 1;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .crmSelectBtn:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.18);
    }
    .crmSelectBtn:active { transform: translateY(0) scale(0.99); }

    .crmSelectText { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .crmSelectRight { display: inline-flex; opacity: 0.90; }
    .crmMuted { opacity: 0.75; }

    .crmStatusBtn { justify-content: flex-start; }
    .crmStatusDot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      box-shadow: 0 0 0 2px rgba(0,0,0,0.20);
      flex-shrink: 0;
    }

    .crmPopover { scrollbar-gutter: stable; }

    .crmMenuItem {
      width: 100%;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
      user-select: none;
      font-weight: 500;
      font-size: 13px;
    }
    .crmMenuItem:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.14);
      transform: translateY(-1px);
    }
    .crmMenuItem:active { transform: translateY(0px); }
    .crmMenuItem.isSelected {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.18);
    }
    .crmMenuLeft { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
    .crmMenuLeft span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .crmMenuRight { opacity: 0.9; }

    .crmSortMeta {
      margin-left: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.14);
      color: rgba(255,255,255,0.72);
      font-size: 12px;
      max-width: 210px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .crmMenuSection { padding: 8px 6px 4px 6px; }
    .crmHint { font-size: 11px; color: rgba(255,255,255,0.66); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; }
    .crmDirRow { display: flex; gap: 8px; }
    .crmDirBtn {
      flex: 1;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      opacity: 0.85;
    }
    .crmDirBtn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); }
    .crmDirBtn.isOn { opacity: 1; border-color: rgba(201,53,114,0.35); background: rgba(201,53,114,0.14); }

    .crmPickList { display: flex; flex-direction: column; gap: 6px; }
    .crmPick {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.03);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .crmPick:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); }
    .crmPick.isSelected { border-color: rgba(201,53,114,0.32); background: rgba(201,53,114,0.12); }

    .crmTagsWrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      width: 100%;
    }
    .crmTagChip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      max-width: 100%;
    }
    .crmTagText {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.92;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .crmTagX {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.16);
      cursor: pointer;
      color: rgba(255,255,255,0.85);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      font-size: 11px;
    }
    .crmTagX:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }

    .crmTagAdd {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px dashed rgba(255,255,255,0.18);
      background: rgba(0,0,0,0.12);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.86);
    }
    .crmTagAdd:hover { border-color: rgba(201,53,114,0.40); background: rgba(255,255,255,0.04); }

    .crmSugList { display: flex; flex-wrap: wrap; gap: 8px; }
    .crmSug {
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .crmSug:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
    .crmSugOn { border-color: rgba(201,53,114,0.32); background: rgba(201,53,114,0.12); }

    .crmTextarea {
      width: 100%;
      resize: none;
      overflow: hidden;
      line-height: 1.35;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: rgba(0,0,0,0.16);
    }

    .crmCbBtn {
      padding: 0;
      border: 0;
      background: transparent;
    }

    .crmCalTop { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .crmCalTitle { font-weight: 700; font-size: 13px; opacity: 0.92; }

    .crmCalendarGrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; align-items: center; }
    .crmCalDow { font-size: 11px; opacity: 0.75; text-align: center; padding: 6px 0; user-select: none; }
    .crmCalDay {
      height: 36px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
      font-weight: 600;
      font-size: 12px;
    }
    .crmCalDay:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }
    .crmCalDay:active { transform: translateY(0px); }
    .crmCalDay.isToday { border-color: rgba(201,53,114,0.32); }
    .crmCalDay.isSelected { background: rgba(201,53,114,0.18); border-color: rgba(201,53,114,0.38); }
  `;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{injectedCss}</style>


      {!actionsRef && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btnPrimary"
            type="button"
            onClick={() => setAddOpen(true)}
            style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
          >
            + {txt("addClient")}
          </button>
        </div>
      )}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>

          <input
            className={txt("input")}
            style={{ width: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={txt("search")}
          />

          <button className="btn" type="button" onClick={() => setShowArchived((v) => !v)} title="Show archived">
            {showArchived ? txt("hideArchived") : txt("showArchived")}
          </button>

          <SortMenu
            sortMode={sortMode}
            setSortMode={setSortMode}
            tagSort={tagSort}
            setTagSort={setTagSort}
            allTags={allTags}
            columns={columns}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn"
              type="button"
              title="Zoom out table"
              aria-label="Zoom out table"
              disabled={tableZoom <= 0.8}
              onClick={() =>
                setTableZoom((z) => {
                  const next = Math.round((z - 0.1) * 10) / 10;
                  return clamp(next, 0.8, 1.4);
                })
              }
              style={{ width: 38, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <IconMinus size={18} />
            </button>

            <button
              className="btn"
              type="button"
              title="Zoom in table"
              aria-label="Zoom in table"
              disabled={tableZoom >= 1.4}
              onClick={() =>
                setTableZoom((z) => {
                  const next = Math.round((z + 0.1) * 10) / 10;
                  return clamp(next, 0.8, 1.4);
                })
              }
              style={{ width: 38, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <IconPlus size={18} />
            </button>
          </div>
<div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
            {filtered.length} {txt("shown")}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }} ref={tableCardRef}>
        <div
          className="crmTableScroll"
          ref={tableScrollRef}
          onDragLeave={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (!inside) {
              setDragOverId("");
              setDropPos("middle");
            }
          }}
        >
          <div className="crmZoomWrap" ref={gridRef} style={{ ["--crmZoom"]: tableZoom }}>
            <div className="crmGrid">
            <div className="crmRow crmHeader">
              <div className="crmCell">
                <Cb
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onChange={(v) => toggleSelectAll(v)}
                  title="Select all"
                  ariaLabel="Select all"
                />
              </div>
              <div className="crmCell" style={{ justifyContent: "center" }} />
              <div className="crmCell">{txt("name")}</div>
              <div className="crmCell">{txt("status")}</div>
              <div className="crmCell">{txt("tags")}</div>
              <div className="crmCell">{txt("notes")}</div>
              {columns.map((c) => (
                <div key={c.id} className="crmCell">
                  {c.name || "Column"}
                </div>
              ))}
              <div className="crmCell crmStickyRight">{txt("actions")}</div>
            </div>

            {filtered.map((c) => {
              const isDragging = dragId === c.id;
              const isOver = dragOverId === c.id;

              const rowClass =
                "crmRow" +
                (isDragging ? " crmDragGhost" : "") +
                (isOver && dropPos === "top" ? " crmDropLineTop" : "") +
                (isOver && dropPos === "bottom" ? " crmDropLineBottom" : "");

              const statusId = c.status || statusOptions[0]?.value || "lead";

              return (
                <div
                  key={c.id}
                  className={rowClass}
                  data-rowid={c.id}
                  onDragOver={(e) => {
                    if (sortMode.type !== "Manual") return;
                    e.preventDefault();

                    const rect = e.currentTarget.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    const nextPos = e.clientY < mid ? "top" : "bottom";

                    overRef.current = { id: c.id, pos: nextPos };
                    if (rafRef.current) return;
                    rafRef.current = requestAnimationFrame(() => {
                      rafRef.current = 0;
                      const o = overRef.current;
                      if (o.id !== dragOverId) setDragOverId(o.id);
                      if (o.pos !== dropPos) setDropPos(o.pos);
                    });
                  }}
                  onDrop={(e) => {
                    if (sortMode.type !== "Manual") return;
                    e.preventDefault();
                    reorderWithPos(setData, dragId, c.id, dropPos);
                    setDragId("");
                    setDragOverId("");
                    setDropPos("middle");
                  }}
                  onDragEnd={() => {
                    setDragId("");
                    setDragOverId("");
                    setDropPos("middle");
                  }}
                  onContextMenu={(e) => openContextMenu(e, c.id)}
                >
                  <div className="crmCell">
                    <Cb
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelectOne(c.id)}
                      title="Select row"
                      ariaLabel="Select row"
                    />
                  </div>

                  <div className="crmCell" style={{ justifyContent: "center" }}>
                    <button
                      className="iconBtn dragHandleBtn"
                      type="button"
                      title={sortMode.type === "Manual" ? "Drag to reorder" : "Manual reorder disabled (Sort must be Manual)"}
                      aria-label="Drag"
                      draggable={sortMode.type === "Manual"}
                      onDragStart={(e) => {
                        if (sortMode.type !== "Manual") return;
                        setDragId(c.id);
                        try {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", c.id);
                          const ghost = document.createElement("div");
                          ghost.style.position = "fixed";
                          ghost.style.top = "-9999px";
                          ghost.style.left = "-9999px";
                          ghost.style.padding = "10px 12px";
                          ghost.style.borderRadius = "14px";
                          ghost.style.background = "rgba(18,18,22,0.92)";
                          ghost.style.border = "1px solid rgba(255,255,255,0.14)";
                          ghost.style.color = "rgba(255,255,255,0.92)";
                          ghost.style.fontSize = "13px";
                          ghost.style.fontWeight = "700";
                          ghost.style.maxWidth = "360px";
                          ghost.style.whiteSpace = "nowrap";
                          ghost.style.overflow = "hidden";
                          ghost.style.textOverflow = "ellipsis";
                          ghost.textContent = c.name ? `Moving: ${c.name}` : "Moving client";
                          document.body.appendChild(ghost);
                          try {
                            e.dataTransfer.setDragImage(ghost, 18, 18);
                          } catch {}
                          setTimeout(() => {
                            try {
                              ghost.remove();
                            } catch {}
                          }, 0);
                        } catch {}
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      ⠿
                    </button>
                  </div>

                  <div className="crmCell">
                    <input
                      className={txt("input")}
                      value={c.name || ""}
                      onChange={(e) => updateClient(c.id, { name: e.target.value })}
                      placeholder = {txt("Name")}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="crmCell">
                    <StatusSelect
                      value={statusId}
                      options={statusOptions.map((o) => ({ value: o.value, label: statusMap?.[o.value]?.name || o.label }))}
                      statusMap={statusMap}
                      onChange={(v) => updateClient(c.id, { status: v })}
                      width={190}
                    />
                  </div>

                  <div className="crmCell">
                    <TagsEditor
                      tags={c.tags || []}
                      allTags={allTags}
                      onChange={(next) => updateClient(c.id, { tags: next })}
                    />
                  </div>

                  <div className="crmCell">
                    <AutoTextarea
                      value={c.notes || ""}
                      onChange={(v) => updateClient(c.id, { notes: v })}
                      placeholder={txt("notesPlaceholder")}
                    />
                  </div>

                  {columns.map((col) => {
                    const v = fieldValue(c, col.id);
                    const type = (col.type || "text").toLowerCase();

                    if (type === "number") {
                      return (
                        <div key={col.id} className="crmCell">
                          <input
                            className="input"
                            value={sanitizeNumberText(v)}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) => setFieldValue(setData, c.id, col.id, sanitizeNumberText(e.target.value))}
                            style={{ width: "100%" }}
                          />
                        </div>
                      );
                    }

                    if (type === "date") {
                      return (
                        <div key={col.id} className="crmCell">
                          <DatePicker value={String(v || "")} onChange={(iso) => setFieldValue(setData, c.id, col.id, iso)} width={240} />
                        </div>
                      );
                    }

                    return (
                      <div key={col.id} className="crmCell">
                        <input
                          className="input"
                          value={String(v || "")}
                          onChange={(e) => setFieldValue(setData, c.id, col.id, e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </div>
                    );
                  })}

                  <div className="crmCell crmStickyRight">
                    <div className="rowActionIcons">
                      <button className="iconBtn actionIcon" title="Duplicate" onClick={() => duplicateClient(c.id)}>
                        ⧉
                      </button>
                      <button
                        className="iconBtn actionIcon danger"
                        title="Delete"
                        onClick={() => confirmDeleteClient(c.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="crmRow">
                <div className="crmCell" style={{ gridColumn: "1 / -1", justifyContent: "center", padding: 18, color: "var(--muted)" }}>
                  No clients
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky, thicker horizontal scrollbar (always reachable while the table is in view) */}
      <div className={"crmStickyHBar" + (showStickyHScroll && hasHOverflow ? "" : " isHidden")}
           aria-hidden={!(showStickyHScroll && hasHOverflow)}>
        <div ref={stickyHScrollRef} className="crmStickyHScroll" aria-label="Horizontal scroll for clients table">
          <div ref={stickyHInnerRef} className="crmStickyHInner" />
        </div>
      </div>

      {ctx &&
        createPortal(
          <div
            ref={ctxMenuRef}
            className="portalPopover crmPopover"
            style={{ left: ctx.x, top: ctx.y, width: 260, padding: 6 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button className="crmMenuItem" type="button" onClick={() => { moveClient(ctx.id, -1); setCtx(null); }}>
              <span className="crmMenuLeft"><span>Move up</span></span>
              <span className="crmMenuRight">↑</span>
            </button>

            <button className="crmMenuItem" type="button" onClick={() => { moveClient(ctx.id, 1); setCtx(null); }}>
              <span className="crmMenuLeft"><span>Move down</span></span>
              <span className="crmMenuRight">↓</span>
            </button>

            <div className="sep" style={{ margin: "6px 0", opacity: 0.35 }} />

            <button className="crmMenuItem" type="button" onClick={() => { duplicateClient(ctx.id); setCtx(null); }}>
              <span className="crmMenuLeft"><span>Duplicate</span></span>
              <span className="crmMenuRight">⧉</span>
            </button>

            <button className="crmMenuItem" type="button" onClick={() => { toggleArchive(ctx.id); setCtx(null); }}>
              <span className="crmMenuLeft"><span>Archive / Unarchive</span></span>
              <span className="crmMenuRight">⟲</span>
            </button>

            <div className="sep" style={{ margin: "6px 0", opacity: 0.35 }} />

            <button
              className="crmMenuItem"
              type="button"
              onClick={() => { confirmDeleteClient(ctx.id); setCtx(null); }}
              style={{ borderColor: "rgba(239,68,68,0.22)" }}
            >
              <span className="crmMenuLeft"><span style={{ color: "rgba(239,68,68,0.95)" }}>Delete</span></span>
              <span className="crmMenuRight" style={{ color: "rgba(239,68,68,0.95)" }}>✕</span>
            </button>
          </div>,
          document.body
        )}

      
      {colOpen && (
        <Modal title="Add column" onClose={() => setColOpen(false)} width={640}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 18, alignItems: "stretch" }}>
            <div>
              <div className="fieldLabel">{txt("column name")} *</div>
              <input
                className="input"
                value={colDraft.name}
                onChange={(e) => setColDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Budget, Website, Contract date…"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div className="fieldLabel">{txt("type")}</div>
              <BasicSelect
                value={colDraft.type}
                onChange={(v) => setColDraft((d) => ({ ...d, type: v }))}
                width="100%"
                placeholder={txt("type")}
                options={[
                  { value: "text", label: "Text" },
                  { value: "number", label: "Number" },
                  { value: "date", label: "Date" },
                ]}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <button className="btn" type="button" onClick={() => setColOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              type="button"
              onClick={addColumn}
              style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
            >
              + {txt("addColumn")}
            </button>
          </div>
        </Modal>
      )}

{addOpen && (
        <Modal title="Add client" onClose={() => setAddOpen(false)} width={980}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 1fr", gap: 14, alignItems: "end" }}>
            <div>
              <div className="fieldLabel">Name *</div>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Client name"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div className="fieldLabel">{txt("status")}</div>
              <StatusSelect
                value={draft.status}
                options={statusOptions.map((o) => ({ value: o.value, label: statusMap?.[o.value]?.name || o.label }))}
                statusMap={statusMap}
                onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                width="100%"
              />
            </div>

            <div>
              <div className="fieldLabel">{txt("notes")}</div>
              <AutoTextarea
                value={draft.notes}
                onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
                placeholder="Optional notes"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div className="fieldLabel">{txt("tags")}</div>
              <TagsEditor
                tags={draft.tags || []}
                allTags={allTags}
                onChange={(next) => setDraft((d) => ({ ...d, tags: next }))}
              />
            </div>

            {columns.length > 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: 2 }}>
                <div style={{ fontWeight: 700, marginBottom: 10, opacity: 0.85 }}>Custom fields</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                  {columns.map((col) => {
                    const type = (col.type || "text").toLowerCase();
                    const v = draft.fields?.[col.id] ?? "";

                    return (
                      <div key={col.id}>
                        <div className="fieldLabel">{col.name || "Column"}</div>
                        {type === "number" ? (
                          <input
                            className="input"
                            value={sanitizeNumberText(v)}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                fields: { ...(d.fields || {}), [col.id]: sanitizeNumberText(e.target.value) },
                              }))
                            }
                            style={{ width: "100%" }}
                          />
                        ) : type === "date" ? (
                          <DatePicker
                            value={String(v || "")}
                            onChange={(iso) =>
                              setDraft((d) => ({
                                ...d,
                                fields: { ...(d.fields || {}), [col.id]: iso },
                              }))
                            }
                            width="100%"
                          />
                        ) : (
                          <input
                            className="input"
                            value={String(v || "")}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                fields: { ...(d.fields || {}), [col.id]: e.target.value },
                              }))
                            }
                            style={{ width: "100%" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              type="button"
              onClick={addClient}
              style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
            >
              + {txt("add client")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
