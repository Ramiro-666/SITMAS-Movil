import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Section = 'inicio' | 'logistica' | 'configuracion';

const materials = [
  { name: 'Plástico PET', amount: '1.250 kg', color: '#009ee2' },
  { name: 'Cartón', amount: '860 kg', color: '#76bc21' },
  { name: 'Vidrio', amount: '420 kg', color: '#662d91' },
  { name: 'Aluminio', amount: '95 kg', color: '#f58220' },
];

const navigation: Array<{ id: Section; label: string; icon: string }> = [
  { id: 'inicio', label: 'Inicio', icon: '⌂' },
  { id: 'logistica', label: 'Logística', icon: '▣' },
  { id: 'configuracion', label: 'Configuración', icon: '⚙' },
];

function Logo({ source, style }: { source: number; style: object }) {
  return <Image source={source} resizeMode="contain" style={style} />;
}

function Icon({ name, color = '#007A33', size = 21 }: { name: string; color?: string; size?: number }) {
  const symbols: Record<string, string> = {
    menu: '☰',
    '⌂': '⌂',
    '▣': '🚚',
    '⚙': '⚙',
  };
  return <Text style={{ color, fontSize: size, fontWeight: '700', width: size + 4, textAlign: 'center' }}>{symbols[name] ?? name}</Text>;
}

function Login({ onEnter }: { onEnter: () => void }) {
  const logoPosition = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formLift = useRef(new Animated.Value(22)).current;
  const backgroundShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(logoPosition, { toValue: 0, duration: 1250, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(formLift, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundShift, { toValue: 1, duration: 2400, useNativeDriver: false }),
        Animated.timing(backgroundShift, { toValue: 2, duration: 2400, useNativeDriver: false }),
        Animated.timing(backgroundShift, { toValue: 3, duration: 2400, useNativeDriver: false }),
        Animated.timing(backgroundShift, { toValue: 4, duration: 2400, useNativeDriver: false }),
        Animated.timing(backgroundShift, { toValue: 0, duration: 2400, useNativeDriver: false }),
      ]),
    ).start();
  }, [backgroundShift, formLift, formOpacity, logoPosition]);

  const logoY = logoPosition.interpolate({ inputRange: [0, 1], outputRange: [0, 235] });
  const logoScale = logoPosition.interpolate({ inputRange: [0, 1], outputRange: [1, 1.26] });

  return (
    <SafeAreaView style={styles.loginSafe}>
      <Animated.View style={[styles.gradientBackground, { backgroundColor: backgroundShift.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: ['#662d91', '#0054a6', '#0099cc', '#76bc21', '#017c26'] }) }]}>
        <Animated.View style={[styles.loginBrand, { transform: [{ translateY: logoY }, { scale: logoScale }] }]}>
          <Logo source={require('@/assets/images/sitmas/biocba-solo-noBG.png')} style={styles.bioLoginLogo} />
        </Animated.View>
        <Animated.View style={[styles.loginForm, { opacity: formOpacity, transform: [{ translateY: formLift }] }]}>
          <TextInput placeholder="Ingresá tu usuario" placeholderTextColor="#6d8390" style={styles.loginInput} autoCapitalize="none" />
          <TextInput placeholder="Ingresá tu contraseña" placeholderTextColor="#6d8390" style={styles.loginInput} secureTextEntry />
          <Pressable onPress={onEnter} style={({ pressed }) => [styles.enterButton, pressed && styles.pressed]}>
            <Text style={styles.enterButtonText}>INGRESAR</Text>
          </Pressable>
        </Animated.View>
        <View style={styles.loginFooter}><Logo source={require('@/assets/images/sitmas/footer-logos.png')} style={styles.loginFooterLogos} /></View>
      </Animated.View>
    </SafeAreaView>
  );
}

