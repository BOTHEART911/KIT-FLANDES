/* ============================================================
   KIT-FLANDES · PIEZA 34 · VARIACIÓN DE ACTIVIDADES (30/10/2026)
   02/11/2026 · VARIACIÓN POR ESTRUCTURA Y 6 BOMBILLOS

   Qué hace
     Mide cada actividad con el MISMO motor del informe gerencial
     (kit/informe-cuentas.js, ESTR): se mide la FORMA de escribir, no el
     vocabulario. Los términos de la obligación, los que el contratista usa
     en varias cuentas, los de gestión y las dependencias se pueden repetir
     sin castigo. Repetida = esqueleto 60 % o más igual, idéntica, plantilla
     rellenada (la misma frase con solo cifras o fechas cambiadas) en la
     mitad o más de las frases, o el mismo orden de frases.
     Y 6 bombillos por actividad: qué distinto, cuántos, para quién,
     resultado, cuándo (amarillo si la fecha cae fuera del periodo) y
     soporte. Gris = no aplica. La misma cifra que la cuenta anterior sale
     como aviso informativo, nunca como falta.

   Quién la usa
     · CONTRATISTA (borrador): bombillos en vivo mientras escribe (espera de
       300 ms), cada uno dice qué detectó y resalta el fragmento al tocarlo;
       ver qué se repite y las preguntas para
       variar. No genera texto: no puede inventar actividades. No bloquea
       radicar: es una guía.
     · SUPERVISIÓN y CONTRATACIÓN (revisión): "Comparar con la cuenta
       anterior" con el mismo motor en lenguaje técnico, lado a lado, y el
       resumen por obligación en Tomar decisión.

   Rendimiento
     · Las actividades anteriores viajan por su ruta propia, de FONDO (cola,
       máximo 2 a la vez, se descarta al cambiar de vista) y se recuerdan
       por cuenta durante la sesión: la vista no espera nada.
     · Cada obligación se prepara UNA vez (léxico y esqueletos anteriores);
       medir una actividad tarda menos de 5 ms y no hace viajes.
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  var CACHE = {};   /* clave -> promesa de las actividades anteriores */

  /** El motor del informe gerencial (ya cargado o bajo demanda). */
  function ic() {
    var I = K.piezas.informeCuentas;
    if (I && I._estr && I._esGeneral) return Promise.resolve(I);
    if (K.piezas.exportar && K.piezas.exportar.cargarInformeCuentas) {
      return K.piezas.exportar.cargarInformeCuentas().then(function (x) {
        if (!x || !x._estr) throw new Error('El medidor no está al día.');
        return x;
      });
    }
    return Promise.reject(new Error('Falta el medidor del informe.'));
  }

  /** Las actividades anteriores, de fondo y una sola vez por cuenta. */
  function anteriores(accion, datos, clave) {
    if (CACHE[clave]) return CACHE[clave];
    var p = K.pedir(accion, datos, { fondo: true, ms: 60000 });
    CACHE[clave] = p;
    p['catch'](function () { if (CACHE[clave] === p) delete CACHE[clave]; });
    return p;
  }
  function olvidar(clave) { delete CACHE[clave]; }

  /** Los textos anteriores de UNA obligación: [{informe, texto, desde, hasta}], del más viejo al más nuevo. */
  function previosDe(d, n) {
    if (!d || !d.obligaciones) return [];
    var k = d.obligaciones.indexOf(Number(n));
    if (k < 0) return [];
    return (d.cuentas || []).slice().sort(function (a, b) { return a.informe - b.informe; })
      .map(function (c) { return { informe: c.informe, texto: String((c.actividades || [])[k] || '').trim(), desde: c.desde || '', hasta: c.hasta || '' }; })
      .filter(function (x) { return x.texto && x.texto !== '-'; });
  }

  /* ── fechas ── */
  function iso(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function masDias(i, n) { var d = new Date(i + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function masMes(i) { var d = new Date(i + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
  /**
   * El periodo de la cuenta que se escribe: el suyo si ya tiene fechas; si no
   * (borrador), el siguiente al de la última cuenta (un mes desde el día siguiente).
   */
  function periodo(d, desde, hasta) {
    var a = iso(desde), b = iso(hasta);
    if (a && b) return { desde: a, hasta: b };
    var act = d && d.actual;
    if (act && iso(act.desde) && iso(act.hasta)) return { desde: iso(act.desde), hasta: iso(act.hasta) };
    /* 03/11 · sin el periodo de la cuenta no se adivina: la fecha no se juzga hasta que lo ingrese */
    return { desde: '', hasta: '', sinPeriodo: true };
  }

  /** Prepara una obligación UNA vez (léxico y esqueletos anteriores). */
  function preparar(I, oblTexto, prev, nContrato) { return I._estr.preparar(oblTexto, prev || [], nContrato); }

  /** La medida de un texto: el resultado del motor (estado, %, bombillos…). */
  function medir(I, texto, P, ctx) {
    ctx = ctx || {};
    return I._estr.analizar(texto, P, {
      general: !!(ctx.obl && I._esGeneral(ctx.obl)), desde: iso(ctx.desde), hasta: iso(ctx.hasta),
      soporte: Number(ctx.soporte) || 0, nContrato: ctx.nContrato,
      avisarPeriodo: !!ctx.avisarPeriodo && !(iso(ctx.desde) && iso(ctx.hasta))
    });
  }

  /** HTML del texto con <mark> en los tramos dados. */
  function resaltar(texto, rangos, clase) {
    var t = String(texto || ''), R = (rangos || []).slice().sort(function (a, b) { return a[0] - b[0]; }), html = '', i = 0;
    R.forEach(function (r) {
      var a = Math.max(r[0], i), b = r[1];
      if (b <= a) return;
      html += K.esc(t.slice(i, a)) + '<mark class="' + (clase || 'var-rep') + '">' + K.esc(t.slice(a, b)) + '</mark>';
      i = b;
    });
    return (html + K.esc(t.slice(i))).replace(/\n/g, '<br>');
  }

  /* ── los 6 bombillos ── */
  var PREG = [
    '¿Qué hiciste en ESTE periodo que no hiciste en el anterior?',
    '¿Cuántos?',
    '¿Para quién o con quién?',
    '¿Qué quedó como resultado o entregable?',
    '¿Cuándo?',
    'Escribe solo lo que puedes demostrar o tu supervisor puede verificar'
  ];
  var AYUDA_ROJO = [
    'Cuenta lo que hiciste distinto en este periodo. Cambiar solo palabras o cifras no basta.',
    'Pon la cifra junto a lo que contaste: «18 visitas técnicas», «12 respuestas».',
    'Di para quién o con quién: «a la Secretaría de Hacienda», «con la comunidad de la vereda…».',
    'Di qué quedó: «se entregó el informe», «se radicó el oficio», «quedó el listado».',
    'Ubícalo en el tiempo: «el 15 de octubre», «la segunda semana del periodo».',
    'Carga en esta obligación las evidencias o adjuntos que demuestren lo que escribes; puedes escribir que no requiere adjunto si no aplica.'
  ];

  /** La frase técnica de cada bombillo para Supervisión y Contratación. */
  function tecnico(R, b) {
    var x = b.x ? ': «' + b.x + '»' : '';
    /* 02/11 · «Te ayudo»: un dato que el contratista dejó sin llenar */
    if (b.corchete) return 'Dejó sin llenar ' + b.corchete.map(function (z) { return '«[' + z + ']»'; }).join(', ');
    switch (b.k) {
      case 0:
        if (b.e === 'gris') return 'Sin cuenta anterior para comparar';
        if (b.e === 'verde') return 'Diferenció lo realizado frente al periodo anterior (estructura ' + R.pct + ' % igual a la cuenta ' + R.con + ')';
        if (R.tipo === 'identica') return 'Texto idéntico al de la cuenta ' + R.con;
        if (R.tipo === 'plantilla') return 'Plantilla rellenada de la cuenta ' + R.plCon + ': ' + R.plantillas + ' de ' + R.frases + ' frases solo cambian cifras o fechas';
        if (R.tipo === 'orden') return 'Mismas frases y en el mismo orden que la cuenta ' + R.ordenCon;
        return 'Estructura igual a la cuenta ' + R.con + ' (' + R.pct + ' %)';
      case 1: return b.e === 'verde' ? 'Cuantificó y acompañó la cifra' + x : 'No cuantificó: ninguna cifra acompañada de lo que se contó';
      case 2: return b.e === 'verde' ? 'Indicó destinatario o participante' + x : 'No indicó destinatario ni participante';
      case 3: return b.e === 'verde' ? 'Dejó entregable verificable' + x : 'No dejó resultado ni entregable verificable';
      case 4: return b.e === 'verde' ? 'Ubicó en el tiempo dentro del periodo' + x : (b.e === 'amarillo' ? 'Fecha fuera del periodo de la cuenta' + x : 'No ubicó la actividad en el tiempo');
      default:
        if (b.como === 'cargado') return 'Tiene soporte en evidencias (' + b.n + ')';
        if (b.como === 'noRequiere') return 'Declaró que no requiere adjunto' + x;
        if (b.como === 'donde') return 'Sin adjunto: indicó dónde verificar' + x;
        if (b.como === 'oblSinProducto') return 'Sin adjunto: la obligación puede no requerirlo';
        if (b.como === 'diceAdjunta') return 'Dice que adjunta un soporte que no está cargado' + x;
        return 'Sin soporte en evidencias ni adjuntos';
    }
  }

  /**
   * La lista de bombillos. modo 'contratista' | 'revisor'.
   * alTocar(k, rangos, b) se llama al tocar uno (para resaltar el fragmento;
   * 05/11: en modo revisor también el rojo/ámbar sin fragmento, para la receta).
   */
  function bombillos(R, modo, alTocar) {
    var ul = K.nodo('<ul class="var-bom" role="list"></ul>');
    R.b.forEach(function (b) {
      var titulo = modo === 'revisor' ? tecnico(R, b) : PREG[b.k];
      var det = modo === 'revisor' ? '' : (b.e === 'rojo' && R.estado !== 'vacia' && !b.corchete && !(b.k === 5 && b.como === 'diceAdjunta') ? AYUDA_ROJO[b.k] : b.d);
      /* 02/11 · el soporte dice si una evidencia es igual a la de una cuenta anterior (huellas) */
      var rep = b.k === 5 && R.notaSoporte ? '<small class="var-bom__rep">' + K.esc(R.notaSoporte) + '</small>' : '';
      /* 05/11 · en la revisión, el rojo y el ámbar también se tocan: muestran qué falta y la frase sugerida (teayudo.panelRevisor) */
      var tocable = b.r.length || (modo === 'revisor' && b.e !== 'verde' && b.e !== 'gris');
      var li = K.nodo('<li class="var-bom__i var-bom__i--' + b.e + (rep ? ' var-bom__i--conrep' : '') + '"><button type="button" class="var-bom__b"' + (tocable ? '' : ' aria-disabled="true"') + '>' +
        '<span class="var-bom__luz" aria-hidden="true"></span>' +
        '<span class="var-bom__tx"><b>' + K.esc(titulo) + '</b>' + (det ? '<small>' + K.esc(det) + '</small>' : '') + rep + '</span>' +
        '<span class="var-sr">' + (b.e === 'verde' ? 'cumple' : b.e === 'rojo' ? 'falta' : b.e === 'amarillo' ? 'revisar' : 'no aplica') + '</span></button></li>');
      li.querySelector('button').addEventListener('click', function () {
        if (!tocable) return;
        K.vibrar(6);
        var activo = li.classList.contains('var-bom__i--sel');
        Array.prototype.forEach.call(ul.querySelectorAll('.var-bom__i--sel'), function (z) { z.classList.remove('var-bom__i--sel'); });
        if (!activo) li.classList.add('var-bom__i--sel');
        if (alTocar) alTocar(activo ? -1 : b.k, activo ? [] : b.r, b);
      });
      ul.appendChild(li);
    });
    if (R.cifraIgual && R.cifraIgual.length) {
      var c = R.cifraIgual[0];
      ul.appendChild(K.nodo('<li class="var-bom__i var-bom__i--info"><span class="var-bom__b"><span class="var-bom__luz" aria-hidden="true"></span><span class="var-bom__tx">' +
        (modo === 'revisor' ? '<b>Misma cifra que la cuenta anterior (informativo): «' + K.esc(c.texto) + '»</b>'
          : '<b>Misma cantidad que en la cuenta ' + c.cuenta + ': «' + K.esc(c.texto) + '»</b><small>Es válida si es un hecho verídico y lo soportan tus evidencias.</small>') +
        '</span></span></li>'));
    }
    return ul;
  }

  /** Cuántos bombillos en verde (de los que aplican). */
  function verdes(R) {
    var ap = R.b.filter(function (b) { return b.e !== 'gris'; });
    return { v: ap.filter(function (b) { return b.e === 'verde'; }).length, n: ap.length };
  }

  /** La pastilla del resultado. */
  function pastilla(R) {
    if (R.estado === 'general') return '<span class="var-pas var-pas--gen">Obligación general · no se mide</span>';
    if (R.estado === 'noreq') return '<span class="var-pas var-pas--gen">No requerida en el periodo</span>';
    var v = verdes(R), r = v.n ? v.v / v.n : 0;
    return '<span class="var-pas var-pas--' + (r >= 0.8 ? 'ok' : (r >= 0.5 ? 'medio' : 'alto')) + '">' + v.v + ' de ' + v.n + ' en verde</span>' +
      (R.pct === null ? '' : '<span class="var-pas var-pas--' + (R.estado === 'repetida' ? 'alto' : 'ok') + '">' +
        (R.estado === 'repetida' ? 'Forma repetida' : 'Forma nueva') + ' · ' + R.pct + ' % igual a la cuenta ' + R.con + '</span>');
  }

  /** El consejo para el contratista: variar no basta, hay que enriquecer. */
  function consejo(R) {
    if (R.estado === 'general' || R.estado === 'noreq') return '';
    if (R.estado === 'vacia') return 'Escribe la actividad de este periodo para medirla.';
    if (R.corchetes && R.corchetes.length) return 'Llena lo que está entre [corchetes] con tus datos reales: mientras siga así, ese bombillo queda en rojo.';
    var faltan = R.b.filter(function (b) { return b.k >= 1 && b.k <= 4 && b.e === 'rojo'; }).map(function (b) { return ['', 'cuántos', 'para quién', 'qué resultado', 'cuándo'][b.k]; });
    if (R.estado === 'repetida') return R.b[0].d + ' Cambiar palabras no basta: cuenta qué hiciste distinto en este periodo' + (faltan.length ? ', y di ' + faltan.join(', ') + '.' : '.');
    if (faltan.length) return (R.pct === null ? '' : 'Cambiaste la forma de escribir. ') + 'Ahora enriquécela: di ' + faltan.join(', ') + '.';
    return 'Tu actividad dice qué hiciste, cuántos, para quién, qué quedó y cuándo.';
  }

  var PREGUNTAS = [
    '¿Qué hiciste en ESTE periodo que no hiciste en el anterior?',
    '¿Cuántos? (documentos, visitas, atenciones, procesos, publicaciones)',
    '¿Para quién o con quién? (dependencia, comunidad, entidad)',
    '¿Qué quedó como resultado o entregable?',
    '¿Cuándo? (fechas o semanas del periodo)'
  ];

  /**
   * Panel de comparación para la REVISIÓN (Supervisión y Contratación).
   * o = {n, texto (obligación), actual (actividad de esta cuenta), soporte}
   * d = respuesta de revisionAnterior; ctx = {desde, hasta} del periodo de esta cuenta.
   */
  function panelComparar(I, o, d, nContrato, informe, ctx) {
    ctx = ctx || {};
    var prev = previosDe(d, o.n);
    var caja = K.nodo('<div class="var-cmp" role="region" aria-label="Comparación con la cuenta anterior"></div>');
    var per = periodo(d, ctx.desde, ctx.hasta);
    var P = preparar(I, o.texto, prev, nContrato);
    var R = medir(I, o.actual, P, { obl: o.texto, desde: per.desde, hasta: per.hasta, soporte: o.soporte, nContrato: nContrato });
    caja.appendChild(K.nodo('<div class="var-cmp__pas">' + pastilla(R) + '</div>'));
    var actual = String(o.actual || '').trim();
    var b = K.nodo('<div class="var-cmp__txt var-cmp__act"></div>');
    function pintarActual(rangos, clase) { b.innerHTML = actual ? resaltar(actual, rangos, clase) : '<i>Sin actividades escritas.</i>'; }
    if (R.estado !== 'general' && R.estado !== 'noreq' && R.estado !== 'vacia') {
      caja.appendChild(bombillos(R, 'revisor', function (k, rangos) {
        if (k < 0) pintarActual(R.rep, 'var-rep'); else pintarActual(rangos, k === 0 ? 'var-rep' : 'var-hit');
      }));
    }
    if (!prev.length) {
      caja.appendChild(K.nodo('<p class="var-nada">' + (Number(informe) > 1 ? 'Las cuentas anteriores no tienen actividad escrita en esta obligación.' : 'Es la primera cuenta del contrato: no hay con qué comparar.') + '</p>'));
      return caja;
    }
    var ultima = prev[prev.length - 1];
    var rej = K.nodo('<div class="var-cmp__rej"></div>');
    var a = K.nodo('<div class="var-cmp__col"><p class="var-cmp__t">Cuenta ' + ultima.informe + ' (anterior)</p><div class="var-cmp__txt"></div></div>');
    a.querySelector('.var-cmp__txt').innerHTML = K.esc(ultima.texto).replace(/\n/g, '<br>');
    var col = K.nodo('<div class="var-cmp__col var-cmp__col--act"><p class="var-cmp__t">Cuenta ' + K.esc(String(informe || '')) + ' (esta)</p></div>');
    col.appendChild(b);
    pintarActual(R.rep, 'var-rep');
    rej.appendChild(a); rej.appendChild(col);
    caja.appendChild(rej);
    caja.appendChild(K.nodo('<p class="var-cmp__ley"><mark class="var-rep">Resaltado</mark> = forma de escribir que ya estaba en la cuenta ' + (R.con || ultima.informe) +
      '. Toca un bombillo para ver el fragmento que lo cumple <mark class="var-hit">así</mark>. Los términos de la obligación y las cifras no cuentan como repetición.' +
      (per.sinPeriodo ? ' La cuenta aún no tiene el periodo: las fechas no se juzgan.' : '') + '</p>'));
    return caja;
  }

  /**
   * Resumen para TOMAR DECISIÓN: una fila por obligación con sus bombillos.
   * obls = [{n, texto, actual, soporte}]
   */
  function resumen(I, obls, d, nContrato, informe, ctx) {
    ctx = ctx || {};
    var per = periodo(d, ctx.desde, ctx.hasta);
    var caja = K.nodo('<div class="var-res" role="region" aria-label="Calidad de las actividades"></div>');
    var rep = 0, comp = 0, filas = [];
    obls.forEach(function (o) {
      var prev = previosDe(d, o.n);
      var R = medir(I, o.actual, preparar(I, o.texto, prev, nContrato), { obl: o.texto, desde: per.desde, hasta: per.hasta, soporte: o.soporte, nContrato: nContrato });
      if (R.estado === 'general' || R.estado === 'noreq') return;
      if (R.pct !== null) { comp++; if (R.estado === 'repetida') rep++; }
      filas.push({ o: o, R: R });
    });
    caja.appendChild(K.nodo('<p class="var-res__t">' + K.icono('grafica', 15) + ' Calidad de las actividades <small>' +
      (comp ? rep + ' de ' + comp + ' repiten la forma de la cuenta anterior' : 'primera cuenta: sin comparación') + '</small></p>'));
    var ul = K.nodo('<ul class="var-res__l" role="list"></ul>');
    filas.forEach(function (f) {
      var v = verdes(f.R);
      var luces = f.R.b.map(function (b) { return '<span class="var-res__luz var-res__luz--' + b.e + '" title="' + K.esc(tecnico(f.R, b)) + '"></span>'; }).join('');
      var nota = f.R.estado === 'vacia' ? 'Sin actividad escrita' : (f.R.estado === 'repetida' ? tecnico(f.R, f.R.b[0]) : (v.v + ' de ' + v.n + ' en verde'));
      ul.appendChild(K.nodo('<li class="var-res__i' + (f.R.estado === 'repetida' || f.R.estado === 'vacia' ? ' var-res__i--malo' : '') + '"><b>' + f.o.n + '</b><span class="var-res__luces" aria-hidden="true">' + luces +
        '</span><span class="var-res__nota">' + K.esc(nota) + '</span></li>'));
    });
    caja.appendChild(ul);
    caja.appendChild(K.nodo('<p class="var-cmp__ley">Bombillos en orden: diferenció del periodo anterior · cuantificó · destinatario · entregable · ubicó en el tiempo · soporte. Es una guía: no reemplaza tu revisión.</p>'));
    return caja;
  }

  K.piezas.variacion = {
    ic: ic, anteriores: anteriores, olvidar: olvidar, previosDe: previosDe, periodo: periodo,
    preparar: preparar, medir: medir, resaltar: resaltar, bombillos: bombillos, verdes: verdes,
    pastilla: pastilla, consejo: consejo, tecnico: tecnico, preguntas: PREGUNTAS,
    panelComparar: panelComparar, resumen: resumen, ESPERA: 300
  };
}());
