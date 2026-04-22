import React from "react";

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default function NumericStepper({
  value,
  min = 0,
  max = 999,
  step = 1,
  onChange,
  width = 64,
  title,
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : min;

  function commit(next) {
    const num = Number(next);
    if (Number.isNaN(num)) return;

    const clamped = Math.max(min, Math.min(max, num));
    onChange(clamped);
  }

  function handleInputChange(e) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw === "") return;
    commit(raw);
  }

  return (
    <div
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 36,
        borderRadius: 10,
        border: "1px solid var(--stroke)",
        background: "color-mix(in srgb, var(--panel) 96%, rgba(16,16,24,.45) 4%)",
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.02)",
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commit(safeValue - step)}
        aria-label="Decrease font size"
        style={{
          width: 34,
          height: 34,
          border: "none",
          borderRight: "1px solid var(--stroke)",
          background: "transparent",
          color: "var(--text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background .15s ease, color .15s ease",
        }}
      >
        <MinusIcon />
      </button>

      <input
        value={safeValue}
        onChange={handleInputChange}
        onBlur={(e) => commit(e.target.value || safeValue)}
        inputMode="numeric"
        aria-label="Font size"
        style={{
          width,
          height: 34,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text)",
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
        }}
      />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commit(safeValue + step)}
        aria-label="Increase font size"
        style={{
          width: 34,
          height: 34,
          border: "none",
          borderLeft: "1px solid var(--stroke)",
          background: "transparent",
          color: "var(--text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background .15s ease, color .15s ease",
        }}
      >
        <PlusIcon />
      </button>
    </div>
  );
}