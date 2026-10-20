# SITMAS Móvil

Aplicación de Expo y React Native conectada a la API de SITMAS y su base SQL Server. TanStack Query gestiona los datos remotos y Zustand mantiene la sesión del usuario y el estado de interacción del tablero en memoria.

## Estado actual · 20/10/2026

El piloto Android por Wi-Fi local está instalado y el usuario confirmó el funcionamiento de la **APK 1.0.0, versionCode 3**. Se probaron el acceso con administrador y chofer, las rutas de prueba, el mapa y las paradas espontáneas. La última actualización corrige la numeración de los marcadores después de reordenar el recorrido, redondea hacia arriba el odómetro sugerido al finalizar y muestra «Bio» blanco centrado en la notificación GPS.

[Compilación Android verificada en Expo](https://expo.dev/accounts/sitmas/projects/sitmas-movil/builds/cd531108-e189-4318-94ab-958510e9f5a4). La APK se instala sobre la anterior mediante **Actualizar**, conservando la misma firma. No requiere publicar en Google Play ni contratar una suscripción. Las compilaciones gratuitas están sujetas a la cuota y cola de EAS.

Para usarla deben mantenerse encendidos la API de SITMAS y el puente HTTPS, y el celular debe estar en la misma red que la PC. La URL incluida en este piloto es `https://192.168.100.2:8443/api`. Si la app no conecta, ejecutar `npm run api:lan:check` y comprobar que también esté iniciado `npm run api:lan`.

El piloto no modifica el código de SITMAS principal. Las operaciones de viajes y las hojas ficticias de prueba sí escriben datos mediante su API. La prueba física en iOS, el consumo de batería y el seguimiento prolongado con pantalla bloqueada siguen pendientes de validación específica.

## Integrantes

- COGNINI, Facundo
- LOPEZ DIAZ, Erika
- RIVERO, Cristina 
- VIDELA GUTIÉRREZ, Juan
- ZAMORA PÁRRAGA, Ramiro Maximiliano

## Ejecución

Después de clonar o descargar el repositorio, ejecutar el siguiente comando desde una terminal ubicada en la carpeta del proyecto. Este paso **rehidrata el proyecto**: descarga las dependencias declaradas y genera nuevamente la carpeta local `node_modules/`, que no se incluye en GitHub.

```bash
npm install
```

Primero iniciar la API del proyecto SITMAS en `https://localhost:44325`. La app usa sus usuarios y registros reales; no se conecta directamente a SQL Server. Luego iniciar Expo:

```bash
npm start
```

Para abrirla en el navegador, presionar `w` en la terminal de Expo o ejecutar:

```bash
npm run web
```

## Features

| Feature | Estado |
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
| Generación e instalación de una APK de prueba en Android | Completado · versionCode 3 |
| Permiso GPS, posición actual y servicio de ubicación durante viajes | Implementado en Android |
| Áreas seguras para barras del sistema e ícono GPS Bio | Implementado y probado en el piloto |
| Prueba de la APK con servidor y base de datos en la nube | Próxima feature · pendiente de la publicación oficial del servidor |

### Próxima feature: prueba con el servidor en la nube

Cuando el compañero publique el servidor de SITMAS y la base de datos, se preparará una APK de prueba con la URL HTTPS de la API en la nube. Se verificará desde el celular el inicio de sesión, la consulta y aceptación de rutas, las paradas espontáneas, los mapas y el cierre de viajes, comprobando que los cambios se guarden en la base de datos alojada en la nube.

Esta prueba queda **pendiente hasta disponer del servidor, la base de datos y la URL pública de la API**. Permitirá comprobar el funcionamiento fuera de la red Wi-Fi de esta PC y sin depender del puente HTTPS local. La app seguirá accediendo a los datos mediante la API; no se conectará directamente a SQL Server. El piloto LAN actual continúa disponible mientras se prepara ese entorno.

## Hoja de ruta: actualización del 30/09/2026

El módulo adopta el funcionamiento del SITMAS actualizado: las antiguas paradas se presentan como **tareas**, y se elimina por completo la sección **Horarios de paradas**. Los cambios se desarrollan en la rama `test-mapa-hoja-de-ruta`.

1. **Nueva tarea** guarda una tarea en la lista de pendientes usando los orígenes y catálogos reales.
2. **Nueva cabecera** crea una hoja con fecha y vehículo; el chofer puede quedar sin asignar.
3. Arrastrar una tarea a la hoja o usar **Asignar**. Para corregir una asignación, arrastrarla a otra hoja o usar **Mover**. En web, mantener el puntero cerca del borde inferior o superior desplaza el tablero a velocidad moderada.
4. **Eliminar** permite borrar una tarea después de confirmar. Los botones de asignación/movimiento y eliminación comparten una fila para mantener las tarjetas compactas.
5. **Ver en mapa**, junto a la fecha, muestra las tareas numeradas y el circuito desde EMEC y de regreso a EMEC. Agregar una tarea desde el mapa actualiza el recorrido automáticamente.

Al trasladar una tarea se recalculan los totales de ambas hojas; al eliminar la última tarea de una hoja, el total queda en cero. Si falla el cálculo después de guardar un cambio, se informa y se puede reintentar desde el mapa con **Actualizar recorrido** y **Guardar km calculados**. Solo se modifican tareas de hojas pendientes o asignadas.

### Mapa y configuración

Para probar en esta PC, iniciar la API, ejecutar `npm run web` y abrir http://localhost:8082 con la cuenta habitual de SITMAS. Detener una instancia anterior con **Ctrl+C** antes de iniciar otra. El antiguo comando `npm run web:demo` también usa datos reales y ya no inicia el servidor ficticio del puerto 8097.

La configuración local se define en `.env.local`:

| Variable | Uso |
| --- | --- |
| `EXPO_PUBLIC_SITMAS_API_URL` | API de SITMAS; por defecto `https://localhost:44325/api` |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` | Clave de Maps JavaScript API con permisos para localhost |
| `EXPO_PUBLIC_OSRM_URL` | Servidor de cálculo vial; por defecto `https://router.project-osrm.org` |

El mapa requiere conexión a Internet. No guardar credenciales de usuarios ni secretos de servidor en el repositorio o en variables `EXPO_PUBLIC_*`. Las altas, asignaciones y eliminaciones operan sobre la base real mediante la API.

### Alcance de la optimización

- La sede y las tareas usan coordenadas reales de SITMAS. Si faltan coordenadas, se avisa que el recorrido está incompleto; no se inventan puntos ni distancias.
- Hasta 11 tareas se busca el mejor orden de la matriz vial dirigida; entre 12 y 50 se usa una aproximación para reducir kilómetros. No se garantiza el recorrido mínimo absoluto entre todas las calles posibles.
- El orden se calcula en la app porque la API actual no ofrece un campo para persistirlo. Se guarda el total del circuito; los tramos históricos individuales pueden diferir del nuevo orden.
- Las estimaciones no incluyen tráfico en vivo, carga/descarga ni restricciones específicas para camiones. El servidor público de OSRM no garantiza disponibilidad.
- La comprobación visual se realizó en Expo web y en el piloto Android físico, confirmado por el usuario el 20/10/2026. La validación en iOS físico sigue pendiente.

## Verificación

```bash
npm run typecheck
npm test
npm run export:web
```

La suite incluye **49 pruebas automatizadas** sobre consultas y caché, sesión y token JWT, coordenadas, optimización, asignaciones, traslados, eliminación, aceptación de viajes, paradas espontáneas, cierre y recuperación de resultados parciales. También cubre el ruteo sin AbortSignal.throwIfAborted y el inicio, recuperación y cierre del servicio GPS de viajes. Se verificó el flujo inicial del tablero contra la API real con registros temporales que se retiraron al finalizar. Los casos adicionales de traslado y eliminación se validaron con respuestas controladas de API, sin eliminar tareas reales del usuario.

## Guía breve: TanStack Query y Zustand

- `src/query/client.ts`: configura la caché compartida y los reintentos.
- `src/query/sitmas.ts`: define claves, consultas y mutaciones reutilizables. `useSitmasQuery(queries.vehiculos)` entrega datos, carga y error; `useSitmasMutation` guarda y vuelve a consultar las listas afectadas.
- `src/state/session-store.ts`: Zustand guarda la sesión en memoria y limpia la caché al salir.
- `src/state/route-board-store.ts`: Zustand comparte la selección del mapa y el arrastre; las tareas reales permanecen en TanStack.
- `src/components/RoutePlanner.tsx`: ejemplo de ambas herramientas trabajando juntas. Los comentarios explican cada responsabilidad sin duplicar datos.

Para agregar una consulta, definir su método en `sitmas-api.ts`, su clave y opciones en `query/sitmas.ts`, y consumirla con `useSitmasQuery`. Para una escritura, indicar en `useSitmasMutation` las claves que deben refrescarse. Usar Zustand para estado compartido de la interfaz, no para copiar respuestas de la API.

## Sesión del chofer y APK

### Sesión del chofer

El rol `Operador-Logistica` abre una vista operativa simple: viajes disponibles del día cuando no hay uno activo, y mapa de la ruta propia cuando está en curso. El historial queda como consulta secundaria. El login usa la cuenta real de SITMAS y envía su token JWT en las solicitudes; la sesión permanece en memoria y no se guarda la contraseña.

**Aceptar viaje** solicita confirmar el odómetro inicial y asigna la hoja al usuario conectado. Durante el recorrido se reutiliza el sistema del administrador: circuito **EMEC → paradas → EMEC**, orden optimizado por distancias viales, kilómetros y tiempo estimados. **Guardar km calculados** actualiza el total en SITMAS.

**Parada espontánea** permite indicar una referencia, marcar un punto en el mapa o ingresar coordenadas GPS, elegir movimiento y opcionalmente material. La parada se agrega al viaje activo y el circuito se recalcula. El total recalculado puede guardarse desde el mapa. Las escrituras evitan dobles envíos y muestran avisos ante resultados inciertos; el backend todavía guarda ubicación/parada e inicio/odómetro mediante operaciones separadas.

La interfaz se adapta al formato web **Pixel 9 (412 × 924)** y se probó en un Android físico. Las áreas seguras evitan superponer el encabezado, los modales y los controles con las barras del sistema. Las estimaciones parten de EMEC y no incluyen tráfico en vivo ni restricciones particulares de camiones.

**Finalizar viaje** pide confirmar el regreso a EMEC y el odómetro real del tablero. La recomendación se redondea hacia arriba a kilómetros enteros: por ejemplo, 69.623 km iniciales más 52,67 km estimados sugieren 69.676 km. Un cierre ya confirmado conserva su valor original al reintentar. Valida que el valor final no sea menor al inicial ni supere 180 km de recorrido, registra el retorno, cierra el odómetro y confirma la hoja en estado Finalizado. Al completar el cierre vuelve a Viajes disponibles y la ruta aparece en Historial.

El registro operativo del viaje (IDs, odómetro inicial y progreso de cierre) se conserva en almacenamiento local web y en documentos de la app Android/iOS, sin guardar contraseñas ni tokens allí. Si el odómetro se cierra y falla la hoja, se puede reintentar solamente el cierre pendiente; si el resultado del odómetro es incierto, se bloquea el reenvío y se requiere revisión administrativa. La API aún no permite recuperar correctamente todos los odómetros abiertos, por lo que los viajes iniciados fuera de esta app requieren revisión.

### APK de prueba y actualización GPS

La APK inicial se instaló en Android y el usuario confirmó el acceso de Juan y Mauro. La actualización con versionCode 2 incorporó permiso de ubicación, bloqueo de uso si se desactiva el GPS, ubicación actual en mapas, franjas seguras para las barras del sistema e ícono BioCba. Corrigió el cálculo del recorrido en React Native, que no dispone de AbortSignal.throwIfAborted. La versión 3, confirmada por el usuario, regenera el marcador nativo cuando cambia su número, redondea la recomendación del odómetro y usa el drawable monocromo «Bio» para la notificación del servicio GPS.

Durante un viaje activo del chofer, se solicita ubicación «todo el tiempo» y se mantiene un servicio con notificación. Solo se conserva el último punto en el teléfono; no se envía al backend. Se detiene al finalizar o cerrar sesión. Android puede detenerlo por cierre forzado o restricciones de batería: no garantiza seguimiento con la app terminada. El piloto funcional no certifica autonomía ni seguimiento prolongado en todos los modelos; esos casos requieren pruebas específicas.

Los perfiles de `eas.json` contemplan `preview` (APK para el piloto LAN) y `production` (AAB). El identificador Android es `com.sitmas.movil`, con propietario Expo `sitmas` y slug `sitmas-movil`. El proyecto EAS está vinculado, con firma Android remota y la variable sensible de mapas en `preview`. La misma firma permite instalar la actualización sobre la APK anterior.

### Piloto por Wi-Fi local, sin modificar SITMAS principal

El perfil `preview` usa `https://192.168.100.2:8443/api`. Desde esta carpeta:

```powershell
# Con la API de SITMAS encendida en https://localhost:44325
npm run api:lan
# En otra terminal: comprobación HTTPS de solo lectura
npm run api:lan:check
```

El puente reenvía únicamente rutas `/api/` al backend local y verifica su certificado. Exige token Bearer salvo para el login; la API verifica los tokens. Esto no sustituye los controles de rol y propiedad de las rutas pendientes en el backend. La APK preview confía en una CA privada solo para la IP indicada, conservando HTTPS y la confianza normal para los demás destinos. No se instala un certificado en Windows ni en el teléfono. El certificado del piloto dura 29 días; conservar `.local/lan-api` y su CA pública durante ese plazo. Si cambia la IP o vence el certificado, hace falta preparar y compilar nuevamente el piloto.

La preparación inicial se realiza una sola vez con `./scripts/prepare-lan-api.ps1 -LanIp 192.168.100.2`. Ya se realizó en esta PC. Las claves privadas viven en `.local/`, excluida de Git y de la subida EAS. Solo `assets/certificates/sitmas-lan-ca.pem` es público y debe acompañar la compilación. No borrar ni regenerar estos archivos mientras se use una APK que dependa de ellos.

Para ejecutar la APK, PC y celular deben comunicarse por la red local y la PC debe mantener encendidos SITMAS y el puente. Fuera de esta carpeta: verificar firewall del puerto TCP 8443 e instalar la APK. La sesión web de Expo no autentica automáticamente la CLI. No contratar un plan pago. Las variables sensibles y los archivos privados de `.local/` no se incluyen en Git; se deben preparar al configurar otra PC.

La CLI local se invoca con `node scripts/eas.cjs ...`. Usa EAS 25.2.0 descargado en `.local/npm-cache`; conserva estado y autenticación en `.local/eas`. Sus temporales están en `D:\descarga codex\plugin-temp\sitmas-movil-eas`: EAS no permite que queden dentro del repositorio. No modifica `CODEX_HOME` ni instala Java/globalmente. La organización se comprobó en Free ($0/mes) con 0 compilaciones usadas antes de iniciar el primer build.

La clave Android está en la variable sensible `GOOGLE_MAPS_ANDROID_API_KEY` de `preview`, subida con autorización expresa. Es visible al extraer la APK, como cualquier clave móvil; restringirla al paquete/firma y al SDK Android desde Google Cloud. La captura aportada permite asumir la habilitación del SDK, pero no confirma esas restricciones.

`database/` conserva scripts SQL de compatibilidad y `scripts/audit-origin-coordinates.ps1` es una auditoría manual de lectura que requiere la configuración local del principal. No se ejecutan al instalar, iniciar ni compilar la app. Aplicar SQL corresponde al mantenimiento del backend y requiere una tarea autorizada aparte.

Guías de esta PC: `docs/prueba-chofer.md` y `docs/chofer-android.md`; la carpeta `docs/` contiene documentación local excluida de Git.
