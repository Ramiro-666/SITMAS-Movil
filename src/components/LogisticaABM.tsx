import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Marca, Modelo, sitmasApi, TipoVehiculo, Vehiculo } from '../services/sitmas-api';

const tipoId = (item: TipoVehiculo) => Number(item.Id ?? item.id_Tp_Vehiculo ?? 0);
const tipoNombre = (item: TipoVehiculo) => item.TipoVehiculo ?? item.Tp_Vehiculo ?? '';

function Box({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.box}><View style={styles.heading}><View style={styles.accent}/><View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View></View>{children}</View>;
}
function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}
function RecordActions({ onEdit, onDelete, onCancelDelete, onConfirmDelete, confirming, busy }: { onEdit: () => void; onDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void; confirming: boolean; busy: boolean }) {
  return <View style={styles.recordActions}>{confirming ? <><Text style={styles.confirmText}>¿Eliminar?</Text><Button label="SÍ" onPress={onConfirmDelete} disabled={busy}/><Button label="NO" onPress={onCancelDelete} secondary/></> : <><Button label="EDITAR" onPress={onEdit} secondary/><Button label="ELIMINAR" onPress={onDelete} secondary/></>}</View>;
}
function Message({ text, error }: { text: string; error: boolean }) { return text ? <Text style={[styles.message, error && styles.messageError]}>{text}</Text> : null; }

export function CatalogABM({ kind, items, brands, refresh }: { kind: 'marca' | 'modelo'; items: Marca[] | Modelo[]; brands: Marca[]; refresh: () => void }) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const model = kind === 'modelo';
  const clear = () => { setName(''); setBrandId(0); setEditingId(null); };
  const report = (text: string, failed = false) => { setMessage(text); setError(failed); };
  async function save() {
    if (!name.trim() || (model && !brandId)) { report('Ingresá el nombre y seleccioná la marca cuando corresponda.', true); return; }
    setBusy(true);
    try {
      if (model) await sitmasApi.guardarModelo(name.trim(), brandId, editingId ?? undefined);
      else await sitmasApi.guardarMarca(name.trim(), editingId ?? undefined);
      clear(); refresh(); report(editingId ? 'Cambios guardados.' : 'Registro agregado.');
    } catch { report('No se pudo guardar. Revisá los datos y la conexión con SITMAS.', true); }
    finally { setBusy(false); }
  }
  function edit(item: Marca | Modelo) {
    setDeletingId(null); setEditingId(item.Id); setName(model ? (item as Modelo).ModeloVehiculo : (item as Marca).MarcaVehiculo);
    setBrandId(model ? (item as Modelo).Id_Marca : 0); report('Editando registro.');
  }
  async function remove(id: number) {
    setBusy(true);
    try {
      if (model) await sitmasApi.borrarModelo(id); else await sitmasApi.borrarMarca(id);
      if (editingId === id) clear(); setDeletingId(null); refresh(); report('Registro eliminado.');
    } catch { report('No se pudo eliminar. Puede estar asociado a otro registro.', true); }
    finally { setBusy(false); }
  }
  return <Box title={model ? 'Modelos' : 'Marcas'} subtitle="Agregar, editar y eliminar registros de SITMAS.">
    <TextInput value={name} onChangeText={setName} placeholder={model ? 'Nombre del modelo' : 'Nombre de la marca'} style={styles.input}/>
    {model && <><Text style={styles.label}>MARCA</Text><View style={styles.choices}>{brands.map(brand => <Choice key={brand.Id} label={brand.MarcaVehiculo} selected={brandId === brand.Id} onPress={() => setBrandId(brand.Id)}/>)}</View>{!brands.length && <Text style={styles.muted}>Primero agregá una marca.</Text>}</>}
    <View style={styles.formActions}><Button label={busy ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : '+ AGREGAR'} onPress={() => void save()} disabled={busy}/>{editingId !== null && <Button label="CANCELAR" onPress={clear} secondary/>}</View>
    <Message text={message} error={error}/>
    <Text style={styles.listTitle}>REGISTROS EXISTENTES · {items.length}</Text>
    {items.length === 0 && <Text style={styles.muted}>No hay registros disponibles.</Text>}
    {items.map(item => <View key={item.Id} style={styles.record}><View style={styles.recordInfo}><Text style={styles.recordTitle}>{model ? (item as Modelo).ModeloVehiculo : (item as Marca).MarcaVehiculo}</Text>{model && <Text style={styles.muted}>{brands.find(brand => brand.Id === (item as Modelo).Id_Marca)?.MarcaVehiculo || 'Marca no disponible'}</Text>}</View><RecordActions onEdit={() => edit(item)} onDelete={() => setDeletingId(item.Id)} onCancelDelete={() => setDeletingId(null)} onConfirmDelete={() => void remove(item.Id)} confirming={deletingId === item.Id} busy={busy}/></View>)}
  </Box>;
}

