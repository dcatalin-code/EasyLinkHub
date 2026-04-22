import NumericStepper from "./NumericStepper";

function Icon({ children, size = 16, stroke = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function LinkIcon() {
  return (
    <Icon>
      <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
      <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" />
    </Icon>
  );
}

function ImageIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-6 6-2-2-5 5" />
    </Icon>
  );
}

function AlignLeftIcon() {
  return (
    <Icon>
      <path d="M4 6h16" />
      <path d="M4 10h10" />
      <path d="M4 14h16" />
      <path d="M4 18h10" />
    </Icon>
  );
}

function AlignCenterIcon() {
  return (
    <Icon>
      <path d="M4 6h16" />
      <path d="M7 10h10" />
      <path d="M4 14h16" />
      <path d="M7 18h10" />
    </Icon>
  );
}

function AlignRightIcon() {
  return (
    <Icon>
      <path d="M4 6h16" />
      <path d="M10 10h10" />
      <path d="M4 14h16" />
      <path d="M10 18h10" />
    </Icon>
  );
}

function ChevronDownIcon() {
  return (
    <Icon size={14}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  );
}

export default function EditorToolbar({
  activeNote,
  toolbarState,
  fontMenuOpen,
  setFontMenuOpen,
  fontMenuRef,
  fonts,
  updateNote,
  applyInlineFontFamily,
  applyInlineFontSize,
  applyFormat,
  openColorMenu,
  applyHighlightWithCurrentColor,
  colorMenuOpen,
  colorMenuRef,
  colorMode,
  setColorMode,
  colorWheelRef,
  startWheelDrag,
  markerLeft,
  markerTop,
  hexInput,
  setHexInput,
  applyHexInput,
  applyChosenColor,
  saveCurrentColorPreset,
  colorPresets,
  clearSelectedTextColor,
  clearSelectedHighlightColor,
  applyAlign,
  applyLink,
  insertImage,
  handleToolbarMouseDown,
  alignMenuOpen,
  setAlignMenuOpen,
  alignMenuRef,
  activeAlignment,
}) {
  return (
    <div className="toolbarRow">
      <div style={{ position: "relative" }} ref={fontMenuRef}>
        <div
          className="themeSelectLike"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setFontMenuOpen((v) => !v)}
        >
          <span>{activeNote.font || "Inter"}</span>
          <span>▾</span>
        </div>

        {fontMenuOpen && (
          <div className="themeMenu">
            {fonts.map((f) => (
              <div
                key={f}
                className="themeMenuItem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  applyInlineFontFamily?.(f);
                  setFontMenuOpen(false);
                }}
                style={{
                  fontFamily: f,
                  background:
                    (activeNote.font || "Inter") === f
                      ? "rgba(255,255,255,.08)"
                      : "transparent",
                }}
              >
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      <NumericStepper
        value={activeNote.fontSize || 16}
        min={5}
        max={100}
        step={1}
        onChange={applyInlineFontSize}
        title="Font size"
      />

      <div className="toolbarFormatGroup">
        <button
          className={`btn ${toolbarState.bold ? "btnSelected" : ""}`}
          onMouseDown={handleToolbarMouseDown}
          onClick={() => applyFormat("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          className={`btn ${toolbarState.italic ? "btnSelected" : ""}`}
          onMouseDown={handleToolbarMouseDown}
          onClick={() => applyFormat("italic")}
          title="Italic"
        >
          <em>I</em>
        </button>

        <button
          className={`btn ${toolbarState.underline ? "btnSelected" : ""}`}
          onMouseDown={handleToolbarMouseDown}
          onClick={() => applyFormat("underline")}
          title="Underline"
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </button>

        <button
          className={`btn ${toolbarState.strikeThrough ? "btnSelected" : ""}`}
          onMouseDown={handleToolbarMouseDown}
          onClick={() => applyFormat("strikeThrough")}
          title="Strikethrough"
        >
          <span style={{ textDecoration: "line-through" }}>S</span>
        </button>

        <button
          className="btn iconBtn"
          onMouseDown={handleToolbarMouseDown}
          onClick={applyLink}
          title="Insert link"
        >
          <LinkIcon />
        </button>

        <div style={{ position: "relative" }} ref={alignMenuRef}>
          <button
            className="btn"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => setAlignMenuOpen((v) => !v)}
            title="Text alignment"
            style={{ minWidth: 54, padding: "0 10px", gap: 6 }}
          >
            {activeAlignment === "center" ? (
              <AlignCenterIcon />
            ) : activeAlignment === "right" ? (
              <AlignRightIcon />
            ) : (
              <AlignLeftIcon />
            )}
            <ChevronDownIcon />
          </button>

          {alignMenuOpen && (
            <div className="themeDropdownMenu" style={{ minWidth: 170 }}>
              <button
                className="themeDropdownItem"
                onMouseDown={handleToolbarMouseDown}
                onClick={() => {
                  applyAlign("left");
                  setAlignMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                }}
              >
                <AlignLeftIcon />
                <span>Align left</span>
              </button>

              <button
                className="themeDropdownItem"
                onMouseDown={handleToolbarMouseDown}
                onClick={() => {
                  applyAlign("center");
                  setAlignMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                }}
              >
                <AlignCenterIcon />
                <span>Align center</span>
              </button>

              <button
                className="themeDropdownItem"
                onMouseDown={handleToolbarMouseDown}
                onClick={() => {
                  applyAlign("right");
                  setAlignMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                }}
              >
                <AlignRightIcon />
                <span>Align right</span>
              </button>
            </div>
          )}
        </div>

        <div className="colorMenuWrap" ref={colorMenuRef}>
          <div className="colorSwatchButtons">
            <button
              className="btn formatSwatchBtn"
              onMouseDown={handleToolbarMouseDown}
              onClick={() => openColorMenu("text")}
              title="Text color"
              style={{ "--swatch": activeNote.textColor || "#6366f1" }}
            >
              A
              <span className="formatSwatchBar" />
            </button>

            <button
              className="btn formatSwatchBtn"
              onMouseDown={handleToolbarMouseDown}
              onClick={() => openColorMenu("highlight")}
              title="Highlight color"
              style={{ "--swatch": activeNote.highlightColor || "#fff59d" }}
            >
              <span className="highlightBtnGlyph">A</span>
            </button>
          </div>

          {colorMenuOpen && (
            <div className="colorPickerPopup">
              <div className="colorPickerHeader">
                <span>{colorMode === "highlight" ? "Highlight color" : "Text color"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn colorDefaultBtn"
                    style={{ height: 28, width: 28, minWidth: 28, padding: 0 }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      colorMode === "highlight"
                        ? clearSelectedHighlightColor?.()
                        : clearSelectedTextColor?.()
                    }
                    title={colorMode === "highlight" ? "Remove highlight" : "Reset text color"}
                    aria-label={colorMode === "highlight" ? "Remove highlight" : "Reset text color"}
                  >
                    <span className="colorDefaultGlyph" aria-hidden="true" />
                  </button>
                  <button
                    className="btn"
                    style={{ height: 28, padding: "0 10px" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      setColorMode((prev) => (prev === "text" ? "highlight" : "text"))
                    }
                  >
                    {colorMode === "text" ? "Text" : "Highlight"}
                  </button>
                </div>
              </div>

              <div
                ref={colorWheelRef}
                className="colorWheel"
                onMouseDown={startWheelDrag}
                onTouchStart={startWheelDrag}
              >
                <div
                  className="colorWheelMarker"
                  style={{
                    left: `${markerLeft}%`,
                    top: `${markerTop}%`,
                  }}
                />
              </div>

              <div className="colorPreviewRow">
                <div
                  className="colorPreviewSwatch"
                  style={{ background: hexInput || "#6366f1" }}
                />
                <input
                  className="colorHexInput"
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  onBlur={applyHexInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyHexInput();
                    }
                  }}
                  placeholder="#6366f1"
                />
              </div>

              <div className="presetGrid">
                {colorPresets.map((preset) => (
                  <button
                    key={preset}
                    className="presetSwatch"
                    style={{ background: preset }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyChosenColor(preset)}
                    title={preset}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={saveCurrentColorPreset}
                >
                  Save preset
                </button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={applyHexInput}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn iconBtn"
          onMouseDown={handleToolbarMouseDown}
          onClick={insertImage}
          title="Insert image"
        >
          <ImageIcon />
        </button>
      </div>
    </div>
  );
}