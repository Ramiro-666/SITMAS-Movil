import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import InicioDashboard from '../components/InicioDashboard';
import { CatalogABM, TiposVehiculoABM, VehiculosABM } from '../components/LogisticaABM';
import RoutePlanner from '../components/RoutePlanner';
import { apiConfigurationHint, Marca, Modelo, Odometro, Session, sitmasApi, TipoVehiculo, Vehiculo } from '../services/sitmas-api';

type Section = 'inicio' | 'logistica' | 'configuracion';
type Tool = 'vehiculos' | 'hojas' | 'odometro' | 'marcas' | 'modelos' | 'tipos' | null;
const assets = {
  bio: require('@/assets/images/sitmas/biocba-solo-noBG.png'),
  loginFooter: require('@/assets/images/sitmas/footer-logos.png'),
  header: require('@/assets/images/sitmas/emec-logo-name-noBG.png'),
  ambiente: require('@/assets/images/sitmas/ambiente_sinfondo.png'),
  espacios: require('@/assets/images/sitmas/espacios_verdes_sinfondo.png'),
  escudo: require('@/assets/images/sitmas/escudo2_sinfondo.png'),
  footer: require('@/assets/images/sitmas/logos.png'),
};
function Logo({ name, style }: { name: keyof typeof assets; style: object }) {
  return <Image source={assets[name]} resizeMode="contain" style={style} />;
}
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.accent}/><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text>{subtitle && <Text style={styles.muted}>{subtitle}</Text>}</View></View>{children}</View>;
}
function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const logoPosition = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formLift = useRef(new Animated.Value(22)).current;
  const background = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const entrance = Animated.sequence([
      Animated.delay(350),
      Animated.timing(logoPosition, { toValue: 0, duration: 1250, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(formLift, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]),
    ]);
    const colors = Animated.loop(Animated.sequence([
      Animated.timing(background, { toValue: 1, duration: 2400, useNativeDriver: false }),
      Animated.timing(background, { toValue: 2, duration: 2400, useNativeDriver: false }),
      Animated.timing(background, { toValue: 3, duration: 2400, useNativeDriver: false }),
      Animated.timing(background, { toValue: 4, duration: 2400, useNativeDriver: false }),
      Animated.timing(background, { toValue: 0, duration: 2400, useNativeDriver: false }),
    ]));
    entrance.start(); colors.start();
    return () => { entrance.stop(); colors.stop(); };
  }, [background, formLift, formOpacity, logoPosition]);
  async function enter() {
    if (!usuario.trim() || !password) { setError('Ingresá usuario y contraseña.'); return; }
    setLoading(true); setError('');
    try { onLogin(await sitmasApi.login(usuario.trim(), password)); }
    catch { setError('Usuario o contraseña incorrectos, o no se pudo conectar a SITMAS.'); }
    finally { setLoading(false); }
  }
  const logoY = logoPosition.interpolate({ inputRange: [0, 1], outputRange: [0, 235] });
  const logoScale = logoPosition.interpolate({ inputRange: [0, 1], outputRange: [1, 1.26] });
  return <SafeAreaView style={styles.loginSafe}>
    <Animated.View style={[styles.loginBackground, { backgroundColor: background.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: ['#662d91', '#0054a6', '#0099cc', '#76bc21', '#017c26'] }) }]}>
      <Animated.View style={[styles.loginBrand, { transform: [{ translateY: logoY }, { scale: logoScale }] }]}><Logo name="bio" style={styles.bioLogo}/></Animated.View>
      <Animated.View style={[styles.loginForm, { opacity: formOpacity, transform: [{ translateY: formLift }] }]}>
        <TextInput value={usuario} onChangeText={setUsuario} placeholder="Ingresá tu usuario" placeholderTextColor="#6d8390" style={styles.loginInput} autoCapitalize="none" keyboardType="email-address"/>
        <TextInput value={password} onChangeText={setPassword} placeholder="Ingresá tu contraseña" placeholderTextColor="#6d8390" style={styles.loginInput} secureTextEntry/>
        {!!error && <Text style={styles.loginError}>{error}</Text>}
        <Pressable onPress={enter} disabled={loading} style={styles.enterButton}>{loading ? <ActivityIndicator color="#0093c4"/> : <Text style={styles.enterText}>INGRESAR</Text>}</Pressable>
      </Animated.View>
      <Logo name="loginFooter" style={styles.loginFooter}/>
    </Animated.View>
  </SafeAreaView>;
}
function Inicio() { return <InicioDashboard/>; }
function Tile({ symbol, label, color, onPress }: { symbol: string; label: string; color: 'blue' | 'green'; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.tile, color === 'blue' ? styles.tileBlue : styles.tileGreen]}>
    <View style={styles.tileIcon}>{symbol === 'truck' ? <View style={styles.truckIcon}><View style={styles.truckBox}/><View style={styles.truckCab}/><View style={[styles.truckWheel, { left: 5 }]}/><View style={[styles.truckWheel, { right: 4 }]}/></View> : symbol === 'route' ? <View style={styles.routeIcon}><View style={styles.routeCircle}/><View style={styles.routeStem}/><View style={styles.routeDot}/></View> : <Text style={styles.tileSymbol}>{symbol}</Text>}</View>
    <Text style={styles.tileText}>{label}</Text><Text style={styles.tileHint}>ABRIR ›</Text>
  </Pressable>;
}
function Logistica() {
  const [tool, setTool] = useState<Tool>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [odometros, setOdometros] = useState<Odometro[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [tipos, setTipos] = useState<TipoVehiculo[]>([]);
  const [error, setError] = useState('');
  const [idVehiculo, setIdVehiculo] = useState(0);
  const [inicio, setInicio] = useState('');
  const [final, setFinal] = useState('');
  function refresh() {
    Promise.allSettled([sitmasApi.vehiculos(), sitmasApi.odometros(), sitmasApi.marcas(), sitmasApi.modelos(), sitmasApi.tiposVehiculo()]).then(([v,o,b,m,t]) => {
      if (v.status === 'fulfilled') setVehiculos(v.value);
      if (o.status === 'fulfilled') setOdometros(o.value);
      if (b.status === 'fulfilled') setMarcas(b.value);
      if (m.status === 'fulfilled') setModelos(m.value);
      if (t.status === 'fulfilled') setTipos(t.value);
      if ([v,o,b,m,t].some(x => x.status === 'rejected')) setError('Algún catálogo no pudo cargarse. Revisá la conexión con SITMAS.');
    });
  }
  useEffect(refresh, []);
  async function saveOdometer() {
    const start = Number(inicio.replace(',', '.')), end = Number(final.replace(',', '.'));
    if (!idVehiculo || !inicio || !final || !Number.isFinite(start) || !Number.isFinite(end) || end < start) { Alert.alert('Datos inválidos', 'Seleccioná vehículo y lecturas de odómetro válidas.'); return; }
    try { await sitmasApi.guardarOdometro({ IdVehiculo: idVehiculo, InicioOdom: start, FinalOdom: end }); setIdVehiculo(0); setInicio(''); setFinal(''); refresh(); Alert.alert('Guardado', 'El odómetro se registró en SITMAS.'); }
    catch { Alert.alert('No se pudo guardar', 'La API rechazó el registro.'); }
  }
  return <>
    <View style={styles.intro}><Logo name="espacios" style={styles.sectionLogo}/><Text style={styles.title}>Gestión de logística</Text><Text style={styles.muted}>Vehículos, hojas de ruta y operaciones.</Text></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.tiles}>
      <Tile symbol="truck" label="Vehículos" color="blue" onPress={() => setTool('vehiculos')}/>
      <Tile symbol="route" label="Hojas de ruta" color="green" onPress={() => setTool('hojas')}/>
      <Tile symbol="◉" label="Odómetro" color="blue" onPress={() => setTool('odometro')}/>
      <Tile symbol="◆" label="Marcas" color="green" onPress={() => setTool('marcas')}/>
      <Tile symbol="▤" label="Modelos" color="blue" onPress={() => setTool('modelos')}/>
      <Tile symbol="◫" label="Tipos" color="green" onPress={() => setTool('tipos')}/>
    </View>
    {tool === 'hojas' && <RoutePlanner/>}
    {tool === 'vehiculos' && <VehiculosABM items={vehiculos} models={modelos} types={tipos} refresh={refresh}/>}
    {tool === 'marcas' && <CatalogABM kind="marca" items={marcas} brands={marcas} refresh={refresh}/>}
    {tool === 'modelos' && <CatalogABM kind="modelo" items={modelos} brands={marcas} refresh={refresh}/>}
    {tool === 'tipos' && <TiposVehiculoABM items={tipos} refresh={refresh}/>}
    {tool === 'odometro' && <Card title="Registro de odómetro" subtitle="Lecturas diarias de vehículos."><Text style={styles.muted}>Elegí un vehículo</Text><View style={styles.brandChoices}>{vehiculos.map(v => <Pressable key={v.Id} onPress={() => setIdVehiculo(v.Id)} style={[styles.brandChoice, idVehiculo === v.Id && styles.brandSelected]}><Text style={styles.brandText}>{v.Patente}</Text></Pressable>)}</View><TextInput value={inicio} onChangeText={setInicio} keyboardType="decimal-pad" placeholder="Odómetro inicial (km)" style={styles.field}/><TextInput value={final} onChangeText={setFinal} keyboardType="decimal-pad" placeholder="Odómetro final (km)" style={styles.field}/><Pressable onPress={saveOdometer} style={styles.actionButton}><Text style={styles.actionText}>GUARDAR REGISTRO</Text></Pressable>{odometros.map(o => <View key={o.IdRegistroOdomet} style={styles.row}><Text style={styles.rowText}>{o.Patente || `Vehículo #${o.IdVehiculo}`}</Text><Text style={styles.status}>+{o.KmRecorridosDia ?? o.FinalOdom - o.InicioOdom} km</Text></View>)}</Card>}
  </>;
}
function Configuracion() {
  return <View><View style={styles.intro}><Logo name="escudo" style={styles.sectionLogo}/><Text style={styles.title}>Configuración</Text><Text style={styles.muted}>Parámetros generales de SITMAS.</Text></View><Card title="Configuración general"><Text style={styles.muted}>La administración general continúa en el sistema SITMAS.</Text></Card></View>;
}
function AppShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [section, setSection] = useState<Section>('inicio');
  const [openMenu, setOpenMenu] = useState(false);
  const content = section === 'inicio' ? <Inicio/> : section === 'logistica' ? <Logistica/> : <Configuracion/>;
  return <SafeAreaView style={styles.app}>
    <View style={styles.top}><Logo name="header" style={styles.headerLogo}/><View style={styles.headerActions}><View><Text style={styles.userName}>{session.nombre || 'Usuario'}</Text><Text style={styles.userRole}>{session.rol || 'Sin rol'}</Text></View><Pressable onPress={() => setOpenMenu(!openMenu)} style={styles.menuButton}><Text style={styles.menuText}>☰ MENÚ</Text></Pressable></View></View>
    {openMenu && <View style={styles.dropdown}>{(['inicio','logistica','configuracion'] as Section[]).map(item => <Pressable key={item} onPress={() => { setSection(item); setOpenMenu(false); }} style={styles.menuItem}><Text style={styles.menuText}>{item === 'inicio' ? '⌂  INICIO' : item === 'logistica' ? '🚚  LOGÍSTICA' : '⚙  CONFIGURACIÓN'}</Text></Pressable>)}<Pressable onPress={onLogout} style={styles.menuItem}><Text style={styles.menuText}>CERRAR SESIÓN</Text></Pressable></View>}
    <View style={styles.bar}><Text style={styles.barText}>{section.toUpperCase()}</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>{content}<View style={styles.footerWrap}><Logo name="footer" style={styles.footer}/></View>{!!apiConfigurationHint && <Text style={styles.hint}>{apiConfigurationHint}</Text>}</ScrollView>
  </SafeAreaView>;
}
export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <AppShell session={session} onLogout={() => setSession(null)}/> : <Login onLogin={setSession}/>;
}
const styles = StyleSheet.create({
  loginSafe: { flex: 1, backgroundColor: '#0054a6' }, loginBackground: { flex: 1, justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 28 },
  loginBrand: { position: 'absolute', top: 112, left: 42, right: 42, alignItems: 'center' }, bioLogo: { width: '100%', height: 125 },
  loginForm: { marginTop: 210, gap: 16 }, loginInput: { height: 54, borderRadius: 28, backgroundColor: '#fff', paddingHorizontal: 21, color: '#173542', fontSize: 16 },
  loginError: { color: '#fff', fontSize: 12 }, enterButton: { height: 54, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }, enterText: { color: '#0093c4', fontWeight: '800', fontSize: 15 },
  loginFooter: { position: 'absolute', bottom: 18, alignSelf: 'center', width: 260, height: 31 },
  app: { flex: 1, backgroundColor: '#eef7ec' }, top: { height: 74, backgroundColor: '#fff', paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, headerLogo: { width: 135, height: 50 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, userName: { color: '#0054a6', fontSize: 12, fontWeight: '800', textAlign: 'right' }, userRole: { color: '#637f8d', fontSize: 10, textAlign: 'right' },
  menuButton: { backgroundColor: '#0093c4', borderRadius: 7, padding: 10 }, menuText: { color: '#fff', fontSize: 10, fontWeight: '800' }, dropdown: { position: 'absolute', top: 74, left: 0, right: 0, zIndex: 10, backgroundColor: '#0093c4', padding: 8, elevation: 8 }, menuItem: { padding: 14, borderBottomWidth: 1, borderColor: '#5cc3e3' },
  bar: { backgroundColor: '#50c7fa', paddingVertical: 11, paddingHorizontal: 18 }, barText: { color: '#0054a6', fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 34 }, intro: { marginBottom: 16 }, sectionLogo: { alignSelf: 'flex-end', width: 105, height: 44 }, title: { color: '#007a33', fontSize: 25, fontWeight: '800' }, muted: { color: '#637f8d', fontSize: 11, marginTop: 3 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 12 }, stat: { flex: 1, minHeight: 96, backgroundColor: '#009ee2', borderRadius: 10, padding: 14, justifyContent: 'space-between' }, greenStat: { backgroundColor: '#76bc21' }, statValue: { color: '#fff', fontSize: 25, fontWeight: '800' }, statLabel: { color: '#fff', fontSize: 10, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 13, elevation: 2 }, cardHeading: { flexDirection: 'row', gap: 9, marginBottom: 12 }, accent: { width: 5, borderRadius: 3, backgroundColor: '#76bc21' }, cardTitle: { color: '#007a33', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e3ece8', flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, rowText: { color: '#1c424b', fontSize: 12, fontWeight: '600', flexShrink: 1 }, status: { color: '#007a33', fontSize: 11, fontWeight: '800' }, error: { color: '#bd3030', fontSize: 11, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }, tile: { width: '31%', minHeight: 118, borderRadius: 13, alignItems: 'center', justifyContent: 'center', padding: 7, elevation: 2 },
  tileBlue: { backgroundColor: '#006fa6' }, tileGreen: { backgroundColor: '#087a42' }, tileIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,.65)', alignItems: 'center', justifyContent: 'center' },
  truckIcon: { width: 31, height: 24 }, truckBox: { position: 'absolute', left: 2, top: 5, width: 18, height: 12, backgroundColor: '#fff', borderRadius: 2 }, truckCab: { position: 'absolute', left: 21, top: 9, width: 9, height: 8, backgroundColor: '#fff', borderTopRightRadius: 3 }, truckWheel: { position: 'absolute', top: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  routeIcon: { width: 28, height: 29, alignItems: 'center' }, routeCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff' }, routeStem: { width: 3, height: 7, backgroundColor: '#fff' }, routeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff', position: 'absolute', bottom: 0 },
  tileSymbol: { color: '#fff', fontSize: 27, fontWeight: '700', textAlign: 'center', includeFontPadding: false }, tileText: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 7 }, tileHint: { color: '#e2f7f1', fontSize: 9, fontWeight: '700', marginTop: 3 },
  field: { height: 46, borderWidth: 1, borderColor: '#c9d9df', borderRadius: 7, paddingHorizontal: 12, color: '#173542', marginTop: 9 }, actionButton: { backgroundColor: '#76bc21', alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 14, paddingVertical: 11, marginTop: 10 },
  actionText: { color: '#fff', fontSize: 10, fontWeight: '800' }, actions: { flexDirection: 'row', gap: 8, alignItems: 'center' }, outlineButton: { borderWidth: 1, borderColor: '#a7cbb3', borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 }, outlineText: { color: '#007a33', fontSize: 10, fontWeight: '800' },
  brandChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, brandChoice: { borderRadius: 6, backgroundColor: '#e2f1e9', paddingHorizontal: 10, paddingVertical: 8 }, brandSelected: { backgroundColor: '#76bc21' }, brandText: { color: '#005c36', fontSize: 10, fontWeight: '700' }, remove: { color: '#b23030', fontSize: 10, fontWeight: '800' },
  footerWrap: { alignItems: 'center', marginTop: 20, paddingBottom: 8 }, footer: { width: '100%', height: 28 }, hint: { color: '#637f8d', textAlign: 'center', fontSize: 10, marginTop: 8 },
});
