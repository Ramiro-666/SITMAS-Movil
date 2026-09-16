import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PesoBruto, Rendimiento, sitmasApi, StockNeto } from '../services/sitmas-api';

const palette = ['#16a6c9', '#70bd35', '#f6ad3c', '#7956c5', '#e96b73', '#087c72'];
const kg = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value || 0);
const safe = (value: number) => Number.isFinite(Number(value)) ? Number(value) : 0;

function Panel({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.panel}>
    <View style={styles.panelHead}><View style={styles.panelAccent}/><View style={{ flex: 1 }}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelSubtitle}>{subtitle}</Text></View></View>
    {children}
  </View>;
}

function Bar({ label, value, maximum, color, progress, suffix = 'kg' }: { label: string; value: number; maximum: number; color: string; progress: Animated.Value; suffix?: string }) {
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${value > 0 && maximum > 0 ? Math.max(2, Math.min(100, value / maximum * 100)) : 0}%`] });
  return <View style={styles.barRow}>
    <View style={styles.barLabels}><Text numberOfLines={1} style={styles.barName}>{label}</Text><Text style={styles.barValue}>{kg(value)} {suffix}</Text></View>
    <View style={styles.barTrack}><Animated.View style={[styles.barFill, { backgroundColor: color, width }]}/></View>
  </View>;
}

function Empty({ error }: { error?: boolean }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>{error ? '!' : '—'}</Text><Text style={styles.emptyText}>{error ? 'No se pudieron consultar estos datos. Revisá la conexión con SITMAS.' : 'Todavía no hay datos para mostrar.'}</Text></View>;
}

export default function InicioDashboard() {
  const [pesos, setPesos] = useState<PesoBruto[]>([]);
  const [rendimiento, setRendimiento] = useState<Rendimiento[]>([]);
  const [stock, setStock] = useState<StockNeto[]>([]);
  const [errors, setErrors] = useState({ pesos: false, rendimiento: false, stock: false });
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, r, s] = await Promise.allSettled([sitmasApi.pesoBruto(), sitmasApi.rendimiento(), sitmasApi.stockNeto()]);
    setPesos(p.status === 'fulfilled' && Array.isArray(p.value) ? p.value : []);
    setRendimiento(r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
    setStock(s.status === 'fulfilled' && Array.isArray(s.value) ? s.value : []);
    setErrors({ pesos: p.status === 'rejected', rendimiento: r.status === 'rejected', stock: s.status === 'rejected' });
    setLoading(false);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 850, useNativeDriver: false }).start();
  }, [progress]);

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 550, useNativeDriver: false }).start();
    void refresh();
  }, [entrance, refresh]);

  const totalBruto = pesos.reduce((sum, row) => sum + safe(row.TotalPesoBrutoKg), 0);
  const totalPesadas = pesos.reduce((sum, row) => sum + safe(row.CantidadPesadas), 0);
  const totalStock = stock.reduce((sum, row) => sum + safe(row.StockDisponibleKg), 0);
  const brutoClasificado = rendimiento.reduce((sum, row) => sum + safe(row.TotalPesoBrutoKg), 0);
  const utilClasificado = rendimiento.reduce((sum, row) => sum + safe(row.TotalPesoUtilKg), 0);
  const eficiencia = brutoClasificado > 0 ? Math.min(100, Math.max(0, utilClasificado / brutoClasificado * 100)) : 0;
  const stockOrdenado = [...stock].sort((a, b) => safe(b.StockDisponibleKg) - safe(a.StockDisponibleKg));
  const rendimientoOrdenado = [...rendimiento].sort((a, b) => safe(b.TotalPesoBrutoKg) - safe(a.TotalPesoBrutoKg));
  const pesoOrdenado = [...pesos].sort((a, b) => safe(b.TotalPesoBrutoKg) - safe(a.TotalPesoBrutoKg));
  const pesoMax = Math.max(0, ...pesoOrdenado.map(row => safe(row.TotalPesoBrutoKg)));
  const stockMax = Math.max(0, ...stockOrdenado.map(row => safe(row.StockDisponibleKg)));
  const rendimientoMax = Math.max(0, ...rendimientoOrdenado.map(row => safe(row.TotalPesoBrutoKg)));

  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
    <View style={styles.hero}>
      <View style={styles.heroOrb}/><View style={styles.heroOrbSmall}/>
      <View style={styles.heroTop}><View style={styles.liveBadge}><View style={styles.liveDot}/><Text style={styles.liveText}>DATOS DE SITMAS</Text></View><Image source={require('@/assets/images/sitmas/ambiente_sinfondo.png')} resizeMode="contain" style={styles.logo}/></View>
      <Text style={styles.heroTitle}>Tu planta, en una mirada.</Text>
      <Text style={styles.heroSubtitle}>Ingresos, inventario y clasificación en tiempo real.</Text>
      <Pressable onPress={() => void refresh()} disabled={loading} accessibilityRole="button" accessibilityLabel="Actualizar tablero" style={styles.refreshButton}><Text style={styles.refreshText}>{loading ? 'ACTUALIZANDO…' : '↻  ACTUALIZAR DATOS'}</Text></Pressable>
    </View>

    {loading && <View style={styles.loading}><ActivityIndicator color="#078a9c"/><Text style={styles.loadingText}>Consultando el tablero…</Text></View>}
    <View style={styles.kpis}>
      <View style={[styles.kpi, styles.kpiBlue]}><Text style={styles.kpiIcon}>↗</Text><Text style={styles.kpiValue}>{errors.pesos ? '—' : kg(totalBruto)}</Text><Text style={styles.kpiUnit}>KG INGRESADOS</Text><Text style={styles.kpiDetail}>Peso bruto acumulado</Text></View>
      <View style={[styles.kpi, styles.kpiGreen]}><Text style={styles.kpiIcon}>◫</Text><Text style={styles.kpiValue}>{errors.stock ? '—' : kg(totalStock)}</Text><Text style={styles.kpiUnit}>KG DISPONIBLES</Text><Text style={styles.kpiDetail}>Stock neto en planta</Text></View>
    </View>
    <View style={styles.miniKpis}>
      <View style={styles.miniKpi}><Text style={styles.miniValue}>{errors.pesos ? '—' : kg(totalPesadas)}</Text><Text style={styles.miniLabel}>Pesadas</Text></View>
      <View style={styles.miniDivider}/><View style={styles.miniKpi}><Text style={styles.miniValue}>{errors.pesos ? '—' : pesos.length}</Text><Text style={styles.miniLabel}>Materiales</Text></View>
      <View style={styles.miniDivider}/><View style={styles.miniKpi}><Text style={styles.miniValue}>{errors.rendimiento ? '—' : `${eficiencia.toFixed(0)}%`}</Text><Text style={styles.miniLabel}>Recuperación</Text></View>
    </View>

    <Panel eyebrow="INVENTARIO" title="Stock disponible" subtitle="Kilogramos netos por material, después de las salidas.">
      {stockOrdenado.length ? stockOrdenado.map((row, index) => <Bar key={`${row.SubtipoMaterial}-${index}`} label={row.SubtipoMaterial} value={safe(row.StockDisponibleKg)} maximum={stockMax} color={palette[index % palette.length]} progress={progress}/>) : <Empty error={errors.stock}/>}
      {stockOrdenado.length > 0 && <Text style={styles.footnote}>Total disponible · {kg(totalStock)} kg</Text>}
    </Panel>

    <Panel eyebrow="INGRESOS" title="Volumen por material" subtitle="Distribución del peso bruto acumulado.">
      {pesoOrdenado.length ? <><View style={styles.stackedTrack}>{pesoOrdenado.map((row, index) => <Animated.View key={`${row.SubtipoMaterial}-${index}`} style={[styles.stackedSegment, { backgroundColor: palette[index % palette.length], width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${totalBruto > 0 ? Math.max(0, safe(row.TotalPesoBrutoKg) / totalBruto * 100) : 0}%`] }) }]}/>)}</View>{pesoOrdenado.map((row, index) => <View key={`${row.SubtipoMaterial}-${index}`} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: palette[index % palette.length] }]}/><Text style={styles.legendName} numberOfLines={1}>{row.SubtipoMaterial}</Text><Text style={styles.legendValue}>{totalBruto > 0 ? (safe(row.TotalPesoBrutoKg) / totalBruto * 100).toFixed(0) : 0}%</Text></View>)}<View style={styles.chartDivider}/>{pesoOrdenado.map((row, index) => <Bar key={`peso-${row.SubtipoMaterial}-${index}`} label={row.SubtipoMaterial} value={safe(row.TotalPesoBrutoKg)} maximum={pesoMax} color={palette[index % palette.length]} progress={progress}/>)}</> : <Empty error={errors.pesos}/>}
    </Panel>

    <Panel eyebrow="PROCESAMIENTO" title="Eficiencia de clasificación" subtitle="Comparación entre el ingreso bruto y el material útil recuperado.">
      {rendimientoOrdenado.length ? <><View style={styles.efficiencyBox}><Text style={styles.efficiencyValue}>{eficiencia.toFixed(1)}%</Text><View style={{ flex: 1 }}><Text style={styles.efficiencyTitle}>Recuperación global</Text><Text style={styles.efficiencyDetail}>{kg(utilClasificado)} kg útiles de {kg(brutoClasificado)} kg brutos</Text></View></View><View style={styles.efficiencyTrack}><Animated.View style={[styles.efficiencyFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${eficiencia}%`] }) }]}/></View><View style={styles.key}><View style={[styles.legendDot, { backgroundColor: '#3174dc' }]}/><Text style={styles.keyText}>Bruto</Text><View style={[styles.legendDot, { backgroundColor: '#28b7a2' }]}/><Text style={styles.keyText}>Útil</Text></View>{rendimientoOrdenado.map((row, index) => <View key={`${row.SubtipoMaterial}-${index}`} style={styles.compare}><Text style={styles.compareName}>{row.SubtipoMaterial}</Text><View style={styles.compareLine}><View style={styles.compareTrack}><Animated.View style={[styles.compareFill, { backgroundColor: '#3174dc', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${rendimientoMax > 0 ? safe(row.TotalPesoBrutoKg) / rendimientoMax * 100 : 0}%`] }) }]}/></View><Text style={styles.compareValue}>{kg(safe(row.TotalPesoBrutoKg))}</Text></View><View style={styles.compareLine}><View style={styles.compareTrack}><Animated.View style={[styles.compareFill, { backgroundColor: '#28b7a2', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${rendimientoMax > 0 ? safe(row.TotalPesoUtilKg) / rendimientoMax * 100 : 0}%`] }) }]}/></View><Text style={styles.compareValue}>{kg(safe(row.TotalPesoUtilKg))}</Text></View></View>)}</> : <Empty error={errors.rendimiento}/>}
    </Panel>
  </Animated.View>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#006b9c', borderRadius: 22, padding: 20, minHeight: 190, marginBottom: 14, overflow: 'hidden' }, heroOrb: { position: 'absolute', right: -33, top: -65, width: 190, height: 190, borderRadius: 95, backgroundColor: '#168db1' }, heroOrbSmall: { position: 'absolute', right: 42, bottom: -74, width: 165, height: 165, borderRadius: 84, backgroundColor: '#007fad' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff27', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 9 }, liveDot: { backgroundColor: '#a9e768', width: 7, height: 7, borderRadius: 4 }, liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, logo: { width: 60, height: 40 }, heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', maxWidth: 260, lineHeight: 28 }, heroSubtitle: { color: '#dcf4fa', fontSize: 12, lineHeight: 17, marginTop: 7, maxWidth: 265 }, refreshButton: { backgroundColor: '#ffffff2e', alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 16 }, refreshText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: .4 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 }, loadingText: { color: '#47727a', fontSize: 11 }, kpis: { flexDirection: 'row', gap: 10 }, kpi: { flex: 1, borderRadius: 18, padding: 14, minHeight: 142, justifyContent: 'space-between', overflow: 'hidden' }, kpiBlue: { backgroundColor: '#148fce' }, kpiGreen: { backgroundColor: '#31a46a' }, kpiIcon: { color: '#ffffffa8', fontSize: 26, lineHeight: 28 }, kpiValue: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -.5 }, kpiUnit: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: .5 }, kpiDetail: { color: '#e5fbf7', fontSize: 10 }, miniKpis: { backgroundColor: '#fff', borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, marginTop: 10, marginBottom: 16 }, miniKpi: { alignItems: 'center', flex: 1 }, miniValue: { color: '#083c5d', fontSize: 17, fontWeight: '900' }, miniLabel: { color: '#66838e', fontSize: 10, marginTop: 2 }, miniDivider: { width: 1, height: 25, backgroundColor: '#dceae9' },
  panel: { backgroundColor: '#fff', borderRadius: 20, padding: 17, marginBottom: 15, elevation: 2 }, panelHead: { flexDirection: 'row', gap: 10, marginBottom: 18 }, panelAccent: { width: 4, borderRadius: 4, backgroundColor: '#74bc30' }, eyebrow: { color: '#3da978', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, panelTitle: { color: '#173e4b', fontSize: 17, fontWeight: '900', marginTop: 2 }, panelSubtitle: { color: '#6b858b', fontSize: 11, lineHeight: 15, marginTop: 4 }, barRow: { marginBottom: 13 }, barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 }, barName: { color: '#23434b', fontSize: 11, fontWeight: '700', flex: 1 }, barValue: { color: '#34656b', fontSize: 11, fontWeight: '800' }, barTrack: { height: 10, backgroundColor: '#edf4f4', borderRadius: 8, overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 8 }, footnote: { color: '#40767a', fontSize: 10, fontWeight: '800', paddingTop: 5 }, stackedTrack: { flexDirection: 'row', height: 17, borderRadius: 10, overflow: 'hidden', backgroundColor: '#edf4f4', marginBottom: 16 }, stackedSegment: { height: '100%' }, legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendName: { flex: 1, color: '#45666e', fontSize: 11 }, legendValue: { color: '#163f4d', fontSize: 11, fontWeight: '800' }, chartDivider: { height: 1, backgroundColor: '#e7efee', marginVertical: 10 }, efficiencyBox: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }, efficiencyValue: { color: '#20a98d', fontSize: 32, fontWeight: '900' }, efficiencyTitle: { color: '#1c4a51', fontSize: 12, fontWeight: '900' }, efficiencyDetail: { color: '#6f888b', fontSize: 10, marginTop: 3 }, efficiencyTrack: { height: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e9f3ef' }, efficiencyFill: { height: '100%', backgroundColor: '#26b69c', borderRadius: 8 }, key: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 17, marginBottom: 8 }, keyText: { color: '#6d8588', fontSize: 10, marginRight: 10 }, compare: { borderTopWidth: 1, borderColor: '#edf1f0', paddingTop: 10, marginTop: 9 }, compareName: { color: '#1d454f', fontWeight: '800', fontSize: 11, marginBottom: 7 }, compareLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }, compareTrack: { backgroundColor: '#edf4f4', borderRadius: 6, height: 8, flex: 1, overflow: 'hidden' }, compareFill: { height: '100%', borderRadius: 6 }, compareValue: { color: '#517178', fontSize: 10, width: 58, textAlign: 'right' }, empty: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12 }, emptyIcon: { color: '#7ca2a6', fontSize: 20, fontWeight: '900' }, emptyText: { color: '#779196', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
