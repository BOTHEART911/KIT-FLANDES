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

  /*
   * 4.5 · POR QUÉ YA NO HAY beforeunload
   *
   * Hasta la 4.4, mientras esta capa estaba abierta se registraba un
   * beforeunload para que el navegador preguntara antes de salir. Eso es lo
   * que producía el cuadro que Oss fotografió:
   *
   *     botheart911.github.io dice
   *     Tienes cambios sin guardar. ¿Salir de todos modos?
   *
   * Ese cuadro NO se puede vestir: el navegador ignora el texto que se le
   * pase, pone el nombre del dominio y lo escribe en el idioma del sistema.
   * O sea: el único modo de que no salga es no pedirlo.
   *
   * Lo que lo sustituye, que además protege más:
   *   · Esta capa tapa la pantalla entera mientras se guarda, así que salir
   *     exige un gesto deliberado (cerrar la pestaña).
   *   · El guardado se manda de una sola vez; si se corta, no queda medio
   *     escrito: o entra o no entra.
   *   · Lo que la persona escribe se guarda solo en el propio aparato
   *     (ver kit/borrador local en borrador.js), así que cerrar a destiempo
   *     no le pierde el texto.
   */

  function crear() {
    /* 4.5 · el cielo se puebla.
       Oss dijo que el cohete estaba pobre. Lo que faltaba no era otro
       dibujo: era que pasara algo. Ahora el cohete atraviesa un cielo con
       estrellas que corren hacia atrás (eso es lo que da la sensación de
       velocidad), suelta fuego por debajo y deja tres estelas; al terminar,
       despega de verdad y el cielo se llena de confeti. Todo es CSS: ni una
       imagen más que cargar. */
    var estrellas = '';
    for (var e = 0; e < 14; e++) estrellas += '<i class="kit-guard__estrella s' + (e % 7) + '"></i>';
    var confeti = '';
    for (var c = 0; c < 12; c++) confeti += '<i class="kit-guard__papel c' + (c % 6) + '"></i>';

    capa = K.nodo(
      '<div class="kit-guard" role="alertdialog" aria-live="assertive" aria-modal="true">' +
      '  <div class="kit-guard__caja">' +
      '    <div class="kit-guard__cielo">' +
      '      <div class="kit-guard__estrellas" aria-hidden="true">' + estrellas + '</div>' +
      /* La nave lleva el VIAJE (se desplaza por el cielo) y el cohete de
         dentro solo la inclinación: separarlos es lo que deja combinar las
         dos cosas sin que una pise a la otra en el transform. */
      '      <span class="kit-guard__nave">' +
      '        <span class="kit-guard__cohete">' + K.icono('cohete', 34) +
      '          <i class="kit-guard__fuego" aria-hidden="true"></i>' +
      '        </span>' +
      '      </span>' +
      '      <i class="kit-guard__estela e1"></i>' +
      '      <i class="kit-guard__estela e2"></i>' +
      '      <i class="kit-guard__estela e3"></i>' +
      '      <span class="kit-guard__ok">' + K.icono('check', 46) + '</span>' +
      '      <div class="kit-guard__confeti" aria-hidden="true">' + confeti + '</div>' +
      '    </div>' +
      '    <div class="kit-guard__t"></div>' +
      '    <div class="kit-guard__p"></div>' +
      '    <div class="kit-guard__pista"><i class="kit-guard__bar"></i></div>' +
      '    <div class="kit-guard__paso"></div>' +
      '    <div class="kit-guard__puntos" aria-hidden="true"></div>' +
      '  </div>' +
      '</div>'
    );
    document.body.appendChild(capa);
  }

  /** Un punto por paso. Se van marcando: dice cuánto falta de verdad. */
  function pintarPuntos(cuantos, hecho) {
    var caja = q('puntos');
    if (!caja) return;
    if (caja.children.length !== cuantos) {
      var h = '';
      for (var i = 0; i < cuantos; i++) h += '<i></i>';
      caja.innerHTML = h;
    }
    for (var j = 0; j < caja.children.length; j++) {
      caja.children[j].classList.toggle('kit-guard__punto--ok', j < hecho);
      caja.children[j].classList.toggle('kit-guard__punto--ahora', j === hecho);
    }
  }

  function q(clase) { return capa ? capa.querySelector('.kit-guard__' + clase) : null; }

  function abrir(op) {
    op = op || {};
    if (!capa) crear();
    capa.classList.remove('kit-guard--listo');
    capa.classList.add('kit-guard--on');

    pasos = (op.pasos && op.pasos.length) ? op.pasos : PASOS;

    q('t').textContent = op.titulo || 'Guardando';
    /* el subtítulo admite <b> porque el texto suele llevar un énfasis */
    q('p').innerHTML = op.sub || 'No cierres esta ventana hasta que termine.';
    q('paso').textContent = pasos[0];
    q('bar').style.width = '0%';
    pintarPuntos(pasos.length, 0);

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
      if (quiero !== i) {
        i = quiero;
        /* el rótulo no cambia de golpe: se va y vuelve */
        var nodo = q('paso');
        nodo.classList.add('kit-guard__paso--cambia');
        setTimeout(function () {
          nodo.textContent = pasos[i];
          nodo.classList.remove('kit-guard__paso--cambia');
        }, 160);
        pintarPuntos(pasos.length, i);
      }
    }, 260);

    /*
     * 4.5 · NO SE REGISTRA beforeunload. Ver el comentario de arriba: ese
     * es el cuadro del sistema que sale con el nombre del dominio, y el
     * navegador no deja cambiarlo ni una coma. La capa ya tapa la pantalla
     * entera y dice "no cierres"; y lo que se está guardando se manda al
     * servidor de una vez, no en trozos, así que cerrar a mitad no deja
     * nada a medias en la hoja.
     */
  }

  function parar() {
    if (reloj) { clearInterval(reloj); reloj = null; }
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
      pintarPuntos(pasos.length, pasos.length);
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
