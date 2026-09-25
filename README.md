# KIT-FLANDES

Las piezas de interfaz que comparten las apps de la Alcaldía de Flandes
(CONTRATISTA, CONTRATACIÓN, SUPERVISIÓN, CONTABILIDAD y las que vienen:
TESORERÍA, PRENSA y ADMIN).

Una sola copia de cada pieza. Cada app lleva su carpeta `kit/` copiada de aquí.
Si una pieza se mejora dentro de una app, la mejora **vuelve aquí** antes de
llevarla a las demás.

- Demostración tocable: `index.html` (publicada en GitHub Pages).
- Sin npm y sin compilar. jsPDF, SheetJS y pdf.js se bajan de CDN solo cuando
  hacen falta (exportar o ver un PDF), con respaldo si la red falla.
- Modo oscuro en todas las piezas, desde `base.css`.

**Versión del kit:** la de `version.js` (raíz). Entrega 7.2: el kit quedó al
día con las copias de las cuatro apps publicadas el 23/09/2026.

---

## Las piezas

| Archivo | Qué hace |
|---|---|
| `kit.js` | Núcleo: `KIT.pedir` (POST a Apps Script con token), guardado local por app, `pesos`, `fecha`, `norm` (respeta la Ñ), `esc`, avisos, y **`pesosEnVivo`** (pone los puntos de miles mientras se escribe y guarda solo los dígitos). |
| `iconos.js` | El set de iconos de trazo. Va **siempre** detrás de `kit.js`: las piezas dibujan sus botones con `KIT.icono()`. |
| `base.css` | Tokens de color (claro y oscuro), letra de la app, tarjetas, botones y la rejilla 1 / 2 / 3. |
| `banner.js/.css` | Barra superior con foto, menú, botón atrás y luna / sol. |
| `sesion.js/.css` | Login por POST, cambio y recuperación de contraseña, elegir contrato. Con `arranqueEnLogin: true` el login trae también el inicio de la app en el **mismo viaje** y se lo pasa a `comprobar(d)`. Login compacto: cabe entero en un portátil. |
| `esqueletos.js/.css` | Esqueletos de carga (sin loader iOS). Centrados. |
| `guardado.js/.css` | El cohete del guardado: cielo con estrellas, fuego, un punto por paso y confeti al terminar. **No** registra `beforeunload` (el cuadro del navegador enseña el dominio y no se puede cambiar). |
| `fechas.js/.css` | Rueda de fechas estilo iOS. **No volver a meter scroll-snap en esta rueda.** |
| `adjuntos.js/.css` | Adjuntar, arrastrar y pegar. |
| `imagenes.js` | Antes de subir una foto: JPEG, lado mayor 1.600 px, menos de 900 KB, orientación EXIF. Arma el collage de varias fotos. |
| `visor.js/.css` | Visor de documentos multi-documento. Acepta bytes ya listos (`{bytes}`) y `precalentar()` baja pdf.js antes del primer documento. |
| `carrusel.js/.css` | Carrusel de imágenes con zoom (evidencias de 1 a 3 imágenes). |
| `pastillas.js` | Pastillas de filtro con conteo. |
| `listas.js` | Patrón de carga única de listas (filtros locales, sin volver al servidor). |
| `insights.js/.css` | El robot de cada vista: abre **directo** con la guía y las cifras, sin "Iniciar". La voz arranca sola si el CORE la tiene configurada. Se mueve con **clic sostenido** (medio segundo); un roce o un scroll no lo mueven. |
| `exportar.js/.css` | Excel plano y **PDF gerencial por bloques** (membrete, cifras, una ficha por registro, agrupable). La tabla de antes sigue con `{ modo: 'tabla' }`. |
| `informe-cuentas.js` | Informe de las cuentas de UN contrato (Excel y PDF por bloques). Lo usan SUPERVISIÓN y CONTABILIDAD; va igual a TESORERÍA. |
| `soporte.js/.css` | Soporte con hasta 3 fotos, que viajan reducidas. Al llegar le da a la persona su **número de solicitud**. Si el CORE no contesta, ofrece WhatsApp. **10.4:** calificación con **estrellas** de los casos resueltos (llega sola con `inicio`: el CORE pega `_soporte` y `K.pedir` dispara `kit:soporte`; con 1 o 2 estrellas se reabre) y **Mis solicitudes** (`soporteMios`). |
| `conexion.js/.css` | "Es tu internet, no la app": barra sin conexión, atajos de rescate y errores traducidos. |
| `antidoble.js/.css` | Capa 12: un botón, una sola ejecución. |
| `instalar.js/.css` | Vista instalar con los casos de cada plataforma (Android, iPhone por Compartir, PC). |
| `bienvenida.js/.css` | Puerta de entrada: instalar o seguir en el navegador. Usa el nombre de la app de `MARCA.TITULO`. |
| `avisos.js` | Avisos push con Firebase: permiso, token del teléfono y registro en el CORE. |
| `buzon.js/.css` | "Mis notificaciones": los avisos quedan, se filtran por sin leer y se marcan leídos. Anuncia el conteo con el evento `kit:buzon`. |
| `cielo.js/.css` | La aurora y las burbujas de la portada para cualquier franja. En barras fijas, `soloFondo()`. |
| `personas.js/.css` | Caras de quien atiende: foto de Drive o círculo con iniciales (nombre + primer apellido), color estable, la Ñ empareja con N. `KIT.miniDrive()`. |
| `perfil.js` | Foto de perfil: subir, recortar, girar, quitar. Sale un cuadrado de 512 px. La misma foto en las siete apps. |
| `confirmar.js` | Sustituye `confirm` y `alert` del navegador. `abrir`, `preguntar`, `avisar`. Devuelve promesa. |
| `creditos.js/.css` | El pie: **Oscar Polania**, *Experto en soluciones digitales*. Lee `MARCA_AUTOR` de CONFIG. |
| `version.js` | Detecta una publicación nueva, borra **solo** las cachés de esa app y recarga desde el inicio. |

