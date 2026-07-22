import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";

export function RouteSearch({ onSubmit }: { onSubmit: (o: string, d: string) => void }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  return (
    <View style={styles.box}>
      <TextInput style={styles.input} placeholder="出發地" value={origin} onChangeText={setOrigin} />
      <TextInput style={styles.input} placeholder="目的地" value={destination} onChangeText={setDestination} />
      <Button title="查詢路線" onPress={() => onSubmit(origin, destination)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
});
