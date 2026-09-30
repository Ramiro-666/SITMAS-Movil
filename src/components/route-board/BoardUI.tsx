import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../AppText';
export function Action({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondary, disabled && { opacity: 0.45 }]}><Text style={[ui.buttonText, secondary && { color: '#176346' }]}>{title}</Text></Pressable>;
}
export function BoardModal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={ui.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={ui.modal} accessibilityViewIsModal>
        <View style={ui.row}><Text accessibilityRole="header" style={ui.title}>{title}</Text><Action title="Cerrar" onPress={onClose} disabled={busy} secondary /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16, gap: 12 }}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  title: { color: '#164d3b', fontSize: 19, fontWeight: '800' },
  text: { color: '#27493e', fontSize: 13 },
  muted: { color: '#64766e', fontSize: 12, lineHeight: 18 },
  error: { backgroundColor: '#fff0ec', color: '#a33321', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 20 },
  notice: { backgroundColor: '#e8f3ed', color: '#176346', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 20 },
  button: { backgroundColor: '#087947', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#edf5ef', borderWidth: 1, borderColor: '#c8ded1' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#c7d8ce', borderRadius: 8, padding: 12, minHeight: 44, color: '#164d3b', backgroundColor: '#fff' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,35,28,.55)', padding: 16 },
  modal: { width: '100%', maxWidth: 1000, maxHeight: '94%', backgroundColor: '#fff', padding: 18, borderRadius: 16, gap: 16 },
});
