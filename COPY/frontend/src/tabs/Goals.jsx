import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DatePicker, clamp, currencySymbol, parseISO } from "../shared/crmShared.jsx";

function uid() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(sym, v) {
  const n = asNum(v);
  return `${sym}${n.toFixed(2)}`;
}

function daysUntil(iso) {
  const d = parseISO(iso);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.ceil((dd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ProgressRing({ pct, size = 54 }) {
  const p = clamp(asNum(pct), 0, 100);
  const r = Math.max(6, Math.floor(size / 2) - 6);
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  const dashOffset = c - dash;
  const stroke = 4;
  const center = size / 2;
  const gradId = useMemo(() => `goal_grad_${uid()}`, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7A1F80" />
          <stop offset="100%" stopColor="#CA3673" />
        </linearGradient>
      </defs>

      <circle cx={center} cy={center} r={r} stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} fill="none" />

      <circle
        cx={center}
        cy={center}
        r={r}
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}

function Modal({ title, children, onClose, width = 720 }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      const card = ref.current;
      if (card && card.contains(t)) return;
      const pop = t?.closest?.(".portalPopover");
      if (pop) return;
      onClose?.();
    };

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div className="modalOverlay" style={{ zIndex: 9999, position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
      <div
        ref={ref}
        className="modalCard"
        style={{
          width: `min(${width}px, calc(100vw - 28px))`,
          maxHeight: "calc(100vh - 28px)",
          overflow: "auto",
          padding: 18,
          borderRadius: 18,
          border: "1px solid var(--stroke)",
          background: "rgba(18,20,26,0.94)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
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

export default function GoalsPage({ data, setData, setConfirm, toastOk }) {
  const sym = currencySymbol(data?.settings?.currency);
  const goals = Array.isArray(data?.goals) ? data.goals : [];

  const [amountDraft, setAmountDraft] = useState({}); // goalId -> string
  const [historyOpen, setHistoryOpen] = useState({}); // goalId -> bool

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({
    title: "",
    targetAmount: "",
    startDate: "",
    targetDate: "",
  });

  function currentFromHistory(g) {
    const hist = Array.isArray(g?.history) ? g.history : [];
    let sum = 0;
    for (const h of hist) sum += asNum(h?.delta);
    return sum;
  }

  function updateGoal(id, patch) {
    setData((d) => {
      const list = Array.isArray(d?.goals) ? d.goals : [];
      return {
        ...d,
        goals: list.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: Date.now() } : g)),
      };
    });
  }

  function moveGoal(id, dir) {
    setData((d) => {
      const list = Array.isArray(d?.goals) ? [...d.goals] : [];
      const idx = list.findIndex((g) => g.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= list.length) return d;
      const tmp = list[idx];
      list[idx] = list[to];
      list[to] = tmp;
      return { ...d, goals: list };
    });
  }

  function deleteGoal(id) {
    setConfirm?.({
      title: "Delete goal",
      message: "This removes the goal permanently.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => {
          const list = Array.isArray(d?.goals) ? d.goals : [];
          return { ...d, goals: list.filter((g) => g.id !== id) };
        });
        setConfirm?.(null);
        toastOk?.("Deleted");
      },
    });
  }

  function addDelta(goalId, delta) {
    const n = asNum(delta);
    if (!Number.isFinite(n) || n === 0) return;

    setData((d) => {
      const list = Array.isArray(d?.goals) ? d.goals : [];
      return {
        ...d,
        goals: list.map((g) => {
          if (g.id !== goalId) return g;
          const nextHist = [...(Array.isArray(g.history) ? g.history : [])];
          nextHist.push({ id: uid(), delta: n, ts: Date.now() });
          return { ...g, history: nextHist, updatedAt: Date.now() };
        }),
      };
    });
  }

  function deleteHistoryItem(goalId, histId) {
    setConfirm?.({
      title: "Delete history item",
      message: "This updates the progress.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => {
          const list = Array.isArray(d?.goals) ? d.goals : [];
          return {
            ...d,
            goals: list.map((g) => {
              if (g.id !== goalId) return g;
              const next = (Array.isArray(g.history) ? g.history : []).filter((h) => h.id !== histId);
              return { ...g, history: next, updatedAt: Date.now() };
            }),
          };
        });
        setConfirm?.(null);
        toastOk?.("Updated");
      },
    });
  }

  const summary = useMemo(() => {
    let totalTarget = 0;
    let totalCurrent = 0;
    let completed = 0;
    let dueSoon = 0;
    let overdue = 0;

    for (const g of goals) {
      const target = asNum(g?.targetAmount);
      const current = currentFromHistory(g);
      totalTarget += Math.max(0, target);
      totalCurrent += current;
      if (target > 0 && current >= target) completed += 1;

      const dl = daysUntil(g?.targetDate);
      if (dl != null) {
        if (dl < 0) overdue += 1;
        else if (dl <= 7) dueSoon += 1;
      }
    }

    const pct = totalTarget > 0 ? clamp((totalCurrent / totalTarget) * 100, 0, 100) : 0;
    return { totalTarget, totalCurrent, pct, completed, dueSoon, overdue, count: goals.length };
  }, [goals]);

  function openAdd() {
    setAddDraft({ title: "", targetAmount: "", startDate: "", targetDate: "" });
    setAddOpen(true);
  }

  function saveAdd() {
    const title = (addDraft.title || "").trim();
    const target = asNum(addDraft.targetAmount);
    if (!title) return;
    if (!Number.isFinite(target) || target <= 0) return;

    const newGoal = {
      id: uid(),
      title,
      targetAmount: target,
      startDate: addDraft.startDate || "",
      targetDate: addDraft.targetDate || "",
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setData((d) => {
      const list = Array.isArray(d?.goals) ? d.goals : [];
      return { ...d, goals: [...list, newGoal] };
    });

    setAddOpen(false);
    toastOk?.("Goal added");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* goals local styles (scoped) */}
      <style>{`
        .goalProgressBar {
          height: 14px !important;
          border-radius: 999px !important;
        }
        .goalProgressFill {
          height: 100% !important;
          border-radius: 999px !important;
          transition: width 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
          will-change: width;
        }
        .goalDateWrap button,
        .goalDateWrap input {
          width: 100%;
          height: 40px;
          border-radius: 14px;
          border: 1px solid var(--stroke);
          background: rgba(255,255,255,0.04);
          color: var(--text);
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }
        .goalDateWrap button:hover,
        .goalDateWrap input:hover {
          border-color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.06);
        }
        .goalDateWrap button:focus,
        .goalDateWrap input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(120,170,255,0.18);
          border-color: rgba(120,170,255,0.55);
        }
      `}</style>
      <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260 }}>
          <div style={{ position: "relative" }}>
            <ProgressRing pct={summary.pct} size={56} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {Math.round(summary.pct)}%
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>Goals</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {summary.count === 0 ? "No goals yet" : `${summary.completed}/${summary.count} completed`}
              {summary.dueSoon > 0 ? ` • ${summary.dueSoon} due soon` : ""}
              {summary.overdue > 0 ? ` • ${summary.overdue} overdue` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
            <div style={{ fontWeight: 900 }}>{money(sym, summary.totalCurrent)}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>of {money(sym, summary.totalTarget)}</div>
          </div>
          <button className="btn btnPrimary" type="button" onClick={openAdd}>
            + Add goal
          </button>
        </div>
      </div>

      {goals.map((g) => {
        const target = asNum(g?.targetAmount);
        const current = currentFromHistory(g);
        const pct = target > 0 ? clamp((current / target) * 100, 0, 100) : 0;
        const remaining = Math.max(0, target - current);
        const dl = daysUntil(g?.targetDate);

        const draft = amountDraft[g.id] ?? "";
        const draftNum = asNum(draft);

        const dueLabel = (() => {
          if (dl == null) return "No target date";
          if (dl < 0) return `Overdue ${Math.abs(dl)} day${Math.abs(dl) === 1 ? "" : "s"}`;
          if (dl === 0) return "Due today";
          return `${dl} day${dl === 1 ? "" : "s"} left`;
        })();

        return (
          <div key={g.id} className="card goalCard" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 260 }}>
                <div style={{ position: "relative", marginTop: 2 }}>
                  <ProgressRing pct={pct} size={52} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {Math.round(pct)}%
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2, wordBreak: "break-word" }}>{g.title || "Untitled goal"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{dueLabel}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="iconBtn" title="Move up" onClick={() => moveGoal(g.id, -1)}>
                  ↑
                </button>
                <button className="iconBtn" title="Move down" onClick={() => moveGoal(g.id, 1)}>
                  ↓
                </button>
                <button className="iconBtn iconBtnDanger" title="Delete" onClick={() => deleteGoal(g.id)}>
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gridTemplateRows: "auto auto", columnGap: 10, rowGap: 6, alignItems: "center" }}>
                <div style={{ gridColumn: 1, gridRow: 1, fontWeight: 900, whiteSpace: "nowrap", alignSelf: "center" }}>{money(sym, current)}</div>
                <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0, alignSelf: "center" }}>
                  <div
                    className="progressBar goalProgressBar"
                    style={{ border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.04)", overflow: "hidden" }}
                  >
                    <div
                      className="progressFill goalProgressFill"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7A1F80, #CA3673)" }}
                    />
                  </div>
                </div>
                <div style={{ gridColumn: 3, gridRow: 1, fontWeight: 900, whiteSpace: "nowrap", textAlign: "right", alignSelf: "center" }}>{money(sym, target)}</div>
                <div style={{ gridColumn: 2, gridRow: 2, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{money(sym, remaining)} left</span>
                  <span style={{ fontWeight: 800, color: "var(--text)" }}>{Math.round(pct)}%</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "end" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="fieldLabel">Amount</div>
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => setAmountDraft((s) => ({ ...s, [g.id]: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: "100%" }}
                  />
                </div>

                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => {
                    if (!Number.isFinite(draftNum) || draftNum === 0) return;
                    addDelta(g.id, Math.abs(draftNum));
                    setAmountDraft((s) => ({ ...s, [g.id]: "" }));
                  }}
                >
                  Add
                </button>

                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (!Number.isFinite(draftNum) || draftNum === 0) return;
                    addDelta(g.id, -Math.abs(draftNum));
                    setAmountDraft((s) => ({ ...s, [g.id]: "" }));
                  }}
                >
                  Remove
                </button>

                <button
                  className="btn"
                  type="button"
                  onClick={() => setHistoryOpen((s) => ({ ...s, [g.id]: !s[g.id] }))}
                >
                  {historyOpen[g.id] ? "Hide history" : "History"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="fieldLabel">Start date</div>
                  <div className="goalDateWrap"><DatePicker valueISO={g.startDate || ""} onChange={(iso) => updateGoal(g.id, { startDate: iso })} placeholder="Start date" /></div>
                </div>
                <div>
                  <div className="fieldLabel">Target date</div>
                  <div className="goalDateWrap"><DatePicker valueISO={g.targetDate || ""} onChange={(iso) => updateGoal(g.id, { targetDate: iso })} placeholder="Target date" /></div>
                </div>
              </div>

              {historyOpen[g.id] && (
                <div style={{ marginTop: 2 }}>
                  <div className="fieldLabel">History</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                    {(Array.isArray(g.history) ? g.history : [])
                      .slice()
                      .sort((a, b) => asNum(a?.ts) - asNum(b?.ts))
                      .map((h) => {
                        const delta = asNum(h?.delta);
                        const sign = delta >= 0 ? "+" : "-";
                        const abs = Math.abs(delta);
                        return (
                          <div
                            key={h.id}
                            className="glass"
                            style={{
                              padding: 10,
                              borderRadius: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                                {sign}
                                {money(sym, abs)}
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {h?.ts ? new Date(h.ts).toLocaleString() : ""}
                              </div>
                            </div>

                            <button
                              className="iconBtn iconBtnDanger"
                              type="button"
                              onClick={() => deleteHistoryItem(g.id, h.id)}
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                    {(Array.isArray(g.history) ? g.history : []).length === 0 && (
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>No history yet</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {goals.length === 0 && <div className="card" style={{ color: "var(--muted)", padding: 16 }}>No goals yet</div>}

      {addOpen && (
        <Modal title="Add goal" onClose={() => setAddOpen(false)} width={680}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <div className="fieldLabel">Title</div>
                <input
                  className="input"
                  value={addDraft.title}
                  onChange={(e) => setAddDraft((s) => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. Monthly revenue"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <div className="fieldLabel">Target amount</div>
                <input
                  className="input"
                  value={addDraft.targetAmount}
                  onChange={(e) => setAddDraft((s) => ({ ...s, targetAmount: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="fieldLabel">Start date</div>
                <div className="goalDateWrap"><DatePicker
                  valueISO={addDraft.startDate || ""}
                  onChange={(iso) => setAddDraft((s) => ({ ...s, startDate: iso }))}
                  placeholder="Start date"
                /></div>
              </div>
              <div>
                <div className="fieldLabel">Target date</div>
                <div className="goalDateWrap"><DatePicker
                  valueISO={addDraft.targetDate || ""}
                  onChange={(iso) => setAddDraft((s) => ({ ...s, targetDate: iso }))}
                  placeholder="Target date"
                /></div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button className="btn" type="button" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={saveAdd}
                disabled={!String(addDraft.title || "").trim() || asNum(addDraft.targetAmount) <= 0}
              >
                Add goal
              </button>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Tip: use Add/Remove on the goal card to log progress over time.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
