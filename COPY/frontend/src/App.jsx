import { useEffect, useMemo, useRef, useState } from "react";
import ClientsPage from "./tabs/Clients.jsx";
import TasksPage from "./tabs/Tasks.jsx";
import CalendarPage from "./tabs/Calendar.jsx";
import BudgetPage from "./tabs/Budget.jsx";
import GoalsPage from "./tabs/Goals.jsx";
import InvoicesPage from "./tabs/Invoices.jsx";
import SettingsPage from "./tabs/Settings.jsx";
import logo from "./assets/logo.svg";
import { useLanguage } from "./i18n/LanguageContext";
import NotepadPage from "./tabs/Notepad.jsx";
import LogoutButton from "./components/LogoutButton";

import {
  ConfirmModal,
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
  safeLoad,
  safeSave,
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

export default function App({ access = null }) {

  const { t } = useLanguage();
  const [data, setData] = useState(safeLoad);
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
  const showRestrictedState = isRestricted && tab !== "settings";

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
    safeSave(data);
  }, [data]);

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
          <span>{t("addClient")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openTasks}>
          <span style={iconWrap}>
            <IconCheck />
          </span>
          <span>{t("tasks")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openAddBudget}>
          <span style={iconWrap}>
            <IconWallet />
          </span>
          <span>{t("add budget entry")}</span>
        </button>

        <button className="btn" type="button" style={tileStyle} onClick={openGoals}>
          <span style={iconWrap}>
            <IconTarget />
          </span>
          <span>{t("goals")}</span>
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
      {tabItem.icon}
      <span style={{ fontSize: 13 }}>{t(tabItem.label)}</span>
    </div>
    <span style={{ color: "var(--muted)", fontSize: 12 }}>▶</span>
  </button>
))}
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
            <button
              className="btn btnPrimary"
              style={{
                flex: 1,
                background: "linear-gradient(135deg, rgba(201,53,114,0.24), rgba(122,31,128,0.20))",
                borderColor: "rgba(201,53,114,0.38)",
                color: "#fff",
              }}
              onClick={() => guardAction(() => setModal({ type: "quickAdd" }))}
            >
              + {t("add")}
            </button>
            <button className="iconBtn" onClick={() => guardAction(() => setTab("settings"), "settings")} title={t("settings")}>
              <IconSettings />
            </button>
          </div>
        </aside>

        <main className="main">
                    {!data.settings.todayStripDismissed && (todayInfo.dueRem > 0 || todayInfo.dueTasks > 0 || todayInfo.dueCalendar > 0) && (
            <div className="todayStrip">
              <div className="todayLeft">
                <strong>{t("common.today")}</strong>
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
                  {t("common.open")}
                </button>
                <button className="iconBtn" onClick={() => updateSettings({ todayStripDismissed: true })} title="Dismiss">
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="topbar">
            <div className="hgroup">
             <h2>{t(pageTitle)}</h2>
            </div>

            <div className="actions">
              {!showRestrictedState && tab === "clients" && (
                <>
                  <button className="btn" type="button" onClick={() => guardAction(() => clientsActionsRef.current?.openAddColumn?.())}>
                    + {t("addColumn")}
                  </button>

                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={() => guardAction(() => clientsActionsRef.current?.openAddClient?.())}
                    style={{ background: "rgba(201,53,114,0.22)", borderColor: "rgba(201,53,114,0.38)" }}
                  >
                    {t("addClient")}
                  </button>
                </>
              )}
              {tab !== "settings" && (
                showRestrictedState ? (
                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={() => setTab("settings")}
                    style={{
                      minWidth: 170,
                      background: "linear-gradient(135deg, rgba(201,53,114,0.22), rgba(122,31,128,0.18))",
                      borderColor: "rgba(201,53,114,0.38)",
                    }}
                  >
                    Open settings
                  </button>
                ) : (
                  <button className="iconBtn" onClick={() => guardAction(() => setTab("settings"), "settings")} title="Settings">
                    <IconSettings />
                  </button>
                )
              )}
            </div>
          </div>

          <div
            className="fadeIn"
            style={{
              position: "relative",
              minHeight: showRestrictedState ? "calc(100vh - 220px)" : undefined,
            }}
          >
            {showRestrictedState ? (
              <div
                style={{
                  minHeight: "calc(100vh - 220px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "18px 0 8px",
                }}
              >
                <div
                  className="glass"
                  style={{
                    position: "relative",
                    width: "min(720px, 100%)",
                    padding: 32,
                    borderRadius: 28,
                    overflow: "hidden",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 28px 90px rgba(0,0,0,0.28)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      background:
                        "radial-gradient(520px 220px at 18% 0%, rgba(105,168,255,0.14), transparent 60%), radial-gradient(520px 240px at 100% 0%, rgba(185,120,255,0.14), transparent 58%)",
                    }}
                  />

                  <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18 }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 22,
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid rgba(201,53,114,0.28)",
                        background:
                          "linear-gradient(135deg, rgba(201,53,114,0.20), rgba(122,31,128,0.14))",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        fontSize: 30,
                      }}
                    >
                      🔒
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "flex-start",
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.12)",
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

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
                      <h3 style={{ margin: 0, fontSize: 34, lineHeight: 1.02 }}>
                        Upgrade to restore full access
                      </h3>

                      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.75 }}>
                        Your workspace is safe, but CRM actions are locked until billing is resolved.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {[
                        "Clients and pipeline stay visible",
                        "Editing is locked until payment succeeds",
                        "Open settings to manage billing",
                      ].map((item) => (
                        <div
                          key={item}
                          style={{
                            padding: "14px 16px",
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--muted)",
                            lineHeight: 1.5,
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-start",
                        gap: 10,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn btnPrimary"
                        type="button"
                        onClick={() => setTab("settings")}
                        style={{
                          minWidth: 170,
                          background: "linear-gradient(135deg, rgba(201,53,114,0.22), rgba(122,31,128,0.18))",
                          borderColor: "rgba(201,53,114,0.38)",
                        }}
                      >
                        Open settings
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile nav */}
      <div className="mobileNav glass">
        <div className="mobileNavInner">
          {tabMeta.slice(0, 6).map((t) => (
            <button key={t.key} className={"mbtn" + (tab === t.key ? " mbtnActive" : "")} onClick={() => guardAction(() => setTab(t.key))}>
              {t.icon}
              <span>{t.label}</span>
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


