/* ============================================================
   KIT-FLANDES · PIEZA 4 · AVISO DE GUARDADO (COHETE)
   El de SEP-AGENDA, con cohete en vez de avión, como pide el plan.

   Por qué es distinto del esqueleto
     El esqueleto dice "estoy trayendo datos". Este dice "estoy GUARDANDO
     lo tuyo, no cierres". Son dos esperas distintas y el usuario tiene que
     notarlo: esta sí tapa la pantalla, y a propósito.

   Cómo se usa

     KIT.piezas.guardado.mientras(
       KIT.pedir('cuentaGuardar', datos),
       {
         titulo: 'Estamos radicando tu cuenta',
         sub:    'No cierres esta ventana hasta que termine.',
         pasos:  ['Revisando los documentos…', 'Subiendo a Drive…', 'Avisando al supervisor…'],
         listo:  { titulo: 'Cuenta radicada', paso: 'Radicada correctamente' }
       }
     ).then(...)

     // o a mano:
     KIT.piezas.guardado.abrir({...});  ...  KIT.piezas.guardado.listo({...});

   Detalles heredados de SEP-AGENDA que se respetan
     · La barra avanza sola pero NUNCA pasa del 92 % hasta que el servidor
       responde: no promete un final que no controla.
     · Mientras está abierto, salir de la página pide confirmación.
     · Al terminar bien, la misma ventana se pone verde y se queda casi
       dos segundos: el usuario ve el final, no un parpadeo.

   Pareja: kit/guardado.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/guardado] falta kit.js'); } catch (e) {} return; }

  var PASOS = ['Preparando…', 'Enviando al servidor…', 'Guardando…', 'Casi listo…'];

  var capa = null;
  var reloj = null;
  var pct = 0;
  var pasos = PASOS;
  var guardia = null;
  var mensajeSalida = 'Se está guardando. Si sales ahora, puede quedar a medias.';

  function noSalir(ev) {
    ev.preventDefault();
    ev.returnValue = mensajeSalida;
    return ev.returnValue;
  }

  function crear() {
    capa = K.nodo(
      '<div class="kit-guard" role="alertdialog" aria-live="assertive" aria-modal="true">' +
      '  <div class="kit-guard__caja">' +
      '    <div class="kit-guard__cielo">' +
      /* La nave lleva el VIAJE (se desplaza por el cielo) y el cohete de
         dentro solo la inclinación: separarlos es lo que deja combinar las
         dos cosas sin que una pise a la otra en el transform. */
      '      <span class="kit-guard__nave">' +
      '        <span class="kit-guard__cohete">' + K.icono('cohete', 34) + '</span>' +
      '      </span>' +
      '      <i class="kit-guard__estela e1"></i>' +
      '      <i class="kit-guard__estela e2"></i>' +
      '      <i class="kit-guard__estela e3"></i>' +
      '      <span class="kit-guard__ok">' + K.icono('check', 46) + '</span>' +
      '    </div>' +
      '    <div class="kit-guard__t"></div>' +
      '    <div class="kit-guard__p"></div>' +
      '    <div class="kit-guard__pista"><i class="kit-guard__bar"></i></div>' +
      '    <div class="kit-guard__paso"></div>' +
      '  </div>' +
      '</div>'
    );
    document.body.appendChild(capa);
  }

  function q(clase) { return capa ? capa.querySelector('.kit-guard__' + clase) : null; }

  function abrir(op) {
    op = op || {};
    if (!capa) crear();
    capa.classList.remove('kit-guard--listo');
    capa.classList.add('kit-guard--on');

    pasos = (op.pasos && op.pasos.length) ? op.pasos : PASOS;
    mensajeSalida = op.salir || mensajeSalida;

    q('t').textContent = op.titulo || 'Guardando';
    /* el subtítulo admite <b> porque el texto suele llevar un énfasis */
    q('p').innerHTML = op.sub || 'No cierres esta ventana hasta que termine.';
    q('paso').textContent = pasos[0];
    q('bar').style.width = '0%';

    pct = 0;
    var i = 0;
    if (reloj) clearInterval(reloj);
    /* La curva está calibrada para lo que de verdad tarda Apps Script: entre
       dos y ocho segundos. Con un divisor más alto la barra se queda por el
       40 % cuando la operación ya terminó, y el usuario siente que va lenta.
       El suelo de 0,6 mantiene el movimiento en las esperas largas — por eso
       hace falta el tope de abajo, o se pasaría del 100 %. */
    reloj = setInterval(function () {
      pct += Math.max(0.6, (92 - pct) / 9);
      if (pct > 92) pct = 92;
      q('bar').style.width = pct.toFixed(1) + '%';
      var quiero = Math.min(pasos.length - 1, Math.floor(pct / (92 / pasos.length)));
      if (quiero !== i) { i = quiero; q('paso').textContent = pasos[i]; }
    }, 260);

    if (!guardia) {
      guardia = noSalir;
      window.addEventListener('beforeunload', guardia);
    }
  }

  function parar() {
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (guardia) { window.removeEventListener('beforeunload', guardia); guardia = null; }
  }

  function cerrar() {
    parar();
    if (!capa) return;
    capa.classList.remove('kit-guard--on');
    capa.classList.remove('kit-guard--listo');
  }

  /** Final feliz: verde, 100 % y una pausa para que se vea. */
  function listo(op) {
    op = op || {};
    return new Promise(function (res) {
      parar();
      if (!capa || !capa.classList.contains('kit-guard--on')) { cerrar(); return res(); }
      capa.classList.add('kit-guard--listo');
      q('bar').style.width = '100%';
      q('t').textContent = op.titulo || '¡Listo!';
      q('p').innerHTML = op.sub || 'Ya quedó guardado.';
      q('paso').textContent = op.paso || 'Guardado correctamente';
      K.sonar('sound/pay_success.mp3');
      K.vibrar(14);
      setTimeout(function () { cerrar(); res(); }, op.espera || 1700);
    });
  }

  /** Final triste: se cierra sin fiesta y deja que la app muestre el error. */
  function fallo() {
    parar();
    K.sonar('sound/pay_fail.mp3');
    K.vibrar([12, 60, 12]);
    cerrar();
  }

  /**
   * mientras(promesa, opciones) → la misma promesa.
   * Abre, espera, y cierra bien o mal según cómo acabe.
   */
  function mientras(promesa, opciones) {
    opciones = opciones || {};
    abrir(opciones);
    return Promise.resolve(promesa).then(
      function (v) { return listo(opciones.listo || {}).then(function () { return v; }); },
      function (e) { fallo(); throw e; }
    );
  }

  K.piezas.guardado = {
    abrir: abrir, listo: listo, fallo: fallo, cerrar: cerrar, mientras: mientras,
    abierto: function () { return !!(capa && capa.classList.contains('kit-guard--on')); }
  };
}());