`buzon` solo lo usa CONTRATISTA hoy. `informe-cuentas` lo usan SUPERVISIÓN y CONTABILIDAD.

---

## Orden de carga en una app

Primero `marca.js` (datos de la app) y `version.js` (número de versión).
Después el kit, en este orden:

```html
<script src="kit/kit.js"></script>
<script src="kit/iconos.js"></script>
<script src="kit/confirmar.js"></script>
<script src="kit/version.js"></script>
<script src="kit/banner.js"></script>
<script src="kit/sesion.js"></script>
<script src="kit/esqueletos.js"></script>
<script src="kit/guardado.js"></script>
<script src="kit/conexion.js"></script>
<script src="kit/instalar.js"></script>
<script src="kit/antidoble.js"></script>
<script src="kit/creditos.js"></script>
<script src="kit/avisos.js"></script>
<script src="kit/bienvenida.js"></script>
<script src="kit/cielo.js"></script>
<script src="kit/visor.js"></script>
<script src="kit/listas.js"></script>
<script src="kit/insights.js"></script>
<script src="kit/pastillas.js"></script>
<script src="kit/personas.js"></script>
<script src="kit/perfil.js"></script>
<script src="kit/adjuntos.js"></script>
<script src="kit/imagenes.js"></script>
<script src="kit/soporte.js"></script>
<script src="kit/fechas.js"></script>
<script src="kit/carrusel.js"></script>
<script src="kit/exportar.js"></script>
<script src="kit/informe-cuentas.js"></script>   <!-- solo si la app lo usa -->
<script src="kit/buzon.js"></script>             <!-- solo si la app lo usa -->
```

Cada `.css` va en el `<head>` con su pareja. Una app puede dejar fuera las
piezas que no usa.

---

## Avisos para quien monte el kit en una app

- **CONTRATISTA y el PDF:** el exportador nuevo saca el PDF **por bloques**
  por defecto. CONTRATISTA es la única app que se queda con la tabla, así que al
  actualizar su `kit/exportar.js` hay que pasar `{ modo: 'tabla' }` en su llamada
  a `aPDF` (hoy está en `js/seguimiento.js`, egresos).
- **Login en un viaje:** para que el login traiga el arranque, la app pasa
  `arranqueEnLogin: true` y un `comprobar(d)` que use `d` si ya trae el inicio.
- **Insights:** ya no hay botón "Iniciar". Cada vista llama a `montar()` con su
  `guia`; el robot no se vuelve a crear.

---

## Pruebas

Se corren en Chromium de verdad con Playwright (no jsdom: la rueda de fechas y
los esqueletos dependen del layout real).

```
node pruebas/banco.js            # todas
node pruebas/banco.js buzon      # solo un grupo
node pruebas/mutaciones.js       # rompe el código a propósito y comprueba que el banco lo caza
```

Los dos archivos esperan el kit en `../salida/KIT-FLANDES` respecto a
`pruebas/`.

Entrega 7.2: **320 pruebas verdes**, 0 rojas. Los nombres y las cifras de las
pruebas salen de la copia de trabajo (USUARIOS, SUPERVISORES, CUENTAS).
