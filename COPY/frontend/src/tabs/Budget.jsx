import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  InlineEdit,
  clamp,
  currencySymbol,
  downloadBudgetBackupExcel,
  monthKey,
  parseISO,
  todayISO,
} from "../shared/crmShared.jsx";

function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return "id_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthLabel(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return "";
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function monthStartISO(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return todayISO();
  return `${y}-${pad2(m)}-01`;
}

function monthlyEquivalent(item, activeMonthKey) {
  const amount = Number(item?.amount) || 0;
  const r = item?.recurring || { mode: "One-off", everyDays: 0 };
  const mode = r.mode || "One-off";

  if (mode === "Monthly") return amount;
  if (mode === "Yearly") return amount / 12;
  if (mode === "Weekly") return amount * 4;
  if (mode === "CustomDays") {
    const days = Number(r.everyDays) || 0;
    if (days <= 0) return 0;
    return amount * (30 / days);
  }

  // One-off: count only if it's in the selected month
  const d = parseISO(item?.date) || null;
  if (!d) return 0;
  return monthKey(d) === activeMonthKey ? amount : 0;
}


function DatePicker({ valueISO, onChange, placeholder, width = "100%" }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);

  useOutsideClose(open, [btnRef, popRef], () => setOpen(false));
  const { pos, maxHeight } = usePopoverPosition(open, btnRef, popRef, {
    minWidth: 280,
    estimateHeight: 360,
    maxHeight: 380,
  });

  const selected = useMemo(() => {
    const d = parseISO(valueISO || "");
    return d || null;
  }, [valueISO]);

  const [viewYear, setViewYear] = useState(() => (selected ? selected.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (selected ? selected.getMonth() + 1 : new Date().getMonth() + 1));

  useEffect(() => {
    if (!open) return;
    const d = parseISO(valueISO || "");
    const base = d || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth() + 1);
  }, [open, valueISO]);

  const years = useMemo(() => {
    const base = Number(viewYear) || new Date().getFullYear();
    const start = base - 10;
    const end = base + 10;
    const arr = [];
    for (let y = end; y >= start; y--) arr.push(y);
    return arr;
  }, [viewYear]);

  const y = Number(viewYear) || new Date().getFullYear();
  const m = Number(viewMonth) || new Date().getMonth() + 1;

  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const selectedIso = valueISO || "";

  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < 42; i++) {
      const day = i - startDow + 1;
      out.push(day >= 1 && day <= daysInMonth ? day : null)
    }
    return out;
  }, [startDow, daysInMonth]);

  const displayText = valueISO || "";
  const shown = displayText ? displayText : (placeholder || "Pick date");

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="input"
        onClick={() => setOpen((v) => !v)}
        style={{
          width,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          paddingRight: 12,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ color: displayText ? "var(--text)" : "var(--muted)", fontSize: 13, fontWeight: 500 }}>
          {shown}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: 0.85, flex: "0 0 auto" }}>
          <path d="M7 3v2M17 3v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover crmPopover"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              padding: 12,
              maxHeight,
              overflow: "auto",
              position: "absolute",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <PopSelect
                value={m}
                options={[1,2,3,4,5,6,7,8,9,10,11,12]}
                getLabel={(mm) => MONTH_NAMES[Number(mm) - 1]}
                onChange={(mm) => setViewMonth(Number(mm))}
                minWidth={160}
              />
              <PopSelect
                value={y}
                options={years}
                getLabel={(yy) => String(yy)}
                onChange={(yy) => setViewYear(Number(yy))}
                minWidth={110}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} style={{ textAlign: "center" }}>{d[0]}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 8 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const iso = `${y}-${pad2(m)}-${pad2(day)}`;
                const sel = iso === selectedIso;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="btn"
                    onClick={() => {
                      onChange?.(iso);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "10px 0",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      background: sel ? "rgba(202,54,115,0.18)" : "rgba(255,255,255,0.04)",
                      borderColor: sel ? "rgba(202,54,115,0.55)" : "var(--stroke)",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function useOutsideClose(open, refs, onClose) {
  useEffect(() => {
    if (!open) return;

    function onDown(e) {
      const t = e.target;
      for (const r of refs) {
        const el = r?.current;
        if (el && el.contains(t)) return;
      }
      onClose?.();
    }

    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }

    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("touchstart", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("touchstart", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, refs, onClose]);
}

function clampToViewport(pos) {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.min(Math.max(pad, pos.x), vw - pos.w - pad);
  const y = Math.min(Math.max(pad, pos.y), vh - pos.h - pad);
  return { ...pos, x, y };
}

function usePopoverPosition(open, anchorRef, popRef, { minWidth = 200, maxHeight = 360, gap = 8, estimateHeight = 220 } = {}) {
  const [pos, setPos] = useState({ x: 0, y: 0, w: minWidth, h: estimateHeight });

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(minWidth, r.width);

      // Measure actual popover height so it sits attached to the button.
      const popEl = popRef?.current;
      const measuredH = popEl ? popEl.getBoundingClientRect().height : 0;
      const h = Math.max(80, Math.min(estimateHeight, measuredH || estimateHeight));

      const belowY = r.bottom + gap;
      const aboveY = r.top - gap - h;
      const openUp = belowY + h > window.innerHeight && aboveY >= 8;
      const y = (openUp ? aboveY : belowY) + window.scrollY;
      const x = r.left + window.scrollX;

      const next = clampToViewport({ x, y, w, h });
      setPos(next);
    }

    // First place, then place again on the next frame after the portal measures.
    place();
    const raf = requestAnimationFrame(place);

    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, popRef, minWidth, gap, estimateHeight]);

  return { pos, maxHeight };
}

