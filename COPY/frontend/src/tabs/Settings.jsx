import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Checkbox, ColorPicker, STORAGE_KEY, downloadText, safeLoad, toCSV } from "../shared/crmShared.jsx";
import PhoneInput from "../components/PhoneInput";
import LogoutButton from "../components/LogoutButton";
import { supabase } from "../lib/supabase";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const COLUMN_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "GBP" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
];

function UiDropdown({ value, options, onChange, width }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 260 });

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;

    const recalc = () => {
      const r = btnRef.current?.getBoundingClientRect?.();
      if (!r) return;
      const menuW = Math.max(220, r.width);
      const menuH = Math.min(46 * options.length + 12, 320);
      const pad = 10;
      const maxX = Math.max(pad, (window.innerWidth || 0) - menuW - pad);
      const maxY = Math.max(pad, (window.innerHeight || 0) - menuH - pad);

      const x = Math.min(Math.max(pad, r.left), maxX);
      // Prefer opening downward, but flip up if needed
      const preferredY = r.bottom + 8;
      const yDown = Math.min(preferredY, maxY);
      const yUp = Math.max(pad, r.top - menuH - 8);
      const y = (preferredY > maxY && yUp < r.top) ? yUp : yDown;

      setPos({ x, y, w: menuW });
    };

    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);

    const onDocDown = (e) => {
      const t = e.target;
      if (btnRef.current && btnRef.current.contains(t)) return;
      if (menuRef.current && menuRef.current.contains(t)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onDocDown, true);

    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      document.removeEventListener("pointerdown", onDocDown, true);
    };
  }, [open, options.length]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="dropdownBtn"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: width || 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingRight: 10,
          cursor: "pointer",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ fontWeight: 600 }}>{selected?.label ?? value}</span>
        <span style={{ opacity: 0.85 }}>▼</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="portalPopover"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              padding: 6,
              maxHeight: 320,
              overflow: "auto",
            }}
            role="listbox"
          >
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <div
                  key={o.value}
                  className="menuItem uiMenuItem"
                  data-selected={isSel ? "true" : "false"}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 10px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{o.label}</span>
                  <span style={{ opacity: isSel ? 0.9 : 0.0 }}>{isSel ? "✓" : ""}</span>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeHex(raw, fallback = "#60a5fa") {
  try {
    if (!raw) return fallback;
    let s = String(raw).trim();
    if (!s) return fallback;
    if (s[0] !== "#") s = "#" + s;
    const hex = s.slice(1).replace(/[^0-9a-fA-F]/g, "");
    if (hex.length === 3) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return "#" + (r + g + b).toLowerCase();
    }
    if (hex.length === 6) return ("#" + hex).toLowerCase();
    return fallback;
  } catch {
    return fallback;
  }
}

function CustomColorSwatch({ value, onChange }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const hex = normalizeHex(value);

  useEffect(() => {
    if (!open) return;

    const w = 280;
    const h = 190;
    const pad = 12;
    const gutter = 18;

    const recalc = () => {
      const r = btnRef.current?.getBoundingClientRect?.();
      if (!r) return;

      const maxX = Math.max(pad, (window.innerWidth || 0) - w - pad - gutter);
      const maxY = Math.max(pad, (window.innerHeight || 0) - h - pad);

      const preferredX = r.left + r.width - w;
      const x = clamp(preferredX, pad, maxX);

      const preferredY = r.bottom + 8;
      const yDown = clamp(preferredY, pad, maxY);
      const yUp = clamp(r.top - h - 8, pad, maxY);
      const y = (preferredY + h > (window.innerHeight || 0) - pad) ? yUp : yDown;

      setPos({ x, y });
    };

    recalc();
    requestAnimationFrame(recalc);

    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);

    const onDocDown = (e) => {
      const t = e.target;
      if (btnRef.current && btnRef.current.contains(t)) return;
      if (popRef.current && popRef.current.contains(t)) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <>


      <button
        ref={btnRef}
        type="button"
        className="colorSwatchBtn"
        style={{ background: hex }}
        onClick={() => setOpen((v) => !v)}
        title="Pick any color"
        aria-haspopup="dialog"
        aria-expanded={open}
      />

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="portalPopover colorPopover"
            style={{ left: pos.x, top: pos.y, width: 280, padding: 10 }}
            role="dialog"
            aria-label="Custom color"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div className="colorPopoverTitle">Custom color</div>
              <button type="button" className="iconBtn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <input
              className="colorPickerInput"
              type="color"
              value={hex}
              onChange={(e) => onChange?.(e.target.value)}
            />

            <div className="colorPopoverHint">{hex}</div>
          </div>,
          document.body
        )}
    </>
  );
}

