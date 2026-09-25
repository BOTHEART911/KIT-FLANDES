/* ============================================================
   KIT-FLANDES · NÚCLEO
   Fase 3 del ecosistema Flandes · una sola copia en los 7 fronts.

   Qué es
     El suelo sobre el que se paran las otras 13 piezas: atajos de DOM,
     almacenamiento con espacio de nombres propio de cada app, la única
     llamada al FLANDES-CORE, sonidos sin retardo, háptica y el resolutor
     de medios de ALCALDIA-MEDIOS.

   Qué NO hace
     No pinta nada. No toca el HTML de la app. No conoce ninguna vista.

   Cómo se carga (en el <head>, en este orden)
     <script src="marca.js"></script>     ← API_URL, APP, MEDIOS_BASE, STORAGE_NS
     <script src="kit/kit.js"></script>
     ...las piezas que use la app...

   Depende de
     window.MARCA, que trae marca.js. Si falta, el kit avisa por consola
     y sigue con valores vacíos en vez de romper la app.
   ============================================================ */
(function (raiz) {
  'use strict';

  if (raiz.KIT) return;                       /* una sola vez por página */

  var M = raiz.MARCA || {};
  if (!raiz.MARCA) {
    try { console.warn('[kit] falta marca.js: el kit arranca sin API_URL ni MEDIOS_BASE.'); } catch (e) {}
  }

  var API   = String(M.API_URL || '');
  var APP   = String(M.APP || '').toUpperCase();
  var NS    = String(M.STORAGE_NS || (APP ? APP.toLowerCase() + '.' : 'flandes.'));
  var BASE  = String(M.MEDIOS_BASE || '').replace(/\/*$/, '/');

  /* ══════════════ 1) DOM ══════════════ */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) {
    var l = (ctx || document).querySelectorAll(sel), out = [], i;
    for (i = 0; i < l.length; i++) out.push(l[i]);
    return out;
  }
  function id(x) { return document.getElementById(x); }

  /** Crea un nodo desde HTML. Devuelve el primer elemento. */
  function nodo(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html).trim();
    return d.firstElementChild;
  }

  /** Escapa texto que va a entrar como HTML. Todo dato de la hoja pasa por aquí. */
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Quita tildes y pasa a mayúsculas: para comparar nombres sin sorpresas.
   *
   * La Ñ se SALVA a propósito. normalize('NFD') la parte en N + virgulilla
   * y el filtro se la llevaría, con lo que PEÑA y PENA quedarían iguales:
   * son dos apellidos distintos y en la hoja están los dos.
   */
  function norm(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ')
      .trim().toUpperCase();
  }

  function on(el, ev, fn, opts) {
    if (!el) return function () {};
    el.addEventListener(ev, fn, opts || false);
    return function () { el.removeEventListener(ev, fn, opts || false); };
  }

  /** Espera a que el DOM esté listo. Si ya lo está, corre en el acto. */
  function listo(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, yo = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(yo, args); }, ms || 150);
    };
  }

  /* ══════════════ 2) ALMACENAMIENTO CON ESPACIO DE NOMBRES ══════════════

     Las 7 apps viven en el MISMO origen (botheart911.github.io), así que
     comparten localStorage. Sin prefijo, la sesión de Tesorería pisa la de
     Contratación. Todo lo que guarde el kit pasa por aquí.                */

  function clave(k) { return NS + String(k); }

  var guardar = {
    leer: function (k, pordefecto) {
      try {
        var v = localStorage.getItem(clave(k));
        return v === null ? (pordefecto === undefined ? null : pordefecto) : JSON.parse(v);
      } catch (e) { return pordefecto === undefined ? null : pordefecto; }
    },
    escribir: function (k, v) {
      try { localStorage.setItem(clave(k), JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    borrar: function (k) {
      try { localStorage.removeItem(clave(k)); return true; } catch (e) { return false; }
    },
    /** Borra SOLO lo de esta app. Nunca localStorage.clear(), que se lleva las otras 6. */
    borrarTodo: function () {
      try {
        var fuera = [], i, k;
        for (i = 0; i < localStorage.length; i++) {
          k = localStorage.key(i);
          if (k && k.indexOf(NS) === 0) fuera.push(k);
        }
        for (i = 0; i < fuera.length; i++) localStorage.removeItem(fuera[i]);
        return fuera.length;
      } catch (e) { return 0; }
    }
  };

  /* ══════════════ 3) LA ÚNICA PUERTA AL CORE ══════════════

     Apps Script no admite cabeceras que disparen preflight CORS, así que
     el cuerpo va como text/plain aunque sea JSON. El CORE lo espera así.  */

  var TOKEN_K = 'sesion.token';

  function token() { return guardar.leer(TOKEN_K, '') || ''; }
  function ponerToken(t) { if (t) guardar.escribir(TOKEN_K, t); else guardar.borrar(TOKEN_K); }

  /**
   * pedir('cuentaListar', {desde:'...'}) → Promise con data
   *
   * Resuelve con el contenido de `data`. Rechaza con un Error cuyo
   * `.codigo` trae el del CORE ('SESION_VENCIDA', 'SIN_PERMISO'...), para
   * que la app decida sin leer textos.
   */
  function pedir(accion, datos, opciones) {
    opciones = opciones || {};
    if (!API) return Promise.reject(problema('SIN_API', 'Falta API_URL en marca.js.'));

    var cuerpo = { app: opciones.app || APP, action: accion };
    var k;
    if (datos) for (k in datos) if (Object.prototype.hasOwnProperty.call(datos, k)) cuerpo[k] = datos[k];
    if (!cuerpo.token && token() && opciones.sinToken !== true) cuerpo.token = token();

    /* 25/09 · Antes de hablar con el CORE se espera a la pieza de versión:
       si acaba de publicarse algo nuevo la página se recarga ANTES de
       mandar nada, en vez de cortar esta llamada a medio camino. */
    var pv = raiz.KIT && raiz.KIT.piezas && raiz.KIT.piezas.version;
    var puerta = (pv && pv.listo) ? pv.listo() : Promise.resolve(false);

    return puerta.then(function () { return enviar(cuerpo, opciones); });
  }

  /* El mensaje que ve la persona cuando la respuesta llega rota. Nunca se le
     habla de JSON ni de despliegues: casi siempre es la red del teléfono o
     la redirección de Google que se quedó a medias. */
  var TXT_INTERMITENCIA = 'Quizás tu internet presenta intermitencias, inténtalo de nuevo. Si el problema persiste, solicita soporte.';

  function enviar(cuerpo, opciones) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var corte = setTimeout(function () { if (ctrl) ctrl.abort(); }, opciones.ms || 60000);

    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      signal: ctrl ? ctrl.signal : undefined,
      redirect: 'follow'
    })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        clearTimeout(corte);
        var j;
        try { j = JSON.parse(txt); }
        catch (e) {
          /* Apps Script devuelve HTML cuando la sesión de Google caducó o
             el despliegue no es público: ese es el famoso "Unexpected token '<'". */
          try { console.warn('[kit] respuesta que no es JSON en ' + cuerpo.action + ':', String(txt || '').slice(0, 120)); } catch (e2) {}
          throw problema('RESPUESTA_NO_JSON', TXT_INTERMITENCIA);
        }
        if (j && j.ok) {
          /* 10.4 · el CORE pega '_soporte' a 'inicio' (y al login) cuando la
             persona tiene un soporte resuelto por calificar: la pieza de
             soporte abre las estrellas sin pedir otro viaje. */
          if (j.data && j.data._soporte) {
            var sop = j.data._soporte;
            setTimeout(function () { disparar('kit:soporte', sop); }, 1200);
          }
          return j.data;
        }
        var p = problema((j && j.codigo) || 'ERROR', (j && j.error) || 'El servidor no pudo atender la solicitud.');
        if (p.codigo === 'SESION_VENCIDA' || p.codigo === 'SIN_SESION') ponerToken('');
        throw p;
      })
      .catch(function (e) {
        clearTimeout(corte);
        if (e && e.codigo) throw e;
        if (e && e.name === 'AbortError') throw problema('TIEMPO', 'El servidor tardó demasiado en responder.');
        throw problema('SIN_RED', 'No se pudo hablar con el servidor.');
      });
  }

  function problema(codigo, mensaje) {
    var e = new Error(mensaje || codigo);
    e.codigo = codigo;
    return e;
  }

  /* ══════════════ 4) MEDIOS ══════════════

     Una sola forma de nombrar lo que vive en ALCALDIA-MEDIOS. En el código
     de las apps se escribe KIT.medio('img/logo.webp'), nunca una URL entera. */

  function medio(ruta) {
    var r = String(ruta || '').replace(/^\/+/, '');
    if (/^https?:\/\//i.test(ruta)) return ruta;     /* ya es absoluta: se respeta */
    return BASE + r;
  }

  /* ══════════════ 5) SONIDO SIN RETARDO ══════════════

     Se precargan al primer gesto del usuario (iOS no deja antes) y se
     reutiliza el mismo elemento, que es lo que quita el retardo.          */

  var sonidos = {};
  var audioListo = false;

  function precargar(lista) {
    var i;
    for (i = 0; i < lista.length; i++) prepararSonido(lista[i]);
  }

  function prepararSonido(ruta) {
    if (sonidos[ruta]) return sonidos[ruta];
    var a = new Audio(medio(ruta));
    a.preload = 'auto';
    a.volume = 0.6;
    sonidos[ruta] = a;
    return a;
  }

  function sonar(ruta) {
    if (guardar.leer('sonido.apagado', false) === true) return;
    try {
      var a = prepararSonido(ruta);
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});   /* el navegador puede negarse: no es error */
    } catch (e) {}
  }

  function vibrar(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {}
  }

  /* Al primer toque real, despierta el audio de iOS. */
  function despertarAudio() {
    if (audioListo) return;
    audioListo = true;
    var k;
    for (k in sonidos) {
      if (!Object.prototype.hasOwnProperty.call(sonidos, k)) continue;
      try { sonidos[k].play().then(function () {}).catch(function () {}); sonidos[k].pause(); sonidos[k].currentTime = 0; } catch (e) {}
    }
  }
  document.addEventListener('pointerdown', despertarAudio, { once: true, capture: true });

  /* ══════════════ 6) FORMATOS DE COLOMBIA ══════════════ */

  /**
   * Número escrito como se escribe aquí: el PUNTO es separador de miles y
   * la COMA es el decimal. Tomar "2.500" por dos y medio es el error que
   * convierte una cuenta de dos millones y medio en tres pesos.
   */
  function aNumero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) return 0;
    var negativo = /^-|\(.*\)$/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (s.indexOf(',') >= 0) {
      /* hay coma: la coma manda como decimal y los puntos son miles */
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      /* sin coma: un punto solo con 1 o 2 cifras detrás es decimal
         ("1500.6"); con tres, es separador de miles ("2.500") */
      var p = s.split('.');
      if (p.length > 2 || (p.length === 2 && p[1].length === 3)) s = p.join('');
    }
    var n = Number(s);
    if (!isFinite(n)) n = 0;
    return negativo ? -Math.abs(n) : n;
  }

  function pesos(v) {
    return '$ ' + Math.round(aNumero(v)).toLocaleString('es-CO');
  }
  function numero(v) {
    return aNumero(v).toLocaleString('es-CO');
  }

  /**
   * 4.5 · EL CAMPO DE PESOS SE FORMATEA MIENTRAS SE ESCRIBE
   *
   * Hasta la 4.4 el campo se ordenaba al salir de él. Suena igual y no lo
   * es: mientras la persona teclea ve "2500000" y ahí NADIE cuenta los
   * ceros. Así es como se mete un dígito de más y se cobra diez veces lo
   * que toca. La app vieja lo ponía bonito al vuelo, y es lo que Oss pide
   * recuperar: "la app debe ser de fácil navegación".
   *
   * Lo delicado es el CURSOR. Si al reescribir el valor se manda el cursor
   * al final, corregir una cifra por el medio es imposible. Aquí se cuenta
   * cuántos DÍGITOS quedan a la izquierda del cursor y se vuelve a poner
   * donde había ese mismo número de dígitos, que es lo único que no se
   * descoloca cuando aparecen o desaparecen los puntos.
   *
   * EL FALLO DE LA 4.5, PARA QUE NO SE REPITA (cazado el 22/09 por Oss)
   *
   * La primera versión leía el número con aNumero() sobre el texto que ESTA
   * MISMA función acababa de formatear. Y ahí está la trampa: con el campo
   * en "4.200", teclear otro cero deja "4.2000", y aNumero lee eso como el
   * decimal 4,2 — un punto con cuatro cifras detrás no es separador de
   * miles. Resultado: el campo se quedaba en "4,2" y se guardaba un 4 donde
   * iban cuatro millones doscientos mil.
   *
   * REGLA: aquí NUNCA se vuelve a leer el formato propio. Solo se miran los
   * DÍGITOS. aNumero() es para lo que escribe una persona o lo que viene de
   * la hoja, no para lo que escribió esta función.
   *
   * Devuelve una función para leer el número pelado, que es lo que se
   * manda al CORE: en la hoja nunca entra un punto.
   */
  function pesosEnVivo(inp, alCambiar) {
    if (!inp) return function () { return 0; };

    /* Los dígitos y nada más. Un campo de pesos no lleva decimales: en la
       hoja los valores son enteros y el formato de aquí no los admite. */
    function digitos(t) { return String(t === null || t === undefined ? '' : t).replace(/\D/g, ''); }

    function pintar() {
      var crudo = inp.value;
      var digitosAntes = digitos(crudo.slice(0, inp.selectionStart || 0)).length;

      /* Un campo vacío se queda vacío: escribir un 0 de la nada hace que la
         persona lo borre a cada rato. Y el "0" que teclea ella sí vale. */
      var solo = digitos(crudo).replace(/^0+(?=\d)/, '');   /* 007 -> 7 */
      var n = solo ? Number(solo) : 0;

      inp.value = solo ? n.toLocaleString('es-CO') : '';

      /* el cursor, donde volvían a estar esos mismos dígitos */
      var pos = 0, vistos = 0;
      while (pos < inp.value.length && vistos < digitosAntes) {
        if (/\d/.test(inp.value[pos])) vistos++;
        pos++;
      }
      try { inp.setSelectionRange(pos, pos); } catch (e) { /* type=tel en iOS a veces se queja */ }

      if (typeof alCambiar === 'function') alCambiar(solo ? String(n) : '');
    }

    inp.addEventListener('input', pintar);
    inp.addEventListener('blur', pintar);
    /* Pegar un valor con puntos, comas o un $ delante entra igual: se
       queda con los dígitos, que es lo que hay que guardar. */
    inp.addEventListener('paste', function () { setTimeout(pintar, 0); });

    /* el valor de arranque también pasa por el mismo filtro */
    if (inp.value) pintar();

    return function () { return Number(digitos(inp.value) || 0); };
  }
  /** '2026-09-21' o Date → '21/09/2026'. Lo que no es fecha se devuelve tal cual. */
  function fecha(v) {
    if (!v) return '';
    var d = (v instanceof Date) ? v : null;
    var m = !d && /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    if (!d) {
      var t = Date.parse(v);
      if (isNaN(t)) return String(v);
      d = new Date(t);
    }
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* ══════════════ 7) AVISOS ══════════════

     Un aviso corto arriba. No bloquea. Las piezas lo usan para lo menor;
     lo grave va al modal de la pieza que corresponda.                     */

  var pilaAvisos = null;

  function aviso(texto, tipo, ms) {
    if (!pilaAvisos) {
      pilaAvisos = nodo('<div class="kit-avisos" role="status" aria-live="polite"></div>');
      document.body.appendChild(pilaAvisos);
    }
    var t = nodo('<div class="kit-aviso kit-aviso--' + (tipo || 'info') + '">' + esc(texto) + '</div>');
    pilaAvisos.appendChild(t);
    setTimeout(function () { t.classList.add('kit-aviso--on'); }, 10);
    setTimeout(function () {
      t.classList.remove('kit-aviso--on');
      setTimeout(function () { if (t.parentNode) t.remove(); }, 250);
    }, ms || 3200);
    return t;
  }

  /* ══════════════ 8) TEMA CLARO / OSCURO ══════════════ */

  function temaActual() {
    return document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
  }
  function ponerTema(t, recordar) {
    var oscuro = (t === 'oscuro');
    document.documentElement.setAttribute('data-tema', oscuro ? 'oscuro' : 'claro');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#0d1512' : '#06402B');
    if (recordar !== false) guardar.escribir('tema', oscuro ? 'oscuro' : 'claro');
    disparar('kit:tema', { tema: oscuro ? 'oscuro' : 'claro' });
  }
  function alternarTema() { ponerTema(temaActual() === 'oscuro' ? 'claro' : 'oscuro', true); vibrar(8); }

  /* El tema guardado se aplica cuanto antes para que no haya destello blanco. */
  (function temaDeEntrada() {
    var t = guardar.leer('tema', '');
    if (!t && raiz.matchMedia && raiz.matchMedia('(prefers-color-scheme: dark)').matches) t = 'oscuro';
    ponerTema(t || 'claro', false);
  }());

  /* ══════════════ 9) EVENTOS PROPIOS ══════════════ */

  function disparar(nombre, detalle) {
    try { document.dispatchEvent(new CustomEvent(nombre, { detail: detalle || {} })); } catch (e) {}
  }
  function cuando(nombre, fn) { return on(document, nombre, function (e) { fn(e.detail || {}); }); }

  /* ══════════════ SALIDA ══════════════ */

  raiz.KIT = {
    version: '1.0.0',
    app: APP, api: API, ns: NS, mediosBase: BASE,

    $: $, $$: $$, id: id, nodo: nodo, esc: esc, norm: norm,
    on: on, listo: listo, debounce: debounce,

    guardar: guardar,
    token: token, ponerToken: ponerToken,
    pedir: pedir, problema: problema,

    medio: medio, precargar: precargar, sonar: sonar, vibrar: vibrar,
    pesos: pesos, numero: numero, aNumero: aNumero, pesosEnVivo: pesosEnVivo, fecha: fecha,
    aviso: aviso,

    /* ── 4.4 · RED DE SEGURIDAD DE LOS ICONOS ──
       Desde la 4.4 las piezas dibujan sus botones con K.icono(). El set
       vive en kit/iconos.js, que hay que cargar DESPUÉS de este archivo.
       Si una app se lleva el kit y se olvida de ese <script>, sin esto
       reventaría entera: banner, sesión, guardado, carrusel y adjuntos
       llaman a K.icono() al pintar, y un "K.icono is not a function"
       tumba la pieza completa, no solo el dibujo. Lo cazó el banco del
       kit, que carga cada pieza suelta.
       Con esto, lo que falta es el icono y nada más, y queda dicho en la
       consola para que se note en vez de pasar en silencio. */
    icono: function () {
      if (!raiz.__kitSinIconos) {
        raiz.__kitSinIconos = true;
        try { console.warn('[kit] falta kit/iconos.js: los botones saldrán sin icono'); } catch (e) {}
      }
      return '';
    },

    temaActual: temaActual, ponerTema: ponerTema, alternarTema: alternarTema,
    disparar: disparar, cuando: cuando,

    /* Cada pieza se registra aquí al cargarse: KIT.piezas.visor, etc. */
    piezas: {}
  };
}(window));
