import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Button, StyleSheet, Keyboard } from "react-native";
import { geocode } from "../api";
import { GeocodeCandidate } from "../types";

function primaryName(name: string): string {
  return name.split(",")[0].trim();
}

function secondaryName(name: string): string {
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
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: FieldState;
  onChange: React.Dispatch<React.SetStateAction<FieldState>>;
}) {
  async function handleEndEditing() {
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

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value.text}
        onChangeText={handleChangeText}
        onEndEditing={handleEndEditing}
        returnKeyType="done"
      />
      {value.loading && <Text style={styles.hint}>搜尋中…</Text>}
      {!value.loading && value.searched && value.candidates.length === 0 && (
        <Text style={styles.hint}>找不到地點</Text>
      )}
      {!value.loading && value.candidates.length > 0 && (
        <View style={styles.dropdown}>
          {value.candidates.slice(0, 5).map((candidate, i) => {
            const secondary = secondaryName(candidate.name);
            return (
              <Pressable key={`${candidate.name}-${i}`} style={styles.option} onPress={() => handleSelect(candidate)}>
                <Text style={styles.optionPrimary}>{primaryName(candidate.name)}</Text>
                {secondary.length > 0 && (
                  <Text style={styles.optionSecondary} numberOfLines={1}>
                    {secondary}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
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
    <View style={styles.box}>
      <GeocodeField placeholder="出發地" value={origin} onChange={setOrigin} />
      <GeocodeField placeholder="目的地" value={destination} onChange={setDestination} />
      <Button
        title="查詢路線"
        onPress={() => {
          Keyboard.dismiss();
          if (origin.selected && destination.selected) {
            onSubmit(origin.selected, destination.selected);
          }
        }}
        disabled={disabled || !bothSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  hint: { fontSize: 12, color: "#666", paddingHorizontal: 4 },
  dropdown: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, backgroundColor: "#fff" },
  option: { padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  optionPrimary: { fontSize: 14, fontWeight: "600", color: "#222" },
  optionSecondary: { fontSize: 11, color: "#888" },
});
