/* ============================================================
   KIT-FLANDES · PIEZA 11 · BOTÓN INSIGHTS
   Un botón por vista que responde preguntas sobre lo que se está viendo.

   La lección de sec-hacienda y de la app de Jhonny
     La primera versión llamaba a Gemini para todo y se caía con HTTP 503
     en cuanto había demanda. La versión que funciona es al revés: los
     números se calculan AQUÍ, sin servidor ni IA, y la respuesta es
     inmediata. La IA, si algún día se enchufa, es un añadido.

   Dos reglas heredadas que se respetan
     · TRABAJA SOBRE LO QUE SE ESTÁ VIENDO. Si el usuario filtró por
       DEVUELTAS, el informe habla de las devueltas, no de las 1.131. Y se
       dice en el pie, para que nadie lea un número fuera de contexto.
     · NO ARRANCA SOLO. Se abre con "Iniciar": si se disparara al abrir la
       vista, gastaría y molestaría.

   Cómo se usa

     KIT.piezas.insights.montar({
       vista: 'Cuentas por revisar',
       filas: function () { return listaFiltradaAhora; },   // SIEMPRE lo de pantalla
       filtros: function () { return 'Estado: DEVUELTA'; },  // opcional, para el pie
       medidas: [
         { titulo: 'Cuentas', calcula: function (f) { return f.length; } },
         { titulo: 'Valor total', calcula: function (f) {
             return KIT.pesos(f.reduce(function (s, x) { return s + KIT.aNumero(x.valor); }, 0)); } },
         { titulo: 'Por supervisor', reparto: 'supervisor' }
       ],
       botones: [
         { texto: '¿Cuáles llevan más tiempo?', responde: function (f) { ... devuelve texto ... } }
       ]
     });

   El botón se puede arrastrar y recuerda dónde lo dejaron.

   Pareja: kit/insights.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/insights] falta kit.js'); } catch (e) {} return; }

  var fab = null;
  var cfg = {};

  /* ══════════════ el botón flotante ══════════════ */

  function montar(opciones) {
    cfg = opciones || {};

    if (!fab) {
      fab = K.nodo('<button type="button" class="kit-ins__fab" aria-label="Análisis de esta vista">' + K.icono('robot', 26) + '</button>');
      document.body.appendChild(fab);
      colocar();
      arrastrable();
      fab.addEventListener('click', function (e) {
        if (fab.__arrastro) { fab.__arrastro = false; return; }
        abrir();
      });
    }
    return fab;
  }

  function colocar() {
    var p = K.guardar.leer('insights.pos', null);
    if (!p) return;
    fab.style.left = p.x + 'px';
    fab.style.top = p.y + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }

  function arrastrable() {
    var bajo = false, movio = false, dx = 0, dy = 0;

    fab.addEventListener('pointerdown', function (e) {
      bajo = true; movio = false;
      var r = fab.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      fab.setPointerCapture(e.pointerId);
    });
    fab.addEventListener('pointermove', function (e) {
      if (!bajo) return;
      var x = e.clientX - dx, y = e.clientY - dy;
      if (!movio && Math.abs(x - fab.offsetLeft) + Math.abs(y - fab.offsetTop) < 6) return;
      movio = true;
      /* que no se salga de la pantalla ni se esconda bajo el banner */
      var w = fab.offsetWidth, h = fab.offsetHeight;
      var arriba = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--k-banner-alto'), 10) || 0;
      x = Math.min(Math.max(x, 6), window.innerWidth - w - 6);
      y = Math.min(Math.max(y, arriba + 6), window.innerHeight - h - 6);
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      fab.addEventListener(ev, function () {
        if (!bajo) return;
        bajo = false;
        if (movio) {
          fab.__arrastro = true;     /* que el click de después no abra el panel */
          K.guardar.escribir('insights.pos', { x: fab.offsetLeft, y: fab.offsetTop });
        }
      });
    });
  }

  /* ══════════════ el panel ══════════════ */

  function abrir() {
    var hoja = K.nodo(
      '<div class="kit-capa kit-ins kit-capa--on" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-ins__hoja">' +
      '    <header class="kit-capa__h">' +
      '      <span class="kit-ins__robot">' + K.icono('robot', 22) + '</span>' +
      '      <span class="kit-ins__t">' + K.esc(cfg.vista || 'Esta vista') + '</span>' +
      '      <button type="button" class="kit-capa__x">' + K.icono('cerrar', 18) + '</button>' +
      '    </header>' +
      '    <div class="kit-capa__cuerpo kit-ins__cuerpo">' +
      '      <div class="kit-ins__arranque">' +
      '        <p>Puedo resumir <b>lo que estás viendo ahora</b>, con los filtros que tengas puestos.</p>' +
      '        <button type="button" class="kit-btn kit-btn--marca kit-ins__iniciar">Iniciar</button>' +
      '      </div>' +
      '      <div class="kit-ins__salida kit-oculto"></div>' +
      '    </div>' +
      '    <footer class="kit-capa__pie kit-ins__pie kit-oculto">' +
      '      <button type="button" class="kit-btn kit-ins__voz kit-oculto">' +
             K.icono('altavoz', 16) + ' Escuchar</button>' +
      '      <button type="button" class="kit-btn kit-ins__copiar">' + K.icono('copiar', 16) + ' Copiar</button>' +
      '      <button type="button" class="kit-btn kit-ins__wa">' + K.icono('whatsapp', 16) + ' WhatsApp</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);

    function fuera() { hoja.remove(); }
    hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    hoja.querySelector('.kit-ins__iniciar').addEventListener('click', function () { correr(hoja); });
    return { cerrar: fuera };
  }

  function filasAhora() {
    try {
      var f = typeof cfg.filas === 'function' ? cfg.filas() : (cfg.filas || []);
      return Array.isArray(f) ? f : [];
    } catch (e) { return []; }
  }

  function correr(hoja) {
    var filas = filasAhora();
    hoja.querySelector('.kit-ins__arranque').classList.add('kit-oculto');
    var salida = hoja.querySelector('.kit-ins__salida');
    salida.classList.remove('kit-oculto');
    salida.innerHTML = '';

    if (!filas.length) {
      salida.innerHTML = '<p class="kit-ins__vacio">No hay nada en pantalla con los filtros de ahora. ' +
        'Quita algún filtro y vuelve a intentarlo.</p>';
      return;
    }

    var trozos = [];

    /* medidas */
    var tarjetas = document.createElement('div');
    tarjetas.className = 'kit-ins__medidas';
    (cfg.medidas || []).forEach(function (m) {
      if (m.reparto) {
        var rep = repartir(filas, m.reparto);
        var caja = K.nodo('<div class="kit-ins__reparto"><b>' + K.esc(m.titulo || m.reparto) + '</b><ul></ul></div>');
        var ul = caja.querySelector('ul');
        rep.slice(0, 8).forEach(function (r) {
          ul.appendChild(K.nodo('<li><span>' + K.esc(r.k || '(sin dato)') + '</span>' +
            '<i style="width:' + r.pct + '%"></i><b>' + K.numero(r.n) + '</b></li>'));
        });
        tarjetas.appendChild(caja);
        trozos.push((m.titulo || m.reparto) + ': ' + rep.slice(0, 5).map(function (r) {
          return (r.k || 'sin dato') + ' ' + r.n;
        }).join(', '));
        return;
      }
      var v;
      try { v = m.calcula(filas); } catch (e) { v = '—'; }
      tarjetas.appendChild(K.nodo('<div class="kit-ins__medida"><b>' + K.esc(String(v)) + '</b>' +
        '<span>' + K.esc(m.titulo || '') + '</span></div>'));
      trozos.push((m.titulo || '') + ': ' + v);
    });
    if (tarjetas.children.length) salida.appendChild(tarjetas);

    /* botones de pregunta */
    if ((cfg.botones || []).length) {
      var bs = document.createElement('div');
      bs.className = 'kit-ins__botones';
      cfg.botones.forEach(function (b) {
        var el = K.nodo('<button type="button" class="kit-pastilla">' + K.esc(b.texto) + '</button>');
        el.addEventListener('click', function () {
          var r;
          try { r = b.responde(filasAhora()); } catch (e) { r = 'No se pudo calcular.'; }
          escribiendo(salida, String(r || ''));
        });
        bs.appendChild(el);
      });
      salida.appendChild(bs);
    }

    /* de dónde salen los números: sin esto, el número engaña */
    var conFiltro = '';
    try { conFiltro = typeof cfg.filtros === 'function' ? cfg.filtros() : (cfg.filtros || ''); } catch (e) {}
    salida.appendChild(K.nodo('<p class="kit-ins__pie-nota">Calculado sobre <b>' + K.numero(filas.length) +
      '</b> ' + (filas.length === 1 ? 'registro' : 'registros') + ' de esta vista' +
      (conFiltro ? ' · ' + K.esc(conFiltro) : '') +
      '. Si cambias los filtros, cambia el resultado.</p>'));

    var pie = hoja.querySelector('.kit-ins__pie');
    pie.classList.remove('kit-oculto');
    var texto = (cfg.vista || 'Informe') + '\n' + trozos.join('\n') +
      '\n\n(' + filas.length + ' registros' + (conFiltro ? ' · ' + conFiltro : '') + ')';

    /* El botón de escuchar sale solo si el CORE dice que la voz está
       configurada: un botón que da error al tocarlo es peor que no tenerlo. */
    var bVoz = pie.querySelector('.kit-ins__voz');
    vozDisponible().then(function (vc) {
      if (!vc.configurada) return;
      bVoz.classList.remove('kit-oculto');
      bVoz.onclick = function () {
        if (Repro.suena()) { Repro.parar(); return; }
        /* Se lee el informe, no la pantalla: los trozos van al proveedor y
           por eso lo que se manda son las MEDIDAS, no las filas. */
        Repro.hablar(texto, bVoz);
      };
    });

    pie.querySelector('.kit-ins__copiar').onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function () { K.aviso('Copiado.', 'ok'); });
    };
    pie.querySelector('.kit-ins__wa').onclick = function () {
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    };
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

  /** El efecto de "escribiendo": el informe se lee, no aparece de golpe. */
  function escribiendo(donde, texto) {
    var vieja = donde.querySelector('.kit-ins__respuesta');
    if (vieja) vieja.remove();
    var p = K.nodo('<p class="kit-ins__respuesta"></p>');
    donde.appendChild(p);
    var i = 0;
    var reloj = setInterval(function () {
      i += 3;
      p.textContent = texto.slice(0, i);
      if (i >= texto.length) { clearInterval(reloj); p.textContent = texto; }
      donde.scrollTop = donde.scrollHeight;
    }, 16);
  }

  /* ══════════════ la voz ══════════════
     4.4 · EL AUDIO NO TIENE TOPE.
     En la Fase 11 de SEC-HACIENDA la voz existía pero cortaba: había un
     tope de 1.200 caracteres y los informes largos se leían a medias.
     Aquí el texto se trocea en frases de ~420 caracteres y se pide un
     trozo tras otro, encadenados: se lee completo por largo que sea. Lo
     que frena el gasto es la cuota por persona y por día del CORE, no la
     longitud.

     Tres cabos heredados de allá que se respetan:
       · Safari solo deja sonar audio si hubo un gesto antes, así que el
         <audio> se "desbloquea" con un WAV mudo dentro del propio clic.
       · El troceo se hace SIN lookbehind: Safari viejo lanza SyntaxError
         al cargar el archivo y eso tumbaría la pieza entera, no solo la voz.
       · Mientras suena un trozo se va pidiendo el siguiente, para que no
         se oiga el silencio entre uno y otro. */

  /* WAV mudo: deja el <audio> activado dentro del gesto del usuario. */
  var SILENCIO = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  var vozCfg = null, pidiendoVoz = null;

  function vozDisponible() {
    if (vozCfg) return Promise.resolve(vozCfg);
    if (pidiendoVoz) return pidiendoVoz;
    pidiendoVoz = K.pedir('vozEstado')
      .then(function (r) { vozCfg = r || { configurada: false }; return vozCfg; })
      ['catch'](function () { vozCfg = { configurada: false }; return vozCfg; });
    return pidiendoVoz;
  }

  var Repro = (function () {
    var audio = null, cola = [], i = 0, sig = null, activo = false, boton = null;

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

    /* Corta por final de frase. Sin lookbehind a propósito. */
    function frasear(t) {
      var out = [], act = '';
      for (var k = 0; k < t.length; k++) {
        var c = t.charAt(k);
        act += c;
        if ('.!?\u2026:;\n'.indexOf(c) >= 0) {
          while (k + 1 < t.length && /[\s"\u201d\u00bb)]/.test(t.charAt(k + 1))) { act += t.charAt(++k); }
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
        .replace(/^\s*[-*\u2022]\s+/gm, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!t) return [];
      var frases = frasear(t), out = [], act = '';
      for (var k = 0; k < frases.length; k++) {
        var f = frases[k].trim();
        if (!f) continue;
        /* 880 es el tope de UN trozo en el CORE; 420 es lo que suena bien. */
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

    function siguiente() {
      if (!activo) return;
      if (i >= cola.length) return parar();
      var p = sig || pedirTrozo(cola[i]);
      sig = null;
      p.then(function (src) {
        if (!activo) return;
        var a = el();
        a.src = src;
        var pl = a.play();
        if (pl && pl['catch']) pl['catch'](function () { parar(); });
        /* el siguiente se pide ya, mientras suena este */
        if (i + 1 < cola.length) sig = pedirTrozo(cola[i + 1])['catch'](function () { return null; });
        i++;
      })['catch'](function (e) {
        parar();
        K.aviso(e && e.message ? e.message : 'No se pudo generar la voz.', 'malo', 5000);
      });
    }

    function hablar(t, b) {
      parar();
      desbloquear();
      cola = trocear(t);
      if (!cola.length) return;
      i = 0; sig = null; activo = true; boton = b || null;
      var a = el();
      a.onended = function () { if (activo) siguiente(); };
      a.onerror = function () { parar(); };
      pintar();
      siguiente();
    }

    function parar() {
      activo = false; cola = []; i = 0; sig = null;
      try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) {}
      pintar();
      boton = null;
    }

    function pintar() {
      if (!boton) return;
      boton.innerHTML = activo
        ? (K.icono('parar', 16) + ' Parar')
        : (K.icono('altavoz', 16) + ' Escuchar');
    }

    return { hablar: hablar, parar: parar, suena: function () { return activo; }, trocear: trocear };
  }());

  K.piezas.insights = {
    montar: montar, abrir: abrir, repartir: repartir,
    voz: Repro,
    quitar: function () { if (fab) { fab.remove(); fab = null; } Repro.parar(); }
  };
}());
