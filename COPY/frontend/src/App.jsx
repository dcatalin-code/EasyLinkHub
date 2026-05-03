import { useEffect, useMemo, useRef, useState } from "react";
import ClientsPage from "./tabs/Clients.jsx";
import TasksPage from "./tabs/Tasks.jsx";
import CalendarPage from "./tabs/Calendar.jsx";
import BudgetPage from "./tabs/Budget.jsx";
import GoalsPage from "./tabs/Goals.jsx";
import InvoicesPage from "./tabs/Invoices.jsx";
import SettingsPage from "./tabs/Settings.jsx";
import logo from "./assets/logo.svg";
import NotepadPage from "./tabs/Notepad.jsx";
import LogoutButton from "./components/LogoutButton";

import {
  ConfirmModal,
  DEFAULT,
  ENABLETABSDEFAULT,
  IconCheck,
  IconSettings,
  IconTarget,
  IconUsers,
  IconWallet,
  ModalContent,
  ModalShell,
  enabledTabs,
  ensureNotificationPermission,
  modalTitle,
  notificationTitleFor,
  parseISO,
  loadAccountState,
  saveAccountState,
} from "./shared/crmShared.jsx";

function IconInvoice() {
  return (
    
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M6 2H18V22L15 20L12 22L9 20L6 22V2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 15H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M8 2V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 2V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 13H8.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 13H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13H16.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 17H8.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 17H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17H16.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const APP_TEXT = {
  clients: "Clients",
  tasks: "Tasks",
  calendar: "Calendar",
  budget: "Budget",
  goals: "Goals",
  invoices: "Invoices",
  settings: "Settings",
  notepad: "Notepad",
  add: "Add",
  addClient: "Add client",
  addColumn: "Add column",
  addBudgetEntry: "Add budget entry",
  today: "Today",
  open: "Open",
};

function appLabel(key) {
  return APP_TEXT[key] || key;
}

export default function App({ access = null }) {
  const [data, setData] = useState(DEFAULT);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState(null);
  const accountReadyRef = useRef(false);
  const [tab, setTab] = useState("clients");
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [modal, setModal] = useState(null);

  // Global themed scrollbars (app-wide, respects light/dark via data-theme on <html>).
  useEffect(() => {
    const STYLE_ID = "theme-scrollbars";
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      :root {
        --sb-size: 12px;
        --sb-radius: 999px;

        /* Custom scrollbar colors */
        --sb-thumb: #8F9092;
        --sb-thumb-hover: #8F9092;
        --sb-thumb-active: #8F9092;

        /* Track defaults (overridden per theme below) */
        --sb-track: #2D2E31;
        --sb-thumb-border: rgba(255, 255, 255, 0.55);
      }

      :root[data-theme="light"] {
        --sb-track: #E5E5E5;
        --sb-thumb-border: rgba(255, 255, 255, 0.65);
      }

      :root[data-theme="dark"] {
        --sb-track: #2D2E31;
        --sb-thumb-border: rgba(0, 0, 0, 0.42);
      }

      html { scrollbar-gutter: stable; }

      /* Firefox */
      * { scrollbar-width: thin; scrollbar-color: var(--sb-thumb) var(--sb-track); }

      /* Chromium / Safari */
      *::-webkit-scrollbar { width: var(--sb-size); height: var(--sb-size); }
      *::-webkit-scrollbar-track {
        background: var(--sb-track);
        border-radius: var(--sb-radius);
      }
      *::-webkit-scrollbar-thumb {
        background: var(--sb-thumb);
        border-radius: var(--sb-radius);
        border: 3px solid transparent;
        background-clip: padding-box;
        box-shadow: inset 0 0 0 1px var(--sb-thumb-border);
      }
      *::-webkit-scrollbar-thumb:hover { background: var(--sb-thumb-hover); background-clip: padding-box; }
      *::-webkit-scrollbar-thumb:active { background: var(--sb-thumb-active); background-clip: padding-box; }
      *::-webkit-scrollbar-corner { background: transparent; }
    `;

    return () => {
      // Keep it installed for the lifetime of the app; no-op cleanup.
    };
  }, []);

  // Allows the topbar buttons to trigger actions inside the active Clients tab.
  const clientsActionsRef = useRef(null);

  const [enableTabs, setEnableTabs] = useState(ENABLETABSDEFAULT);
  const isRestricted = Boolean(access?.isRestricted);
  const restrictedStatus = String(access?.status || "").toLowerCase();
  const restrictedLabel =
    restrictedStatus === "past_due"
      ? "Subscription past due"
      : restrictedStatus === "canceled"
      ? "Subscription canceled"
      : "Access expired";

  const computeEnabled = (tabsObj) => {
    const list = enabledTabs(tabsObj);
    const withInvoices = list.includes("invoices") ? list : [...list, "invoices"];
    return withInvoices.includes("calendar") ? withInvoices : [...withInvoices, "calendar"];
  };

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      data.settings.theme === "light" ? "light" : "dark"
    );
  }, [data.settings.theme]);

  useEffect(() => {
    let active = true;

    async function loadAccountData() {
      setAccountLoading(true);
      setAccountError(null);
      accountReadyRef.current = false;

      try {
        const loaded = await loadAccountState();
        if (!active) return;
        setData(loaded);
        accountReadyRef.current = true;
      } catch (err) {
        if (!active) return;
        accountReadyRef.current = false;
        setAccountError(err?.message || "Failed to load account data");
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    loadAccountData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountReadyRef.current || accountLoading || accountError) return;

    const t = setTimeout(() => {
      saveAccountState(data).catch((err) => {
        setAccountError(err?.message || "Failed to save account data");
      });
    }, 450);

    return () => clearTimeout(t);
  }, [data, accountLoading, accountError]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // ESC cancels modals / confirms
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (confirm) setConfirm(null);
      else if (modal) setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, modal]);

  useEffect(() => {
    if (!isRestricted) return;
    setConfirm(null);
    setModal(null);
  }, [isRestricted]);

  // Keep current tab valid
  useEffect(() => {
    const enabled = computeEnabled(data.settings.tabs);
    if (!enabled.includes(tab)) setTab(enabled[0] || "clients");
  }, [data.settings.tabs, tab]);

  const statusMap = useMemo(
    () => Object.fromEntries(data.statuses.map((s) => [s.id, s])),
    [data.statuses]
  );
  const enabled = useMemo(() => computeEnabled(data.settings.tabs), [data.settings.tabs]);

const tabMetaAll = [
  { key: "clients", label: "clients", icon: IconUsers },
  { key: "tasks", label: "tasks", icon: IconCheck },
  { key: "calendar", label: "calendar", icon: IconCalendar },
  { key: "budget", label: "budget", icon: IconWallet },
  { key: "goals", label: "goals", icon: IconTarget },
  { key: "invoices", label: "invoices", icon: IconInvoice },
  { key: "settings", label: "settings", icon: IconSettings },
  { key: "notepad", label: "notepad", icon: IconCheck },
];

const tabMeta = tabMetaAll.filter((t) => enabled.includes(t.key));


const pageTitle = useMemo(
  () => tabMetaAll.find((t) => t.key === tab)?.label || "Clients",
  [tab]
);



  function toastOk(msg) {
    setToast(msg);
  }

  function guardAction(action, fallbackTab = "settings") {
    if (!isRestricted) {
      action?.();
      return;
    }

    setConfirm(null);
    setModal(null);
    if (fallbackTab) setTab(fallbackTab);
  }

  function updateSettings(patch) {
    setData((d) => ({
      ...d,
      settings: { ...d.settings, ...patch, tabs: { ...d.settings.tabs, settings: true } },
    }));
  }
  function updateTabs(patchTabs) {
    const next = { ...data.settings.tabs, ...patchTabs, settings: true };
    setData((d) => ({ ...d, settings: { ...d.settings, tabs: next } }));
  }

  // Reminders tick
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const due = (data.reminders || []).filter((r) => !r.firedAt && r.whenTs && r.whenTs <= now);
      if (!due.length) return;

      if ("Notification" in window && Notification.permission === "granted") {
        for (const r of due) {
          const title = notificationTitleFor(r);
          const body = r.title || "Reminder";
          try {
            new Notification(title, { body });
          } catch {}
        }
      }

      setData((d) => ({
        ...d,
        reminders: d.reminders.map((r) =>
          due.some((x) => x.id === r.id) ? { ...r, firedAt: Date.now() } : r
        ),
      }));
    };

    const iv = setInterval(tick, 2000);
    return () => clearInterval(iv);
  }, [data.reminders]);

    // Calendar events -> reminders sync
  useEffect(() => {
    const calendarReminders = (data.calendarEvents || [])
      .filter((e) => e?.date)
      .map((e) => {
        const whenTs = new Date(`${e.date}T${e.startTime || "09:00"}`).getTime();
        return {
          id: `cal_${e.id}`,
          title: e.title || "Calendar event",
          whenTs,
          type: "calendar",
          linkedId: e.id,
          firedAt: undefined,
        };
      })
      .filter((r) => Number.isFinite(r.whenTs));

    setData((d) => {
      const nonCalendarReminders = (d.reminders || []).filter((r) => r.type !== "calendar");
      return {
        ...d,
        reminders: [...nonCalendarReminders, ...calendarReminders],
      };
    });
  }, [data.calendarEvents, setData]);

  const todayInfo = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const s = startOfDay.getTime();
    const e = endOfDay.getTime();

    const dueRem = (data.reminders || []).filter(
      (r) => r.whenTs >= s && r.whenTs <= e && !r.firedAt
    ).length;

    const dueTasks = (data.tasks || []).filter(
      (t) =>
        t.due &&
        parseISO(t.due) &&
        parseISO(t.due).getTime() >= s &&
        parseISO(t.due).getTime() <= e &&
        !t.done
    ).length;

    const dueCalendar = (data.calendarEvents || []).filter((ev) => {
      if (!ev?.date) return false;
      const ts = new Date(ev.date).getTime();
      return Number.isFinite(ts) && ts >= s && ts <= e;
    }).length;

    return { dueRem, dueTasks, dueCalendar };
  }, [data.reminders, data.tasks, data.calendarEvents]);



  if (accountLoading) {
    return (
      <div className="app" style={{ gridTemplateColumns: "1fr", placeItems: "center" }}>
        <div className="modalGlass" style={{ width: "min(460px, 100%)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Loading account data</h2>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>Syncing your CRM workspace.</p>
        </div>
      </div>
    );
  }

  if (accountError) {
    return (
      <div className="app" style={{ gridTemplateColumns: "1fr", placeItems: "center" }}>
        <div className="modalGlass" style={{ width: "min(620px, 100%)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Account storage is not ready</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            {accountError}
          </p>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 0 }}>
            Run the supplied Supabase SQL file once, then refresh the app.
          </p>
        </div>
      </div>
    );
  }

  function QuickAddGrid() {
    const tileStyle = {
      width: "100%",
      minHeight: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      fontWeight: 600,
      padding: "12px 12px",
    };

    const iconWrap = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      flex: "0 0 22px",
    };

    const openAddClient = () => {
      setTab("clients");
      setModal(null);
      setTimeout(() => clientsActionsRef.current?.openAddClient?.(), 0);
    };

    const openTasks = () => {
      setTab("tasks");
      setModal(null);
    };

    const openAddBudget = () => {
      setTab("budget");
      setModal({ type: "addBudget" });
    };

    const openGoals = () => {
      setTab("goals");
      setModal(null);
    };

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button className="btn btnPrimary" type="button" style={tileStyle} onClick={openAddClient}>
          <span style={iconWrap}>
            <IconUsers />
          </span>
          <span>{appLabel("addClient")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openTasks}>
          <span style={iconWrap}>
            <IconCheck />
          </span>
          <span>{appLabel("tasks")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openAddBudget}>
          <span style={iconWrap}>
            <IconWallet />
          </span>
          <span>{appLabel("addBudgetEntry")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openGoals}>
          <span style={iconWrap}>
            <IconTarget />
          </span>
          <span>{appLabel("goals")}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="app">
        <aside className="sidebar glass">
          <div style={{ padding: "16px 16px 0" }}>
            <img
              src={logo}
              alt="Company logo"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div className="brand">
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.settings.companyName}
              </strong>
              <span>{pageTitle}</span>
            </div>
            <button
              className="iconBtn"
              onClick={() => guardAction(() => updateSettings({ theme: data.settings.theme === "dark" ? "light" : "dark" }))}
              title="Toggle theme"
            >
              {data.settings.theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>

          <div className="nav">
     {tabMeta.map((tabItem) => (
  <button
    key={tabItem.key}
    className={"navBtn" + (tab === tabItem.key ? " navBtnActive" : "")}
    onClick={() => guardAction(() => setTab(tabItem.key))}
  >
    <div className="navLeft">
      {tabItem.icon ? <tabItem.icon /> : null}
      <span style={{ fontSize: 13 }}>{appLabel(tabItem.label)}</span>
    </div>
    <span style={{ color: "var(--muted)", fontSize: 12 }}>▶</span>
  </button>
))}
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
            <button className="btn btnPrimary" style={{ flex: 1 }} onClick={() => guardAction(() => setModal({ type: "quickAdd" }))}>
              + {appLabel("add")}
            </button>
            <button className="iconBtn" onClick={() => guardAction(() => setTab("settings"), "settings")} title={appLabel("settings")}>
              <IconSettings />
            </button>
          </div>
        </aside>

        <main className="main">
                    {!data.settings.todayStripDismissed && (todayInfo.dueRem > 0 || todayInfo.dueTasks > 0 || todayInfo.dueCalendar > 0) && (
            <div className="todayStrip">
              <div className="todayLeft">
                <strong>{appLabel("today")}</strong>
                <span>
                  {todayInfo.dueTasks ? `${todayInfo.dueTasks} task${todayInfo.dueTasks === 1 ? "" : "s"} due` : ""}
                  {todayInfo.dueTasks && todayInfo.dueRem ? " • " : ""}
                  {todayInfo.dueRem ? `${todayInfo.dueRem} reminder${todayInfo.dueRem === 1 ? "" : "s"}` : ""}
                  {(todayInfo.dueTasks || todayInfo.dueRem) && todayInfo.dueCalendar ? " • " : ""}
                  {todayInfo.dueCalendar ? `${todayInfo.dueCalendar} event${todayInfo.dueCalendar === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => guardAction(() => setTab("tasks"))}>
                  {appLabel("open")}
                </button>
                <button className="iconBtn" onClick={() => updateSettings({ todayStripDismissed: true })} title="Dismiss">
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="topbar">
            <div className="hgroup">
             <h2>{appLabel(pageTitle)}</h2>
            </div>

            <div className="actions">
              {tab === "clients" && (
                <>
                  <button className="btn" type="button" onClick={() => guardAction(() => clientsActionsRef.current?.openAddColumn?.())}>
                    + {appLabel("addColumn")}
                  </button>

                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={() => guardAction(() => clientsActionsRef.current?.openAddClient?.())}
                    style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
                  >
                    {appLabel("addClient")}
                  </button>
                </>
              )}
              {tab !== "settings" && (
                <button className="iconBtn" onClick={() => guardAction(() => setTab("settings"), "settings")} title="Settings">
                  <IconSettings />
                </button>
              )}
            </div>
          </div>

          <div
            className="fadeIn"
            style={{
              position: "relative",
              pointerEvents: isRestricted && tab !== "settings" ? "none" : "auto",
              opacity: isRestricted && tab !== "settings" ? 0.55 : 1,
              transition: "opacity 160ms ease",
            }}
          >
            {isRestricted && tab !== "settings" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  pointerEvents: "auto",
                }}
              >
                <div
                  className="glass"
                  style={{
                    width: "min(520px, 100%)",
                    padding: 24,
                    borderRadius: 24,
                    textAlign: "center",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--stroke)",
                      background: "rgba(255,255,255,0.05)",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    {restrictedLabel}
                  </div>

                  <h3 style={{ margin: "16px 0 8px", fontSize: 28, lineHeight: 1.05 }}>
                    Upgrade to restore full access
                  </h3>

                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.7 }}>
                    Your workspace is visible, but editing and CRM actions are currently locked until billing is resolved.
                  </p>

                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                    <button className="btn btnPrimary" type="button" onClick={() => setTab("settings")}>
                      Open settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "notepad" && (
  <NotepadPage
    data={data}
    setData={setData}
  />
)}
            {tab === "clients" && (
              <ClientsPage
                data={data}
                setData={setData}
                statusMap={statusMap}
                setConfirm={setConfirm}
                toastOk={toastOk}
                actionsRef={clientsActionsRef}
              />
            )}
            {tab === "tasks" && (
              <TasksPage
                data={data}
                setData={setData}
                setConfirm={setConfirm}
                toastOk={toastOk}
                ensureNotify={() => ensureNotificationPermission(toastOk, setData)}
              />
            )}
            {tab === "calendar" && (
              <CalendarPage data={data} setData={setData} setConfirm={setConfirm} toastOk={toastOk} />
            )}
            {tab === "budget" && <BudgetPage data={data} setData={setData} setConfirm={setConfirm} toastOk={toastOk} />}
            {tab === "invoices" && (
              <InvoicesPage data={data} setData={setData} setConfirm={setConfirm} toastOk={toastOk} />
            )}
            {tab === "goals" && <GoalsPage data={data} setData={setData} setConfirm={setConfirm} toastOk={toastOk} />}
            {tab === "settings" && (
              <SettingsPage
                data={data}
                setData={setData}
                updateSettings={updateSettings}
                updateTabs={updateTabs}
                setConfirm={setConfirm}
                toastOk={toastOk}
                ensureNotify={() => ensureNotificationPermission(toastOk, setData)}
                access={access}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile nav */}
      <div className="mobileNav glass">
        <div className="mobileNavInner">
          {tabMeta.slice(0, 6).map((t) => (
            <button key={t.key} className={"mbtn" + (tab === t.key ? " mbtnActive" : "")} onClick={() => guardAction(() => setTab(t.key))}>
              {t.icon ? <t.icon /> : null}
              <span>{appLabel(t.label)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {modal && !isRestricted && (
        <ModalShell title={modalTitle(modal.type)} onClose={() => setModal(null)}>
          {modal.type === "quickAdd" ? (
            <QuickAddGrid />
          ) : (
            <ModalContent
              modal={modal}
              data={data}
              setData={setData}
              setModal={setModal}
              toastOk={toastOk}
              ensureNotify={() => ensureNotificationPermission(toastOk, setData)}
            />
          )}
        </ModalShell>
      )}

      {/* Confirm */}
      {confirm && !isRestricted && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText || "Confirm"}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toastWrap">
          <div className="toast">{toast}</div>
        </div>
      )}
    </>
  );
}


