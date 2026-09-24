/* ============================================================
   KIT-FLANDES · VERSIÓN

   Sube este número en CADA publicación. Es lo único que hay que
   tocar para que la app se actualice sola en todos los teléfonos:

     · kit/version.js lo vuelve a leer de la red cuando la persona
       entra o vuelve a la app, borra las cachés de esta app y
       recarga si no coincide con el que tiene cargado.
     · sw.js lo usa para nombrar su caché ('kit-v<número>'),
       así que cada publicación estrena caché y la anterior se borra.
     · El pie de las vistas lo enseña junto a la firma.

   Formato: año.mes.día.consecutivo del día.
   ============================================================ */
var APP_VERSION = "2026.09.23.3";