function StatusColorPicker({ value, onChange }) {
  return (

    
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <ColorPicker value={value} onChange={onChange} />
      </div>
      <CustomColorSwatch value={value} onChange={onChange} />
    </div>
  );
}



export default function SettingsPage({ data, setData, updateSettings, updateTabs, setConfirm, toastOk, ensureNotify, access = null }) {

  const [billingBusy, setBillingBusy] = useState(false);
  const isRestricted = Boolean(access?.isRestricted);
  const subscriptionStatus = String(access?.status || "").toLowerCase();
  const subscriptionLabel =
    subscriptionStatus === "trialing"
      ? "Trial active"
      : subscriptionStatus === "active"
      ? "Subscription active"
      : subscriptionStatus === "past_due"
      ? "Subscription past due"
      : subscriptionStatus === "canceled"
      ? "Subscription canceled"
      : "Access expired";


  async function syncMySubscription() {
    const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-my-subscription", {
      body: {},
    });

    if (syncError) throw new Error(syncError.message || "Failed to sync subscription");
    return syncData;
  }

  async function handleUpgradeToPro() {
    try {
      setBillingBusy(true);
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {},
      });

      if (error) throw new Error(error.message || "Upgrade failed");
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url;
    } catch (err) {
      alert(err?.message || "Upgrade failed");
    } finally {
      setBillingBusy(false);
    }
  }

  async function handleManageBilling() {
    try {
      setBillingBusy(true);

     const { data: sessionData } = await supabase.auth.getSession();

const accessToken = sessionData?.session?.access_token;

if (!accessToken) {
  alert("No session token");
  return;
}

const { data, error } = await supabase.functions.invoke(
  "create-customer-portal",
  {
    body: {},
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);

      if (error) throw new Error(error.message || "Failed to open billing portal");
      if (!data?.url) throw new Error("No portal URL returned");

      window.location.href = data.url;
    } catch (err) {
      alert(err?.message || "Failed to open billing portal");
    } finally {
      setBillingBusy(false);
    }
  }

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("checkout") !== "success") return;

    let cancelled = false;

    (async () => {
      try {
        setBillingBusy(true);
        await syncMySubscription();
        if (!cancelled) toastOk?.("Subscription synced");
      } catch (err) {
        if (!cancelled) alert(err?.message || "Failed to sync subscription");
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", url.toString());
        if (!cancelled) setBillingBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toastOk]);
  
  function addStatus() {
    setData((d) => ({ ...d, statuses: [...d.statuses, { id: crypto.randomUUID(), name: "New status", color: "#60a5fa" }] }));
    toastOk("Status added");
  }
  function updateStatus(id, patch) {
    setData((d) => ({ ...d, statuses: d.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }
  function deleteStatus(id) {
    if (id === "archived") return toastOk("Archive cannot be deleted");
    setConfirm({
      title: "Delete status",
      message: "Clients with this status will be set to Lead.",
      confirmText: "Delete",
      onConfirm: () => {
        setData((d) => {
          const nextStatuses = d.statuses.filter((s) => s.id !== id);
          const nextClients = d.clients.map((c) => (c.status === id ? { ...c, status: "lead", updatedAt: Date.now() } : c));
          return { ...d, statuses: nextStatuses, clients: nextClients };
        });
        setConfirm(null);
        toastOk("Status deleted");
      },
    });
  }
function setInvoiceProfileField(key, value) {
  updateSettings({
    invoiceProfile: {
      ...(data.settings.invoiceProfile || {}),
      [key]: value,
    },
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}

async function onPickInvoiceLogo(file) {
  if (!file) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    setInvoiceProfileField("logoDataUrl", dataUrl);
    toastOk?.("Logo saved");
  } catch {
    toastOk?.("Could not read logo");
  }
}

  return (
    

    
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingRight: 16 }}>
      <style>{`/* Settings-only polish: dropdown hover + custom scrollbars */
html { scrollbar-gutter: stable; }
:root { scrollbar-color: rgba(255,255,255,0.22) rgba(0,0,0,0); scrollbar-width: thin; }
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: rgba(255,255,255,0.18);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.26); }

.portalPopover { scrollbar-gutter: stable; padding-right: 8px; }
.portalPopover::-webkit-scrollbar { width: 12px; }
.portalPopover::-webkit-scrollbar-track { background: transparent; }
.portalPopover::-webkit-scrollbar-thumb {
  background-color: rgba(255,255,255,0.18);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
.portalPopover::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.26); }

.colorSwatchBtn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: inset 0 0 0 2px rgba(0,0,0,0.20);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}
.colorSwatchBtn:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.22); }
.colorSwatchBtn:active { transform: translateY(0px) scale(0.98); }

.colorPopoverTitle { font-weight: 600; font-size: 12px; opacity: 0.92; letter-spacing: 0.02em; }
.colorPickerInput {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  padding: 6px;
  cursor: pointer;
}
.colorPopoverHint { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.72); }

.uiMenuItem { border: 1px solid transparent; }
.uiMenuItem:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-1px);
}
.uiMenuItem:active { transform: translateY(0px); }
.uiMenuItem[data-selected="true"] {
  background: rgba(201,53,114,0.14);
  border-color: rgba(201,53,114,0.30);
}
.uiMenuItem[data-selected="true"]:hover {
  background: rgba(201,53,114,0.18);
  border-color: rgba(201,53,114,0.38);
}`}</style>

      {/* General */}
      <div className="card">
        <div className="cardTitle"><h3>General</h3></div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="fieldLabel">Company name</div>
            <input className="input" value={data.settings.companyName} onChange={(e) => updateSettings({ companyName: e.target.value })} style={{ width: "100%" }} />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="fieldLabel">Currency</div>
            <UiDropdown
              value={data.settings.currency}
              options={CURRENCY_OPTIONS}
              onChange={(v) => updateSettings({ currency: v })}
              width="100%"
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="fieldLabel">Theme</div>
            <UiDropdown
              value={data.settings.theme === "light" ? "light" : "dark"}
              options={THEME_OPTIONS}
              onChange={(v) => updateSettings({ theme: v })}
              width="100%"
            />
          </div>
        </div>
      </div>
<div className="card">
  <div className="cardTitle">
    <h3>Business Information</h3>
  </div>

  <div style={{ display: "grid", gap: 10 }}>
    <div>
      <div className="fieldLabel">Logo</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {data.settings.invoiceProfile?.logoDataUrl ? (
          <img
            src={data.settings.invoiceProfile.logoDataUrl}
            alt="Logo"
            style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 12 }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              border: "1px dashed rgba(255,255,255,0.18)",
            }}
          >
            LOGO
          </div>
        )}

        <label className="btn" style={{ cursor: "pointer" }}>
          Upload logo
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onPickInvoiceLogo(f);
              e.target.value = "";
            }}
          />
        </label>

        {!!data.settings.invoiceProfile?.logoDataUrl && (
          <button
            className="btn"
            type="button"
            onClick={() => setInvoiceProfileField("logoDataUrl", "")}
          >
            Remove
          </button>
        )}
      </div>
    </div>

    <div>
      <div className="fieldLabel">Full name</div>
      <input
        className="input"
        value={data.settings.invoiceProfile?.fullName || ""}
        onChange={(e) => setInvoiceProfileField("fullName", e.target.value)}
        placeholder="John Doe"
        style={{ width: "100%" }}
      />
    </div>

    <div>
      <div className="fieldLabel">Business name</div>
      <input
        className="input"
        value={data.settings.invoiceProfile?.businessName || ""}
        onChange={(e) => setInvoiceProfileField("businessName", e.target.value)}
        placeholder="Your Business Name"
        style={{ width: "100%" }}
      />
    </div>

    <div>
  <div className="fieldLabel">Phone number</div>

  <PhoneInput
    value={data.settings.invoiceProfile?.phone || ""}
    onChange={(v) => setInvoiceProfileField("phone", v)}
  />
