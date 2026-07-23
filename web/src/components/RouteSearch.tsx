import React, { useState } from "react";
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
  async function handleBlur() {
    const text = value.text.trim();
    if (!text || text === value.lastQueried) return;
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

  function handleSelect(candidate: GeocodeCandidate) {
    const primary = primaryName(candidate.name);
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
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  return (
    <div className="rr-field">
      <div className="rr-input-row">
        <span className="rr-input-icon">{icon}</span>
        <input
          className="rr-input"
          placeholder={placeholder}
          value={value.text}
          onChange={(e) => handleChangeText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
      {value.loading && <div className="rr-hint">搜尋中…</div>}
      {!value.loading && value.searched && value.candidates.length === 0 && (
        <div className="rr-hint">找不到地點</div>
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
