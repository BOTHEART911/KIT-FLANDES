/* ============================================================
   KIT-FLANDES · VERSIÓN (pieza 23)
   Fase 4 · entrega 4.3

   El problema que resuelve
     Las apps se sirven desde GitHub Pages con un service worker que
     guarda el armazón en caché. Cuando se publica algo nuevo, el
     service worker nuevo se instala, pero en ESA misma carga los
     scripts ya se pidieron al caché viejo: lo nuevo aparece a la
     SEGUNDA apertura. Desde fuera se ve como "no se actualizó".

   Cómo lo resuelve
     Cada app lleva en su raíz un archivo `version.js` con una sola
     línea:

         var APP_VERSION = "2026.09.21.1";

     Esta pieza vuelve a pedir ese archivo a la RED (sin caché) al
     arrancar y cada vez que la persona vuelve a la app. Si el número
     de la red no es el que se cargó, borra las cachés DE ESTA APP y
     recarga. A la vuelta ya no hay caché vieja que servir.

   Por qué solo las cachés de esta app
     Las siete apps viven en el mismo origen (botheart911.github.io) y
     comparten el almacén de cachés. Un caches.keys() + delete a todo
     se lleva por delante a las otras seis. Aquí solo se borra lo que
     empieza por el prefijo de esta app.

   Lo que hay que hacer en cada publicación
     Subir el número de `version.js`. Nada más. El service worker
     nombra su caché con ese mismo número (importScripts('./version.js')),
     así que cada publicación estrena caché y la anterior se borra sola.

   Cómo se usa

     KIT.piezas.version.vigilar();        una vez, al arrancar la app
     KIT.piezas.version.numero()          '2026.09.21.1'
     KIT.piezas.version.comprobar()       Promise<boolean> (true = había una nueva)
     KIT.piezas.version.listo()           Promise que se resuelve cuando ya se
                                          sabe que NO hay que recargar; KIT.pedir
                                          la espera antes de hablar con el CORE

   El número sale en el pie, junto a la firma: lo pinta kit/creditos.js.

   Sin pareja de CSS.
   ============================================================ */
