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

   Los ocho casos que se tratan aquí (4.1.3)
     1. YA INSTALADA          → no se ofrece nada
     2. AVISO DEL NAVEGADOR   → botón de verdad (Chrome/Edge, Android y PC)
     3. iPHONE/iPAD + SAFARI  → Compartir → Añadir a pantalla de inicio
     4. iPHONE/iPAD + OTRO    → solo Safari instala: copiar enlace y abrirlo allí
     5. MAC + SAFARI          → Archivo → Añadir al Dock
     6. NAVEGADOR EMBEBIDO    → WhatsApp/Instagram nunca instalan: abrir fuera
     7. FIREFOX DE ESCRITORIO → no instala; se dice y se ofrece Chrome o Edge
     8. CHROME/EDGE DE PC     → dónde está el icono de la barra de direcciones

   Nunca se llega a un callejón sin salida: haya o no botón del navegador,
   siempre se enseña el camino de ESTE aparato.

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

  /**
   * 4.5 · "que la app RECONOZCA la instalación".
   *
   * instalada() solo sabe si ESTA pestaña corre como aplicación. Si la
   * persona la instaló y después vuelve a entrar por el navegador, eso
   * devuelve false y se le seguía ofreciendo instalar algo que ya tiene.
   *
   * La huella la deja el propio navegador en 'appinstalled', que se guarda
   * en este aparato. Dos cosas que hay que tener claras:
   *   · Es por APARATO, no por persona: es exactamente lo que queremos.
   *   · Si desinstala la app, el navegador no avisa. Por eso el aviso de
   *     "búscala en el escritorio" lleva siempre una salida para volver a
   *     instalarla, y nunca es un callejón.
   */
  function yaSeInstalo() {
    if (instalada()) return true;
    try { return K.guardar.leer('instalar.hecho', false) === true; } catch (e) { return false; }
  }

  /** Si dice que la tiene y resulta que no, se borra la huella. */
  function olvidarInstalacion() {
    try { K.guardar.borrar('instalar.hecho'); } catch (e) {}
    K.disparar('kit:instalar', { sePuede: sePuede(), caso: caso() });
  }

  /**
   * Una línea corta con lo que toca hacer en ESTE aparato. La vista de
   * bienvenida la enseña debajo del botón para que la persona sepa qué va
   * a pasar ANTES de tocarlo (en iPhone no sale ningún cuadro del sistema,
   * y sin este aviso el botón parece roto).
   */
  function pista() {
    var c = caso();
    if (c === 'instalada') return 'Ya la tienes en el escritorio de tu dispositivo.';
    if (c === 'listo') return 'Tu navegador la instala de un toque.';
    if (c === 'ios-safari') return 'En iPhone y iPad: Compartir → Agregar a inicio. Te lo explicamos paso a paso.';
    if (c === 'ios-otro') return 'En iPhone solo Safari puede instalarla. Te decimos cómo.';
    if (c === 'mac-safari') return 'En Mac con Safari: Archivo → Añadir al Dock.';
    if (c === 'embebido') return 'Abriste el enlace dentro de otra aplicación. Te decimos cómo salir de ahí.';
    if (c === 'firefox') return 'Firefox de computador no instala aplicaciones web. Te damos la salida.';
    return 'Te mostramos dónde está el botón en tu navegador.';
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
  function esMac() {
    var ua = navigator.userAgent || '';
    return /Macintosh|Mac OS X/.test(ua) && !esIOS();
  }
  function esFirefox() {
    return /Firefox|FxiOS/.test(navigator.userAgent || '');
  }
  /* Navegador DENTRO de otra app (WhatsApp, Instagram, Facebook, Messenger).
     Ninguno instala nunca, y es el caso que más despista a la gente. */
  function esEmbebido() {
    var ua = navigator.userAgent || '';
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua)) return true;
    if (/WhatsApp/i.test(ua)) return true;
    if (/\bwv\b/.test(ua)) return true;                  /* WebView de Android */
    return false;
  }

  /**
   * Los casos REALES, no tres cajones. Cada uno tiene un camino distinto y
   * un texto distinto; meterlos en el mismo saco es lo que hacía que el
   * botón "a veces no apareciera".
   *
   *   instalada   · ya corre instalada, no hay nada que ofrecer
   *   listo       · el navegador mandó su aviso: botón de verdad
   *   ios-safari  · iPhone/iPad en Safari: Compartir → Añadir a inicio
   *   ios-otro    · iPhone/iPad en Chrome, Firefox o Edge: solo Safari instala
   *   mac-safari  · Mac con Safari: Archivo → Añadir al Dock
   *   embebido    · navegador dentro de WhatsApp/Instagram: no instala nunca
   *   firefox     · Firefox de escritorio: no instala aplicaciones web
   *   escritorio  · Chrome/Edge de computador que aún no ha mandado el aviso
   */
  function caso() {
    if (instalada()) return 'instalada';
    if (aviso) return 'listo';
    if (esEmbebido()) return 'embebido';
    if (esIOS()) return esSafari() ? 'ios-safari' : 'ios-otro';
    if (esMac() && esSafari()) return 'mac-safari';
    if (esFirefox()) return 'firefox';
    return 'escritorio';
  }

  /* Se ofrece SIEMPRE menos cuando ya está instalada: aunque el navegador no
     tenga botón, siempre hay un camino que enseñar. */
  function sePuede() { return caso() !== 'instalada'; }

  /** El texto que le cuadra al botón en este aparato. */
  function etiqueta() {
    var c = caso();
    if (c === 'instalada') return 'Ya está instalada';
    if (c === 'listo') return 'Instalar la aplicación';
    if (c === 'ios-safari' || c === 'ios-otro') return 'Añadir a mi pantalla';
    if (c === 'mac-safari') return 'Añadir al Dock';
    return 'Cómo instalarla';
  }

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

    /* 4.5: antes esto era un aviso de dos segundos y se iba. Si la persona
       toca "Instalar" es porque está buscando la aplicación, y un tostado
       que desaparece no le dice dónde está. Ahora se le enseña la misma
       hoja que a todos, con el camino hasta el icono. */
    if (c === 'instalada' || yaSeInstalo()) return hojaInstalada();

    if (c === 'listo') return instalarDeVerdad();

    return new Promise(function (res) {
      var hoja = K.nodo(
        '<div class="kit-capa kit-inst kit-capa--on" role="dialog" aria-modal="true">' +
        '  <div class="kit-capa__velo"></div>' +
        '  <section class="kit-capa__hoja kit-inst__hoja">' +
        '    <header class="kit-capa__h">Instalar la aplicación<button type="button" class="kit-capa__x">' + K.icono('cerrar', 18) + '</button></header>' +
        '    <div class="kit-capa__cuerpo kit-inst__cuerpo"></div>' +
        '  </section>' +
        '</div>'
      );
      document.body.appendChild(hoja);

      var cuerpo = hoja.querySelector('.kit-inst__cuerpo');
      cuerpo.innerHTML = pasosDe(c);

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

  /**
   * La hoja de "ya la tienes". No es un callejón: si resulta que la
   * desinstaló, el botón de abajo borra la huella y vuelve a ofrecer los
   * pasos de este aparato.
   */
  function hojaInstalada() {
    return new Promise(function (res) {
      var dentro = instalada();
      var hoja = K.nodo(
        '<div class="kit-capa kit-inst kit-capa--on" role="dialog" aria-modal="true">' +
        '  <div class="kit-capa__velo"></div>' +
        '  <section class="kit-capa__hoja kit-inst__hoja">' +
        '    <header class="kit-capa__h">La aplicación ya está instalada' +
        '      <button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
        '    </header>' +
        '    <div class="kit-capa__cuerpo kit-inst__cuerpo">' +
        '      <div class="kit-inst__listo" aria-hidden="true">' +
        '        <span class="kit-inst__listo-halo"></span>' +
        '        <span class="kit-inst__listo-ico">' + K.icono('check', 40) + '</span>' +
        '      </div>' +
        (dentro
          ? '<p class="kit-inst__p">Estás usando la aplicación instalada ahora mismo. No hay nada más que hacer.</p>'
          : '<p class="kit-inst__p"><b>Busca la app en el escritorio de tu dispositivo.</b> Ya la tienes ' +
            'con su icono, junto a las demás aplicaciones; desde ahí abre más rápido y recibe los avisos.</p>') +
        '      <ol class="kit-inst__pasos">' +
        '        <li>Sal de este navegador y mira la pantalla de inicio de tu teléfono.</li>' +
        '        <li>Busca el icono verde de <b>' + K.esc((window.MARCA && window.MARCA.TITULO) || 'la app') + '</b>.</li>' +
        '        <li>Ábrela desde ahí de ahora en adelante.</li>' +
        '      </ol>' +
        (dentro ? '' :
        '      <p class="kit-inst__ojo">¿No la encuentras? Puede que la hayas quitado. ' +
        '        <button type="button" class="kit-inst__reinstalar">Volver a instalarla</button></p>') +
        '    </div>' +
        '  </section>' +
        '</div>'
      );
      document.body.appendChild(hoja);

      function fuera(r) { if (hoja.parentNode) hoja.remove(); res(r || 'instalada'); }
      hoja.querySelector('.kit-capa__x').addEventListener('click', function () { fuera(); });
      hoja.querySelector('.kit-capa__velo').addEventListener('click', function () { fuera(); });

      var otra = hoja.querySelector('.kit-inst__reinstalar');
      if (otra) {
        otra.addEventListener('click', function () {
          olvidarInstalacion();
          if (hoja.parentNode) hoja.remove();
          abrir().then(res, function () { res('navegador'); });
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

  function video(base) {
    return '<video class="kit-inst__video" autoplay muted loop playsinline ' +
      'poster="' + K.esc(K.medio('img/' + base + '-poster.webp')) + '">' +
      '  <source src="' + K.esc(K.medio('vid/' + base + '.mp4')) + '" type="video/mp4">' +
      '</video>';
  }
  var COPIAR = '<button type="button" class="kit-btn kit-inst__copiar">Copiar el enlace</button>';

  /** Los pasos que tocan en ESTE aparato. Uno por caso, sin cajón de sastre. */
  function pasosDe(c) {
    if (c === 'ios-safari' || c === 'ios-otro') return pasosIOS(c);
    if (c === 'mac-safari') return pasosMac();
    if (c === 'embebido') return pasosEmbebido();
    if (c === 'firefox') return pasosFirefox();
    return pasosEscritorio();
  }

  function pasosIOS(c) {
    if (c === 'ios-otro') {
      return '' +
        '<p class="kit-inst__p">En iPhone y iPad <b>solo Safari</b> puede añadir la aplicación a la ' +
        'pantalla de inicio. Estás en otro navegador, así que el camino es abrir este mismo enlace ' +
        'en Safari y volver a intentarlo.</p>' +
        '<ol class="kit-inst__pasos">' +
        '  <li>Toca <b>Copiar el enlace</b> aquí abajo.</li>' +
        '  <li>Abre <b>Safari</b> y pega el enlace en la barra de direcciones.</li>' +
        '  <li>Ya en Safari: <b>Compartir</b> <span class="kit-inst__ico">' + K.icono('compartir-ios', 17) + '</span> → <b>Añadir a pantalla de inicio</b>.</li>' +
        '</ol>' +
        '<p class="kit-inst__ojo">Sin instalarla, en iPhone <b>no llegan los avisos</b>: iOS solo los ' +
        'entrega a las aplicaciones que están en la pantalla de inicio.</p>' +
        video('instalacion_ios') + COPIAR;
    }
    return '' +
      '<p class="kit-inst__p">En iPhone y iPad la instalación la hace Safari, no la aplicación. ' +
      'Son tres toques:</p>' +
      '<ol class="kit-inst__pasos">' +
      '  <li><b>Toca el icono de Compartir</b> <span class="kit-inst__ico">' + K.icono('compartir-ios', 17) + '</span> en la barra de Safari ' +
      '      (abajo en el iPhone, arriba en el iPad).</li>' +
      '  <li>Baja en la lista y elige <b>Añadir a pantalla de inicio</b>.</li>' +
      '  <li>Toca <b>Añadir</b> arriba a la derecha.</li>' +
      '</ol>' +
      '<p class="kit-inst__ojo">Sin instalarla, en iPhone <b>no llegan los avisos</b>: iOS solo los ' +
      'entrega a las aplicaciones que están en la pantalla de inicio.</p>' +
      video('instalacion_ios') + COPIAR;
  }

  function pasosMac() {
    return '' +
      '<p class="kit-inst__p">En Mac con Safari la aplicación se añade al Dock, y desde ahí se abre ' +
      'como cualquier otro programa, en su propia ventana.</p>' +
      '<ol class="kit-inst__pasos">' +
      '  <li>En la barra de arriba abre <b>Archivo</b>.</li>' +
      '  <li>Elige <b>Añadir al Dock…</b>.</li>' +
      '  <li>Confirma con <b>Añadir</b>.</li>' +
      '</ol>' +
      '<p class="kit-inst__ojo">Si tu Safari no tiene esa opción, es una versión anterior a Safari 17. ' +
      'Abre este mismo enlace en <b>Chrome</b> o <b>Edge</b> y ahí tendrás el botón de instalar.</p>' +
      COPIAR;
  }

  function pasosEscritorio() {
    return '' +
      '<p class="kit-inst__p">En el computador, Chrome y Edge instalan la aplicación desde la propia ' +
      'barra de direcciones:</p>' +
      '<ol class="kit-inst__pasos">' +
      '  <li>Mira al final de la barra de direcciones, a la derecha.</li>' +
      '  <li>Pulsa el icono de <b>instalar</b> <span class="kit-inst__ico">⊕</span> ' +
      '      (también está en el menú ⋮ → <b>Guardar y compartir</b> → <b>Instalar</b>).</li>' +
      '  <li>Confirma con <b>Instalar</b>.</li>' +
      '</ol>' +
      '<p class="kit-inst__ojo">Si no ves el icono, este navegador no admite instalar aplicaciones web. ' +
      'Con <b>Chrome</b> o <b>Edge</b> funciona.</p>' +
      video('instalacion') + COPIAR;
  }

  function pasosEmbebido() {
    return '' +
      '<p class="kit-inst__p">Abriste el enlace <b>dentro de otra aplicación</b> (WhatsApp, Instagram, ' +
      'Facebook…). Ese navegador interno no puede instalar nada: no es un fallo tuyo ni de la aplicación.</p>' +
      '<ol class="kit-inst__pasos">' +
      '  <li>Toca <b>Copiar el enlace</b> aquí abajo.</li>' +
      '  <li>Abre tu navegador normal: <b>Chrome</b> en Android, <b>Safari</b> en iPhone.</li>' +
      '  <li>Pega el enlace y vuelve a tocar Instalar.</li>' +
      '</ol>' +
      '<p class="kit-inst__ojo">Muchos navegadores internos traen un botón <b>⋮</b> con la opción ' +
      '"Abrir en el navegador": es el atajo.</p>' +
      COPIAR;
  }

  function pasosFirefox() {
    return '' +
      '<p class="kit-inst__p">Firefox de computador no instala aplicaciones web. No es un fallo: ' +
      'simplemente no trae esa función.</p>' +
      '<p class="kit-inst__p"><b>Qué hacer:</b> abre este mismo enlace en <b>Chrome</b> o en <b>Edge</b> ' +
      'y ahí tendrás el botón de instalar. En Android, Firefox sí puede: menú ⋮ → <b>Instalar</b>.</p>' +
      COPIAR;
  }

  /**
   * Pinta un botón donde se le diga y lo esconde cuando no tiene sentido.
   * Así la app no tiene que preguntar por los casos.
   */
  function boton(destino, texto) {
    var caja = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!caja) return null;
    var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca kit-inst__b">' +
      K.esc(texto || etiqueta()) + '</button>');
    b.addEventListener('click', function () { abrir(); });
    caja.appendChild(b);

    function revisar() {
      /* 4.5: se RETIRA el botón en cuanto la app está instalada en este
         aparato, aunque se esté mirando desde el navegador. */
      b.classList.toggle('kit-oculto', !sePuede() || yaSeInstalo());
      if (!texto) b.textContent = etiqueta();
    }
    revisar();
    K.cuando('kit:instalar', revisar);
    return b;
  }

  K.piezas.instalar = {
    vigilar: vigilar, abrir: abrir, boton: boton,
    sePuede: sePuede, instalada: instalada, caso: caso, etiqueta: etiqueta,
    yaSeInstalo: yaSeInstalo, olvidarInstalacion: olvidarInstalacion, pista: pista,
    __pasos: pasosDe          /* solo para el banco de pruebas */
  };
}());
