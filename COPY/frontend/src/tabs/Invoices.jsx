import html2pdf from "html2pdf.js";
import emailjs from "@emailjs/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import PhoneInput from "../components/PhoneInput";

function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return "id_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

function clamp(n, a, b) {
  return Math.min(Math.max(n, a), b);
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

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(amount, currency = "USD", locale) {
  const n = toNum(amount, 0);
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso, days) {
  const d = new Date(iso || isoToday());
  if (isNaN(d)) return isoToday();
  d.setDate(d.getDate() + (Number(days) || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pick(obj, path, fallback) {
  try {
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) cur = cur?.[p];
    return cur ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeAddressLines(text) {
  const s = (text || "").replace(/\r\n/g, "\n");
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    } catch (e) {
      reject(e);
    }
  });
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function safeWindowOpen() {
  const w = window.open("", "_blank", "noopener,noreferrer");
  return w || null;
}

function buildStandaloneInvoiceHtml({ docTitle, css, bodyHtml }) {
  const safeTitle = String(docTitle || "Invoice").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function IconPlus({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7l1-2h4l1 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7l1 14h10l1-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPrint({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 8V4h10v4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 17h10v3H7v-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 10h12a2 2 0 0 1 2 2v5h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 17H3v-5a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconImage({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M21 16l-5-5-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 17l-2-2-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`invPill invPill_${tone}`}>{children}</span>;
}
function getInvoiceProfile(data) {
  const p = data?.settings?.invoiceProfile || {};
  return {
    logoDataUrl: p.logoDataUrl || "",
    fullName: p.fullName || "",
    businessName: p.businessName || "",
    email: p.email || "",
    phone: p.phone || "",
    address: p.address || "",
  };
}


function buildFromProfile(data) {
  const p = getInvoiceProfile(data);
  return {
    name: p.businessName || p.fullName || "",
    email: p.email || "",
    phone: p.phone || "",
    address: p.address || "",
    logoDataUrl: p.logoDataUrl || "",
  };
}


function ensureInvoiceShape(inv, data) {
  const companyName = pick(data, "settings.companyName", "Your Business");
  const defaults = pick(data, "settings.invoiceDefaults", null) || {};

  const fromName = inv?.from?.name ?? defaults?.from?.name ?? companyName;
  const fromEmail = inv?.from?.email ?? defaults?.from?.email ?? "";
  const fromPhone = inv?.from?.phone ?? defaults?.from?.phone ?? "";
  const fromAddress = inv?.from?.address ?? defaults?.from?.address ?? "";
  const fromLogo = inv?.from?.logoDataUrl ?? defaults?.from?.logoDataUrl ?? "";

  const currency = inv?.currency ?? defaults?.currency ?? "USD";
  const taxRate = inv?.taxRate ?? defaults?.taxRate ?? 0;
  const notes = inv?.notes ?? defaults?.notes ?? "";
  const terms = inv?.terms ?? defaults?.terms ?? "";

  const issueDate = inv?.issueDate || isoToday();
  const dueDate = inv?.dueDate || addDaysIso(issueDate, 14);

  const items = Array.isArray(inv?.items) && inv.items.length
    ? inv.items
    : [{ id: uid(), description: "", quantity: 1, rate: 0 }];

  return {
    id: inv?.id || uid(),
    status: inv?.status || "draft",
    number: inv?.number || "",
    currency,
    issueDate,
    dueDate,
    reference: inv?.reference || "",
  billTo: {
  name: inv?.billTo?.name ?? "",
  email: inv?.billTo?.email ?? "",
  phone: inv?.billTo?.phone ?? "",
  address: inv?.billTo?.address ?? "",
},
    from: {
      name: fromName,
      email: fromEmail,
      phone: fromPhone,
      address: fromAddress,
      logoDataUrl: fromLogo,
    },
    items,
    taxRate,
    discount: inv?.discount ?? 0,
    shipping: inv?.shipping ?? 0,
    notes,
    terms,
  };
}

function computeTotals(inv) {
  const sub = (inv.items || []).reduce((acc, it) => {
    const qty = clamp(toNum(it.quantity, 0), 0, 1e9);
    const rate = clamp(toNum(it.rate, 0), 0, 1e12);
    return acc + qty * rate;
  }, 0);

  const discount = clamp(toNum(inv.discount, 0), -1e12, 1e12);
  const shipping = clamp(toNum(inv.shipping, 0), -1e12, 1e12);

  const taxableBase = Math.max(0, sub - Math.max(0, discount) + Math.max(0, shipping));
  const taxRate = clamp(toNum(inv.taxRate, 0), 0, 100);
  const tax = taxableBase * (taxRate / 100);
  const total = sub - discount + shipping + tax;

  return { subtotal: sub, discount, shipping, taxRate, tax, total };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function invoiceDocCss() {
  return `
    :root{--docText:#121316;--muted:#60646C;--line:#E7E8EC;--bg:#ffffff;--soft:#F6F7F9;--accent:#C93572;}
    *{box-sizing:border-box}
    body{margin:0;background:var(--soft);color:var(--docText);font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";}
    .sheetWrap{padding:24px;display:flex;justify-content:center;}
    .sheet{width:min(860px, 100%);background:var(--bg);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 40px rgba(20,20,22,.10);overflow:hidden;}
    .top{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;padding:28px 28px 18px;}
    .brand{display:flex;gap:14px;align-items:center;min-width:260px;}
    .logoBox{width:62px;height:62px;border-radius:16px;border:1px dashed #D7D9E0;background:linear-gradient(180deg,#FAFAFB,#F2F3F6);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 62px;}
    .logoBox img{width:100%;height:100%;object-fit:cover;}
    .brandName{font-weight:600;letter-spacing:.2px;font-size:18px;line-height:1.1;}
    .brandMeta{margin-top:4px;color:var(--muted);font-size:12.5px;line-height:1.4;white-space:pre-line;}
    .rightMeta{text-align:right;min-width:240px;}
    .title{font-size:22px;font-weight:600;letter-spacing:.3px;margin:0;}
    .badge{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:6px 10px;margin-top:10px;background:#fff;}
    .dot{width:8px;height:8px;border-radius:99px;background:var(--accent);}
    .metaGrid{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;justify-items:end;}
    .metaItem{min-width:160px;}
    .metaLabel{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;}
    .metaVal{font-size:13.5px;font-weight:600;margin-top:2px;}
    .divider{height:1px;background:var(--line);}
    .mid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px 28px;}
    .panelTitle{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;}
    .who{font-size:13.5px;line-height:1.5;white-space:pre-line;}
    .who strong{font-weight:600;}
    .table{padding:0 28px 18px;}
    table{width:100%;border-collapse:separate;border-spacing:0;}
    thead th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);}
    tbody td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13.5px;}
    .num{text-align:right;white-space:nowrap;}
    .desc{font-weight:600;}
    .sub{color:var(--muted);font-size:12.5px;margin-top:3px;}
    .totalsWrap{display:flex;justify-content:flex-end;padding:0 28px 26px;}
    .totals{width:min(340px, 100%);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
    .row{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;background:#fff;}
    .row + .row{border-top:1px solid var(--line);}
    .row strong{font-weight:600;}
    .rowMuted{color:var(--muted)}
    .grand{background:linear-gradient(180deg,#fff,#FAFAFB);}
    .foot{padding:0 28px 28px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px;}
    .box{border:1px solid var(--line);border-radius:16px;padding:14px;background:#fff;}
    .box p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.55;white-space:pre-line;}
    .box strong{color:var(--docText)}

    @media print{
      body{background:#fff;}
      .sheetWrap{padding:0}
      .sheet{width:100%;border:none;border-radius:0;box-shadow:none;}
    }
  `;
}

function buildInvoiceBodyHtml(inv, totals, locale) {
  const fromAddr = normalizeAddressLines(inv.from.address).join("\n");
  const billAddr = normalizeAddressLines(inv.billTo.address).join("\n");

  const fromLines = [
    `<strong>${escapeHtml(inv.from.name || "")}</strong>`,
    inv.from.email ? escapeHtml(inv.from.email) : "",
    inv.from.phone ? escapeHtml(inv.from.phone) : "",
    fromAddr ? escapeHtml(fromAddr) : "",
  ].filter(Boolean).join("\n");

const billLines = [
  `<strong>${escapeHtml(inv.billTo.name || "")}</strong>`,
  inv.billTo.email ? escapeHtml(inv.billTo.email) : "",
  inv.billTo.phone ? escapeHtml(inv.billTo.phone) : "",
  billAddr ? escapeHtml(billAddr) : "",
].filter(Boolean).join("\n");

  const itemsRows = (inv.items || []).map((it) => {
    const qty = clamp(toNum(it.quantity, 0), 0, 1e9);
    const rate = clamp(toNum(it.rate, 0), 0, 1e12);
    const line = qty * rate;
    const desc = escapeHtml(it.description || "");
    return `
      <tr>
        <td>
          <div class="desc">${desc || "Item"}</div>
        </td>
        <td class="num">${escapeHtml(String(qty || ""))}</td>
        <td class="num">${escapeHtml(formatMoney(rate, inv.currency, locale))}</td>
        <td class="num"><strong>${escapeHtml(formatMoney(line, inv.currency, locale))}</strong></td>
      </tr>
    `;
  }).join("");

  const logoHtml = inv.from.logoDataUrl
    ? `<img src="${escapeHtml(inv.from.logoDataUrl)}" alt="Logo" />`
    : `<span style="color:#8C9099;font-weight:600;font-size:12px;">LOGO</span>`;

  return `
    <div class="sheetWrap">
      <div class="sheet">
        <div class="top">
          <div class="brand">
            <div class="logoBox">${logoHtml}</div>
            <div>
              <div class="brandName">
  ${escapeHtml(inv.from.name || inv.from.email || "Your Business")}
</div>
              <div class="brandMeta">${escapeHtml([inv.from.email, inv.from.phone, fromAddr].filter(Boolean).join("\n"))}</div>
            </div>
          </div>

          <div class="rightMeta">
            <h1 class="title">Invoice</h1>
            <div class="metaGrid">
              <div class="metaItem">
                <div class="metaLabel">Invoice #</div>
                <div class="metaVal">${escapeHtml(inv.number || "")}</div>
              </div>
              <div class="metaItem">
                <div class="metaLabel">Date</div>
                <div class="metaVal">${escapeHtml(inv.issueDate || "")}</div>
              </div>
              <div class="metaItem">
                <div class="metaLabel">Due</div>
                <div class="metaVal">${escapeHtml(inv.dueDate || "")}</div>
              </div>
              <div class="metaItem">
                <div class="metaLabel">Reference</div>
                <div class="metaVal">${escapeHtml(inv.reference || "—")}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="divider"></div>

        <div class="mid">
          <div>
            <div class="panelTitle">Bill To</div>
            <div class="who">${billLines || "—"}</div>
          </div>
          <div>
            <div class="panelTitle">From</div>
            <div class="who">${fromLines || "—"}</div>
          </div>
        </div>

        <div class="table">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Qty</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <div class="totalsWrap">
          <div class="totals">
            <div class="row"><span class="rowMuted">Subtotal</span><span>${escapeHtml(formatMoney(totals.subtotal, inv.currency, locale))}</span></div>
            <div class="row"><span class="rowMuted">Discount</span><span>${escapeHtml(formatMoney(-Math.abs(totals.discount || 0), inv.currency, locale))}</span></div>
            <div class="row"><span class="rowMuted">Shipping</span><span>${escapeHtml(formatMoney(totals.shipping, inv.currency, locale))}</span></div>
            <div class="row"><span class="rowMuted">Tax (${escapeHtml(String(totals.taxRate || 0))}%)</span><span>${escapeHtml(formatMoney(totals.tax, inv.currency, locale))}</span></div>
            <div class="row grand"><strong>Total</strong><strong>${escapeHtml(formatMoney(totals.total, inv.currency, locale))}</strong></div>
          </div>
        </div>

        <div class="foot">
          <div class="box">
            <div class="panelTitle" style="margin-bottom:8px;">Notes</div>
            <p>${escapeHtml(inv.notes || "") || "—"}</p>
          </div>
          <div class="box">
            <div class="panelTitle" style="margin-bottom:8px;">Terms</div>
            <p>${escapeHtml(inv.terms || "") || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default function InvoicesPage({ data, setData, setConfirm, toastOk }) {
  const injectedOnce = useRef(false);
  useEffect(() => {
    if (injectedOnce.current) return;
    injectedOnce.current = true;

    const id = "invoices-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .invWrap{display:grid;grid-template-columns:340px 1fr;gap:14px;align-items:start;}
      @media (max-width: 980px){.invWrap{grid-template-columns:1fr;}}

      .invSendOverlay{
  position:fixed;
  inset:0;
  z-index:80;
  background:rgba(6,8,12,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
}

.invSendModal{
  width:min(520px,100%);
  border-radius:22px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(20,22,28,.96);
  box-shadow:0 18px 60px rgba(0,0,0,.38);
  padding:16px;
}

:root[data-theme="light"] .invSendModal{
  border:1px solid rgba(0,0,0,.08);
  background:rgba(255,255,255,.98);
}


      .invCard{border-radius:22px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);backdrop-filter: blur(10px);box-shadow: 0 10px 32px rgba(0,0,0,0.24);}
      :root[data-theme="light"] .invCard{border:1px solid rgba(0,0,0,0.08);background:rgba(255,255,255,0.76);box-shadow: 0 10px 32px rgba(0,0,0,0.10);} 

      .invSide{padding:12px;}
      .invHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      .invTitle{font-weight:600;letter-spacing:.2px;}
      .invSearch{width:100%;margin-top:10px;}

      .invList{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height: calc(100vh - 210px);overflow:auto;padding-right:4px;}
      @media (max-width: 980px){.invList{max-height: unset;}}

.invRow{
  display:flex;
  gap:10px;
  align-items:flex-start;
  justify-content:space-between;
  padding:10px 10px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(0,0,0,0.10);
  cursor:pointer;
  transform:none;
  transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
}

:root[data-theme="light"] .invRow{
  border:1px solid rgba(0,0,0,0.08);
  background:rgba(255,255,255,0.72);
}

.invRow:hover{
  transform:none;
  border-color:rgba(201,53,114,0.40);
  box-shadow:0 8px 20px rgba(0,0,0,0.10);
}

.invRowNum{
  font-weight:600;
  white-space:nowrap;
  letter-spacing:.01em;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  text-rendering:geometricPrecision;
}

.invRowAmt{
  font-weight:600;
  white-space:nowrap;
}
      .invRowMeta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;}

      .invPill{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.10);background: rgba(255,255,255,0.06);}
      :root[data-theme="light"] .invPill{border:1px solid rgba(0,0,0,0.08);background: rgba(255,255,255,0.78);} 
      .invPill_draft{color: #E6E6E6;}
      :root[data-theme="light"] .invPill_draft{color: #2A2B2E;}
      .invPill_sent{color: rgba(201,53,114,0.95);border-color: rgba(201,53,114,0.40);background: rgba(201,53,114,0.10);} 
      .invPill_paid{color: rgba(73, 218, 143, 0.95);border-color: rgba(73, 218, 143, 0.35);background: rgba(73, 218, 143, 0.12);} 

      .invMain{padding:12px;}
      .invMainGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 14px;
  align-items: start;
}
      @media (max-width: 1120px){.invMainGrid{grid-template-columns:1fr;}}

      .invPanel{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background: rgba(0,0,0,0.08);} 
      :root[data-theme="light"] .invPanel{border:1px solid rgba(0,0,0,0.08);background: rgba(255,255,255,0.74);} 

      .invPanelTitle{font-weight:600;letter-spacing:.2px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .invHint{color:var(--muted);font-size:12.5px;}

.invForm {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}
      .invLabel{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px;}
      .invField{width:100%;}
      .invTextArea{min-height:92px;resize: vertical;}

      .invItems{display:flex;flex-direction:column;gap:8px;}
      .invItem{display:grid;grid-template-columns: 1.6fr .55fr .7fr .55fr;gap:8px;align-items:center;padding:10px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);background: rgba(255,255,255,0.04);} 
      :root[data-theme="light"] .invItem{border:1px solid rgba(0,0,0,0.08);background: rgba(255,255,255,0.86);} 
      @media (max-width: 720px){.invItem{grid-template-columns: 1fr 1fr;}}

      .invItemActions{display:flex;justify-content:flex-end;}

      .invToolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;margin-bottom:10px;}
      .invToolbar .btn{display:inline-flex;align-items:center;gap:8px;}


      .invPreviewWrap{border-radius:18px;border:1px solid rgba(255,255,255,0.10);background: rgba(255,255,255,0.04);overflow:hidden;}
      :root[data-theme="light"] .invPreviewWrap{border:1px solid rgba(0,0,0,0.10);background: rgba(255,255,255,0.92);} 
      .invPreviewTop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);}
      :root[data-theme="light"] .invPreviewTop{border-bottom:1px solid rgba(0,0,0,0.08);} 
      .invPreviewLabel{font-weight:600;}
      .invPreviewInner{padding:10px;}
      .invIframe{width:100%;height: 760px;border:0;border-radius:14px;background:#fff;}
      @media (max-width: 980px){.invIframe{height: 680px;}}

      .invMiniBtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;border:1px solid rgba(255,255,255,0.10);background: rgba(255,255,255,0.06);padding:10px 12px;font-weight:600;cursor:pointer;}
      :root[data-theme="light"] .invMiniBtn{border:1px solid rgba(0,0,0,0.10);background: rgba(255,255,255,0.86);} 
      .invMiniBtn:hover{border-color: rgba(201,53,114,0.40);} 

      .invLogoActions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .invLogoThumb{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background: rgba(255,255,255,0.06);overflow:hidden;display:flex;align-items:center;justify-content:center;}
      :root[data-theme="light"] .invLogoThumb{border:1px solid rgba(0,0,0,0.10);background: rgba(255,255,255,0.86);} 
      .invLogoThumb img{width:100%;height:100%;object-fit:cover;}
      .invLogoStub{font-weight:600;font-size:12px;color:var(--muted);}

      .invTwoCol{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      @media (max-width: 720px){.invTwoCol{grid-template-columns:1fr;}}

      .invKpiRow{display:flex;gap:10px;flex-wrap:wrap;}
      .invKpi{flex:1;min-width: 150px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);background: rgba(255,255,255,0.04);padding:10px 12px;}
      :root[data-theme="light"] .invKpi{border:1px solid rgba(0,0,0,0.08);background: rgba(255,255,255,0.86);} 
      .invKpiLabel{font-size:12px;color:var(--muted);font-weight:600;}
      .invKpiVal{font-size:16px;font-weight:600;margin-top:4px;}

      .invErr{padding:10px 12px;border-radius:16px;border:1px solid rgba(201,53,114,0.35);background: rgba(201,53,114,0.10);font-weight:600;}
    `;
    document.head.appendChild(style);
  }, []);

  const invoices = useMemo(() => {
    const list = Array.isArray(data?.invoices) ? data.invoices : [];
    return list;
  }, [data]);
  
  const [query, setQuery] = useState("");
 
  const [sendModal, setSendModal] = useState(null);
  const [sending, setSending] = useState(false);


  const normalizedInvoices = useMemo(() => {
    return invoices
      .map((x) => ensureInvoiceShape(x, data))
      .sort((a, b) => String(b.issueDate || "").localeCompare(String(a.issueDate || "")));
  }, [invoices, data]);
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedInvoices;
    return normalizedInvoices.filter((inv) => {
      const blob = [inv.number, inv.billTo?.name, inv.billTo?.email,inv.billTo?.phone, inv.reference]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [normalizedInvoices, query]);

  const [activeId, setActiveId] = useState(() => filtered[0]?.id || null);

  useEffect(() => {
    if (!activeId && filtered[0]?.id) setActiveId(filtered[0].id);
    if (activeId && !filtered.some((x) => x.id === activeId)) {
      setActiveId(filtered[0]?.id || null);
    }
  }, [filtered, activeId]);

  const active = useMemo(() => {
    const found = normalizedInvoices.find((x) => x.id === activeId);
    return found || null;
  }, [normalizedInvoices, activeId]);

const [draft, setDraft] = useState(() =>
  active ? ensureInvoiceShape(active, data) : null
);

  useEffect(() => {
  if (!active) {
    setDraft(null);
    return;
  }

  setDraft(ensureInvoiceShape(active, data));
}, [active, data]);


const totals = useMemo(() => {
  if (!draft) {
    return {
      subtotal: 0,
      discount: 0,
      shipping: 0,
      taxRate: 0,
      tax: 0,
      total: 0,
    };
  }

  return computeTotals(draft);
}, [draft]);


  const iframeRef = useRef(null);
  const [previewKey, setPreviewKey] = useState(0);

  const previewHtml = useMemo(() => {
  if (!draft) return "";

  const css = invoiceDocCss();
  const bodyHtml = buildInvoiceBodyHtml(draft, totals);
  return buildStandaloneInvoiceHtml({
    docTitle: `Invoice ${draft.number}`.trim(),
    css,
    bodyHtml,
  });
}, [draft, totals]);


function openSendModal() {
  setSendModal({
    channel: "email",
    email: draft?.billTo?.email || "",
    phone: draft?.billTo?.phone || "",
  });
}

function normalizeWhatsappPhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function invoiceShareMessage() {
  return [
    `Hello${draft?.billTo?.name ? ` ${draft.billTo.name}` : ""},`,
    ``,
    `Please find invoice ${draft?.number || ""}.`,
    `Issue date: ${draft?.issueDate || ""}`,
    `Due date: ${draft?.dueDate || ""}`,
    `Total: ${formatMoney(totals.total, draft.currency)}`,
  ].join("\n");
}

function sendInvoiceNow() {
  if (!sendModal) return;

  const subject = `Invoice ${draft?.number || ""}`.trim();
  const body = invoiceShareMessage();

  if (sendModal.channel === "email") {
    const to = (sendModal.email || "").trim();
    if (!to) {
      toastOk?.("Add an email address");
      return;
    }
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    toastOk?.("Opening email app");
    setSendModal(null);
    return;
  }

  const phone = normalizeWhatsappPhone(sendModal.phone);
  if (!phone) {
    toastOk?.("Add a phone number");
    return;
  }

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
  window.open(href, "_blank", "noopener,noreferrer");
  toastOk?.("Opening WhatsApp");
  setSendModal(null);
}


  useEffect(() => {
    setPreviewKey((k) => k + 1);
  }, [previewHtml]);

  function setDraftField(path, value) {
    setDraft((d) => {
      const next = structuredClone ? structuredClone(d) : JSON.parse(JSON.stringify(d));
      const parts = String(path).split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function bumpInvoiceNumber(list) {
    const used = new Set(list.map((x) => String(x.number || "").trim()).filter(Boolean));
    let n = 1001;
    while (used.has(`INV-${n}`)) n++;
    return `INV-${n}`;
  }

  function createNewInvoice() {
    const base = ensureInvoiceShape(null, data);
    base.number = bumpInvoiceNumber(normalizedInvoices);
    base.issueDate = isoToday();
    base.dueDate = addDaysIso(base.issueDate, 14);
    base.status = "draft";

    setData?.((d) => {
      const next = { ...d };
      const arr = Array.isArray(next.invoices) ? next.invoices.slice() : [];
      arr.unshift(base);
      next.invoices = arr;
      return next;
    });

    toastOk?.("Invoice created");
    setActiveId(base.id);
  }

  function saveInvoice(nextInv) {
    const inv = ensureInvoiceShape(nextInv || draft, data);
    if (!inv.number) inv.number = bumpInvoiceNumber(normalizedInvoices);

    setData?.((d) => {
      const next = { ...d };
      const arr = Array.isArray(next.invoices) ? next.invoices.slice() : [];
      const idx = arr.findIndex((x) => x.id === inv.id);
      if (idx >= 0) arr[idx] = inv;
      else arr.unshift(inv);
      next.invoices = arr;

    

      return next;
    });

    toastOk?.("Saved");
  }

function createNewInvoice() {
  const profileFrom = buildFromProfile(data);

  const base = {
    id: uid(),
    status: "draft",
    number: bumpInvoiceNumber(normalizedInvoices),
    currency: data?.settings?.currency || "USD",
    issueDate: isoToday(),
    dueDate: addDaysIso(isoToday(), 14),
    reference: "",
    billTo: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
    from: profileFrom,
    items: [{ id: uid(), description: "", quantity: 1, rate: 0 }],
    taxRate: 0,
    discount: 0,
    shipping: 0,
    notes: "",
    terms: "",
  };

  setData?.((d) => {
    const next = { ...d };
    const arr = Array.isArray(next.invoices) ? next.invoices.slice() : [];
    arr.unshift(base);
    next.invoices = arr;
    return next;
  });

  toastOk?.("Invoice created");
  setActiveId(base.id);
}



  function deleteInvoice(id) {
    if (!id) return;
    const inv = normalizedInvoices.find((x) => x.id === id);
    const title = inv?.number ? `Delete ${inv.number}?` : "Delete invoice?";
    
const doDelete = () =>
  setData?.((d) => {
    const next = { ...d };
    next.invoices = Array.isArray(next.invoices)
      ? next.invoices.filter((x) => x.id !== id)
      : [];

    next.settings = {
      ...next.settings,
      invoiceDefaults: {
        from: {
          name: "",
          email: "",
          phone: "",
          address: "",
          logoDataUrl: "",
        },
        currency: "USD",
        taxRate: 0,
        notes: "",
        terms: "",
      },
    };

    return next;
  });

    if (setConfirm) {
      setConfirm({
        title,
        message: "This can’t be undone.",
        confirmText: "Delete",
        onConfirm: () => {
          doDelete();
          setConfirm(null);
        },
      });
    } else {
      if (window.confirm("Delete invoice?")) doDelete();
    }
  }

  async function onPickLogo(file) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraftField("from.logoDataUrl", dataUrl);
      toastOk?.("Logo added");
    } catch {
      toastOk?.("Couldn’t read that file");
    }
  }

function doPrint() {
  const frame = iframeRef.current;
  const win = frame?.contentWindow;

  if (!frame || !win) {
    toastOk?.("Preview not ready yet");
    return;
  }

  try {
    win.focus();

    setTimeout(() => {
      try {
        win.print();
      } catch {
        toastOk?.("Could not open print dialog");
      }
    }, 150);
  } catch {
    toastOk?.("Could not open print dialog");
  }
}
async function doPdfDownload() {
  try {
    // Get the iframe's HTML content
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    if (!win) {
      toastOk?.("Preview not ready yet");
      return;
    }

    // Get the full HTML from the iframe
    const htmlContent = win.document.documentElement.outerHTML;

    // Create a Blob and trigger download
    const blob = new Blob([htmlContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.number || "invoice"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);

    toastOk?.("Invoice downloaded");
  } catch (err) {
    toastOk?.("Could not download invoice");
  }
}


async function doDownloadPdf() {
  let mount = null;

  try {
    const safeNum = (draft.number || "invoice").replace(/[^a-z0-9-]+/gi, "_");

    mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "0";
    mount.style.width = "860px";
    mount.style.background = "#ffffff";
    mount.style.zIndex = "-1";
    mount.innerHTML = previewHtml;

    document.body.appendChild(mount);

    const el = mount.querySelector(".sheet") || mount.firstElementChild || mount;

    await html2pdf()
      .set({
        margin: 0,
        filename: `${safeNum}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(el)
      .save();

    toastOk?.("PDF downloaded");
  } catch (err) {
    toastOk?.("Could not generate PDF");
  } finally {
    if (mount) mount.remove();
  }
}


  function doMarkStatus(nextStatus) {
    setDraft((d) => ({ ...d, status: nextStatus }));
    toastOk?.("Status updated");
  }
function openSendModal(channel = "email") {
  setSendModal({
    channel,
    email: draft?.billTo?.email || "",
    phone: draft?.billTo?.phone || "",
  });
}

function normalizeWhatsappPhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

async function sendInvoiceNow() {
  if (!sendModal || sending) return;

  const channel = sendModal.channel;
  setSending(true);

  try {
    saveInvoice();

    const body = [
      `Hello${draft?.billTo?.name ? ` ${draft.billTo.name}` : ""},`,
      `Please find attached invoice ${draft?.number || ""}.`,
      `Issue date: ${draft?.issueDate || ""}.`,
      `Due date: ${draft?.dueDate || ""}.`,
      `Total: ${formatMoney(totals.total, draft.currency)}.`,
      draft?.reference ? `Reference: ${draft.reference}.` : "",
      `Thank you.`,
    ]
      .filter(Boolean)
      .join(" ");

    if (channel === "email") {
      const to = String(sendModal.email || "").trim();
      if (!to) {
        toastOk?.("Add an email address first");
        return;
      }

      const subject = `Invoice ${draft?.number || ""}`.trim();
      const pdfFile = await buildPdfFile();

      const canShareFiles =
        !!navigator.share &&
        !!navigator.canShare &&
        navigator.canShare({ files: [pdfFile] });

      if (canShareFiles) {
        await navigator.share({
          title: subject,
          text: body,
          files: [pdfFile],
        });

        setDraft((d) => ({ ...d, status: "sent" }));
        toastOk?.("Share sheet opened");
        setSendModal(null);
        return;
      }

      downloadFile(pdfFile);

      const href =
        `mailto:${encodeURIComponent(to)}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(
          `${body}\n\nThe PDF was downloaded to your device. Please attach it to this email before sending.`
        )}`;

      window.location.href = href;

      setDraft((d) => ({ ...d, status: "sent" }));
      toastOk?.("Email app opened and PDF downloaded");
      setSendModal(null);
      return;
    }

    const phone = normalizeWhatsappPhone(sendModal.phone);
    if (!phone) {
      toastOk?.("Add a client phone first");
      return;
    }

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    setDraft((d) => ({ ...d, status: "sent" }));
    toastOk?.("Opening WhatsApp");
    setSendModal(null);
  } catch (e) {
    if (e?.name !== "AbortError") {
      toastOk?.(e?.message || "Could not send invoice");
    }
  } finally {
    setSending(false);
  }
}





function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function buildPdfFile() {
  let mount = null;

  try {
    const safeNum = String(draft?.number || "invoice").replace(/[^a-z0-9-_]/gi, "_");

    mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "0";
    mount.style.width = "860px";
    mount.style.background = "#ffffff";
    mount.style.zIndex = "-1";
    mount.innerHTML = previewHtml;
    document.body.appendChild(mount);

    const el = mount.querySelector(".sheet") || mount.firstElementChild || mount;

    const pdfBlob = await html2pdf()
      .set({
        margin: 0,
        filename: `${safeNum}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(el)
      .outputPdf("blob");

    return new File([pdfBlob], `${safeNum}.pdf`, {
      type: "application/pdf",
    });
  } finally {
    if (mount) mount.remove();
  }
}
async function fileToBase64DataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read PDF"));
    reader.readAsDataURL(file);
  });
}


  const fileInputRef = useRef(null);

  return (
    <div className="invWrap">
      <div className="invCard invSide">
        <div className="invHead">
          <div style={{ minWidth: 0 }}>
            <div className="invTitle">Invoices</div>
            <div className="invHint">Create, edit, and export modern invoices.</div>
          </div>
          <button className="btn btnPrimary" type="button" onClick={createNewInvoice} style={{ gap: 8 }}>
            <IconPlus /> New
          </button>
        </div>

        <input
          className="input invSearch"
          placeholder="Search invoice #, client, reference…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="invList">
          {filtered.length === 0 ? (
            <div className="invErr">No invoices match your search.</div>
          ) : (
            filtered.map((inv) => {
              const t = computeTotals(inv);
              const activeRow = inv.id === activeId;
              return (
                <div
                  key={inv.id}
                  className={"invRow" + (activeRow ? " invRowActive" : "")}
                  onClick={() => setActiveId(inv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveId(inv.id)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="invRowTop">
                      <div className="invRowNum">{inv.number || "(no #)"}</div>
                      <div className="invRowClient">{inv.billTo?.name || "—"}</div>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Pill tone={inv.status}>{inv.status === "paid" ? "Paid" : inv.status === "sent" ? "Sent" : "Draft"}</Pill>
                      <Pill>{inv.issueDate || ""}</Pill>
                    </div>
                  </div>
                  <div className="invRowMeta">
                    <div className="invRowAmt">{formatMoney(t.total, inv.currency)}</div>
                    <button
                      className="iconBtn"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInvoice(inv.id);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

            <div className="invCard invMain">
{!draft ? (
  <div className="invErr">
    No invoices yet. Create your first invoice to get started.
  </div>
 
) : (

          <>
            <div className="invToolbar">
              <button className="btn" type="button" onClick={() => saveInvoice()}>
                Save
              </button>

<button className="btn" type="button" onClick={() => openSendModal("email")}>
  Send invoice
</button>

<button className="btn" type="button" onClick={doDownloadPdf} style={{ gap: 8 }}>
  <IconDownload />
  Download PDF
</button>
              <button
  className="btn btnPrimary invPrintBtn"
  type="button"
  onClick={doPrint}
  style={{ gap: 8 }}
>
  <IconPrint />
  Print
</button>

            </div>

            <div className="invMainGrid">
              <div className="invPanel">
                <div className="invPanelTitle">
                  <span>Invoice details</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn" type="button" onClick={() => doMarkStatus("draft")}>Draft</button>
                    <button className="btn" type="button" onClick={() => doMarkStatus("sent")}>Sent</button>
                    <button className="btn" type="button" onClick={() => doMarkStatus("paid")}>Paid</button>
                  </div>
                </div>

                <div className="invKpiRow" style={{ marginBottom: 10 }}>
                  <div className="invKpi">
                    <div className="invKpiLabel">Total</div>
                    <div className="invKpiVal">{formatMoney(totals.total, draft.currency)}</div>
                  </div>
                  <div className="invKpi">
                    <div className="invKpiLabel">Due date</div>
                    <div className="invKpiVal">{draft.dueDate || ""}</div>
                  </div>
                  <div className="invKpi">
                    <div className="invKpiLabel">Status</div>
                    <div className="invKpiVal">{draft.status === "paid" ? "Paid" : draft.status === "sent" ? "Sent" : "Draft"}</div>
                  </div>
                </div>

                <div className="invForm">
                  <div>
                    <div className="invLabel">Invoice #</div>
                    <input
                      className="input invField"
                      value={draft.number}
                      onChange={(e) => setDraftField("number", e.target.value)}
                      placeholder="INV-1001"
                      onBlur={() => saveInvoice()}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Currency</div>
                    <select
                      className="input invField"
                      value={draft.currency}
                      onChange={(e) => setDraftField("currency", e.target.value)}
                      onBlur={() => saveInvoice()}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                      <option value="NZD">NZD</option>
                      <option value="CHF">CHF</option>
                      <option value="SEK">SEK</option>
                      <option value="NOK">NOK</option>
                      <option value="DKK">DKK</option>
                      <option value="JPY">JPY</option>
                    </select>
                  </div>

                  <div>
                    <div className="invLabel">Issue date</div>
                    <input
                      className="input invField"
                      type="date"
                      value={draft.issueDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftField("issueDate", v);
                        if (draft.dueDate === addDaysIso(draft.issueDate, 14)) {
                          setDraftField("dueDate", addDaysIso(v, 14));
                        }
                      }}
                      onBlur={() => saveInvoice()}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Due date</div>
                    <input
                      className="input invField"
                      type="date"
                      value={draft.dueDate}
                      onChange={(e) => setDraftField("dueDate", e.target.value)}
                      onBlur={() => saveInvoice()}
                    />
                  </div>

                  <div className="invFormFull">
                    <div className="invLabel">Reference (optional)</div>
                    <input
                      className="input invField"
                      value={draft.reference}
                      onChange={(e) => setDraftField("reference", e.target.value)}
                      placeholder="PO number, project name, etc."
                      onBlur={() => saveInvoice()}
                    />
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="invTwoCol">
                  <div className="invBusinessHeader">
  <div className="invPanelTitle">Your business</div>

                 <div className="invForm">
  <div className="invFormFull">
    <div className="invLabel">Business name</div>
    <input
      className="input invField"
      value={draft.from.name}
      onChange={(e) => setDraftField("from.name", e.target.value)}
      placeholder="Your Business"
      onBlur={() => saveInvoice()}
    />
  </div>

   {/* ✅ PHONE FULL WIDTH */}
  <div className="invFormFull">
    <div className="invLabel">Phone</div>
    <PhoneInput
      value={draft.from.phone || ""}
      onChange={(v) => setDraftField("from.phone", v)}
    />
  </div>

  {/* ✅ EMAIL FULL WIDTH BELOW */}
  <div className="invFormFull">
    <div className="invLabel">Email</div>
    <input
      className="input invField"
      value={draft.from.email}
      onChange={(e) => setDraftField("from.email", e.target.value)}
      placeholder="hello@yourbusiness.com"
      onBlur={() => saveInvoice()}
    />
  </div>
                      <div className="invFormFull invAddressFix">
                        <div className="invLabel">Address</div>
                        <textarea
                          className="input invField invTextArea"
                          value={draft.from.address}
                          onChange={(e) => setDraftField("from.address", e.target.value)}
                          placeholder={`Street\nCity, State ZIP\nCountry`}
                          onBlur={() => saveInvoice()}
                        />
                      </div>
                      <div className="invFormFull">
  <div className="invLabel">Your Logo</div>

  <div className="invLogoRow">
    <div className="invLogoBox">
      {draft.from.logoDataUrl ? (
        <img src={draft.from.logoDataUrl} alt="Logo" />
      ) : (
        <span className="invLogoStub">LOGO</span>
      )}
    </div>

    <button
      className="invMiniBtn"
      type="button"
      onClick={() => fileInputRef.current?.click()}
    >
      <IconImage /> Upload
    </button>

    {draft.from.logoDataUrl && (
      <button
        className="invMiniBtn"
        type="button"
        onClick={() => {
          setDraftField("from.logoDataUrl", "");
          toastOk?.("Logo removed");
        }}
      >
        Remove
      </button>
    )}
  </div>
</div>
                    </div>
                  </div>

                  <div>
                    <div className="invPanelTitle invBillTo">
  <span>Bill to</span>
</div>
                    <div className="invForm">
                      <div className="invFormFull">
                        <div className="invLabel">Client name</div>
                        <input
                          className="input invField"
                          value={draft.billTo.name}
                          onChange={(e) => setDraftField("billTo.name", e.target.value)}
                          placeholder="Client / Company"
                          onBlur={() => saveInvoice()}
                        />
                      </div>
                      <div className="invFormFull">
  <div className="invLabel">Client phone</div>
<div>
  <PhoneInput
    value={draft.billTo.phone || ""}
    onChange={(v) => setDraftField("billTo.phone", v)}
    onBlur={() => saveInvoice()} // ✅ MOVE HERE
  />
</div>
</div>

                      <div className="invFormFull">
                        <div className="invLabel">Client email</div>
                        <input
                          className="input invField"
                          value={draft.billTo.email}
                          onChange={(e) => setDraftField("billTo.email", e.target.value)}
                          placeholder="client@email.com"
                          onBlur={() => saveInvoice()}
                        />
                      </div>
                      <div className="invFormFull">
</div>

                      <div className="invFormFull invClientAddressFix">
  <div className="invLabel">Client address</div>
                        <textarea
                          className="input invField invTextArea"
                          value={draft.billTo.address}
                          onChange={(e) => setDraftField("billTo.address", e.target.value)}
                          placeholder={`Street\nCity, State ZIP\nCountry`}
                          onBlur={() => saveInvoice()}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="invPanelTitle" style={{ marginBottom: 8 }}>
                  <span>Line items</span>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        items: [...(d.items || []), { id: uid(), description: "", quantity: 1, rate: 0 }],
                      }));
                    }}
                  >
                    <IconPlus /> Add item
                  </button>
                </div>

                <div className="invItems">
                  {(draft.items || []).map((it, idx) => {
                    const qty = sanitizeNumberText(it.quantity);
                    const rate = sanitizeNumberText(it.rate);
                    return (
                      <div className="invItem" key={it.id}>
                        <div>
                          <div className="invLabel">Description</div>
                          <input
                            className="input invField"
                            value={it.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => ({
                                ...d,
                                items: d.items.map((x) => (x.id === it.id ? { ...x, description: v } : x)),
                              }));
                            }}
                            placeholder="Work / product / service"
                            onBlur={() => saveInvoice()}
                          />
                        </div>
                        <div>
                          <div className="invLabel">Qty</div>
                          <input
                            className="input invField"
                            value={qty}
                            onChange={(e) => {
                              const v = sanitizeNumberText(e.target.value);
                              setDraft((d) => ({
                                ...d,
                                items: d.items.map((x) => (x.id === it.id ? { ...x, quantity: v } : x)),
                              }));
                            }}
                            onBlur={() => {
                              setDraft((d) => ({
                                ...d,
                                items: d.items.map((x) => (x.id === it.id ? { ...x, quantity: toNum(x.quantity, 0) } : x)),
                              }));
                              saveInvoice();
                            }}
                          />
                        </div>
                        <div>
                          <div className="invLabel">Rate</div>
                          <input
                            className="input invField"
                            value={rate}
                            onChange={(e) => {
                              const v = sanitizeNumberText(e.target.value);
                              setDraft((d) => ({
                                ...d,
                                items: d.items.map((x) => (x.id === it.id ? { ...x, rate: v } : x)),
                              }));
                            }}
                            onBlur={() => {
                              setDraft((d) => ({
                                ...d,
                                items: d.items.map((x) => (x.id === it.id ? { ...x, rate: toNum(x.rate, 0) } : x)),
                              }));
                              saveInvoice();
                            }}
                          />
                        </div>
                        <div>
                          <div className="invLabel">Amount</div>
                          <div style={{ fontWeight: 600, paddingTop: 10, textAlign: "right" }}>
                            {formatMoney(toNum(it.quantity, 0) * toNum(it.rate, 0), draft.currency)}
                          </div>
                          <div className="invItemActions" style={{ marginTop: 6 }}>
  {draft.items.length > 1 ? (
    <button
      className="iconBtn"
      title="Remove item"
      type="button"
      onClick={() => {
        const nextDraft = {
          ...draft,
          items: draft.items.filter((x) => x.id !== it.id),
        };
        setDraft(nextDraft);
        saveInvoice(nextDraft);
      }}
    >
      <IconTrash />
    </button>
  ) : null}
</div>

                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ height: 12 }} />

                <div className="invTwoCol">
                  <div>
                    <div className="invLabel">Tax rate (%)</div>
                    <input
                      className="input invField"
                      value={sanitizeNumberText(draft.taxRate)}
                      onChange={(e) => setDraftField("taxRate", sanitizeNumberText(e.target.value))}
                      onBlur={() => {
                        setDraftField("taxRate", clamp(toNum(draft.taxRate, 0), 0, 100));
                        saveInvoice();
                      }}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Discount</div>
                    <input
                      className="input invField"
                      value={sanitizeNumberText(draft.discount)}
                      onChange={(e) => setDraftField("discount", sanitizeNumberText(e.target.value))}
                      onBlur={() => {
                        setDraftField("discount", toNum(draft.discount, 0));
                        saveInvoice();
                      }}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Shipping</div>
                    <input
                      className="input invField"
                      value={sanitizeNumberText(draft.shipping)}
                      onChange={(e) => setDraftField("shipping", sanitizeNumberText(e.target.value))}
                      onBlur={() => {
                        setDraftField("shipping", toNum(draft.shipping, 0));
                        saveInvoice();
                      }}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Subtotal</div>
                    <div style={{ fontWeight: 600, paddingTop: 10 }}>{formatMoney(totals.subtotal, draft.currency)}</div>
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div className="invTwoCol">
                  <div>
                    <div className="invLabel">Notes</div>
                    <textarea
                      className="input invField invTextArea"
                      value={draft.notes}
                      onChange={(e) => setDraftField("notes", e.target.value)}
                      placeholder="Add a short note for the client…"
                      onBlur={() => saveInvoice()}
                    />
                  </div>
                  <div>
                    <div className="invLabel">Terms</div>
                    <textarea
                      className="input invField invTextArea"
                      value={draft.terms}
                      onChange={(e) => setDraftField("terms", e.target.value)}
                      placeholder="Payment terms, late fees, bank details…"
                      onBlur={() => saveInvoice()}
                    />
                  </div>
                </div>
              </div>

              <div className="invPreviewWrap">
                <div className="invPreviewTop">
                  <div className="invPreviewLabel">Preview</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Pill>{formatMoney(totals.total, draft.currency)}</Pill>
                    <Pill tone={draft.status}>{draft.status === "paid" ? "Paid" : draft.status === "sent" ? "Sent" : "Draft"}</Pill>
                  </div>
                </div>
                <div className="invPreviewInner">
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    title="Invoice preview"
                    className="invIframe"
                    srcDoc={previewHtml}
                  />
                </div>
                {sendModal ? (
  <div className="invSendOverlay" onClick={() => setSendModal(null)}>
    <div className="invSendModal" onClick={(e) => e.stopPropagation()}>
      <div className="invPanelTitle">Send invoice</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          className="btn"
          type="button"
          onClick={() => setSendModal((s) => ({ ...s, channel: "email" }))}
        >
          Email
        </button>

        <button
          className="btn"
          type="button"
          onClick={() => setSendModal((s) => ({ ...s, channel: "whatsapp" }))}
        >
          WhatsApp
        </button>
      </div>

      {sendModal.channel === "email" ? (
        <div>
          <div className="invLabel">Email address</div>
          <input
            className="input invField"
            value={sendModal.email}
            onChange={(e) =>
              setSendModal((s) => ({ ...s, email: e.target.value }))
            }
            placeholder="client@email.com"
          />
        </div>
      ) : (
        <div>
          <div className="invLabel">Phone number</div>
          <PhoneInput
  value={sendModal.phone || ""}
  onChange={(v) =>
    setSendModal((s) => ({ ...s, phone: v }))
  }
/>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 12,
        }}
      >
        <button className="btn" type="button" onClick={() => setSendModal(null)}>
          Cancel
        </button>

        <button
          className="btn btnPrimary"
          type="button"
          onClick={sendInvoiceNow}
          disabled={sending}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  </div>
) : null}

                {sendModal ? (
  <div className="invSendOverlay" onClick={() => setSendModal(null)}>
    <div className="invSendModal" onClick={(e) => e.stopPropagation()}>
      <div className="invPanelTitle">Send invoice</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() => setSendModal((s) => ({ ...s, channel: "email" }))}
        >
          Email
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setSendModal((s) => ({ ...s, channel: "whatsapp" }))}
        >
          WhatsApp
        </button>
      </div>

      {sendModal.channel === "email" ? (
        <div>
          <div className="invLabel">Email address</div>
          <input
            className="input invField"
            value={sendModal.email}
            onChange={(e) =>
              setSendModal((s) => ({ ...s, email: e.target.value }))
            }
            placeholder="client@email.com"
          />
        </div>
      ) : (
        <div>
          <div className="invLabel">Phone number</div>
          <PhoneInput
  value={sendModal.phone || ""}
  onChange={(v) =>
    setSendModal((s) => ({ ...s, phone: v }))
  }
/>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn" type="button" onClick={() => setSendModal(null)}>
          Cancel
        </button>
        <button className="btn btnPrimary" type="button" onClick={sendInvoiceNow}>
          Send
        </button>
      </div>
    </div>
  </div>
) : null}

              </div>
            </div>
          </>
        )}
      </div>
      </div>
  );
}
