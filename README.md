# SITMAS Móvil

Aplicación de Expo y React Native conectada a la API de SITMAS y su base SQL Server. TanStack Query gestiona los datos remotos y Zustand mantiene la sesión del usuario y el estado de interacción del tablero en memoria.

## Integrantes

- COGNINI, Facundo
- LOPEZ DIAZ, Erika
- RIVERO, Cristina
- ZAMORA PÁRRAGA, Ramiro Maximiliano

## Ejecución

Desde la carpeta del proyecto:

```bash
npm install
```

Este paso descarga las dependencias y reconstruye `node_modules/`, que no se incluye en el repositorio.

1. Iniciar la API de SITMAS en `https://localhost:44325`.
2. En otra terminal, iniciar el acceso móvil protegido y mantenerlo abierto:

   ```bash
   npm run api:mobile
   ```

3. Iniciar Expo y presionar `w` para abrir la versión web:

   ```bash
   npm start
   ```

Con `npm start`, la app se abre en **http://localhost:8081/**. Este comando inicia Expo, pero no inicia el puente del puerto 8098. Como alternativa, `npm run web` usa el puerto 8082. El comando antiguo `npm run web:demo` también utiliza datos reales.

Para el piloto Android en la misma Wi-Fi, usar `npm run api:lan` en lugar del puente local y comprobarlo con `npm run api:lan:check`. La APK utiliza `https://192.168.100.2:8443/api`; la API y el puente deben permanecer encendidos.

## Features

| Funcionalidad | Estado |
| --- | --- |
| Pantalla de acceso con animación BioCba | Completado |
| Autenticación contra la API de SITMAS | Completado |
| Fondo animado con colores institucionales SITMAS | Completado |
| Menú superior desplegable para móvil | Completado |
| Secciones Inicio, Logística y Configuración | Completado |
| Identidad visual y logotipos SITMAS incluidos localmente | Completado |
| Materiales e indicadores obtenidos de SITMAS | Completado |
| Tarjeta de material reutilizable mediante props | Completado |
| Gestión de tipos de vehículo en SITMAS | Completado |
| Preferencias de configuración interactivas | Completado |
| Datos reales de SITMAS con TanStack Query y Zustand | Completado |
| Navegación a módulos de logística | Completado |
| Tablero de hojas de ruta con lista de tareas pendientes | Completado |
| Alta de tareas y cabeceras con fecha y vehículo | Completado |
| Asignación y traslado de tareas entre hojas mediante arrastre o botones | Completado |
| Desplazamiento automático al arrastrar cerca de los bordes en web | Completado |
| Eliminación de tareas con confirmación | Completado |
| Mapa por hoja con tareas numeradas y circuito EMEC → tareas → EMEC | Completado |
| Optimización del orden de visita mediante distancias viales de OSRM | Completado |
| Recálculo del circuito y de los kilómetros al asignar, trasladar o eliminar tareas | Completado |
| Avisos por coordenadas faltantes y fallos de cálculo, sin datos ficticios | Completado |
| Tarjetas compactas, cabeceras verdes y acciones Mover/Eliminar en una fila | Completado |
| Selectores superpuestos que evitan saltos del contenido | Completado |
| Prueba del piloto en Android físico | Confirmada por el usuario · 20/10/2026 |
| Prueba en iOS físico | Pendiente |
| Registro de ingresos y reportes | Previsto |
| Sesión del chofer con JWT y reconocimiento del rol Operador-Logistica | Implementado |
| Viajes disponibles, aceptación con odómetro inicial e historial del chofer | Implementado |
| Recorrido vial optimizado, kilómetros y orden de visita para el chofer | Implementado |
| Parada espontánea con ubicación GPS y recálculo del circuito | Implementado |
| Cierre del viaje con retorno a EMEC, odómetro final e historial | Implementado |
| Generación e instalación de una APK de prueba en Android | APK v5; funcionamiento inicial confirmado por el usuario · 31/10/2026 |
| Permiso GPS, posición actual y servicio de ubicación durante viajes | Implementado en Android |
| Áreas seguras para barras del sistema e ícono GPS Bio | Implementado y probado en el piloto |
| Finalización remota de viajes desde el perfil de administrador, con confirmación en Detalles y resaltado de viajes en curso | Incluido en APK v5; pendiente de validación específica |
| Regreso automático del chofer y aviso de cierre administrativo | Implementado; actualización cada 5 segundos con la app activa |
| Notificación local y permiso obligatorio para el chofer | Incluido en APK v5; pendiente de validación específica |
| Prueba de la APK con servidor y base de datos en la nube | Próxima mejora · pendiente de la publicación oficial del servidor |
| Kilómetros iniciales y foto obligatoria del odómetro con Expo Camera, solicitud de permiso, revisión de la captura y URI temporal local | Incluido en APK v5 |
| Guía de inclinación lateral para fotografiar el odómetro con el acelerómetro (`expo-sensors`), indicador de grados y referencia de ±5° | Implementado en APK v5; prueba inicial de la APK confirmada · 31/10/2026 |

