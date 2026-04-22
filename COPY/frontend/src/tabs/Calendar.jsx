import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { parseISO, todayISO } from "../shared/crmShared.jsx";

function uid() {
  return "id_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(date, days) {
  const x = new Date(date);
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateTime(dateISO, time = "00:00") {
  const t = isValidTime(time) ? time : "00:00";
  const d = new Date(`${dateISO}T${t}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidTime(v) {
  return /^\d{2}:\d{2}$/.test(String(v || ""));
}

function toMinutes(v) {
  if (!isValidTime(v)) return null;
  const [h, m] = v.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function fromMinutes(n) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Number(n) || 0));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  if (endTime) return `Until ${endTime}`;
  return "All day";
}

function normalizeWeekdayList(list) {
  const safe = Array.isArray(list) ? list : [];
  return [...new Set(safe.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
}

function withDefaultDuration(startTime, endTime) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) return { startTime, endTime };
  if (Number.isFinite(startMinutes)) return { startTime, endTime: fromMinutes(Math.min(23 * 60 + 59, startMinutes + 60)) };
  return { startTime: startTime || "09:00", endTime: endTime || "10:00" };
}

function estimateTaskDuration(priority) {
  if (priority === "High") return 60;
  if (priority === "Low") return 15;
  return 30;
}

function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const first = new Date(year, monthIndex, 1);
  const firstWeekday = first.getDay();
  const delta = (weekday - firstWeekday + 7) % 7;
  const day = 1 + delta + (Math.max(1, nth) - 1) * 7;
  const candidate = new Date(year, monthIndex, day);
  if (candidate.getMonth() !== monthIndex) return null;
  return candidate;
}

function getWeekdayOrdinal(dateObj) {
  return Math.floor((dateObj.getDate() - 1) / 7) + 1;
}

function getEventSpanMinutes(event) {
  const start = Number.isFinite(event?.startMinutes) ? event.startMinutes : 9 * 60;
  const end = Number.isFinite(event?.endMinutes) ? event.endMinutes : start + 60;
  return { start, end: Math.max(start + 15, end) };
}

function collectDayBusyBlocks(events, dateISO) {
  return events
    .filter((event) => event.dateISO === dateISO)
    .map((event) => getEventSpanMinutes(event))
    .sort((a, b) => a.start - b.start);
}

function mergeBusyBlocks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    if (!merged.length) {
      merged.push({ ...block });
      return;
    }
    const last = merged[merged.length - 1];
    if (block.start <= last.end) last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  });
  return merged;
}

function findFreeSlots(blocks, start = 8 * 60, end = 18 * 60) {
  const merged = mergeBusyBlocks(blocks);
  const slots = [];
  let cursor = start;
  merged.forEach((block) => {
    if (block.start > cursor) slots.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  });
  if (cursor < end) slots.push({ start: cursor, end });
  return slots;
}

function addActivityLog(item, text) {
  return [{ id: uid(), text, createdAt: Date.now() }, ...(Array.isArray(item?.activity) ? item.activity : [])];
}

function buildNotificationItems(events, now = new Date()) {
  const currentTs = now.getTime();
  return events
    .filter((event) => {
      const start = parseDateTime(event.dateISO, event.startTime || "09:00");
      return start && start.getTime() >= currentTs - 60 * 60 * 1000;
    })
    .map((event) => ({
      id: event.id,
      title: event.title,
      dateISO: event.dateISO,
      timeLabel: event.timeLabel,
      type: event.type,
      event,
      whenTs: parseDateTime(event.dateISO, event.startTime || "09:00")?.getTime() || 0,
    }))
    .sort((a, b) => a.whenTs - b.whenTs)
    .slice(0, 12);
}

function getTimelineGroupLabel(event) {
  if (event.calendarLabel) return event.calendarLabel;
  return event.breadcrumb || "Other";
}

function isDirectlyDeletableEvent(event) {
  return ["custom", "task", "reminder"].includes(String(event?.type || ""));
}

function planTasksIntoDay({ tasks, dateISO, existingEvents, existingCalendarEvents }) {
  const candidates = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => !task?.done)
    .filter((task) => !task?.linkedTaskId)
    .filter((task) => !existingCalendarEvents.some((item) => item?.linkedTaskId === task.id && item?.date === dateISO))
    .filter((task) => !task?.due || task.due <= dateISO)
    .sort((a, b) => {
      const pa = { High: 0, Medium: 1, Low: 2 }[a?.priority] ?? 1;
      const pb = { High: 0, Medium: 1, Low: 2 }[b?.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return String(a?.title || a?.text || "").localeCompare(String(b?.title || b?.text || ""));
    });
  const busyBlocks = collectDayBusyBlocks(existingEvents, dateISO);
  const slots = findFreeSlots(busyBlocks);
  const planned = [];
  let slotIndex = 0;
  let slotOffset = 0;
  candidates.forEach((task) => {
    const duration = estimateTaskDuration(task?.priority);
    while (slotIndex < slots.length) {
      const slot = slots[slotIndex];
      const start = slot.start + slotOffset;
      if (start + duration <= slot.end) {
        planned.push(normalizeCustomEvent({
          title: task.title || task.text || "Planned task",
          date: dateISO,
          startTime: fromMinutes(start),
          endTime: fromMinutes(start + duration),
          notes: task.notes || "",
          linkedClientId: task.clientId || "",
          autoPlanned: true,
          linkedTaskId: task.id,
          calendarId: task.clientId ? "client" : "work",
          ownerName: DEFAULT_OWNER_NAME,
          comments: [],
          activity: [{ id: uid(), text: "Auto-planned", createdAt: Date.now() }],
          recurrence: { mode: "none", interval: 1, until: "", daysOfWeek: [], exceptions: [] },
          tags: ["auto-planned"],
        }));
        slotOffset += duration;
        if (slot.start + slotOffset + 15 > slot.end) {
          slotIndex += 1;
          slotOffset = 0;
        }
        return;
      }
      slotIndex += 1;
      slotOffset = 0;
    }
  });
  return planned.filter(Boolean);
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  let day = 1 - startOffset;
  for (let i = 0; i < 42; i += 1) {
    cells.push(new Date(year, month, day));
    day += 1;
  }
  return cells;
}

function weekDays(date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function dayHours() {
  return Array.from({ length: 24 }, (_, i) => `${pad2(i)}:00`);
}

function monthLabel(year, month) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

function ensureCalendarStyles() {
  const id = "crm-calendar-pro-styles-v2";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes calFadeIn { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes calGhostPulse { from { transform: translate(-50%, -50%) scale(.985); } to { transform: translate(-50%, -50%) scale(1.02); } }
    @keyframes calShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .calGlass {
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.04));
      border: 1px solid rgba(255,255,255,.10);
      box-shadow: 0 18px 40px rgba(0,0,0,.16);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }
    .calGlassStrong {
      background: rgba(6,9,16,.84);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 28px 90px rgba(0,0,0,.52);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
    }
    .calButtonGlow:hover { box-shadow: 0 0 0 1px rgba(255,255,255,.10), 0 16px 30px rgba(201,53,114,.14); }
    .calScrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
    .calScrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 999px; }
    .calScrollbar::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const SNOOZE_OPTIONS = [5, 10, 15, 30, 60];
const RECUR_OPTIONS = ["none", "daily", "weekly", "weekdays", "custom_weekly", "monthly"]
const CALENDAR_OPTIONS = [
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "client", label: "Client" },
];
const DEFAULT_OWNER_NAME = "You";
const DENSITY_OPTIONS = ["comfortable", "compact"];
const TIMELINE_GROUP_OPTIONS = ["calendar", "source", "client"];
const TIMELINE_ZOOM_OPTIONS = [7, 14, 30];
const SOURCE_COLORS = {
  task: { dot: "#60a5fa", tint: "linear-gradient(135deg, rgba(59,130,246,.22), rgba(37,99,235,.14))", border: "rgba(96,165,250,.36)", glow: "0 10px 24px rgba(37,99,235,.18)" },
  invoice: { dot: "#34d399", tint: "linear-gradient(135deg, rgba(16,185,129,.22), rgba(5,150,105,.14))", border: "rgba(52,211,153,.36)", glow: "0 10px 24px rgba(5,150,105,.18)" },
  invoice_due: { dot: "#f87171", tint: "linear-gradient(135deg, rgba(239,68,68,.22), rgba(220,38,38,.14))", border: "rgba(248,113,113,.36)", glow: "0 10px 24px rgba(220,38,38,.18)" },
  reminder: { dot: "#fbbf24", tint: "linear-gradient(135deg, rgba(245,158,11,.22), rgba(217,119,6,.14))", border: "rgba(251,191,36,.36)", glow: "0 10px 24px rgba(217,119,6,.18)" },
  custom: { dot: "#c4b5fd", tint: "linear-gradient(135deg, rgba(168,85,247,.22), rgba(126,34,206,.14))", border: "rgba(196,181,253,.36)", glow: "0 10px 24px rgba(126,34,206,.18)" },
};

function titleCaseWord(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function hexToRgbParts(hex) {
  const raw = String(hex || "").replace("#", "").trim();
  if (raw.length !== 6) return null;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function rgbaFromHex(hex, alpha) {
  const rgb = hexToRgbParts(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function buildSourceColor(dot, fallback) {
  const safeDot = hexToRgbParts(dot) ? dot : fallback.dot;
  return {
    dot: safeDot,
    tint: `linear-gradient(135deg, ${rgbaFromHex(safeDot, 0.22)}, ${rgbaFromHex(safeDot, 0.12)})`,
    border: rgbaFromHex(safeDot, 0.36),
    glow: `0 10px 24px ${rgbaFromHex(safeDot, 0.18)}`,
  };
}

function getSourceColors(data) {
  const overrides = data?.settings?.calendarSourceColors || {};
  const next = {};
  Object.keys(SOURCE_COLORS).forEach((key) => {
    next[key] = buildSourceColor(overrides[key] || SOURCE_COLORS[key].dot, SOURCE_COLORS[key]);
  });
  return next;
}

function sortEvents(list) {
  return [...list].sort((a, b) => {
    if (a.dayTs !== b.dayTs) return a.dayTs - b.dayTs;
    const aStart = Number.isFinite(a.startMinutes) ? a.startMinutes : Infinity;
    const bStart = Number.isFinite(b.startMinutes) ? b.startMinutes : Infinity;
    if (aStart !== bStart) return aStart - bStart;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

function normalizeComment(comment) {
  return {
    id: comment?.id || uid(),
    text: String(comment?.text || "").trim(),
    createdAt: Number(comment?.createdAt) || Date.now(),
  };
}

function normalizeActivityItem(item) {
  return {
    id: item?.id || uid(),
    text: String(item?.text || "").trim(),
    createdAt: Number(item?.createdAt) || Date.now(),
  };
}

function normalizeCustomEvent(raw) {
  const title = String(raw?.title || "").trim();
  const date = String(raw?.date || "").trim();
  if (!title || !parseISO(date)) return null;
  const startTime = isValidTime(raw?.startTime) ? raw.startTime : "";
  const endTime = isValidTime(raw?.endTime) ? raw.endTime : "";
  const rec = raw?.recurrence || { mode: "none", interval: 1, until: "", daysOfWeek: [], exceptions: [] };
  const normalizedTime = withDefaultDuration(startTime, endTime);
  return {
    id: raw?.id || uid(),
    title,
    date,
    startTime: normalizedTime.startTime,
    endTime: normalizedTime.endTime,
    notes: String(raw?.notes || "").trim(),
    linkedClientId: raw?.linkedClientId || "",
    linkedTaskId: raw?.linkedTaskId || "",
    autoPlanned: Boolean(raw?.autoPlanned),
    calendarId: ["personal", "work", "client"].includes(raw?.calendarId) ? raw.calendarId : "work",
    ownerName: String(raw?.ownerName || DEFAULT_OWNER_NAME).trim() || DEFAULT_OWNER_NAME,
    templateKey: String(raw?.templateKey || "").trim(),
    recurrence: {
      mode: RECUR_OPTIONS.includes(rec?.mode) ? rec.mode : "none",
      interval: Math.max(1, Number(rec?.interval) || 1),
      until: String(rec?.until || ""),
      daysOfWeek: normalizeWeekdayList((rec?.daysOfWeek && rec.daysOfWeek.length ? rec.daysOfWeek : [parseISO(date)?.getDay?.() ?? 1])),
      exceptions: Array.isArray(rec?.exceptions) ? rec.exceptions.map((x) => String(x || "").trim()).filter((x) => parseISO(x)) : [],
      monthlyMode: rec?.monthlyMode === "weekday" ? "weekday" : "date",
      monthlyWeek: Math.max(1, Math.min(5, Number(rec?.monthlyWeek) || 1)),
      monthlyWeekday: Number.isInteger(Number(rec?.monthlyWeekday)) ? Number(rec?.monthlyWeekday) : (parseISO(date)?.getDay?.() ?? 1),
    },
    comments: Array.isArray(raw?.comments) ? raw.comments.map(normalizeComment).filter((x) => x.text) : [],
    activity: Array.isArray(raw?.activity) ? raw.activity.map(normalizeActivityItem).filter((x) => x.text) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
  };
}

function sanitizeImportedEvent(raw) {
  return normalizeCustomEvent({
    ...raw,
    type: "custom",
    title: raw?.title || "Untitled event",
    date: raw?.date || todayISO(),
  });
}

function parseImportedEventsFromText(text) {
  const rawText = String(text || "").trim();
  if (!rawText) return { ok: false, error: "Paste JSON to import." };
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Invalid JSON format." };
  }
  const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.calendarEvents) ? parsed.calendarEvents : null;
  if (!source) return { ok: false, error: 'JSON must be an array of events or an object with a "calendarEvents" array.' };
  const events = [];
  let skipped = 0;
  source.forEach((item) => {
    const safe = sanitizeImportedEvent(item);
    if (safe) events.push(safe);
    else skipped += 1;
  });
  if (!events.length) return { ok: false, error: "No valid events found in the provided JSON." };
  return { ok: true, events, skipped };
}

function parseQuickInput(text) {
  const lower = String(text || "").toLowerCase();
  let date = todayISO();
  if (lower.includes("tomorrow")) date = formatDateISO(addDays(new Date(), 1));
  const timeMatch = lower.match(/(\d{1,2})(:\d{2})?\s?(am|pm)?/);
  let startTime = "";
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minutes = timeMatch[2] || ":00";
    if (timeMatch[3] === "pm" && hour < 12) hour += 12;
    if (timeMatch[3] === "am" && hour === 12) hour = 0;
    startTime = `${pad2(hour)}${minutes}`;
  }
  return normalizeCustomEvent({ title: text, date, startTime, notes: "", recurrence: { mode: "none", interval: 1, until: "" } });
}

function expandRecurringEvent(event, rangeStart, rangeEnd) {
  const normalized = normalizeCustomEvent(event);
  if (!normalized) return [];
  const mode = normalized.recurrence?.mode || "none";
  const interval = Math.max(1, Number(normalized.recurrence?.interval) || 1);
  const until = normalized.recurrence?.until ? parseISO(normalized.recurrence.until) : null;
  const base = parseISO(normalized.date);
  if (!base) return [];
  const exceptions = new Set(normalized.recurrence?.exceptions || []);
  const out = [];

  const pushOccurrence = (dateObj, idx) => {
    const iso = formatDateISO(dateObj);
    if (exceptions.has(iso)) return;
    if (dateObj < startOfDay(rangeStart) || dateObj > endOfDay(rangeEnd)) return;
    out.push({
      ...normalized,
      occurrenceId: `${normalized.id}_${iso}_${idx}`,
      occurrenceDateISO: iso,
      sourceId: normalized.id,
      type: "custom",
      raw: normalized,
    });
  };

  if (mode === "none") {
    pushOccurrence(base, 0);
    return out;
  }

  if (mode === "weekdays") {
    let cursor = new Date(base);
    let guard = 0;
    while (cursor <= rangeEnd && guard < 700) {
      const jsDay = cursor.getDay();
      if (jsDay >= 1 && jsDay <= 5 && (!until || cursor <= endOfDay(until))) pushOccurrence(cursor, guard);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return out;
  }

  if (mode === "custom_weekly") {
    const daysOfWeek = normalizeWeekdayList(normalized.recurrence?.daysOfWeek);
    let cursor = startOfDay(rangeStart > base ? rangeStart : base);
    let guard = 0;
    while (cursor <= rangeEnd && guard < 900) {
      const daysSinceBase = Math.floor((startOfDay(cursor).getTime() - startOfDay(base).getTime()) / 86400000);
      const weekDiff = Math.floor(daysSinceBase / 7);
      if (weekDiff >= 0 && weekDiff % interval === 0 && daysOfWeek.includes(cursor.getDay()) && (!until || cursor <= endOfDay(until))) pushOccurrence(cursor, guard);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return out;
  }

  if (mode === "monthly" && normalized.recurrence?.monthlyMode === "weekday") {
    let cursor = new Date(base.getFullYear(), base.getMonth(), 1);
    let guard = 0;
    while (cursor <= rangeEnd && guard < 240) {
      const candidate = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), normalized.recurrence?.monthlyWeekday ?? base.getDay(), normalized.recurrence?.monthlyWeek ?? getWeekdayOrdinal(base));
      if (candidate && candidate >= startOfDay(base) && (!until || candidate <= endOfDay(until))) pushOccurrence(candidate, guard);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, 1);
      guard += 1;
    }
    return out;
  }

  let cursor = new Date(base);
  let guard = 0;
  while (cursor <= rangeEnd && guard < 500) {
    if (!until || cursor <= endOfDay(until)) pushOccurrence(cursor, guard);
    if (mode === "daily") cursor = addDays(cursor, interval);
    else if (mode === "weekly") cursor = addDays(cursor, 7 * interval);
    else if (mode === "monthly") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, cursor.getDate());
    else break;
    guard += 1;
  }
  return out;
}

function eventBreadcrumb(event, data) {
  if (event.type === "task") {
    const client = (data.clients || []).find((c) => c.id === event.raw?.clientId);
    return client ? `Task / ${client.name}` : "Task";
  }
  if (event.type === "invoice" || event.type === "invoice_due") {
    return `Invoice / ${event.raw?.number || "#"}`;
  }
  if (event.type === "reminder") return "Reminder";
  if (event.linkedClientName) return `Event / ${event.linkedClientName}`;
  return "Event";
}

function buildEvents(data, filters, search, rangeStart, rangeEnd) {
  const query = String(search || "").trim().toLowerCase();
  const out = [];

  if (filters.tasks) {
    (data.tasks || []).forEach((t) => {
      const d = parseISO(t.due);
      if (!d || d < startOfDay(rangeStart) || d > endOfDay(rangeEnd)) return;
      const title = t.title || t.text || "Task";
      out.push({
        id: `task_${t.id}`,
        sourceId: t.id,
        type: "task",
        title,
        date: d,
        dateISO: t.due,
        startTime: "",
        endTime: "",
        notes: t.notes || "",
        linkedId: t.id,
        raw: t,
      });
    });
  }

  if (filters.invoices) {
    (data.invoices || []).forEach((inv) => {
      const issue = inv.issueDate ? parseISO(inv.issueDate) : null;
      const due = inv.dueDate ? parseISO(inv.dueDate) : null;
      if (issue && issue >= startOfDay(rangeStart) && issue <= endOfDay(rangeEnd)) {
        out.push({
          id: `${inv.id}_issue`,
          sourceId: inv.id,
          type: "invoice",
          title: `Invoice ${inv.number} issued`,
          date: issue,
          dateISO: inv.issueDate,
          startTime: "",
          endTime: "",
          notes: inv.reference || "",
          linkedId: inv.id,
          raw: inv,
        });
      }
      if (due && due >= startOfDay(rangeStart) && due <= endOfDay(rangeEnd)) {
        out.push({
          id: `${inv.id}_due`,
          sourceId: inv.id,
          type: "invoice_due",
          title: `Invoice ${inv.number} due`,
          date: due,
          dateISO: inv.dueDate,
          startTime: "",
          endTime: "",
          notes: inv.reference || "",
          linkedId: inv.id,
          raw: inv,
        });
      }
    });
  }

  if (filters.custom) {
    (data.calendarEvents || []).forEach((item) => {
      const occurrences = expandRecurringEvent(item, rangeStart, rangeEnd);
      occurrences.forEach((occ) => {
        const client = (data.clients || []).find((c) => c.id === occ.linkedClientId);
        out.push({
          ...occ,
          id: occ.occurrenceId,
          title: occ.title,
          date: parseISO(occ.occurrenceDateISO),
          dateISO: occ.occurrenceDateISO,
          startTime: occ.startTime || "",
          endTime: occ.endTime || "",
          notes: occ.notes || "",
          linkedId: occ.sourceId,
          linkedClientName: client?.name || "",
          calendarId: occ.calendarId || (client ? "client" : "work"),
          calendarLabel: CALENDAR_OPTIONS.find((option) => option.value === (occ.calendarId || (client ? "client" : "work")))?.label || "Work",
          ownerName: occ.ownerName || DEFAULT_OWNER_NAME,
          autoPlanned: Boolean(occ.autoPlanned),
          linkedTaskId: occ.linkedTaskId || "",
        });
      });
    });
  }

  if (filters.reminders) {
    (data.reminders || []).forEach((r) => {
      if (!Number.isFinite(r?.whenTs)) return;
      const d = new Date(r.whenTs);
      if (Number.isNaN(d.getTime()) || d < startOfDay(rangeStart) || d > endOfDay(rangeEnd)) return;
      out.push({
        id: `rem_${r.id}`,
        sourceId: r.id,
        type: "reminder",
        title: r.title || "Reminder",
        date: d,
        dateISO: formatDateISO(d),
        startTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
        endTime: "",
        notes: r.type || "",
        linkedId: r.id,
        raw: r,
      });
    });
  }

  const filtered = query
    ? out.filter((e) => `${e.title || ""} ${e.notes || ""} ${eventBreadcrumb(e, data)}`.toLowerCase().includes(query))
    : out;

  return sortEvents(
    filtered.map((event) => ({
      ...event,
      dayTs: startOfDay(event.date).getTime(),
      startMinutes: toMinutes(event.startTime),
      endMinutes: toMinutes(event.endTime),
      timeLabel: formatTimeRange(event.startTime, event.endTime),
      breadcrumb: eventBreadcrumb(event, data),
    }))
  );
}

function usePopover() {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 260 });

  const computePos = useCallback((width = 260, align = "left") => {
    const anchor = btnRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const pad = 12;
    const finalW = Math.min(width, window.innerWidth - pad * 2);
    const leftRaw = align === "right" ? r.right - finalW : r.left;
    const left = Math.max(pad, Math.min(window.innerWidth - finalW - pad, leftRaw));
    const popH = Math.max(120, Math.min(420, Math.round(popRef.current?.getBoundingClientRect?.().height || 280)));
    const below = r.bottom + 10;
    const above = r.top - popH - 10;
    const top = below + popH <= window.innerHeight - pad ? below : Math.max(pad, above);
    setPos({ left, top, width: finalW });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    const raf = requestAnimationFrame(() => computePos());
    const onRelayout = () => computePos();
    window.addEventListener("resize", onRelayout);
    window.addEventListener("scroll", onRelayout, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onRelayout);
      window.removeEventListener("scroll", onRelayout, true);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return { btnRef, popRef, open, setOpen, pos, computePos };
}

function PortalCard({ pos, popRef, width, children }) {
  return createPortal(
    <div
      ref={popRef}
      className="calGlassStrong calScrollbar"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: width || pos.width,
        zIndex: 99999,
        padding: 8,
        borderRadius: 18,
        animation: "calFadeIn 180ms ease-out",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

function ModalShell({ children, onClose }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,5,10,.7)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 99998,
        animation: "calFadeIn 180ms ease-out",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}

function BaseModal({ title, onClose, width = 520, children, footer }) {
  return (
    <ModalShell onClose={onClose}>
      <div
        className="calGlassStrong"
        style={{
          width,
          maxWidth: "calc(100vw - 32px)",
          borderRadius: 22,
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>{title}</strong>
          <button className="btn calButtonGlow" onClick={onClose}>Close</button>
        </div>
        {children}
        {footer ? <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div> : null}
      </div>
    </ModalShell>
  );
}

function FancySelect({ value, options, onChange, width = 180, placeholder = "Select" }) {
  const { btnRef, popRef, open, setOpen, pos, computePos } = usePopover();
  const selected = options.find((o) => o.value === value) || null;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn calButtonGlow"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => computePos(width), 0);
        }}
        style={{
          minWidth: width,
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04))",
          borderColor: "rgba(255,255,255,.12)",
          boxShadow: "0 10px 24px rgba(0,0,0,.16)",
        }}
      >
        <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected?.label || placeholder}</span>
        <span style={{ opacity: .76 }}>▾</span>
      </button>
      {open && (
        <PortalCard pos={pos} popRef={popRef} width={width}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 12,
                  background: active ? "rgba(255,255,255,.10)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 700,
                  textAlign: "left",
                }}
              >
                <span>{opt.label}</span>
                <span style={{ opacity: active ? 1 : .18 }}>{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </PortalCard>
      )}
    </>
  );
}

function DayMiniPicker({ value, onChange }) {
  const date = parseISO(value) || new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = monthMatrix(year, month);
  return (
    <div className="calGlass" style={{ borderRadius: 18, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{monthLabel(year, month)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((d) => <div key={d} style={{ fontSize: 10, opacity: .6 }}>{d[0]}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {days.map((d, i) => {
          const iso = formatDateISO(d);
          const active = iso === value;
          const outside = d.getMonth() !== month;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(iso)}
              style={{
                border: "none",
                borderRadius: 10,
                minHeight: 30,
                background: active ? "rgba(201,53,114,.18)" : outside ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.04)",
                color: outside ? "rgba(255,255,255,.52)" : "var(--text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({ event, onOpen, onDragStart, onDelete, compact = false, sourceColors = SOURCE_COLORS }) {
  const c = sourceColors[event.type] || sourceColors.custom || SOURCE_COLORS.custom;
  const deletable = isDirectlyDeletableEvent(event) && typeof onDelete === "function";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onDragStart(e, event);
      }}
      style={{
        width: "100%",
        textAlign: "left",
        marginTop: compact ? 4 : 6,
        padding: compact ? "6px 8px" : "8px 9px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        background: c.tint,
        boxShadow: c.glow,
        cursor: "grab",
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `${c.glow}, 0 14px 28px rgba(0,0,0,.16)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = c.glow;
      }}
      title={event.timeLabel ? `${event.title} (${event.timeLabel})` : event.title}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: c.dot, flex: "0 0 auto", marginTop: 4 }} />
        <span style={{ flex: 1, fontSize: compact ? 10 : 11, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
          {event.title}
        </span>
        {deletable ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(event);
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title={`Delete ${event.type}`}
            aria-label={`Delete ${event.type}`}
            style={{
              width: compact ? 22 : 24,
              height: compact ? 22 : 24,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(0,0,0,.18)",
              color: "var(--text)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flex: "0 0 auto",
              marginTop: compact ? -1 : -2,
            }}
          >
            <IconTrashMinimal size={compact ? 12 : 13} />
          </button>
        ) : null}
      </div>
      {!compact ? (
        <>
          <div style={{ marginTop: 4, fontSize: 10, opacity: .72, paddingLeft: 16 }}>{event.timeLabel}</div>
          <div style={{ marginTop: 3, fontSize: 10, opacity: .55, paddingLeft: 16 }}>{event.breadcrumb}</div>
        </>
      ) : null}
    </button>
  );
}

