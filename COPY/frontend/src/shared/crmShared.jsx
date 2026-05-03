import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "crm_modern_simple_v4";
const ACCOUNT_DATA_TABLE = "app_user_data";

const ENABLETABSDEFAULT = {
  clients: true,
  tasks: true,
  budget: true,
  goals: true,
  settings: true,
  notepad: true,
};


/* =========================
   Helpers
========================= */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseISO(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function formatLocalDate(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  } catch {
    return iso;
  }
}
function currencySymbol(code) {
  if (code === "GBP") return "£";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "£";
}
function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadExcelHtml(filename, html) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tableHtml(title, headers, rows) {
  const th = headers.map((h) => `<th style="border:1px solid #ccc;padding:6px;text-align:left;background:#f3f3f3">${escapeHtml(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #ccc;padding:6px">${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
  return `
    <h3 style="font-family:Arial;margin:14px 0 8px 0">${escapeHtml(title)}</h3>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial;font-size:12px">
      <tr>${th}</tr>
      ${tr}
    </table>
  `;
}

function downloadBudgetBackupExcel(data, sym) {
  const clients = (data.clients || []).slice().sort((a,b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const tasks = data.tasks || [];
  const budget = data.budget || [];
  const goals = data.goals || [];

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
    </head>
    <body>
      ${tableHtml("Clients", ["Name","Status","Tags","Notes","Updated"], clients.map((c) => [
        c.name || "",
        c.status || "",
        (c.tags || []).join(", "),
        c.notes || "",
        c.updatedAt ? new Date(c.updatedAt).toLocaleString() : "",
      ]))}

      ${tableHtml("Tasks", ["Title","Priority","Due","Done","Client","Notes"], tasks.map((t) => [
        t.title || "",
        t.priority || "",
        t.due || "",
        t.done ? "Yes" : "No",
        t.clientId || "",
        t.notes || "",
      ]))}

      ${tableHtml("Budget", ["Date","Type","Amount","Recurring","Every (days)","Note"], budget.map((b) => [
        b.date || "",
        b.type || "",
        `${sym}${Number(b.amount || 0).toFixed(2)}`,
        b.recurring || "One-off",
        b.everyDays || "",
        b.note || "",
      ]))}

      ${tableHtml("Goals", ["Title","Target","Target date","Start date","Notes"], goals.map((g) => [
        g.title || "",
        `${sym}${Number(g.targetAmount || 0).toFixed(2)}`,
        g.targetDate || "",
        g.startDate || "",
        g.notes || "",
      ]))}
    </body>
  </html>
  `;

  downloadExcelHtml("crm-backup.xls", html);
}
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

function normalizeState(input) {
  const parsed = input && typeof input === "object" ? input : {};
  const merged = {
    ...DEFAULT,
    ...parsed,
    settings: { ...DEFAULT.settings, ...(parsed.settings || {}) },
    statuses: Array.isArray(parsed.statuses) ? parsed.statuses : DEFAULT.statuses,
    columns: Array.isArray(parsed.columns) ? parsed.columns : DEFAULT.columns,
    clients: Array.isArray(parsed.clients) ? parsed.clients : DEFAULT.clients,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : DEFAULT.tasks,
    budget: Array.isArray(parsed.budget) ? parsed.budget : DEFAULT.budget,
    goals: Array.isArray(parsed.goals) ? parsed.goals : DEFAULT.goals,
    reminders: Array.isArray(parsed.reminders) ? parsed.reminders : DEFAULT.reminders,
    calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : DEFAULT.calendarEvents,
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : DEFAULT.invoices,
    invoiceSettings: { ...DEFAULT.invoiceSettings, ...(parsed.invoiceSettings || {}) },
    notes: Array.isArray(parsed.notes) ? parsed.notes : DEFAULT.notes,
    notepad: parsed.notepad && typeof parsed.notepad === "object" ? parsed.notepad : DEFAULT.notepad,
  };

  merged.settings.tabs = { ...DEFAULT.settings.tabs, ...(merged.settings.tabs || {}) };
  merged.settings.tabs.settings = true;

  if (!merged.statuses.some((s) => s.id === "archived")) {
    merged.statuses = [...merged.statuses, { id: "archived", name: "Archive", color: "#71717a" }];
  }

  merged.clients = merged.clients.map((c, idx) => ({
    ...c,
    orderIndex: Number.isFinite(Number(c.orderIndex)) ? Number(c.orderIndex) : idx,
  }));

  return merged;
}

function safeLoad() {
  return normalizeState(DEFAULT);
}

function safeSave(_data) {
  // Account data is saved with saveAccountState(). localStorage is no longer used for CRM data.
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error("You must be logged in to load account data.");
  return data.user.id;
}

function readLegacyLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function loadAccountState() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(ACCOUNT_DATA_TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data?.data) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return normalizeState(data.data);
  }

  const initialData = readLegacyLocalState() || normalizeState(DEFAULT);
  await saveAccountState(initialData);
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  return initialData;
}

