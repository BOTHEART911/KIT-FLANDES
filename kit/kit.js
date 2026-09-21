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
          throw problema('RESPUESTA_NO_JSON',
            'El servidor respondió algo que no es JSON. Suele ser el despliegue mal publicado.');
        }
        if (j && j.ok) return j.data;
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
    pesos: pesos, numero: numero, aNumero: aNumero, fecha: fecha,
    aviso: aviso,

    temaActual: temaActual, ponerTema: ponerTema, alternarTema: alternarTema,
    disparar: disparar, cuando: cuando,

    /* Cada pieza se registra aquí al cargarse: KIT.piezas.visor, etc. */
    piezas: {}
  };
}(window));
