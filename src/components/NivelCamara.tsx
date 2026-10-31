import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { medirInclinacion } from '../services/inclinacion-camara';
import { Text } from './AppText';

export default function NivelCamara({ activo }: { activo: boolean }) {
  const [lectura, setLectura] = useState<{ grados: number | null; aviso: string }>({ grados: null, aviso: 'Preparando guía de inclinación…' });
  useEffect(() => {
    if (!activo || Platform.OS === 'web') return;
    let cancelado = false;
    let generacion = 0;
    let suscripcion: ReturnType<typeof Accelerometer.addListener> | null = null;
    function detener() { generacion++; suscripcion?.remove(); suscripcion = null; }
    async function iniciar() {
      detener();
      const actual = generacion;
      setLectura({ grados: null, aviso: 'Preparando guía de inclinación…' });
      try {
        if (!await Accelerometer.isAvailableAsync()) throw new Error('Sin sensor');
        if (cancelado || actual !== generacion) return;
        const permiso = await Accelerometer.getPermissionsAsync();
        if (cancelado || actual !== generacion) return;
        const acceso = !permiso.granted && permiso.canAskAgain ? await Accelerometer.requestPermissionsAsync() : permiso;
        if (!acceso.granted) throw new Error('Sin permiso');
        if (cancelado || actual !== generacion || AppState.currentState !== 'active') return;
        Accelerometer.setUpdateInterval(100);
        suscripcion = Accelerometer.addListener((datos) => {
          if (cancelado || actual !== generacion) return;
          const grados = medirInclinacion(datos);
          setLectura({ grados, aviso: grados === null ? 'Levantá el teléfono y mantenelo quieto para medir.' : '' });
        });
      } catch {
        if (!cancelado && actual === generacion) setLectura({ grados: null, aviso: 'Guía de inclinación no disponible. Podés tomar la foto.' });
      }
    }
    if (AppState.currentState === 'active') void iniciar();
    const cambio = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void iniciar(); else detener();
    });
    return () => { cancelado = true; detener(); cambio.remove(); };
  }, [activo]);
  if (Platform.OS === 'web') return <Text style={estilos.ayuda}>La guía de inclinación está disponible en la app del celular.</Text>;
  if (!activo) return null;
  const nivelado = lectura.grados !== null && Math.abs(lectura.grados) <= 5;
  const mensaje = lectura.grados === null ? lectura.aviso : nivelado ? 'Teléfono nivelado · ' + Math.abs(lectura.grados) + '°' : 'Inclinación lateral · ' + Math.abs(lectura.grados) + '°';
  return <View style={estilos.contenedor}>
    {lectura.grados !== null && <View style={estilos.guia} accessible={false}>
      <View style={estilos.referencia} />
      <View style={[estilos.linea, nivelado && estilos.nivelado, { transform: [{ rotate: lectura.grados + 'deg' }] }]} />
    </View>}
    <Text style={[estilos.texto, nivelado && estilos.textoNivelado]}>{mensaje}</Text>
    <Text style={estilos.ayuda}>Guía aproximada de inclinación lateral (±5°). Revisá que los kilómetros se lean bien.</Text>
  </View>;
}
const estilos = StyleSheet.create({
  contenedor: { gap: 5, padding: 10, backgroundColor: '#f4f7f3', borderRadius: 8 },
  guia: { height: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  referencia: { position: 'absolute', width: 100, height: 1, backgroundColor: '#89978e' },
  linea: { width: 70, height: 4, borderRadius: 2, backgroundColor: '#995109' },
  nivelado: { backgroundColor: '#176346' },
  texto: { color: '#784109', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  textoNivelado: { color: '#176346' },
  ayuda: { color: '#53665a', fontSize: 12, textAlign: 'center' },
});
