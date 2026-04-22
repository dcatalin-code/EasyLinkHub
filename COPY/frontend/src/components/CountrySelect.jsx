import { useState, useEffect, useRef } from "react";
import { countries } from "../lib/countries";

export default function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  // ✅ CLOSE ON OUTSIDE CLICK
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch(""); // reset search when closing
      }
    }

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const selected =
    countries.find((c) => value?.startsWith(c.code)) ||
    countries.find((c) => c.code === "+1") ||
    countries[0];

  // 🔍 FILTER COUNTRIES
  const filtered = countries.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q)
    );
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* BUTTON */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="input"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          width: 80,
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <img
          src={`https://flagcdn.com/w40/${selected.iso2}.png`}
          alt={selected.name}
          style={{ width: 20, height: 14, borderRadius: 3 }}
          onError={(e) =>
            (e.currentTarget.src = "https://flagcdn.com/w40/us.png")
          }
        />
        <span>{selected.code}</span>
      </button>

      {/* DROPDOWN */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            width: 260,
            maxHeight: 300,
            overflow: "auto",
            background: "rgba(12,12,18,0.96)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--stroke)",
            borderRadius: 12,
            boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
            zIndex: 9999,
          }}
        >
          {/* 🔍 SEARCH INPUT */}
          <div style={{ padding: 8 }}>
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{
                width: "100%",
                padding: "6px 8px",
              }}
            />
          </div>

          {/* COUNTRY LIST */}
          {filtered.map((c) => (
            <div
              key={c.code + c.name}
              onClick={() => {
                onChange(c.code);
                setOpen(false);
                setSearch("");
              }}
              style={{
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                cursor: "pointer",
                borderRadius: 10,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surface2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <img
                src={`https://flagcdn.com/w40/${c.iso2}.png`}
                alt={c.name}
                style={{
                  width: 20,
                  height: 14,
                  borderRadius: 3,
                  objectFit: "cover",
                }}
                onError={(e) =>
                  (e.currentTarget.src = "https://flagcdn.com/w40/us.png")
                }
              />
              <span>{c.code}</span>
              <span style={{ opacity: 0.7 }}>{c.name}</span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 10, opacity: 0.6 }}>
              No countries found
            </div>
          )}
        </div>
      )}
    </div>
  );
}