/* ============================================================
   KIT-FLANDES · VISTA INSTALAR
   La lógica que pidió el plan: "en las apps antiguas a veces no aparece
   el botón instalar según el navegador. Revisar la de JHONNY-PERDOMO".

   El problema real
     El botón de instalar solo se puede mostrar cuando el navegador avisa
     con 'beforeinstallprompt'. Chrome en Android lo manda; Safari en
     iPhone NO lo manda nunca y hay que enseñarle al usuario el camino de
     Compartir → Añadir a inicio. Y si la app YA está instalada, no debe
     salir nada. Las apps viejas trataban los tres casos igual y por eso
     "a veces no aparece".

   Los cuatro casos que se tratan aquí
     1. YA INSTALADA        → no se ofrece nada
     2. CHROME/EDGE/ANDROID → botón de verdad, con el aviso del navegador
     3. iPHONE / iPAD       → instrucciones con el icono de Compartir
     4. NAVEGADOR QUE NO    → se dice con franqueza y se ofrece el enlace

   Cómo se usa

     KIT.piezas.instalar.vigilar();            // al arrancar la app
     KIT.piezas.instalar.abrir();              // desde un botón "Instalar"
     KIT.piezas.instalar.sePuede()             // ¿tiene sentido ofrecerlo?
     KIT.piezas.instalar.instalada()           // ¿ya está?

   Pareja: kit/instalar.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/instalar] falta kit.js'); } catch (e) {} return; }

  var aviso = null;          /* el evento del navegador, si llegó */
  var vigilando = false;

  function instalada() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;   /* iOS */
      if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
    } catch (e) {}
    return false;
  }

  function esIOS() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    /* iPad con iPadOS 13+ se hace pasar por Mac: se delata por el táctil */
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  }
  function esSafari() {
    var ua = navigator.userAgent || '';
    return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPR/.test(ua);
  }
  function caso() {
    if (instalada()) return 'instalada';
    if (aviso) return 'listo';
    if (esIOS()) return 'ios';
    return 'no';
  }
  function sePuede() { var c = caso(); return c === 'listo' || c === 'ios'; }

  function vigilar() {
    if (vigilando) return;
    vigilando = true;

    window.addEventListener('beforeinstallprompt', function (e) {
      /* hay que quedárselo: si se deja pasar, el navegador no vuelve a
         ofrecerlo en toda la sesión y el botón no aparece más */
      e.preventDefault();
      aviso = e;
      K.disparar('kit:instalar', { sePuede: true, caso: 'listo' });
    });

    window.addEventListener('appinstalled', function () {
      aviso = null;
      K.guardar.escribir('instalar.hecho', true);
      K.aviso('La aplicación quedó instalada.', 'ok', 4000);
      K.disparar('kit:instalar', { sePuede: false, caso: 'instalada' });
    });
  }

  /* ── la hoja ── */

  function abrir() {
    var c = caso();

    if (c === 'instalada') {
      K.aviso('Ya tienes la aplicación instalada.', 'ok');
      return Promise.resolve('instalada');
    }

    if (c === 'listo') return instalarDeVerdad();

    return new Promise(function (res) {
      var hoja = K.nodo(
        '<div class="kit-capa kit-inst kit-capa--on" role="dialog" aria-modal="true">' +
        '  <div class="kit-capa__velo"></div>' +
        '  <section class="kit-capa__hoja kit-inst__hoja">' +
        '    <header class="kit-capa__h">Instalar la aplicación<button type="button" class="kit-capa__x">✕</button></header>' +
        '    <div class="kit-capa__cuerpo kit-inst__cuerpo"></div>' +
        '  </section>' +
        '</div>'
      );
      document.body.appendChild(hoja);

      var cuerpo = hoja.querySelector('.kit-inst__cuerpo');
      if (c === 'ios') cuerpo.innerHTML = pasosIOS();
      else cuerpo.innerHTML = pasosOtro();

      function fuera() { hoja.remove(); res(c); }
      hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
      hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);

      var copiar = cuerpo.querySelector('.kit-inst__copiar');
      if (copiar) {
        copiar.addEventListener('click', function () {
          var url = location.href.split('#')[0];
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () { K.aviso('Enlace copiado.', 'ok'); });
          } else {
            var t = document.createElement('textarea');
            t.value = url;
            document.body.appendChild(t);
            t.select();
            try { document.execCommand('copy'); K.aviso('Enlace copiado.', 'ok'); } catch (e) {}
            t.remove();
          }
        });
      }
    });
  }

  function instalarDeVerdad() {
    var e = aviso;
    aviso = null;                     /* solo sirve una vez */
    e.prompt();
    return e.userChoice.then(function (r) {
      if (r && r.outcome === 'accepted') {
        K.sonar('sound/pay_success.mp3');
        return 'instalada';
      }
      /* si dijo que no, se guarda el evento otra vez por si cambia de idea */
      aviso = e;
      return 'rechazada';
    });
  }

  function pasosIOS() {
    return '' +
      '<p class="kit-inst__p">En iPhone y iPad la instalación la hace Safari, no la aplicación. ' +
      'Son tres toques:</p>' +
      '<ol class="kit-inst__pasos">' +
      '  <li><b>Toca el icono de Compartir</b> <span class="kit-inst__ico">⬆️</span> abajo en la barra de Safari.</li>' +
      '  <li>Baja en la lista y elige <b>Añadir a pantalla de inicio</b>.</li>' +
      '  <li>Toca <b>Añadir</b> arriba a la derecha.</li>' +
      '</ol>' +
      (esSafari() ? '' :
        '<p class="kit-inst__ojo"><b>Ojo:</b> esto solo funciona en <b>Safari</b>. ' +
        'Si estás en Chrome o en el navegador de WhatsApp, copia el enlace y ábrelo en Safari.</p>') +
      '<video class="kit-inst__video" autoplay muted loop playsinline ' +
      'poster="' + K.esc(K.medio('img/instalacion_ios-poster.webp')) + '">' +
      '  <source src="' + K.esc(K.medio('vid/instalacion_ios.mp4')) + '" type="video/mp4">' +
      '</video>' +
      '<button type="button" class="kit-btn kit-inst__copiar">Copiar el enlace</button>';
  }

  function pasosOtro() {
    return '' +
      '<p class="kit-inst__p">Este navegador no ofrece instalar la aplicación. ' +
      'No es un fallo tuyo ni de la aplicación: solo algunos navegadores lo permiten.</p>' +
      '<p class="kit-inst__p"><b>Qué hacer:</b> abre este mismo enlace en <b>Chrome</b> (Android o computador) ' +
      'o en <b>Safari</b> (iPhone y iPad) y vuelve a tocar Instalar.</p>' +
      '<p class="kit-inst__ojo">Si abriste el enlace desde WhatsApp o Facebook, estás en el navegador interno ' +
      'de esa aplicación, que nunca deja instalar. Ábrelo en tu navegador normal.</p>' +
      '<video class="kit-inst__video" autoplay muted loop playsinline ' +
      'poster="' + K.esc(K.medio('img/instalacion-poster.webp')) + '">' +
      '  <source src="' + K.esc(K.medio('vid/instalacion.mp4')) + '" type="video/mp4">' +
      '</video>' +
      '<button type="button" class="kit-btn kit-inst__copiar">Copiar el enlace</button>';
  }

  /**
   * Pinta un botón donde se le diga y lo esconde cuando no tiene sentido.
   * Así la app no tiene que preguntar por los casos.
   */
  function boton(destino, texto) {
    var caja = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!caja) return null;
    var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca kit-inst__b">' +
      K.esc(texto || 'Instalar la aplicación') + '</button>');
    b.addEventListener('click', function () { abrir(); });
    caja.appendChild(b);

    function revisar() { b.classList.toggle('kit-oculto', !sePuede()); }
    revisar();
    K.cuando('kit:instalar', revisar);
    return b;
  }

  K.piezas.instalar = {
    vigilar: vigilar, abrir: abrir, boton: boton,
    sePuede: sePuede, instalada: instalada, caso: caso
  };
}());
