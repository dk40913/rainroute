import React, { useRef, useState } from "react";
import { geocode } from "../api";
import type { GeocodeCandidate } from "../types";
import "./RouteSearch.css";

export function primaryName(name: string): string {
  return name.split(",")[0].trim();
}

export function secondaryName(name: string): string {
  return name
    .split(",")
    .slice(1)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\d+$/.test(s))
    .slice(0, 3)
    .join(" · ");
}

type FieldState = {
  text: string;
  candidates: GeocodeCandidate[];
  selected: GeocodeCandidate | null;
  loading: boolean;
  searched: boolean;
  lastQueried: string | null;
};

const initialField: FieldState = {
  text: "",
  candidates: [],
  selected: null,
  loading: false,
  searched: false,
  lastQueried: null,
};

function GeocodeField({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: string;
  placeholder: string;
  value: FieldState;
  onChange: React.Dispatch<React.SetStateAction<FieldState>>;
}) {
  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Read the DOM value directly — with an uncontrolled input it is the
    // single source of truth (state may lag by one IME commit at blur time).
    const text = e.target.value.trim();
    if (!text || text === value.lastQueried) return;
    if (text !== value.text) onChange((prev) => ({ ...prev, text }));
    onChange((prev) => ({ ...prev, loading: true, searched: false }));
    try {
      const candidates = await geocode(text);
      onChange((prev) =>
        prev.text.trim() !== text
          ? { ...prev, loading: false }
          : { ...prev, loading: false, candidates, searched: true, lastQueried: text },
      );
    } catch {
      onChange((prev) =>
        prev.text.trim() !== text
          ? { ...prev, loading: false }
          : { ...prev, loading: false, candidates: [], searched: true, lastQueried: text },
      );
    }
  }

  function handleChangeText(text: string) {
    onChange((prev) => ({ ...prev, text, candidates: [], selected: null, searched: false, lastQueried: null }));
  }

  // The input is deliberately UNCONTROLLED: with a controlled value, React
  // re-asserts state onto the DOM after every input event, which fights IME
  // (Zhuyin/Pinyin) composition — causing either duplicated text (state
  // written mid-composition) or an un-typeable field (state withheld, React
  // clobbers the buffer). Leaving the DOM value to the browser sidesteps the
  // whole class of bugs; we only write to the DOM when a candidate is picked.
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(candidate: GeocodeCandidate) {
    const primary = primaryName(candidate.name);
    if (inputRef.current) inputRef.current.value = primary;
    onChange({
      text: primary,
      candidates: [],
      selected: candidate,
      loading: false,
      searched: false,
      lastQueried: primary,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Ignore the Enter that commits an IME composition (isComposing /
    // legacy keyCode 229) — blurring at that instant double-inserts the
    // committed text. Only a "real" Enter should end editing.
    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.currentTarget.blur();
    }
  }

  return (
    <div className="rr-field">
      <div className="rr-input-row">
        <span className="rr-input-icon">{icon}</span>
        <input
          ref={inputRef}
          className="rr-input"
          placeholder={placeholder}
          defaultValue=""
          onChange={(e) => handleChangeText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
      {value.loading && <div className="rr-hint">搜尋中…</div>}
      {!value.loading && value.searched && value.candidates.length === 0 && (
        <div className="rr-hint">找不到地點</div>
      )}
      {!value.loading && value.selected && (
        <div
          className={value.selected.approximate ? "rr-selected-hint rr-approx" : "rr-selected-hint"}
          title={value.selected.name}
        >
          {value.selected.approximate ? "≈ 約在附近：" : "✓ "}
          {value.selected.name}
        </div>
      )}
      {!value.loading && value.candidates.length > 0 && (
        <div className="rr-dropdown">
          {value.candidates.slice(0, 5).map((candidate, i) => {
            const secondary = secondaryName(candidate.name);
            return (
              <div
                key={`${candidate.name}-${i}`}
                className="rr-option"
                onMouseDown={(e) => {
                  // Prevent the input's blur handler from firing (and the
                  // dropdown unmounting) before the selection is applied.
                  e.preventDefault();
                  handleSelect(candidate);
                }}
              >
                <div className="rr-option-primary">{primaryName(candidate.name)}</div>
                {secondary.length > 0 && <div className="rr-option-secondary">{secondary}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RouteSearch({
  onSubmit,
  disabled,
}: {
  onSubmit: (origin: GeocodeCandidate, destination: GeocodeCandidate) => void;
  disabled?: boolean;
}) {
  const [origin, setOrigin] = useState<FieldState>(initialField);
  const [destination, setDestination] = useState<FieldState>(initialField);

  const bothSelected = origin.selected !== null && destination.selected !== null;

  return (
    <div className="rr-box">
      <GeocodeField icon="🛵" placeholder="出發地" value={origin} onChange={setOrigin} />
      <GeocodeField icon="📍" placeholder="目的地" value={destination} onChange={setDestination} />
      <button
        className="rr-submit"
        onClick={() => {
          if (origin.selected && destination.selected) {
            onSubmit(origin.selected, destination.selected);
          }
        }}
        disabled={disabled || !bothSelected}
      >
        查詢路線
      </button>
    </div>
  );
}