async function saveAccountState(data) {
  const userId = await getCurrentUserId();
  const payload = normalizeState(data);

  const { error } = await supabase
    .from(ACCOUNT_DATA_TABLE)
    .upsert(
      {
        user_id: userId,
        data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

async function resetAccountState() {
  const resetData = normalizeState(DEFAULT);
  await saveAccountState(resetData);
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  return resetData;
}

/* =========================
   Defaults
========================= */
const DEFAULT = {
  settings: {
    companyName: "My CRM",
    currency: "GBP",
    theme: "dark",
    tabs: { clients: true, tasks: true, budget: true, goals: true, settings: true, notepad: true },
    todayStripDismissed: false,
    notificationsEnabled: false,
  },
  statuses: [
    { id: "lead", name: "Lead", color: "#3b82f6" },
    { id: "client", name: "Client", color: "#22c55e" },
    { id: "inactive", name: "Inactive", color: "#a1a1aa" },
    { id: "archived", name: "Archive", color: "#71717a" },
  ],
  columns: [],
  clients: [
    {
      id: crypto.randomUUID(),
      name: "New person",
      status: "lead",
      tags: [],
      notes: "",
      updatedAt: Date.now(),
      fields: {},
      orderIndex: 0,
    },
  ],
  tasks: [],
  budget: [],
  goals: [],
  calendarEvents: [],
  reminders: [],
  invoices: [],
  invoiceSettings: {},
  notes: [],
  folders: [],
  colorPresets: [],
};

/* =========================
   Icons (clean + consistent)
========================= */
function IconUsers() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 21c0-2.8-2.7-5-6-5s-6 2.2-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M21 21c0-2.4-1.4-4.4-3.6-5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17.4 9.8A3.1 3.1 0 1 0 16 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconWallet() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7.5A3.5 3.5 0 0 1 6.5 4H19a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3 8.5v9A2.5 2.5 0 0 0 5.5 20H19a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H6.5A3.5 3.5 0 0 1 3 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconTarget() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/* =========================
   Portal Popover (fixed click handling)
========================= */
function useAnchoredPopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 260 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  function compute() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const padding = 10;
    const w = Math.min(380, window.innerWidth - padding * 2);
    let x = r.left;
    let y = r.bottom + 8;
    if (x + w > window.innerWidth - padding) x = window.innerWidth - padding - w;
    if (x < padding) x = padding;
    const maxY = window.innerHeight - padding;
    if (y > maxY) y = maxY - 10;
    setPos({ x, y, w });
  }

  useEffect(() => {
    if (!open) return;
    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const b = btnRef.current;
      const p = popRef.current;
      if (b && (b === e.target || b.contains(e.target))) return;
      if (p && (p === e.target || p.contains(e.target))) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return { open, setOpen, pos, btnRef, popRef, compute };
}

function PortalPopover({ pos, popRef, children }) {
  return createPortal(
    <div
      ref={popRef}
      className="portalPopover"
      style={{ left: pos.x, top: pos.y, width: pos.w }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

/* =========================
   Custom Controls
========================= */
function Checkbox({ checked, onChange, label }) {
  return (
    <div className={"cb" + (checked ? " cbOn" : "")} onClick={() => onChange(!checked)} role="checkbox" aria-checked={checked} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked); } }}>
      <div className="cbBox"><div className="cbTick"/></div>
      {label ? <div className="cbText">{label}</div> : null}
    </div>
  );
}

function ChipButton({ dot, text, onClick, title }) {
  return (
    <button className="chip" onClick={onClick} title={title}>
      <span className="chipDot" style={{ background: dot }} />
      <span>{text}</span>
    </button>
  );
}

function PillPicker({ value, options, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const current = options.find((o) => o.value === value) || options[0];

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={current.color} text={current.value} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          {options.map((o) => (
            <div key={o.value} className="menuItem" onClick={() => { onChange(o.value); setOpen(false); }}>
              <div className="menuLeft">
                <span className="chipDot" style={{ background: o.color }} />
                <div className="menuText"><strong>{o.value}</strong></div>
              </div>
              <span className="chip" style={{ margin: 0, cursor: "default" }}>{o.value === value ? "Selected" : "Choose"}</span>
            </div>
          ))}
        </PortalPopover>
      )}
    </>
  );
}


