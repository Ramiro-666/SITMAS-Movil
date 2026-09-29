# Mapa de hojas de ruta

Trabajo en la rama `test-mapa-hoja-de-ruta`, creada desde `30f07bc`. La rama `main` conserva ese estado.

## Probar en esta PC

Con la API SITMAS iniciada, ejecutar `npm run web` como antes. La URL predeterminada de la API sigue siendo `https://localhost:44325/api`; se puede configurar con `EXPO_PUBLIC_SITMAS_API_URL`.

Para una prueba aislada, ejecutar:

```bash
npm run web:demo
```

Este comando inicia una API ficticia en memoria en el puerto 8097 y Expo web en el 8082. Abrir http://localhost:8082 y entrar con usuario `demo` y contraseña `demo`. Ir a **Logística → Hojas de ruta → HR-1**. La hoja 1 contiene tres paradas con coordenadas en Córdoba; HR-2 está vacía. Las escrituras de esta demo no llegan a SITMAS y se pierden al reiniciarla. Detenerla con Ctrl+C antes de iniciar otra demo en los mismos puertos.

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
- Navegador: mapa y recorrido vial real sobre datos ficticios; tamaño escritorio y 390 px; selección de marcadores; alta de parada; formulario sin desplazamiento al abrir/cerrar selectores; hoja vacía.

