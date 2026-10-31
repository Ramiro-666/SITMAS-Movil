import { useRef, useState } from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from './AppText';
import { Action, ui } from './route-board/BoardUI';
import NivelCamara from './NivelCamara';

export default function FotoOdometro({ uri, onChange, disabled, onBusyChange }: {
  uri: string; onChange: (uri: string) => void; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  function close() { setOpen(false); setReady(false); onBusyChange(false); }
  async function start() {
    if (disabled || pending.current) return;
    pending.current = true;
    onBusyChange(true);
    setError('');
    try {
      const access = permission?.granted ? permission : await requestPermission();
      if (!access.granted) {
        setError('Necesitás permitir el acceso a la cámara para fotografiar el odómetro.');
        onBusyChange(false);
        return;
      }
      setReady(false);
      setOpen(true);
    } catch {
      setError('No se pudo abrir la cámara. Revisá los permisos y volvé a intentar.');
      onBusyChange(false);
    } finally { pending.current = false; }
  }
  async function capture() {
    if (!camera.current || !ready || pending.current || disabled) return;
    pending.current = true;
    setCapturing(true);
    setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.65 });
      if (!photo?.uri) throw new Error('Sin imagen');
      onChange(photo.uri);
      close();
    } catch { setError('No se pudo tomar la foto. Volvé a intentar.'); }
    finally { pending.current = false; setCapturing(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.title}>Foto del odómetro</Text>
    <Text style={ui.muted}>Fotografiá el tablero con los kilómetros legibles. La foto es temporal y queda solo en este dispositivo.</Text>
    {open ? <>
      <CameraView ref={camera} facing="back" mode="picture" style={{ width: '100%', height: 280, borderRadius: 12 }}
        onCameraReady={() => setReady(true)}
        onMountError={() => { close(); setError('La cámara no está disponible. Revisá los permisos o intentá desde el celular.'); }} />
      <NivelCamara activo={ready && !capturing} />
      <View style={ui.row}>
        <Action title={capturing ? 'Tomando foto…' : ready ? 'Tomar foto' : 'Preparando cámara…'} disabled={disabled || !ready || capturing} onPress={() => { void capture(); }} />
        <Action title="Cancelar foto" secondary disabled={capturing} onPress={close} />
      </View>
    </> : <>
      {!!uri && <Image source={{ uri }} accessibilityLabel="Foto del odómetro inicial" resizeMode="contain" style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#edf5ef' }} />}
      <Action title={uri ? 'Volver a tomar foto' : 'Fotografiar odómetro'} secondary disabled={disabled || !permission} onPress={() => { void start(); }} />
    </>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {permission && !permission.granted && !permission.canAskAgain && Platform.OS !== 'web' &&
      <Action title="Abrir ajustes de cámara" secondary disabled={disabled} onPress={() => { void Linking.openSettings().catch(() => setError('No se pudieron abrir los ajustes. Abrí los permisos de SITMAS desde los ajustes del dispositivo.')); }} />}
  </View>;
}