(function (raiz) {
  'use strict';

  var K = raiz.KIT;
  if (!K) { try { console.warn('[kit/version] falta kit.js'); } catch (e) {} return; }

  /* El número que se cargó con la página. Si la app no trae version.js,
     la pieza se queda quieta en vez de recargar en bucle. */
  var CARGADA = String(raiz.APP_VERSION || '').trim();

  /* Prefijo de las cachés de esta app. El service worker las nombra
     '<app>-v<versión>'; aquí se borra por el '<app>-'. */
  var PREFIJO = String((raiz.MARCA && raiz.MARCA.APP) || K.app || '').toLowerCase() + '-';

  var MARCA_RECARGA = 'version.recargada';
  var comprobando = false;

  /** Lee el número que hay AHORA en el servidor, sin pasar por el caché. */
  function deLaRed() {
    return fetch('./version.js?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        var m = /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(String(txt || ''));
        return m ? m[1].trim() : '';
      })
      ['catch'](function () { return ''; });
  }

  /** Borra SOLO las cachés de esta app. Devuelve cuántas se llevó.
      25/09 · `conservar` es el número recién publicado: su caché la está
      llenando en ese mismo momento el service worker nuevo, y borrarla a
      medio llenar lo dejaba sirviendo desde la red archivo por archivo. */
  function limpiarCaches(conservar) {
    if (!raiz.caches || !raiz.caches.keys) return Promise.resolve(0);
    var nueva = conservar ? (PREFIJO + 'v' + String(conservar)).toLowerCase() : '';
    return raiz.caches.keys().then(function (llaves) {
      var mias = llaves.filter(function (k) {
        var n = String(k).toLowerCase();
        return n.indexOf(PREFIJO) === 0 && n !== nueva;
      });
      return Promise.all(mias.map(function (k) { return raiz.caches['delete'](k); }))
        .then(function () { return mias.length; });
    })['catch'](function () { return 0; });
  }

  /*
   * 25/09 · ANTES DE RECARGAR, QUE EL SERVICE WORKER NUEVO QUEDE AL MANDO.
   *
   * Si se recarga con el viejo todavía al mando, la página vuelve a salir
   * del armazón viejo. Se le pide al navegador que revise el service worker
   * y, si hay uno instalándose, se espera a que se active (tiene
   * skipWaiting + clients.claim). Con tope: una red lenta no puede dejar la
   * app esperando para siempre.
   */
  function esperarServiceWorker(tope) {
    var sw = raiz.navigator && raiz.navigator.serviceWorker;
    if (!sw || !sw.getRegistration) return Promise.resolve();
    return new Promise(function (listo) {
      var hecho = false;
      function fin() { if (!hecho) { hecho = true; listo(); } }
      setTimeout(fin, tope || 4000);
      sw.getRegistration().then(function (reg) {
        if (!reg) return fin();
        var p = reg.update ? reg.update() : Promise.resolve();
        return Promise.resolve(p)['catch'](function () {}).then(function () {
          var nuevo = reg.installing || reg.waiting;
          if (!nuevo) return fin();
          nuevo.addEventListener('statechange', function () {
            if (nuevo.state === 'activated' || nuevo.state === 'redundant') fin();
          });
        });
      })['catch'](fin);
    });
  }

  /**
   * comprobar() → Promise<boolean>
   * true = había una versión nueva y la app se va a recargar.
   *
   * El seguro contra el bucle: si ya se recargó por ESTE número y el
   * problema sigue (por ejemplo, un proxy que sirve el archivo viejo),
   * no se vuelve a recargar. Mejor una app un poco vieja que una app
   * que se recarga sin parar y no deja usarla.
   */
  function comprobar() {
    if (!CARGADA || comprobando) return Promise.resolve(false);
    comprobando = true;

    return deLaRed().then(function (enLaRed) {
      comprobando = false;
      if (!enLaRed || enLaRed === CARGADA) return false;

      var ya = '';
      try { ya = sessionStorage.getItem(K.ns + MARCA_RECARGA) || ''; } catch (e) {}
      if (ya === enLaRed) {
        /* 25/09 · Ya se recargó por este número. Si el <script> sigue
           diciendo el viejo es porque el navegador se lo guardó (GitHub
           Pages lo deja 10 minutos en su caché): el código ya es el nuevo.
           Se toma el de la red como el cargado y no se vuelve a preguntar
           por él en cada regreso. */
        CARGADA = enLaRed;
        return false;
      }
      try { sessionStorage.setItem(K.ns + MARCA_RECARGA, enLaRed); } catch (e) {}
      RECARGANDO = true;

      return esperarServiceWorker(4000).then(function () {
        return limpiarCaches(enLaRed);
      }).then(function () {
        /* 5.4.1 · La versión nueva arranca SIEMPRE desde el inicio (o desde
           la entrada si no hay sesión), no desde la vista donde estaba la
           persona: recargar una vista pesada (una cuenta con sus documentos
           bajando) a medio camino dejaba la app pensando mucho rato. */
        try {
          var destino = (K.token && K.token()) ? '#/inicio' : '';
          raiz.history.replaceState(null, '', raiz.location.pathname + raiz.location.search + destino);
        } catch (e) {}
        try { raiz.location.reload(); } catch (e) {}
        return true;
      });
    })['catch'](function () { comprobando = false; return false; });
  }

  /*
   * 25/09 · LA PUERTA DEL ARRANQUE.
   *
   * La causa de "Cargando tus datos" eterno después de publicar: la
   * comprobación salía 1,2 s DESPUÉS de arrancar y recargaba la página
   * justo con la llamada 'inicio' a medio camino. La llamada se cortaba
   * (la redirección de Apps Script quedaba colgada: el 404 de
   * googleusercontent) y todo empezaba de cero.
   *
   * Ahora la comprobación sale de primera y KIT.pedir la espera antes de
   * hablar con el CORE: si hay versión nueva se recarga con NADA en vuelo.
   * Tope de 3 s para que una red lenta no frene la entrada.
   */
  var PUERTA = null;
  var TOPE_PUERTA = 3000;
  var RECARGANDO = false;   /* ya se decidió recargar: la puerta no se abre */

  function listo() {
    if (!PUERTA) return Promise.resolve(false);
    return PUERTA;
  }

  /**
   * vigilar() — comprueba al arrancar y cada vez que la persona vuelve.
   *
   * No se usa un temporizador: una app abierta toda la tarde en un
   * teléfono no tiene por qué ir preguntando sola. El momento bueno es
   * cuando la persona la trae al frente, que es justo cuando va a usarla.
   *
   * Y no se comprueba mientras hay algo a medio guardar: el kit avisa
   * con 'kit:ocupado' y la comprobación espera al siguiente regreso.
   */
  function vigilar(opciones) {
    opciones = opciones || {};
    if (!CARGADA) return;

    if (opciones.alArrancar !== false && !PUERTA) {
      /* 25/09 · De primera y sin mirar si hay ventanas abiertas: al arrancar
         nadie ha escrito nada todavía. Si hay versión nueva la promesa no se
         resuelve (la página se va) y lo que esperaba no llega a salir. */
      var comprobacion = comprobar();
      PUERTA = new Promise(function (seguir) {
        /* El tope cubre solo la pregunta a la red. Si la respuesta ya dijo
           "hay nueva", la puerta se queda cerrada hasta que la página se
           vaya: abrirla ahí sería volver a cortar 'inicio'. */
        var t = setTimeout(function () { if (!RECARGANDO) seguir(false); }, TOPE_PUERTA);
        /* Seguro final: si por lo que sea la página no llegó a irse, la app
           no se queda muda para siempre. */
        setTimeout(function () { seguir(false); }, 12000);
        comprobacion.then(function (recarga) {
          if (!recarga) { clearTimeout(t); seguir(false); }
        });
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !ocupado()) comprobar();
    });

    raiz.addEventListener('focus', function () {
      if (!ocupado()) comprobar();
    });
  }

  /* Recargar en mitad de un guardado le borraría a la persona lo escrito.
     Cualquier pieza puede levantar la mano poniendo KIT.ocupado = true. */
  function ocupado() {
    /* 5.4.1 · tampoco con una ventana abierta (alguien escribiendo un
       requerimiento o un comunicado): se comprueba la próxima vez */
    if (document.querySelector('[aria-modal="true"]')) return true;
    return raiz.KIT && raiz.KIT.ocupado === true;
  }

  K.piezas.version = {
    numero: function () { return CARGADA; },
    prefijo: function () { return PREFIJO; },
    comprobar: comprobar,
    vigilar: vigilar,
    limpiarCaches: limpiarCaches,
    listo: listo,
    /* Para las pruebas: deja fingir otro número cargado. */
    _fijar: function (v) { CARGADA = String(v || ''); }
  };
}(window));