function ThemeDropdown({ value, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  return (
    <>
      <div ref={btnRef} style={{ display: "block" }}>
        <button
          className="dropdownBtn"
          onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }}
          type="button"
        >
          <span>{value}</span>
          <span style={{ color: "var(--muted)" }}>â–¼</span>
        </button>
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          {["Dark","Light"].map((opt) => (
            <div
              key={opt}
              className="menuItem"
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              <div className="menuLeft">
                <span className="chipDot" style={{ background: opt === "Dark" ? "#71717a" : "#a1a1aa" }} />
                <div className="menuText"><strong>{opt}</strong></div>
              </div>
              <span className="chip" style={{ margin: 0, cursor: "default" }}>{opt === value ? "Selected" : "Choose"}</span>
            </div>
          ))}
        </PortalPopover>
      )}
    </>
  );
}

function CurrencyDropdown({ value, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const options = ["GBP","USD","EUR"];
  return (
    <>
      <div ref={btnRef} style={{ display: "block" }}>
        <button
          className="dropdownBtn"
          onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }}
          type="button"
        >
          <span>{value}</span>
          <span style={{ color: "var(--muted)" }}>â–¼</span>
        </button>
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          {options.map((opt) => (
            <div
              key={opt}
              className="menuItem"
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              <div className="menuLeft">
                <span className="chipDot" style={{ background: opt === "GBP" ? "#60a5fa" : opt === "USD" ? "#22c55e" : "#a78bfa" }} />
                <div className="menuText"><strong>{opt}</strong></div>
              </div>
              <span className="chip" style={{ margin: 0, cursor: "default" }}>{opt === value ? "Selected" : "Choose"}</span>
            </div>
          ))}
        </PortalPopover>
      )}
    </>
  );
}

function StatusPicker({ value, statuses, statusMap, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const current = statusMap[value] || statuses[0];

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={current?.color || "#999"} text={current?.name || "Status"} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>Status</div>
          {statuses.map((s) => (
            <div key={s.id} className="menuItem" onClick={() => { onChange(s.id); setOpen(false); }}>
              <div className="menuLeft">
                <span className="chipDot" style={{ background: s.color }} />
                <div className="menuText"><strong>{s.name}</strong></div>
              </div>
              <span className="chip" style={{ margin: 0, cursor: "default" }}>{s.id === value ? "Selected" : "Choose"}</span>
            </div>
          ))}
        </PortalPopover>
      )}
    </>
  );
}

function TagsEditor({ tags, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const label = tags.length ? `${tags[0]}${tags.length > 1 ? ` +${tags.length-1}` : ""}` : "Add tags";

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={"rgba(255,255,255,0.25)"} text={label} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>Tags (comma separated)</div>
          <input
            className="input"
            defaultValue={tags.join(", ")}
            placeholder="VIP, Referral, Follow-up"
            style={{ width: "100%" }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = e.currentTarget.value;
              const next = v.split(",").map((x) => x.trim()).filter(Boolean);
              onChange(next);
              setOpen(false);
            }}
          />
        </PortalPopover>
      )}
    </>
  );
}

