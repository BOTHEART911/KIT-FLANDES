/* ============================================================
   KIT-FLANDES · PIEZA 11 · BOTÓN INSIGHTS
   Un botón en CADA vista que explica lo que se está viendo y dice qué
   hacer ahora.

   4.9 · LO QUE CAMBIA (pliego de Oss, 22/09)
     · SIN "Iniciar". Al tocar el robot, la guía y las preguntas salen
       de una vez. El "Iniciar" venía de la Fase 11 de SEC-HACIENDA, donde
       cada informe gastaba Gemini; aquí todo se calcula en el teléfono y
       no cuesta nada mostrarlo.
     · LA VOZ ARRANCA DE INMEDIATO. El mismo toque que abre el panel
       desbloquea el audio (Safari solo deja sonar dentro de un gesto) y
       empieza a leer la guía. Cada pregunta que se toca se lee también.
     · SIEMPRE HAY CÓMO CALLARLA. El botón de la cabecera pasa a
       "Detener" mientras suena, y cerrar el panel la corta.
     · CLIC SOSTENIDO PARA MOVERLO. Un toque corto abre; mantenerlo
       apretado medio segundo lo "despega" (vibra y crece) y ya se puede
       arrastrar. Antes se arrastraba con cualquier roce y al intentar
       hacer scroll encima se movía solo. La posición se recuerda.
     · Una sola pieza para todas las vistas: la app llama a montar()
       en cada vista con su guía, y el botón no se vuelve a crear.

   Las dos reglas heredadas que se mantienen
     · Los números se calculan AQUÍ, sin servidor ni IA (la lección del
       503 de Gemini en la app de Jhonny).
     · Si hay filas, se dice sobre cuántas y con qué filtro: un número
       fuera de contexto engaña.

   Cómo se usa
     KIT.piezas.insights.montar({
       vista: 'ESTADO DE CUENTA',
       guia: function () { return 'Tu cuenta 3 va en...'; },   // o texto
       filas: function () { return lista; },                    // opcional
       filtros: function () { return 'Estado: DEVUELTA'; },     // opcional
       medidas: [ { titulo: 'Cuentas', calcula: function (f) { return f.length; } } ],
       botones: [ { texto: '¿Qué hago ahora?', responde: function (f) { return '...'; } } ],
       alto: true      // la vista tiene un botón fijo abajo: el robot sube
     });

   Pareja: kit/insights.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/insights] falta kit.js'); } catch (e) {} return; }

  var fab = null;
  var cfg = {};
  var abierto = null;            /* el panel, si está abierto */
  var SOSTENER_MS = 450;         /* cuánto hay que mantener para moverlo */
  var TEMBLOR = 10;              /* px que se toleran sin que cuente como scroll */

  /* ══════════════ el botón flotante ══════════════ */

  function montar(opciones) {
    cfg = opciones || {};
    if (!fab) {
      fab = K.nodo('<button type="button" class="kit-ins__fab" aria-label="Ayuda de esta vista">' +
        K.icono('robot', 26) + '</button>');
      document.body.appendChild(fab);
      colocar();
      gestos();
    }
    fab.hidden = false;
    fab.classList.toggle('kit-ins__fab--alto', !!cfg.alto);
    fab.setAttribute('aria-label', 'Ayuda: ' + (cfg.vista || 'esta vista'));
    /* la voz se consulta una vez por sesión y ANTES del primer toque, para
       que el botón de escuchar ya sepa si sale cuando se abra el panel */
    vozDisponible();
    if (abierto) abierto.cerrar();
    return fab;
  }

  function colocar() {
    var p = K.guardar.leer('insights.pos', null);
    if (!p || typeof p.x !== 'number') return;
    /* una posición guardada en otra pantalla (girar el teléfono, PC)
       puede quedar fuera: se mete dentro */
    var x = Math.min(Math.max(p.x, 6), window.innerWidth - 60);
    var y = Math.min(Math.max(p.y, 6), window.innerHeight - 60);
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    fab.classList.add('kit-ins__fab--puesto');
  }

  function gestos() {
    var reloj = null, moviendo = false, anulado = false, abajo = false;
    var x0 = 0, y0 = 0, dx = 0, dy = 0, tragarClick = false;

    fab.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      abajo = true; moviendo = false; anulado = false;
      x0 = e.clientX; y0 = e.clientY;
      var r = fab.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      try { fab.setPointerCapture(e.pointerId); } catch (x) {}
      clearTimeout(reloj);
      reloj = setTimeout(function () {
        if (!abajo || anulado) return;
        moviendo = true;
        fab.classList.add('kit-ins__fab--mueve');
        K.vibrar(18);
      }, SOSTENER_MS);
    });

    fab.addEventListener('pointermove', function (e) {
      if (!abajo) return;
      if (!moviendo) {
        /* se movió antes de tiempo: era un scroll o un roce, no un toque */
        if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > TEMBLOR) { anulado = true; clearTimeout(reloj); }
        return;
      }
      e.preventDefault();
      var w = fab.offsetWidth, h = fab.offsetHeight;
      var arriba = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--k-banner-alto'), 10) || 0;
      var x = Math.min(Math.max(e.clientX - dx, 6), window.innerWidth - w - 6);
      var y = Math.min(Math.max(e.clientY - dy, arriba + 6), window.innerHeight - h - 6);
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    });

    function soltar() {
      if (!abajo) return;
      abajo = false;
      clearTimeout(reloj);
      if (moviendo) {
        moviendo = false;
        tragarClick = true;
        fab.classList.remove('kit-ins__fab--mueve');
        fab.classList.add('kit-ins__fab--puesto');
        K.guardar.escribir('insights.pos', { x: fab.offsetLeft, y: fab.offsetTop });
      } else if (anulado) {
        tragarClick = true;
      }
    }
    fab.addEventListener('pointerup', soltar);
    fab.addEventListener('pointercancel', function () { soltar(); tragarClick = true; });
    fab.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    fab.addEventListener('click', function (e) {
      if (tragarClick) { tragarClick = false; e.preventDefault(); return; }
      abrir();
    });
  }

  /* ══════════════ el panel ══════════════ */

  function texto(v) {
    try { return String(typeof v === 'function' ? v(filasAhora()) : (v || '')); } catch (e) { return ''; }
  }

  /** **negrita** y saltos de línea; todo lo demás escapado. */
  function rico(t) {
    return K.esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  function abrir() {
    if (abierto) abierto.cerrar();
    /* PRIMERO, dentro del toque: sin esto Safari no deja sonar después */
    Repro.desbloquear();

    var hoja = K.nodo(
      '<div class="kit-capa kit-ins" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-ins__hoja">' +
      '    <header class="kit-capa__h">' +
      '      <span class="kit-ins__robot">' + K.icono('robot', 22) + '</span>' +
      '      <span class="kit-ins__t">' + K.esc(cfg.vista || 'Esta vista') + '</span>' +
      '      <button type="button" class="kit-ins__voz" hidden></button>' +
      '      <button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
      '    </header>' +
      '    <div class="kit-capa__cuerpo kit-ins__cuerpo"></div>' +
      '    <footer class="kit-capa__pie kit-ins__pie">' +
      '      <button type="button" class="kit-btn kit-ins__copiar">' + K.icono('copiar', 16) + ' Copiar</button>' +
      '      <button type="button" class="kit-btn kit-ins__wa">' + K.icono('whatsapp', 16) + ' WhatsApp</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('kit-capa--on'); });

    var cuerpo = hoja.querySelector('.kit-ins__cuerpo');
    var bVoz = hoja.querySelector('.kit-ins__voz');
    var ultimoTexto = '';

    function cerrar() {
      Repro.parar();
      hoja.classList.remove('kit-capa--on');
      setTimeout(function () { if (hoja.parentNode) hoja.remove(); }, 200);
      if (abierto && abierto.hoja === hoja) abierto = null;
    }
    hoja.querySelector('.kit-capa__x').addEventListener('click', cerrar);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', cerrar);
    abierto = { cerrar: cerrar, hoja: hoja };

    /* ---- la guía: lo que hay que hacer ahora ---- */
    var guia = texto(cfg.guia);
    if (guia) {
      cuerpo.appendChild(K.nodo('<div class="kit-ins__guia"><span class="kit-ins__guia-ico">' +
        K.icono('bombilla', 18) + '</span><p>' + rico(guia) + '</p></div>'));
    }

    /* ---- las medidas, si la vista tiene filas ---- */
    var filas = filasAhora();
    var trozos = [];
    if ((cfg.medidas || []).length) {
      if (!filas.length && typeof cfg.filas === 'function') {
        cuerpo.appendChild(K.nodo('<p class="kit-ins__vacio">No hay nada en pantalla con los filtros de ahora.</p>'));
      } else {
        var tarjetas = document.createElement('div');
        tarjetas.className = 'kit-ins__medidas';
        cfg.medidas.forEach(function (m) {
          if (m.reparto) {
            var rep = repartir(filas, m.reparto);
            var caja = K.nodo('<div class="kit-ins__reparto"><b>' + K.esc(m.titulo || m.reparto) + '</b><ul></ul></div>');
            var ul = caja.querySelector('ul');
            rep.slice(0, 8).forEach(function (r) {
              ul.appendChild(K.nodo('<li><span>' + K.esc(r.k || '(sin dato)') + '</span>' +
                '<i style="width:' + r.pct + '%"></i><b>' + K.numero(r.n) + '</b></li>'));
            });
            tarjetas.appendChild(caja);
            trozos.push((m.titulo || m.reparto) + ': ' + rep.slice(0, 5).map(function (r) { return (r.k || 'sin dato') + ' ' + r.n; }).join(', '));
            return;
          }
          var v;
          try { v = m.calcula(filas); } catch (e) { v = '—'; }
          if (v === null || v === undefined || v === '') return;
          tarjetas.appendChild(K.nodo('<div class="kit-ins__medida"><b>' + K.esc(String(v)) + '</b>' +
            '<span>' + K.esc(m.titulo || '') + '</span></div>'));
          trozos.push((m.titulo || '') + ': ' + v);
        });
        if (tarjetas.children.length) cuerpo.appendChild(tarjetas);
      }
    }

    /* ---- las preguntas: directas, sin "Iniciar" ---- */
    var salida = K.nodo('<div class="kit-ins__salida"></div>');
    if ((cfg.botones || []).length) {
      var bs = K.nodo('<div class="kit-ins__botones" role="group" aria-label="Preguntas rápidas"></div>');
      cfg.botones.forEach(function (b) {
        var el = K.nodo('<button type="button" class="kit-pastilla kit-ins__preg">' + K.esc(b.texto) + '</button>');
        el.addEventListener('click', function () {
          Repro.desbloquear();
          var r;
          try { r = b.responde(filasAhora()); } catch (e) { r = 'No se pudo calcular.'; }
          r = String(r || '');
          bs.querySelectorAll('.kit-ins__preg--on').forEach(function (x) { x.classList.remove('kit-ins__preg--on'); });
          el.classList.add('kit-ins__preg--on');
          escribiendo(salida, r);
          ultimoTexto = b.texto + '\n' + r;
          hablar(r);
        });
        bs.appendChild(el);
      });
      cuerpo.appendChild(bs);
    }
    cuerpo.appendChild(salida);

    if (typeof cfg.filas === 'function' && filas.length && (cfg.medidas || []).length) {
      var conFiltro = texto(cfg.filtros);
      cuerpo.appendChild(K.nodo('<p class="kit-ins__pie-nota">Calculado sobre <b>' + K.numero(filas.length) +
        '</b> ' + (filas.length === 1 ? 'registro' : 'registros') + ' de esta vista' +
        (conFiltro ? ' · ' + K.esc(conFiltro) : '') + '. Si cambias los filtros, cambia el resultado.</p>'));
    }

    var informe = (cfg.vista || 'Ayuda') + '\n' + guia + (trozos.length ? '\n\n' + trozos.join('\n') : '');

    /* ---- la voz ---- */
    function pintarVoz() {
      var suena = Repro.suena();
      bVoz.innerHTML = K.icono(suena ? 'parar' : 'altavoz', 16) + '<span>' + (suena ? 'Detener' : 'Escuchar') + '</span>';
      bVoz.setAttribute('aria-label', suena ? 'Detener la voz' : 'Escuchar');
      bVoz.classList.toggle('kit-ins__voz--on', suena);
    }
    function hablar(t) {
      vozDisponible().then(function (vc) {
        if (!vc.configurada || !document.body.contains(hoja)) return;
        Repro.hablar(t, pintarVoz);
      });
    }
    Repro.alCambiar(pintarVoz);
    bVoz.addEventListener('click', function () {
      if (Repro.suena()) { Repro.parar(); return; }
      Repro.desbloquear();
      Repro.hablar(ultimoTexto || guia || informe, pintarVoz);
    });
    vozDisponible().then(function (vc) {
      if (!vc.configurada || !document.body.contains(hoja)) return;
      bVoz.hidden = false;
      pintarVoz();
    });
    /* EL AUDIO ARRANCA SOLO, con la guía (o el resumen si no hay guía) */
    if (guia || trozos.length) hablar(guia || informe);

    hoja.querySelector('.kit-ins__copiar').onclick = function () {
      var t = ultimoTexto ? informe + '\n\n' + ultimoTexto : informe;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { K.aviso('Copiado.', 'ok'); });
    };
    hoja.querySelector('.kit-ins__wa').onclick = function () {
      var t = ultimoTexto ? informe + '\n\n' + ultimoTexto : informe;
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
    };

    return abierto;
  }

  function filasAhora() {
    try {
      var f = typeof cfg.filas === 'function' ? cfg.filas() : (cfg.filas || []);
      return Array.isArray(f) ? f : [];
    } catch (e) { return []; }
  }

  function repartir(filas, campo) {
    var m = {}, i, v, total = filas.length;
    for (i = 0; i < filas.length; i++) {
      v = typeof campo === 'function' ? campo(filas[i]) : filas[i][campo];
      v = String(v === null || v === undefined ? '' : v).trim();
      m[v] = (m[v] || 0) + 1;
    }
    return Object.keys(m).map(function (k) {
      return { k: k, n: m[k], pct: total ? Math.round(m[k] * 100 / total) : 0 };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  /** El efecto de "escribiendo": la respuesta se lee, no aparece de golpe. */
  function escribiendo(donde, t) {
    var vieja = donde.querySelector('.kit-ins__respuesta');
    if (vieja) { clearInterval(vieja.__reloj); vieja.remove(); }
    var p = K.nodo('<p class="kit-ins__respuesta" aria-live="polite"></p>');
    donde.appendChild(p);
    var i = 0;
    p.__reloj = setInterval(function () {
      i += 3;
      p.innerHTML = rico(t.slice(0, i));
      if (i >= t.length) { clearInterval(p.__reloj); p.innerHTML = rico(t); }
    }, 16);
    try { p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  /* ══════════════ la voz ══════════════
     4.4 · EL AUDIO NO TIENE TOPE: se trocea en frases de ~420 caracteres
     y se piden encadenadas. Lo que frena el gasto es la cuota por persona
     y por día del CORE, no la longitud.
     Cabos de SEC-HACIENDA que se respetan:
       · Safari solo deja sonar audio tras un gesto: el <audio> se
         desbloquea con un WAV mudo DENTRO del toque.
       · El troceo va SIN lookbehind (Safari viejo tumbaría el archivo).
       · Mientras suena un trozo se pide el siguiente. */

  var SILENCIO = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  var vozCfg = null, pidiendoVoz = null;

  function vozDisponible() {
    if (vozCfg) return Promise.resolve(vozCfg);
    /* F11 · la página de demostración del kit (app KIT) no tiene voz en el
       CORE: preguntarle dejaba un error en FC_ERRORES cada vez que alguien
       la abría. Sin viaje: la demo va sin voz. */
    if (String(K.app || '').toUpperCase() === 'KIT') return Promise.resolve(vozCfg = { configurada: false });
    if (pidiendoVoz) return pidiendoVoz;
    pidiendoVoz = K.pedir('vozEstado')
      .then(function (r) { vozCfg = r || { configurada: false }; return vozCfg; })
      ['catch'](function () { pidiendoVoz = null; return { configurada: false }; });
    return pidiendoVoz;
  }

  var Repro = (function () {
    var audio = null, cola = [], i = 0, sig = null, activo = false, avisa = null, turno = 0;

    function el() {
      if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('playsinline', '');
        audio.preload = 'auto';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      return audio;
    }

    function desbloquear() {
      var a = el();
      try {
        if (!a.dataset.libre) {
          a.src = SILENCIO;
          var p = a.play();
          if (p && p.then) p.then(function () { a.dataset.libre = '1'; })['catch'](function () {});
          else a.dataset.libre = '1';
        }
      } catch (e) {}
    }

    function frasear(t) {
      var out = [], act = '';
      for (var k = 0; k < t.length; k++) {
        var c = t.charAt(k);
        act += c;
        if ('.!?…:;\n'.indexOf(c) >= 0) {
          while (k + 1 < t.length && /[\s"”»)]/.test(t.charAt(k + 1))) { act += t.charAt(++k); }
          out.push(act); act = '';
        }
      }
      if (act.trim()) out.push(act);
      return out.length ? out : [t];
    }

    function trocear(txt) {
      var t = String(txt || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!t) return [];
      var frases = frasear(t), out = [], act = '';
      for (var k = 0; k < frases.length; k++) {
        var f = frases[k].trim();
        if (!f) continue;
        while (f.length > 880) { out.push(f.slice(0, 880)); f = f.slice(880); }
        if ((act + ' ' + f).trim().length > 420 && act) { out.push(act.trim()); act = f; }
        else { act = (act ? act + ' ' : '') + f; }
      }
      if (act.trim()) out.push(act.trim());
      return out;
    }

    function pedirTrozo(t) {
      return K.pedir('vozHablar', { texto: t }).then(function (r) {
        if (!r || !r.base64) throw new Error('No se pudo generar la voz.');
        return 'data:' + (r.mime || 'audio/mpeg') + ';base64,' + r.base64;
      });
    }

    function siguiente(miTurno) {
      if (!activo || miTurno !== turno) return;
      if (i >= cola.length) return parar();
      var p = sig || pedirTrozo(cola[i]);
      sig = null;
      p.then(function (src) {
        if (!activo || miTurno !== turno || !src) return;
        var a = el();
        a.src = src;
        var pl = a.play();
        if (pl && pl['catch']) pl['catch'](function () { parar(); });
        if (i + 1 < cola.length) sig = pedirTrozo(cola[i + 1])['catch'](function () { return null; });
        i++;
      })['catch'](function (e) {
        if (miTurno !== turno) return;
        parar();
        K.aviso(e && e.message ? e.message : 'No se pudo generar la voz.', 'malo', 5000);
      });
    }

    /** Empieza a leer. Lo que estuviera sonando se corta. */
    function hablar(t, alCambiar) {
      parar();
      cola = trocear(t);
      if (!cola.length) return;
      if (alCambiar) avisa = alCambiar;
      turno++;
      var miTurno = turno;
      i = 0; sig = null; activo = true;
      var a = el();
      a.onended = function () { if (activo && miTurno === turno) siguiente(miTurno); };
      a.onerror = function () { if (a.src && a.src.indexOf('data:audio/wav') !== 0) parar(); };
      contar();
      siguiente(miTurno);
    }

    function parar() {
      var estaba = activo;
      activo = false; cola = []; i = 0; sig = null; turno++;
      try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) {}
      if (estaba) contar();
    }

    function contar() { if (avisa) { try { avisa(activo); } catch (e) {} } }

    return {
      hablar: hablar, parar: parar, desbloquear: desbloquear,
      suena: function () { return activo; }, trocear: trocear,
      alCambiar: function (fn) { avisa = fn; }
    };
  }());

  K.piezas.insights = {
    montar: montar, abrir: abrir, repartir: repartir,
    voz: Repro,
    configuracion: function () { return cfg; },
    ocultar: function () { if (fab) fab.hidden = true; if (abierto) abierto.cerrar(); },
    quitar: function () { if (abierto) abierto.cerrar(); if (fab) { fab.remove(); fab = null; } Repro.parar(); }
  };
}());