function PopSelect({ value, options, getLabel, onChange, minWidth = 180 }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { pos, maxHeight } = usePopoverPosition(open, btnRef, popRef, {
    minWidth,
    estimateHeight: Math.min(340, 12 + options.length * 44),
  });

  useOutsideClose(open, [btnRef, popRef], () => setOpen(false));

  return (
    <>
      <button
        ref={btnRef}
        className="crmSelectBtn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          border: "1px solid var(--stroke)",
          background: "rgba(255,255,255,0.05)",
          color: "var(--text)",
          borderRadius: 14,
          padding: "10px 12px",
          fontSize: 13,
        }}
      >
        <span className="crmSelectText" style={{ fontWeight: 500 }}>
          {getLabel(value)}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover crmPopover"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              padding: 10,
              maxHeight,
              overflow: "auto",
              position: "absolute",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {options.map((opt) => {
                const sel = opt === value;
                return (
                  <button
                    key={String(opt)}
                    type="button"
                    className="btn"
                    onClick={() => {
                      onChange?.(opt);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      borderColor: sel ? "rgba(202,54,115,0.55)" : "var(--stroke)",
                      background: sel ? "rgba(202,54,115,0.14)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{getLabel(opt)}</span>
                    <span style={{ opacity: sel ? 0.9 : 0.2 }}>*</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function PillSelect({ value, options, onChange }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { pos, maxHeight } = usePopoverPosition(open, btnRef, popRef, {
    minWidth: 160,
    estimateHeight: Math.min(260, 14 + options.length * 46),
  });

  useOutsideClose(open, [btnRef, popRef], () => setOpen(false));

  const current = options.find((o) => o.value === value) || options[0] || { value: value || "" };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          justifyContent: "space-between",
          borderRadius: 999,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.04)",
          fontSize: 13,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: current.color || "rgba(255,255,255,0.45)",
              boxShadow: current.color ? `0 0 12px ${current.color}55` : "none",
              flex: "0 0 auto",
            }}
          />
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{current.value}</span>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover crmPopover"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              padding: 10,
              maxHeight,
              overflow: "auto",
              position: "absolute",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {options.map((opt) => {
                const sel = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="btn"
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      borderColor: sel ? `${opt.color}77` : "var(--stroke)",
                      background: sel ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: opt.color,
                          boxShadow: `0 0 12px ${opt.color}55`,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{opt.value}</span>
                    </span>
                    <span style={{ opacity: sel ? 0.9 : 0.15 }}>*</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function RecurringSelect({ valueMode, everyDays, onChange }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [daysDraft, setDaysDraft] = useState(String(everyDays || ""));

  useEffect(() => {
    setDaysDraft(String(everyDays || ""));
  }, [everyDays]);

  const modes = ["One-off", "Weekly", "Monthly", "Yearly", "CustomDays"];
  const { pos, maxHeight } = usePopoverPosition(open, btnRef, popRef, {
    minWidth: 210,
    estimateHeight: 320,
  });

  useOutsideClose(open, [btnRef, popRef], () => setOpen(false));

  const label = valueMode === "CustomDays" ? `Every ${Number(everyDays) || 0} days` : valueMode || "One-off";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          justifyContent: "space-between",
          borderRadius: 999,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.04)",
          fontSize: 13,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover crmPopover"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              padding: 10,
              maxHeight,
              overflow: "auto",
              position: "absolute",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {modes.map((m) => {
                const sel = (valueMode || "One-off") === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (m !== "CustomDays") {
                        onChange?.(m, 0);
                        setOpen(false);
                      } else {
                        onChange?.("CustomDays", Number(everyDays) || 0);
                      }
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      borderColor: sel ? "rgba(202,54,115,0.55)" : "var(--stroke)",
                      background: sel ? "rgba(202,54,115,0.14)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{m === "CustomDays" ? "Custom (days)" : m}</span>
                    <span style={{ opacity: sel ? 0.9 : 0.15 }}>*</span>
                  </button>
                );
              })}

              {(valueMode || "One-off") === "CustomDays" && (
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    value={daysDraft}
                    onChange={(e) => setDaysDraft(e.target.value)}
                    placeholder="Days"
                    style={{ width: 90 }}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => {
                      const n = Number(daysDraft);
                      if (!Number.isFinite(n) || n <= 0) return;
                      onChange?.("CustomDays", Math.round(n));
                      setOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function StepperInput({ value, onChange, step = 1, placeholder }) {
  const str = value == null ? "" : String(value);

  function parseOr(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function bump(dir) {
    const base = parseOr(str, 0);
    const next = base + dir * step;
    const out = step < 1 ? next.toFixed(2) : String(Math.round(next));
    onChange?.(out);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        className="input"
        inputMode="decimal"
        value={str}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", paddingRight: 40 }}
      />

      <div
        style={{
          position: "absolute",
          right: 6,
          top: 6,
          bottom: 6,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        <button
          type="button"
          className="iconBtn"
          title="Increase"
          onClick={() => bump(+1)}
          style={{ width: 26, height: 18, borderRadius: 10, display: "grid", placeItems: "center" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="iconBtn"
          title="Decrease"
          onClick={() => bump(-1)}
          style={{ width: 26, height: 18, borderRadius: 10, display: "grid", placeItems: "center" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DownloadIconCircle() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v3h16v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Modal({ title, children, onClose, wide = true }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="modalOverlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 60,
      }}
    >
      <div
        className="modalCard"
        style={{
          width: "100%",
          maxWidth: wide ? 860 : 560,
          borderRadius: 18,
          border: "1px solid var(--stroke)",
          background: "rgba(10,10,14,0.92)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 14px",
            borderBottom: "1px solid var(--stroke)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button className="iconBtn" type="button" onClick={onClose} title="Close">
            x
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

function buildYearRangeFromData(rows, nowYear) {
  let minY = nowYear;
  let maxY = nowYear;

  for (const r of rows) {
    if (!r?.date) continue;
    const d = parseISO(r.date);
    if (!d) continue;
    const y = d.getFullYear();
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const start = minY - 10;
  const end = maxY + 10;
  const out = [];
  for (let y = end; y >= start; y--) out.push(y);
  return out;
}

export default function BudgetPage({ data, setData, setConfirm, toastOk }) {
  const sym = currencySymbol(data?.settings?.currency);
  const allRows = data?.budget || [];

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;

  const yearOptions = useMemo(() => buildYearRangeFromData(allRows, nowYear), [allRows, nowYear]);

  const [viewYear, setViewYear] = useState(() => nowYear);
  const [viewMonthNum, setViewMonthNum] = useState(() => nowMonth);

  useEffect(() => {
    if (!yearOptions.includes(viewYear)) setViewYear(nowYear);
  }, [yearOptions, viewYear, nowYear]);

  const activeMonthKey = `${viewYear}-${pad2(viewMonthNum)}`;
  const activeMonthLabel = monthLabel(viewYear, viewMonthNum);

  const neonGreen = "#22ff8a";
  const neonRed = "#ff2d55";

  const visibleRows = useMemo(() => {
    return allRows.filter((r) => {
      const mode = r?.recurring?.mode || "One-off";
      if (mode && mode !== "One-off") return true;
      if (!r?.date) return false;
      const d = parseISO(r.date);
      if (!d) return false;
      return monthKey(d) === activeMonthKey;
    });
  }, [allRows, activeMonthKey]);

  const monthly = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of allRows) {
      const m = monthlyEquivalent(r, activeMonthKey);
      if (m === 0) continue;
      if ((r.type || "Outgoing") === "Incoming") income += m;
      else expense += m;
    }
    return { income, expense, net: income - expense };
  }, [allRows, activeMonthKey]);

  const chart = useMemo(() => {
    const income = Math.abs(monthly.income);
    const expense = Math.abs(monthly.expense);
    const max = Math.max(1, income, expense);
    return {
      incomePct: clamp((income / max) * 100, 0, 100),
      expensePct: clamp((expense / max) * 100, 0, 100),
    };
  }, [monthly]);

  function updateBudget(id, patch) {
    setData((d) => ({
      ...d,
      budget: (d.budget || []).map((b) => (b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b)),
    }));
  }

  function deleteBudget(id) {
    setConfirm({
      title: "Delete entry",
      message: "This removes the entry permanently.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => ({ ...d, budget: (d.budget || []).filter((b) => b.id !== id) }));
        setConfirm(null);
        toastOk("Deleted");
      },
    });
  }

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    type: "Outgoing",
    desc: "",
    category: "",
    amountText: "",
    recurring: { mode: "One-off", everyDays: 0 },
    date: viewYear === nowYear && viewMonthNum === nowMonth ? todayISO() : monthStartISO(viewYear, viewMonthNum),
  }));

  useEffect(() => {
    if (!addOpen) return;
    setDraft({
      type: "Outgoing",
      desc: "",
      category: "",
      amountText: "",
      recurring: { mode: "One-off", everyDays: 0 },
      date: viewYear === nowYear && viewMonthNum === nowMonth ? todayISO() : monthStartISO(viewYear, viewMonthNum),
    });
  }, [addOpen, viewYear, viewMonthNum, nowYear, nowMonth]);

  function addEntry() {
    const amount = Number(draft.amountText);
    if (!Number.isFinite(amount)) return toastOk("Enter a valid amount");

    const entry = {
      id: uid(),
      type: draft.type || "Outgoing",
      desc: (draft.desc || "").trim(),
      category: (draft.category || "").trim(),
      amount,
      recurring: {
        mode: draft.recurring?.mode || "One-off",
        everyDays: (draft.recurring?.mode || "One-off") === "CustomDays" ? Number(draft.recurring?.everyDays || 0) : 0,
      },
      date: draft.date || todayISO(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setData((d) => ({ ...d, budget: [entry, ...(d.budget || [])] }));
    setAddOpen(false);
    toastOk("Entry added");
  }

  function downloadYearExcel() {
    const year = viewYear;
    const exportRows = allRows.filter((r) => {
      const mode = r?.recurring?.mode || "One-off";
      if (mode && mode !== "One-off") return true;
      const d = parseISO(r?.date);
      return !!d && d.getFullYear() === Number(year);
    });

    downloadBudgetBackupExcel({ settings: data?.settings || {}, budget: exportRows }, sym);
  }

  function onToday() {
    setViewYear(nowYear);
    setViewMonthNum(nowMonth);
  }

  const typeOptions = useMemo(
    () => [
      { value: "Incoming", color: neonGreen },
      { value: "Outgoing", color: neonRed },
    ],
    [neonGreen, neonRed]
  );

  return (
    <>
      <style>{`
        .budgetPage input[type=number]::-webkit-outer-spin-button,
        .budgetPage input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .budgetPage input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="budgetPage">
        {/* Header */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Budget history</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{activeMonthLabel}</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <PopSelect value={viewMonthNum} options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} getLabel={(mm) => MONTH_NAMES[Number(mm) - 1]} onChange={(mm) => setViewMonthNum(Number(mm))} minWidth={180} />

              <PopSelect value={viewYear} options={yearOptions} getLabel={(yy) => String(yy)} onChange={(yy) => setViewYear(Number(yy))} minWidth={140} />

              <button className="btn" onClick={onToday} title="Jump to the current month">
                Today
              </button>

              <button className="btn btnPrimary" onClick={() => setAddOpen(true)} title="Add a new budget entry">
                + Add entry
              </button>

              <button className="btn" onClick={downloadYearExcel} title="Download (.xlsx)" style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 500, fontSize: 13 }}>
                <DownloadIconCircle />
                <span>Download (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="cardTitle">
              <h3 style={{ fontWeight: 700 }}>Monthly income</h3>
            </div>
            <div className="bigNumber" style={{ color: neonGreen, textShadow: "0 0 26px rgba(34,255,138,0.22)" }}>
              {sym}
              {monthly.income.toFixed(2)}
            </div>
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 999,
                  border: "1px solid rgba(34,255,138,0.45)",
                  background: "rgba(255,255,255,0.04)",
                  overflow: "hidden",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.15) inset",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${chart.incomePct}%`,
                    background: "linear-gradient(90deg, rgba(34,255,138,1), rgba(34,255,138,0.70))",
                    boxShadow: "0 0 34px rgba(34,255,138,0.30)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardTitle">
              <h3 style={{ fontWeight: 700 }}>Monthly expenses</h3>
            </div>
            <div className="bigNumber" style={{ color: neonRed, textShadow: "0 0 26px rgba(255,45,85,0.22)" }}>
              {sym}
              {monthly.expense.toFixed(2)}
            </div>
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 999,
                  border: "1px solid rgba(255,45,85,0.45)",
                  background: "rgba(255,255,255,0.04)",
                  overflow: "hidden",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.15) inset",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${chart.expensePct}%`,
                    background: "linear-gradient(90deg, rgba(255,45,85,1), rgba(255,45,85,0.70))",
                    boxShadow: "0 0 34px rgba(255,45,85,0.30)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="cardTitle">
            <h3 style={{ fontWeight: 700 }}>Net Profit</h3>
          </div>
          <div
            className="bigNumber"
            style={{
              color: monthly.net < 0 ? neonRed : neonGreen,
              textShadow: monthly.net < 0 ? "0 0 26px rgba(255,45,85,0.22)" : "0 0 26px rgba(34,255,138,0.22)",
            }}
          >
            {sym}
            {monthly.net.toFixed(2)}
          </div>
        </div>

        {/* Table */}
        <div className="tableShell">
          <div className="tableScroll">
            <div className="tableInner" style={{ minWidth: 1040 }}>
              <div className="tableHeader">
                <div
                  className="row"
                  style={{
                    gridTemplateColumns: "160px 1.2fr 220px 200px 220px 220px 120px",
                    color: "var(--muted)",
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <div>Type</div>
                  <div>Description</div>
                  <div>Category</div>
                  <div>Amount</div>
                  <div>Recurring</div>
                  <div>Date</div>
                  <div>Actions</div>
                </div>
              </div>

              {visibleRows.map((r) => (
                <div key={r.id} className="row rowBody" style={{ gridTemplateColumns: "160px 1.2fr 220px 200px 220px 220px 120px", alignItems: "center" }}>
                  <div className="cell">
                    <PillSelect value={r.type || "Outgoing"} options={typeOptions} onChange={(v) => updateBudget(r.id, { type: v })} />
                  </div>

                  <div className="cell">
                    <InlineEdit value={r.desc || ""} placeholder="Description..." onCommit={(v) => updateBudget(r.id, { desc: v })} />
                  </div>

                  <div className="cell">
                    <InlineEdit value={r.category || ""} placeholder="Category" onCommit={(v) => updateBudget(r.id, { category: v })} />
                  </div>

                  <div className="cell cellCtrl">
                    <span style={{ color: "var(--muted)" }}>{sym}</span>
                    <StepperInput value={String(r.amount ?? "")} onChange={(v) => updateBudget(r.id, { amount: v })} step={1} placeholder="0.00" />
                  </div>

                  <div className="cell">
                    <RecurringSelect
                      valueMode={r.recurring?.mode || "One-off"}
                      everyDays={r.recurring?.everyDays || 0}
                      onChange={(mode, everyDays) =>
                        updateBudget(r.id, {
                          recurring: { mode, everyDays: mode === "CustomDays" ? Number(everyDays) || 0 : 0 },
                        })
                      }
                    />
                  </div>

                  <div className="cell">
                    <DatePicker valueISO={r.date || ""} onChange={(iso) => updateBudget(r.id, { date: iso })} placeholder="Pick date" width="100%" />
                  </div>

                  <div className="cell" style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="iconBtn iconBtnDanger" onClick={() => deleteBudget(r.id)} title="Delete">
                      x
                    </button>
                  </div>
                </div>
              ))}

              {visibleRows.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>No entries for this month</div>}
            </div>
          </div>
        </div>

        {addOpen && (
          <Modal title="Add entry" onClose={() => setAddOpen(false)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Type</div>
                <PillSelect value={draft.type} options={typeOptions} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date</div>
                <DatePicker valueISO={draft.date} onChange={(iso) => setDraft((d) => ({ ...d, date: iso }))} placeholder="Pick date" width="100%" />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Description</div>
                <input
                  className="input"
                  value={draft.desc}
                  onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
                  placeholder="What is this for?"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Category</div>
                <input
                  className="input"
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="e.g. Software"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Amount</div>
                <StepperInput value={draft.amountText} onChange={(v) => setDraft((d) => ({ ...d, amountText: v }))} step={1} placeholder="0.00" />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Recurring</div>
                <RecurringSelect
                  valueMode={draft.recurring?.mode || "One-off"}
                  everyDays={draft.recurring?.everyDays || 0}
                  onChange={(mode, everyDays) =>
                    setDraft((d) => ({
                      ...d,
                      recurring: { mode, everyDays: mode === "CustomDays" ? Number(everyDays) || 0 : 0 },
                    }))
                  }
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button className="btn" type="button" onClick={() => setAddOpen(false)} style={{ fontWeight: 600 }}>
                  Cancel
                </button>
                <button className="btn btnPrimary" type="button" onClick={addEntry} style={{ fontWeight: 600 }}>
                  Add entry
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
