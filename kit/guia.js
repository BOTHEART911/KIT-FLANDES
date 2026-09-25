/* ============================================================
   KIT-FLANDES · PIEZA 27 · GUÍA RÁPIDA EN PDF
   Ajuste previo a la Fase 11 (25/09/2026)

   La opción "Descargar guía rápida" del menú superior derecho de cada
   app y de la web de Solicitud de Prensa.

   El PDF vive en la carpeta de Drive GUÍAS RÁPIDAS. Su id está en la
   llave pública GUIA_<APP> de CONFIG, que ya llega con la configuración
   del arranque: bajar la guía NO hace ningún viaje al CORE. Para cambiar
   la guía, en ADMIN → Configuración → Guías rápidas se pega el PDF
   nuevo; las apps no se vuelven a publicar.

   Cómo se usa

     KIT.piezas.guia.configurar(d.config);          // con el arranque
     menu.push(KIT.piezas.guia.opcion('CONTRATISTA'));
     KIT.piezas.guia.descargar('CONTRATISTA');      // a mano
     KIT.piezas.guia.url('CONTRATISTA');            // '' si no hay guía
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/guia] falta kit.js'); } catch (e) {} return; }

  var ids = {};
  var RE_ID = /^[A-Za-z0-9_-]{20,}$/;

  function limpio(v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    var m = /\/d\/([\w-]{20,})/.exec(s) || /[?&]id=([\w-]{20,})/.exec(s);
    s = m ? m[1] : s;
    return RE_ID.test(s) ? s : '';
  }

  /** Toma las llaves GUIA_* de la configuración pública. Se puede llamar varias veces. */
  function configurar(c) {
    if (!c) return;
    Object.keys(c).forEach(function (k) {
      if (/^GUIA_/.test(k)) ids[k.slice(5)] = limpio(c[k]);
    });
  }

  function url(app) {
    var id = ids[String(app || '').toUpperCase()] || '';
    return id ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id) : '';
  }

  var pedida = false;
  function descargar(app, tarde) {
    var u = url(app);
    /* si la app entró sin traer la configuración (sesión guardada), se pide
       una sola vez: la config pública ya viene cacheada por el CORE */
    if (!u && !pedida && K.pedir) {
      pedida = true;
      return K.pedir('config', {}, { sinToken: true, app: 'CORE' })
        .then(function (c) { configurar(c); return descargar(app, true); }, function () { return descargar(app, true); });
    }
    if (!u) {
      K.aviso('La guía rápida de esta app todavía no está publicada. Pídela a soporte.', 'aviso', 5000);
      return false;
    }
    /* un <a> con target en vez de location: en la app instalada no se
       pierde la vista en la que estaba la persona */
    /* después de una espera el navegador ya no deja abrir pestaña (no viene
       de un toque): el PDF se baja como adjunto y la app no se mueve */
    if (tarde) { location.href = u; K.aviso('Descargando la guía rápida…', 'info', 2500); return true; }
    var a = document.createElement('a');
    a.href = u; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    K.aviso('Descargando la guía rápida…', 'info', 2500);
    return true;
  }

  function opcion(app) {
    return { texto: 'Descargar guía rápida', al: function () { descargar(app); } };
  }

  K.piezas.guia = { configurar: configurar, url: url, descargar: descargar, opcion: opcion };
}());