const MonthCell = memo(function MonthCell({ date, activeMonth, events, isToday, isDropTarget, onOpenMenu, onOpenEvent, onDeleteEvent, onDragStart, sourceColors = SOURCE_COLORS }) {
  const outside = date.getMonth() !== activeMonth;
  return (
    <div
      data-calendar-day={formatDateISO(date)}
      onClick={(e) => onOpenMenu(date, e.currentTarget)}
      style={{
        minHeight: 136,
        padding: 8,
        borderRadius: 18,
        border: isDropTarget ? "1px solid rgba(201,53,114,.48)" : isToday ? "1px solid rgba(108,99,255,.42)" : "1px solid rgba(255,255,255,.08)",
        background: outside
          ? "linear-gradient(180deg, rgba(0,0,0,.34), rgba(0,0,0,.22))"
          : isToday
            ? "linear-gradient(180deg, rgba(108,99,255,.18), rgba(108,99,255,.08))"
            : "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
        boxShadow: isDropTarget ? "0 18px 40px rgba(201,53,114,.14)" : "0 14px 28px rgba(0,0,0,.12)",
        cursor: "pointer",
        opacity: outside ? .70 : 1,
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = isDropTarget ? "0 22px 50px rgba(201,53,114,.16)" : "0 18px 34px rgba(0,0,0,.16)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isDropTarget ? "0 18px 40px rgba(201,53,114,.14)" : "0 14px 28px rgba(0,0,0,.12)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: outside ? "rgba(255,255,255,.52)" : "var(--text)" }}>{date.getDate()}</span>
        {events.length ? <span style={{ fontSize: 10, opacity: .66, padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,.06)" }}>{events.length}</span> : null}
      </div>
      {events.slice(0, 4).map((event) => (
        <EventChip key={event.id} event={event} onOpen={onOpenEvent} onDelete={onDeleteEvent} onDragStart={onDragStart} compact sourceColors={sourceColors} />
      ))}
      {events.length > 4 ? <div style={{ marginTop: 6, fontSize: 10, opacity: .65 }}>+{events.length - 4} more</div> : null}
    </div>
  );
});

function AgendaGroup({ title, items, onOpenEvent, onDeleteEvent, onDragStart, sourceColors = SOURCE_COLORS }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 900, opacity: .7, letterSpacing: .4 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} className="calGlass" style={{ borderRadius: 18, padding: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 88 }}>
                <div style={{ fontSize: 11, fontWeight: 900 }}>{item.dateISO}</div>
                <div style={{ fontSize: 10, opacity: .66, marginTop: 4 }}>{item.timeLabel}</div>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <EventChip event={item} onOpen={onOpenEvent} onDelete={onDeleteEvent} onDragStart={onDragStart} sourceColors={sourceColors} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DragGhost({ dragState, sourceColors = SOURCE_COLORS }) {
  if (!dragState?.pointer || !dragState?.event) return null;
  const c = sourceColors[dragState.event.type] || sourceColors.custom || SOURCE_COLORS.custom;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: dragState.pointer.x,
        top: dragState.pointer.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 100000,
        minWidth: 190,
        maxWidth: 260,
        padding: "10px 12px",
        borderRadius: 15,
        border: `1px solid ${c.border}`,
        background: c.tint,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: `${c.glow}, 0 22px 46px rgba(0,0,0,.24)`,
        animation: "calGhostPulse 120ms ease-out infinite alternate",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: c.dot, flex: "0 0 auto" }} />
        <strong style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dragState.event.title}</strong>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, opacity: .76 }}>{dragState.event.timeLabel}</div>
      {dragState.overDate ? <div style={{ marginTop: 5, fontSize: 10, opacity: .62 }}>Drop on {dragState.overDate}</div> : null}
    </div>,
    document.body
  );
}

