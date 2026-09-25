/* ============================================================
   KIT-FLANDES · ICONOS (pieza 24)
   Fase 4 · entrega 4.4 (4.8: once iconos más para institucional,
   trámites y tutoriales)

   El problema que resuelve
     El kit venía usando emojis como botones: el ojo de la contraseña,
     el robot de Insights, la luna del tema, la X de las capas. Un emoji
     no es un icono: lo dibuja el sistema operativo, así que cambia de
     forma y de color en cada teléfono, no hereda el color del texto, no
     se alinea con la tipografía y en Windows sale de otra familia. En
     una app institucional se ve como un borrador, no como un producto.

   Cómo lo resuelve
     Un set de iconos SVG de línea, todos con la misma rejilla y el mismo
     grosor, calcados del estándar que ya usan las apps de referencia del
     ecosistema (IPS-Vascular y la capa 11 de SEC-HACIENDA):

         viewBox="0 0 24 24"  ·  fill="none"  ·  stroke="currentColor"
         stroke-width 2.2     ·  extremos y uniones redondeados

     `stroke="currentColor"` es lo que lo hace valer: el icono toma el
     color del texto donde esté, así que funciona igual en modo día y en
     modo oscuro, y sobre el verde de la marca, sin una sola línea de CSS.

   Cómo se usa

     K.icono('ojo')                  → el SVG como texto, 20px
     K.icono('cerrar', 18)           → el mismo, a 18px
     K.piezas.iconos.nodo('robot')   → ya como elemento, para appendChild
     K.piezas.iconos.hay('cohete')   → ¿existe ese nombre?
     K.piezas.iconos.nombres()       → todos los nombres, para las pruebas

   Los nombres van en español, como el resto del kit, y son los que se
   leen en el código: 'ojo', 'ojo-tapado', 'cerrar', 'luna'…

   Añadir uno nuevo
     Una línea más en TRAZOS con el contenido del <svg> (sin el <svg>).
     Nada de rellenos de color: solo trazo, para que el set se vea como
     un set. Si un icono necesita relleno (un punto, un cuadrado), se
     pone con fill="currentColor" stroke="none" en ese trazo suelto.
   ============================================================ */

