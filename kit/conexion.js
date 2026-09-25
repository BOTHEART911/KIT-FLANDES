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

  function pintarBarra() {
    if (barra) return barra;
    barra = K.nodo(
      '<div class="kit-conex" role="alert">' +
      '  <span class="kit-conex__punto"></span>' +
      '  <span class="kit-conex__txt">Sin conexión. <b>Es tu internet, no la app.</b></span>' +
      '  <button type="button" class="kit-conex__b">Reintentar</button>' +
      '</div>'
    );
    barra.querySelector('.kit-conex__b').addEventListener('click', function () { comprobar(true); });
    document.body.appendChild(barra);
    return barra;
  }

  function mostrar(hay) {
    pintarBarra();
    barra.classList.toggle('kit-conex--on', !hay);
    document.documentElement.classList.toggle('kit-sin-red', !hay);
    if (hay && cayo) {
      cayo = false;
      K.aviso('Volvió la conexión.', 'ok');
      K.disparar('kit:conexion', { hay: true });
    } else if (!hay && !cayo) {
      cayo = true;
      K.disparar('kit:conexion', { hay: false });
    }
  }

  /**
   * Comprueba de verdad. navigator.onLine solo sabe si hay cable o wifi,
   * no si hay internet: en la Alcaldía eso pasa a diario.
   */
  function comprobar(aMano) {
    if (!navigator.onLine) { mostrar(false); return Promise.resolve(false); }
    /* app 'CORE': ping es ruta del CORE. Sin esto, la comprobación de red
       fallaba SIEMPRE y la app acusaba de caída una conexión que iba bien. */
    return K.pedir('ping', {}, { ms: 8000, sinToken: true, app: 'CORE' })
      .then(function () { mostrar(true); return true; })
      .catch(function (e) {
        /* si el servidor contesta un error de negocio, la red SÍ está */
        var hay = e && e.codigo && e.codigo !== 'SIN_RED' && e.codigo !== 'TIEMPO';
        mostrar(!!hay);
        if (!hay && aMano) K.aviso('Sigue sin haber conexión.', 'malo');
        return !!hay;
      });
  }

  function vigilar() {
    if (vigilando) return;
    vigilando = true;
    pintarBarra();

    window.addEventListener('offline', function () { mostrar(false); });
    window.addEventListener('online', function () {
      /* el evento 'online' se adelanta: se espera un poco y se comprueba */
      if (reintento) clearTimeout(reintento);
      reintento = setTimeout(function () { comprobar(false); }, 900);
    });

    /* al volver a la pestaña, por si se durmió el teléfono */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && cayo) comprobar(false);
    });

    if (!navigator.onLine) mostrar(false);
  }

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
      SIN_RED:            { icono: K.icono('sin-red', 34), titulo: 'No hay internet', texto: 'Revisa tus datos o el wifi y vuelve a intentarlo. Lo que escribiste no se perdió.' },
      TIEMPO:             { icono: K.icono('reloj', 34), titulo: 'El servidor tardó demasiado', texto: 'Suele ser la conexión. Inténtalo otra vez en un momento.' },
      RESPUESTA_NO_JSON:  { icono: K.icono('sin-red', 34), titulo: 'La conexión se interrumpió', texto: 'Quizás tu internet presenta intermitencias, inténtalo de nuevo. Si el problema persiste, solicita soporte.' },
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