function MaterialCard({ name, amount, color }: { name: string; amount: string; color: string }) {
  return <View style={styles.materialCard}>
    <View style={[styles.recycleCircle, { backgroundColor: color }]}><Text style={styles.recycleText}>♻</Text></View>
    <View style={styles.materialText}><Text style={styles.materialName}>{name}</Text><Text style={styles.muted}>Material clasificado</Text></View>
    <View><Text style={styles.materialAmount}>{amount}</Text><Text style={styles.available}>Disponible</Text></View>
  </View>;
}

function Inicio() {
  return <>
    <View style={styles.sectionIntro}>
      <Logo source={require('@/assets/images/sitmas/ambiente_sinfondo.png')} style={styles.sectionLogo} />
      <Text style={styles.sectionTitle}>Panel de inicio</Text>
      <Text style={styles.sectionDescription}>Estado actual de los materiales disponibles en planta.</Text>
    </View>
    <View style={styles.statsRow}>
      <View style={[styles.stat, { backgroundColor: '#009ee2' }]}><Text style={styles.statValue}>2.625</Text><Text style={styles.statLabel}>KG DISPONIBLES</Text></View>
      <View style={[styles.stat, { backgroundColor: '#76bc21' }]}><Text style={styles.statValue}>4</Text><Text style={styles.statLabel}>MATERIALES ACTIVOS</Text></View>
    </View>
    <Card title="Stock de materiales disponibles" subtitle="Kilogramos netos listos para procesamiento o egreso.">
      {materials.map((material) => <MaterialCard key={material.name} {...material} />)}
    </Card>
    <Card title="Volumen de ingresos (peso bruto)" subtitle="Resumen semanal de ingresos a planta.">
      <View style={styles.chart}><View style={[styles.chartBar, { height: '42%' }]} /><View style={[styles.chartBar, { height: '70%' }]} /><View style={[styles.chartBar, { height: '55%' }]} /><View style={[styles.chartBar, { height: '88%' }]} /><View style={[styles.chartBar, { height: '63%' }]} /></View>
      <Text style={styles.chartCaption}>Lun · Mar · Mié · Jue · Vie</Text>
    </Card>
    <Card title="Eficiencia de clasificación" subtitle="Peso bruto versus peso útil.">
      <Text style={styles.tableText}>Reciclables · 87%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: '87%' }]} /></View>
      <Text style={[styles.tableText, { marginTop: 12 }]}>No reciclables · 42%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: '42%', backgroundColor: '#662d91' }]} /></View>
    </Card>
  </>;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <View style={styles.card}>
    <View style={styles.cardHeading}><View style={styles.cardAccent} /><View><Text style={styles.cardTitle}>{title}</Text>{subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}</View></View>
    {children}
  </View>;
}

