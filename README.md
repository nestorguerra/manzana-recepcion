# Manzana · Recepción de medicamentos

App HTML para iPhone y Android. Registra **medicamento, cantidad y persona receptora**. Genera fecha, hora y número de albarán. Incluye dashboard, consulta y búsqueda, anulación con historial, impresión/PDF, exportación e importación de Excel `.xlsx` e instalación como app web.

## Uso

Abra la dirección publicada. En iPhone, Safari → Compartir → Añadir a pantalla de inicio. En Android, Chrome → ⋮ → Instalar aplicación o Añadir a pantalla de inicio. La primera carga necesita conexión; después se conserva una copia de la app para uso sin conexión. La instalación depende del navegador y del sistema; no incluye un paquete de App Store o Google Play.

Los tres campos del formulario son obligatorios. La cantidad debe ser un entero entre 1 y 1.000.000. Indique la presentación en el nombre del medicamento: por ejemplo, «Paracetamol 1 g · caja de 20». La cantidad cuenta unidades de esa presentación. Se guardan la fecha/hora UTC y se muestran en la zona horaria local del dispositivo.

## Almacenamiento y Excel

Cada navegador o app instalada guarda su propia base de datos pequeña en IndexedDB. **No hay base de datos compartida ni sincronización automática**. No se mandan las entradas a GitHub ni a un servidor. El Excel es el formato de copia e intercambio; el navegador no puede modificar automáticamente un archivo Excel del teléfono.

En «Excel y copias», descargue todos los registros. El `.xlsx` incluye hojas **Entradas**, **Resumen** y **Por medicamento**. No se suman cantidades de medicamentos distintos en el dashboard. Los resúmenes cuentan solo entradas activas. El Excel de registros incluye también los anulados.

Para reunir móviles, exporte en cada uno e importe sus archivos en el dispositivo de referencia. La importación añade registros y conserva los actuales. Los identificadores originales evitan duplicar albaranes. Los ID que coincidan con contenido diferente bloquean la importación completa. Los cambios de estado de un ID existente no se aplican: se conserva el estado local y se informa de la diferencia. Para uso consistente, anule en el dispositivo de referencia los registros consolidados.

Puede descargar una plantilla vacía para añadir entradas manuales. Obligatorios: Medicamento, Cantidad y Recibido por. Fecha ISO es opcional y debe tener zona horaria; si falta, se usa la hora de la primera importación. Las filas sin ID se identifican por archivo y fila: reimportar el mismo archivo sin modificar no duplica; archivos diferentes sin ID pueden repetir datos. Máximo de importación: 5 MB y 10.000 filas.

**Conserve copias de Excel.** Borrar los datos del navegador, desinstalar según el sistema o cambiar de móvil puede borrar el registro local. Una descarga iniciada no garantiza que el usuario haya guardado el archivo. Los navegadores y las apps instaladas pueden usar almacenamientos separados según el sistema: compruebe dónde están sus registros antes de cambiar de acceso.

La app empieza vacía. No incluye datos reales ni ejemplos guardados. Las anulaciones conservan el albarán, la fecha de anulación y los datos originales. No hay edición ni borrado de registros desde la interfaz.

## Alcance

Control sencillo de entradas, sin identificación de usuarios ni firma electrónica. El nombre de la persona receptora es un dato escrito por quien registra. Los registros locales y los Excel son editables por el propietario del dispositivo y no constituyen una auditoría inalterable. No controla existencias, salidas, lotes, caducidades, dispensación ni tratamientos.

## Archivos y ejecución

La app no necesita compilación ni un servidor de aplicaciones. Sirva esta carpeta por HTTPS, por ejemplo con GitHub Pages. Para desarrollo, use un servidor HTTP en localhost. Abrir `index.html` como archivo permite una ejecución limitada según el navegador, pero no instala el servicio sin conexión. `manzana-app.zip` contiene una copia de los archivos.

La única biblioteca incluida es **SheetJS Community Edition 0.20.3**, con licencia Apache 2.0 en `vendor/SHEETJS-LICENSE.txt`. Se sirve localmente, funciona sin conexión y no requiere CDN durante el uso. Documentación: https://docs.sheetjs.com/docs/getting-started/installation/standalone/

El icono de manzana es una ilustración propia de la app. No implica afiliación con Apple.
