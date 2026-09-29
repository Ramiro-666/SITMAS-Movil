import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from './AppText';

export default function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  options: { id: number; text: string }[];
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const trigger = useRef<View>(null);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  function close() {
    setOpen(false);
    (
      trigger.current as unknown as {
        focus?: (options: { preventScroll: boolean }) => void;
      }
    )?.focus?.({ preventScroll: true });
  }
  const visible = options.filter((option) =>
    option.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setSearch('');
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <Text style={styles.text}>
          {options.find((option) => option.id === value)?.text ||
            `Seleccionar ${label.toLowerCase()}`}
        </Text>
        <Text style={styles.arrow}>⌄</Text>
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Cerrar opciones"
            onPress={close}
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.heading}>
              <Text style={styles.title}>{label}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.title}>Cerrar</Text>
              </Pressable>
            </View>
            {options.length > 8 && (
              <TextInput
                accessibilityLabel={`Buscar ${label.toLowerCase()}`}
                placeholder="Buscar…"
                value={search}
                onChangeText={setSearch}
                style={styles.search}
              />
            )}
            <FlatList
              data={visible}
              keyExtractor={(option) => String(option.id)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No hay opciones disponibles.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.id === value }}
                  style={[styles.option, item.id === value && styles.selected]}
                  onPress={() => {
                    onChange(item.id);
                    close();
                  }}
                >
                  <Text style={styles.text}>
                    {item.id === value ? '✓ ' : ''}
                    {item.text}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 6, marginBottom: 12 },
  label: { color: '#006d38', fontSize: 11, fontWeight: '700' },
  trigger: {
    borderWidth: 1,
    borderColor: '#cbdde1',
    minHeight: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  text: { color: '#173542', fontSize: 13, flexShrink: 1 },
  arrow: { color: '#006d38', fontSize: 18 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,35,42,.45)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '75%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
  },
  title: { color: '#006d38', fontWeight: '700', fontSize: 14, flexShrink: 1 },
  close: { padding: 16 },
  list: { flexGrow: 0 },
  option: {
    padding: 16,
    minHeight: 48,
    borderTopWidth: 1,
    borderColor: '#e6eee9',
  },
  selected: { backgroundColor: '#d5eee0' },
  empty: { padding: 20, color: '#637f8d' },
  search: {
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbdde1',
    borderRadius: 8,
  },
});
