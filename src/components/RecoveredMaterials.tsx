import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './AppText';
import { queries, useSitmasQuery } from '../query/sitmas';

const colors = ['#16a6c9', '#70bd35', '#f6ad3c', '#7956c5', '#e96b73', '#087c72', '#3174dc', '#925929'];
const kg = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
const provisional = [
  { material: 'Cartón', kg: 1250 }, { material: 'Plástico', kg: 800 },
  { material: 'Madera', kg: 600 }, { material: 'Papel', kg: 350 }, { material: 'Metales', kg: 200 },
];

export default function RecoveredMaterials() {
  const [preview, setPreview] = useState(true);
  const query = useSitmasQuery(queries.recuperados, !preview);
  const rows = preview ? provisional : query.data?.materiales ?? [];
  const total = rows.reduce((sum, row) => sum + row.kg, 0);
  const circumference = 2 * Math.PI * 70;
  let offset = 0;
  return <View style={styles.panel}>
    <Text style={styles.title}>Materiales recuperados esta semana</Text>
    <Text style={styles.subtitle}>Peso útil después de la clasificación · lunes a domingo</Text>
    <Pressable accessibilityRole="button" onPress={() => setPreview(!preview)} style={styles.switch}>
      <Text style={styles.switchText}>{preview ? 'DATOS PROVISIONALES · Ver datos reales' : 'DATOS REALES · Ver prueba'}</Text>
    </Pressable>
    {!preview && query.data && <Text style={styles.subtitle}>Semana del {query.data.inicio.split('-').reverse().join('/')}</Text>}
    {!preview && (query.isError || query.fetchStatus === 'paused') && <Text accessibilityRole="alert" style={styles.error}>
      {query.data ? 'No se pudo actualizar. Se muestran los últimos datos disponibles.' : 'No se pudieron consultar las clasificaciones. Reintentá con Actualizar.'}
    </Text>}
    {total > 0 ? <>
      <View style={styles.chart} accessibilityLabel={`Total recuperado: ${kg(total)} kilogramos`}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={200} height={200} viewBox="0 0 200 200">
          {rows.map((row, index) => {
            const length = row.kg / total * circumference;
            const start = offset;
            offset += length;
            return <Circle key={row.material} cx={100} cy={100} r={70} fill="none" stroke={colors[index % colors.length]} strokeWidth={28}
              strokeDasharray={[length, circumference]} strokeDashoffset={-start} transform="rotate(-90 100 100)" />;
          })}
        </Svg>
        </View>
        <View style={styles.center}><Text style={styles.total}>{kg(total)}</Text><Text style={styles.subtitle}>kg recuperados</Text></View>
      </View>
      {rows.map((row, index) => <View key={row.material} style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: colors[index % colors.length] }]} />
        <Text style={styles.material}>{row.material}</Text>
        <Text style={styles.value}>{kg(row.kg)} kg · {kg(row.kg / total * 100)}%</Text>
      </View>)}
    </> : !query.isError && <Text style={styles.empty}>{query.isPending ? 'Cargando materiales…' : 'No hay materiales recuperados registrados esta semana.'}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderRadius: 20, padding: 17, marginBottom: 15 },
  title: { color: '#173e4b', fontSize: 17, fontWeight: '900' },
  subtitle: { color: '#526c73', fontSize: 11, marginTop: 4 },
  switch: { minHeight: 44, justifyContent: 'center' },
  switchText: { color: '#007b9c', fontSize: 11, fontWeight: '700' },
  chart: { alignSelf: 'center', width: 200, height: 200, marginVertical: 12 },
  center: { pointerEvents: 'none', position: 'absolute', top: 72, left: 35, right: 35, alignItems: 'center' },
  total: { color: '#173e4b', fontSize: 23, fontWeight: '900' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  material: { flex: 1, color: '#23434b', fontSize: 12 },
  value: { color: '#34656b', fontSize: 11, fontWeight: '700' },
  empty: { color: '#526c73', fontSize: 13, paddingVertical: 24 },
  error: { color: '#a32c2c', fontSize: 12, marginTop: 10 },
});
