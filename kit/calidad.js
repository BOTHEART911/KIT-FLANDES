/* ============================================================
   KIT-FLANDES · PIEZA 39 · CALIDAD DEL PRIMER FILTRO (10/11/2026)

   Qué tan completas llegan a Contratación las cuentas que aprueba cada
   supervisor, medidas con los MISMOS 6 bombillos del borrador y de la
   revisión (motor de kit/informe-cuentas.js, sin copiarlo).

   La medida (fórmula B, la que escogió Oss)
     · 10/11 13:26 · La cuenta usa los MISMOS componentes del informe
       gerencial del contratista, menos Oportunidad (radicar a tiempo no
       depende del supervisor), en tres partes iguales:
         Variación = bombillo «Qué hizo distinto»,
         Redacción completa = cuántos, para quién, resultado y cuándo,
         Soporte = bombillo de soporte.
       Cada parte junta los bombillos de todas sus obligaciones (verde 100,
       ámbar 50, rojo 0; el gris no cuenta). Una parte sin nada que medir
       (Variación en la primera cuenta) no entra. Las generales y las «no
       requeridas en el periodo» quedan fuera; una obligación vacía suma 0
       en Redacción y Soporte. Así un contratista no sale distinto en el
       informe gerencial y aquí.
     · El supervisor: 80 % el promedio de las cuentas que pasó + 20 %
       (100 − % de esas cuentas que Contratación devolvió después). Sus
       propias devoluciones se muestran, no suben el puntaje.

   Quién la usa
     · SUPERVISIÓN: al aprobar manda la foto (deCuenta) con la decisión, y
       el supervisor ve SU tarjeta (vistaMia), sin ranking.
     · CONTRATACIÓN: el % en cada tarjeta de Revisar cuentas y en el
       detalle; si la foto no llegó, la calcula al abrir (respaldo); y la
       vista «Calidad del primer filtro» con el ranking y el informe.
     · ADMIN: la misma vista.

   Tono: es una guía para mejorar, no una sanción. Nada de «peor»: los
   niveles son Sólida, En camino y Por fortalecer.

   Rendimiento: la vista pinta los botones al instante y las tarjetas con
   UNA lectura (se recuerda en el teléfono y se renueva por detrás). Medir
   una cuenta: < 5 ms por obligación, sin viajes.
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  var MOTOR = 'C2026.11.10c';   /* b: tres partes como el informe gerencial · c: soporte gris si la obligación no pide producto */
  var LETRA = { verde: 'v', amarillo: 'a', rojo: 'r', gris: 'g' };
  var BOMBILLOS = ['Qué hizo distinto', 'Cuántos', 'Para quién', 'Resultado', 'Cuándo', 'Soporte'];
  var BOMB_LARGO = ['Diferencia lo hecho frente a la cuenta anterior', 'Dice cuántos (cifras de lo hecho)', 'Dice para quién o con quién',
                    'Deja un resultado o entregable verificable', 'Ubica lo hecho dentro del periodo', 'Tiene soporte o dice que no lo requiere'];
  var COMPROMISO = [
    'Antes de aprobar, usar «Comparar con la cuenta anterior» y devolver la actividad que repite la forma sin contar nada nuevo del periodo.',
    'Pedir la cifra de lo hecho en el periodo (documentos, visitas, personas atendidas, procesos) cuando la actividad no la trae.',
    'Verificar que cada actividad diga para quién o con quién se hizo (dependencia, comunidad, entidad).',
    'Exigir el resultado o entregable verificable de cada actividad (acta, informe, base de datos, publicación).',
    'Revisar que las fechas de lo reportado caigan dentro del periodo que se cobra.',
    'No aprobar obligaciones que piden un producto sin el soporte cargado o sin la frase «no requiere adjunto».'
  ];
  var MINIMO = 5;

  /* ══════════════ la medida ══════════════ */

  /** El código de UNA obligación medida (R del motor): 'vvarg…', 'x' (vacía) o null (no se mide). */
  function codigo(R) {
    if (!R || R.estado === 'general' || R.estado === 'noreq') return null;
    if (R.estado === 'vacia') return 'x';
    /* 10/11 c · sin adjunto en una obligación que no pide producto: el soporte no aplica (gris), no resta */
    return (R.b || []).map(function (b) { return b.k === 5 && b.como === 'oblSinProducto' ? 'g' : (LETRA[b.e] || 'g'); }).join('');
  }
  /** Puntos de un código: verde 100, ámbar 50, rojo 0, gris fuera; 'x' = 0. */
  function puntos(c) {
    if (c === 'x') return 0;
    var s = 0, n = 0;
    for (var i = 0; i < c.length; i++) {
      var ch = c.charAt(i);
      if (ch === 'v') { s += 100; n++; } else if (ch === 'a') { s += 50; n++; } else if (ch === 'r') n++;
    }
    return n ? s / n : null;
  }
  var PT = { v: 100, a: 50, r: 0 };
  /** Las tres partes de una cuenta (como el informe gerencial, sin Oportunidad). */
  function partes(o) {
    var V = [], R = [], S = [];
    Object.keys(o || {}).forEach(function (n) {
      var c = String(o[n] || '');
      if (c === 'x') { R.push(0, 0, 0, 0); S.push(0); return; }
      for (var k = 0; k < 6 && k < c.length; k++) {
        var v = PT[c.charAt(k)];
        if (v === undefined) continue;
        if (k === 0) V.push(v); else if (k <= 4) R.push(v); else S.push(v);
      }
    });
    function pr(L) { return L.length ? L.reduce(function (a, b) { return a + b; }, 0) / L.length : null; }
    return { variacion: pr(V), redaccion: pr(R), soporte: pr(S) };
  }
  /** {n: código} -> {p, o, mv}. p = promedio de las partes que se pueden medir. */
  function resumir(o) {
    var P = partes(o), L = [P.variacion, P.redaccion, P.soporte].filter(function (v) { return v !== null; });
    return { p: L.length ? Math.round(L.reduce(function (a, b) { return a + b; }, 0) / L.length) : null, o: o, mv: MOTOR };
  }

  /**
   * La foto de UNA cuenta con el motor del kit.
   * obls = [{n, texto (obligación), actual (actividad), soporte (n)}]
   * d = respuesta de revisionAnterior (o la que arma deInforme); per = {desde, hasta}
   */
  function deCuenta(I, V, obls, d, nContrato, per) {
    per = per || {};
    var o = {};
    (obls || []).forEach(function (x) {
      var R = V.medir(I, x.actual, V.preparar(I, x.texto, V.previosDe(d, x.n), nContrato),
        { obl: x.texto, desde: per.desde, hasta: per.hasta, soporte: x.soporte, nContrato: nContrato });
      var c = codigo(R);
      if (c) o[x.n] = c;
    });
    return resumir(o);
  }

  /**
   * La foto de una cuenta YA radicada, con los datos del informe del contratista
   * (informeContratista / FC63_informeCuentas_). Es el relleno de lo anterior:
   * el mismo camino que deCuenta, armando las cuentas anteriores como las trae
   * revisionAnterior. El anexo general de antes del 05/10 cuenta como soporte.
   */
  function deInforme(I, V, datos, informe) {
    var c = (datos && datos.contrato) || {}, obl = c.obligaciones || [];
    var L = ((datos && datos.cuentas) || []).filter(function (x) { return K.norm(x.estado) !== 'BORRADOR'; });
    var x = L.filter(function (q) { return Number(q.informe) === Number(informe); })[0];
    if (!x) return null;
    var d = {
      obligaciones: obl.map(function (o) { return o.n; }),
      cuentas: L.filter(function (q) { return Number(q.informe) < Number(informe); })
        .map(function (q) { return { informe: q.informe, actividades: q.actividades || [], desde: q.desde || '', hasta: q.hasta || '' }; })
    };
    var obls = obl.map(function (o, i) {
      var ev = Number((x.evidencias || [])[i]) || 0, adj = ((x.adjuntos || [])[i] || []).length;
      return { n: o.n, texto: o.texto, actual: String((x.actividades || [])[i] || '').trim(), soporte: ev + adj + (x.anexoViejo && !ev && !adj ? 1 : 0) };
    });
    return deCuenta(I, V, obls, d, c.contrato, { desde: x.desde, hasta: x.hasta });
  }

  /* ══════════════ cómo se dice ══════════════ */

  function nivel(p) {
    if (p === null || p === undefined) return { k: 'nada', t: 'Sin medir' };
    if (p >= 80) return { k: 'alta', t: 'Sólida' };
    if (p >= 60) return { k: 'media', t: 'En camino' };
    return { k: 'baja', t: 'Por fortalecer' };
  }
  function aprox(origen) { return String(origen || '').toUpperCase() === 'APROX'; }

  /** La pastilla de la tarjeta de Revisar cuentas. cal = {cal, origen} */
  function pastilla(cal) {
    if (!cal || cal.cal === null || cal.cal === undefined) return '';
    var n = nivel(cal.cal);
    return '<span class="cal-pas cal-pas--' + n.k + '" title="Calidad con que el supervisor pasó la cuenta (6 bombillos)' +
      (aprox(cal.origen) ? '. Aproximada: medida con el texto de hoy' : '') + '">' + K.icono('grafica', 12) +
      ' Primer filtro ' + (aprox(cal.origen) ? '≈' : '') + cal.cal + ' %</span>';
  }

  /** Bloque para la cabecera del detalle: el % y una luz por obligación. */
  function bloqueDetalle(cal, oblTextos) {
    var n = nivel(cal && cal.cal);
    var caja = K.nodo('<section class="cal-det cal-det--' + n.k + '" aria-label="Calidad del primer filtro"></section>');
    if (!cal || cal.cal === null || cal.cal === undefined) {
      caja.appendChild(K.nodo('<p class="cal-det__t">' + K.icono('grafica', 15) + ' Calidad del primer filtro <small>· midiendo…</small></p>'));
      return caja;
    }
    caja.appendChild(K.nodo('<div class="cal-det__cab"><b class="cal-det__pct">' + (aprox(cal.origen) ? '≈' : '') + cal.cal + ' %</b>' +
      '<p class="cal-det__t"><b>Calidad del primer filtro · ' + K.esc(n.t) + '</b><small>Así de completa llegó la cuenta cuando ' +
      (cal.sup ? K.esc(nombrePropio(cal.sup)) : 'el supervisor') + ' la aprobó' + (cal.ronda > 1 ? ' (vez ' + cal.ronda + ')' : '') +
      (aprox(cal.origen) ? '. Aproximada: se midió con el texto de hoy.' : '.') + '</small></p></div>'));
    var ul = K.nodo('<ul class="cal-det__obls" role="list"></ul>');
    Object.keys(cal.o || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var c = cal.o[k], p = puntos(c), nk = nivel(p);
      var tit = 'Obligación ' + k + ': ' + (c === 'x' ? 'sin actividad escrita' : c.split('').map(function (ch, i) { return BOMBILLOS[i] + ' ' + ({ v: 'verde', a: 'ámbar', r: 'rojo', g: 'no aplica' })[ch]; }).join(' · '));
      if (oblTextos && oblTextos[k]) tit += '\n' + String(oblTextos[k]).slice(0, 160);
      ul.appendChild(K.nodo('<li class="cal-det__o cal-det__o--' + nk.k + '" title="' + K.esc(tit) + '"><b>' + k + '</b><span>' + (p === null ? '—' : Math.round(p) + '%') + '</span></li>'));
    });
    caja.appendChild(ul);
    caja.appendChild(K.nodo('<p class="cal-det__ley">Mismos 6 bombillos que ves debajo de cada actividad. Es una guía para mejorar el primer filtro: no reemplaza tu revisión.</p>'));
    return caja;
  }

  function nombrePropio(s) {
    return K.piezas.personas && K.piezas.personas.nombrePropio ? K.piezas.personas.nombrePropio(s)
      : String(s || '').toLowerCase().replace(/(^|[\s(.-])([a-záéíóúñü])/g, function (t, a, l) { return a + l.toUpperCase(); });
  }
  function fechaDia(n) { var s = String(n || ''); return s.length === 8 ? s.slice(6) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4) : ''; }

  /* ══════════════ la tarjeta de un supervisor ══════════════ */

  function barras(bomb) {
    return '<ul class="cal-bom" role="list" aria-label="Bombillos en verde">' + BOMBILLOS.map(function (t, i) {
      var v = bomb && bomb[i] !== null && bomb[i] !== undefined ? bomb[i] : null, n = nivel(v);
      return '<li class="cal-bom__i" title="' + K.esc(BOMB_LARGO[i]) + (v === null ? '' : ': ' + v + ' %') + '"><span class="cal-bom__t">' + K.esc(t) +
        '</span><span class="cal-bom__b"><i class="cal-bom__r cal-bom__r--' + n.k + '" style="width:' + (v === null ? 0 : v) + '%"></i></span><b>' + (v === null ? '—' : v + '%') + '</b></li>';
    }).join('') + '</ul>';
  }

  function tarjeta(s, op) {
    op = op || {};
    var n = nivel(s.suficiente ? s.calidad : null);
    var t = K.nodo('<article class="kit-tarjeta cal-t cal-t--' + (s.suficiente ? n.k : 'nada') + '"></article>');
    var cab = K.nodo('<div class="cal-t__cab"></div>');
    if (K.piezas.personas) cab.appendChild(K.piezas.personas.avatar(s.nombre, { tam: 48 }));
    cab.appendChild(K.nodo('<div class="cal-t__quien"><h3 class="cal-t__n">' + K.esc(nombrePropio(s.nombre)) + '</h3><p class="cal-t__sub">' +
      (s.pasos ? s.pasos + (s.pasos === 1 ? ' cuenta aprobada' : ' cuentas aprobadas') + ' · ' + s.contratos + (s.contratos === 1 ? ' contrato' : ' contratos') : 'Aún no ha aprobado cuentas') + '</p></div>'));
    if (s.puesto && !op.sinPuesto) cab.appendChild(K.nodo('<span class="cal-t__puesto" title="Puesto en el ranking">#' + s.puesto + '</span>'));
    t.appendChild(cab);
    if (s.suficiente) {
      var tend = s.tendencia === null || s.tendencia === undefined ? '' :
        '<span class="cal-t__tend cal-t__tend--' + (s.tendencia > 0 ? 'sube' : (s.tendencia < 0 ? 'baja' : 'igual')) + '" title="Últimos 30 días frente a lo anterior">' +
        (s.tendencia > 0 ? '▲ +' : (s.tendencia < 0 ? '▼ ' : '● ')) + s.tendencia + ' pts</span>';
      t.appendChild(K.nodo('<div class="cal-t__pct"><b>' + s.calidad + ' %</b><span class="cal-t__nivel">' + K.esc(n.t) + '</span>' + tend + '</div>'));
      t.appendChild(K.nodo('<dl class="cal-t__datos">' +
        '<div><dt>Calidad con que pasan</dt><dd>' + (s.promedio === null ? '—' : s.promedio + ' %') + '</dd></div>' +
        '<div><dt>Devueltas luego por Contratación</dt><dd>' + (s.omision === null ? '—' : s.omision + ' %') + ' <small>(' + s.devCont + ' de ' + s.decididas + ')</small></dd></div>' +
        '<div><dt>Devoluciones propias</dt><dd>' + s.devSup + '</dd></div>' +
        '</dl>'));
      t.appendChild(K.nodo(barras(s.bomb)));
      if (s.aprox) t.appendChild(K.nodo('<p class="cal-t__nota">≈ ' + s.aprox + ' de ' + s.medidas + ' medidas son aproximadas (cuentas de antes del 10/11 medidas con el texto de hoy).</p>'));
    } else {
      t.appendChild(K.nodo('<p class="cal-t__falta">' + K.icono('reloj', 14) + ' Aún sin datos suficientes: ' + s.pasos + ' de ' + MINIMO + ' cuentas para entrar al ranking.</p>'));
    }
    if (op.alInforme && s.pasos) {
      var a = K.nodo('<div class="ct-acc"></div>');
      var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca cal-t__inf">' + K.icono('pdf', 16) + ' Informe</button>');
      b.addEventListener('click', function () { op.alInforme(s, b); });
      a.appendChild(b);
      t.appendChild(a);
    }
    return t;
  }

  /* ══════════════ el informe gerencial de UN supervisor ══════════════ */

  function iso(f) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(f || '')); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
  function hora(f) { var m = /(\d{1,2}):(\d{2})/.exec(String(f || '')); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
  function prom(L) { L = L.filter(function (v) { return v !== null && v !== undefined; }); return L.length ? Math.round(L.reduce(function (a, b) { return a + b; }, 0) / L.length) : null; }

  /** Lo que se dice del supervisor: hallazgos, conclusión y compromisos. */
  function lectura(D, equipo) {
    var s = D.supervisor || {}, h = [], comp = [];
    var orden = (s.bomb || []).map(function (v, i) { return { i: i, v: v }; }).filter(function (x) { return x.v !== null && x.v !== undefined; })
      .sort(function (a, b) { return a.v - b.v; });
    if (s.calidad !== null && s.calidad !== undefined) h.push('Calidad del primer filtro: ' + s.calidad + ' % (' + nivel(s.calidad).t.toLowerCase() + '), con ' + s.pasos + ' cuentas aprobadas' + (equipo !== null && equipo !== undefined ? '; el promedio del equipo de supervisión es ' + equipo + ' %.' : '.'));
    if (orden.length) {
      var fuerte = orden[orden.length - 1], debil = orden[0];
      h.push('Lo que mejor llega: «' + BOMB_LARGO[fuerte.i].toLowerCase() + '» (' + fuerte.v + ' % en verde).');
      if (debil.v < 80) h.push('Lo que más se deja pasar: «' + BOMB_LARGO[debil.i].toLowerCase() + '» (' + debil.v + ' % en verde).');
    }
    if (s.decididas) h.push('De las cuentas que aprobó y Contratación ya decidió, ' + s.devCont + ' de ' + s.decididas + ' (' + s.omision + ' %) volvieron devueltas desde Contratación: es lo que el primer filtro no alcanzó a ver.');
    if (s.devSup) h.push('Devolvió ' + s.devSup + (s.devSup === 1 ? ' cuenta' : ' cuentas') + ' al contratista antes de aprobar: es parte del filtro que sí está funcionando.');
    if (s.vacias) h.push(s.vacias + (s.vacias === 1 ? ' obligación llegó' : ' obligaciones llegaron') + ' sin actividad escrita.');
    if (s.tendencia !== null && s.tendencia !== undefined && s.n30) h.push('En los últimos 30 días la calidad ' + (s.tendencia > 0 ? 'mejoró ' + s.tendencia + ' puntos' : (s.tendencia < 0 ? 'bajó ' + (-s.tendencia) + ' puntos' : 'se mantuvo')) + ' frente a lo anterior.');
    if (s.aprox) h.push(s.aprox + ' de ' + s.medidas + ' medidas son aproximadas: son cuentas de antes del 10/11 medidas con el texto de hoy.');
    orden.filter(function (x) { return x.v < 80; }).slice(0, 3).forEach(function (x) { comp.push(COMPROMISO[x.i]); });
    if (s.omision !== null && s.omision >= 15) comp.push('Antes de aprobar, tocar los bombillos en rojo y usar «Pasar a la observación para el contratista»: así la corrección llega desde Supervisión y no desde Contratación.');
    comp.push('Revisar este informe con el equipo de Contratación en un mes y comparar el avance.');
    var c = s.calidad === null || s.calidad === undefined ? 'Aún no hay cuentas medidas para concluir.'
      : (s.calidad >= 80 ? 'El primer filtro funciona bien: las cuentas llegan completas a Contratación. El reto es sostenerlo y compartir la práctica con el equipo.'
      : (s.calidad >= 60 ? 'El primer filtro va en camino: la mayoría de las cuentas llegan bien, pero hay aspectos de la redacción que se dejan pasar y luego los devuelve Contratación. Con los compromisos de abajo el avance es rápido.'
      : 'El primer filtro está por fortalecer: varias cuentas llegan a Contratación con faltantes que se pueden ver en la revisión del supervisor. Los compromisos de abajo apuntan a lo que más se repite.'));
    return { hallazgos: h, conclusion: c, compromisos: comp };
  }

  /** Arma el informe con el gerencial del kit. D = respuesta de calidadSupervisor. */
  function informe(D, op) {
    op = op || {};
    var ex = K.piezas.exportar;
    if (!ex || !ex.aGerencial) return Promise.reject(K.problema ? K.problema('VERSION', 'El informe no está disponible en esta versión. Recarga la app.') : new Error('Sin informe gerencial'));
    var s = D.supervisor || {}, pasos = D.pasos || [], devs = D.devoluciones || [];
    var L = lectura(D, op.equipo);
    var regs = [];
    pasos.forEach(function (p) {
      var r = String(p.res || '').toUpperCase();
      regs.push({ fecha: iso(p.f), hora: hora(p.f), tipo: r === 'APROBADA' ? 'Aprobada también por Contratación' : (r === 'DEVUELTA' ? 'Devuelta luego por Contratación' : 'En revisión de Contratación'),
        tono: r === 'APROBADA' ? 'ok' : (r === 'DEVUELTA' ? 'malo' : 'aviso'), categoria: p.sec || '', sujeto: p.nom || '',
        ref: 'Contrato ' + (p.con || '') + ' · cuenta ' + p.inf + (p.cal === null || p.cal === undefined ? '' : ' · ' + p.cal + ' %' + (aprox(p.org) ? ' (aprox.)' : '')) });   /* el PDF no tiene el signo ≈ */
    });
    devs.forEach(function (p) { regs.push({ fecha: iso(p.f), hora: hora(p.f), tipo: 'Devuelta por el supervisor', tono: 'info', categoria: p.sec || '', sujeto: p.nom || '', ref: 'Contrato ' + (p.con || '') + ' · cuenta ' + p.inf }); });
    regs = regs.filter(function (r) { return r.fecha; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    var fechas = regs.map(function (r) { return r.fecha; });

    /* calidad por mes y por contratista */
    var mes = {}, porCon = {};
    pasos.forEach(function (p) {
      if (p.cal === null || p.cal === undefined) return;
      var k = iso(p.f).slice(0, 7);
      (mes[k] = mes[k] || []).push(p.cal);
      (porCon[p.nom || '—'] = porCon[p.nom || '—'] || []).push(p.cal);
    });
    var MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var serieMes = Object.keys(mes).sort().map(function (k) { return { etiqueta: MES[Number(k.slice(5)) - 1] + ' ' + k.slice(2, 4), valor: prom(mes[k]) }; });
    /* 10/11 · solo cuentan las que pasó desde que se registra quién las pasa (28/09); con menos de 3 es dato inicial, aparte */
    var MIN_CON = 3, desdeTxt = fechas.length ? fechas[0].slice(8, 10) + '/' + fechas[0].slice(5, 7) : '';
    var conTodos = Object.keys(porCon).map(function (k) { var v = prom(porCon[k]), n = porCon[k].length; return { etiqueta: nombrePropio(k), extra: n + (n === 1 ? ' cuenta' : ' cuentas'), valor: v, n: n, tono: nivel(v).k === 'alta' ? 'ok' : (nivel(v).k === 'media' ? 'aviso' : 'malo') }; })
      .sort(function (a, b) { return a.valor - b.valor; });
    var conLista = conTodos.filter(function (x) { return x.n >= MIN_CON; }), conInicial = conTodos.filter(function (x) { return x.n < MIN_CON; });
    var omis = pasos.filter(function (p) { return String(p.res || '').toUpperCase() === 'DEVUELTA'; });
    function tono(v) { var k = nivel(v).k; return k === 'alta' ? 'ok' : (k === 'media' ? 'aviso' : 'malo'); }

    var spec = {
      app: op.app || 'Contratación',
      persona: nombrePropio(s.nombre || ''),
      rol: 'Supervisor(a)',
      subtitulo: 'Calidad del primer filtro de cuentas',
      desde: fechas[0] || '', hasta: fechas[fechas.length - 1] || '',
      nombre: 'Calidad primer filtro ' + nombrePropio(s.nombre || ''),
      palabra: ['actuación', 'actuaciones'],
      etiquetas: { tipo: 'Resultado', categoria: 'Secretaría', sujeto: 'Contratista' },
      tonos: { ok: 'Aprobadas también por Contratación', malo: 'Devueltas luego por Contratación', aviso: 'En revisión de Contratación', info: 'Devueltas por el supervisor' },
      registros: regs,
      kpis: [
        { etiqueta: 'Calidad del primer filtro', valor: s.calidad === null || s.calidad === undefined ? '—' : s.calidad + ' %', nota: nivel(s.calidad).t + (op.equipo !== null && op.equipo !== undefined ? ' · equipo ' + op.equipo + ' %' : ''), tono: tono(s.calidad) },
        { etiqueta: 'Calidad con que pasan', valor: s.promedio === null || s.promedio === undefined ? '—' : s.promedio + ' %', nota: 'variación, redacción y soporte', tono: tono(s.promedio) },
        { etiqueta: 'Devueltas luego por Contratación', valor: s.omision === null || s.omision === undefined ? '—' : s.omision + ' %', nota: s.devCont + ' de ' + s.decididas + ' decididas', tono: s.omision >= 20 ? 'malo' : (s.omision >= 10 ? 'aviso' : 'ok') },
        { etiqueta: 'Cuentas aprobadas', valor: String(s.pasos || 0), nota: (s.contratos || 0) + ' contratos', tono: 'info' },
        { etiqueta: 'Devoluciones propias', valor: String(s.devSup || 0), nota: 'antes de aprobar', tono: 'info' },
        { etiqueta: 'Tendencia 30 días', valor: s.tendencia === null || s.tendencia === undefined ? '—' : (s.tendencia > 0 ? '+' : '') + s.tendencia + ' pts', nota: 'frente a lo anterior', tono: s.tendencia < 0 ? 'aviso' : 'ok' }
      ],
      sintesis: 'Este informe mide qué tan completas llegan a Contratación las cuentas que ' + nombrePropio(s.nombre || '') + ' aprueba como supervisor(a), con los mismos 6 bombillos que guían al contratista al redactar. ' +
        'La calidad del primer filtro combina la calidad con que pasan las cuentas (80 %: Variación, Redacción completa y Soporte, los mismos componentes del informe gerencial del contratista sin la oportunidad de radicación) y las que Contratación tuvo que devolver después (20 %). ' + L.conclusion,
      soloHallazgos: L.hallazgos,
      secciones: [
        {
          titulo: 'Calidad de lo que aprueba',
          intro: 'Cada barra es el porcentaje de actividades que pasaron con ese bombillo en verde (ámbar vale la mitad). La calidad de cada cuenta usa los mismos componentes del informe gerencial del contratista, menos la oportunidad de radicación: Variación, Redacción completa y Soporte, en partes iguales. Las gráficas por contratista no son un ranking de contratistas: dicen con qué calidad el supervisor aprobó las cuentas de cada uno desde que el sistema registra quién las pasa (28/09), no su historial completo. Si una obligación no pide un producto y no tiene adjunto, el soporte no aplica y no resta.',
          graficas: [
            { titulo: 'Los 6 bombillos en lo que aprueba', tipo: 'barrasH', formato: 'porciento', tope: 100, sinParte: true, titular: false,
              datos: BOMB_LARGO.map(function (t, i) { var v = (s.bomb || [])[i]; return { etiqueta: t, valor: v === null || v === undefined ? 0 : v, tono: tono(v) }; }) },
            { titulo: 'Calidad por mes', tipo: 'barras', formato: 'porciento', datos: serieMes },
            { titulo: 'Calidad con que aprobó las cuentas de cada contratista', nota: (desdeTxt ? 'cuentas desde el ' + desdeTxt + ' · ' : '') + MIN_CON + ' o más · de menor a mayor', tipo: 'barrasH', formato: 'porciento', tope: 100, sinParte: true, max: 60, titular: false, ancho: 70, datos: conLista },
            { titulo: 'Dato inicial: menos de ' + MIN_CON + ' cuentas medidas', nota: (desdeTxt ? 'cuentas desde el ' + desdeTxt + ' · ' : '') + 'no se comparan', tipo: 'barrasH', formato: 'porciento', tope: 100, sinParte: true, max: 60, titular: false, ancho: 70, datos: conInicial }
          ].filter(function (g) { return g.datos.length; })
        },
        {
          titulo: 'Lo que se le escapa y lo que devuelve',
          intro: 'Las cuentas que aprobó y luego devolvió Contratación muestran lo que el primer filtro no alcanzó a ver. Sus propias devoluciones son el filtro que sí funcionó.',
          tablas: [
            { titulo: 'Devueltas luego por Contratación', nota: omis.length + ' en total', cols: [{ titulo: 'Fecha', ancho: 22 }, { titulo: 'Contratista', ancho: 46 }, { titulo: 'Cuenta', ancho: 26 }, { titulo: 'Motivo de Contratación' }],
              filas: omis.slice(-40).reverse().map(function (p) { return [p.fres ? String(p.fres).slice(0, 10) : String(p.f).slice(0, 10), nombrePropio(p.nom), (p.con || '') + ' · c' + p.inf, String(p.mot || '—').replace(/\s+/g, ' ').slice(0, 220)]; }) },
            { titulo: 'Devueltas por el supervisor', nota: devs.length + ' en total', cols: [{ titulo: 'Fecha', ancho: 22 }, { titulo: 'Contratista', ancho: 46 }, { titulo: 'Cuenta', ancho: 26 }, { titulo: 'Motivo' }],
              filas: devs.slice(-30).reverse().map(function (p) { return [String(p.f).slice(0, 10), nombrePropio(p.nom), (p.con || '') + ' · c' + p.inf, String(p.mot || '—').replace(/\s+/g, ' ').slice(0, 220)]; }) }
          ]
        },
        {
          titulo: 'Conclusiones y compromisos',
          intro: L.conclusion + ' Este informe es una herramienta de mejora, no una sanción: su propósito es que el primer filtro sea cada vez más estricto y que menos cuentas vuelvan desde Contratación.',
          subtituloVinetas: 'Compromisos sugeridos para la próxima revisión',
          vinetas: L.compromisos
        }
      ],
      notaAnexo: 'El detalle completo está en la vista «Calidad del primer filtro».'
    };
    return ex.aGerencial(spec);
  }

  /* ══════════════ la vista del ranking (Contratación y ADMIN) ══════════════ */

  /**
   * op = {accionLista, accionUno, app (nombre visible), recordar (llave)}
   */
  function vistaRanking(caja, op) {
    var t0 = Date.now();
    var intro = K.nodo('<section class="cal-intro">' +
      '<p>Qué tan completas llegan a Contratación las cuentas que aprueba cada supervisor, medidas con los mismos <b>6 bombillos</b> que guían al contratista. ' +
      'Combina la calidad con que pasan (80 %: variación, redacción completa y soporte, como en el informe gerencial del contratista) y las que Contratación devolvió después (20 %). Es una guía para mejorar el primer filtro, no una sanción.</p>' +
      '<p class="cal-ley"><span class="cal-pas cal-pas--alta">80 % o más · Sólida</span><span class="cal-pas cal-pas--media">60 a 79 % · En camino</span><span class="cal-pas cal-pas--baja">menos de 60 % · Por fortalecer</span></p>' +
      '</section>');
    caja.appendChild(intro);
    var barra = K.nodo('<div class="cal-barra"><span class="cal-barra__eq"></span></div>');
    var refr = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + K.icono('recargar', 16) + ' Refrescar</button>');
    barra.appendChild(refr);
    caja.appendChild(barra);
    var rej = K.nodo('<div class="kit-rejilla kit-rejilla--auto cal-rej"></div>');
    caja.appendChild(rej);
    var EQUIPO = null;

    function pintar(d) {
      rej.innerHTML = '';
      var L = (d && d.supervisores) || [];
      var suf = L.filter(function (s) { return s.suficiente; });
      EQUIPO = prom(suf.map(function (s) { return s.calidad; }));
      barra.querySelector('.cal-barra__eq').innerHTML = suf.length ? 'Promedio del equipo: <b>' + EQUIPO + ' %</b> · ' + suf.length + ' en el ranking' + (L.length > suf.length ? ' · ' + (L.length - suf.length) + ' aún sin datos suficientes' : '') : 'Aún no hay supervisores con ' + MINIMO + ' cuentas medidas.';
      if (!L.length) { rej.appendChild(K.nodo('<p class="cal-vacio">Todavía no hay cuentas aprobadas por supervisión para medir.</p>')); return; }
      L.forEach(function (s) { rej.appendChild(tarjeta(s, { alInforme: alInforme })); });
      try { console.info('[calidad] ranking pintado en', Date.now() - t0, 'ms'); } catch (e) {}
    }

    function alInforme(s, btn) {
      if (btn.disabled) return;
      btn.disabled = true; btn.classList.add('kit-btn--ocupado');
      var viejo = btn.innerHTML;
      btn.innerHTML = K.icono('reloj', 16) + ' Armando…';
      var t1 = Date.now();
      K.pedir(op.accionUno, { nombre: s.nombre }).then(function (D) {
        return informe(D, { app: op.app, equipo: EQUIPO });
      }).then(function (r) {
        try { console.info('[calidad] informe', Date.now() - t1, 'ms', r); } catch (e) {}
        K.aviso('Informe listo: ' + (r && r.paginas ? r.paginas + ' páginas' : 'descargado') + '.', 'ok', 4000);
      })['catch'](function (e) { K.aviso((e && e.message) || 'No se pudo armar el informe.', 'error', 7000); })
        .then(function () { btn.disabled = false; btn.classList.remove('kit-btn--ocupado'); btn.innerHTML = viejo; });
    }

    var llave = op.recordar || 'calidad.ranking';
    var ya = K.recordado ? K.recordado.leer(llave) : null;
    if (ya) pintar(ya);
    function traer(fresco) {
      var p = K.pedir(op.accionLista, fresco ? { t: Date.now() } : {});
      var esp = ya || !K.piezas.esqueletos ? p : K.piezas.esqueletos.mientras(rej, p, { forma: 'ficha', cuantos: 4 });
      return esp.then(function (d) {
        if (!caja.isConnected) return;
        if (K.recordado) K.recordado.guardar(llave, d);
        pintar(d);
      }, function (e) {
        if (!caja.isConnected) return;
        if (!ya) rej.appendChild(K.nodo('<p class="cal-vacio">' + K.esc((e && e.message) || 'No se pudo traer la calidad.') + '</p>'));
        else K.aviso('No se pudo actualizar: ' + ((e && e.message) || ''), 'aviso', 5000);
      });
    }
    refr.addEventListener('click', function () { if (refr.disabled) return; refr.disabled = true; traer(true).then(function () { refr.disabled = false; }); });
    traer(false);
    if (K.piezas.exportar && K.piezas.exportar.prepararGerencial) K.piezas.exportar.prepararGerencial();
  }

  /* ══════════════ la vista del supervisor (solo la suya) ══════════════ */

  function vistaMia(caja, op) {
    op = op || {};
    caja.appendChild(K.nodo('<section class="cal-intro"><p>Así de completas llegan a Contratación las cuentas que apruebas, medidas con los mismos <b>6 bombillos</b> que guían al contratista. ' +
      'Combina la calidad con que pasan (80 %: variación, redacción completa y soporte) y las que Contratación devolvió después (20 %). Es tuya: nadie más ve este detalle desde Supervisión.</p></section>'));
    var zona = K.nodo('<div class="cal-mia"></div>');
    caja.appendChild(zona);
    var llave = 'calidad.mia';
    var ya = K.recordado ? K.recordado.leer(llave) : null;
    function pintar(D) {
      zona.innerHTML = '';
      var s = D && D.supervisor;
      if (!s) { zona.appendChild(K.nodo('<p class="cal-vacio">Todavía no hay cuentas tuyas aprobadas para medir.</p>')); return; }
      zona.appendChild(tarjeta(s, { sinPuesto: true, alInforme: function (x, btn) {
        btn.disabled = true;
        informe(D, { app: 'Supervisión' })['catch'](function (e) { K.aviso((e && e.message) || 'No se pudo armar el informe.', 'error', 7000); })
          .then(function () { btn.disabled = false; });
      } }));
      var L = lectura(D, null);
      if (L.compromisos.length) {
        var ul = K.nodo('<section class="kit-tarjeta cal-comp"><h3>' + K.icono('lapiz', 16) + ' Para tu próxima revisión</h3><ul role="list"></ul></section>');
        L.compromisos.forEach(function (c) { ul.querySelector('ul').appendChild(K.nodo('<li>' + K.esc(c) + '</li>')); });
        zona.appendChild(ul);
      }
    }
    if (ya) pintar(ya);
    var p = K.pedir(op.accion || 'calidadMia', {});
    (ya || !K.piezas.esqueletos ? p : K.piezas.esqueletos.mientras(zona, p, { forma: 'ficha', cuantos: 1 })).then(function (D) {
      if (!caja.isConnected) return;
      if (K.recordado) K.recordado.guardar(llave, D);
      pintar(D);
    }, function (e) { if (caja.isConnected && !ya) zona.appendChild(K.nodo('<p class="cal-vacio">' + K.esc((e && e.message) || 'No se pudo traer tu calidad.') + '</p>')); });
    if (K.piezas.exportar && K.piezas.exportar.prepararGerencial) K.piezas.exportar.prepararGerencial();
  }

  K.piezas.calidad = {
    MOTOR: MOTOR, BOMBILLOS: BOMBILLOS, MINIMO: MINIMO,
    codigo: codigo, puntos: puntos, partes: partes, resumir: resumir, deCuenta: deCuenta, deInforme: deInforme,
    nivel: nivel, pastilla: pastilla, bloqueDetalle: bloqueDetalle, tarjeta: tarjeta,
    lectura: lectura, informe: informe, vistaRanking: vistaRanking, vistaMia: vistaMia
  };
}());
