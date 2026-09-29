# Mapa de hojas de ruta

Trabajo en la rama `test-mapa-hoja-de-ruta`, creada desde `30f07bc`. La rama `main` conserva ese estado.

## Probar en esta PC

Con la API SITMAS iniciada, ejecutar `npm run web` como antes. La URL predeterminada de la API sigue siendo `https://localhost:44325/api`; se puede configurar con `EXPO_PUBLIC_SITMAS_API_URL`.

Abrir http://localhost:8082 e ingresar con la misma cuenta que se utiliza en SITMAS. El servidor de demostración fue retirado: el comando anterior `npm run web:demo` se conserva como alias para iniciar **datos reales** y no levanta el puerto 8097. Antes de reiniciar, detener con Ctrl+C cualquier instancia anterior de Expo o de la demo para descartar su configuración y caché en memoria.

Todos los listados (hojas, paradas, vehículos, choferes, materiales, ubicaciones e indicadores) se consultan por la API. Las altas, ediciones y bajas afectan la base de SITMAS. Si falla una consulta, se informa el error; no se sustituye por datos ficticios. Las únicas respuestas simuladas restantes están dentro de las pruebas unitarias y no se sirven a la app.

El mapa necesita Internet y la variable `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` de `.env.local`, con Maps JavaScript API habilitada y localhost permitido en las restricciones de la clave. Esta PC ya tenía esa configuración y se probó su carga. No se versiona la clave. Las variables EXPO_PUBLIC forman parte del cliente: no colocar secretos de servidor en ellas.

En Android/iOS se conserva `react-native-maps`, compatible con Expo SDK 57. La prueba visual de esta entrega se realiza en Expo web; todavía debe validarse en un dispositivo nativo.

## Funcionamiento

- Resumen de hoja, mapa de 340 px y luego sección **Paradas · Horarios**.
- Numeración por hora estimada, desempate por ID; horarios ausentes o inválidos al final. No se optimiza ni se persiste un nuevo orden en la base.
- Pulsar un marcador muestra su lugar, horario y estado; **Editar esta parada** abre el formulario existente.
- **Ver recorrido completo** encuadra los puntos y la geometría vial.
- TanStack Query comparte las paradas de la agenda. La consulta de geometría depende de la hoja, del servidor de ruteo y de la secuencia de coordenadas. Cambios de ubicación u orden reemplazan el trazado y cancelan consultas sin consumidores.
- Una parada sin coordenadas permanece en la agenda e interrumpe el tramo. No se dibuja una línea que la saltee. Sin paradas o con una sola no se consulta el servicio de ruteo.
- Si el ruteo falla, quedan los marcadores y un botón de reintento. No se presentan líneas rectas como rutas por calles.
- Los selectores abren un panel superpuesto con scroll propio y búsqueda cuando hay más de ocho opciones. Cerrar, tocar fuera o Escape/Atrás conserva el formulario. Menú, formulario de hoja y listado se expanden en 200 ms, respetando movimiento reducido.

## Decisión sobre DirectionsService

SITMAS clásico usa Google DirectionsService para dibujar rutas y OSRM para distancias. Se evaluó Google Routes, su reemplazo actual, pero la integración nativa requeriría resolver también el acceso al servicio web y sus credenciales.

Esta rama conserva los mapas existentes (Google Maps JavaScript en web y react-native-maps en móvil) y usa **OSRM** como servicio común de geometría vial, sin introducir DirectionsService ni una nueva dependencia. Consulta el servicio Route con coordenadas longitud,latitud, geometría GeoJSON y el orden fijo de las paradas.

`EXPO_PUBLIC_OSRM_URL` permite configurar un servidor compatible. Por defecto usa `https://router.project-osrm.org`, un servidor público para demostración, sin garantía de disponibilidad; no debe considerarse infraestructura de producción. El servidor recibe las coordenadas del recorrido. Para producción se debe elegir una instancia propia o un proveedor con condiciones adecuadas. El cálculo es para conducción general, no navegación certificada para camiones, y los minutos no incluyen servicio en paradas ni tráfico en vivo. La visualización no escribe ni recalcula `DistanciaDesdeAnterior_Km` guardada en SITMAS.

Referencias:
- https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
- https://developers.google.com/maps/documentation/javascript/routes/overview
- https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md

## Verificación

- `npm run typecheck`
- `npm test`: incluye orden, huecos sin GPS, formato de coordenadas, respuestas inválidas, lotes de hojas largas y cancelación.
- `npm run export:web`
- Navegador: acceso con la cuenta de SITMAS y lectura de sus hojas, paradas y catálogos. La comprobación de datos reales se hace sin crear, editar ni borrar registros.


## Comprobación con datos reales — 29/09/2026

- Base consultada: `Gestion_SITMAS`, usando la conexión ya configurada en la API.
- 14 hojas en SQL Server y 14 en la API: coinciden ID, fecha, vehículo y chofer.
- 34 paradas en la vista SQL y 34 en la API: coinciden ID, hoja, origen, horario, estado, latitud y longitud; ninguna diferencia encontrada.
- 30 paradas tienen coordenadas; 4 carecen de ellas en la base y permanecen en la agenda sin inventar un punto en el mapa.
- Catálogos consultados correctamente: 5 vehículos, 5 choferes, 23 ubicaciones, 40 orígenes, 8 tipos de material, 2 tipos de movimiento, 2 recursos movilizados y 3 estados.
- Acceso validado en el navegador con la cuenta indicada por el usuario. No se guardan credenciales en el repositorio.
- La hoja 27 se mostró con sus tres paradas reales. Las comprobaciones de datos fueron de lectura: no se ejecutaron altas, modificaciones ni bajas reales.
- Los kilómetros y minutos del mapa son estimaciones calculadas por OSRM a partir de las coordenadas guardadas; no reemplazan la distancia almacenada en la base.

La auditoría se puede repetir desde PowerShell, indicando el archivo de configuración de la API:

```powershell
./scripts/verify-sitmas-data.ps1 -SitmasConfig 'RUTA_AL_PROYECTO_SITMAS/WebApi/API_SITMAS/Web.config'
```

El script hace consultas SELECT y GET, no muestra la cadena de conexión y termina con error si encuentra diferencias. Los recuentos anteriores corresponden al momento de la verificación; pueden cambiar al registrar nuevas operaciones.