## Acceso y configuración

El móvil admite las cuentas existentes de **Juan Videla (1)** y **Mauro Gerosa (11)**, una vez validadas por SITMAS. Las demás reciben: «Su usuario no tiene los permisos necesarios para utilizar SITMAS Móvil, comuníquese con su supervisor».

Las solicitudes pasan por el puente de `my-app`. Este admite solo los endpoints utilizados, comprueba la identidad y el estado activo de la cuenta mediante `Usuario/ListarPorId/{id}` con el Bearer original en cada solicitud. SITMAS valida su firma y vencimiento; si falla la validación, el puente no entrega datos. Las cuentas restantes conservan su acceso al SITMAS original.

La sesión dura lo establecido por el JWT original (8 horas) y permanece en memoria. Cerrar sesión limpia token y caché del cliente, pero no revoca otras copias del token en el servidor. No se almacenan contraseñas.

Configurar en `.env.local`:

| Variable | Uso |
| --- | --- |
| `EXPO_PUBLIC_SITMAS_API_URL` | Puente protegido; por defecto `http://localhost:8098/api` en esta PC. En el piloto LAN se usa HTTPS en 8443. |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` | Clave de Maps JavaScript API autorizada para localhost. |
| `EXPO_PUBLIC_OSRM_URL` | Cálculo vial; por defecto `https://router.project-osrm.org`. |

Reiniciar Expo y volver a ingresar después de cambiar la configuración. El puente local escucha en `127.0.0.1` y admite orígenes web locales en 8081/8082. HTTP se usa solo dentro de esta PC; el enlace con SITMAS conserva HTTPS y verificación del certificado.

La dirección directa `https://localhost:44325/api` se rechaza como configuración del móvil. Un despliegue público debe exponer el puente protegido por HTTPS. La API original conserva sus propias limitaciones de autorización y sigue accesible por su dirección; resolverlas requiere cambios fuera de este proyecto.

Los mapas requieren Internet. No incluir credenciales ni secretos de servidor en Git o en variables `EXPO_PUBLIC_*`. Las altas, asignaciones y eliminaciones escriben en la base real mediante la API.

## Operación

### Hojas de ruta

El módulo usa **tareas**; la antigua sección Horarios de paradas fue retirada. Los cambios se trabajan en `test-mapa-hoja-de-ruta`.

- **Nueva tarea** crea un pendiente con orígenes y catálogos reales.
- **Nueva cabecera** crea una hoja con fecha y vehículo; puede quedar sin chofer.
- Arrastrar o usar **Asignar/Mover** permite distribuir tareas. En web, acercarse al borde desplaza el tablero.
- **Eliminar** pide confirmación. Solo se modifican tareas de hojas pendientes o asignadas.
- **Detalles** muestra las tareas numeradas y el circuito de ida y regreso a EMEC.

Mover una tarea recalcula ambas hojas; eliminar la última deja el total en cero. Si el cálculo falla después de guardar, se puede reintentar con **Actualizar recorrido** y **Guardar km calculados**.

Se usan coordenadas reales. Hasta 11 tareas se busca el mejor orden de la matriz vial; entre 12 y 50 se utiliza una aproximación. La API guarda los kilómetros totales, pero no el orden calculado; los tramos históricos pueden diferir. Las estimaciones excluyen tráfico, carga y restricciones para camiones. OSRM público no garantiza disponibilidad. Si faltan coordenadas, se informa sin inventar puntos ni distancias.