function AbmPreview({ title, placeholder, rows }: { title: string; placeholder: string; rows: string[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [items, setItems] = useState(rows);
  return <Card title={title}>
    <Pressable onPress={() => setOpen(!open)} style={styles.abmButton}><Text style={styles.greenButtonText}>{open ? 'OCULTAR SECCIÓN ▲' : 'ABRIR SECCIÓN ▼'}</Text></Pressable>
    {open && <View style={{ marginTop: 14 }}>
      <TextInput value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor="#7990a0" style={styles.field} />
      <Pressable onPress={() => { if (value.trim()) { setItems([...items, value.trim()]); setValue(''); } }} style={styles.greenButton}><Text style={styles.greenButtonText}>GUARDAR</Text></Pressable>
      <View style={styles.tableHeader}><Text style={styles.tableHeaderText}>ID</Text><Text style={styles.tableHeaderText}>DESCRIPCIÓN</Text><Text style={styles.tableHeaderText}>ACCIÓN</Text></View>
      {items.map((item, index) => <View key={`${item}-${index}`} style={styles.tableRow}><Text style={styles.tableText}>{index + 1}</Text><Text style={styles.tableText}>{item}</Text><Pressable onPress={() => setItems(items.filter((_, row) => row !== index))}><Text style={{ color: '#e03e2d', fontSize: 18 }}>⌫</Text></Pressable></View>)}
    </View>}
  </Card>;
}

function Logistica() {
  const [vehicle, setVehicle] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  return <>
    <View style={styles.sectionIntro}>
      <Logo source={require('@/assets/images/sitmas/espacios_verdes_sinfondo.png')} style={styles.sectionLogo} />
      <Text style={styles.sectionTitle}>Gestión de logística</Text>
      <Text style={styles.sectionDescription}>Vehículos y hojas de ruta operativas.</Text>
    </View>
    <Card title="Tipo de vehículo" subtitle="Registrá los vehículos que intervienen en la operación.">
      <TextInput value={vehicle} onChangeText={setVehicle} placeholder="Ej: Camión" placeholderTextColor="#7990a0" style={styles.field} />
      <Pressable onPress={() => setSaved(vehicle.trim() || 'Camión')} style={({ pressed }) => [styles.greenButton, pressed && styles.pressed]}><Text style={styles.greenButtonText}>GUARDAR TIPO</Text></Pressable>
      {saved && <Text style={styles.successMessage}>✓ {saved} registrado correctamente</Text>}
      <View style={styles.tableHeader}><Text style={styles.tableHeaderText}>VEHÍCULO</Text><Text style={styles.tableHeaderText}>ESTADO</Text></View>
      <View style={styles.tableRow}><Text style={styles.tableText}>Camión recolector</Text><Text style={styles.tableStatus}>Disponible</Text></View>
      <View style={styles.tableRow}><Text style={styles.tableText}>Utilitario</Text><Text style={styles.tableStatus}>En ruta</Text></View>
    </Card>
    <Card title="Hojas de ruta" subtitle="Movimientos programados para la jornada.">
      <View style={styles.routeRow}><Text style={styles.routeCode}>HR-024</Text><Text style={styles.routeText}>Recolección zona norte</Text><Text style={styles.routeStatus}>En curso</Text></View>
      <View style={styles.routeRow}><Text style={styles.routeCode}>HR-025</Text><Text style={styles.routeText}>Traslado a planta</Text><Text style={styles.routeStatus}>Programada</Text></View>
    </Card>
    <AbmPreview title="Vehículos" placeholder="Ej: AB123CD - Ford Cargo" rows={['AB123CD · Camión recolector', 'AC456EF · Utilitario']} />
    <AbmPreview title="Marcas" placeholder="Ej: Ford" rows={['Ford', 'Iveco']} />
    <AbmPreview title="Modelos" placeholder="Ej: Cargo" rows={['Cargo 1723', 'Daily 70C']} />
    <AbmPreview title="Estado de hoja de ruta" placeholder="Ej: En curso" rows={['En curso', 'Programada']} />
    <AbmPreview title="Detalle de hoja de ruta" placeholder="Ej: Retiro programado" rows={['HR-024 · Recolección zona norte', 'HR-025 · Traslado a planta']} />
  </>;
}

function Configuracion() {
  const [notification, setNotification] = useState(false);
  const [structure, setStructure] = useState('Centro de clasificación');
  return <>
    <View style={styles.sectionIntro}>
      <Logo source={require('@/assets/images/sitmas/escudo2_sinfondo.png')} style={styles.sectionLogo} />
      <Text style={styles.sectionTitle}>Configuración</Text>
      <Text style={styles.sectionDescription}>Parámetros generales de la maqueta SITMAS.</Text>
    </View>
    <Card title="Configuración general" subtitle="Información de la estructura operativa.">
      <Text style={styles.fieldLabel}>NOMBRE DE LA PLANTA</Text>
      <TextInput value={structure} onChangeText={setStructure} style={styles.field} />
      <Pressable style={({ pressed }) => [styles.greenButton, pressed && styles.pressed]}><Text style={styles.greenButtonText}>GUARDAR CAMBIOS</Text></Pressable>
    </Card>
    <Card title="Preferencias" subtitle="Opciones visuales para la aplicación.">
      <Pressable onPress={() => setNotification((value) => !value)} style={styles.preferenceRow}>
        <View><Text style={styles.preferenceTitle}>Notificaciones operativas</Text><Text style={styles.muted}>Avisos sobre ingresos y stock.</Text></View>
        <View style={[styles.switch, notification && styles.switchOn]}><View style={[styles.switchDot, notification && styles.switchDotOn]} /></View>
      </Pressable>
    </Card>
    <Text style={styles.groupTitle}>ESTRUCTURA ORGANIZACIONAL</Text>
    <AbmPreview title="Estado de empleado" placeholder="Ej: Activo" rows={['Activo', 'Licencia']} />
    <AbmPreview title="Tipo de vinculación" placeholder="Ej: Planta" rows={['Planta permanente', 'Contratado']} />
    <AbmPreview title="Área" placeholder="Ej: Recursos Humanos" rows={['Logística', 'Trazabilidad']} />
    <AbmPreview title="Cargo" placeholder="Ej: Analista Senior" rows={['Administrador', 'Operador']} />
    <Text style={styles.groupTitle}>ACCESOS Y PERMISOS</Text>
    <AbmPreview title="Roles" placeholder="Ej: Administrador" rows={['Administrador', 'Operador']} />
    <AbmPreview title="Usuario - rol" placeholder="Ej: Juan - Administrador" rows={['Juan · Administrador', 'María · Operador']} />
    <AbmPreview title="Permisos" placeholder="Ej: Trazabilidad_Escritura" rows={['Trazabilidad_Escritura', 'Logística_Lectura']} />
    <AbmPreview title="Rol - permiso" placeholder="Ej: Administrador - Acceso total" rows={['Administrador · Acceso total', 'Operador · Lectura']} />
    <AbmPreview title="Estado de usuario" placeholder="Ej: Activo" rows={['Activo', 'Inactivo']} />
  </>;
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('inicio');
  const [openMenu, setOpenMenu] = useState(false);
  const title = navigation.find((item) => item.id === section)?.label.toUpperCase();
  const content = section === 'inicio' ? <Inicio /> : section === 'logistica' ? <Logistica /> : <Configuracion />;
  return <SafeAreaView style={styles.appSafe}>
    <View style={styles.topbar}>
      <Logo source={require('@/assets/images/sitmas/emec-logo-name-noBG.png')} style={styles.headerLogo} />
      <View style={styles.headerActions}>
        <View style={styles.userBadge}><Text style={styles.userName}>Hola, Juan</Text><Text style={styles.userRole}>Administrador</Text></View>
        <Pressable onPress={() => setOpenMenu((value) => !value)} style={styles.menuButton}><Icon name="menu" color="#fff" size={22} /><Text style={styles.menuButtonLabel}>MENÚ</Text></Pressable>
      </View>
    </View>
    {openMenu && <View style={styles.dropdown}>
      {navigation.map((item) => <Pressable key={item.id} onPress={() => { setSection(item.id); setOpenMenu(false); }} style={[styles.dropdownItem, section === item.id && styles.dropdownActive]}><Icon name={item.icon} size={22} color="#fff" /><Text style={styles.dropdownText}>{item.label}</Text></Pressable>)}
      <Pressable onPress={onLogout} style={styles.logoutItem}><Text style={styles.logoutText}>CERRAR SESIÓN</Text></Pressable>
    </View>}
    <View style={styles.infoBar}><Text style={styles.infoBarText}>{title}</Text></View>
    <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>{content}<View style={styles.footer}><Logo source={require('@/assets/images/sitmas/logos.png')} style={styles.footerLogos} /></View></ScrollView>
  </SafeAreaView>;
}

export default function HomeScreen() {
  const [loggedIn, setLoggedIn] = useState(false);
  return loggedIn ? <AppShell onLogout={() => setLoggedIn(false)} /> : <Login onEnter={() => setLoggedIn(true)} />;
}

const styles = StyleSheet.create({
  loginSafe: { flex: 1, backgroundColor: '#0054a6' }, gradientBackground: { flex: 1, overflow: 'hidden', backgroundColor: '#0054a6', justifyContent: 'center', paddingHorizontal: 28 },
  loginBrand: { position: 'absolute', top: 112, left: 42, right: 42, alignItems: 'center' }, bioLoginLogo: { width: '100%', height: 125 },
  loginForm: { marginTop: 210, gap: 16 }, loginInput: { height: 54, borderRadius: 28, backgroundColor: '#fff', paddingHorizontal: 21, color: '#173542', fontSize: 16, fontFamily: 'Maven Pro' },
  enterButton: { height: 54, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginTop: 5 }, enterButtonText: { color: '#0093c4', fontSize: 15, fontWeight: '800', letterSpacing: 0.6, fontFamily: 'Maven Pro' }, loginFooter: { position: 'absolute', bottom: 18, left: 28, right: 28, alignItems: 'center' }, loginFooterLogos: { width: 260, height: 31 },
  appSafe: { flex: 1, backgroundColor: '#f0f7ed' }, topbar: { height: 74, backgroundColor: '#fff', paddingHorizontal: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#dce8df' }, headerLogo: { width: 145, height: 51 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, userBadge: { alignItems: 'flex-end' }, userName: { color: '#0054a6', fontSize: 12, fontWeight: '800', fontFamily: 'Maven Pro' }, userRole: { color: '#637f8d', fontSize: 10, fontFamily: 'Maven Pro' }, menuButton: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#0093c4', borderRadius: 7, paddingVertical: 10, paddingHorizontal: 10 }, menuButtonText: { color: '#fff', fontSize: 21, lineHeight: 21 }, menuButtonLabel: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'Maven Pro' },
  dropdown: { position: 'absolute', top: 74, left: 0, right: 0, zIndex: 10, backgroundColor: '#0093c4', padding: 8, shadowColor: '#002e47', shadowOpacity: 0.25, shadowRadius: 12, elevation: 9 }, dropdownItem: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 6, paddingHorizontal: 15 }, dropdownActive: { backgroundColor: '#007da9', borderLeftWidth: 4, borderColor: '#76bc21', paddingLeft: 11 }, dropdownIcon: { color: '#fff', fontSize: 21, width: 22, textAlign: 'center' }, dropdownText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Maven Pro' }, logoutItem: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginTop: 6, padding: 15 }, logoutText: { color: '#fff', fontSize: 12, fontWeight: '800', fontFamily: 'Maven Pro' },
  infoBar: { backgroundColor: '#50c7fa', paddingVertical: 11, paddingHorizontal: 19 }, infoBarText: { color: '#0054a6', fontSize: 12, fontWeight: '800', letterSpacing: 0.7, fontFamily: 'Maven Pro' }, content: { flex: 1 }, contentPadding: { padding: 17, paddingBottom: 0 },
  sectionIntro: { marginBottom: 17 }, sectionLogo: { alignSelf: 'flex-end', width: 105, height: 44, marginBottom: 3 }, sectionTitle: { color: '#007A33', fontSize: 26, fontWeight: '800', fontFamily: 'Maven Pro' }, sectionDescription: { color: '#637f8d', fontSize: 13, marginTop: 4, fontFamily: 'Maven Pro' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 }, stat: { flex: 1, minHeight: 100, justifyContent: 'space-between', borderRadius: 10, padding: 15 }, statValue: { color: '#fff', fontSize: 26, fontWeight: '800', fontFamily: 'Maven Pro' }, statLabel: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'Maven Pro' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 13, shadowColor: '#173542', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }, cardHeading: { flexDirection: 'row', gap: 10, marginBottom: 15 }, cardAccent: { width: 5, borderRadius: 3, backgroundColor: '#76bc21' }, cardTitle: { color: '#007A33', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', fontFamily: 'Maven Pro' }, cardSubtitle: { color: '#6f8793', fontSize: 11, marginTop: 3, fontFamily: 'Maven Pro' },
  materialCard: { minHeight: 65, borderWidth: 1, borderColor: '#e3ece8', borderRadius: 8, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center' }, recycleCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' }, recycleText: { color: '#fff', fontSize: 18 }, materialText: { flex: 1, marginLeft: 10 }, materialName: { color: '#1c424b', fontSize: 14, fontWeight: '700', fontFamily: 'Maven Pro' }, muted: { color: '#6f8793', fontSize: 11, marginTop: 2, fontFamily: 'Maven Pro' }, materialAmount: { color: '#007A33', fontSize: 14, fontWeight: '800', textAlign: 'right', fontFamily: 'Maven Pro' }, available: { color: '#30780a', fontSize: 10, fontWeight: '700', marginTop: 4, fontFamily: 'Maven Pro' },
  fieldLabel: { color: '#007A33', fontSize: 11, fontWeight: '800', marginBottom: 6, fontFamily: 'Maven Pro' }, field: { height: 47, borderWidth: 1, borderColor: '#c9d9df', borderRadius: 7, paddingHorizontal: 13, color: '#173542', fontSize: 15, marginBottom: 10, fontFamily: 'Maven Pro' }, greenButton: { backgroundColor: '#76bc21', alignSelf: 'flex-end', borderRadius: 7, paddingHorizontal: 17, paddingVertical: 12 }, greenButtonText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4, fontFamily: 'Maven Pro' }, successMessage: { color: '#30780a', fontSize: 12, fontWeight: '700', marginTop: 12, fontFamily: 'Maven Pro' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#007A33', marginTop: 16, padding: 10, borderRadius: 5 }, tableHeaderText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'Maven Pro' }, tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#e3ece8' }, tableText: { color: '#1c424b', fontSize: 12, fontFamily: 'Maven Pro' }, tableStatus: { color: '#30780a', fontSize: 12, fontWeight: '700', fontFamily: 'Maven Pro' }, routeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e3ece8', paddingVertical: 12, gap: 8 }, routeCode: { color: '#662d91', fontSize: 11, fontWeight: '800', fontFamily: 'Maven Pro' }, routeText: { flex: 1, color: '#1c424b', fontSize: 12, fontFamily: 'Maven Pro' }, routeStatus: { color: '#007A33', fontSize: 11, fontWeight: '700', fontFamily: 'Maven Pro' },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }, preferenceTitle: { color: '#1c424b', fontSize: 14, fontWeight: '700', fontFamily: 'Maven Pro' }, switch: { width: 46, height: 25, borderRadius: 14, backgroundColor: '#c7d7dc', padding: 3 }, switchOn: { backgroundColor: '#76bc21' }, switchDot: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff' }, switchDotOn: { alignSelf: 'flex-end' },
  chart: { height: 110, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#dce8df' }, chartBar: { width: 28, backgroundColor: '#009ee2', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartCaption: { color: '#6f8793', textAlign: 'center', fontSize: 11, marginTop: 7, fontFamily: 'Maven Pro' }, progressTrack: { height: 10, backgroundColor: '#e4ece8', borderRadius: 6, marginTop: 6 }, progressFill: { height: 10, backgroundColor: '#76bc21', borderRadius: 6 },
  abmButton: { backgroundColor: '#007A33', borderRadius: 7, paddingVertical: 11, paddingHorizontal: 14, alignSelf: 'stretch', alignItems: 'center' }, groupTitle: { color: '#0054a6', fontSize: 12, fontWeight: '800', letterSpacing: 0.7, marginTop: 9, marginBottom: 8, fontFamily: 'Maven Pro' },
  footer: { marginTop: 8, paddingVertical: 17, alignItems: 'center' }, footerLogos: { width: '100%', height: 28 }, pressed: { opacity: 0.76 },
});
