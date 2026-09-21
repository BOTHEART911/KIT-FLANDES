/* ============================================================
   KIT-FLANDES · PIEZA 19 · AVISOS PUSH (Firebase)
   Fase 4, entrega 4.1 · una sola copia en los 7 fronts.

   Qué hace
     Pide el permiso, saca el token de Firebase de ESTE teléfono y lo
     registra en el CORE. Nada más. No pinta pantallas propias salvo las
     dos hojas que explican por qué no se puede (iOS sin instalar y
     permiso bloqueado), porque son las únicas accionables.

   Cómo se usa

     KIT.piezas.avisos.activar({ silencioso: true });   // al entrar
     KIT.piezas.avisos.activar();                       // desde un botón
     KIT.piezas.avisos.estado()   → 'listo' | 'sin-permiso' | 'bloqueado'
                                    | 'ios-sin-instalar' | 'no-soportado'
                                    | 'apagado'
     KIT.piezas.avisos.alLlegar(fn)   // aviso con la app ABIERTA

   Lo que aprendimos y aquí se respeta

     · EL ORDEN IMPORTA. En iPhone, con la app SIN instalar, window
       .Notification ni siquiera existe: si la guarda de soporte va
       primero, el iPhone cae siempre en "tu navegador no permite avisos"
       y la única rama accionable queda muerta. iOS va PRIMERO.
     · El service worker de los avisos se registra en SU PROPIO scope.
       En './' reemplazaría al sw.js de la PWA (dos service workers no
       comparten scope) y se rompería el caché y la instalación. En el
       repo viejo de contratista, OneSignal declaraba el scope
       "/contratista/" mientras las páginas se servían desde otra ruta:
       por eso aquel push no llegó nunca.
     · El token de Firebase viaja al CORE en el campo 'fcm'. NUNCA en
       'token': ese nombre es el de la sesión y los dos se pisaban.
     · El permiso en iOS tiene que salir de un toque DIRECTO. Si el
       navegador lo rechaza por el gesto, no se molesta al usuario: se
       calla y el botón de la app lo recoge después.
     · Un token ya registrado no se vuelve a mandar en cada arranque,
       pero sí se refresca si Firebase lo cambia.

   Depende de: kit.js (KIT.pedir, KIT.guardar) · marca.js (FIREBASE)
   Pareja: no tiene CSS propio; usa el de kit/sesion.css para las hojas.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/avisos] falta kit.js'); } catch (e) {} return; }

  var M = window.MARCA || {};
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var TOKEN_K = 'avisos.token';       /* el token ya registrado en este aparato */
  var SW_SCOPE = './firebase-cloud-messaging-push-scope';

  var alLlegarFns = [];
  var cfgRemota = null;

  /* ── de qué es capaz este aparato ───────────────────────── */

  function esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function instalada() {
    return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }
  function soporta() {
    return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
  }
  function permiso() { return soporta() ? Notification.permission : 'no-soportado'; }
  function tokenLocal() { return K.guardar.leer(TOKEN_K, '') || ''; }

  function plataforma() {
    var ua = navigator.userAgent || '';
    var so = /android/i.test(ua) ? 'Android'
      : esIOS() ? 'iOS'
      : /windows/i.test(ua) ? 'Windows'
      : /mac os/i.test(ua) ? 'macOS' : 'Web';
    return so + (instalada() ? ' · instalada' : ' · navegador');
  }

  function estado() {
    if (esIOS() && !instalada()) return 'ios-sin-instalar';
    if (!soporta()) return 'no-soportado';
    if (permiso() === 'denied') return 'bloqueado';
    if (permiso() !== 'granted') return 'sin-permiso';
    return tokenLocal() ? 'listo' : 'sin-permiso';
  }

  /* ── el SDK, solo cuando hace falta ─────────────────────── */

  function cargar(url) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = ok;
      s.onerror = function () { mal(K.problema('SIN_SDK', 'No se pudo cargar Firebase.')); };
      document.head.appendChild(s);
    });
  }

  function firebaseListo(conf) {
    var p = Promise.resolve();
    if (!window.firebase) p = p.then(function () { return cargar(SDK + 'firebase-app-compat.js'); });
    p = p.then(function () {
      if (!window.firebase.messaging) return cargar(SDK + 'firebase-messaging-compat.js');
    });
    return p.then(function () {
      if (!(window.firebase.apps && window.firebase.apps.length)) {
        window.firebase.initializeApp(conf);
      }
      return window.firebase;
    });
  }

  /**
   * La configuración manda desde la hoja CONFIG, no desde el front: así se
   * apagan los avisos de todo el ecosistema sin volver a publicar 7 repos.
   * Si el CORE no contesta, se sigue con la copia de marca.js.
   */
  function config() {
    if (cfgRemota) return Promise.resolve(cfgRemota);
    return K.pedir('configPush')
      .then(function (d) {
        cfgRemota = {
          activo: d && d.activo !== false,
          firebase: (d && d.firebase && d.firebase.apiKey) ? d.firebase : (M.FIREBASE || {}),
          vapid: (d && d.vapid) || M.FIREBASE_VAPID || ''
        };
        return cfgRemota;
      })
      ['catch'](function () {
        cfgRemota = { activo: true, firebase: M.FIREBASE || {}, vapid: M.FIREBASE_VAPID || '' };
        return cfgRemota;
      });
  }

  /* ── las dos hojas que sí llevan a alguna parte ─────────── */

  function hoja(titulo, texto, botonTexto, alBoton) {
    if (!K.piezas.conexion || !K.piezas.conexion.rescate) {
      K.aviso(titulo + '. ' + texto, 'aviso', 6000);
      return;
    }
    K.piezas.conexion.rescate({
      icono: '🔔',
      titulo: titulo,
      texto: texto,
      atajos: botonTexto ? [{ texto: botonTexto, al: alBoton }] : []
    });
  }

  function explicarIOS() {
    hoja('Instala la app primero',
      'En iPhone y iPad los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o superior).',
      'Ver cómo se instala',
      function () { if (K.piezas.instalar) K.piezas.instalar.abrir(); });
  }

  function explicarBloqueo() {
    hoja('Los avisos están bloqueados',
      esIOS()
        ? 'Entra a Ajustes del iPhone → Notificaciones, busca la app y permite los avisos.'
        : 'Toca el candado que está junto a la dirección del sitio y permite las notificaciones.',
      '', null);
  }

  /* ── lo que hace el trabajo ─────────────────────────────── */

  /**
   * activar({ silencioso: true })
   *   silencioso: no dice nada cuando falla. Es lo que se usa al entrar;
   *   nadie quiere un error rojo justo al iniciar sesión.
   * Devuelve una promesa con true/false.
   */
  function activar(opciones) {
    var o = opciones || {};
    var decir = function (msg, tipo) { if (!o.silencioso) K.aviso(msg, tipo || 'malo', 4500); };

    /* iOS PRIMERO: sin instalar, Notification no existe y la guarda de
       soporte mandaría a todos los iPhone al mensaje equivocado. */
    if (esIOS() && !instalada()) {
      if (!o.silencioso) explicarIOS();
      return Promise.resolve(false);
    }
    if (!soporta()) { decir('Este navegador no permite avisos.'); return Promise.resolve(false); }
    if (permiso() === 'denied') {
      if (!o.silencioso) explicarBloqueo();
      return Promise.resolve(false);
    }

    return config().then(function (c) {
      if (!c.activo) { decir('Los avisos están apagados desde la administración.', 'aviso'); return false; }
      if (!c.vapid) { decir('Faltan los datos de Firebase.'); return false; }

      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') { decir('No activaste los avisos.'); return false; }

        return firebaseListo(c.firebase).then(function (fb) {
          return navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: SW_SCOPE })
            .then(function (reg) {
              var msg = fb.messaging();
              return msg.getToken({ vapidKey: c.vapid, serviceWorkerRegistration: reg })
                .then(function (tk) {
                  if (!tk) { decir('No se pudo generar el aviso.'); return false; }

                  /* Ya registrado y sin cambios: no se molesta al servidor. */
                  if (tk === tokenLocal() && !o.forzar) { escuchar(msg); return true; }

                  return K.pedir('registrarDispositivo', { fcm: tk, plataforma: plataforma() })
                    .then(function () {
                      K.guardar.escribir(TOKEN_K, tk);
                      escuchar(msg);
                      if (!o.silencioso) K.aviso('Avisos activados', 'ok', 3000);
                      return true;
                    });
                });
            });
        });
      });
    })['catch'](function () {
      /* En iOS el permiso debe salir de un toque directo; si el navegador
         lo rechaza por el gesto no se molesta al usuario. */
      decir('No se pudieron activar los avisos.');
      return false;
    });
  }

  /** Con la app abierta el aviso no se muestra solo: lo entregamos a la app. */
  function escuchar(msg) {
    try {
      msg.onMessage(function (payload) {
        var d = (payload && payload.data) || {};
        var n = (payload && payload.notification) || {};
        for (var i = 0; i < alLlegarFns.length; i++) {
          try { alLlegarFns[i]({ titulo: n.title || '', cuerpo: n.body || '', datos: d }); } catch (e) {}
        }
        K.disparar('kit:aviso', { titulo: n.title || '', cuerpo: n.body || '', datos: d });
      });
    } catch (e) {}
  }

  /** Se intenta al entrar, en silencio, si este aparato aún no está registrado. */
  function autoActivar() {
    try {
      if (tokenLocal()) { activar({ silencioso: true }); return; }
      activar({ silencioso: true });
    } catch (e) {}
  }

  function alLlegar(fn) { if (typeof fn === 'function') alLlegarFns.push(fn); }

  /** Olvida este aparato al cerrar sesión: el token se queda en el CORE. */
  function olvidar() { K.guardar.borrar(TOKEN_K); }

  K.piezas.avisos = {
    activar: activar, autoActivar: autoActivar, estado: estado,
    alLlegar: alLlegar, olvidar: olvidar,
    plataforma: plataforma, instalada: instalada, esIOS: esIOS
  };
}());
