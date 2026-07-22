import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { MainScreen } from "./src/MainScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <MainScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