### Viajes del chofer

El rol `Operador_Logistica` abre los viajes disponibles del día o el viaje propio en curso. El historial es una consulta secundaria.

**Aceptar viaje** requiere kilómetros iniciales y foto del odómetro. La cámara solicita permiso, permite revisar y repetir la captura y ofrece abrir ajustes si está bloqueada. No pide micrófono ni galería. Solo se guarda la URI temporal local por usuario y ruta: no hay espacio definido en la base para archivar fotos. El sistema puede limpiar el archivo y la referencia se retira al finalizar. Los viajes anteriores sin foto pueden cerrarse. No se comparan automáticamente los dígitos de la imagen con los kilómetros ingresados.

La cámara incluye una guía aproximada de inclinación lateral mediante el acelerómetro (`expo-sensors`). Muestra los grados y cambia a verde dentro de ±5°. Solo escucha el sensor mientras la cámara está lista y la app está en primer plano; se detiene al capturar, cancelar o salir. Si falta el sensor o su permiso, la foto sigue disponible. Con el teléfono acostado o en movimiento fuerte pide corregir la posición. La guía no mide nitidez ni verifica los dígitos de la imagen. Está incluida en la APK v5; queda pendiente la comprobación detallada de inclinación, permisos y comportamiento en distintos teléfonos.

**Parada espontánea** permite indicar una referencia, usar GPS o marcar coordenadas en el mapa, elegir movimiento y material opcional. Se agrega al viaje activo y recalcula el circuito.

**Finalizar viaje** confirma el regreso a EMEC y el odómetro real. La sugerencia redondea hacia arriba: 69.623 km iniciales más 52,67 km estimados sugieren 69.676 km. Se valida que el final no sea menor al inicio ni exceda 180 km de recorrido. Luego se registra el retorno, se cierra el odómetro y se finaliza la hoja.

El progreso del viaje se conserva localmente, sin tokens ni contraseñas. Las escrituras son operaciones separadas: ante un cierre parcial se reintenta lo pendiente; si el resultado del odómetro es incierto, se bloquea el reenvío y se requiere revisión administrativa. Los viajes iniciados fuera de la app también pueden requerir revisión.

Durante un viaje, Android solicita ubicación en segundo plano y muestra una notificación. Solo conserva el último punto en el teléfono; no lo envía al backend. El servicio se detiene al finalizar o cerrar sesión. El cierre forzado y las restricciones de batería pueden detenerlo.

### Finalización administrativa de viajes

En el tablero, las hojas en curso se resaltan en naranja. `Detalles` permite al administrador confirmar su finalización; la hoja queda en estado Finalizado mediante la API existente, conserva su distancia registrada y no inventa una lectura final del odómetro.

El perfil del chofer consulta avisos cada 5 segundos mientras la app está activa. Un cierre administrativo lo devuelve a la selección de rutas y muestra el aviso una sola vez. Android/iOS solicitan obligatoriamente permiso de notificaciones para el perfil del chofer y generan una notificación local al detectar el cierre. No se utiliza Firebase ni se registran tokens push. Con la app cerrada o suspendida, el aviso se detecta al volver a abrirla; no se garantiza una notificación inmediata en segundo plano.

Requiere reinstalar una APK compilada con `expo-notifications`; la APK anterior no incorpora este módulo nativo. Reiniciar los puentes `api:mobile` y `api:lan` después de actualizar sus scripts. Ambos deben compartir el mismo archivo de avisos: por defecto `D:/descarga codex/plugin-data/sitmas-movil/trip-alerts.json` en Windows; se puede indicar otra ruta con `SITMAS_ALERTS_FILE`. El directorio debe permitir escritura al usuario que ejecuta los puentes. No borrar el archivo para actualizar la aplicación.

### Compatibilidad y odómetros

La integración actual utiliza `GET /api/TP_Material`, `SubtipoMaterial` y los métodos POST, PUT y DELETE de `/api/Vehiculo`. Las tareas pendientes no tienen `FechaPrevista`: la fecha pertenece a la hoja asignada. Inicio muestra todas las tareas sin asignar.


