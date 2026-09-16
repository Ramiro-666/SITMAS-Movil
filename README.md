# SITMAS Móvil

Primera versión de una aplicación móvil desarrollada con Expo y React Native. Presenta una maqueta de consulta operativa para el Sistema Integral de Trazabilidad de Materiales (SITMAS), inspirada visualmente en el proyecto principal.

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

Luego iniciar Expo:

```bash
npm start
```

### Conexión con la API SITMAS

La API debe estar iniciada en `https://localhost:44325/`. Para probar desde el navegador o un emulador local no hace falta una configuración adicional. Para abrir la app con **Expo Go en un teléfono físico**, `localhost` apunta al teléfono y no a la PC: iniciá Expo indicando la IP local de la PC y conservando `/api` al final.

```cmd
set EXPO_PUBLIC_SITMAS_API_URL=https://TU_IP_LOCAL:44325/api
npm start
```

El certificado HTTPS de IIS Express debe ser confiable desde el dispositivo para que este pueda consultar la API.

Para abrirla en el navegador, presionar `w` en la terminal de Expo o ejecutar:

```bash
npm run web
```

## Features

| Feature | Estado |
| --- | --- |
| Pantalla de acceso con animación BioCba | Completado |
| Validación de credenciales contra API SITMAS | Completado |
| Fondo animado con colores institucionales SITMAS | Completado |
| Menú superior desplegable para móvil | Completado |
| Secciones Inicio, Logística y Configuración | Completado |
| Identidad visual y logotipos SITMAS incluidos localmente | Completado |
| Dashboard móvil de peso bruto, stock neto y rendimiento con gráficos animados | Implementado; consulta de lectura verificada |
| Consulta de vehículos y hojas de ruta reales | Completado |
| Alta de registro de odómetro contra API | Completado |
| Navegación por iconos a módulos operativos | Completado |
| ABM de vehículos, tipos de vehículo, marcas y modelos mediante API | Implementado; pendiente prueba de escritura con datos de prueba |
| Alta, edición y baja de hojas de ruta | Implementado; pendiente prueba de escritura con datos de prueba |
| Alta, edición y baja de paradas | Implementado; pendiente prueba de escritura con datos de prueba |
| Agenda de paradas con arrastre para cambiar horario | Implementado; pendiente prueba en Pixel 9 físico |
| Traslado de parada a otro día con elección de vehículo y chofer | Implementado; pendiente prueba de escritura con datos de prueba |
| Registro de ingresos y reportes | Previsto |