function CommandPalette({ onClose, onAction }) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const all = [
      { key: "new_event", label: "Create new event" },
      { key: "new_task", label: "Create new task" },
      { key: "new_reminder", label: "Create new reminder" },
      { key: "plan_day", label: "Plan my day" },
      { key: "optimize_day", label: "Optimize planned day" },
      { key: "undo_plan", label: "Undo last smart scheduling" },
      { key: "open_notifications", label: "Open notification center" },
      { key: "toggle_focus", label: "Toggle focus mode" },
      { key: "toggle_density", label: "Toggle compact density" },
      { key: "goto_today", label: "Go to today" },
      { key: "view_month", label: "Switch to month view" },
      { key: "view_week", label: "Switch to week view" },
      { key: "view_day", label: "Switch to day view" },
      { key: "view_agenda", label: "Switch to agenda view" },
      { key: "view_timeline", label: "Switch to timeline view" },
      { key: "timeline_zoom_7", label: "Timeline zoom 7 days" },
      { key: "timeline_zoom_14", label: "Timeline zoom 14 days" },
      { key: "timeline_zoom_30", label: "Timeline zoom 30 days" },
    ];
    const query = q.trim().toLowerCase();
    return query ? all.filter((item) => item.label.toLowerCase().includes(query)) : all;
  }, [q]);

  return (
    <BaseModal title="Command palette" onClose={onClose} width={560}>
      <input autoFocus className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command..." />
      <div className="calScrollbar" style={{ display: "grid", gap: 6, maxHeight: 360, overflow: "auto" }}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onAction(item.key);
              onClose();
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "none",
              borderRadius: 14,
              background: "rgba(255,255,255,.05)",
              color: "var(--text)",
              textAlign: "left",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </BaseModal>
  );
}

