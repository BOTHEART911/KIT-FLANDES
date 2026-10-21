/* ============================================================
   KIT-FLANDES · PIEZA 14 · "ES TU INTERNET, NO LA APP"
   Aviso de conexión y atajos cuando alguien toma la opción equivocada.

   Por qué lo pidió el plan
     Cuando la app no responde, el contratista llama a la Alcaldía a decir
     que "el sistema está caído". Casi siempre es su conexión. Este aviso
     lo dice con todas las letras, sin echarle la culpa a nadie, y ofrece
     reintentar cuando vuelva la señal.

   Dos cosas en una pieza

     1) Vigilancia de la conexión
        KIT.piezas.conexion.vigilar();
        Pinta una barra cuando se cae la red y la quita cuando vuelve.
        Dispara 'kit:conexion' por si la app quiere refrescar al volver.

     2) Atajos de rescate
        KIT.piezas.conexion.rescate({
          titulo: 'No encontramos la cuenta',
          texto: 'Puede que la hayas radicado con otro contrato.',
          atajos: [
            { texto: 'Ver mis contratos', al: verContratos },
            { texto: 'Escribir a soporte', al: function(){ KIT.piezas.soporte.abrir(); } }
          ]
        });
        Se usa cuando el usuario llega a un callejón: en vez de un error
        seco, se le dan las dos o tres salidas reales.

   Un detalle que importa
     navigator.onLine miente: dice que hay red cuando hay wifi sin salida
     a internet. Por eso, además del evento, se comprueba de verdad
     tocando el CORE antes de cantar victoria.

   Pareja: kit/conexion.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/conexion] falta kit.js'); } catch (e) {} return; }

  var barra = null;
  var vigilando = false;
  var cayo = false;
  var reintento = null;
  var sondeo = null, pausa = 4000;
  var lentos = 0;
  var generacion = 0;

  function pintarBarra() {
    if (barra) return barra;
    barra = K.nodo(
      '<div class="kit-conex" role="alert" aria-live="assertive">' +
      '  <span class="kit-conex__punto"></span>' +
      '  <span class="kit-conex__txt">Sin conexión. <b>Es tu internet, no la app.</b></span>' +
      '  <button type="button" class="kit-conex__b">Reintentar</button>' +
      '</div>'
    );
    barra.querySelector('.kit-conex__b').addEventListener('click', function () { comprobar(true); });
    (document.body || document.documentElement).appendChild(barra);
    return barra;
  }

  /* 21/10 · el texto depende del caso: sin red (rojo) o red lenta (ámbar).
     Lo del servidor NUNCA sale aquí: eso no es culpa del internet y lo dice
     la vista con su propio mensaje. */
  function pintarTexto() {
    if (!barra) return;
    var txt = barra.querySelector('.kit-conex__txt');
    var lenta = !cayo && lentos > 0;
    barra.classList.toggle('kit-conex--lenta', lenta);
    txt.innerHTML = lenta
      ? 'Tu internet está lento. <b>Seguimos intentando…</b>'
      : 'Sin conexión. <b>Es tu internet, no la app.</b>';
    barra.querySelector('.kit-conex__b').hidden = lenta;
    barra.classList.toggle('kit-conex--on', cayo || lenta);
  }

  function mostrar(hay) {
    pintarBarra();
    document.documentElement.classList.toggle('kit-sin-red', !hay);
    if (hay && cayo) {
      cayo = false;
      pararSondeo();
      pintarTexto();
      K.aviso('Volvió la conexión.', 'ok');
      /* al disparar esto, kit.js vuelve a mandar lo que esperaba (mismo rid) */
      K.disparar('kit:conexion', { hay: true });
      return;
    } else if (!hay && !cayo) {
      cayo = true;
      K.disparar('kit:conexion', { hay: false });
      arrancarSondeo();
    }
    pintarTexto();
  }

  /* Mientras no hay red se mira solo cada 4 s (luego más espaciado, hasta
     15 s): el 'online' del navegador no llega cuando hay wifi sin internet. */
  function arrancarSondeo() {
    pararSondeo(); pausa = 4000;
    (function vuelta() {
      sondeo = setTimeout(function () {
        if (!cayo) return;
        comprobar(false).then(function () { if (cayo) { pausa = Math.min(15000, Math.round(pausa * 1.5)); vuelta(); } });
      }, pausa);
    }());
  }
  function pararSondeo() { if (sondeo) clearTimeout(sondeo); sondeo = null; }

  /**
   * Comprueba de verdad. navigator.onLine solo sabe si hay cable o wifi,
   * no si hay internet: en la Alcaldía eso pasa a diario. 21/10 · se
   * pregunta a gstatic (K.sondear), no al CORE: si el CORE falla, eso no es
   * falta de internet y no debe pintar el banner.
   */
  function comprobar(aMano) {
    var b = barra && barra.querySelector('.kit-conex__b');
    if (aMano && b) { b.disabled = true; b.textContent = 'Comprobando…'; }
    var p = (typeof K.sondear === 'function') ? K.sondear(5000) : Promise.resolve({ red: navigator.onLine !== false });
    var mia = ++generacion;
    return p.then(function (s) {
      if (aMano && b) { b.disabled = false; b.textContent = 'Reintentar'; }
      /* 21/10 · una sonda que salió SIN red y contesta cuando ya volvió no
         puede volver a pintar el banner: solo cuenta la última que salió */
      if (mia !== generacion) return !cayo;
      mostrar(!!s.red);
      if (!s.red && aMano) K.aviso('Sigue sin haber conexión.', 'malo');
      return !!s.red;
    });
  }

  function vigilar() {
    if (vigilando) return;
    vigilando = true;
    pintarBarra();

    window.addEventListener('offline', function () { mostrar(false); });
    window.addEventListener('online', function () {
      generacion++;   /* lo que se preguntó sin red ya no vale */
      /* el evento 'online' se adelanta: se espera un poco y se comprueba */
      if (reintento) clearTimeout(reintento);
      reintento = setTimeout(function () { comprobar(false); }, 900);
    });
    /* kit.js avisa en cuanto un viaje falla por falta de red */
    K.cuando('kit:sinRed', function () { mostrar(false); });
    /* un viaje al CORE que llegó completo es la mejor prueba de que hay red */
    K.cuando('kit:redOk', function () { if (cayo) { generacion++; mostrar(true); } });
    K.cuando('kit:redLenta', function (d) { lentos = d.lentos || 0; pintarTexto(); });

    /* al volver a la pestaña, por si se durmió el teléfono */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && cayo) comprobar(false);
    });

    if (navigator.onLine === false) mostrar(false);
  }

  /* 21/10 · se vigila sola al cargar: antes ninguna de las 7 apps llamaba a
     vigilar() y el banner nunca salía (SEC-HACIENDA sí la llama). */
  if (document.body) vigilar(); else document.addEventListener('DOMContentLoaded', vigilar);

  /* ══════════════ ATAJOS DE RESCATE ══════════════ */

  function rescate(o) {
    o = o || {};
    var capa = K.nodo(
      '<div class="kit-capa kit-resc" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-resc__hoja">' +
      '    <div class="kit-resc__icono">' + (o.icono || K.icono('brujula', 34)) + '</div>' +
      '    <h2 class="kit-resc__t">' + K.esc(o.titulo || 'Parece que esta no era la opción') + '</h2>' +
      '    <p class="kit-resc__p">' + K.esc(o.texto || '') + '</p>' +
      '    <div class="kit-resc__atajos"></div>' +
      '    <button type="button" class="kit-btn kit-btn--plano kit-resc__salir">Cerrar</button>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(capa);
    requestAnimationFrame(function () { capa.classList.add('kit-capa--on'); });

    function fuera() {
      capa.classList.remove('kit-capa--on');
      setTimeout(function () { if (capa.parentNode) capa.remove(); }, 220);
    }
    /* 25/09 · o.alCerrar: lo que pasa si la persona cierra sin escoger
       atajo (la sesión lo usa para reintentar en vez de dejar la pantalla
       vacía). */
    function cerrar() { fuera(); if (typeof o.alCerrar === 'function') o.alCerrar(); }

    var cajaAtajos = capa.querySelector('.kit-resc__atajos');
    (o.atajos || []).forEach(function (a) {
      var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca kit-resc__atajo">' + K.esc(a.texto) + '</button>');
      b.addEventListener('click', function () { fuera(); if (typeof a.al === 'function') a.al(); });
      cajaAtajos.appendChild(b);
    });

    capa.querySelector('.kit-resc__salir').addEventListener('click', cerrar);
    capa.querySelector('.kit-capa__velo').addEventListener('click', cerrar);
    return { cerrar: fuera };
  }

  /**
   * Traduce el código de error del CORE a algo que una persona entienda,
   * con las salidas que tiene a mano. Es el atajo más usado de la pieza.
   */
  function explicar(error, atajos, extra) {
    var c = (error && error.codigo) || 'ERROR';
    var mapa = {
      SIN_RED:            { icono: K.icono('sin-red', 34), titulo: 'No hay internet', texto: 'Es tu conexión, no la app. Revisa tus datos o el wifi; lo que escribiste no se perdió.' },
      RED_LENTA:          { icono: K.icono('sin-red', 34), titulo: 'Tu internet está lento', texto: 'Inténtalo de nuevo en un momento; lo que escribiste no se perdió.' },
      TIEMPO:             { icono: K.icono('reloj', 34), titulo: 'El servidor está tardando', texto: 'No es tu internet. Inténtalo otra vez en un momento.' },
      SERVIDOR:           { icono: K.icono('aviso', 34), titulo: 'El servidor no respondió', texto: 'No es tu internet. Inténtalo en un momento y, si sigue, avisa a soporte.' },
      RESPUESTA_NO_JSON:  { icono: K.icono('aviso', 34), titulo: 'La respuesta llegó incompleta', texto: 'Inténtalo de nuevo. Si el problema persiste, solicita soporte.' },
      SESION_VENCIDA:     { icono: K.icono('candado', 34), titulo: 'Tu sesión venció', texto: 'Por seguridad la sesión dura 12 horas. Vuelve a entrar.' },
      SIN_SESION:         { icono: K.icono('candado', 34), titulo: 'Necesitas entrar de nuevo', texto: 'Vuelve a iniciar sesión para continuar.' },
      SIN_PERMISO:        { icono: K.icono('prohibido', 34), titulo: 'Tu usuario no tiene permiso para esto', texto: 'Si crees que sí deberías tenerlo, pídeselo al administrador.' }
    };
    var d = mapa[c] || { icono: K.icono('aviso', 34), titulo: 'No se pudo completar', texto: (error && error.message) || 'Inténtalo de nuevo.' };
    d.atajos = atajos || [];
    if (extra && typeof extra.alCerrar === 'function') d.alCerrar = extra.alCerrar;
    return rescate(d);
  }

  K.piezas.conexion = {
    vigilar: vigilar, comprobar: comprobar, rescate: rescate, explicar: explicar,
    hay: function () { return !cayo; }
  };
}());
