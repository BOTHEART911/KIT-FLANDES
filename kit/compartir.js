/* ============================================================
   KIT-FLANDES · PIEZA 23 · COMPARTIR NATIVO
   Entrega 10.5 (cuentas atrasadas en SUPERVISIÓN)

   Abre el botón de COMPARTIR del propio dispositivo (el del celular o el
   de Windows / macOS / ChromeOS) con un texto ya armado. Quien comparte
   escoge el destino: un chat de WhatsApp, un grupo, un correo, Telegram…
   La app no usa ninguna API ni manda nada por su cuenta.

   Si el navegador no tiene ese botón (Firefox de escritorio, por ejemplo),
   el texto queda COPIADO y se avisa para pegarlo donde se quiera. Nunca
   se queda sin hacer nada.

   Cómo se usa

     KIT.piezas.compartir.texto({ titulo: 'Cuentas atrasadas', texto: t })
       .then(function (como) { ... });   // 'nativo' | 'copiado' | 'cancelado'

     KIT.piezas.compartir.hay()          // ¿tiene botón nativo este equipo?
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/compartir] falta kit.js'); } catch (e) {} return; }

  function hay() {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  /** Copia al portapapeles; si la API no está (http, navegador viejo), con un textarea. */
  function copiar(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return copiarViejo(t); });
    }
    return Promise.resolve(copiarViejo(t));
  }
  function copiarViejo(t) {
    var a = document.createElement('textarea');
    a.value = t;
    a.setAttribute('readonly', '');
    a.style.position = 'fixed'; a.style.top = '-1000px'; a.style.opacity = '0';
    document.body.appendChild(a);
    a.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(a);
    return ok;
  }

  function porCopia(t, o) {
    return copiar(t).then(function (ok) {
      if (ok) K.aviso(o.avisoCopia || 'Este equipo no tiene el botón de compartir: el texto quedó copiado. Pégalo en el chat o el correo que quieras.', 'info', 6000);
      else K.aviso('No se pudo compartir ni copiar el texto en este navegador.', 'malo', 6000);
      return ok ? 'copiado' : 'fallo';
    });
  }

  function texto(o) {
    o = o || {};
    var t = String(o.texto || '').trim();
    if (!t) return Promise.resolve('vacio');
    K.vibrar(8);
    if (!hay()) return porCopia(t, o);
    var datos = { text: t };
    if (o.titulo) datos.title = String(o.titulo);
    if (navigator.canShare && !navigator.canShare(datos)) return porCopia(t, o);
    return navigator.share(datos).then(function () { return 'nativo'; }, function (e) {
      /* la persona cerró el menú: no es un error */
      if (e && e.name === 'AbortError') return 'cancelado';
      return porCopia(t, o);
    });
  }

  K.piezas.compartir = { texto: texto, hay: hay, copiar: copiar };
}());