function ImportModal({ fileInputRef, onClose, onImport }) {
  const [mode, setMode] = useState("merge");
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  function apply(text) {
    const parsed = parseImportedEventsFromText(text);
    if (!parsed.ok) {
      setPreview(null);
      setError(parsed.error || "Import failed.");
      return;
    }
    setError("");
    setPreview(parsed);
  }

  return (
    <BaseModal
      title="Import Calendar Events"
      onClose={onClose}
      width={620}
      footer={(
        <>
          <button className="btn calButtonGlow" onClick={onClose}>Cancel</button>
          <button
            className="btn calButtonGlow"
            onClick={() => {
              if (!preview?.events?.length) {
                apply(paste);
                return;
              }
              onImport(preview.events, mode, preview.skipped || 0);
            }}
          >
            Import events
          </button>
        </>
      )}
    >
      <div className="calGlass" style={{ borderRadius: 16, padding: 12, fontSize: 12, lineHeight: 1.55 }}>
        Import custom events from JSON. Accepted: array of events or object with <code>calendarEvents</code>.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn calButtonGlow" onClick={() => fileInputRef.current?.click()}>Upload JSON file</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            setPaste(text);
            apply(text);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <FancySelect
          value={mode}
          options={[{ value: "merge", label: "Merge" }, { value: "replace", label: "Replace" }]}
          onChange={setMode}
          width={130}
        />
      </div>
      <textarea
        className="input"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder='Paste JSON here, e.g. [{"title":"Demo","date":"2026-04-01","startTime":"09:00"}]'
        style={{ minHeight: 220, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      />
      {error ? <div style={{ fontSize: 12, fontWeight: 800, color: "#fca5a5" }}>{error}</div> : null}
      {preview?.events?.length ? (
        <div className="calGlass" style={{ borderRadius: 16, padding: 12, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{preview.events.length} event(s), {preview.skipped || 0} skipped</div>
          <div style={{ fontSize: 12, opacity: .78 }}>First: {preview.events[0].title} on {preview.events[0].date}</div>
        </div>
      ) : null}
    </BaseModal>
  );
}

function EventModal({ data, initial, onClose, onSave, onDelete, onSaveComment, onSnooze }) {
  const normalized = useMemo(() => {
    const defaults = {
      id: initial?.id || "",
      title: initial?.title || "",
      date: initial?.date || todayISO(),
      startTime: initial?.startTime || "09:00",
      endTime: initial?.endTime || "10:00",
      notes: initial?.notes || "",
      linkedClientId: initial?.linkedClientId || "",
      linkedTaskId: initial?.linkedTaskId || "",
      autoPlanned: Boolean(initial?.autoPlanned),
      calendarId: initial?.calendarId || "work",
      ownerName: initial?.ownerName || DEFAULT_OWNER_NAME,
      recurrence: {
        mode: initial?.recurrence?.mode || "none",
        interval: Math.max(1, Number(initial?.recurrence?.interval) || 1),
        until: initial?.recurrence?.until || "",
        daysOfWeek: Array.isArray(initial?.recurrence?.daysOfWeek) ? initial.recurrence.daysOfWeek : [],
        exceptions: Array.isArray(initial?.recurrence?.exceptions) ? initial.recurrence.exceptions : [],
        monthlyMode: initial?.recurrence?.monthlyMode || "date",
        monthlyWeek: Math.max(1, Math.min(5, Number(initial?.recurrence?.monthlyWeek) || 1)),
        monthlyWeekday: Number.isInteger(Number(initial?.recurrence?.monthlyWeekday)) ? Number(initial.recurrence.monthlyWeekday) : 1,
      },
      comments: Array.isArray(initial?.comments) ? initial.comments.map(normalizeComment).filter((x) => x.text) : [],
      activity: Array.isArray(initial?.activity) ? initial.activity.map(normalizeActivityItem).filter((x) => x.text) : [],
      tags: Array.isArray(initial?.tags) ? initial.tags.map((x) => String(x).trim()).filter(Boolean) : [],
      templateKey: String(initial?.templateKey || "").trim(),
    };
    return defaults;
  }, [initial]);
  const [state, setState] = useState(normalized);
  const [commentText, setCommentText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const clients = Array.isArray(data.clients) ? data.clients : [];
  const templates = useMemo(() => [
    { key: "focus", label: "Focus block", patch: { title: "Focus block", startTime: "09:00", endTime: "10:30", calendarId: "work", tags: ["focus"] } },
    { key: "meeting", label: "Client meeting", patch: { title: "Client meeting", startTime: "11:00", endTime: "12:00", calendarId: "client", tags: ["meeting"] } },
    { key: "admin", label: "Admin time", patch: { title: "Admin time", startTime: "16:00", endTime: "16:30", calendarId: "work", tags: ["admin"] } },
  ], []);
  const canSave = Boolean(state?.title?.trim() && parseISO(state?.date));
  const selectedCalendarLabel = CALENDAR_OPTIONS.find((option) => option.value === state.calendarId)?.label || "Work";

  if (!state) return null;

  return (
    <BaseModal
      title={state.id && initial ? "Edit event" : "Add event"}
      onClose={onClose}
      width={920}
      footer={(
        <>
          {state.id && initial ? <button className="btn calButtonGlow" onClick={() => { onDelete(state.id); onClose(); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><IconTrashMinimal size={14} /><span>Delete</span></span></button> : null}
          <button className="btn calButtonGlow" onClick={onClose}>Cancel</button>
          <button className="btn calButtonGlow" disabled={!canSave} onClick={() => { if (!canSave) return; onSave(state); onClose(); }}>Save</button>
        </>
      )}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input className="input" placeholder="Event title" value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} />
            <FancySelect value={state.calendarId} options={CALENDAR_OPTIONS} onChange={(val) => setState((p) => ({ ...p, calendarId: val }))} width={150} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input type="date" className="input" value={state.date} onChange={(e) => setState((p) => ({ ...p, date: e.target.value }))} />
            <input type="time" className="input" value={state.startTime || ""} onChange={(e) => setState((p) => ({ ...p, startTime: e.target.value }))} />
            <input type="time" className="input" value={state.endTime || ""} onChange={(e) => setState((p) => ({ ...p, endTime: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <FancySelect value={state.recurrence.mode} options={RECUR_OPTIONS.map((x) => ({ value: x, label: x === "none" ? "No repeat" : x === "custom_weekly" ? "Custom weekly" : x === "weekdays" ? "Weekdays" : x[0].toUpperCase() + x.slice(1) }))} onChange={(val) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, mode: val } }))} width={170} />
            <input className="input" type="number" min="1" value={state.recurrence.interval} onChange={(e) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, interval: Math.max(1, Number(e.target.value) || 1) } }))} />
            <input className="input" type="date" value={state.recurrence.until || ""} onChange={(e) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, until: e.target.value } }))} />
          </div>
          {(state.recurrence.mode === "custom_weekly" || state.recurrence.mode === "weekly") ? (
            <div className="calGlass" style={{ borderRadius: 16, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>Weekly pattern</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[0,1,2,3,4,5,6].map((day) => {
                  const active = (state.recurrence.daysOfWeek || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className="btn calButtonGlow"
                      onClick={() => setState((p) => ({
                        ...p,
                        recurrence: {
                          ...p.recurrence,
                          daysOfWeek: normalizeWeekdayList(active ? (p.recurrence.daysOfWeek || []).filter((x) => x !== day) : [...(p.recurrence.daysOfWeek || []), day]),
                        },
                      }))}
                      style={{ borderRadius: 999, background: active ? "rgba(201,53,114,.18)" : undefined }}
                    >
                      {WEEKDAY_LABELS[(day + 6) % 7]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {state.recurrence.mode === "monthly" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FancySelect value={state.recurrence.monthlyMode || "date"} options={[{ value: "date", label: "Same date" }, { value: "weekday", label: "Nth weekday" }]} onChange={(val) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, monthlyMode: val } }))} width={160} />
              <input className="input" type="number" min="1" max="5" value={state.recurrence.monthlyWeek || 1} onChange={(e) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, monthlyWeek: Math.max(1, Math.min(5, Number(e.target.value) || 1)) } }))} />
              <FancySelect value={String(state.recurrence.monthlyWeekday ?? 1)} options={[0,1,2,3,4,5,6].map((day) => ({ value: String(day), label: WEEKDAY_LABELS[(day + 6) % 7] }))} onChange={(val) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, monthlyWeekday: Number(val) } }))} width={150} />
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FancySelect value={state.linkedClientId || ""} options={[{ value: "", label: "No Client" }, ...clients.map((c) => ({ value: c.id, label: c.name || "Unnamed client" }))]} onChange={(val) => setState((p) => ({ ...p, linkedClientId: val }))} width={250} />
            <input className="input" placeholder="Owner" value={state.ownerName || DEFAULT_OWNER_NAME} onChange={(e) => setState((p) => ({ ...p, ownerName: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input className="input" placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <button className="btn calButtonGlow" onClick={() => {
              const preset = templates.find((item) => item.key === templateName.trim().toLowerCase()) || templates.find((item) => item.label.toLowerCase() === templateName.trim().toLowerCase());
              if (!preset) return;
              setState((p) => ({ ...p, ...preset.patch, tags: [...new Set([...(p.tags || []), ...(preset.patch.tags || [])])] }));
            }}>Apply</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {templates.map((template) => (
              <button key={template.key} className="btn calButtonGlow" onClick={() => setState((p) => ({ ...p, ...template.patch, templateKey: template.key, tags: [...new Set([...(p.tags || []), ...(template.patch.tags || [])])] }))}>
                {template.label}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Exception dates (comma separated YYYY-MM-DD)" value={(state.recurrence.exceptions || []).join(", ")} onChange={(e) => setState((p) => ({ ...p, recurrence: { ...p.recurrence, exceptions: e.target.value.split(",").map((x) => x.trim()).filter((x) => parseISO(x)) } }))} />
          <input className="input" placeholder="Tags (comma separated)" value={(state.tags || []).join(", ")} onChange={(e) => setState((p) => ({ ...p, tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))} />
          <textarea className="input" placeholder="Notes" value={state.notes || ""} onChange={(e) => setState((p) => ({ ...p, notes: e.target.value }))} style={{ minHeight: 120, resize: "vertical" }} />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div className="calGlass" style={{ borderRadius: 16, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>Event details</div>
              <span style={{ fontSize: 11, opacity: .68 }}>{selectedCalendarLabel}</span>
            </div>
            <div style={{ fontSize: 12, opacity: .74 }}>Owner: {state.ownerName || DEFAULT_OWNER_NAME}</div>
            <div style={{ fontSize: 12, opacity: .74 }}>Auto-planned: {state.autoPlanned ? "Yes" : "No"}</div>
            <div style={{ fontSize: 12, opacity: .74 }}>Linked task: {state.linkedTaskId || "—"}</div>
            <div style={{ fontSize: 12, opacity: .74 }}>Time: {formatTimeRange(state.startTime, state.endTime)}</div>
          </div>
          <div className="calGlass" style={{ borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Comments</div>
            <div className="calScrollbar" style={{ maxHeight: 170, overflow: "auto", display: "grid", gap: 8 }}>
              {(state.comments || []).length ? state.comments.map((c) => (
                <div key={c.id} style={{ padding: 8, borderRadius: 12, background: "rgba(255,255,255,.04)", fontSize: 12 }}>
                  <div>{c.text}</div>
                  <div style={{ opacity: .56, fontSize: 10, marginTop: 4 }}>{new Date(c.createdAt).toLocaleString()}</div>
                </div>
              )) : <div style={{ opacity: .56, fontSize: 12 }}>No comments yet</div>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="input" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add comment" />
              <button
                className="btn calButtonGlow"
                onClick={() => {
                  const text = commentText.trim();
                  if (!text) return;
                  const next = { id: uid(), text, createdAt: Date.now() };
                  const updated = {
                    ...state,
                    comments: [next, ...(state.comments || [])],
                    activity: addActivityLog(state, "Comment added"),
                  };
                  setState(updated);
                  setCommentText("");
                  onSaveComment?.(updated);
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="calGlass" style={{ borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Activity</div>
            <div className="calScrollbar" style={{ maxHeight: 140, overflow: "auto", display: "grid", gap: 8 }}>
              {(state.activity || []).length ? state.activity.map((a) => (
                <div key={a.id} style={{ fontSize: 12, padding: 8, borderRadius: 12, background: "rgba(255,255,255,.04)" }}>
                  <div>{a.text}</div>
                  <div style={{ opacity: .56, fontSize: 10, marginTop: 4 }}>{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              )) : <div style={{ opacity: .56, fontSize: 12 }}>No activity yet</div>}
            </div>
          </div>

          <div className="calGlass" style={{ borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Reminder snooze presets</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SNOOZE_OPTIONS.map((mins) => (
                <button key={mins} className="btn calButtonGlow" onClick={() => onSnooze?.(state, mins)}>{mins}m</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

function TaskModal({ clients, initialDate, onClose, onSave, onDelete }) {
  const initialTask = typeof initialDate === "string"
    ? null
    : initialDate && typeof initialDate === "object"
      ? initialDate
      : null;
  const [state, setState] = useState({
    id: initialTask?.id || "",
    title: initialTask?.title || "",
    priority: initialTask?.priority || "Medium",
    date: initialTask?.due || (typeof initialDate === "string" ? initialDate : todayISO()),
    clientId: initialTask?.clientId || "",
    notes: initialTask?.notes || "",
    done: Boolean(initialTask?.done),
    tableId: initialTask?.tableId || "tbl_default",
    prioOrder: Number.isFinite(initialTask?.prioOrder) ? initialTask.prioOrder : Number.POSITIVE_INFINITY,
  });
  const canSave = Boolean(state.title.trim() && state.date);
  const editing = Boolean(initialTask?.id);

  return (
    <BaseModal
      title={editing ? "Edit task" : "Add task"}
      onClose={onClose}
      width={560}
      footer={(
        <>
          {editing ? (
            <button
              className="btn calButtonGlow"
              onClick={() => {
                onDelete?.(state.id);
                onClose();
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconTrashMinimal size={14} />
                <span>Delete</span>
              </span>
            </button>
          ) : null}
          <button className="btn calButtonGlow" onClick={onClose}>Cancel</button>
          <button
            className="btn calButtonGlow"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave({
                id: state.id || uid(),
                title: state.title.trim(),
                priority: state.priority,
                due: state.date,
                clientId: state.clientId,
                done: state.done,
                notes: state.notes.trim(),
                tableId: state.tableId || "tbl_default",
                prioOrder: Number.isFinite(state.prioOrder) ? state.prioOrder : Number.POSITIVE_INFINITY,
                updatedAt: Date.now(),
              });
              onClose();
            }}
          >
            {editing ? "Save changes" : "Save task"}
          </button>
        </>
      )}
    >
      <input className="input" placeholder="Task title" value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <FancySelect value={state.priority} options={PRIORITY_OPTIONS.map((x) => ({ value: x, label: x }))} onChange={(val) => setState((p) => ({ ...p, priority: val }))} width={160} />
        <input type="date" className="input" value={state.date} onChange={(e) => setState((p) => ({ ...p, date: e.target.value }))} />
        <FancySelect value={state.clientId} options={[{ value: "", label: "No client" }, ...clients.map((c) => ({ value: c.id, label: c.name || "Unnamed client" }))]} onChange={(val) => setState((p) => ({ ...p, clientId: val }))} width={180} />
      </div>
      <textarea className="input" placeholder="Task notes" value={state.notes} onChange={(e) => setState((p) => ({ ...p, notes: e.target.value }))} style={{ minHeight: 120, resize: "vertical" }} />
    </BaseModal>
  );
}

function IconSpark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconTaskGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconReminder({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4a5 5 0 0 1 5 5v2.4c0 .9.3 1.8.9 2.5l1.1 1.3H5l1.1-1.3c.6-.7.9-1.6.9-2.5V9a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconTrashMinimal({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M9 7V5.8c0-.99.81-1.8 1.8-1.8h2.4c.99 0 1.8.81 1.8 1.8V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 7l.8 11.1A2 2 0 0 0 9.79 20h4.42a2 2 0 0 0 1.99-1.9L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 10.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 10.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function ReminderModal({ initialDate, onClose, onSave, onDelete }) {
  const initialReminder = typeof initialDate === "string"
    ? null
    : initialDate && typeof initialDate === "object"
      ? initialDate
      : null;
  const whenDate = Number.isFinite(initialReminder?.whenTs) ? new Date(initialReminder.whenTs) : null;
  const [state, setState] = useState({
    id: initialReminder?.id || "",
    title: initialReminder?.title || "",
    date: whenDate ? formatDateISO(whenDate) : (typeof initialDate === "string" ? initialDate : todayISO()),
    time: whenDate ? `${pad2(whenDate.getHours())}:${pad2(whenDate.getMinutes())}` : "09:00",
    type: initialReminder?.type || "manual",
    linkedId: initialReminder?.linkedId || "",
    firedAt: initialReminder?.firedAt ?? null,
  });
  const canSave = Boolean(state.title.trim() && state.date && state.time);
  const editing = Boolean(initialReminder?.id);

  return (
    <BaseModal
      title={editing ? "Edit reminder" : "Add reminder"}
      onClose={onClose}
      width={480}
      footer={(
        <>
          {editing ? (
            <button
              className="btn calButtonGlow"
              onClick={() => {
                onDelete?.(state.id);
                onClose();
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconTrashMinimal size={14} />
                <span>Delete</span>
              </span>
            </button>
          ) : null}
          <button className="btn calButtonGlow" onClick={onClose}>Cancel</button>
          <button
            className="btn calButtonGlow"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              const when = parseDateTime(state.date, state.time);
              if (!when) return;
              onSave({
                id: state.id || uid(),
                type: state.type || "manual",
                title: state.title.trim(),
                whenTs: when.getTime(),
                linkedId: state.linkedId || "",
                firedAt: state.firedAt ?? null,
              });
              onClose();
            }}
          >
            {editing ? "Save changes" : "Save reminder"}
          </button>
        </>
      )}
    >
      <input className="input" placeholder="Reminder title" value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input type="date" className="input" value={state.date} onChange={(e) => setState((p) => ({ ...p, date: e.target.value }))} />
        <input type="time" className="input" value={state.time} onChange={(e) => setState((p) => ({ ...p, time: e.target.value }))} />
      </div>
    </BaseModal>
  );
}

function AddMenu({ onChoose }) {
  const { btnRef, popRef, open, setOpen, pos, computePos } = usePopover();
  const items = [
    { key: "event", label: "Add Event", icon: <IconSpark /> },
    { key: "task", label: "Add Task", icon: <IconTaskGlyph /> },
    { key: "reminder", label: "Add Reminder", icon: <IconReminder /> },
  ];
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn calButtonGlow"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => computePos(250, "right"), 0);
        }}
        style={{
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(201,53,114,.24), rgba(201,53,114,.14))",
          borderColor: "rgba(201,53,114,.34)",
          boxShadow: "0 14px 30px rgba(201,53,114,.18)",
        }}
      >
        Add ▾
      </button>
      {open && (
        <PortalCard pos={pos} popRef={popRef} width={250}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onChoose(item.key);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 12px",
                border: "none",
                borderRadius: 14,
                background: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 800,
              }}
            >
              <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><span style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</span>{item.label}</span>
              <span style={{ opacity: .4 }}>→</span>
            </button>
          ))}
        </PortalCard>
      )}
    </>
  );
}

function FilterMenu({ filters, setFilters, smartFilter, setSmartFilter }) {
  const { btnRef, popRef, open, setOpen, pos, computePos } = usePopover();
  const items = [
    { key: "tasks", label: "Tasks" },
    { key: "invoices", label: "Invoices" },
    { key: "custom", label: "Events" },
    { key: "reminders", label: "Reminders" },
  ];
  return (
    <>
      <button
        ref={btnRef}
        className="btn calButtonGlow"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => computePos(260, "right"), 0);
        }}
        style={{ borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.16)" }}
      >
        Filter ▾
      </button>
      {open && (
        <PortalCard pos={pos} popRef={popRef} width={260}>
          <div style={{ padding: "6px 10px 8px", fontSize: 11, fontWeight: 900, opacity: .7 }}>VISIBLE SOURCES</div>
          {items.map((item) => {
            const active = filters[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 12,
                  background: active ? "rgba(201,53,114,.14)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                <span>{item.label}</span>
                <span style={{ opacity: active ? 1 : .18 }}>{active ? "✓" : "○"}</span>
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "8px 4px" }} />
          <div style={{ padding: "6px 10px 8px", fontSize: 11, fontWeight: 900, opacity: .7 }}>SMART FILTERS</div>
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "overdue", label: "Overdue" },
          ].map((item) => {
            const active = smartFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSmartFilter(item.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 12,
                  background: active ? "rgba(255,255,255,.10)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                <span>{item.label}</span>
                <span style={{ opacity: active ? 1 : .18 }}>{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </PortalCard>
      )}
    </>
  );
}

function DayMenuPopover({ anchor, dateISO, events, onClose, onChoose, onDeleteEvent }) {
  const popRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 290 });
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const pad = 12;
    const width = 290;
    const left = Math.max(pad, Math.min(window.innerWidth - width - pad, r.left));
    const guess = 260;
    const below = r.bottom + 10;
    const above = r.top - guess - 10;
    const top = below + guess <= window.innerHeight - pad ? below : Math.max(pad, above);
    setPos({ left, top, width });
  }, [anchor]);
  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (anchor?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={popRef} className="calGlassStrong calScrollbar" style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, borderRadius: 18, padding: 10, zIndex: 99999 }}>
      <div style={{ padding: "4px 6px 10px" }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{dateISO}</div>
        <div style={{ fontSize: 11, opacity: .64, marginTop: 4 }}>{events.length} item(s)</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {[
          { key: "event", label: "Add Event" },
          { key: "task", label: "Add Task" },
          { key: "reminder", label: "Add Reminder" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChoose(item.key)}
            style={{ width: "100%", padding: "10px 12px", border: "none", borderRadius: 12, background: "rgba(255,255,255,.05)", color: "var(--text)", cursor: "pointer", fontWeight: 800, textAlign: "left" }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {events.length ? (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "10px 2px" }} />
          <div className="calScrollbar" style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
            {events.map((event) => (
              <div key={event.id} style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                    <div style={{ fontSize: 10, opacity: .68, marginTop: 4 }}>{event.timeLabel} · {event.breadcrumb}</div>
                  </div>
                  {isDirectlyDeletableEvent(event) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent?.(event);
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(0,0,0,.18)",
                        color: "var(--text)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flex: "0 0 auto",
                      }}
                      title={`Delete ${event.type}`}
                      aria-label={`Delete ${event.type}`}
                    >
                      <IconTrashMinimal size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>,
    document.body
  );
}

function Sidebar({ currentISO, onSelectDate, sourceLegend, savedViews, activeSavedView, onApplySavedView, smartFilter, stats, sourceColors = SOURCE_COLORS, onSourceColorChange }) {
  return (
    <div
      className="calGlass"
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        borderRadius: 22,
        padding: 12,
        display: "grid",
        gap: 12,
        minHeight: 0,
        transition: "min-width 180ms ease, width 180ms ease",
      }}
    >
      <DayMiniPicker value={currentISO} onChange={onSelectDate} />
          <div className="calGlass" style={{ borderRadius: 18, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900 }}>Saved views</div>
            {savedViews.map((view) => {
              const active = activeSavedView === view.key;
              return (
                <button key={view.key} className="btn calButtonGlow" onClick={() => onApplySavedView(view.key)} style={{ justifyContent: "space-between", borderRadius: 12, background: active ? "rgba(201,53,114,.14)" : undefined }}>
                  <span>{view.label}</span>
                  <span style={{ opacity: active ? 1 : .2 }}>{active ? "★" : "☆"}</span>
                </button>
              );
            })}
          </div>
          <div className="calGlass" style={{ borderRadius: 18, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900 }}>Source colors</div>
            {sourceLegend.map((item) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="color" value={sourceColors[item.key]?.dot || SOURCE_COLORS[item.key].dot} onChange={(e) => onSourceColorChange?.(item.key, e.target.value)} style={{ width: 18, height: 18, border: "none", padding: 0, background: "transparent", cursor: "pointer" }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="calGlass" style={{ borderRadius: 18, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900 }}>Stats</div>
            <div style={{ fontSize: 12, opacity: .72 }}>Smart Filter: {smartFilter}</div>
            <div style={{ fontSize: 12, opacity: .72 }}>Today: {stats.today}</div>
            <div style={{ fontSize: 12, opacity: .72 }}>Upcoming: {stats.upcoming}</div>
            <div style={{ fontSize: 12, opacity: .72 }}>Overdue: {stats.overdue}</div>
          </div>
    </div>
  );
}

export default function CalendarPage({ data, setData, toastOk }) {
  ensureCalendarStyles();

  const [current, setCurrent] = useState(new Date());
  const [view, setView] = useState("month");
  const [filters, setFilters] = useState({ tasks: true, invoices: true, custom: true, reminders: true });
  const [smartFilter, setSmartFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importToast, setImportToast] = useState("");
  const [activeSavedView, setActiveSavedView] = useState("all");
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [timelineDaysCount, setTimelineDaysCount] = useState(14);
  const [timelineGroupBy, setTimelineGroupBy] = useState("calendar");
  const [schedulerHistory, setSchedulerHistory] = useState([]);

  const [eventModal, setEventModal] = useState(null);
  const [taskModalDate, setTaskModalDate] = useState(null);
  const [reminderModalDate, setReminderModalDate] = useState(null);
  const [dayMenu, setDayMenu] = useState(null);

  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);
  const fileInputRef = useRef(null);
  const dayViewRef = useRef(null);
  const dayActionRef = useRef({ startY: 0, dateISO: "", creating: false, resizing: null });

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const year = current.getFullYear();
  const month = current.getMonth();
  const currentISO = formatDateISO(current);

  const visibleRange = useMemo(() => {
    const start = addDays(startOfDay(current), -62);
    const end = addDays(endOfDay(current), 120);
    return { start, end };
  }, [current]);

  const rawEvents = useMemo(() => buildEvents(data, filters, search, visibleRange.start, visibleRange.end), [data, filters, search, visibleRange]);

  const filteredEvents = useMemo(() => {
    if (smartFilter === "all") return rawEvents;
    const today = startOfDay(new Date());
    if (smartFilter === "today") return rawEvents.filter((e) => isSameDay(e.date, today));
    if (smartFilter === "upcoming") return rawEvents.filter((e) => startOfDay(e.date) > today);
    if (smartFilter === "overdue") return rawEvents.filter((e) => startOfDay(e.date) < today && e.type === "task");
    return rawEvents;
  }, [rawEvents, smartFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((event) => {
      if (!map.has(event.dayTs)) map.set(event.dayTs, []);
      map.get(event.dayTs).push(event);
    });
    return map;
  }, [filteredEvents]);

  const days = useMemo(() => monthMatrix(year, month), [year, month]);
  const week = useMemo(() => weekDays(current), [current]);
  const hours = useMemo(() => dayHours(), []);
  const currentDayTs = useMemo(() => startOfDay(current).getTime(), [current]);
  const dayEvents = useMemo(() => eventsByDay.get(currentDayTs) || [], [eventsByDay, currentDayTs]);

  const dayEventsByHour = useMemo(() => {
    const map = new Map();
    hours.forEach((h) => map.set(h, []));
    dayEvents.forEach((event) => {
      if (!Number.isFinite(event.startMinutes)) {
        map.get("00:00")?.push(event);
        return;
      }
      const key = `${pad2(Math.floor(event.startMinutes / 60))}:00`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });
    return map;
  }, [dayEvents, hours]);

  const timelineDays = useMemo(() => Array.from({ length: timelineDaysCount }, (_, i) => addDays(startOfDay(current), i)), [current, timelineDaysCount]);

  const agendaGroups = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets = { Today: [], Upcoming: [], Later: [] };
    filteredEvents.forEach((event) => {
      const d = startOfDay(event.date);
      if (d.getTime() === today.getTime()) buckets.Today.push(event);
      else if (d > today && d <= addDays(today, 7)) buckets.Upcoming.push(event);
      else buckets.Later.push(event);
    });
    return buckets;
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      today: rawEvents.filter((e) => isSameDay(e.date, today)).length,
      upcoming: rawEvents.filter((e) => startOfDay(e.date) > today).length,
      overdue: rawEvents.filter((e) => e.type === "task" && startOfDay(e.date) < today).length,
    };
  }, [rawEvents]);

  const notificationItems = useMemo(() => buildNotificationItems(filteredEvents), [filteredEvents]);
  const sourceColors = useMemo(() => getSourceColors(data), [data]);

  const timelineRows = useMemo(() => {
    const groups = new Map();
    filteredEvents.slice(0, 120).forEach((event) => {
      let key = "Other";
      if (timelineGroupBy === "calendar") key = event.calendarLabel || "Work";
      else if (timelineGroupBy === "client") key = event.linkedClientName || "No Client";
      else key = event.breadcrumb || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    });
    return Array.from(groups.entries());
  }, [filteredEvents, timelineGroupBy]);

  const savedViews = [
    { key: "all", label: "All Work" },
    { key: "tasks", label: "Tasks Only" },
    { key: "meetings", label: "Events & Reminders" },
    { key: "finance", label: "Invoices" },
  ];

  const sourceLegend = [
    { key: "task", label: "Tasks" },
    { key: "custom", label: "Events" },
    { key: "reminder", label: "Reminders" },
    { key: "invoice_due", label: "Invoices" },
  ];

  const updateSourceColor = useCallback((key, value) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...(prev.settings || {}),
        calendarSourceColors: {
          ...((prev.settings && prev.settings.calendarSourceColors) || {}),
          [key]: value,
        },
      },
    }));
  }, [setData]);

  const applySavedView = useCallback((key) => {
    setActiveSavedView(key);
    if (key === "all") setFilters({ tasks: true, invoices: true, custom: true, reminders: true });
    if (key === "tasks") setFilters({ tasks: true, invoices: false, custom: false, reminders: false });
    if (key === "meetings") setFilters({ tasks: false, invoices: false, custom: true, reminders: true });
    if (key === "finance") setFilters({ tasks: false, invoices: true, custom: false, reminders: false });
  }, []);

  const saveCustomEvent = useCallback((payload) => {
    const normalized = normalizeCustomEvent(payload);
    if (!normalized) return;
    const withActivity = {
      ...normalized,
      activity: [
        { id: uid(), text: payload?.id ? "Event updated" : "Event created", createdAt: Date.now() },
        ...(normalized.activity || []),
      ],
    };
    setData((d) => {
      const list = Array.isArray(d.calendarEvents) ? d.calendarEvents : [];
      if (payload?.id) {
        return { ...d, calendarEvents: list.map((e) => e.id === payload.id ? withActivity : e) };
      }
      return { ...d, calendarEvents: [...list, withActivity] };
    });
    toastOk?.(payload?.id ? "Event updated" : "Event added");
  }, [setData, toastOk]);

  const updateCustomEventById = useCallback((eventId, updater) => {
    setData((d) => ({
      ...d,
      calendarEvents: (d.calendarEvents || []).map((item) => {
        if (item.id !== eventId) return item;
        const next = typeof updater === "function" ? updater(normalizeCustomEvent(item)) : updater;
        return normalizeCustomEvent(next) || normalizeCustomEvent(item);
      }),
    }));
  }, [setData]);

  const deleteCustomEvent = useCallback((eventId) => {
    setData((d) => ({ ...d, calendarEvents: (d.calendarEvents || []).filter((e) => e.id !== eventId) }));
    toastOk?.("Event deleted");
  }, [setData, toastOk]);

  const saveTask = useCallback((task) => {
    setData((d) => {
      const list = Array.isArray(d.tasks) ? d.tasks : [];
      const exists = list.some((item) => item.id === task.id);
      return {
        ...d,
        tasks: exists ? list.map((item) => item.id === task.id ? { ...item, ...task } : item) : [...list, task],
      };
    });
    toastOk?.(task?.id && (data.tasks || []).some((item) => item.id === task.id) ? "Task updated" : "Task added");
  }, [setData, toastOk, data.tasks]);

  const deleteTask = useCallback((taskId) => {
    setData((d) => ({ ...d, tasks: (d.tasks || []).filter((task) => task.id !== taskId) }));
    toastOk?.("Task deleted");
  }, [setData, toastOk]);

  const saveReminder = useCallback((rem) => {
    setData((d) => {
      const list = Array.isArray(d.reminders) ? d.reminders : [];
      const exists = list.some((item) => item.id === rem.id);
      const nextItem = { ...rem };
      return {
        ...d,
        reminders: exists ? list.map((item) => item.id === rem.id ? { ...item, ...nextItem } : item) : [nextItem, ...list],
      };
    });
    toastOk?.(rem?.id && (data.reminders || []).some((item) => item.id === rem.id) ? "Reminder updated" : "Reminder added");
  }, [setData, toastOk, data.reminders]);

  const deleteReminder = useCallback((reminderId) => {
    setData((d) => ({ ...d, reminders: (d.reminders || []).filter((reminder) => reminder.id !== reminderId) }));
    toastOk?.("Reminder deleted");
  }, [setData, toastOk]);

  const deleteCalendarItem = useCallback((event) => {
    if (!event) return;
    if (event.type === "custom") {
      deleteCustomEvent(event.sourceId || event.id);
      return;
    }
    if (event.type === "task") {
      deleteTask(event.linkedId || event.sourceId || event.id);
      return;
    }
    if (event.type === "reminder") {
      deleteReminder(event.linkedId || event.sourceId || event.id);
    }
  }, [deleteCustomEvent, deleteReminder, deleteTask]);

  const importEvents = useCallback((items, mode, skipped) => {
    setData((d) => {
      const currentItems = Array.isArray(d.calendarEvents) ? d.calendarEvents : [];
      return { ...d, calendarEvents: mode === "replace" ? items : [...currentItems, ...items] };
    });
    setImportOpen(false);
    setImportToast(`${items.length} event(s) imported${skipped ? `, ${skipped} skipped` : ""}.`);
    window.setTimeout(() => setImportToast(""), 2500);
  }, [setData]);

  const moveEventToDate = useCallback((event, newDateISO) => {
    if (!event) return;
    if (event.type === "task") {
      setData((d) => ({
        ...d,
        tasks: (d.tasks || []).map((t) => t.id === event.linkedId ? { ...t, due: newDateISO, updatedAt: Date.now() } : t),
      }));
      toastOk?.("Task moved");
      return;
    }
    if (event.type === "invoice") {
      setData((d) => ({ ...d, invoices: (d.invoices || []).map((x) => x.id === event.linkedId ? { ...x, issueDate: newDateISO } : x) }));
      toastOk?.("Invoice moved");
      return;
    }
    if (event.type === "invoice_due") {
      setData((d) => ({ ...d, invoices: (d.invoices || []).map((x) => x.id === event.linkedId ? { ...x, dueDate: newDateISO } : x) }));
      toastOk?.("Invoice moved");
      return;
    }
    if (event.type === "reminder") {
      setData((d) => ({
        ...d,
        reminders: (d.reminders || []).map((r) => {
          if (r.id !== event.linkedId) return r;
          const old = new Date(r.whenTs);
          return { ...r, whenTs: parseDateTime(newDateISO, `${pad2(old.getHours())}:${pad2(old.getMinutes())}`)?.getTime() || r.whenTs };
        }),
      }));
      toastOk?.("Reminder moved");
      return;
    }
    if (event.type === "custom") {
      updateCustomEventById(event.sourceId, (currentEvent) => ({
        ...currentEvent,
        date: newDateISO,
        activity: [{ id: uid(), text: `Moved to ${newDateISO}`, createdAt: Date.now() }, ...(currentEvent.activity || [])],
      }));
      toastOk?.("Event moved");
    }
  }, [setData, toastOk, updateCustomEventById]);

  const snoozeCustomEvent = useCallback((event, minutes) => {
    if (!event?.title) return;
    const sourceDate = parseDateTime(event.dateISO || todayISO(), event.startTime || "09:00") || new Date();
    const whenTs = addDays(sourceDate, 0).getTime() + minutes * 60000;
    saveReminder({ id: uid(), type: "snooze", title: `${event.title} (snoozed ${minutes}m)`, whenTs, linkedId: event.sourceId || "", firedAt: null });
    toastOk?.(`Snoozed ${minutes}m`);
  }, [saveReminder, toastOk]);

  const runSmartPlan = useCallback((mode = "plan") => {
    const targetISO = currentISO;
    const existingCustom = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];
    const existingEvents = rawEvents.filter((event) => event.dateISO === targetISO && (!event.autoPlanned || mode !== "optimize"));
    const withoutExistingPlans = mode === "optimize"
      ? existingCustom.filter((item) => !(item?.autoPlanned && item?.date === targetISO))
      : existingCustom;
    const planned = planTasksIntoDay({
      tasks: data.tasks || [],
      dateISO: targetISO,
      existingEvents,
      existingCalendarEvents: withoutExistingPlans,
    });
    if (!planned.length) {
      toastOk?.(mode === "optimize" ? "No auto-planning changes" : "No tasks available to plan");
      return;
    }
    setSchedulerHistory((prev) => [...prev.slice(-9), existingCustom]);
    setData((d) => ({
      ...d,
      calendarEvents: [...withoutExistingPlans, ...planned],
    }));
    toastOk?.(mode === "optimize" ? "Day optimized" : "Day planned");
  }, [currentISO, data.calendarEvents, data.tasks, rawEvents, setData, toastOk]);

  const undoSmartPlan = useCallback(() => {
    setSchedulerHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last) {
        toastOk?.("Nothing to undo");
        return prev;
      }
      setData((d) => ({ ...d, calendarEvents: last }));
      toastOk?.("Last plan undone");
      return prev.slice(0, -1);
    });
  }, [setData, toastOk]);

  const startDrag = useCallback((e, event) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;

    const activate = () => {
      active = true;
      setDragState({ event, pointer: { x: startX, y: startY }, overDate: null });
    };

    const onMove = (ev) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (!active && dx + dy > 4) activate();
      if (!active) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-calendar-day]");
      const overDate = target?.getAttribute?.("data-calendar-day") || null;
      setDragState((prev) => prev ? { ...prev, pointer: { x: ev.clientX, y: ev.clientY }, overDate } : prev);
    };

    const onUp = () => {
      const latest = dragStateRef.current;
      if (latest?.event && latest?.overDate) moveEventToDate(latest.event, latest.overDate);
      setDragState(null);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }, [moveEventToDate]);

  const openDayMenu = useCallback((date, anchor) => {
    setDayMenu({ dateISO: formatDateISO(date), anchor });
  }, []);

  const openEvent = useCallback((event) => {
    if (event.type === "custom") {
      const source = (data.calendarEvents || []).find((x) => x.id === event.sourceId);
      setEventModal(source || { date: event.dateISO });
      return;
    }
    if (event.type === "task") {
      const source = (data.tasks || []).find((x) => x.id === (event.linkedId || event.sourceId));
      setTaskModalDate(source || event.dateISO || todayISO());
      return;
    }
    if (event.type === "reminder") {
      const source = (data.reminders || []).find((x) => x.id === (event.linkedId || event.sourceId));
      setReminderModalDate(source || event.dateISO || todayISO());
    }
  }, [data.calendarEvents, data.reminders, data.tasks]);

  const handleCommandAction = useCallback((key) => {
    if (key === "new_event") setEventModal({ date: currentISO });
    if (key === "new_task") setTaskModalDate(currentISO);
    if (key === "new_reminder") setReminderModalDate(currentISO);
    if (key === "plan_day") runSmartPlan("plan");
    if (key === "optimize_day") runSmartPlan("optimize");
    if (key === "undo_plan") undoSmartPlan();
    if (key === "open_notifications") setNotificationsOpen(true);
    if (key === "toggle_focus") setFocusMode((v) => !v);
    if (key === "toggle_density") setDensity((v) => v === "comfortable" ? "compact" : "comfortable");
    if (key === "goto_today") setCurrent(new Date());
    if (key === "view_month") setView("month");
    if (key === "view_week") setView("week");
    if (key === "view_day") setView("day");
    if (key === "view_agenda") setView("agenda");
    if (key === "view_timeline") setView("timeline");
    if (key === "timeline_zoom_7") setTimelineDaysCount(7);
    if (key === "timeline_zoom_14") setTimelineDaysCount(14);
    if (key === "timeline_zoom_30") setTimelineDaysCount(30);
  }, [currentISO, runSmartPlan, undoSmartPlan]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "m") setView("month");
      if (e.key === "w") setView("week");
      if (e.key === "d") setView("day");
      if (e.key === "a") setView("agenda");
      if (e.key === "t") setView("timeline");
      if (e.key === "ArrowLeft") {
        if (view === "day") setCurrent((x) => addDays(x, -1));
        else if (view === "week") setCurrent((x) => addDays(x, -7));
        else setCurrent((x) => new Date(x.getFullYear(), x.getMonth() - 1, 1));
      }
      if (e.key === "ArrowRight") {
        if (view === "day") setCurrent((x) => addDays(x, 1));
        else if (view === "week") setCurrent((x) => addDays(x, 7));
        else setCurrent((x) => new Date(x.getFullYear(), x.getMonth() + 1, 1));
      }
      if (e.key === "n") setEventModal({ date: currentISO });
      if (e.key === "p") runSmartPlan("plan");
      if (e.key === "o") runSmartPlan("optimize");
      if (e.key === "f") setFocusMode((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, currentISO, runSmartPlan]);

  const startCreateTimeBlock = useCallback((e) => {
    const wrap = dayViewRef.current;
    if (!wrap) return;
    const slot = e.target.closest("[data-day-hour]");
    if (!slot) return;
    const hour = Number(slot.getAttribute("data-day-hour"));
    if (!Number.isFinite(hour)) return;
    const rect = slot.getBoundingClientRect();
    const rel = e.clientY - rect.top;
    const mins = Math.max(0, Math.min(59, Math.round((rel / rect.height) * 60 / 15) * 15));
    const start = hour * 60 + mins;
    dayActionRef.current = { startY: e.clientY, dateISO: currentISO, creating: { start, end: start + 60 }, resizing: null };

    const ghostId = `create_${uid()}`;
    setDragState({
      event: { id: ghostId, title: "New event", type: "custom", timeLabel: `${fromMinutes(start)} - ${fromMinutes(start + 60)}` },
      pointer: { x: e.clientX, y: e.clientY },
      overDate: currentISO,
    });

    const onMove = (ev) => {
      const currentBlock = dayActionRef.current.creating;
      if (!currentBlock) return;
      const deltaPx = ev.clientY - dayActionRef.current.startY;
      const deltaMinutes = Math.round(deltaPx / 52) * 60;
      const nextEnd = Math.max(currentBlock.start + 30, currentBlock.start + 60 + deltaMinutes);
      dayActionRef.current.creating = { ...currentBlock, end: nextEnd };
      setDragState((prev) => prev ? { ...prev, pointer: { x: ev.clientX, y: ev.clientY }, event: { ...prev.event, timeLabel: `${fromMinutes(currentBlock.start)} - ${fromMinutes(nextEnd)}` } } : prev);
    };

    const onUp = () => {
      const currentBlock = dayActionRef.current.creating;
      if (currentBlock) {
        setEventModal({
          date: dayActionRef.current.dateISO,
          title: "",
          startTime: fromMinutes(currentBlock.start),
          endTime: fromMinutes(currentBlock.end),
          notes: "",
          linkedClientId: "",
          recurrence: { mode: "none", interval: 1, until: "" },
          comments: [],
          activity: [],
          tags: [],
        });
      }
      dayActionRef.current.creating = null;
      setDragState(null);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }, [currentISO]);

  const startResizeEvent = useCallback((e, event) => {
    e.stopPropagation();
    e.preventDefault();
    if (event.type !== "custom" || !event.sourceId) return;
    const originalEnd = Number.isFinite(event.endMinutes) ? event.endMinutes : (Number.isFinite(event.startMinutes) ? event.startMinutes + 60 : 600);
    dayActionRef.current.resizing = { id: event.sourceId, start: event.startMinutes || Math.max(0, originalEnd - 60), end: originalEnd };

    const onMove = (ev) => {
      const deltaPx = ev.movementY || 0;
      const deltaMinutes = Math.round(deltaPx / 13) * 15;
      const currentResize = dayActionRef.current.resizing;
      if (!currentResize) return;
      const nextEnd = Math.max(currentResize.start + 30, currentResize.end + deltaMinutes);
      dayActionRef.current.resizing = { ...currentResize, end: nextEnd };
    };

    const onUp = () => {
      const currentResize = dayActionRef.current.resizing;
      if (currentResize) {
        updateCustomEventById(currentResize.id, (currentEvent) => ({
          ...currentEvent,
          startTime: fromMinutes(currentResize.start),
          endTime: fromMinutes(currentResize.end),
          activity: [{ id: uid(), text: "Duration resized", createdAt: Date.now() }, ...(currentEvent.activity || [])],
        }));
        toastOk?.("Event duration updated");
      }
      dayActionRef.current.resizing = null;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }, [toastOk, updateCustomEventById]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: focusMode ? "minmax(0, 1fr)" : "280px minmax(0, 1fr)",
        gap: 14,
        padding: 16,
        alignItems: "start",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      {!focusMode ? <div
        style={{
          width: "100%",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <Sidebar
          currentISO={currentISO}
          onSelectDate={(iso) => setCurrent(parseISO(iso) || new Date())}
          sourceLegend={sourceLegend}
          savedViews={savedViews}
          activeSavedView={activeSavedView}
          onApplySavedView={applySavedView}
          smartFilter={smartFilter}
          stats={stats}
          sourceColors={sourceColors}
          onSourceColorChange={updateSourceColor}
        />
      </div> : null}

      <div style={{ minWidth: 0, width: "100%", overflow: "hidden" }}>
        {importToast ? (
          <div className="calGlass" style={{ borderRadius: 16, padding: "10px 12px", marginBottom: 12, fontSize: 12, fontWeight: 800 }}>{importToast}</div>
        ) : null}

        <div
        className="calGlass"
        style={{
          borderRadius: 22,
          padding: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
          <button className="btn calButtonGlow" onClick={() => setCurrent(new Date())} style={{ borderRadius: 14 }}>Today</button>
          <FancySelect value={view} options={["month", "week", "day", "agenda", "timeline"].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} onChange={setView} width={150} />
          <FancySelect value={MONTHS[month]} options={MONTHS.map((m) => ({ value: m, label: m }))} onChange={(val) => setCurrent(new Date(year, MONTHS.indexOf(val), 1))} width={180} />
          <FancySelect value={String(year)} options={Array.from({ length: 9 }, (_, i) => String(year - 4 + i)).map((y) => ({ value: y, label: y }))} onChange={(val) => setCurrent(new Date(Number(val), month, 1))} width={110} />
          <button className="btn calButtonGlow" onClick={() => view === "day" ? setCurrent((x) => addDays(x, -1)) : view === "week" ? setCurrent((x) => addDays(x, -7)) : setCurrent((x) => new Date(x.getFullYear(), x.getMonth() - 1, 1))}>←</button>
          <button className="btn calButtonGlow" onClick={() => view === "day" ? setCurrent((x) => addDays(x, 1)) : view === "week" ? setCurrent((x) => addDays(x, 7)) : setCurrent((x) => new Date(x.getFullYear(), x.getMonth() + 1, 1))}>→</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn calButtonGlow" onClick={() => setSearchOpen(true)}>Search</button>
            <button className="btn calButtonGlow" onClick={() => setNotificationsOpen(true)}>Inbox {notificationItems.length ? `(${notificationItems.length})` : ""}</button>
            <button className="btn calButtonGlow" onClick={() => setCommandOpen(true)}>⌘K</button>
            <FilterMenu filters={filters} setFilters={setFilters} smartFilter={smartFilter} setSmartFilter={setSmartFilter} />
            <button className="btn calButtonGlow" onClick={() => setImportOpen(true)}>Import</button>
          </div>
        </div>

        <div className="calGlass" style={{ borderRadius: 18, padding: 10, display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <AddMenu onChoose={(key) => {
            if (key === "event") setEventModal({ date: currentISO });
            if (key === "task") setTaskModalDate(currentISO);
            if (key === "reminder") setReminderModalDate(currentISO);
          }} />
          <button className="btn calButtonGlow" onClick={() => runSmartPlan("plan")}>Plan My Day</button>
          <button className="btn calButtonGlow" onClick={() => runSmartPlan("optimize")}>Optimize</button>
          <button className="btn calButtonGlow" onClick={undoSmartPlan}>Undo</button>
          <button className="btn calButtonGlow" onClick={() => setFocusMode((v) => !v)}>{focusMode ? "Exit Focus" : "Focus Mode"}</button>
          <FancySelect value={density} options={DENSITY_OPTIONS.map((item) => ({ value: item, label: titleCaseWord(item) }))} onChange={setDensity} width={150} />
          <FancySelect value={String(timelineDaysCount)} options={TIMELINE_ZOOM_OPTIONS.map((item) => ({ value: String(item), label: `Timeline ${item}D` }))} onChange={(val) => setTimelineDaysCount(Number(val) || 14)} width={160} />
          <FancySelect value={timelineGroupBy} options={TIMELINE_GROUP_OPTIONS.map((item) => ({ value: item, label: `Group: ${titleCaseWord(item)}` }))} onChange={setTimelineGroupBy} width={170} />
          <span style={{ marginLeft: "auto", fontSize: 11, opacity: .68, alignSelf: "center" }}>Shortcuts: P Plan · O Optimize · F Focus</span>
        </div>

        {view === "month" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{monthLabel(year, month)}</strong>
<span style={{ fontSize: 11, opacity: .66 }}>Click a day for quick actions</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 6 }}>
              {WEEKDAY_LABELS.map((d) => <div key={d} style={{ fontSize: 11, fontWeight: 900, opacity: .72, padding: "0 4px" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {days.map((date, i) => {
                const dayTs = startOfDay(date).getTime();
                return (
                  <MonthCell
                    key={i}
                    date={date}
                    activeMonth={month}
                    events={eventsByDay.get(dayTs) || []}
                    isToday={isSameDay(date, new Date())}
                    isDropTarget={dragState?.overDate === formatDateISO(date)}
                    onOpenMenu={openDayMenu}
                    onOpenEvent={openEvent}
                    onDeleteEvent={deleteCalendarItem}
                    onDragStart={startDrag}
                    sourceColors={sourceColors}
                  />
                );
              })}
            </div>
          </>
        ) : null}

        {view === "week" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {week.map((date, i) => {
              const dayTs = startOfDay(date).getTime();
              return (
                <div key={i} style={{ display: "grid", gap: 6 }}>
                  <div style={{ padding: "0 4px", fontSize: 11, fontWeight: 900, opacity: .72 }}>{WEEKDAY_LABELS[i]} {date.getDate()}</div>
                  <MonthCell
                    date={date}
                    activeMonth={date.getMonth()}
                    events={eventsByDay.get(dayTs) || []}
                    isToday={isSameDay(date, new Date())}
                    isDropTarget={dragState?.overDate === formatDateISO(date)}
                    onOpenMenu={openDayMenu}
                    onOpenEvent={openEvent}
                    onDeleteEvent={deleteCalendarItem}
                    onDragStart={startDrag}
                    sourceColors={sourceColors}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {view === "day" ? (
          <div className="calGlass" style={{ borderRadius: 22, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.08)", fontWeight: 900, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span>{WEEKDAY_LABELS[(current.getDay() + 6) % 7]} {current.getDate()} {MONTHS[current.getMonth()]} {current.getFullYear()}</span>
<span style={{ opacity: .68, fontSize: 12 }}>Drag to move · Drag empty time to create · Drag handle to resize</span>
            </div>
            <div ref={dayViewRef}>
              {hours.map((label, idx) => (
                <div key={label} data-day-hour={idx} onPointerDown={startCreateTimeBlock} style={{ minHeight: density === "compact" ? 52 : 64, borderBottom: "1px solid rgba(255,255,255,.06)", display: "grid", gridTemplateColumns: "92px 1fr" }}>
                  <div style={{ padding: "12px 14px", opacity: .72, fontWeight: 800, borderRight: "1px solid rgba(255,255,255,.06)" }}>{label}</div>
                  <div style={{ padding: "8px 12px", position: "relative" }}>
                    {(dayEventsByHour.get(label) || []).map((event) => (
                      <div key={`${label}_${event.id}`} style={{ position: "relative" }}>
                        <EventChip event={event} onOpen={openEvent} onDelete={deleteCalendarItem} onDragStart={startDrag} sourceColors={sourceColors} />
                        {event.type === "custom" && Number.isFinite(event.startMinutes) ? (
                          <div
                            onPointerDown={(e) => startResizeEvent(e, event)}
                            style={{ position: "absolute", right: 8, bottom: 3, width: 32, height: 8, borderRadius: 999, background: "rgba(255,255,255,.14)", cursor: "ns-resize" }}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === "agenda" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <AgendaGroup title="Today" items={agendaGroups.Today} onOpenEvent={openEvent} onDeleteEvent={deleteCalendarItem} onDragStart={startDrag} sourceColors={sourceColors} />
            <AgendaGroup title="Upcoming" items={agendaGroups.Upcoming} onOpenEvent={openEvent} onDeleteEvent={deleteCalendarItem} onDragStart={startDrag} sourceColors={sourceColors} />
            <AgendaGroup title="Later" items={agendaGroups.Later} onOpenEvent={openEvent} onDeleteEvent={deleteCalendarItem} onDragStart={startDrag} sourceColors={sourceColors} />
          </div>
        ) : null}

        {view === "timeline" ? (
          <div className="calGlass calScrollbar" style={{ borderRadius: 22, padding: 12, overflow: "auto" }}>
            <div style={{ display: "grid", gap: 12, minWidth: 920 }}>
              {timelineRows.map(([groupLabel, items]) => (
                <div key={groupLabel} style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: .72 }}>{groupLabel}</div>
                  <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${timelineDays.length}, minmax(92px, 1fr))`, gap: 8 }}>
                    <div />
                    {timelineDays.map((d) => (
                      <div key={`${groupLabel}_${formatDateISO(d)}`} style={{ fontSize: 11, fontWeight: 900, opacity: .72 }}>{formatDateISO(d)}</div>
                    ))}
                    {items.map((event) => (
                      <>
                        <div key={`${event.id}_label`} style={{ padding: 10, borderRadius: 14, background: "rgba(255,255,255,.04)", fontSize: 12, fontWeight: 800 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                              <div style={{ fontSize: 10, opacity: .58, marginTop: 4 }}>{event.timeLabel}</div>
                            </div>
                            {isDirectlyDeletableEvent(event) ? (
                              <button
                                type="button"
                                onClick={() => deleteCalendarItem(event)}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 999,
                                  border: "1px solid rgba(255,255,255,.10)",
                                  background: "rgba(0,0,0,.18)",
                                  color: "var(--text)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  flex: "0 0 auto",
                                }}
                                title={`Delete ${event.type}`}
                                aria-label={`Delete ${event.type}`}
                              >
                                <IconTrashMinimal size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {timelineDays.map((d, i) => {
                          const active = formatDateISO(d) === event.dateISO;
                          return (
                            <div key={`${event.id}_${i}`} style={{ minHeight: 44, borderRadius: 12, background: active ? sourceColors[event.type]?.tint || sourceColors.custom.tint : "rgba(255,255,255,.03)", border: active ? `1px solid ${sourceColors[event.type]?.border || sourceColors.custom.border}` : "1px solid rgba(255,255,255,.04)" }} />
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {searchOpen ? (
        <BaseModal title="Search events" onClose={() => setSearchOpen(false)} width={460}>
          <input autoFocus className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, invoices, reminders, events..." />
        </BaseModal>
      ) : null}

      {commandOpen ? <CommandPalette onClose={() => setCommandOpen(false)} onAction={handleCommandAction} /> : null}
      {importOpen ? <ImportModal fileInputRef={fileInputRef} onClose={() => setImportOpen(false)} onImport={importEvents} /> : null}
      {eventModal ? <EventModal data={data} initial={eventModal} onClose={() => setEventModal(null)} onSave={saveCustomEvent} onDelete={deleteCustomEvent} onSaveComment={(event) => updateCustomEventById(event.id, event)} onSnooze={snoozeCustomEvent} /> : null}
      {taskModalDate ? <TaskModal clients={Array.isArray(data.clients) ? data.clients : []} initialDate={taskModalDate} onClose={() => setTaskModalDate(null)} onSave={saveTask} onDelete={deleteTask} /> : null}
      {reminderModalDate ? <ReminderModal initialDate={reminderModalDate} onClose={() => setReminderModalDate(null)} onSave={saveReminder} onDelete={deleteReminder} /> : null}
      {notificationsOpen ? (
        <BaseModal title="Notification center" onClose={() => setNotificationsOpen(false)} width={620}>
          <div className="calScrollbar" style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
            {notificationItems.length ? notificationItems.map((item) => (
              <div key={item.id} className="calGlass" style={{ borderRadius: 16, padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{item.title}</strong>
                  <span style={{ fontSize: 11, opacity: .64 }}>{item.timeLabel}</span>
                </div>
                <div style={{ fontSize: 12, opacity: .68 }}>{item.dateISO} · {item.event.breadcrumb}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn calButtonGlow" onClick={() => { openEvent(item.event); setNotificationsOpen(false); }}>Open</button>
                  <button className="btn calButtonGlow" onClick={() => snoozeCustomEvent(item.event, 15)}>Snooze 15m</button>
                  <button className="btn calButtonGlow" onClick={() => moveEventToDate(item.event, todayISO())}>Move to today</button>
                </div>
              </div>
            )) : <div style={{ opacity: .66, fontSize: 12 }}>No upcoming items.</div>}
          </div>
        </BaseModal>
      ) : null}
      {dayMenu ? <DayMenuPopover anchor={dayMenu.anchor} dateISO={dayMenu.dateISO} events={eventsByDay.get(startOfDay(parseISO(dayMenu.dateISO) || new Date()).getTime()) || []} onClose={() => setDayMenu(null)} onDeleteEvent={deleteCalendarItem} onChoose={(key) => {
        if (key === "event") setEventModal({ date: dayMenu.dateISO });
        if (key === "task") setTaskModalDate(dayMenu.dateISO);
        if (key === "reminder") setReminderModalDate(dayMenu.dateISO);
        setDayMenu(null);
      }} /> : null}
      <DragGhost dragState={dragState} sourceColors={sourceColors} />
    </div>
  );
}