function ClientPicker({ clients, clientId, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const name = clientId ? (clients.find((c) => c.id === clientId)?.name || "Unknown") : "None";

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={"rgba(120,170,255,0.55)"} text={name} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          <div className="menuItem" onClick={() => { onChange(""); setOpen(false); }}>
            <div className="menuLeft">
              <span className="chipDot" style={{ background: "#71717a" }} />
              <div className="menuText"><strong>None</strong></div>
            </div>
            <span className="chip" style={{ margin: 0, cursor: "default" }}>{clientId === "" ? "Selected" : "Choose"}</span>
          </div>

          <hr className="sep" />

          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {clients.map((c) => (
              <div key={c.id} className="menuItem" onClick={() => { onChange(c.id); setOpen(false); }}>
                <div className="menuLeft">
                  <span className="chipDot" style={{ background: "rgba(120,170,255,0.55)" }} />
                  <div className="menuText">
                    <strong>{c.name}</strong>
                    <span>{(c.tags || []).slice(0, 2).join(", ") || " "}</span>
                  </div>
                </div>
                <span className="chip" style={{ margin: 0, cursor: "default" }}>{clientId === c.id ? "Selected" : "Choose"}</span>
              </div>
            ))}
          </div>
        </PortalPopover>
      )}
    </>
  );
}

function RecurringPicker({ value, everyDays, onChange }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();
  const label = value === "CustomDays" ? `Every ${everyDays || 0} days` : value;

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={"rgba(255,255,255,0.25)"} text={label} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          {["One-off", "Weekly", "Monthly", "Yearly", "CustomDays"].map((o) => (
            <div key={o} className="menuItem" onClick={() => { onChange(o, o === "CustomDays" ? (everyDays || 30) : 0); setOpen(false); }}>
              <div className="menuLeft">
                <span className="chipDot" style={{ background: "rgba(255,255,255,0.25)" }} />
                <div className="menuText"><strong>{o === "CustomDays" ? "Custom" : o}</strong></div>
              </div>
              <span className="chip" style={{ margin: 0, cursor: "default" }}>{o === value ? "Selected" : "Choose"}</span>
            </div>
          ))}
          {value === "CustomDays" && (
            <>
              <hr className="sep" />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>Every</span>
                <input className="input" style={{ width: 120 }} value={String(everyDays || "")} onChange={(e) => onChange("CustomDays", Number(e.target.value) || 0)} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>days</span>
              </div>
            </>
          )}
        </PortalPopover>
      )}
    </>
  );
}

