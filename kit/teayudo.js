/* ============================================================
   KIT-FLANDES · PIEZA 36 · «TE AYUDO A REDACTAR» (02/11/2026)

   Qué hace
     Dentro de cada obligación del borrador, cuando algún bombillo está en
     rojo, sale el botón «Te ayudo». Al tocarlo:
       1. PISTAS al instante, en el teléfono y sin viajes: qué le falta a
          SU texto, con las mismas reglas de los bombillos (kit/variacion.js
          y el motor de kit/informe-cuentas.js) y ejemplos según el tema de
          la obligación («listados de asistencia», «[número] estudiantes»…).
       2. VERSIÓN MEJORADA de su propio texto, de fondo, con Gemini
          (kit/gemini.js · mejorar) y tope de 8 s. Si no llega, quedan las
          pistas. Nunca inventa cifras, nombres, fechas ni entregables: lo
          que falte va entre [corchetes]; un corchete sin llenar deja su
          bombillo en rojo (lo hace el motor).
          Guarda en el teléfono: toda cifra, mes o nombre propio que no esté
          en su texto se cambia por [número]/[fecha]/[nombre], y todo
          bombillo que la versión encienda sin que él lo haya escrito queda
          encerrado entre corchetes para que lo confirme.
       3. «Usar esta versión» la pega en el campo (para editarla) y
          «No, gracias» la descarta. Nada se guarda solo: queda como si él
          la hubiera escrito, con su respaldo local de siempre.
       4. MEDICIÓN: toques, versiones mostradas/usadas/descartadas y
          bombillos que pasan a verde después de un toque. Se encolan en el
          teléfono y salen en UN viaje de fondo con su rid
          (ruta teAyudoRegistrar → hoja MEDICION).

   Revisores (SUPERVISIÓN y CONTRATACIÓN)
     K.piezas.teayudo.pistas(R, obl, texto) devuelve las mismas pistas,
     para que el revisor vea qué ayuda recibió el contratista.

   Cómo se usa (borrador)
     var ta = K.piezas.teayudo.crear({
       app: 'CONTRATISTA', n: 3, obligacion: '…', informe: 7,
       area: <textarea>, medir: function (texto) { return R },
       alUsar: function (texto) { … }   // pegar en el campo
     });
     caja.appendChild(ta.nodo);  ...  ta.actualizar(R) en cada medida.
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  var COLA_K = 'teayudo.cola', ENVIO_K = 'teayudo.envio';
  /* 03/11 · medido en vivo: Gemini contesta en 0,7–3,6 s en caliente, pero con picos de 10–16 s
     (cola del plan gratuito). Las pistas ya están en pantalla, así que esperar más no frena a nadie. */
  var TOPE_MS = 15000;
  var CALIENTE = false;   /* el SDK y App Check se piden una vez, cuando aparece el botón */

  /* ══════════════ el tema de la obligación (para los ejemplos) ══════════════ */
  function st(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  var TEMAS = [
    { re: /deport|recreac|torneo|actividad fisica|escuela de formacion|entrenamiento|juegos/, ent: ['listados de asistencia', 'registro fotográfico'], cu: 'participantes', qu: '[grupo o comunidad]' },
    { re: /capacit|taller|socializ|charla|jornada|sensibiliz|formacion/, ent: ['listado de asistencia', 'acta de la jornada'], cu: 'asistentes', qu: '[comunidad o dependencia]' },
    { re: /visita|inspecc|recorrido|verificac/, ent: ['acta de visita', 'registro fotográfico'], cu: 'visitas', qu: '[predio, sector o comunidad]' },
    /* 03/11 · software y sistemas: antes caía en «atención» por la palabra «usuarios» */
    { re: /aplicacion|software|plataforma|sistema de informacion|desarrollo web|pagina web|chat ?bot|soporte tecnico|incidencia|codigo fuente|servidor/, ent: ['reporte de incidencias resueltas', 'versión publicada'], cu: 'incidencias o ajustes', qu: '[dependencia o usuarios]' },
    { re: /peticion|pqr|oficio|respuesta|correspondencia|radic|tutela/, ent: ['oficios radicados', 'respuestas enviadas'], cu: 'oficios o respuestas', qu: '[dependencia o peticionario]' },
    { re: /publicac|redes sociales|prensa|comunicac|pieza|video|difusion|contenido/, ent: ['piezas publicadas', 'enlaces de las publicaciones'], cu: 'publicaciones', qu: '[dependencia o público]' },
    { re: /atenc|usuario|ventanilla|orientac|asesor/, ent: ['registro de atenciones', 'planilla de usuarios atendidos'], cu: 'personas atendidas', qu: '[usuarios o dependencia]' },
    { re: /vacun|tamizaj|salud|promocion|prevencion/, ent: ['listado de personas atendidas', 'registro fotográfico'], cu: 'personas atendidas', qu: '[población o comunidad]' },
    { re: /agro|cultivo|productor|finca|ganad|pecuari/, ent: ['acta de visita', 'listado de productores'], cu: 'productores', qu: '[productores o vereda]' },
    { re: /base de datos|digitaliz|archivo|expediente|sistematiz|inventario/, ent: ['base de datos actualizada', 'expedientes organizados'], cu: 'registros o expedientes', qu: '[dependencia]' },
    { re: /contrat|precontract|estudio previo|minuta|secop/, ent: ['documentos publicados en SECOP', 'estudios previos'], cu: 'procesos', qu: '[dependencia]' }
  ];
  var BASE = { ent: ['informe', 'acta', 'listado'], cu: 'actividades, documentos o personas', qu: '[dependencia, comunidad o entidad]' };

  function tema(obl, texto) {
    var a = st(texto), b = st(obl), x = null;
    TEMAS.some(function (T) { if (T.re.test(a)) { x = T; return true; } return false; });
    if (!x) TEMAS.some(function (T) { if (T.re.test(b)) { x = T; return true; } return false; });
    x = x || BASE;
    var out = { ent: x.ent, cu: x.cu, qu: x.qu };
    /* instituciones educativas: el grupo son estudiantes */
    if (/educativ|colegio|escuela|estudiant|alumn|sede/.test(a + ' ' + b)) { out.cu = 'estudiantes'; out.qu = '[nombre de la institución educativa]'; }
    return out;
  }

  /* ══════════════ 1 · las pistas (locales, al instante) ══════════════ */
  /**
   * Lo que le falta a la actividad, en lenguaje simple.
   * -> [{k, e, txt, ej}]  (ej = el ejemplo con [corchetes], si aplica)
   */
  function pistas(R, obl, texto) {
    var out = [];
    if (!R || !R.b || R.estado === 'general' || R.estado === 'noreq') return out;
    if (R.estado === 'vacia') return [{ k: -1, e: 'rojo', txt: 'Escribe primero lo que hiciste en este periodo; luego te digo qué le falta.' }];
    var T = tema(obl, texto);
    R.b.forEach(function (b) {
      if (b.e !== 'rojo' && b.e !== 'amarillo') return;
      if (b.corchete) { out.push({ k: b.k, e: 'rojo', txt: 'Llena lo que está entre corchetes: ' + b.corchete.map(function (x) { return '[' + x + ']'; }).join(', ') + '. Mientras siga entre corchetes, este bombillo queda en rojo.' }); return; }
      switch (b.k) {
        case 0: out.push({ k: 0, e: b.e, txt: 'Se parece a tu cuenta ' + (R.con || R.plCon || R.ordenCon || 'anterior') + '. Cuenta qué fue distinto en este periodo: otro lugar, otro grupo, otro resultado. Eso solo lo sabes tú.' }); break;
        case 1: out.push({ k: 1, e: b.e, txt: 'Falta CUÁNTOS: pon la cifra junto a lo que contaste.', ej: '[número] ' + T.cu }); break;
        case 2: out.push({ k: 2, e: b.e, txt: 'Falta PARA QUIÉN o CON QUIÉN lo hiciste.', ej: 'con ' + T.qu }); break;
        case 3: out.push({ k: 3, e: b.e, txt: 'Falta QUÉ QUEDÓ: nombra lo que lo demuestra, por ejemplo ' + T.ent.map(function (x) { return '«' + x + '»'; }).join(' o ') + '.', ej: '[' + T.ent.join(' o ') + ']' }); break;
        case 4:
          if (b.e === 'amarillo') out.push({ k: 4, e: b.e, txt: 'Revisa la fecha' + (b.x ? ' «' + b.x + '»' : '') + ': cae fuera del periodo de esta cuenta.' });
          else out.push({ k: 4, e: b.e, txt: 'Falta CUÁNDO: escribe las fechas o la semana del periodo.', ej: 'el [fecha]' });
          break;
        default:
          if (b.como === 'diceAdjunta') out.push({ k: 5, e: b.e, txt: 'Tu texto dice que adjuntas un soporte, pero esta obligación no tiene nada cargado: súbelo abajo, en evidencias o archivo.' });
          else if (b.como === 'donde') out.push({ k: 5, e: b.e, txt: 'Dices dónde verificarlo. Para el verde: sube el soporte aquí o, si no aplica, escribe «no requiere adjunto».' });
          else if (b.como === 'oblSinProducto') out.push({ k: 5, e: b.e, txt: 'Si esta actividad no deja documento, escribe «no requiere adjunto»; si lo deja, súbelo abajo.' });
          else out.push({ k: 5, e: b.e, txt: 'Sube abajo las evidencias que lo demuestran (' + T.ent.join(', ') + ') o, si no aplica, escribe «no requiere adjunto».' });
      }
    });
    return out;
  }

  /** Lo que se le pide a Gemini: solo lo que se arregla con el texto (cuántos, para quién, qué quedó, cuándo). */
  function faltanParaIA(R, obl, texto) {
    var T = tema(obl, texto), f = [];
    R.b.forEach(function (b) {
      if (b.e !== 'rojo' || b.corchete) return;
      if (b.k === 1) f.push('Cuántos (cifra con lo que se contó): usa «[número] ' + T.cu + '»');
      if (b.k === 2) f.push('Para quién o con quién: usa «' + T.qu + '» si él no lo dijo');
      if (b.k === 3) f.push('Qué quedó como entregable verificable: usa «[' + T.ent.join(' o ') + ']»');
      if (b.k === 4) f.push('Cuándo: usa «el [fecha]» si él no escribió fechas');
    });
    return f;
  }
  /** 03/11 · versión mejorada sin IA: su texto tal cual + una frase con [corchete] por cada bombillo en rojo. */
  function versionLocal(R, obl, texto) {
    var T = tema(obl, texto), t = String(texto || '').trim().replace(/\s+$/, '');
    if (t && !/[.!?…]$/.test(t)) t += '.';
    var rojo = {}; (R && R.b || []).forEach(function (b) { if (b.e === 'rojo' && !b.corchete) rojo[b.k] = 1; });
    var mas = [];
    if (rojo[4]) mas.push('Lo realicé el [fecha].');
    if (rojo[1]) mas.push('En total fueron [número] ' + T.cu + '.');
    if (rojo[2]) mas.push('Se benefició ' + (/^\[/.test(T.qu) ? T.qu : '[' + T.qu + ']') + '.');
    if (rojo[3]) mas.push('Como resultado quedó [' + T.ent.join(' o ') + '].');
    return mas.length ? (t + ' ' + mas.join(' ')).trim() : t;
  }
  function ayudaIA(R) { return !!(R && R.b && R.b.some(function (b) { return b.k >= 1 && b.k <= 4 && b.e === 'rojo' && !b.corchete; })); }
  function hayRojo(R) { return !!(R && R.b && R.estado !== 'general' && R.estado !== 'noreq' && R.estado !== 'vacia' && R.b.some(function (b) { return b.e === 'rojo'; })); }

  /* ══════════════ 2 · la guarda: nada inventado sin corchetes ══════════════ */
  var MESES = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)$/;

  /** Recorre el texto FUERA de los corchetes: fn(tramo) -> tramo nuevo. */
  function fueraDeCorchetes(t, fn) {
    return String(t).split(/(\[[^\[\]\n]{1,80}\])/).map(function (p, i) { return i % 2 ? p : fn(p); }).join('');
  }

  /** ¿Hay ya un [hueco] que pertenezca al bombillo k? */
  function corchK(t, k) {
    var I = K.piezas.informeCuentas, f = I && I._estr && I._estr.kDeCorchete;
    return (String(t).match(/\[[^\[\]\n]{1,80}\]/g) || []).some(function (m) { return f ? f(m.slice(1, -1)) === k : k === 3; });
  }

  /**
   * proteger(original, propuesta, obl, medir) -> {texto, R}
   * medir(texto) -> R del motor (con el mismo contexto que el borrador).
   */
  function guardar_(orig, prop, obl, medir) {
    var O = st(orig), OB = st(obl);
    var nums = {}; (String(orig).match(/\d+/g) || []).forEach(function (n) { nums[n.replace(/^0+(?=\d)/, '')] = 1; });
    var t = String(prop || '').replace(/\s+/g, ' ').trim();
    /* cifras que él no escribió */
    t = fueraDeCorchetes(t, function (p) {
      return p.replace(/\d+(?:[.,]\d+)*/g, function (m) {
        var ok = (m.match(/\d+/g) || []).every(function (n) { return nums[n.replace(/^0+(?=\d)/, '')]; });
        return ok ? m : '[número]';
      });
    });
    /* meses que él no escribió (se comparan por número: «sep» = «septiembre»), con su día si lo trae */
    var MES_N = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
    function mesDe(w) { w = st(w); return MESES.test(w) ? MES_N[w.slice(0, 3)] : 0; }
    var mesesOrig = {}; (String(orig).match(/[A-Za-zÁÉÍÓÚáéíóú]+/g) || []).forEach(function (w) { var n = mesDe(w); if (n && !((st(w) === 'mar' || st(w) === 'may'))) mesesOrig[n] = 1; });
    (String(orig).match(/\d{1,2}\s+(?:de\s+)?(?:mar|may)\b/gi) || []).forEach(function (x) { mesesOrig[/mar/i.test(x) ? 3 : 5] = 1; });
    t = fueraDeCorchetes(t, function (p) {
      return p.replace(/((?:\d{1,2}|\[número\])\s+(?:de\s+)?)?([A-Za-zÁÉÍÓÚáéíóú]+)((?:\s+de)?\s+(?:\d{4}|\[número\]))?/g, function (m, a, mes, c) {
        var w = st(mes), n = mesDe(mes);
        if (!n || mesesOrig[n]) return m;
        if ((w === 'mar' || w === 'may') && !a) return m;   /* «mar» y «may» solo cuentan como mes con el día delante */
        return '[fecha]';
      });
    });
    /* nombres propios que no están en su texto ni en la obligación (salvo el inicio de frase) */
    t = fueraDeCorchetes(t, function (p) {
      return p.replace(/([^.!?:\s\[]\s+)((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)(?:\s+(?:de|del|la|las|los|y)?\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)*)/g, function (m, a, nom) {
        var falta = nom.split(/\s+/).some(function (w) { var x = st(w); return x.length > 2 && !/^(de|del|la|las|los)$/.test(x) && O.indexOf(x) < 0 && OB.indexOf(x) < 0; });
        return falta ? a + '[nombre]' : m;
      });
    });
    t = t.replace(/\[(número|fecha|nombre)\](\s*\[\1\])+/g, '[$1]');
    /* 03/11 · «el [número] de [fecha]» (día y mes inventados) es UNA fecha; y sin espacio antes del punto */
    t = t.replace(/\[número\]\s+de\s+\[fecha\]/g, '[fecha]').replace(/\s+([.,;:])/g, '$1');
    /* lo que la versión enciende y él no escribió: entre corchetes, para que lo confirme */
    var R0 = medir(orig), envueltos = 0;
    for (var vuelta = 0; vuelta < 6; vuelta++) {
      /* los huecos ya puestos no deben tapar lo demás: se miden neutros (sin el rojo forzado) */
      var R1 = medir(t.replace(/\[[^\[\]\n]{1,80}\]/g, function (m) { return new Array(m.length + 1).join('_'); })), cambios = [];
      for (var k = 1; k <= 5; k++) {
        var a0 = R0.b[k], a1 = R1.b[k];
        if (!a0 || !a1 || a0.e === 'verde' || a1.e !== 'verde' || !a1.r || !a1.r.length) continue;
        if (k === 5 && a1.como === 'cargado') continue;
        var r = a1.r[0].slice(), frag = t.slice(r[0], r[1]);
        if (!frag.trim() || /[\[\]]/.test(frag) || O.indexOf(st(frag)) >= 0) continue;
        /* el verbo de resultado («quedaron», «se entregó») sobra si ya hay un hueco para el entregable */
        if (k === 3 && /^Resultado/.test(a1.d) && corchK(t, 3)) continue;
        /* «registro fotográfico»: el sustantivo con su adjetivo */
        var sig = /^\s+([a-záéíóúñü]{4,})/.exec(t.slice(r[1]));
        if (sig && /(ico|ica|icos|icas|al|ales|ivo|iva|ivos|ivas|ado|ada|ados|adas|oso|osa|ivo)$/.test(st(sig[1]))) r[1] += sig[0].length;
        cambios.push(r);
      }
      if (!cambios.length) break;
      cambios.sort(function (x, y) { return y[0] - x[0]; }).forEach(function (r, i, L) {
        if (i && L[i - 1][0] < r[1]) return;   /* se cruza con otro: queda el primero */
        t = t.slice(0, r[0]) + '[' + t.slice(r[0], r[1]).trim() + ']' + t.slice(r[1]);
        envueltos++;
      });
    }
    return { texto: t, R: medir(t), envueltos: envueltos };
  }

  /* ══════════════ 4 · la medición (cola + un viaje de fondo) ══════════════ */
  function encolar(ev) {
    ev.cuando = new Date().toISOString();
    var c = K.guardar.leer(COLA_K, []) || [];
    c.push(ev);
    if (c.length > 120) c = c.slice(-120);
    K.guardar.escribir(COLA_K, c);
    programar();
  }
  var reloj = null, enviando = false;
  function programar(ms) { clearTimeout(reloj); reloj = setTimeout(enviar, ms === undefined ? 5000 : ms); }
  function enviar() {
    if (enviando || !K.token || !K.token()) return;
    var lote = K.guardar.leer(ENVIO_K, null);
    if (!lote || !lote.lista || !lote.lista.length) {
      var c = K.guardar.leer(COLA_K, []) || [];
      if (!c.length) return;
      lote = { rid: 'TA' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), lista: c.slice(0, 60) };
      K.guardar.escribir(ENVIO_K, lote);
      K.guardar.escribir(COLA_K, c.slice(60));
    }
    enviando = true;
    K.pedir('teAyudoRegistrar', { lista: lote.lista, rid: lote.rid }, { fondo: true, ms: 30000 })
      .then(function () {
        K.guardar.borrar(ENVIO_K); enviando = false;
        if ((K.guardar.leer(COLA_K, []) || []).length) programar(2000);
      }, function (e) {
        enviando = false;
        if (e && /CANCELADA/.test(String(e.codigo || e.code || e.message || ''))) { programar(3000); return; }
        if (e && /no tiene la accion/i.test(String(e.message || ''))) return;   /* el CORE aún sin la ruta: queda guardado */
        programar(60000);
      });
  }
  /* lo que quedó de otra sesión sale cuando la app ya arrancó */
  setTimeout(function () { programar(8000); }, 0);

  /* ══════════════ 3 · el botón y el panel ══════════════ */
  var NOMBRE_K = ['qué distinto', 'cuántos', 'para quién', 'qué quedó', 'cuándo', 'soporte'];

  function resaltarCorchetes(t) {
    return K.esc(t).replace(/\[([^\[\]\n]{1,80})\]/g, '<mark class="ta-hueco">[$1]</mark>');
  }

  function crear(o) {
    var nodo = K.nodo('<div class="ta" hidden>' +
      '<button type="button" class="kit-btn ta__btn">' + K.icono('lapiz', 16) + ' Te ayudo</button>' +
      '<div class="ta__panel" hidden role="region" aria-label="Te ayudo a redactar" aria-live="polite"></div></div>');
    var btn = nodo.querySelector('.ta__btn'), panel = nodo.querySelector('.ta__panel');
    var ultimoR = null, rojosAlTocar = null, yaVerde = {}, vuelo = 0, propuesta = null;
    var base = { app: o.app || '', obl: o.n, informe: o.informe || '' };

    function ev(tipo, extra) {
      var e = { tipo: tipo }; for (var p in base) e[p] = base[p];
      if (extra) for (var q in extra) e[q] = extra[q];
      encolar(e);
    }

    function cerrar() { vuelo++; panel.hidden = true; panel.innerHTML = ''; propuesta = null; btn.setAttribute('aria-expanded', 'false'); }

    function abrir() {
      var R = ultimoR, texto = o.area.value;
      K.vibrar(8);
      var t0 = Date.now(), mio = ++vuelo;
      var P = pistas(R, o.obligacion, texto);
      rojosAlTocar = R.b.filter(function (b) { return b.e === 'rojo'; }).map(function (b) { return b.k; });
      ev('toque', { rojos: rojosAlTocar.join(',') });
      btn.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      panel.innerHTML = '';
      panel.appendChild(K.nodo('<p class="ta__t">' + K.icono('bombilla', 16) + ' Lo que le falta a tu actividad</p>'));
      var ul = K.nodo('<ul class="ta__pistas" role="list"></ul>');
      P.forEach(function (p) {
        ul.appendChild(K.nodo('<li class="ta__p ta__p--' + p.e + '"><span class="ta__luz" aria-hidden="true"></span><span>' + K.esc(p.txt) +
          (p.ej ? ' <small>Ejemplo: <mark class="ta-hueco">' + K.esc(p.ej) + '</mark></small>' : '') + '</span></li>'));
      });
      panel.appendChild(ul);
      var zona = K.nodo('<div class="ta__prop"></div>');
      panel.appendChild(zona);
      var G = K.piezas.gemini;
      if (!ayudaIA(R) || !G || !G.mejorar || !G.disponible()) {
        zona.appendChild(K.nodo('<p class="ta__nota">' + (ayudaIA(R) ? 'Usa las pistas para completar tu texto.' : 'Esto se completa contigo (tus evidencias o lo que fue distinto), no con otra redacción.') + '</p>'));
        zona.appendChild(botones(null));
        return;
      }
      if (G.quedanMejora && !G.quedanMejora()) {
        zona.appendChild(K.nodo('<p class="ta__nota">Por hoy ya usaste todas las versiones sugeridas. Las pistas de arriba siguen sirviendo.</p>'));
        zona.appendChild(botones(null));
        return;
      }
      zona.appendChild(K.nodo('<p class="ta__cargando"><span class="ta__punto"></span> Preparando una versión mejorada de tu texto…</p>'));
      var tope = new Promise(function (ok, no) { setTimeout(function () { no(new Error('TIEMPO')); }, TOPE_MS); });
      Promise.race([G.mejorar({ obligacion: o.obligacion, actividad: texto, faltan: faltanParaIA(R, o.obligacion, texto), ms: TOPE_MS }), tope])
        .then(function (sug) {
          if (mio !== vuelo || !nodo.isConnected) return;
          var g = guardar_(texto, sug, o.obligacion, o.medir);
          var ms = Date.now() - t0;
          if (!g.texto || st(g.texto) === st(texto)) throw new Error('IGUAL');
          propuesta = g.texto;
          ev('propuesta', { ms: ms, ok: 1, envueltos: g.envueltos });
          zona.innerHTML = '';
          var V = K.piezas.variacion, v = V ? V.verdes(g.R) : null;
          zona.appendChild(K.nodo('<p class="ta__t">' + K.icono('lapiz', 16) + ' Tu texto, mejorado</p>'));
          zona.appendChild(K.nodo('<div class="ta__texto">' + resaltarCorchetes(propuesta) + '</div>'));
          zona.appendChild(K.nodo('<p class="ta__nota">' + (/\[/.test(propuesta) ? 'Llena lo que está entre <mark class="ta-hueco">[corchetes]</mark> con tus datos reales; mientras siga así, su bombillo queda en rojo. ' : '') +
            'Revísala: solo debe decir lo que hiciste y puedes demostrar.' + (v ? ' Así como está: ' + v.v + ' de ' + v.n + ' en verde.' : '') + '</p>'));
          zona.appendChild(botones(propuesta));
        })['catch'](function (e) {
          if (mio !== vuelo || !nodo.isConnected) return;
          ev('propuesta', { ms: Date.now() - t0, ok: 0, error: String((e && e.message) || 'ERROR').slice(0, 40) });
          zona.innerHTML = '';
          /* 03/11 · si Google no respondió, la versión mejorada se arma aquí mismo con sus
             [corchetes]: «Te ayudo» siempre entrega una propuesta (Oss: no debe fallar). */
          if (!(e && e.message === 'IGUAL')) {
            var gl = guardar_(texto, versionLocal(R, o.obligacion, texto), o.obligacion, o.medir);
            if (gl.texto && st(gl.texto) !== st(texto)) {
              propuesta = gl.texto;
              ev('propuesta', { ms: Date.now() - t0, ok: 1, envueltos: gl.envueltos, error: 'LOCAL' });
              var V2 = K.piezas.variacion, v2 = V2 ? V2.verdes(gl.R) : null;
              zona.appendChild(K.nodo('<p class="ta__t">' + K.icono('lapiz', 16) + ' Tu texto, mejorado</p>'));
              zona.appendChild(K.nodo('<div class="ta__texto">' + resaltarCorchetes(propuesta) + '</div>'));
              zona.appendChild(K.nodo('<p class="ta__nota">Llena lo que está entre <mark class="ta-hueco">[corchetes]</mark> con tus datos reales y ajusta la redacción a tu gusto; mientras siga así, su bombillo queda en rojo. ' +
                'Solo debe decir lo que hiciste y puedes demostrar.' + (v2 ? ' Así como está: ' + v2.v + ' de ' + v2.n + ' en verde.' : '') + '</p>'));
              zona.appendChild(botones(propuesta));
              return;
            }
          }
          zona.appendChild(K.nodo('<p class="ta__nota">' + (e && e.message === 'IGUAL' ? 'Tu texto ya dice lo que se puede decir sin datos nuevos: completa con las pistas.' : 'No alcancé a preparar la versión mejorada. Las pistas de arriba te dicen qué agregar.') + '</p>'));
          zona.appendChild(botones(null));
        });
    }

    function botones(texto) {
      var b = K.nodo('<div class="ta__btns"></div>');
      if (texto) {
        var usar = K.nodo('<button type="button" class="kit-btn kit-btn--marca">' + K.icono('check', 16) + ' Usar esta versión</button>');
        usar.addEventListener('click', function () {
          K.vibrar(10);
          ev('usada', { corchetes: (texto.match(/\[[^\[\]\n]{1,80}\]/g) || []).length });
          cerrar();
          o.alUsar(texto);
        });
        b.appendChild(usar);
      }
      var no = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + (texto ? 'No, gracias' : 'Cerrar') + '</button>');
      no.addEventListener('click', function () { if (texto) ev('no'); cerrar(); o.area.focus(); });
      b.appendChild(no);
      return b;
    }

    btn.addEventListener('click', function () {
      if (!panel.hidden) { cerrar(); return; }
      if (ultimoR) abrir();
    });

    function actualizar(R) {
      ultimoR = R;
      /* bombillos que pasaron a verde después de tocar «Te ayudo» (una vez cada uno) */
      if (rojosAlTocar && R && R.b) rojosAlTocar.forEach(function (k) {
        if (!yaVerde[k] && R.b[k] && R.b[k].e === 'verde') { yaVerde[k] = 1; ev('verde', { k: k, bombillo: NOMBRE_K[k] }); }
      });
      var mostrar = hayRojo(R);
      nodo.hidden = !mostrar;
      /* 03/11 · el primer toque esperaba ~4 s el token de App Check: se pide al aparecer el botón */
      if (mostrar && !CALIENTE && ayudaIA(R) && K.piezas.gemini && K.piezas.gemini.precalentar) { CALIENTE = true; K.piezas.gemini.precalentar(); }
      if (!mostrar && !panel.hidden) cerrar();
      else if (!panel.hidden && !propuesta) {
        /* las pistas siguen al texto mientras escribe */
        var ul = panel.querySelector('.ta__pistas');
        if (ul) { var P = pistas(R, o.obligacion, o.area.value); ul.innerHTML = ''; P.forEach(function (p) { ul.appendChild(K.nodo('<li class="ta__p ta__p--' + p.e + '"><span class="ta__luz" aria-hidden="true"></span><span>' + K.esc(p.txt) + (p.ej ? ' <small>Ejemplo: <mark class="ta-hueco">' + K.esc(p.ej) + '</mark></small>' : '') + '</span></li>')); }); }
      }
    }

    return { nodo: nodo, actualizar: actualizar, cerrar: cerrar };
  }

  /** Selecciona el primer [corchete] del campo para que lo llene de una. */
  function irAlHueco(area) {
    var m = /\[[^\[\]\n]{1,80}\]/.exec(area.value);
    try { area.focus(); if (m) area.setSelectionRange(m.index, m.index + m[0].length); } catch (e) {}
  }
  function corchetesSinLlenar(texto) { return (String(texto || '').match(/\[[^\[\]\n]{1,80}\]/g) || []); }

  /* ══════════════ 5 · 05/11 · EL BOMBILLO ROJO EN LA REVISIÓN ══════════════
     Supervisión y Contratación tocan un bombillo en rojo (o en ámbar) y ven:
     qué falta en una línea + la frase sugerida armada con el texto del
     contratista y [corchetes] donde él debe completar (la misma lógica de
     «Te ayudo», sin viajes) + «Pasar a la observación para el contratista». */
  var CORTO = 260;   /* el texto del contratista se muestra completo hasta aquí; más largo, su final */
  function finalDe(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (t.length <= CORTO) return t;
    var c = t.slice(-CORTO), i = c.indexOf(' ');
    return '… ' + (i > 0 && i < 40 ? c.slice(i + 1) : c);
  }
  function conPunto(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…]$/.test(t) ? t + '.' : t; }

  /**
   * receta(R, obl, texto, b) -> null | {k, e, falta, agrega, accion, frase, obs}
   *   falta  : qué le falta, en una línea (lenguaje del revisor)
   *   agrega : la frase nueva con [corchetes] (si se arregla escribiendo)
   *   accion : lo que debe hacer (si no se arregla escribiendo: soporte, fecha, corchetes)
   *   frase  : su texto + la frase nueva (la «frase sugerida armada»)
   *   obs    : el texto listo para la OBSERVACIÓN PARA EL CONTRATISTA
   */
  function receta(R, obl, texto, b) {
    if (!R || !R.b || !b || b.e === 'verde' || b.e === 'gris') return null;
    if (R.estado === 'general' || R.estado === 'noreq' || R.estado === 'vacia') return null;
    var T = tema(obl, texto), qu = /^\[/.test(T.qu) ? T.qu : '[' + T.qu + ']';
    var ent = '[' + T.ent.join(' o ') + ']', falta = '', agrega = '', accion = '';
    if (b.corchete) {
      falta = 'Dejó sin llenar ' + b.corchete.map(function (x) { return '[' + x + ']'; }).join(', ') + '.';
      accion = 'Reemplace lo que está entre corchetes por sus datos reales.';
    } else switch (b.k) {
      case 0:
        falta = 'Repite la forma de la cuenta ' + (R.con || R.plCon || R.ordenCon || 'anterior') + ': no dice qué fue distinto en este periodo.';
        agrega = 'En este periodo, a diferencia de la cuenta ' + (R.con || R.plCon || R.ordenCon || 'anterior') + ', [qué fue distinto: lugar, grupo o resultado].';
        break;
      case 1: falta = 'No dice cuántos: falta la cifra junto a lo que se contó.'; agrega = 'En total fueron [número] ' + T.cu + '.'; break;
      case 2: falta = 'No dice para quién ni con quién lo hizo.'; agrega = 'Se benefició ' + qu + '.'; break;
      case 3: falta = 'No dejó resultado ni entregable verificable.'; agrega = 'Como resultado quedó ' + ent + '.'; break;
      case 4:
        if (b.e === 'amarillo') { falta = 'La fecha' + (b.x ? ' «' + b.x + '»' : '') + ' cae fuera del periodo de esta cuenta.'; accion = 'Corrija la fecha por una del periodo: [fecha dentro del periodo].'; }
        else { falta = 'No dice cuándo lo hizo.'; agrega = 'Lo realicé el [fecha].'; }
        break;
      default:
        if (b.como === 'diceAdjunta') { falta = 'Dice que adjunta un soporte que no está cargado.'; accion = 'Cargue en esta obligación el soporte que menciona.'; }
        else if (b.como === 'donde') { falta = 'No cargó soporte: solo dice dónde verificarlo.'; accion = 'Cargue el soporte en esta obligación (' + T.ent.join(' o ') + ') o, si no aplica, escriba «no requiere adjunto».'; }
        else if (b.como === 'oblSinProducto') { falta = 'No tiene soporte ni dice si la actividad lo requiere.'; accion = 'Si no deja documento, escriba «no requiere adjunto»; si lo deja, cárguelo en esta obligación.'; }
        else { falta = 'La obligación pide un producto y no tiene evidencias ni adjuntos cargados.'; accion = 'Cargue en esta obligación ' + ent + ' o, si no aplica, escriba «no requiere adjunto».'; }
    }
    if (!falta) return null;
    var su = conPunto(texto), frase = agrega ? (su ? su + ' ' : '') + agrega : '';
    var obs = falta + ' ' + (agrega
      ? (su.length <= 400 ? 'Puede quedar así (llene lo que está entre corchetes con sus datos reales): «' + frase + '»'
        : 'Agregue al final de su actividad, con sus datos reales en lugar de los corchetes: «' + agrega + '»')
      : accion);
    return { k: b.k, e: b.e, falta: falta, agrega: agrega, accion: accion, frase: frase, obs: obs.trim() };
  }

  /**
   * panelRevisor({R, obl, texto, b, app, n, informe, puede, yaPasada(obs), alPasar(obs) -> bool})
   * -> nodo con la receta y el botón «Pasar a la observación para el contratista».
   */
  function panelRevisor(o) {
    var x = receta(o.R, o.obl, o.texto, o.b);
    if (!x) return null;
    var nodo = K.nodo('<div class="ta-rev ta-rev--' + x.e + '" role="region" aria-label="Qué falta y frase sugerida"></div>');
    nodo.appendChild(K.nodo('<p class="ta-rev__falta"><span class="ta__luz" aria-hidden="true"></span><span><b>Qué falta:</b> ' + K.esc(x.falta) + '</span></p>'));
    if (x.agrega) {
      nodo.appendChild(K.nodo('<p class="ta-rev__et">' + K.icono('lapiz', 14) + ' Frase sugerida con su texto</p>'));
      var su = finalDe(conPunto(o.texto));
      nodo.appendChild(K.nodo('<div class="ta__texto ta-rev__frase"><span class="ta-rev__suyo">' + K.esc(su) + '</span> <span class="ta-rev__nuevo">' + resaltarCorchetes(x.agrega) + '</span></div>'));
    } else if (x.accion) {
      nodo.appendChild(K.nodo('<p class="ta__texto ta-rev__frase">' + resaltarCorchetes(x.accion) + '</p>'));
    }
    var base = { app: o.app || '', obl: o.n, informe: o.informe || '', k: x.k };
    function ev(tipo) { var e = { tipo: tipo }; for (var p in base) e[p] = base[p]; encolar(e); }
    ev('rojo.toque');
    var ya = !!(o.yaPasada && o.yaPasada(x.obs));
    var btn = K.nodo('<button type="button" class="kit-btn ta-rev__pasar">' + K.icono(ya ? 'check' : 'enviar', 15) + ' <span>' + (ya ? 'Ya está en la observación para el contratista' : 'Pasar a la observación para el contratista') + '</span></button>');
    var pie = K.nodo('<p class="ta__nota ta-rev__pie"></p>');
    if (ya || o.puede === false) btn.disabled = true;
    pie.textContent = o.puede === false && !ya ? 'Esta cuenta no está en revisión: no se agregan observaciones.' : 'Queda en la observación de esta obligación; si devuelves la cuenta, sale en el motivo. Puedes editarla antes.';
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;   /* escudo desde el primer toque: una sola nota por toque */
      var ok = false;
      try { ok = o.alPasar ? o.alPasar(x.obs) !== false : false; } catch (e) { ok = false; }
      if (!ok) { btn.disabled = false; return; }
      K.vibrar(8);
      ev('rojo.pasar');
      btn.innerHTML = K.icono('check', 15) + ' <span>Pasada a la observación para el contratista</span>';
      btn.classList.add('ta-rev__pasar--hecho');
    });
    var acc = K.nodo('<div class="ta__btns"></div>');
    acc.appendChild(btn);
    nodo.appendChild(acc);
    nodo.appendChild(pie);
    return nodo;
  }

  K.piezas.teayudo = {
    crear: crear, pistas: pistas, hayRojo: hayRojo, ayudaIA: ayudaIA, irAlHueco: irAlHueco,
    corchetesSinLlenar: corchetesSinLlenar, receta: receta, panelRevisor: panelRevisor,
    /* para las pruebas */
    _guardar: guardar_, _tema: tema, _faltan: faltanParaIA, _enviar: enviar, COLA_K: COLA_K, ENVIO_K: ENVIO_K
  };
}());
