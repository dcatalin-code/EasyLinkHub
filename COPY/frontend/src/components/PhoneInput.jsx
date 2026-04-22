import { useState, useEffect } from "react";
import CountrySelect from "./CountrySelect";
import { countries } from "../lib/countries";

export default function PhoneInput({ value = "", onChange }) {
  const [code, setCode] = useState("+40");

useEffect(() => {
  if (!value) return;

  const found = countries.find((c) => value.startsWith(c.code));
  if (found) {
    setCode(found.code);
  }
}, []);

  const number = value.startsWith(code)
    ? value.slice(code.length)
    : value;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      
      {/* INPUT */}
      <input
        type="tel"
        value={number}
        onChange={(e) => {
          const newNumber = e.target.value;
          onChange(code + newNumber); // ✅ always rebuild value
        }}
        placeholder="Phone number"
        className="input"
        style={{
          width: "100%",
          paddingLeft: 100, // space for flag
        }}
      />

      {/* FLAG SELECT */}
      <div
        style={{
          position: "absolute",
          left: 6,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <CountrySelect
          value={code}
          onChange={(newCode) => {
            setCode(newCode);
            onChange(newCode + number); // ✅ preserve number
          }}
        />
      </div>
    </div>
  );
}