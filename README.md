# SITMAS Móvil

Aplicación de Expo y React Native conectada a la API de SITMAS y su base SQL Server. TanStack Query gestiona los datos remotos y Zustand mantiene la sesión del usuario y el estado de interacción del tablero en memoria.

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
| Validación del tablero en dispositivos Android/iOS físicos | Pendiente |
| Registro de ingresos y reportes | Previsto |
| Creacion y adaptacion estructural para la sesion del Chofer | Previsto |

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
- La comprobación visual se realizó en Expo web, incluida una pantalla de 390 px. La validación en dispositivos Android/iOS físicos sigue pendiente.

## Verificación

```bash
npm run typecheck
npm test
npm run export:web
```

La suite incluye **26 pruebas automatizadas** sobre consultas y caché, sesión, coordenadas, optimización, asignaciones, traslados y eliminación. Se verificó el flujo inicial del tablero contra la API real con registros temporales que se retiraron al finalizar. Los casos adicionales de traslado y eliminación se validaron con respuestas controladas de API, sin eliminar tareas reales del usuario.

## Guía breve: TanStack Query y Zustand

- `src/query/client.ts`: configura la caché compartida y los reintentos.
- `src/query/sitmas.ts`: define claves, consultas y mutaciones reutilizables. `useSitmasQuery(queries.vehiculos)` entrega datos, carga y error; `useSitmasMutation` guarda y vuelve a consultar las listas afectadas.
- `src/state/session-store.ts`: Zustand guarda la sesión en memoria y limpia la caché al salir.
- `src/state/route-board-store.ts`: Zustand comparte la selección del mapa y el arrastre; las tareas reales permanecen en TanStack.
- `src/components/RoutePlanner.tsx`: ejemplo de ambas herramientas trabajando juntas. Los comentarios explican cada responsabilidad sin duplicar datos.

Para agregar una consulta, definir su método en `sitmas-api.ts`, su clave y opciones en `query/sitmas.ts`, y consumirla con `useSitmasQuery`. Para una escritura, indicar en `useSitmasMutation` las claves que deben refrescarse. Usar Zustand para estado compartido de la interfaz, no para copiar respuestas de la API.