## APK y pruebas físicas

La **APK 1.0.0, versionCode 5**, compilada el 31/10/2026, incorpora la fotografía del odómetro con guía de inclinación lateral, el cierre administrativo de viajes y los avisos locales. Conserva la firma y el acceso HTTPS del piloto LAN. El usuario confirmó su funcionamiento inicial el 31/10/2026. Esta confirmación no sustituye la validación detallada de cámara, acelerómetro, cierre administrativo y notificaciones.

[Descargar APK v5](https://expo.dev/artifacts/eas/CTS84_CQ80GVxnQhvAplwFqQNBh-1yj5Ig1qPP_i1oM.apk) · [Compilación v5](https://expo.dev/accounts/sitmas/projects/sitmas-movil/builds/ecf54d4b-5923-4516-b340-fe51655eeb6c)

La APK anterior, **1.0.0, versionCode 4**, compilada el 28/10/2026, incluye la compatibilidad con la API actual y el acceso de Juan y Mauro. Mantiene la firma para actualizar la instalación anterior. **No incluye la foto del odómetro ni los cambios posteriores**; esas funciones están incorporadas en la APK v5.


El usuario confirmó el piloto **versionCode 3** el 20/10/2026: administrador, chofer, rutas, mapas y paradas espontáneas. Incluye marcadores renumerados al reordenar, redondeo del odómetro y notificación Bio.

`eas.json` contiene `preview` (APK LAN) y `production` (AAB). Android usa `com.sitmas.movil`; Expo usa propietario `sitmas` y slug `sitmas-movil`. El proyecto tiene firma remota y configuración de mapas en `preview`. La misma firma permite actualizar la APK. No requiere publicar en Google Play; EAS gratuito está sujeto a cuota y cola.

Quedan pendientes las pruebas detalladas de cámara y acelerómetro, los permisos rechazados, las notificaciones, el cierre administrativo, iOS, autonomía y seguimiento prolongado con pantalla bloqueada. La adaptación web se revisó en formato Pixel 9 (412 × 924).

### Próxima prueba: servidor en la nube

Cuando se publique oficialmente SITMAS, su base y la URL pública, se preparará una APK con acceso HTTPS protegido. Se comprobarán login, consultas, aceptación de rutas, mapas, paradas espontáneas y cierre, verificando los datos guardados. Hasta entonces continúa el piloto LAN. La prueba en la nube deberá funcionar fuera de la Wi-Fi de esta PC.

## Verificación y estructura

```bash
npm run typecheck
npm test
npm run export:web
```

La última ejecución tuvo **66 pruebas aprobadas** y TypeScript sin errores. La suite cubre sesión y acceso, consultas y caché, rutas, coordenadas, asignaciones, viajes, foto, inclinación de cámara y apagado del sensor, GPS, cierre, permisos y notificaciones locales, finalización administrativa y recuperación ante fallos parciales. Las pruebas automatizadas usan respuestas controladas; no sustituyen las pruebas físicas. Las pruebas reales anteriores emplearon registros temporales; las verificaciones más recientes de odómetros fueron de lectura.

- `src/services/sitmas-api.ts`: cliente y contratos de la API.
- `src/query/cliente.ts`: caché y reintentos.
- `src/query/sitmas.ts`: claves, consultas y mutaciones. Las escrituras invalidan las listas afectadas.
- `src/state/sesion.ts`: sesión en memoria y limpieza al salir.
- `src/state/tablero-rutas.ts`: selección y arrastre del tablero.
- `src/components/PlanificadorRutas.tsx`: tablero y finalización administrativa.
- `src/components/PermisoNotificaciones.tsx`: permiso obligatorio de notificaciones para choferes.
- `src/services/notificaciones-viaje.ts`: notificaciones locales y control de avisos ya mostrados.
- `scripts/avisos-viaje.cjs`: persistencia de cierres administrativos compartida por los puentes.

Para agregar datos remotos, definir el método en el cliente y su consulta en `query/sitmas.ts`. Usar Zustand para estado compartido de interfaz; las respuestas de la API permanecen en TanStack Query.
