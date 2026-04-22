import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
import {
  Checkbox,
  DatePicker,
  IconBell,
  InlineEdit,
  currencySymbol,
  monthKey,
  parseISO,
  todayISO,
} from "../shared/crmShared.jsx";

function uid() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function clampNum(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return `rgba(59,130,246,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function Popover({ open, anchorRef, onClose, width = 260, maxHeight = 360, overflow = "auto", gutter = 10, children, align = "left" }) {
  const popRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, w: width });

  const computePos = () => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Keep the popover fully visible even on narrow viewports.
    const desiredW = typeof width === "number" ? width : Math.max(200, Math.round(r.width));
    const maxW = Math.max(160, vw - gutter * 2);
    const w = Math.min(desiredW, maxW);
    const leftRaw = align === "right" ? r.right - w : r.left;
    const left = Math.max(gutter, Math.min(vw - w - gutter, leftRaw));

    // Prefer below; if not enough room, place above.
    // Use the real popover height when available to avoid "jump" glitches.
    const popH = Math.min(maxHeight, Math.max(120, Math.round(popRef.current?.getBoundingClientRect?.().height || 320)));
    const belowTop = r.bottom + 8;
    const aboveTop = r.top - 8;
    let top = belowTop + popH <= vh - gutter ? belowTop : Math.max(gutter, aboveTop - popH);

    // Clamp into viewport just in case.
    if (top + popH > vh - gutter) top = Math.max(gutter, vh - gutter - popH);

    setPos({ top, left, w });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    // Recompute after first paint so popover height is measurable.
    const raf = requestAnimationFrame(() => computePos());
    return () => cancelAnimationFrame(raf);
  }, [open, width, maxHeight, align, gutter]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      const p = popRef.current;
      const a = anchorRef?.current;
      if (!p) return;
      if (p.contains(e.target)) return;
      if (a && a.contains(e.target)) return;
      onClose?.();
    };

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    const onRelayout = () => {
      computePos();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onRelayout, true);
    window.addEventListener("resize", onRelayout);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onRelayout, true);
      window.removeEventListener("resize", onRelayout);
    };
  }, [open, onClose, anchorRef, width, maxHeight, align, gutter]);

  if (!open) return null;

  const node = (
    <div
      ref={popRef}
      role="listbox"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.w,
        maxHeight,
        overflow,
        zIndex: 99999,
        borderRadius: 16,
        border: "1px solid var(--stroke)",
        background: "rgba(12,12,18,0.96)",
        boxShadow: "0 14px 50px rgba(0,0,0,0.45)",
        padding: 6,
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );

  // Portal avoids "position:fixed" inside transformed parents (tables/modals)
  return createPortal(node, document.body);
}

function PrioritySelect({ value, onChange, width = 170 }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => [
      { value: "Low", label: "Low", color: "#a1a1aa" },
      { value: "Medium", label: "Medium", color: "#3b82f6" },
      { value: "High", label: "High", color: "#ef4444" },
    ],
    []
  );

  const selected = options.find((o) => o.value === value) || options[1];
  const tint = hexToRgba(selected.color, 0.14);
  const border = hexToRgba(selected.color, 0.32);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="crmSelectBtn"
        style={{
          width,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 999,
          border: `1px solid ${border}`,
          background: tint,
          color: "var(--text)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: 999, background: selected.color, boxShadow: "0 0 0 3px rgba(0,0,0,0.12)" }}
          />
          <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected.label}
          </span>
        </span>
        <span aria-hidden="true" style={{ opacity: 0.9, fontSize: 14 }}>
          ▾
        </span>
      </button>

      <Popover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        width={typeof width === "number" ? Math.max(220, width) : "auto"}
        maxHeight={280}
      >
        {options.map((o) => {
          const isSel = o.value === selected.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange?.(o.value);
                setOpen(false);
              }}
              className={"crmMenuItem" + (isSel ? " isSelected" : "")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 12,
                border: "none",
                background: isSel ? "rgba(255,255,255,0.08)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: o.color }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{o.label}</span>
              </span>
              <span style={{ opacity: isSel ? 1 : 0.2 }}>{isSel ? "✓" : ""}</span>
            </button>
          );
        })}
      </Popover>
    </>
  );
}

function ClientPickerSearch({ clients, clientId, onChange, width = 220, placeholder = "No Client" }) {
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = Array.isArray(clients) ? clients : [];
  const selected = list.find((c) => c && c.id === clientId) || null;

  const filtered = useMemo(() => {
    const query = String(q || "").toLowerCase().trim();
    if (!query) return list;
    return list.filter((c) => String(c?.name || "").toLowerCase().includes(query));
  }, [list, q]);

  useLayoutEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      try {
        inputRef.current?.focus?.();
        inputRef.current?.select?.();
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const maxW = typeof width === "number" ? width : 220;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="crmSelectBtn"
        style={{
          width: "auto",
          minWidth: 120,
          maxWidth: maxW,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 999,
          border: "1px solid var(--stroke)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--text)",
          cursor: "pointer",
          userSelect: "none",
        }}
        title={selected?.name ? selected.name : placeholder}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            opacity: selected?.name ? 1 : 0.85,
          }}
        >
          {selected?.name ? selected.name : placeholder}
        </span>
        <span aria-hidden="true" style={{ opacity: 0.9, fontSize: 12, lineHeight: 1 }}>
          ▾
        </span>
      </button>

      <Popover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        width={Math.max(260, maxW)}
        maxHeight={420}
        overflow="hidden"
        align="right"
      >
        <div style={{ padding: 8 }}>
          <input
            ref={inputRef}
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client…"
            style={{ width: "100%", marginBottom: 8, fontSize: 12 }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              type="button"
              className={"crmMenuItem" + (!clientId ? " isSelected" : "")}
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 12,
                border: "none",
                background: !clientId ? "rgba(255,255,255,0.08)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, opacity: 0.92 }}>{placeholder}</span>
              <span style={{ opacity: !clientId ? 1 : 0.2 }}>{!clientId ? "✓" : ""}</span>
            </button>

            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />

            <div style={{ maxHeight: 280, overflow: "auto", paddingRight: 2 }}>
              {filtered.length ? (
                filtered.map((c) => {
                  const isSel = c?.id === clientId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange?.(c.id);
                        setOpen(false);
                      }}
                      className={"crmMenuItem" + (isSel ? " isSelected" : "")}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "9px 10px",
                        borderRadius: 12,
                        border: "none",
                        background: isSel ? "rgba(255,255,255,0.08)" : "transparent",
                        color: "var(--text)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      title={c?.name || "Client"}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                        }}
                      >
                        {c?.name || "Client"}
                      </span>
                      <span style={{ opacity: isSel ? 1 : 0.2 }}>{isSel ? "✓" : ""}</span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: 10, color: "var(--muted)", fontSize: 12 }}>No matches</div>
              )}
            </div>
          </div>
        </div>
      </Popover>
    </>
  );
}


function ConfettiLayer({ bursts }) {
  if (!bursts || bursts.length === 0) return null;

  const node = (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999999 }}>
      {bursts.map((b) => (
        <div key={b.id} className="taskConfettiBurst" style={{ position: "fixed", left: b.x, top: b.y }}>
          {b.particles.map((p) => (
            <span
              key={p.id}
              className="taskConfettiParticle"
              style={{
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--rot": `${p.rot}deg`,
                "--c": p.c,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return createPortal(node, document.body);
}

function makeConfettiBurst(x, y) {
  const colors = ["#7A1F80", "#CA3673", "#ffffff", "#f5a5c7"];
  const count = 18;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (Math.random() * 0.28 - 0.14);
    const sp = 90 + Math.random() * 120;
    const dx = Math.cos(a) * sp;
    const dy = Math.sin(a) * sp - (60 + Math.random() * 40);
    parts.push({
      id: `${i}_${Math.random().toString(16).slice(2)}`,
      dx: Math.round(dx),
      dy: Math.round(dy),
      rot: Math.round(Math.random() * 260 - 130),
      c: colors[i % colors.length],
    });
  }
  return { id: uid(), x: Math.round(x), y: Math.round(y), particles: parts };
}


export default function TasksPage({ data, setData, setConfirm, toastOk, ensureNotify }) {
  const DEFAULT_TABLE_ID = "tbl_default";
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  // Drag & drop: reorder tasks within the same table + priority + done state
  const [dragging, setDragging] = useState(null); // { id, groupKey }
  const [dropOver, setDropOver] = useState(null); // taskId
  const [dropPos, setDropPos] = useState("middle"); // top | bottom | middle
  const draggingRef = useRef(null);
  const dropOverRef = useRef(null);
  const dropPosRef = useRef("middle");

  // Drag & drop: reorder tables
  const [tblDragging, setTblDragging] = useState(null); // tableId
  const [tblOver, setTblOver] = useState(null); // tableId
  const [tblPos, setTblPos] = useState("middle"); // top | bottom
  const tblDraggingRef = useRef(null);
  const tblOverRef = useRef(null);
  const tblPosRef = useRef("middle");

  // Confetti on complete
  const [bursts, setBursts] = useState([]);
  const lastPointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  useEffect(() => {
    dropOverRef.current = dropOver;
  }, [dropOver]);
  useEffect(() => {
    dropPosRef.current = dropPos;
  }, [dropPos]);

  useEffect(() => {
    tblDraggingRef.current = tblDragging;
  }, [tblDragging]);
  useEffect(() => {
    tblOverRef.current = tblOver;
  }, [tblOver]);
  useEffect(() => {
    tblPosRef.current = tblPos;
  }, [tblPos]);

  // --------- Month header state (fixes activeMonth init error) ---------
  const sym = currencySymbol(data?.settings?.currency);
  const [viewMonth, setViewMonth] = useState(() => monthKey(new Date()));

  const months = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = -12; i <= 11; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push(monthKey(d));
    }
    return Array.from(new Set(out)).sort();
  }, []);

  const activeMonth = months.includes(viewMonth) ? viewMonth : months[months.length - 1] || monthKey(new Date());

  const monthLabel = useMemo(() => {
    const parts = String(activeMonth || "").split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }, [activeMonth]);

  const clientsById = useMemo(() => Object.fromEntries((data.clients || []).map((c) => [c.id, c])), [data.clients]);

  function ensureTables(d) {
    const existing = Array.isArray(d.taskTables) ? d.taskTables : [];
    if (existing.length > 0) return existing;
    return [{ id: DEFAULT_TABLE_ID, title: t("tasks"), color: "#CA3673", order: 0 }];
  }

  const tablesSorted = useMemo(() => {
    const base = ensureTables(data || {});
    const next = [...base].map((t, i) => ({
      id: t?.id || `${DEFAULT_TABLE_ID}_${i}`,
      title: String(t?.title || t("tasks")),
      color: String(t?.color || "#CA3673"),
      order: Number.isFinite(t?.order) ? t.order : i,
    }));
    next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // Ensure default exists and is first only if it was the only one; otherwise keep order
    if (!next.some((t) => t.id === DEFAULT_TABLE_ID)) next.unshift({ id: DEFAULT_TABLE_ID, title: t("tasks"), color: "#CA3673", order: -999 });
    return next.map((t, i) => ({ ...t, order: i }));
  }, [data]);

  function tableIdOfTask(t) {
    return t?.tableId || DEFAULT_TABLE_ID;
  }

  const allTasksSorted = useMemo(() => {
    let items = [...(data.tasks || [])];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((t) => {
        const cn = t.clientId ? (clientsById[t.clientId]?.name || "") : "";
        return (t.title || "").toLowerCase().includes(q) || cn.toLowerCase().includes(q) || (t.priority || "").toLowerCase().includes(q);
      });
    }

    const pr = (p) => (p === "High" ? 0 : p === "Medium" ? 1 : p === "Low" ? 2 : 3);
    items.sort((a, b) => {
      // Table order first
      const ta = tablesSorted.find((x) => x.id === tableIdOfTask(a))?.order ?? 9999;
      const tb = tablesSorted.find((x) => x.id === tableIdOfTask(b))?.order ?? 9999;
      if (ta !== tb) return ta - tb;

      // Open first, then higher priority, then custom order
      const d1 = Number(!!a.done) - Number(!!b.done);
      if (d1 !== 0) return d1;

      const p1 = pr(a.priority || "Medium") - pr(b.priority || "Medium");
      if (p1 !== 0) return p1;

      const oa = Number.isFinite(a.prioOrder) ? a.prioOrder : Number.POSITIVE_INFINITY;
      const ob = Number.isFinite(b.prioOrder) ? b.prioOrder : Number.POSITIVE_INFINITY;
      if (oa !== ob) return oa - ob;

      const da = parseISO(a.due || "");
      const db = parseISO(b.due || "");
      const tsa = da ? da.getTime() : Number.POSITIVE_INFINITY;
      const tsb = db ? db.getTime() : Number.POSITIVE_INFINITY;
      if (tsa !== tsb) return tsa - tsb;

      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return items;
  }, [data.tasks, search, clientsById, tablesSorted]);

  function groupKeyForTask(t) {
    return `${tableIdOfTask(t)}|${t?.done ? "1" : "0"}|${t?.priority || "Medium"}`;
  }

  function reorderWithinGroup(draftData, dragId, overId, pos) {
    const tasks = [...(draftData.tasks || [])];
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const dragT = byId.get(dragId);
    const overT = byId.get(overId);
    if (!dragT || !overT) return draftData;

    const gk = groupKeyForTask(dragT);
    if (gk !== groupKeyForTask(overT)) return draftData;

    const pr = (p) => (p === "High" ? 0 : p === "Medium" ? 1 : p === "Low" ? 2 : 3);
    const sorted = [...tasks].sort((a, b) => {
      const ta = tablesSorted.find((x) => x.id === tableIdOfTask(a))?.order ?? 9999;
      const tb = tablesSorted.find((x) => x.id === tableIdOfTask(b))?.order ?? 9999;
      if (ta !== tb) return ta - tb;

      const d1 = Number(!!a.done) - Number(!!b.done);
      if (d1 !== 0) return d1;
      const p1 = pr(a.priority || "Medium") - pr(b.priority || "Medium");
      if (p1 !== 0) return p1;
      const oa = Number.isFinite(a.prioOrder) ? a.prioOrder : Number.POSITIVE_INFINITY;
      const ob = Number.isFinite(b.prioOrder) ? b.prioOrder : Number.POSITIVE_INFINITY;
      if (oa !== ob) return oa - ob;
      const da = parseISO(a.due || "");
      const db = parseISO(b.due || "");
      const tsa = da ? da.getTime() : Number.POSITIVE_INFINITY;
      const tsb = db ? db.getTime() : Number.POSITIVE_INFINITY;
      if (tsa !== tsb) return tsa - tsb;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    const group = sorted.filter((t) => groupKeyForTask(t) === gk);
    const ids = group.map((t) => t.id);
    const from = ids.indexOf(dragId);
    const toRaw = ids.indexOf(overId);
    if (from < 0 || toRaw < 0 || from === toRaw) return draftData;

    ids.splice(from, 1);
    const to = toRaw > from ? toRaw - 1 : toRaw;
    const insertAt = pos === "bottom" ? to + 1 : to;
    ids.splice(clampNum(insertAt, 0, ids.length), 0, dragId);

    const orderMap = new Map(ids.map((id, i) => [id, i]));

    const nextTasks = tasks.map((t) => {
      if (groupKeyForTask(t) !== gk) return t;
      const nextOrder = orderMap.get(t.id);
      if (!Number.isFinite(nextOrder)) return t;
      return { ...t, prioOrder: nextOrder, updatedAt: Date.now() };
    });

    return { ...draftData, tasks: nextTasks };
  }

  function beginReorderDrag(e, task) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging({ id: task.id, groupKey: groupKeyForTask(task) });
    setDropOver(null);
  }

  useEffect(() => {
    if (!dragging) return;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest?.('[data-task-row="1"]');
      const dr = draggingRef.current;
      if (!dr || !row) {
        setDropOver(null);
        setDropPos("middle");
        return;
      }

      const overId = row.getAttribute("data-task-id") || "";
      const overGroup = row.getAttribute("data-group-key") || "";
      if (overGroup === dr.groupKey && overId && overId !== dr.id) {
        const r = row.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        setDropPos(e.clientY < mid ? "top" : "bottom");
        setDropOver(overId);
      } else {
        setDropOver(null);
        setDropPos("middle");
      }
    };

    const onUp = () => {
      const dr = draggingRef.current;
      const over = dropOverRef.current;
      const pos = dropPosRef.current;
      if (dr && over) setData((d) => reorderWithinGroup(d, dr.id, over, pos));
      setDragging(null);
      setDropOver(null);
      setDropPos("middle");
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [dragging, setData, tablesSorted]);

  function beginTableDrag(e, tableId) {
    if (e.button !== 0) return;
    e.preventDefault();
    setTblDragging(tableId);
    setTblOver(null);
    setTblPos("middle");
  }

  function reorderTables(draftData, dragId, overId, pos) {
    const current = ensureTables(draftData);
    const sorted = [...current].map((t, i) => ({
      id: t?.id || `${DEFAULT_TABLE_ID}_${i}`,
      title: String(t?.title || t("tasks")),
      color: String(t?.color || "#CA3673"),
      order: Number.isFinite(t?.order) ? t.order : i,
    })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const ids = sorted.map((t) => t.id);
    const from = ids.indexOf(dragId);
    const toRaw = ids.indexOf(overId);
    if (from < 0 || toRaw < 0 || from === toRaw) return draftData;

    ids.splice(from, 1);
    const to = toRaw > from ? toRaw - 1 : toRaw;
    const insertAt = pos === "bottom" ? to + 1 : to;
    ids.splice(clampNum(insertAt, 0, ids.length), 0, dragId);

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    const nextTables = sorted.map((t) => ({ ...t, order: orderMap.get(t.id) ?? 0 }));

    return { ...draftData, taskTables: nextTables };
  }

  useEffect(() => {
    if (!tblDragging) return;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const shell = el?.closest?.('[data-task-table="1"]');
      const dr = tblDraggingRef.current;
      if (!dr || !shell) {
        setTblOver(null);
        setTblPos("middle");
        return;
      }

      const overId = shell.getAttribute("data-table-id") || "";
      if (overId && overId !== dr) {
        const r = shell.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        setTblPos(e.clientY < mid ? "top" : "bottom");
        setTblOver(overId);
      } else {
        setTblOver(null);
        setTblPos("middle");
      }
    };

    const onUp = () => {
      const dr = tblDraggingRef.current;
      const over = tblOverRef.current;
      const pos = tblPosRef.current;
      if (dr && over) setData((d) => reorderTables(d, dr, over, pos));
      setTblDragging(null);
      setTblOver(null);
      setTblPos("middle");
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [tblDragging, setData]);

  function updateTask(id, patch) {
    setData((d) => ({
      ...d,
      tasks: (d.tasks || []).map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
    }));
  }

  function deleteTask(id) {
    setConfirm({
      title: "Delete task",
      message: "This removes the task permanently.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => ({ ...d, tasks: (d.tasks || []).filter((t) => t.id !== id) }));
        setConfirm(null);
        toastOk("Deleted");
      },
    });
  }

  function addReminderForTask(t) {
    const ok = ensureNotify();
    if (!ok && Notification.permission !== "granted") return;

    const whenISO = t.due || todayISO();
    const d = parseISO(whenISO) || new Date();
    d.setHours(9, 0, 0, 0);
    const whenTs = d.getTime();

    const rid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    setData((dd) => ({
      ...dd,
      reminders: [{ id: rid, type: t("task"), refId: t.id, title: t.title || t("task"), whenTs, firedAt: null }, ...(dd.reminders || [])],
    }));
    toastOk("Reminder set");
  }

  function addTable() {
    setData((d) => {
      const current = ensureTables(d);
      const maxOrder = Math.max(-1, ...current.map((t) => (Number.isFinite(t?.order) ? t.order : 0)));
      const id = uid();
      const next = [...current, { id, title: "New list", color: "#7A1F80", order: maxOrder + 1 }];
      return { ...d, taskTables: next };
    });
    toastOk("List added");
  }

  function updateTable(id, patch) {
    setData((d) => {
      const current = ensureTables(d);
      const next = current.map((t) => (t.id === id ? { ...t, ...patch } : t));
      return { ...d, taskTables: next };
    });
  }

  function duplicateTable(id) {
    setData((d) => {
      const current = ensureTables(d);
      const src = current.find((t) => t.id === id);
      if (!src) return d;

      const maxOrder = Math.max(-1, ...current.map((t) => (Number.isFinite(t?.order) ? t.order : 0)));
      const newId = uid();
      const nextTables = [...current, { ...src, id: newId, title: `${src.title || "List"} copy`, order: maxOrder + 1 }];

      const srcTasks = (d.tasks || []).filter((t) => tableIdOfTask(t) === id);
      const copiedTasks = srcTasks.map((t) => ({ ...t, id: uid(), tableId: newId, updatedAt: Date.now() }));

      return { ...d, taskTables: nextTables, tasks: [...(d.tasks || []), ...copiedTasks] };
    });
    toastOk("List duplicated");
  }

  function deleteTable(id) {
    if (id === DEFAULT_TABLE_ID) return;

    setConfirm({
      title: "Delete list",
      message: "The list will be removed. Tasks inside it will be moved to Tasks.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => {
          const current = ensureTables(d).filter((t) => t.id !== id);
          const nextTasks = (d.tasks || []).map((t) => {
            if (tableIdOfTask(t) !== id) return t;
            return { ...t, tableId: DEFAULT_TABLE_ID, updatedAt: Date.now() };
          });
          return { ...d, taskTables: current, tasks: nextTasks };
        });
        setConfirm(null);
        toastOk("List deleted");
      },
    });
  }

  function addTaskToTable(tableId) {
    setData((d) => {
      const tasks = [...(d.tasks || [])];
      const newTask = {
        id: uid(),
        title: "",
        priority: "Medium",
        due: "",
        clientId: "",
        done: false,
        tableId,
        prioOrder: Number.POSITIVE_INFINITY,
        updatedAt: Date.now(),
      };

      // Place at bottom of open/Medium for that table
      const group = tasks.filter((t) => tableIdOfTask(t) === tableId && !t.done && (t.priority || "Medium") === "Medium");
      const max = Math.max(-1, ...group.map((t) => (Number.isFinite(t.prioOrder) ? t.prioOrder : -1)));
      newTask.prioOrder = max + 1;

      return { ...d, tasks: [newTask, ...tasks] };
    });
    toastOk("Task added");
  }

  function dueBadge(iso) {
    const d = parseISO(iso || "");
    if (!d) return { text: "", color: "var(--muted)" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dd.setHours(0, 0, 0, 0);
    const diff = Math.round((dd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return { text: "Due today", color: "#f59e0b" };
    if (diff < 0) return { text: `Overdue ${Math.abs(diff)}d`, color: "#ef4444" };
    if (diff === 1) return { text: "In 1d", color: "rgba(255,255,255,0.65)" };
    return { text: `In ${diff}d`, color: "rgba(255,255,255,0.65)" };
  }

  function TableColorControl({ value, onChange }) {
    const btnRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(String(value || "#CA3673"));

    useEffect(() => setDraft(String(value || "#CA3673")), [value]);

    const presets = ["#7A1F80", "#CA3673", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a1a1aa", "#ffffff"];

    const normalized = (() => {
      const x = String(draft || "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(x)) return x;
      return String(value || "#CA3673");
    })();

    return (
      <>
        <button
          ref={btnRef}
          type="button"
          className="iconBtn"
          title="Change color"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            background: hexToRgba(normalized, 0.18),
            border: `1px solid ${hexToRgba(normalized, 0.35)}`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 6, background: normalized, boxShadow: "0 0 0 3px rgba(0,0,0,0.12)" }} />
        </button>

        <Popover
          open={open}
          anchorRef={btnRef}
          onClose={() => setOpen(false)}
          // Color picker: keep fully visible, with comfortable space from the right edge, and no always-visible scrollbar.
          width={320}
          maxHeight={320}
          overflow="hidden"
          align="right"
          gutter={18}
        >
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Pick a color</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 10 }}>
              {presets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange?.(c);
                    setOpen(false);
                  }}
                  title={c}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 10,
                    border: `1px solid ${hexToRgba(c, 0.4)}`,
                    background: c,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="#CA3673"
                style={{ flex: 1 }}
              />
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  const x = String(draft || "").trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(x)) {
                    onChange?.(x);
                    setOpen(false);
                  }
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </Popover>
      </>
    );
  }

  return (
    <>
      <ConfettiLayer bursts={bursts} />

      <style>{`
        .rowBody { position: relative; }
        .taskDragGhost { opacity: 0.28; }
        .taskDropLineTop::before,
        .taskDropLineBottom::after {
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
        .taskDropLineTop::before { top: -1px; }
        .taskDropLineBottom::after { bottom: -1px; }

        .taskDoneRow { opacity: 0.60; }
        .taskDoneRow .taskTitleWrap { text-decoration: line-through; }

        .taskConfettiBurst { width: 0; height: 0; }
        .taskConfettiParticle {
          display: block;
          position: absolute;
          left: 0px;
          top: 0px;
          width: 8px;
          height: 8px;
          border-radius: 3px;
          background: var(--c);
          transform: translate(0,0) rotate(0deg);
          animation: taskConfettiPop 900ms cubic-bezier(0.12, 0.74, 0.24, 1) forwards;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
        }
        @keyframes taskConfettiPop {
          0% { transform: translate(0px,0px) rotate(0deg); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }

        .taskTableShell { position: relative; }
        .taskTableGhost { opacity: 0.35; }
        .taskTableDropTop::before,
        .taskTableDropBottom::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(201,53,114,0.90);
          box-shadow: 0 0 0 1px rgba(201,53,114,0.35), 0 0 18px rgba(201,53,114,0.22);
          border-radius: 999px;
          pointer-events: none;
          z-index: 40;
        }
        .taskTableDropTop::before { top: -6px; }
        .taskTableDropBottom::after { bottom: -6px; }
      `}</style>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 260 }}
          placeholder={t("searchTasks")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{(data.tasks || []).filter((t) => !t.done).length} open</div>
          <button className="btn btnPrimary" onClick={addTable} title="Add a new list">
            + {t("addList")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tablesSorted.map((tbl) => {
          const tblTasks = allTasksSorted.filter((t) => tableIdOfTask(t) === tbl.id);
          const openCount = tblTasks.filter((t) => !t.done).length;
          const isTblDragging = tblDragging === tbl.id;
          const isTblOver = tblOver === tbl.id && tblDragging !== tbl.id;

          const shellClass =
            "card taskTableShell" +
            (isTblDragging ? " taskTableGhost" : "") +
            (isTblOver && tblPos === "top" ? " taskTableDropTop" : "") +
            (isTblOver && tblPos === "bottom" ? " taskTableDropBottom" : "");

          return (
            <div
              key={tbl.id}
              className={shellClass}
              data-task-table="1"
              data-table-id={tbl.id}
              style={{
                padding: 12,
                border: `1px solid ${hexToRgba(tbl.color, 0.28)}`,
                background: `linear-gradient(180deg, ${hexToRgba(tbl.color, 0.10)} 0%, rgba(0,0,0,0) 60%)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 260 }}>
                  <button
                    className="iconBtn"
                    type="button"
                    title="Drag to reorder lists"
                    aria-label="Drag list"
                    onPointerDown={(e) => beginTableDrag(e, tbl.id)}
                    style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", cursor: isTblDragging ? "grabbing" : "grab" }}
                  >
                    ⠿
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: tbl.color, flex: "0 0 auto" }} />
                      <div style={{ minWidth: 0 }}>
                        <InlineEdit
                          value={tbl.title}
                          placeholder="List name"
                          onCommit={(v) => updateTable(tbl.id, { title: (v || "").trim() || "Untitled list" })}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--muted)", flex: "0 0 auto" }}>{openCount} open</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TableColorControl value={tbl.color} onChange={(c) => updateTable(tbl.id, { color: c })} />

                  <button className="iconBtn" type="button" title="Duplicate list" onClick={() => duplicateTable(tbl.id)}>
                    ⧉
                  </button>

                  <button
                    className="iconBtn iconBtnDanger"
                    type="button"
                    title={tbl.id === DEFAULT_TABLE_ID ? "Default list can't be deleted" : "Delete list"}
                    disabled={tbl.id === DEFAULT_TABLE_ID}
                    onClick={() => deleteTable(tbl.id)}
                    style={tbl.id === DEFAULT_TABLE_ID ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                  >
                    ✕
                  </button>

                  <button className="btn btnPrimary" type="button" onClick={() => addTaskToTable(tbl.id)} title="Add task to this list">
                    + Task
                  </button>
                </div>
              </div>

              <div className="tableShell" style={{ marginTop: 10 }}>
                <div className="tableScroll">
                  <div className="tableInner" style={{ minWidth: 980 }}>
                    <div className="tableHeader">
                      <div
                        className="row"
                        style={{
                          gridTemplateColumns: "72px 1.4fr 180px 260px 260px 200px",
                          color: "var(--muted)",
                          fontSize: 12,
                          alignItems: "center",
                        }}
                      >
                        <div></div>
                        <div>{t("task")}</div>
                        <div>{t("priority")}</div>
                        <div>{t("dueDate")}</div>
                        <div>{t("client")}</div>
                        <div>{t("actions")}</div>
                      </div>
                    </div>

                    {tblTasks.map((t) => {
                      const isDragging = dragging?.id === t.id;
                      const isOver = dropOver === t.id && dragging?.id !== t.id;
                      const rowClass =
                        "row rowBody" +
                        (t.done ? " taskDoneRow" : "") +
                        (isDragging ? " taskDragGhost" : "") +
                        (isOver && dropPos === "top" ? " taskDropLineTop" : "") +
                        (isOver && dropPos === "bottom" ? " taskDropLineBottom" : "");

                      const badge = dueBadge(t.due);

                      return (
                        <div
                          key={t.id}
                          className={rowClass}
                          data-task-row="1"
                          data-task-id={t.id}
                          data-group-key={groupKeyForTask(t)}
                          style={{
                            gridTemplateColumns: "72px 1.4fr 180px 260px 260px 200px",
                            alignItems: "center",
                          }}
                        >
                          <div className="cell">
                            <div
                              style={{ display: "flex", alignItems: "center", gap: 8 }}
                              onPointerDown={(e) => {
                                lastPointerRef.current = { x: e.clientX, y: e.clientY };
                              }}
                            >
                              <button
                                className="iconBtn dragHandleBtn"
                                type="button"
                                title="Drag to reorder within this priority"
                                aria-label="Drag"
                                onPointerDown={(e) => beginReorderDrag(e, t)}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 12,
                                  display: "grid",
                                  placeItems: "center",
                                  cursor: isDragging ? "grabbing" : "grab",
                                  userSelect: "none",
                                }}
                              >
                                ⠿
                              </button>
                              <Checkbox
                                checked={!!t.done}
                                onChange={(v) => {
                                  if (v && !t.done) {
                                    const b = makeConfettiBurst(lastPointerRef.current.x, lastPointerRef.current.y);
                                    setBursts((s) => [b, ...s].slice(0, 6));
                                    window.setTimeout(() => setBursts((s) => s.filter((x) => x.id !== b.id)), 900);
                                  }
                                  updateTask(t.id, { done: v });
                                }}
                              />
                            </div>
                          </div>

                          <div className="cell" style={{ minWidth: 0 }}>
                            <div className="taskTitleWrap">
                              <InlineEdit
                                value={t.title || ""}
                                placeholder="Task…"
                                onCommit={(v) => updateTask(t.id, { title: (v || "").trim() || "Untitled task" })}
                              />
                            </div>
                          </div>

                          <div className="cell">
                            <PrioritySelect value={t.priority || "Medium"} onChange={(v) => updateTask(t.id, { priority: v })} width={160} />
                          </div>

                          <div className="cell" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <DatePicker valueISO={t.due || ""} onChange={(iso) => updateTask(t.id, { due: iso })} placeholder="Due date" />
                            {badge.text ? (
                              <span style={{ fontSize: 12, color: badge.color, fontWeight: 700, whiteSpace: "nowrap" }}>{badge.text}</span>
                            ) : null}
                          </div>

                          <div className="cell">
                            <ClientPickerSearch
                              clients={(data.clients || []).filter((c) => c.status !== "archived")}
                              clientId={t.clientId || ""}
                              onChange={(v) => updateTask(t.id, { clientId: v })}
                              placeholder="No Client"
                              width={220}
                            />
                          </div>

                          <div className="cell" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button className="iconBtn" onClick={() => addReminderForTask(t)} title="Add reminder">
                              <IconBell />
                            </button>
                            <button className="iconBtn iconBtnDanger" onClick={() => deleteTask(t.id)} title="Delete">
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {tblTasks.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>No tasks in this list</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}