</div>
    <div>
  <div className="fieldLabel">Email</div>
  <input
    className="input"
    value={data.settings.invoiceProfile?.email || ""}
    onChange={(e) => setInvoiceProfileField("email", e.target.value)}
    placeholder="hello@yourbusiness.com"
    style={{ width: "100%" }}
  />
</div>

    <div>
      <div className="fieldLabel">Address</div>
      <textarea
        className="input"
        value={data.settings.invoiceProfile?.address || ""}
        onChange={(e) => setInvoiceProfileField("address", e.target.value)}
        placeholder="Street, City, ZIP"
        style={{ width: "100%", minHeight: 90, resize: "vertical" }}
      />
    </div>
  </div>
</div>


      {/* Notifications */}
      <div className="card">
        <div className="cardTitle"><h3>Notifications</h3></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btnPrimary" onClick={() => ensureNotify()}>Enable notifications</button>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Permission: {("Notification" in window) ? Notification.permission : "Not supported"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="cardTitle"><h3>Tabs</h3></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Checkbox checked={!!data.settings.tabs.clients} onChange={(v) => updateTabs({ clients: v })} label="Clients" />
          <Checkbox checked={!!data.settings.tabs.tasks} onChange={(v) => updateTabs({ tasks: v })} label="Tasks" />
          <Checkbox checked={!!data.settings.tabs.budget} onChange={(v) => updateTabs({ budget: v })} label="Budget" />
          <Checkbox checked={!!data.settings.tabs.goals} onChange={(v) => updateTabs({ goals: v })} label="Goals" />
        </div>
      </div>


      {/* Columns */}
      <div className="card">
        <div className="cardTitle">
          <h3>Columns</h3>
          <button className="btn btnPrimary" onClick={() => { setData((d) => ({ ...d, columns: [...(d.columns || []), { id: crypto.randomUUID(), name: "New column", type: "text" }] })); toastOk("Column added"); }}>+ Add column</button>
        </div>

        {(data.columns || []).length === 0 && (
          <div style={{ color: "var(--muted)" }}>No custom columns yet.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(data.columns || []).map((c, idx) => (
            <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ width: 260 }}
                value={c.name || ""}
                onChange={(e) => setData((d) => ({ ...d, columns: d.columns.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))}
                placeholder="Column name"
              />
              <UiDropdown
                value={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                options={COLUMN_TYPE_OPTIONS}
                onChange={(v) =>
                  setData((d) => ({
                    ...d,
                    columns: d.columns.map((x) => (x.id === c.id ? { ...x, type: v } : x)),
                  }))
                }
                width={180}
              />
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button className="btn" onClick={() => setData((d) => {
                  const cols = [...(d.columns || [])];
                  const i = cols.findIndex((x) => x.id === c.id);
                  const to = i - 1;
                  if (i <= 0) return d;
                  const tmp = cols[i]; cols[i] = cols[to]; cols[to] = tmp;
                  return { ...d, columns: cols };
                })} title="Move up">Move Up</button>
                <button className="btn" onClick={() => setData((d) => {
                  const cols = [...(d.columns || [])];
                  const i = cols.findIndex((x) => x.id === c.id);
                  const to = i + 1;
                  if (i < 0 || to >= cols.length) return d;
                  const tmp = cols[i]; cols[i] = cols[to]; cols[to] = tmp;
                  return { ...d, columns: cols };
                })} title="Move down">Move Down</button>
                <button className="iconBtn iconBtnDanger" onClick={() => setConfirm({
                  title: "Delete column",
                  message: "This deletes the column and removes its data from all clients.",
                  confirmText: "Delete",
                  onConfirm: () => {
                    setData((d) => {
                      const nextCols = (d.columns || []).filter((x) => x.id !== c.id);
                      const nextClients = (d.clients || []).map((cl) => {
                        const nf = { ...(cl.fields || {}) };
                        delete nf[c.id];
                        return { ...cl, fields: nf };
                      });
                      return { ...d, columns: nextCols, clients: nextClients };
                    });
                    setConfirm(null);
                    toastOk("Column deleted");
                  }
                })} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statuses */}
      <div className="card" style={{ maxWidth: 640, width: "100%", alignSelf: "flex-start" }}>
        <div className="cardTitle">
          <h3>Statuses</h3>
          <button className="btn btnPrimary" onClick={addStatus}>+ Add status</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.statuses.map((s) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 180px 36px", gap: 10, alignItems: "center" }}>
              <input className="input" style={{ width: "100%", minWidth: 240 }} value={s.name} onChange={(e) => updateStatus(s.id, { name: e.target.value })} />
              <div style={{ width: 180, flexShrink: 0, display: "flex", justifyContent: "flex-start" }}>
              <StatusColorPicker value={s.color} onChange={(c) => updateStatus(s.id, { color: c })} />
            </div>
              <button className="iconBtn iconBtnDanger" onClick={() => deleteStatus(s.id)} title="Delete">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="card">
        <div className="cardTitle"><h3>Export</h3></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btnPrimary"
            onClick={() => {
              const rows = [
                ["Name", "Status", "Tags", "Notes", ...((data.columns || []).map((c) => c.name))],
                ...(data.clients || []).map((c) => [
                  c.name || "",
                  (data.statuses.find((s) => s.id === c.status)?.name) || "",
                  (c.tags || []).join(" | "),
                  c.notes || "",
                  ...((data.columns || []).map((col) => (c.fields || {})[col.id] || "")),
                ]),
              ];
              downloadText("clients.csv", toCSV(rows));
            }}
          >
            Export clients (CSV)
          </button>

          <button
            className="btn"
            onClick={() => {
              const rows = [
                ["Task", "Priority", "Due", "Client", "Done"],
                ...(data.tasks || []).map((t) => [
                  t.title || "",
                  t.priority || "",
                  t.due || "",
                  t.clientId ? ((data.clients || []).find((c) => c.id === t.clientId)?.name || "") : "",
                  t.done ? "Yes" : "No",
                ]),
              ];
              downloadText("tasks.csv", toCSV(rows));
            }}
          >
            Export tasks (CSV)
          </button>

          <button
            className="btn"
            onClick={() => {
              const rows = [
                ["Type", "Description", "Category", "Amount", "Recurring", "EveryDays", "Date"],
                ...(data.budget || []).map((b) => [
                  b.type || "",
                  b.desc || "",
                  b.category || "",
                  b.amount ?? "",
                  b.recurring?.mode || "One-off",
                  b.recurring?.everyDays || "",
                  b.date || "",
                ]),
              ];
              downloadText("budget.csv", toCSV(rows));
            }}
          >
            Export budget (CSV)
          </button>
        </div>
      </div>
      <div className="card">
        <div className="cardTitle"><h3>Account</h3></div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid var(--stroke)",
            background: "rgba(255,255,255,0.05)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 12,
          }}
        >
          {subscriptionLabel}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {isRestricted ? (
            <button
              className="btn"
              onClick={handleManageBilling}
              disabled={billingBusy}
              style={{
                borderColor: "rgba(201,53,114,0.42)",
                background: "linear-gradient(135deg, rgba(201,53,114,0.18), rgba(122,31,128,0.16))",
              }}
            >
              {billingBusy ? "Please wait..." : "Manage billing"}
            </button>
          ) : (
            <button
              className="btn"
              onClick={handleUpgradeToPro}
              disabled={billingBusy}
              style={{
                borderColor: "rgba(201,53,114,0.42)",
                background: "linear-gradient(135deg, rgba(201,53,114,0.18), rgba(122,31,128,0.16))",
              }}
            >
              {billingBusy ? "Please wait..." : "Upgrade to Pro"}
            </button>
          )}
          <button
            className="btn"
            onClick={async () => {
              try {
                setBillingBusy(true);
                await syncMySubscription();
                toastOk?.("Subscription synced");
              } catch (err) {
                alert(err?.message || "Failed to sync subscription");
              } finally {
                setBillingBusy(false);
              }
            }}
            disabled={billingBusy}
          >
            Sync subscription
          </button>
          <LogoutButton />
        </div>
      </div>
      {/* Reset local demo data (still needed, but no â€œdanger zoneâ€ label) */}
      <div className="card">
        <div className="cardTitle"><h3>Reset</h3></div>
        <button
          className="btn"
          style={{ borderColor: "rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.14)" }}
          onClick={() => setConfirm({
            title: "Reset everything",
            message: "This wipes all local data for this CRM on this device.",
            confirmText: "Reset",
            onConfirm: () => {
              localStorage.removeItem(STORAGE_KEY);
              setData(safeLoad());
              setConfirm(null);
              toastOk("Reset complete");
            },
          })}
        >
          Reset everything
        </button>
      </div>
    </div>
  );
}

/* =========================
   Modals
========================= */