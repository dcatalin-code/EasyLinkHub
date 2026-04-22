const KEY = "glass_crm_v1";

const defaultState = {
  me: { name: "Cristian", company: "My CRM" },

  contacts: [
    { id: crypto.randomUUID(), name: "Ava Stone", company: "Northwind", email: "ava@northwind.com", phone: "+1 555 0101", tag: "Warm", createdAt: Date.now() - 86400000 * 3 },
    { id: crypto.randomUUID(), name: "Noah Kim", company: "Blue Peak", email: "noah@bluepeak.io", phone: "+1 555 0102", tag: "Hot", createdAt: Date.now() - 86400000 * 2 },
    { id: crypto.randomUUID(), name: "Mia Patel", company: "Cedar Labs", email: "mia@cedarlabs.ai", phone: "+1 555 0103", tag: "Cold", createdAt: Date.now() - 86400000 * 7 },
  ],

  deals: [
    { id: crypto.randomUUID(), title: "Website redesign", company: "Northwind", value: 4200, stage: "Discovery", owner: "You", updatedAt: Date.now() - 3600000 * 9 },
    { id: crypto.randomUUID(), title: "Monthly retainer", company: "Blue Peak", value: 1500, stage: "Proposal", owner: "You", updatedAt: Date.now() - 3600000 * 20 },
    { id: crypto.randomUUID(), title: "CRM setup", company: "Cedar Labs", value: 2800, stage: "Negotiation", owner: "You", updatedAt: Date.now() - 3600000 * 40 },
  ],

  tasks: [
    { id: crypto.randomUUID(), text: "Follow up with Northwind", done: false, due: "Today" },
    { id: crypto.randomUUID(), text: "Send proposal to Blue Peak", done: false, due: "Tomorrow" },
    { id: crypto.randomUUID(), text: "Review Cedar Labs notes", done: true, due: "This week" },
  ],

  notes: {
    id: crypto.randomUUID(),
    title: "Quick playbook",
    content: "Keep it simple. One screen. One next action. No clutter.",
    createdAt: Date.now(),
  },

  // 🔥 NEW CALENDAR SYSTEM
  calendarEvents: [],

  // 🔔 REMINDERS SYSTEM
  reminders: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);

    return {
      ...defaultState,
      ...parsed,
      calendarEvents: parsed.calendarEvents || [],
      reminders: parsed.reminders || [],
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}