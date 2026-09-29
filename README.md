# SITMAS Móvil

Aplicación de Expo y React Native conectada a la API de SITMAS y su base SQL Server. TanStack Query gestiona los datos remotos y Zustand mantiene la sesión del usuario en memoria.

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
| Datos desde API y autenticación real utilizando TanStack y Zustand| Completado |
| Navegación a módulos operativos | Previsto |
| Registro de ingresos y reportes | Previsto |
| Creacion y adaptacion estructural para la sesion del Chofer | Previsto |
## Mapa de hojas de ruta

La rama de pruebas incorpora recorrido vial, paradas numeradas y selectores sin saltos de pantalla. Ejecutar `npm run web` y abrir http://localhost:8082 con la cuenta habitual de SITMAS. El antiguo comando `npm run web:demo` también usa ahora datos reales. Ver [configuración y guía de pruebas](docs/mapa-hoja-de-ruta.md).