(function (raiz) {
  'use strict';

  var K = raiz.KIT = raiz.KIT || {};
  K.piezas = K.piezas || {};

  /* Grosor y tamaño de casa. 2.2 es el punto medio entre el 1.9 de la
     capa 11 de HACIENDA y el 2.4 de IPS: se ve firme a 18px y no se
     empasta a 14px. */
  var GROSOR = 2.2;
  var TAMANO = 20;

  var TRAZOS = {

    /* ---------- sesión y seguridad ---------- */
    'ojo':
      '<path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12z"/>' +
      '<circle cx="12" cy="12" r="3.1"/>',
    'ojo-tapado':
      '<path d="M3 3l18 18"/>' +
      '<path d="M10.6 6.1A8.7 8.7 0 0 1 12 6c6.2 0 9.8 6 9.8 6a17 17 0 0 1-2.9 3.5"/>' +
      '<path d="M6.5 7.9A16.6 16.6 0 0 0 2.2 12S5.8 18 12 18a9.3 9.3 0 0 0 3.6-.7"/>' +
      '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    'candado':
      '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2"/>' +
      '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    'llave':
      '<circle cx="8" cy="8" r="3.6"/><path d="M10.6 10.6L20 20"/><path d="M16.5 16.5l2-2"/>',

    /* ---------- navegación ---------- */
    'cerrar':  '<path d="M6 6l12 12M18 6L6 18"/>',
    'atras':   '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    'adelante':'<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    'arriba':  '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
    'abajo':   '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>',
    'mas':     '<path d="M12 5v14M5 12h14"/>',
    'menos':   '<path d="M5 12h14"/>',
    'check':   '<path d="M4.5 12.8l4.7 4.7L19.5 7"/>',
    'buscar':  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',

    /* ---------- tema ---------- */
    'luna': '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5 8.7 8.7 0 1 0 20.5 14.3z"/>',
    'sol':
      '<circle cx="12" cy="12" r="4.2"/>' +
      '<path d="M12 2.2v2.3M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3' +
      'M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"/>',

    /* ---------- archivos y visor ---------- */
    'clip':
      '<path d="M20.1 11.3l-8.5 8.5a5.2 5.2 0 0 1-7.4-7.4l8.8-8.8a3.5 3.5 0 0 1 4.9 4.9l-8.8 8.8a1.7 1.7 0 0 1-2.5-2.5l7.9-7.8"/>',
    'imagen':
      '<rect x="3.2" y="4.5" width="17.6" height="15" rx="2.4"/>' +
      '<circle cx="8.6" cy="9.6" r="1.5"/><path d="M4 17l5-5 4.5 4.5L16.5 13l4 4"/>',
    'pdf':
      '<path d="M14 3.2H7.4A2.2 2.2 0 0 0 5.2 5.4v13.2a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2V8.2z"/>' +
      '<path d="M14 3.2v5h4.8"/><path d="M8.8 15.5h1.4M12.4 15.5h2.8M8.8 12.3h6.4"/>',
    'hoja':
      '<rect x="3.6" y="4.2" width="16.8" height="15.6" rx="2.2"/>' +
      '<path d="M3.6 9.4h16.8M3.6 14.6h16.8M9.2 4.2v15.6M14.8 4.2v15.6"/>',
    'documento':
      '<path d="M14 3.2H7.4A2.2 2.2 0 0 0 5.2 5.4v13.2a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2V8.2z"/>' +
      '<path d="M14 3.2v5h4.8"/><path d="M8.6 12.6h6.8M8.6 16h4.4"/>',
    'archivo':
      '<path d="M14 3.2H7.4A2.2 2.2 0 0 0 5.2 5.4v13.2a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2V8.2z"/>' +
      '<path d="M14 3.2v5h4.8"/>',
    'abrir-pestana':
      '<path d="M14.2 4.2h5.6v5.6"/><path d="M19.8 4.2L11 13"/>' +
      '<path d="M18 14.4v4.2a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V7.8A1.8 1.8 0 0 1 5.4 6h4.2"/>',
    'descargar':
      '<path d="M12 3.4v11.4"/><path d="M7.4 10.2L12 14.8l4.6-4.6"/>' +
      '<path d="M4 18.2v.8a1.8 1.8 0 0 0 1.8 1.8h12.4A1.8 1.8 0 0 0 20 19v-.8"/>',
    'imprimir':
      '<path d="M7 9.2V3.8h10v5.4"/>' +
      '<path d="M5.4 9.2h13.2a2 2 0 0 1 2 2v4.4a1.4 1.4 0 0 1-1.4 1.4H17"/>' +
      '<path d="M7 17H4.8a1.4 1.4 0 0 1-1.4-1.4v-4.4a2 2 0 0 1 2-2"/>' +
      '<rect x="7" y="14" width="10" height="6.2" rx="1"/>',
    'recargar':
      '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.8 4.4v5h-5"/>',
    'basura':
      '<path d="M4.4 7.2h15.2"/><path d="M9.6 7.2V5.4a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v1.8"/>' +
      '<path d="M6.4 7.2l.9 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-12"/>' +
      '<path d="M10.4 11v6M13.6 11v6"/>',
    'copiar':
      '<rect x="8.4" y="8.4" width="11.4" height="11.4" rx="2"/>' +
      '<path d="M15.6 8.4V6.2a2 2 0 0 0-2-2H6.2a2 2 0 0 0-2 2v7.4a2 2 0 0 0 2 2h2.2"/>',

    /* ---------- Insights y voz ---------- */
    'robot':
      '<rect x="4" y="8" width="16" height="11" rx="3.4"/>' +
      '<path d="M12 8V4.6"/><circle cx="12" cy="3.3" r="1.3"/>' +
      '<path d="M1.9 12.5v3M22.1 12.5v3"/>' +
      '<circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none"/>' +
      '<path d="M9.6 16.3h4.8"/>',
    'altavoz':
      '<path d="M4.8 9.4h3.2l4.2-3.2v11.6l-4.2-3.2H4.8z"/>' +
      '<path d="M16.2 9.1a4.2 4.2 0 0 1 0 5.8"/><path d="M18.8 6.6a7.8 7.8 0 0 1 0 10.8"/>',
    'parar': '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.2"/>',
    'pausa': '<path d="M9.4 5.6v12.8M14.6 5.6v12.8"/>',
    'whatsapp':
      '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.6z"/>' +
      '<path d="M8.9 8.6c.5-.1.8.1 1 .5l.6 1.2c.1.3 0 .5-.2.7l-.4.4c.5 1 1.3 1.8 2.3 2.3l.4-.4c.2-.2.4-.3.7-.2l1.2.6c.4.2.6.5.5 1-.1.7-.8 1.2-1.6 1.1-2.7-.3-4.9-2.5-5.2-5.2-.1-.8.4-1.5 1.1-1.6"/>',

    /* ---------- avisos y estados ---------- */
    'campana':
      '<path d="M17.8 15.4V10a5.8 5.8 0 0 0-11.6 0v5.4L4.6 17.6h14.8z"/>' +
      '<path d="M9.8 20.2a2.4 2.4 0 0 0 4.4 0"/>',
    'aviso':
      '<path d="M12 4.2l8.6 15H3.4z"/><path d="M12 9.6v4.4"/>' +
      '<circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none"/>',
    'prohibido': '<circle cx="12" cy="12" r="8.6"/><path d="M6 6l12 12"/>',
    'reloj': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.4 2"/>',
    'sin-red':
      '<path d="M3 3l18 18"/><path d="M2.6 9.2a14 14 0 0 1 5-3.2"/>' +
      '<path d="M11.2 5.2a14 14 0 0 1 10.2 4"/><path d="M6.2 12.6a9.4 9.4 0 0 1 2.6-1.6"/>' +
      '<path d="M15.4 11.4a9.4 9.4 0 0 1 2.4 1.2"/>' +
      '<circle cx="12" cy="18.4" r="1.2" fill="currentColor" stroke="none"/>',
    'herramienta':
      '<path d="M14.2 6.6a3.8 3.8 0 0 1 5.2 5.2l-1.4-1.4-2.4 2.4-2.4-2.4 2.4-2.4z"/>' +
      '<path d="M13.2 10.8L5 19a1.9 1.9 0 0 0 2.7 2.7l8.2-8.2"/>',
    'brujula':
      '<circle cx="12" cy="12" r="8.6"/><path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z"/>',
    'nube':
      '<path d="M17.4 18.4H7.2A3.8 3.8 0 0 1 6.8 11a5.6 5.6 0 0 1 10.8-1.2 3.9 3.9 0 0 1-.2 8.6z"/>',
    'sobre':
      '<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.2"/>' +
      '<path d="M3.8 7l8.2 6 8.2-6"/>',
    'telefono':
      '<rect x="6.6" y="2.6" width="10.8" height="18.8" rx="2.4"/>' +
      '<path d="M10.6 5.4h2.8"/>' +
      '<circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
    'compartir-ios':
      '<path d="M12 3.6v11"/><path d="M8.4 7.2L12 3.6l3.6 3.6"/>' +
      '<path d="M6 11.6H5.2A1.8 1.8 0 0 0 3.4 13.4v5.4A1.8 1.8 0 0 0 5.2 20.6h13.6a1.8 1.8 0 0 0 1.8-1.8v-5.4a1.8 1.8 0 0 0-1.8-1.8H18"/>',

    /* ---------- 4.8 · institucional, trámites y tutoriales ---------- */
    'ubicacion':
      '<path d="M12 21s-6.4-5.6-6.4-10.6a6.4 6.4 0 0 1 12.8 0C18.4 15.4 12 21 12 21z"/>' +
      '<circle cx="12" cy="10.4" r="2.4"/>',
    'llamar':
      '<path d="M5.2 3.8h3.2l1.6 4-2 1.3a10.4 10.4 0 0 0 5 5l1.3-2 4 1.6v3.2a1.8 1.8 0 0 1-1.9 1.8A15.8 15.8 0 0 1 3.4 5.7a1.8 1.8 0 0 1 1.8-1.9z"/>',
    'corazon':
      '<path d="M12 20.2s-7.6-4.6-8.8-9.6A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 8.8 3.4C19.6 15.6 12 20.2 12 20.2z"/>',
    'play': '<path d="M8.4 5.6v12.8L18.6 12z"/>',
    'globo':
      '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/>' +
      '<path d="M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z"/>',
    'comentario':
      '<path d="M4.2 5.6h15.6a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H10l-4.6 3.4v-3.4H4.2a1.6 1.6 0 0 1-1.6-1.6V7.2a1.6 1.6 0 0 1 1.6-1.6z"/>',
    'megafono':
      '<path d="M3.6 10.2v3.6a1.2 1.2 0 0 0 1.2 1.2h2.4l8.4 4.2V4.8L7.2 9H4.8a1.2 1.2 0 0 0-1.2 1.2z"/>' +
      '<path d="M7.2 15l1.2 4.6"/><path d="M19 9.6a3.4 3.4 0 0 1 0 4.8"/>',
    'moneda':
      '<circle cx="12" cy="12" r="8.6"/>' +
      '<path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2.1 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.1 0-2.1-.5-2.6-1.4"/>' +
      '<path d="M12 6.2v1.6M12 16.2v1.6"/>',
    'enviar': '<path d="M20.6 3.4L10.4 13.6"/><path d="M20.6 3.4l-6.4 17.2-3.8-7-7-3.8z"/>',
    'lapiz':
      '<path d="M4 20l1-4.4L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.4 19z"/><path d="M13.6 7l3.4 3.4"/>',
    'responder': '<path d="M9.6 6.4L4 12l5.6 5.6"/><path d="M4.4 12h9.8a5.8 5.8 0 0 1 5.8 5.8"/>',

    /* ---------- el cohete del guardado ---------- */
    'cohete':
      '<path d="M12 2.8c2.7 2 4.2 5.1 4.2 8.6 0 2.2-.6 4.2-1.7 6H9.5a12.4 12.4 0 0 1-1.7-6c0-3.5 1.5-6.6 4.2-8.6z"/>' +
      '<circle cx="12" cy="10" r="2.1"/>' +
      '<path d="M7.8 13.2L5.2 16v2.6l2.9-1.4"/><path d="M16.2 13.2L18.8 16v2.6l-2.9-1.4"/>' +
      '<path d="M10.4 19.6c.5 1.1 1.1 1.9 1.6 2.4.5-.5 1.1-1.3 1.6-2.4"/>',

    /* ---------- 4.9: foto de perfil e insights ---------- */
    'camara':
      '<path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2.2l1.5-2.2h5.6l1.5 2.2h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>' +
      '<circle cx="12" cy="13" r="3.6"/>',
    'girar':
      '<path d="M20 11.5A8 8 0 1 1 17.6 6"/><path d="M20 3.5v5h-5"/>',
    'persona':
      '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.2c.9-3.7 3.9-5.9 7.5-5.9s6.6 2.2 7.5 5.9"/>',
    'info':
      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.2"/>',
    'bombilla':
      '<path d="M9 18h6"/><path d="M10 21h4"/>' +
      '<path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    'arrastrar':
      '<path d="M12 3v18"/><path d="M3 12h18"/><path d="M9 6l3-3 3 3"/><path d="M9 18l3 3 3-3"/>' +
      '<path d="M6 9l-3 3 3 3"/><path d="M18 9l3 3-3 3"/>',

    /* ---------- 10.4: soporte profesional ---------- */
    /* la estrella se rellena desde el CSS (.kit-est__b--on) para que la
       misma figura sirva vacia y llena */
    'estrella':
      '<path d="M12 3.3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.7l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    'salvavidas':
      '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.6"/>' +
      '<path d="M5.9 5.9l3.6 3.6M14.5 14.5l3.6 3.6M18.1 5.9l-3.6 3.6M9.5 14.5l-3.6 3.6"/>',

    /* ---------- 10.5: cuentas atrasadas ---------- */
    /* el de compartir de Android / Windows: tres nodos unidos */
    'compartir':
      '<circle cx="17.6" cy="5.8" r="2.6"/><circle cx="6.4" cy="12" r="2.6"/><circle cx="17.6" cy="18.2" r="2.6"/>' +
      '<path d="M8.7 10.7l6.6-3.6M8.7 13.3l6.6 3.6"/>',
    /* calendario con un signo de alerta: el plazo ya se venció */
    'vencido':
      '<rect x="3.4" y="4.8" width="17.2" height="15.8" rx="2.4"/><path d="M3.4 9.6h17.2M8 3v3.4M16 3v3.4"/>' +
      '<path d="M12 12.4v3.6"/><circle cx="12" cy="18.1" r=".9" fill="currentColor" stroke="none"/>',

    /* ---------- 10.6: tableros de ADMIN ---------- */
    /* barras sobre un eje: el tablero general del ecosistema */
    'grafica':
      '<path d="M3.5 3.5v17h17"/><rect x="7" y="12" width="3" height="5.5" rx=".6"/>' +
      '<rect x="12" y="8" width="3" height="9.5" rx=".6"/><rect x="17" y="5" width="3" height="12.5" rx=".6"/>',
    /* velocimetro: cuanto se demora cada area en revisar */
    'velocimetro':
      '<path d="M4.2 17.5a9 9 0 1 1 15.6 0"/><path d="M12 13.6l4.2-4.6"/><circle cx="12" cy="14.4" r="1.4"/>' +
      '<path d="M6.6 11.2l1.2.7M12 6.5v1.4M17.4 11.2l-1.2.7"/>'
  };

  function svg(nombre, tam) {
    var trazo = TRAZOS[nombre];
    if (!trazo) return '';
    var t = tam || TAMANO;
    return '<svg class="kit-ico kit-ico--' + nombre + '" viewBox="0 0 24 24"' +
           ' width="' + t + '" height="' + t + '" fill="none" stroke="currentColor"' +
           ' stroke-width="' + GROSOR + '" stroke-linecap="round" stroke-linejoin="round"' +
           ' aria-hidden="true" focusable="false">' + trazo + '</svg>';
  }

  function nodo(nombre, tam) {
    var caja = document.createElement('span');
    caja.className = 'kit-ico-caja';
    caja.innerHTML = svg(nombre, tam);
    return caja.firstChild;
  }

  K.piezas.iconos = {
    svg: svg,
    nodo: nodo,
    hay: function (nombre) { return !!TRAZOS[nombre]; },
    nombres: function () { return Object.keys(TRAZOS); },
    grosor: function () { return GROSOR; }
  };

  /* Atajo, porque se escribe en casi todas las vistas. */
  K.icono = svg;
}(window));