export function TiposVehiculoABM({ items, refresh }: { items: TipoVehiculo[]; refresh: () => void }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const clear = () => { setName(''); setEditingId(null); };
  const report = (text: string, failed = false) => { setMessage(text); setError(failed); };
  async function save() {
    if (!name.trim()) { report('Ingresá un nombre para el tipo de vehículo.', true); return; }
    setBusy(true);
    try { await sitmasApi.guardarTipoVehiculo(name.trim(), editingId ?? undefined); clear(); refresh(); report(editingId ? 'Cambios guardados.' : 'Tipo agregado.'); }
    catch { report('No se pudo guardar el tipo de vehículo.', true); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    setBusy(true);
    try { await sitmasApi.borrarTipoVehiculo(id); if (editingId === id) clear(); setDeletingId(null); refresh(); report('Tipo eliminado.'); }
    catch { report('No se pudo eliminar. Puede estar asociado a vehículos.', true); }
    finally { setBusy(false); }
  }
  return <Box title="Tipos de vehículo" subtitle="Categorías disponibles para los vehículos.">
    <TextInput value={name} onChangeText={setName} placeholder="Ej.: camión recolector" style={styles.input}/>
    <View style={styles.formActions}><Button label={busy ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : '+ AGREGAR'} onPress={() => void save()} disabled={busy}/>{editingId !== null && <Button label="CANCELAR" onPress={clear} secondary/>}</View>
    <Message text={message} error={error}/><Text style={styles.listTitle}>TIPOS EXISTENTES · {items.length}</Text>
    {items.length === 0 && <Text style={styles.muted}>No hay tipos disponibles.</Text>}
    {items.map((item, index) => { const id = tipoId(item); return <View key={id || index} style={styles.record}><Text style={[styles.recordTitle, styles.recordInfo]}>{tipoNombre(item) || 'Sin descripción'}</Text><RecordActions onEdit={() => { setEditingId(id); setName(tipoNombre(item)); setDeletingId(null); report('Editando tipo.'); }} onDelete={() => setDeletingId(id)} onCancelDelete={() => setDeletingId(null)} onConfirmDelete={() => void remove(id)} confirming={deletingId === id} busy={busy || !id}/></View>; })}
  </Box>;
}

export function VehiculosABM({ items, models, types, refresh }: { items: Vehiculo[]; models: Modelo[]; types: TipoVehiculo[]; refresh: () => void }) {
  const [patente, setPatente] = useState('');
  const [modelId, setModelId] = useState(0);
  const [typeId, setTypeId] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const clear = () => { setPatente(''); setModelId(0); setTypeId(0); setEditingId(null); };
  const report = (text: string, failed = false) => { setMessage(text); setError(failed); };
  async function save() {
    if (!patente.trim() || !modelId || !typeId) { report('Completá patente, modelo y tipo de vehículo.', true); return; }
    setBusy(true);
    try { await sitmasApi.guardarVehiculo({ Patente: patente.trim().toUpperCase(), Id_Modelo: modelId, Id_Tipo: typeId }, editingId ?? undefined); clear(); refresh(); report(editingId ? 'Vehículo actualizado.' : 'Vehículo agregado.'); }
    catch { report('No se pudo guardar el vehículo. Revisá los datos y la conexión.', true); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    setBusy(true);
    try { await sitmasApi.borrarVehiculo(id); if (editingId === id) clear(); setDeletingId(null); refresh(); report('Vehículo eliminado.'); }
    catch { report('No se pudo eliminar. Puede estar asociado a hojas de ruta.', true); }
    finally { setBusy(false); }
  }
  return <Box title="Vehículos" subtitle="Alta, edición y baja del parque automotor.">
    <TextInput value={patente} onChangeText={setPatente} autoCapitalize="characters" placeholder="Patente" style={styles.input}/>
    <Text style={styles.label}>MODELO</Text><View style={styles.choices}>{models.map(model => <Choice key={model.Id} label={model.ModeloVehiculo} selected={modelId === model.Id} onPress={() => setModelId(model.Id)}/>)}</View>
    {!models.length && <Text style={styles.muted}>Primero agregá un modelo.</Text>}
    <Text style={styles.label}>TIPO DE VEHÍCULO</Text><View style={styles.choices}>{types.map((type, index) => <Choice key={tipoId(type) || index} label={tipoNombre(type)} selected={typeId === tipoId(type)} onPress={() => setTypeId(tipoId(type))}/>)}</View>
    {!types.length && <Text style={styles.muted}>Primero agregá un tipo de vehículo.</Text>}
    <View style={styles.formActions}><Button label={busy ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : '+ AGREGAR'} onPress={() => void save()} disabled={busy}/>{editingId !== null && <Button label="CANCELAR" onPress={clear} secondary/>}</View>
    <Message text={message} error={error}/><Text style={styles.listTitle}>VEHÍCULOS EXISTENTES · {items.length}</Text>
    {items.length === 0 && <Text style={styles.muted}>No hay vehículos disponibles.</Text>}
    {items.map(item => <View key={item.Id} style={styles.record}><View style={styles.recordInfo}><Text style={styles.recordTitle}>{item.Patente}</Text><Text style={styles.muted}>{models.find(model => model.Id === item.Id_Modelo)?.ModeloVehiculo || 'Modelo no disponible'} · {tipoNombre(types.find(type => tipoId(type) === item.Id_Tipo) || {}) || 'Tipo no disponible'}</Text></View><RecordActions onEdit={() => { setEditingId(item.Id); setPatente(item.Patente); setModelId(item.Id_Modelo); setTypeId(item.Id_Tipo); setDeletingId(null); report('Editando vehículo.'); }} onDelete={() => setDeletingId(item.Id)} onCancelDelete={() => setDeletingId(null)} onConfirmDelete={() => void remove(item.Id)} confirming={deletingId === item.Id} busy={busy}/></View>)}
  </Box>;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginBottom: 13, elevation: 2 }, heading: { flexDirection: 'row', gap: 9, marginBottom: 10 }, accent: { width: 5, borderRadius: 3, backgroundColor: '#76bc21' }, title: { color: '#007a33', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' }, muted: { color: '#637f8d', fontSize: 11, marginTop: 3 }, input: { height: 46, borderWidth: 1, borderColor: '#c9d9df', borderRadius: 7, paddingHorizontal: 12, color: '#173542', marginTop: 9 }, label: { color: '#235761', fontSize: 10, fontWeight: '800', marginTop: 13 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, choice: { borderRadius: 7, backgroundColor: '#e2f1e9', paddingHorizontal: 10, paddingVertical: 9 }, choiceSelected: { backgroundColor: '#087a42' }, choiceText: { color: '#005c36', fontSize: 11, fontWeight: '700' }, choiceTextSelected: { color: '#fff' }, formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, button: { backgroundColor: '#087a42', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9, alignItems: 'center' }, secondary: { backgroundColor: '#e6f2ed' }, disabled: { opacity: .5 }, buttonText: { color: '#fff', fontSize: 10, fontWeight: '800' }, secondaryText: { color: '#006b44' }, message: { color: '#087a42', fontSize: 11, marginTop: 10, fontWeight: '700' }, messageError: { color: '#b23030' }, listTitle: { color: '#245264', fontSize: 10, fontWeight: '900', marginTop: 20, marginBottom: 5 }, record: { borderTopWidth: 1, borderColor: '#e2ece9', paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, recordInfo: { flex: 1, minWidth: 0 }, recordTitle: { color: '#1c424b', fontSize: 12, fontWeight: '800' }, recordActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, justifyContent: 'flex-end', maxWidth: 160 }, confirmText: { color: '#9d3737', fontSize: 10, fontWeight: '800' },
});