/* Custom Date Picker (DD/MM/YYYY display + calendar) */
function DatePicker({ valueISO, onChange, placeholder = "Select date" }) {
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();

  const base = parseISO(valueISO) || new Date();
  const [viewY, setViewY] = useState(base.getFullYear());
  const [viewM, setViewM] = useState(base.getMonth());

  useEffect(() => {
    const d = parseISO(valueISO);
    if (!d) return;
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  }, [valueISO]);

  const first = new Date(viewY, viewM, 1);
  const firstDow = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewY, viewM, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const label = valueISO ? formatLocalDate(valueISO) : placeholder;

  function pick(d) {
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    onChange(iso);
    setOpen(false);
  }

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <button className="chip" onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }}>
          <span className="chipDot" style={{ background: "rgba(255,255,255,0.25)" }} />
          <span style={{ opacity: valueISO ? 1 : 0.65 }}>{label}</span>
        </button>
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <button className="iconBtn" style={{ width: 32, height: 32 }} onClick={() => {
              const m = viewM - 1;
              if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m);
            }}>€¹</button>

            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(viewY, viewM, 1))}
            </div>

            <button className="iconBtn" style={{ width: 32, height: 32 }} onClick={() => {
              const m = viewM + 1;
              if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m);
            }}>€º</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
            {["M","T","W","T","F","S","S"].map((d) => (
              <div key={d} style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {cells.map((d, idx) => {
              if (!d) return <div key={idx} style={{ height: 34 }} />;
              const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              const selected = iso === valueISO;
              return (
                <button
                  key={idx}
                  className="iconBtn"
                  style={{
                    width: "100%",
                    height: 34,
                    borderRadius: 12,
                    background: selected ? "rgba(120,170,255,0.18)" : "rgba(255,255,255,0.04)",
                    borderColor: selected ? "rgba(120,170,255,0.35)" : "var(--stroke)",
                    transform: "none",
                  }}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button className="btn btnPrimary" onClick={() => { onChange(todayISO()); setOpen(false); }}>Today</button>
          </div>
        </PortalPopover>
      )}
    </>
  );
}

/* Custom Color Picker (no native color input) */
function ColorPicker({ value, onChange }) {
  const palette = ["#3b82f6","#22c55e","#ef4444","#f59e0b","#a78bfa","#06b6d4","#a1a1aa","#71717a","#0ea5e9","#14b8a6"];
  const { open, setOpen, pos, btnRef, popRef, compute } = useAnchoredPopover();

  return (
    <>
      <div ref={btnRef} style={{ display: "inline-flex" }}>
        <ChipButton dot={value} text={value.toUpperCase()} onClick={() => { setOpen((s) => !s); setTimeout(compute, 0); }} />
      </div>

      {open && (
        <PortalPopover pos={pos} popRef={popRef}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {palette.map((c) => (
              <button
                key={c}
                className="iconBtn"
                style={{ width: "100%", height: 38, borderRadius: 14, background: c, borderColor: "rgba(255,255,255,0.18)" }}
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
              />
            ))}
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: 999, background: value, border: "1px solid rgba(255,255,255,0.18)" }} />
            <input
              className="input"
              style={{ width: "100%" }}
              defaultValue={value}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                let v = e.currentTarget.value.trim();
                if (!v.startsWith("#")) v = `#${v}`;
                if (/^#[0-9a-fA-F]{6}$/.test(v)) { onChange(v); setOpen(false); }
              }}
              placeholder="#RRGGBB"
            />
          </div>
        </PortalPopover>
      )}
    </>
  );
}

/* =========================
   Inline Edit
========================= */
function InlineEdit({ value, placeholder, multiline = false, onCommit, onCancelKey }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => { if (editing) setTimeout(() => ref.current?.focus?.(), 0); }, [editing]);

  function commit() { setEditing(false); onCommit(draft); }
  function cancel() { setEditing(false); setDraft(value); if (onCancelKey) onCancelKey(); }

  if (!editing) {
    return (
      <div className="inlineText" onClick={() => setEditing(true)} title={value}>
        {value ? value : <span style={{ opacity: 0.45 }}>{placeholder}</span>}
      </div>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref}
        className="inlineEdit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") commit();
        }}
        placeholder={placeholder}
        style={{ minHeight: 80, resize: "vertical" }}
      />
    );
  }

  return (
    <input
      ref={ref}
      className="inlineEdit"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter") commit();
      }}
      placeholder={placeholder}
    />
  );
}

/* =========================
   Reminder engine (browser notifications)
========================= */
function notificationTitleFor(rem) {
  if (rem.type === "task") return "Task reminder";
  if (rem.type === "client") return "Client reminder";
  return "Reminder";
}

function ensureNotificationPermission(setToast, setData) {
  if (!("Notification" in window)) { setToast("Notifications not supported in this browser"); return false; }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") { setToast("Notifications blocked in browser settings"); return false; }

  Notification.requestPermission().then((p) => {
    if (p === "granted") {
      setToast("Notifications enabled");
      setData((d) => ({ ...d, settings: { ...d.settings, notificationsEnabled: true } }));
    } else {
      setToast("Notifications not enabled");
    }
  });

  return false;
}

/* =========================
   App
========================= */
function enabledTabs(tabs) {
  return Object.entries(tabs)
    .filter(([, v]) => v)
    .map(([k]) => k);
}


function ModalShell({ title, onClose, children }) {
  return (
    <div className="modalOverlay" onMouseDown={(e) => { if (e.target.classList.contains("modalOverlay")) onClose(); }}>
      <div className="modal modalGlass">
        <div className="modalHeader">
          <div><h3>{title}</h3></div>
          
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmText, onCancel, onConfirm }) {
  return (
    <div className="modalOverlay" onMouseDown={(e) => { if (e.target.classList.contains("modalOverlay")) onCancel(); }}>
      <div className="modal modalGlass" style={{ width: "min(520px, 100%)" }}>
        <div className="modalHeader">
          <div>
            <h3>{title}</h3>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{message}</div>
          </div>
          
        </div>
        <div className="modalActions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btnPrimary" style={{ borderColor: "rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.18)" }} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function modalTitle(type) {
  if (type === "quickAdd") return "Quick add";
  if (type === "addClient") return "Add client";
  if (type === "addTask") return "Add task";
  if (type === "addBudget") return "Add budget entry";
  if (type === "addGoal") return "Add goal";
  if (type === "addColumn") return "Add column";
  if (type === "addReminder") return "Add reminder";
  return "Modal";
}

function ModalContent({ modal, data, setData, setModal, toastOk, ensureNotify }) {
  const type = modal.type;

if (type === "quickAdd") {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <button className="btn btnPrimary quickAddBtn" onClick={() => setModal({ type: "addClient" })}>
        <span className="qaIcon">ðŸ‘¤</span> Client
      </button>

      <button className="btn btnPrimary quickAddBtn" onClick={() => setModal({ type: "addTask" })}>
        <span className="qaIcon">âœ…</span> Task
      </button>

      <button className="btn btnPrimary quickAddBtn" onClick={() => setModal({ type: "addBudget" })}>
        <span className="qaIcon">ðŸ’·</span> Budget entry
      </button>

      <button className="btn btnPrimary quickAddBtn" onClick={() => setModal({ type: "addGoal" })}>
        <span className="qaIcon">ðŸŽ¯</span> Goal
      </button>

      <button className="btn quickAddBtn" onClick={() => setModal(null)}>Cancel</button>
    </div>
  );
}

if (type === "addClient") {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("lead");
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState("");

  return (
    <div className="form">
      <label>Name *</label>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Client name"
      />

      <label>Status</label>
      <StatusPicker
        value={status}
        statuses={data.statuses}
        statusMap={Object.fromEntries(data.statuses.map(s => [s.id, s]))}
        onChange={setStatus}
      />

      <label>Tags</label>
      <TagsEditor tags={tags} onChange={setTags} />

      <label>Notes</label>
      <textarea
        className="input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes"
      />

      <div className="formActions">
        <button
          className="btn"
          onClick={() => setModal(null)}
        >
          Cancel
        </button>
        <button
          className="btn btnPrimary"
          disabled={!name.trim()}
          onClick={() => {
            setData(d => ({
              ...d,
              clients: [
                {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  status,
                  tags,
                  notes,
                  fields: {},
                  updatedAt: Date.now(),
                  orderIndex: d.clients.length
                },
                ...d.clients
              ]
            }));
            toastOk("Client added");
            setModal(null);
          }}
        >
          Add client
        </button>
      </div>
    </div>
  );
}

if (type === "addTask") {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [due, setDue] = useState("");

  return (
    <div className="form">
      <label>Task name *</label>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task"
      />

      <label>Priority</label>
      <PillPicker
        value={priority}
        options={[
          { value: "Low", color: "#a1a1aa" },
          { value: "Medium", color: "#3b82f6" },
          { value: "High", color: "#ef4444" },
        ]}
        onChange={setPriority}
      />

      <label>Due date</label>
      <DatePicker valueISO={due} onChange={setDue} />

      <div className="formActions">
        <button className="btn" onClick={() => setModal(null)}>Cancel</button>
        <button
          className="btn btnPrimary"
          disabled={!title.trim()}
          onClick={() => {
            setData(d => ({
              ...d,
              tasks: [
                {
                  id: crypto.randomUUID(),
                  title: title.trim(),
                  priority,
                  due,
                  done: false,
                  updatedAt: Date.now()
                },
                ...d.tasks
              ]
            }));
            toastOk("Task added");
            setModal(null);
          }}
        >
          Add task
        </button>
      </div>
    </div>
  );
}

if (type === "addBudget") {
  const [amount, setAmount] = useState("");
  const [typeB, setTypeB] = useState("Outgoing");
  const [date, setDate] = useState(todayISO());

  return (
    <div className="form">
      <label>Amount</label>
      <input
        className="input"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label>Type</label>
      <PillPicker
        value={typeB}
        options={[
          { value: "Incoming", color: "#22c55e" },
          { value: "Outgoing", color: "#ef4444" },
        ]}
        onChange={setTypeB}
      />

      <label>Date</label>
      <DatePicker valueISO={date} onChange={setDate} />

      <div className="formActions">
        <button className="btn" onClick={() => setModal(null)}>Cancel</button>
        <button
          className="btn btnPrimary"
          disabled={!amount}
          onClick={() => {
            setData(d => ({
              ...d,
              budget: [
                {
                  id: crypto.randomUUID(),
                  amount: Number(amount),
                  type: typeB,
                  date,
                  updatedAt: Date.now()
                },
                ...d.budget
              ]
            }));
            toastOk("Budget entry added");
            setModal(null);
          }}
        >
          Add entry
        </button>
      </div>
    </div>
  );
}

if (type === "addGoal") {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");

  return (
    <div className="form">
      <label>Goal name</label>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label>Target amount</label>
      <input
        className="input"
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />

      <div className="formActions">
        <button className="btn" onClick={() => setModal(null)}>Cancel</button>
        <button
          className="btn btnPrimary"
          disabled={!title || !target}
          onClick={() => {
            setData(d => ({
              ...d,
              goals: [
                {
                  id: crypto.randomUUID(),
                  title,
                  target: Number(target),
                  progress: 0,
                  history: []
                },
                ...d.goals
              ]
            }));
            toastOk("Goal added");
            setModal(null);
          }}
        >
          Add goal
        </button>
      </div>
    </div>
  );
}

if (type === "addColumn") {
  const [name, setName] = useState("");
  const [colType, setColType] = useState("text");

  return (
    <div className="form">
      <label>Column name *</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Source, Next follow-up" />

      <label>Type</label>
      <PillPicker
        value={colType === "date" ? "Date" : "Text"}
        options={[
          { value: "Text", color: "#3b82f6" },
          { value: "Date", color: "#22c55e" },
        ]}
        onChange={(v) => setColType(v === "Date" ? "date" : "text")}
      />

      <div className="modalActions">
        <button className="btn" onClick={() => setModal(null)}>Cancel</button>
        <button
          className="btn btnPrimary"
          onClick={() => {
            const nm = name.trim();
            if (!nm) return toastOk("Enter a name");
            setData((d) => ({ ...d, columns: [...(d.columns || []), { id: crypto.randomUUID(), name: nm, type: colType }] }));
            setModal(null);
            toastOk("Column added");
          }}
        >
          Add column
        </button>
      </div>
    </div>
  );
}


return null;
}

export {
  Checkbox,
  ChipButton,
  ClientPicker,
  ColorPicker,
  ConfirmModal,
  CurrencyDropdown,
  ACCOUNT_DATA_TABLE,
  DEFAULT,
  DatePicker,
  ENABLETABSDEFAULT,
  IconBell,
  IconCheck,
  IconSettings,
  IconTarget,
  IconUsers,
  IconWallet,
  InlineEdit,
  ModalContent,
  ModalShell,
  PillPicker,
  PortalPopover,
  RecurringPicker,
  STORAGE_KEY,
  StatusPicker,
  TagsEditor,
  ThemeDropdown,
  addDaysISO,
  clamp,
  currencySymbol,
  downloadBudgetBackupExcel,
  downloadExcelHtml,
  downloadText,
  enabledTabs,
  ensureNotificationPermission,
  escapeHtml,
  formatLocalDate,
  modalTitle,
  monthKey,
  notificationTitleFor,
  parseISO,
  loadAccountState,
  normalizeState,
  resetAccountState,
  safeLoad,
  safeSave,
  saveAccountState,
  tableHtml,
  toCSV,
  todayISO,
  useAnchoredPopover
};