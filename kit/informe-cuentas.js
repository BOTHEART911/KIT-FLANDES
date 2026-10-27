/* ============================================================
   KIT-FLANDES · PIEZA 23 · INFORME DE CUENTAS DE UN CONTRATO
   Entrega 6.3 (SUPERVISION). Hecha para usarse igual en CONTABILIDAD y
   TESORERÍA (fases 7 y 8): el CORE entrega las cuentas de UN contrato
   con FC63_informeCuentas_ y cada app registra su ruta con su permiso.

   Qué entrega
     · EXCEL (para trabajar): una fila por cuenta con TODAS las columnas
       que usan las tres oficinas — periodo, plata, planillas, revisión,
       orden de pago, egreso, giro, documentos y las actividades de cada
       obligación. Mismo orden en las tres apps: una macro o una tabla
       dinámica que sirva en una, sirve en las otras.
     · PDF (para leer): un informe gerencial membretado POR BLOQUES —
       arriba el contrato y las cifras (valor, cobrado, pagado, saldo),
       después una ficha por cuenta con su estado de color. Las
       actividades van solo si se piden (pueden ser decenas de páginas).
       No es la tabla del Excel pasada a PDF (regla de Oss, 23/09).

   27/10/2026 · INFORME GERENCIAL DEL CONTRATISTA (Supervisión y ADMIN)
     · aGerencial(datos): PDF con resumen ejecutivo, calificación de la
       calidad del reporte, cuantificación y copia y pega por obligación y
       cuenta, evidencias y adjuntos, tiempos, devoluciones con su motivo,
       seguridad social, alertas de control, conclusiones, recomendaciones y
       como anexo TODAS las actividades completas. Nada se recorta.
     · analizar(datos): el mismo análisis para la vista y el Excel.
     · El Excel suma: días para radicar, devoluciones y motivos, y por
       obligación la redacción, el % repetido y los adjuntos.
     · Los descuentos salen legibles (sin el JSON interno de Contabilidad).

   Uso
     KIT.piezas.informeCuentas.aGerencial(datos)
     KIT.piezas.informeCuentas.analizar(datos)
     KIT.piezas.informeCuentas.aExcel(datos)
     KIT.piezas.informeCuentas.aPDF(datos, { actividades: true|false })
     KIT.piezas.informeCuentas.cifras(datos) -> {cuentas, valor, cobrado, pagado, saldo, ...}

   datos = { contrato: {...}, cuentas: [...], generado }  (ruta informeContratista)

   Depende de kit/exportar.js (membrete, jsPDF y Excel bajo demanda).
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;

  var PAGADAS = ['PAGADA'];
  var EN_PAGO = ['CERRADA', 'ORDEN DE PAGO', 'EGRESO'];

  function nombre(s) { return K.piezas.personas ? K.piezas.personas.nombrePropio(s) : String(s || ''); }
  function titulo(s) {
    return nombre(s).replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); })
                    .replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); });
  }
  function f(iso) { return iso ? K.fecha(iso) : ''; }
  function plata(v) { return v ? K.pesos(v) : ''; }

  /** El color de cada estado, igual que en las listas de las apps. */
  function tono(estado) {
    var e = K.norm(estado || '');
    if (e === 'PAGADA') return 'ok';
    if (e === 'DEVUELTA' || e === 'INCOMPLETA') return 'malo';
    if (EN_PAGO.indexOf(e) >= 0) return 'info';
    if (e === 'REPORTADA' || e === 'PLAN DE PAGOS' || e === 'REVISADA POR SUPERVISOR' || e === 'APROBADA') return 'aviso';
    return '';
  }

  /** Las cifras del contrato: lo que dice arriba del PDF y lo que pinta la vista. */
  function cifras(d) {
    var c = (d && d.contrato) || {}, L = (d && d.cuentas) || [];
    var cobrado = 0, pagado = 0, enTramite = 0, ultimo = null;
    L.forEach(function (x) {
      if (K.norm(x.estado) === 'BORRADOR') return;
      cobrado += Number(x.cobro) || 0;
      if (PAGADAS.indexOf(K.norm(x.estado)) >= 0) pagado += Number(x.cobro) || 0;
      else enTramite += Number(x.cobro) || 0;
      if (!ultimo || x.informe >= ultimo.informe) ultimo = x;
    });
    var valor = Number(c.valorFinal) || 0;
    var total = (c.informes && c.informes.total) || (ultimo && ultimo.total) || 0;
    return {
      cuentas: L.length, total: total, valor: valor, cobrado: cobrado, pagado: pagado, enTramite: enTramite,
      saldo: ultimo ? (Number(ultimo.nuevo) || 0) : valor,
      avance: valor ? Math.round(cobrado * 100 / valor) : 0,
      pagadas: L.filter(function (x) { return PAGADAS.indexOf(K.norm(x.estado)) >= 0; }).length
    };
  }

  /* ══════════════ 27/10 · LIMPIEZA DE LO QUE VIENE DE OTRAS OFICINAS ══════════════ */

  /** "Descuentos aplicados" trae al final el JSON interno de Contabilidad
      ("#{"v":1,...}"): eso nunca sale en un documento. Cada línea
      "código | nombre | base | % | valor" queda legible. */
  function descuentosLegibles(s) {
    s = String(s || '').replace(/\r/g, '');
    var i = s.search(/\n?\s*#\s*\{/);
    if (i >= 0) s = s.slice(0, i);
    return s.split('\n').map(function (l) {
      var p = l.split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      if (p.length >= 5 && /^\d+$/.test(p[0])) return p[1] + ' (' + p[0] + '): ' + p[2] + ' × ' + p[3] + ' = $ ' + p[4];
      if (p.length === 2 && /^NETO$/i.test(p[0])) return 'Neto: $ ' + p[1];
      return p.join(' · ');
    }).filter(Boolean).join('\n');
  }

  /* ══════════════ 27/10 · EL ANÁLISIS GERENCIAL ══════════════
     Todo se calcula aquí, en el equipo, con lo que trae la ruta: cero viajes
     extra. Las reglas están escritas en la nota metodológica del PDF para
     que el supervisor las pueda explicar. */

  var NO_REQ = /(no\s+fue\s+requerid|no\s+(se\s+)?(le\s+)?(ha\s+)?requiri|no\s+se\s+requiri|no\s+fue\s+solicitad|no\s+se\s+solicit|no\s+aplic|no\s+hubo\s+(actividad|requerimiento)|sin\s+actividad|no\s+se\s+present[oó]\s+(ninguna|requerimiento)|no\s+se\s+ejecut)/i;
  var MENCIONA = /(adjunt|anex[oa]|\.(xlsx?|pdf|docx?|png|jpe?g|csv)\b|se\s+carg[oó]\s+al\s+drive|cargad[oa]s?\s+(en|al)\s+(el\s+)?drive|evidencia)/i;
  var PALABRAS_NUM = /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|ciento|doscientos|trescientos|mil)\b/gi;
  var MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';

  function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /** Cifras de GESTIÓN: lo que se contó o se entregó. No cuentan fechas, años,
      el número del contrato o de la cuenta, la numeración de los archivos
      ("1.1.", "2.2."), los nombres de archivo entre comillas, ni consecutivos
      largos (radicados, NIT, cuentas bancarias). */
  function cifrasGestion(texto, nContrato) {
    var t = ' ' + sinTildes(texto).toLowerCase() + ' ';
    t = t.replace(/["“”«»][^"“”«»]{0,200}["“”«»]/g, ' ');                       /* nombres de archivo */
    t = t.replace(/\b\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}\b/g, ' ');     /* 21/09/2026 */
    t = t.replace(new RegExp('\\b\\d{1,2}\\s+(de\\s+)?(' + MESES + ')(\\s+(de|del)\\s+\\d{4})?', 'g'), ' ');
    t = t.replace(new RegExp('\\b(' + MESES + ')\\s+(de|del)\\s+\\d{4}', 'g'), ' ');
    t = t.replace(/\b(19|20)\d{2}\b/g, ' ');                                          /* años */
    t = t.replace(/\b(contrato|cuenta|obligacion|informe|item|numeral|punto|vigencia|actividad|n[°o]\.?|no\.)\s*(n[°o]\.?\s*)?\d+\b/g, ' ');
    t = t.replace(/\b\d+(\.\d+)+\.?(?=\s)/g, function (m) { return /^\d{1,3}(\.\d{3})+$/.test(m.replace(/\.$/, '')) ? m : ' '; }); /* 1.1. pero no 4.500.000 */
    t = t.replace(/\b\d{7,}\b/g, ' ');
    if (nContrato) t = t.replace(new RegExp('\\b0*' + String(nContrato).replace(/\D/g, '') + '\\b', 'g'), ' ');
    var n = (t.match(/\$?\s?\b\d+([.,]\d+)*\s?%?/g) || []).length;
    n += (t.match(PALABRAS_NUM) || []).length;
    return n;
  }

  /** La redacción de una actividad: cuantifica, parcial, solo describe,
      no requerida o vacía. */
  function redaccion(texto, nContrato) {
    var t = String(texto || '').trim();
    if (!t || t === '-' || t.length < 3) return { clase: 'sin', cifras: 0 };
    var n = cifrasGestion(t, nContrato);
    /* "no fue requerida… sin embargo se apoyó en 14 procesos" SÍ es actividad */
    if (NO_REQ.test(sinTildes(t)) && !n) return { clase: 'noreq', cifras: 0 };
    return { clase: n >= 2 ? 'cuant' : (n === 1 ? 'parcial' : 'desc'), cifras: n };
  }

  /** Palabras normalizadas: sin tildes, sin signos y las cifras como '#'
      (cambiar solo los números de un texto copiado sigue siendo copiarlo). */
  function palabras(s) {
    return sinTildes(s).toLowerCase().replace(/\d+([.,]\d+)*/g, '#').replace(/[^a-z#ñ ]+/g, ' ').split(/\s+/).filter(Boolean);
  }
  function tejas(w, k) {
    var o = {};
    if (w.length < k) { if (w.length) o[w.join(' ')] = 1; return o; }
    for (var i = 0; i + k <= w.length; i++) o[w.slice(i, i + k).join(' ')] = 1;
    return o;
  }
  /** % del texto NUEVO que ya estaba escrito en el VIEJO (frases de 4 palabras). */
  function repetido(nuevo, viejo) {
    var a = tejas(palabras(nuevo), 4), b = tejas(palabras(viejo), 4), n = 0, t = 0, k;
    for (k in a) { t++; if (b[k]) n++; }
    return t ? Math.round(n * 100 / t) : 0;
  }

  function dias(a, b) {
    var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(a || '')), y = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(b || ''));
    if (!x || !y) return null;
    return Math.round((Date.UTC(+y[1], +y[2] - 1, +y[3]) - Date.UTC(+x[1], +x[2] - 1, +x[3])) / 864e5);
  }
  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /** '27/10/2026 09:41:18' o ISO -> 'aaaa-mm-dd' */
  function isoDe(s) {
    s = String(s || '');
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function mismaPersona(a, b) {
    var x = palabras(a).filter(function (w) { return w.length > 2; }), y = palabras(b).filter(function (w) { return w.length > 2; });
    if (!x.length || !y.length) return false;
    var n = x.filter(function (w) { return y.indexOf(w) >= 0; }).length;
    return n >= Math.min(2, Math.min(x.length, y.length));
  }
  /** Un intervalo negativo es una fecha mal registrada: no se promedia ni se pinta como dato. */
  function pos(v) { return v === null || v < 0 ? null : v; }
  function prom(L) { L = L.filter(function (v) { return v !== null && v !== undefined && !isNaN(v); }); return L.length ? L.reduce(function (a, b) { return a + b; }, 0) / L.length : null; }

  /** Obligación GENERAL (de conducta o de forma): horario, independencia,
      elementos de trabajo, cronograma, entrega de la cuenta… No se le exige
      cuantificar y es normal que su texto se repita: no entra en los puntajes. */
  var GENERAL = /(horario de trabajo|horario laboral|absoluta independencia|autonomia|elementos de trabajo|no aceptar ningun|sitio de trabajo|cronograma de la forma|informar por escrito .{0,40}alcalde|entregar la cuenta de cobro|cuenta de cobro dentro de|presentar la cuenta de cobro|seguridad social integral|pago de (los )?aportes|confidencialidad|reserva de la informacion|cuidado de los bienes|codigo de etica)/i;
  function esGeneral(t) { return GENERAL.test(sinTildes(t)); }

  var ETIQUETA_RED = { cuant: 'Cuantifica', parcial: 'Parcial', desc: 'Solo describe', noreq: 'No requerida', sin: 'Sin actividad' };
  var PUNTOS_RED = { cuant: 100, parcial: 60, desc: 20 };
  /** ¿Entra en los puntajes? Actividad con contenido de una obligación de gestión. */
  function mide(z) { return PUNTOS_RED[z.clase] !== undefined && !z.gen; }

  /** El análisis completo de un contrato. Lo usan el PDF, el Excel y la vista. */
  function analizar(d) {
    var c = (d && d.contrato) || {}, obl = c.obligaciones || [];
    var L = ((d && d.cuentas) || []).filter(function (x) { return K.norm(x.estado) !== 'BORRADOR'; })
      .slice().sort(function (a, b) { return (a.informe || 0) - (b.informe || 0); });
    var nC = c.contrato;
    var gen = obl.map(function (o) { return esGeneral(o.texto); });
    var celdas = [];                 /* [obligación][cuenta] */
    obl.forEach(function (o, i) {
      celdas[i] = L.map(function (x, j) {
        var txt = String((x.actividades || [])[i] || '').trim();
        var r = redaccion(txt, nC);
        var ev = Number((x.evidencias || [])[i]) || 0;
        var adj = ((x.adjuntos || [])[i] || []).length;
        /* cuentas de antes del 05/10: UN anexo para toda la cuenta; vale como soporte de cada obligación */
        var general = x.anexoViejo && !ev && !adj ? 1 : 0;
        var rep = null, repCon = null, ident = false;
        if (j > 0 && PUNTOS_RED[r.clase] !== undefined) {
          for (var k = 0; k < j; k++) {
            var prev = String((L[k].actividades || [])[i] || '').trim();
            if (!prev) continue;
            var p = repetido(txt, prev);
            if (rep === null || p > rep) { rep = p; repCon = L[k].informe; }
            if (txt.replace(/\s+/g, ' ').toLowerCase() === prev.replace(/\s+/g, ' ').toLowerCase()) ident = true;
          }
        }
        return { texto: txt, clase: r.clase, cifras: r.cifras, evid: ev, adj: adj, anexo: general, soporte: ev + adj + general, gen: gen[i],
                 menciona: MENCIONA.test(sinTildes(txt)), rep: rep, repCon: repCon, ident: ident, largo: txt.length };
      });
    });

    /* por cuenta */
    var porCuenta = L.map(function (x, j) {
      var col = obl.map(function (o, i) { return celdas[i][j]; });
      var reales = col.filter(function (z) { return mide(z); });
      var dRad = dias(x.hasta, x.radicada);
      var devs = (x.traza || []).filter(function (t) { return /DEVUELTA|INCOMPLETA/i.test(t[1]); })
        .map(function (t) { return { fecha: isoDe(t[0]), estado: String(t[1]).toUpperCase(), quien: t[2], motivo: String(t[3] || '').trim() }; });
      if (!devs.length && tono(x.estado) === 'malo') devs.push({ fecha: x.revisada || '', estado: String(x.estado).toUpperCase(), quien: x.decidio || '', motivo: x.observaciones || '' });
      return {
        x: x, informe: x.informe, reales: reales.length, total: obl.length - gen.filter(Boolean).length,
        cuant: reales.filter(function (z) { return z.clase === 'cuant'; }).length,
        parcial: reales.filter(function (z) { return z.clase === 'parcial'; }).length,
        desc: reales.filter(function (z) { return z.clase === 'desc'; }).length,
        noreq: col.filter(function (z) { return z.clase === 'noreq'; }).length,
        sin: col.filter(function (z) { return z.clase === 'sin'; }).length,
        rep: prom(col.filter(function (z) { return !z.gen; }).map(function (z) { return z.rep; })),
        soporte: reales.filter(function (z) { return z.soporte > 0; }).length,
        adjuntos: col.reduce(function (a, z) { return a + z.adj; }, 0),
        evidencias: col.reduce(function (a, z) { return a + z.evid; }, 0),
        mencionaSin: col.filter(function (z) { return z.menciona && !z.soporte && mide(z); }).length,
        diasRad: dRad, revision: pos(dias(x.radicada, x.revisada)), orden: pos(dias(x.revisada, x.fechaOrden)), pago: pos(dias(x.fechaOrden, x.fechaEgreso)),
        ciclo: pos(dias(x.radicada, x.fechaEgreso)), devoluciones: devs,
        incoherente: [dias(x.radicada, x.revisada), dias(x.revisada, x.fechaOrden), dias(x.fechaOrden, x.fechaEgreso), dias(x.radicada, x.fechaEgreso)].some(function (v) { return v !== null && v < 0; })
      };
    });

    /* por obligación */
    var porObl = obl.map(function (o, i) {
      var f = celdas[i], reales = f.filter(function (z) { return mide(z); });
      return {
        n: o.n, texto: o.texto, reales: reales.length,
        cuant: reales.filter(function (z) { return z.clase === 'cuant'; }).length,
        noreq: f.filter(function (z) { return z.clase === 'noreq'; }).length,
        sin: f.filter(function (z) { return z.clase === 'sin'; }).length,
        rep: prom(f.map(function (z) { return z.rep; })),
        soporte: reales.filter(function (z) { return z.soporte > 0; }).length,
        nunca: !reales.length && !gen[i], general: gen[i]
      };
    });

    /* puntajes 0-100 */
    var todas = [];
    celdas.forEach(function (f) { f.forEach(function (z) { if (mide(z)) todas.push(z); }); });
    var pCuant = prom(todas.map(function (z) { return PUNTOS_RED[z.clase]; }));
    var reps = []; celdas.forEach(function (f) { f.forEach(function (z) { if (z.rep !== null && !z.gen) reps.push(z.rep); }); });
    var pOrig = reps.length ? 100 - prom(reps) : null;
    var identicas = 0; celdas.forEach(function (f) { f.forEach(function (z) { if (z.ident && !z.gen && PUNTOS_RED[z.clase] !== undefined) identicas++; }); });
    var pSop = todas.length ? todas.filter(function (z) { return z.soporte > 0; }).length * 100 / todas.length : null;
    var pOport = prom(porCuenta.map(function (q) { if (q.diasRad === null) return null; return q.diasRad <= 5 ? 100 : (q.diasRad <= 15 ? 60 : 20); }));
    var comps = [
      { k: 'cuant', t: 'Cuantificación', v: pCuant, n: 'Actividades con cifras de gestión' },
      { k: 'orig', t: 'Originalidad', v: pOrig, n: reps.length ? 'Texto nuevo frente a cuentas anteriores' : 'Hace falta más de una cuenta' },
      { k: 'sop', t: 'Soporte', v: pSop, n: 'Actividades con evidencia o adjunto' },
      { k: 'oport', t: 'Oportunidad', v: pOport, n: 'Radicación tras el cierre del periodo' }
    ];
    var global = prom(comps.map(function (q) { return q.v; }));

    /* alertas de control */
    var alertas = [];
    var planillas = {};
    porCuenta.forEach(function (q, j) {
      var x = q.x;
      if (x.decidio && mismaPersona(x.decidio, c.nombre)) alertas.push({ tono: 'malo', cuenta: x.informe, t: 'La revisión de Supervisión quedó registrada a nombre del propio contratista (' + nombre(x.decidio) + '). Una cuenta no debe aprobarla quien la cobra.' });
      if (x.saldo && x.cobro && x.nuevo !== undefined && x.nuevo !== '' && Math.abs((Number(x.saldo) - Number(x.cobro)) - Number(x.nuevo)) > 1)
        alertas.push({ tono: 'malo', cuenta: x.informe, t: 'El nuevo saldo (' + K.pesos(x.nuevo) + ') no es el saldo anterior menos el cobro (' + K.pesos(Number(x.saldo) - Number(x.cobro)) + ').' });
      if (x.planilla) {
        var kp = String(x.planilla).trim();
        if (planillas[kp]) alertas.push({ tono: 'aviso', cuenta: x.informe, t: 'La planilla ' + kp + ' ya se había presentado en la cuenta ' + planillas[kp] + '.' });
        else planillas[kp] = x.informe;
      }
      if (q.incoherente) alertas.push({ tono: 'info', cuenta: x.informe, t: 'Las fechas del trámite no siguen el orden radicación → revisión → orden → egreso (por ejemplo, un egreso anterior a la radicación). Suele pasar con cuentas registradas antes del aplicativo; esos tiempos no se calculan.' });
      if (q.diasRad !== null && q.diasRad > 15) alertas.push({ tono: 'aviso', cuenta: x.informe, t: 'Se radicó ' + q.diasRad + ' días después del cierre del periodo.' });
      if (q.diasRad !== null && q.diasRad < 0) alertas.push({ tono: 'aviso', cuenta: x.informe, t: 'Se radicó ' + (-q.diasRad) + ' día(s) antes de terminar el periodo que cobra.' });
      if (q.sin && x.radicada) alertas.push({ tono: 'aviso', cuenta: x.informe, t: q.sin + (q.sin === 1 ? ' obligación quedó' : ' obligaciones quedaron') + ' sin ningún texto de actividad.' });
      if (q.mencionaSin) alertas.push({ tono: 'aviso', cuenta: x.informe, t: q.mencionaSin + (q.mencionaSin === 1 ? ' actividad dice' : ' actividades dicen') + ' que adjunta un soporte, pero la cuenta no tiene evidencia ni adjunto en esa obligación.' });
      if (j > 0) {
        var a = porCuenta[j - 1].x;
        if (a.base && x.base && Number(a.base) === Number(x.base) && Number(a.riesgos) !== Number(x.riesgos))
          alertas.push({ tono: 'info', cuenta: x.informe, t: 'Con la misma base de cotización, el aporte a riesgos pasó de ' + K.pesos(a.riesgos) + ' a ' + K.pesos(x.riesgos) + '.' });
        if (a.base && x.base && Number(a.base) !== Number(x.base))
          alertas.push({ tono: 'info', cuenta: x.informe, t: 'La base de cotización cambió de ' + K.pesos(a.base) + ' a ' + K.pesos(x.base) + '.' });
      }
    });

    var k = cifras(d);
    var plazo = null;
    if (c.inicio && c.fin) {
      var tot = dias(c.inicio, c.fin), van = dias(c.inicio, hoyIso());
      if (tot > 0) plazo = Math.max(0, Math.min(100, Math.round(van * 100 / tot)));
    }
    var devTot = porCuenta.reduce(function (a, q) { return a + q.devoluciones.length; }, 0);

    var A = {
      contrato: c, obl: obl, cuentas: L, celdas: celdas, porCuenta: porCuenta, porObl: porObl,
      comps: comps, global: global, alertas: alertas, cifras: k, plazo: plazo, devoluciones: devTot,
      reales: todas.length,
      cuantTot: todas.filter(function (z) { return z.clase === 'cuant'; }).length,
      descTot: todas.filter(function (z) { return z.clase === 'desc'; }).length,
      noreqTot: porCuenta.reduce(function (a, q) { return a + q.noreq; }, 0),
      sinTot: porCuenta.reduce(function (a, q) { return a + q.sin; }, 0),
      copias: reps.filter(function (v) { return v > 70; }).length, identicas: identicas, reutiliza: reps.filter(function (v) { return v >= 30 && v <= 70; }).length, comparadas: reps.length,
      nunca: porObl.filter(function (o) { return o.nunca; }),
      generales: porObl.filter(function (o) { return o.general; })
    };
    /* 27/10 · contratos en INFORME_AVANCES: el informe es IGUAL al de todos (misma
       calificación automática) y al final suma la sección de avances logrados */
    A.avances = false;
    A.seccionAvances = !!c.avances;
    if (A.seccionAvances) {
      A.hitos = porCuenta.map(function (q, j) {
        var h = [];
        obl.forEach(function (o, i) { if (!gen[i]) hitosDe(celdas[i][j].texto, nC).forEach(function (t) { if (h.indexOf(t) < 0) h.push(t); }); });
        return h;
      });
    }
    A.hallazgos = hallazgos(A);
    A.recomendaciones = recomendaciones(A);
    A.conclusion = conclusion(A);
    return A;
  }

  /** Las cifras de gestión de un texto, legibles: "283 asignaciones", "93 %", "13 capacitaciones". */
  function hitosDe(texto, nC) {
    var t = ' ' + String(texto || '').replace(/\s+/g, ' ') + ' ';
    t = t.replace(/["“”«»][^"“”«»]{0,200}["“”«»]/g, ' ').replace(/https?:\/\/\S+/g, ' ');
    t = t.replace(/\b\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}\b/g, ' ');
    t = t.replace(new RegExp('\\b\\d{1,2}\\s+(de\\s+)?(' + MESES + ')(\\s+(de|del)\\s+\\d{4})?', 'gi'), ' ');
    t = t.replace(/\b(19|20)\d{2}\b/g, ' ');
    t = t.replace(/\b(contrato|cuenta|obligaci[oó]n|informe|item|numeral|punto|vigencia|periodo|período|n[°º]\.?|no\.)\s*(n[°º]\.?\s*)?\d+\b/gi, ' ');
    if (nC) t = t.replace(new RegExp('\\b0*' + String(nC).replace(/\D/g, '') + '\\b', 'g'), ' ');
    var out = [], re = /(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*\)?\s*(%|[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+(?:de|del|por)\s+(?!el\b|la\b|los\b|las\b|un\b|una\b)[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)/g, m;
    while ((m = re.exec(t))) {
      var w = sinTildes(m[2]).toLowerCase().split(' ')[0];
      if (/^(dias?|mes(es)?|anos?|horas?|minutos?|semanas?|de|a|y|al|el|la|los|las|del|en|se|que|con|correspondientes?|siguientes?|respectivos?|anteriores?)$/.test(w)) continue;
      if (m[1].replace(/\D/g, '').length >= 7) continue;
      var h = m[1] + (m[2] === '%' ? ' %' : ' ' + m[2]);
      if (out.indexOf(h) < 0) out.push(h);
    }
    return out;
  }

  function hallazgosAvances(A) {
    var k = A.cifras, h = [];
    h.push('Radicó ' + A.cuentas.length + (A.cuentas.length === 1 ? ' cuenta' : ' cuentas') + ' por ' + K.pesos(k.cobrado) + ' (' + k.avance + ' % del valor del contrato); ' + k.pagadas + ' ya están pagadas.');
    var gest = A.porObl.filter(function (o) { return !o.general; });
    var todas = gest.filter(function (o) { return o.reales + o.noreq >= A.cuentas.length; });
    h.push('Reportó actividad en ' + gest.filter(function (o) { return o.reales; }).length + ' de ' + gest.length + ' obligaciones de gestión' + (todas.length ? ', ' + todas.length + ' de ellas en todas las cuentas' : '') + '.');
    var nH = A.hitos.reduce(function (a, L) { return a + L.length; }, 0);
    if (nH) h.push('Registra ' + nH + ' cifras de gestión a lo largo del contrato.');
    var ult = A.hitos[A.hitos.length - 1] || [];
    if (ult.length) h.push('En la cuenta más reciente: ' + ult.slice(0, 8).join(' · ') + '.');
    var soportes = A.porCuenta.reduce(function (a, q) { return a + q.adjuntos + q.evidencias; }, 0);
    var conAnexo = A.cuentas.filter(function (x) { return x.anexoViejo; }).length;
    if (soportes || conAnexo) h.push((soportes ? soportes + ' soportes cargados por obligación' : '') + (soportes && conAnexo ? ' y ' : '') +
      (conAnexo ? conAnexo + (conAnexo === 1 ? ' cuenta con su anexo general' : ' cuentas con su anexo general') : '') + '.');
    var rad = A.porCuenta.filter(function (q) { return q.diasRad !== null; });
    if (rad.length) h.push(rad.filter(function (q) { return q.diasRad <= 5; }).length + ' de ' + rad.length + ' cuentas radicadas dentro de los 5 días siguientes al cierre del periodo.');
    return h;
  }

  function conclusionAvances(A) {
    var c = A.contrato, k = A.cifras;
    return 'El contrato ' + (c.contrato || '') + ' de ' + nombre(c.nombre) + ' registra ' + A.cuentas.length + (A.cuentas.length === 1 ? ' cuenta' : ' cuentas') +
      ' por ' + K.pesos(k.cobrado) + ' (' + k.avance + ' % del valor)' + (A.plazo !== null ? ', con el ' + A.plazo + ' % del plazo transcurrido' : '') +
      '. Las actividades reportadas muestran un avance continuo en las obligaciones del contrato, documentado periodo a periodo con sus cifras de gestión y soportes, como se detalla en la evolución por obligación de este informe.';
  }

  function nivel(v) {
    if (v === null || v === undefined) return { t: 'Sin dato', tono: '' };
    return v >= 80 ? { t: 'Sólido', tono: 'ok' } : (v >= 60 ? { t: 'Aceptable con mejoras', tono: 'aviso' } : { t: 'Requiere atención', tono: 'malo' });
  }
  function pc(a, b) { return b ? Math.round(a * 100 / b) : 0; }

  function hallazgos(A) {
    var h = [];
    if (A.reales) h.push('De ' + A.reales + ' actividades reportadas con contenido, ' + A.cuantTot + ' (' + pc(A.cuantTot, A.reales) + ' %) cuantifican la gestión con cifras y ' + A.descTot + ' (' + pc(A.descTot, A.reales) + ' %) solo la describen.');
    if (A.comparadas) h.push(A.copias ? A.copias + ' de ' + A.comparadas + ' actividades repiten más del 70 % del texto de una cuenta anterior (copia y pega)' +
      (A.identicas ? '; ' + A.identicas + ' son idénticas palabra por palabra y las demás reutilizan la mayor parte del texto anterior con cambios menores (cifras o frases sueltas).' : ': reutilizan la mayor parte del texto anterior con cambios menores (cifras o frases sueltas).') :
      'Ninguna actividad repite más del 70 % del texto de una cuenta anterior: la redacción se renueva cuenta a cuenta.');
    if (A.generales.length) h.push((A.generales.length === 1 ? 'La obligación ' : 'Las obligaciones ') + A.generales.map(function (o) { return o.n; }).join(', ') + (A.generales.length === 1 ? ' es general' : ' son generales') + ' (de conducta o de forma: horario, independencia, elementos de trabajo, entrega de la cuenta). No se les exige cuantificar y es normal que su texto se repita: no entran en los puntajes.');
    if (A.noreqTot) h.push(A.noreqTot + ' registros de obligación dicen que la actividad no fue requerida en el periodo.');
    if (A.nunca.length) h.push((A.nunca.length === 1 ? 'La obligación ' : 'Las obligaciones ') + A.nunca.map(function (o) { return o.n; }).join(', ') + (A.nunca.length === 1 ? ' no registra' : ' no registran') + ' ninguna actividad ejecutada en todo el contrato.');
    var rad = A.porCuenta.filter(function (q) { return q.diasRad !== null; });
    if (rad.length) h.push('Radica en promedio ' + Math.round(prom(rad.map(function (q) { return q.diasRad; }))) + ' día(s) después del cierre de cada periodo; ' + rad.filter(function (q) { return q.diasRad <= 5; }).length + ' de ' + rad.length + ' cuentas dentro de los 5 días.');
    h.push(A.devoluciones ? 'Tiene ' + A.devoluciones + (A.devoluciones === 1 ? ' devolución registrada.' : ' devoluciones registradas.') : 'No registra devoluciones de cuentas.');
    A.alertas.filter(function (a) { return a.tono === 'malo'; }).forEach(function (a) { h.push('ALERTA en la cuenta ' + a.cuenta + ': ' + a.t); });
    return h;
  }

  function recomendaciones(A) {
    var r = [], comp = {};
    A.comps.forEach(function (q) { comp[q.k] = q.v; });
    if (comp.cuant !== null && comp.cuant < 80) r.push('Pedir al contratista que cada actividad indique cantidades verificables (casos atendidos, documentos revisados, registros cargados) y el entregable que la soporta, en lugar de descripciones generales.');
    if (A.copias) r.push('Exigir una redacción propia del periodo en las obligaciones que repiten el texto de cuentas anteriores; un texto copiado no demuestra ejecución en el nuevo periodo.');
    if (comp.sop !== null && comp.sop < 80) r.push('Solicitar evidencia o adjunto en cada obligación con actividad reportada (hasta 5 archivos por obligación en el aplicativo).');
    if (A.porCuenta.some(function (q) { return q.mencionaSin; })) r.push('Verificar los soportes que el texto dice adjuntar y que no están cargados en la cuenta.');
    if (comp.oport !== null && comp.oport < 80) r.push('Recordar al contratista radicar dentro de los 5 días siguientes al cierre de cada periodo para no atrasar el pago ni el cierre presupuestal.');
    if (A.nunca.length) r.push('Revisar con el contratista las obligaciones sin ejecución (' + A.nunca.map(function (o) { return o.n; }).join(', ') + ') y dejar constancia de si no fueron requeridas por la supervisión.');
    if (A.alertas.some(function (a) { return a.tono === 'malo'; })) r.push('Atender las alertas de control señaladas en rojo antes de aprobar la siguiente cuenta.');
    if (A.devoluciones > 1) r.push('Revisar con el contratista los motivos repetidos de devolución para que no se presenten en las próximas cuentas.');
    if (!r.length) r.push('Mantener el nivel de calidad del reporte: cuantifica, soporta y radica a tiempo. Puede usarse como referencia para otros contratistas.');
    return r;
  }

  function conclusion(A) {
    var c = A.contrato, n = nivel(A.global), k = A.cifras;
    var t = 'El contrato ' + (c.contrato || '') + ' de ' + nombre(c.nombre) + ' registra ' + A.cuentas.length + (A.cuentas.length === 1 ? ' cuenta' : ' cuentas') +
      ' por ' + K.pesos(k.cobrado) + ' (' + k.avance + ' % del valor)' + (A.plazo !== null ? ', con el ' + A.plazo + ' % del plazo transcurrido' : '') + '. ';
    t += 'La calidad del reporte se califica en ' + (A.global === null ? 'sin dato' : Math.round(A.global) + ' de 100') + ': ' + n.t.toLowerCase() + '. ';
    var fuerte = A.comps.filter(function (q) { return q.v !== null; }).sort(function (a, b) { return b.v - a.v; });
    if (fuerte.length > 1) t += 'Su punto más fuerte es ' + fuerte[0].t.toLowerCase() + ' (' + Math.round(fuerte[0].v) + ') y el que más necesita mejorar es ' + fuerte[fuerte.length - 1].t.toLowerCase() + ' (' + Math.round(fuerte[fuerte.length - 1].v) + ').';
    if (A.plazo !== null && k.avance + 15 < A.plazo) t += ' La ejecución financiera va por debajo del avance del plazo.';
    return t;
  }

  /* ══════════════ EXCEL: las columnas compartidas ══════════════ */

  function columnas(d) {
    var c = d.contrato || {};
    var cols = [
      { titulo: 'ID contrato', campo: function () { return c.id; } },
      { titulo: 'Documento', campo: function () { return c.doc; } },
      { titulo: 'Contratista', campo: function () { return c.nombre; } },
      { titulo: 'N° contrato', campo: function () { return c.contrato; } },
      { titulo: 'Secretaría', campo: function () { return c.secretaria; } },
      { titulo: 'Supervisor', campo: function (x) { return x.supervisor || c.supervisor; } },
      { titulo: 'N° informe', campo: 'informe', tipo: 'numero' },
      { titulo: 'Total informes', campo: 'total', tipo: 'numero' },
      { titulo: 'Tramo', campo: 'tramo' },
      { titulo: 'Cuenta en el tramo', campo: 'cuentaTramo' },
      { titulo: 'Estado', campo: 'estado' },
      { titulo: 'Fecha radicación', campo: 'radicada', tipo: 'fecha' },
      { titulo: 'Periodo desde', campo: 'desde', tipo: 'fecha' },
      { titulo: 'Periodo hasta', campo: 'hasta', tipo: 'fecha' },
      { titulo: 'Saldo anterior', campo: 'saldo', tipo: 'pesos' },
      { titulo: 'Cobro', campo: 'cobro', tipo: 'pesos' },
      { titulo: 'Nuevo saldo', campo: 'nuevo', tipo: 'pesos' },
      { titulo: 'Base estampillas', campo: 'baseEstampillas', tipo: 'pesos' },
      { titulo: 'N° planilla', campo: 'planilla' },
      { titulo: 'Mes planilla', campo: 'mesPlanilla' },
      { titulo: 'Base', campo: 'base', tipo: 'pesos' },
      { titulo: 'Salud', campo: 'salud', tipo: 'pesos' },
      { titulo: 'Pensión', campo: 'pension', tipo: 'pesos' },
      { titulo: 'Riesgos', campo: 'riesgos', tipo: 'pesos' },
      { titulo: 'FSP', campo: 'fsp', tipo: 'pesos' },
      { titulo: 'Fondo solidario', campo: 'fondoSolidario', tipo: 'pesos' },
      { titulo: 'N° planilla 2', campo: 'planilla2' },
      { titulo: 'Mes planilla 2', campo: 'mesPlanilla2' },
      { titulo: 'Base 2', campo: 'base2', tipo: 'pesos' },
      { titulo: 'Salud 2', campo: 'salud2', tipo: 'pesos' },
      { titulo: 'Pensión 2', campo: 'pension2', tipo: 'pesos' },
      { titulo: 'Riesgos 2', campo: 'riesgos2', tipo: 'pesos' },
      { titulo: 'N° factura electrónica', campo: 'factura' },
      { titulo: 'Fecha revisión', campo: 'revisada', tipo: 'fecha' },
      { titulo: 'Decidió en Supervisión', campo: 'decidio' },
      { titulo: 'Observaciones', campo: 'observaciones' },
      { titulo: 'N° orden de pago', campo: 'orden' },
      { titulo: 'Fecha orden de pago', campo: 'fechaOrden', tipo: 'fecha' },
      { titulo: 'N° egreso', campo: 'egreso' },
      { titulo: 'Fecha egreso', campo: 'fechaEgreso', tipo: 'fecha' },
      { titulo: 'N° egreso 2', campo: 'egreso2' },
      { titulo: 'Valor neto girado', campo: 'neto', tipo: 'pesos' },
      { titulo: 'Descuentos aplicados', campo: function (x) { return descuentosLegibles(x.descuentos); } },
      { titulo: 'Detalles de pago', campo: 'detallesPago' },
      { titulo: 'RP cesión', campo: 'rpCesion' },
      { titulo: 'Informe de supervisión', campo: 'informeSup' },
      { titulo: 'Acta de cumplimiento', campo: 'acta' },
      { titulo: 'Carpeta de la cuenta', campo: function (x) { return x.idCuenta ? 'https://drive.google.com/drive/folders/' + x.idCuenta : ''; } }
    ];
    (c.obligaciones || []).forEach(function (o, i) {
      cols.push({ titulo: 'Actividades obligación ' + o.n, campo: function (x) { return (x.actividades || [])[i] || ''; } });
    });
    (c.obligaciones || []).forEach(function (o, i) {
      cols.push({ titulo: 'Evidencias obligación ' + o.n, campo: function (x) { return (x.evidencias || [])[i] || 0; }, tipo: 'numero' });
    });
    /* 27/10 · el análisis gerencial también en el Excel (se calcula una vez por descarga) */
    var A = analizar(d), pos = {};
    A.cuentas.forEach(function (x, j) { pos[x.fila || ('i' + x.informe)] = j; });
    function celda(x, i) { var j = pos[x.fila || ('i' + x.informe)]; return j === undefined ? null : A.celdas[i][j]; }
    function qc(x) { var j = pos[x.fila || ('i' + x.informe)]; return j === undefined ? null : A.porCuenta[j]; }
    cols.push({ titulo: 'Días para radicar (tras el periodo)', campo: function (x) { var q = qc(x); return q && q.diasRad !== null ? q.diasRad : ''; }, tipo: 'numero' });
    if (!A.avances) {
      cols.push({ titulo: 'Devoluciones', campo: function (x) { var q = qc(x); return q ? q.devoluciones.length : ''; }, tipo: 'numero' });
      cols.push({ titulo: 'Motivos de devolución', campo: function (x) { var q = qc(x); return q ? q.devoluciones.map(function (v) { return K.fecha(v.fecha) + ' ' + v.estado + ' (' + nombre(v.quien) + '): ' + v.motivo; }).join('\n') : ''; } });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: 'Redacción obligación ' + o.n, campo: function (x) { var z = celda(x, i); return z ? ETIQUETA_RED[z.clase] : ''; } });
      });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: '% repetido obligación ' + o.n, campo: function (x) { var z = celda(x, i); return z && z.rep !== null ? z.rep : ''; }, tipo: 'numero' });
      });
    }
    (c.obligaciones || []).forEach(function (o, i) {
      cols.push({ titulo: 'Adjuntos obligación ' + o.n, campo: function (x) { return ((x.adjuntos || [])[i] || []).length; }, tipo: 'numero' });
    });
    return cols;
  }

  function nombreArchivo(d, que) {
    var c = d.contrato || {};
    return que + ' ' + (c.nombre || '') + ' - ' + (c.contrato || '');
  }

  function aExcel(d) {
    if (!K.piezas.exportar) return Promise.reject(new Error('Falta el exportador.'));
    /* Excel no acepta más de 32.767 caracteres en una celda: lo que pase se
       parte con aviso (el PDF lleva el texto completo). Hoy la actividad más
       larga del CORE mide 1.391 caracteres. */
    var cols = columnas(d).map(function (c) {
      var campo = c.campo;
      return { titulo: c.titulo, tipo: c.tipo, campo: function (x) {
        var v = typeof campo === 'function' ? campo(x) : x[campo];
        return typeof v === 'string' && v.length > 32000 ? v.slice(0, 32000) + ' [sigue en el PDF]' : v;
      } };
    });
    return K.piezas.exportar.aExcel(nombreArchivo(d, 'Informe de cuentas'), cols, d.cuentas || []);
  }

  /* ══════════════ PDF: el informe gerencial por bloques ══════════════ */

  function aPDF(d, op) {
    op = op || {};
    if (!K.piezas.exportar) return Promise.reject(new Error('Falta el exportador.'));
    var c = d.contrato || {}, k = cifras(d);
    var obl = c.obligaciones || [];
    var cols = [
      { titulo: 'Periodo', campo: function (x) { return x.desde ? f(x.desde) + ' al ' + f(x.hasta) : ''; } },
      { titulo: 'Radicada', campo: function (x) { return f(x.radicada); } },
      { titulo: 'Saldo anterior', campo: function (x) { return plata(x.saldo); } },
      { titulo: 'Cobro', campo: function (x) { return plata(x.cobro); } },
      { titulo: 'Nuevo saldo', campo: function (x) { return x.saldo || x.nuevo ? K.pesos(x.nuevo) : ''; } },
      { titulo: 'Tramo', campo: function (x) { return x.tramo ? x.tramo + (x.cuentaTramo ? ' · cuenta ' + x.cuentaTramo : '') : ''; } },
      { titulo: 'Planilla', campo: function (x) { return x.planilla ? x.planilla + (x.mesPlanilla ? ' · ' + x.mesPlanilla : '') : ''; } },
      { titulo: 'Seguridad social', campo: function (x) {
          if (!x.base) return '';
          return 'Base ' + K.pesos(x.base) + ' · salud ' + K.pesos(x.salud) + ' · pensión ' + K.pesos(x.pension) + ' · riesgos ' + K.pesos(x.riesgos) +
            (x.fsp ? ' · FSP ' + K.pesos(x.fsp) : '');
        } },
      { titulo: 'Planilla anexa', campo: function (x) { return x.planilla2 ? x.planilla2 + (x.mesPlanilla2 ? ' · ' + x.mesPlanilla2 : '') + (x.base2 ? ' · base ' + K.pesos(x.base2) : '') : ''; } },
      { titulo: 'Revisión', campo: function (x) { return x.revisada ? f(x.revisada) + (x.decidio ? ' · ' + nombre(x.decidio) : '') : ''; } },
      { titulo: 'Orden de pago', campo: function (x) { return x.orden ? 'N° ' + x.orden + (x.fechaOrden ? ' del ' + f(x.fechaOrden) : '') : ''; } },
      { titulo: 'Egreso', campo: function (x) { return x.egreso ? 'N° ' + x.egreso + (x.fechaEgreso ? ' del ' + f(x.fechaEgreso) : '') + (x.egreso2 ? ' y N° ' + x.egreso2 : '') : ''; } },
      { titulo: 'Neto girado', campo: function (x) { return x.neto ? K.pesos(x.neto) : ''; } },
      { titulo: 'RP de la cesión', campo: 'rpCesion' },
      { titulo: 'Documentos', campo: function (x) {
          var t = [];
          if (x.informeSup) t.push('Informe de supervisión: ' + x.informeSup);
          if (x.acta) t.push('Acta de cumplimiento: ' + x.acta);
          return t.join('\n');
        }, largo: true },
      { titulo: 'Observaciones', campo: 'observaciones', largo: true },
      { titulo: 'Descuentos aplicados', campo: function (x) { return descuentosLegibles(x.descuentos); }, largo: true },
      { titulo: 'Detalles del pago', campo: 'detallesPago', largo: true }
    ];
    if (op.actividades) {
      obl.forEach(function (o, i) {
        cols.push({ titulo: 'Obligación ' + o.n, campo: function (x) { return (x.actividades || [])[i] || ''; }, largo: true });
      });
    }
    var sub = [
      'Contrato ' + (c.contrato || '') + ' · CC/NIT ' + (c.doc || ''),
      titulo(c.secretaria),
      'Supervisor(a): ' + nombre(c.supervisor)
    ].filter(Boolean).join(' · ');
    var resumen = [
      { etiqueta: 'Valor del contrato', valor: K.pesos(k.valor) },
      { etiqueta: 'Cobrado (' + k.cuentas + (k.total ? ' de ' + k.total : '') + ' cuentas)', valor: K.pesos(k.cobrado) },
      { etiqueta: 'Pagado (' + k.pagadas + ')', valor: K.pesos(k.pagado), tono: 'ok' },
      { etiqueta: 'Saldo por ejecutar', valor: K.pesos(k.saldo) }
    ];
    return K.piezas.exportar.aPDF(nombreArchivo(d, 'Informe de cuentas'), cols, (d.cuentas || []).slice(), {
      subtitulo: sub + (c.objeto ? ' · Objeto: ' + c.objeto : '') + (c.inicio ? ' · Plazo: ' + f(c.inicio) + ' al ' + f(c.fin) : ''),
      bloque: {
        titulo: function (x) { return 'Cuenta ' + x.informe + (x.total ? ' de ' + x.total : ''); },
        sub: function (x) { return x.desde ? 'Periodo del ' + f(x.desde) + ' al ' + f(x.hasta) : (x.radicada ? 'Radicada el ' + f(x.radicada) : ''); },
        marca: function (x) { return x.estado; },
        tono: function (x) { return tono(x.estado); },
        omitir: ['Periodo']
      },
      resumen: resumen
    });
  }

  /* ══════════════ 27/10 · EL PDF GERENCIAL DEL CONTRATISTA ══════════════
     Se dibuja en el equipo con jsPDF (sin viajes). Regla de oro: NADA se
     recorta. Todo texto pasa por parrafo(), que parte línea por línea y salta
     de hoja cuando no cabe; las tablas repiten su encabezado en cada hoja. */

  var COL = {
    verde: [6, 64, 43], verde2: [17, 104, 70], verdeClaro: [232, 242, 236], oro: [201, 158, 46],
    tinta: [22, 32, 27], gris: [90, 104, 97], gris2: [145, 156, 150], linea: [219, 227, 222], fondo: [245, 248, 246],
    blanco: [255, 255, 255], ok: [30, 132, 73], malo: [192, 57, 43], aviso: [214, 140, 20], info: [41, 98, 160]
  };
  var FONDO_RED = { cuant: [214, 238, 223], parcial: [251, 236, 205], desc: [248, 216, 211], noreq: [234, 237, 236], sin: [255, 255, 255] };
  var CORTO_RED = { cuant: 'C', parcial: 'P', desc: 'D', noreq: 'NR', sin: '—' };

  function dibujarGerencial(d, A, R) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var mx = 15, util = W - mx * 2, abajo = H - 16, arriba = 27;
    var M = R.marca || {}, c = A.contrato, k = A.cifras;
    var municipio = String(M.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES');
    var quien = nombre(c.nombre) + ' · Contrato ' + (c.contrato || '');
    var y = 0, nSec = 0;

    function f(e, t, col) { doc.setFont('helvetica', e); doc.setFontSize(t); var q = col || COL.tinta; doc.setTextColor(q[0], q[1], q[2]); }
    function fill(q) { doc.setFillColor(q[0], q[1], q[2]); }
    function draw(q, g) { doc.setDrawColor(q[0], q[1], q[2]); doc.setLineWidth(g || 0.2); }
    function lineas(t, e, s, w) { f(e, s); return doc.splitTextToSize(String(t == null ? '' : t), w); }
    function corto(t, e, s, w) {
      f(e, s); t = String(t == null ? '' : t);
      if (doc.getTextWidth(t) <= w) return t;
      while (t.length > 1 && doc.getTextWidth(t + '…') > w) t = t.slice(0, -1);
      return t + '…';
    }
    /** Fuente que se achica hasta que el texto quepa (nunca se recorta). */
    function ajustar(t, e, s, w, col) { f(e, s, col); while (s > 5 && doc.getTextWidth(String(t)) > w) { s -= 0.3; f(e, s, col); } }
    function cabecera() {
      fill(COL.verde); doc.rect(0, 0, W, 16, 'F');
      fill(COL.oro); doc.rect(0, 16, W, 0.8, 'F');
      if (R.escudo) { try { doc.addImage(R.escudo, 'PNG', mx, 2.5, 11, 11, 'escudo'); } catch (e) {} }
      var xt = R.escudo ? mx + 14 : mx;
      f('bold', 9, COL.blanco); doc.text(municipio, xt, 7.6);
      f('normal', 7, [205, 225, 214]); doc.text((M.MARCA_NIT ? 'NIT ' + M.MARCA_NIT + '  ·  ' : '') + (A.avances ? 'Informe de avances del contratista' : 'Informe gerencial del contratista'), xt, 11.6);
      ajustar(quien, 'normal', 7.2, 95, [205, 225, 214]); doc.text(quien, W - mx, 9.6, { align: 'right' });
      y = arriba;
    }
    function hoja() { doc.addPage(); cabecera(); }
    function cabe(h) { if (y + h > abajo) { hoja(); return false; } return true; }

    /** Un párrafo que nunca se corta: salta de hoja línea por línea. */
    function parrafo(t, op) {
      op = op || {};
      var s = op.t || 8.6, lh = op.lh || s * 0.47, x = op.x || mx, w = op.w || (util - (x - mx));
      var L = lineas(t, op.e || 'normal', s, w - (op.vineta ? 4 : 0));
      L.forEach(function (l, i) {
        if (y + lh > abajo) hoja();
        f(op.e || 'normal', s, op.col || COL.tinta);
        if (op.vineta && i === 0) { fill(op.vcol || COL.verde2); doc.circle(x + 1.2, y - lh * 0.32, 0.8, 'F'); }
        doc.text(l, x + (op.vineta ? 4 : 0), y);
        y += lh;
      });
      y += op.despues === undefined ? 1.2 : op.despues;
    }
    function seccion(t, intro) {
      nSec++;
      cabe(28);
      fill(COL.verde); doc.roundedRect(mx, y, 7, 7, 1.3, 1.3, 'F');
      f('bold', 8.5, COL.blanco); doc.text(String(nSec), mx + 3.5, y + 4.9, { align: 'center' });
      f('bold', 12.5, COL.verde); doc.text(t, mx + 10, y + 5.2);
      fill(COL.oro); doc.rect(mx + 10, y + 7.4, 20, 0.7, 'F');
      y += 13;
      if (intro) parrafo(intro, { t: 8.3, col: COL.gris, despues: 2 });
    }
    function subt(t) { cabe(14); f('bold', 9.4, COL.tinta); doc.text(t, mx, y); draw(COL.linea, 0.25); doc.line(mx, y + 1.8, W - mx, y + 1.8); y += 6.5; }

    /** Tabla: columnas [{t, w, al, e}] (w en mm, la última toma el resto),
        filas: arreglos de celdas (texto o {t, fondo, col, e}). Las celdas se
        parten en varias líneas; el encabezado se repite en cada hoja. */
    function tabla(cols, filas, op) {
      op = op || {};
      var ws = cols.map(function (q) { return q.w || 0; }), resto = util - ws.reduce(function (a, b) { return a + b; }, 0);
      ws = ws.map(function (w) { return w || resto; });
      var s = op.t || 7.6, lh = s * 0.43, pad = 1.6;
      function encabezado() {
        var hh = 7;
        fill(COL.verde); doc.rect(mx, y, util, hh, 'F');
        var x = mx;
        cols.forEach(function (q, i) {
          ajustar(q.t, 'bold', 6.9, ws[i] - 2 * pad, COL.blanco);
          var tx = q.t;
          doc.text(tx, q.al === 'c' ? x + ws[i] / 2 : (q.al === 'd' ? x + ws[i] - pad : x + pad), y + 4.6, { align: q.al === 'c' ? 'center' : (q.al === 'd' ? 'right' : 'left') });
          x += ws[i];
        });
        y += hh;
      }
      cabe(7 + lh * 2 + 5);
      encabezado();
      filas.forEach(function (fila, r) {
        var celdas = fila.map(function (cel, i) {
          var o = (cel && typeof cel === 'object') ? cel : { t: cel };
          return { o: o, L: lineas(o.t === null || o.t === undefined ? '' : o.t, o.e || cols[i].e || 'normal', s, ws[i] - 2 * pad) };
        });
        var n = Math.max.apply(null, celdas.map(function (z) { return z.L.length || 1; }));
        var maxLineas = Math.floor((abajo - arriba - 7 - 2 * pad) / lh);
        /* una fila más alta que una hoja entera se parte en trozos */
        var desde = 0;
        while (desde < n) {
          var cuantas = Math.min(n - desde, maxLineas);
          var h = cuantas * lh + 2 * pad;
          if (y + h > abajo) { hoja(); encabezado(); }
          var x = mx;
          celdas.forEach(function (z, i) {
            var fondo = z.o.fondo || (r % 2 ? COL.fondo : null);
            if (fondo) { fill(fondo); doc.rect(x, y, ws[i], h, 'F'); }
            f(z.o.e || cols[i].e || 'normal', s, z.o.col || COL.tinta);
            z.L.slice(desde, desde + cuantas).forEach(function (l, j) {
              var al = z.o.al || cols[i].al;
              doc.text(l, al === 'c' ? x + ws[i] / 2 : (al === 'd' ? x + ws[i] - pad : x + pad), y + pad + lh * (j + 0.78), { align: al === 'c' ? 'center' : (al === 'd' ? 'right' : 'left') });
            });
            x += ws[i];
          });
          draw(COL.linea, 0.15); doc.line(mx, y + h, mx + util, y + h);
          y += h;
          desde += cuantas;
        }
      });
      y += op.despues === undefined ? 4 : op.despues;
    }

    function barraH(x, yy, w, v, col) {
      fill(COL.linea); doc.roundedRect(x, yy, w, 2.6, 1.3, 1.3, 'F');
      if (v > 0) { fill(col); doc.roundedRect(x, yy, Math.max(2.6, w * Math.min(100, v) / 100), 2.6, 1.3, 1.3, 'F'); }
    }
    function tonoCol(t) { return COL[t] || COL.verde2; }
    function nd(v) { return v === null || v === undefined ? '—' : String(v); }
    function pctTxt(v) { return v === null || v === undefined ? '—' : Math.round(v) + ' %'; }

    /* ───────────── PORTADA Y RESUMEN EJECUTIVO ───────────── */
    fill(COL.verde); doc.rect(0, 0, W, 44, 'F');
    fill(COL.oro); doc.rect(0, 44, W, 1.4, 'F');
    if (R.escudo) { try { doc.addImage(R.escudo, 'PNG', mx, 8, 22, 22, 'escudo'); } catch (e) {} }
    var xt = R.escudo ? mx + 26 : mx;
    f('bold', 13, COL.blanco); doc.text(municipio, xt, 15);
    f('normal', 8, [205, 225, 214]);
    doc.text((M.MARCA_NIT ? 'NIT ' + M.MARCA_NIT + '  ·  ' : '') + (window.MARCA && window.MARCA.TITULO ? window.MARCA.TITULO : 'Ecosistema digital FLANDES-CORE'), xt, 20.5);
    f('bold', 17, COL.blanco); doc.text(A.avances ? 'Informe de avances del contratista' : 'Informe gerencial del contratista', xt, 31);
    f('normal', 8, [205, 225, 214]); doc.text('Generado el ' + new Date().toLocaleString('es-CO'), xt, 37.5);
    if (R.icono) { try { doc.addImage(R.icono, 'PNG', W - mx - 16, 12, 16, 16, 'icono'); } catch (e) {} }
    y = 54;

    f('bold', 15, COL.tinta);
    lineas(nombre(c.nombre), 'bold', 15, util).forEach(function (l) { doc.text(l, mx, y); y += 6.5; });
    parrafo('Contrato ' + (c.contrato || '') + '  ·  CC/NIT ' + (c.doc || '') + '  ·  ' + titulo(c.secretaria) + '  ·  Supervisor(a): ' + nombre(c.supervisor) +
      (c.inicio ? '  ·  Plazo: ' + f2(c.inicio) + ' al ' + f2(c.fin) : '') + (c.estado ? '  ·  ' + c.estado : ''), { t: 8.6, col: COL.gris });
    if (c.objeto) parrafo('Objeto: ' + c.objeto, { t: 8.2, col: COL.gris, despues: 3 });

    /* las cifras */
    var cif = [
      ['Valor del contrato', K.pesos(k.valor), ''],
      ['Cobrado (' + A.cuentas.length + (k.total ? ' de ' + k.total : '') + ' cuentas)', K.pesos(k.cobrado), ''],
      ['Pagado (' + k.pagadas + ')', K.pesos(k.pagado), 'ok'],
      ['Saldo por ejecutar', K.pesos(k.saldo), '']
    ];
    cabe(20);
    var cw = (util - 9) / 4;
    cif.forEach(function (q, i) {
      var x = mx + i * (cw + 3);
      fill(COL.fondo); draw(COL.linea, 0.3); doc.roundedRect(x, y, cw, 15, 2, 2, 'FD');
      ajustar(q[1], 'bold', 11.5, cw - 5, q[2] ? tonoCol(q[2]) : COL.verde); doc.text(q[1], x + 3, y + 7);
      ajustar(q[0].toUpperCase(), 'normal', 6.6, cw - 5, COL.gris); doc.text(q[0].toUpperCase(), x + 3, y + 12);
    });
    y += 20;
    /* ejecución vs plazo */
    f('bold', 7.6, COL.gris); doc.text('EJECUCIÓN FINANCIERA', mx, y); doc.text(k.avance + ' % cobrado', mx + util / 2 - 4, y, { align: 'right' });
    barraH(mx, y + 1.6, util / 2 - 4, k.avance, COL.verde2);
    if (A.plazo !== null) {
      doc.text('PLAZO TRANSCURRIDO', mx + util / 2 + 4, y); doc.text(A.plazo + ' %', W - mx, y, { align: 'right' });
      barraH(mx + util / 2 + 4, y + 1.6, util / 2 - 4, A.plazo, COL.oro);
    }
    y += 10;

    if (A.avances) {
      /* informe de avances: sin calificación, con las cifras del contrato */
      var nObl = A.porObl.filter(function (o) { return !o.general; });
      var kp = [
        [String(A.cuentas.length), 'Cuentas radicadas'],
        [String(A.cifras.pagadas), 'Cuentas pagadas'],
        [nObl.filter(function (o) { return o.reales; }).length + ' de ' + nObl.length, 'Obligaciones con avance'],
        [String(A.hitos.reduce(function (a, L) { return a + L.length; }, 0)), 'Cifras de gestión reportadas']
      ];
      cabe(30);
      fill(COL.fondo); draw(COL.linea, 0.3); doc.roundedRect(mx, y, util, 26, 2.5, 2.5, 'FD');
      fill(COL.ok); doc.roundedRect(mx, y, 2.2, 26, 1, 1, 'F');
      f('bold', 7.4, COL.gris); doc.text('INFORME DE AVANCES', mx + 7, y + 6.5);
      var kw = (util - 14) / 4;
      kp.forEach(function (q, i) {
        var x = mx + 7 + i * kw;
        ajustar(q[0], 'bold', 16, kw - 4, COL.ok); doc.text(q[0], x, y + 16);
        ajustar(q[1].toUpperCase(), 'normal', 6.6, kw - 4, COL.gris); doc.text(q[1].toUpperCase(), x, y + 21.5);
      });
      y += 32;
    } else {
      /* la calificación */
      var nv = nivel(A.global);
      cabe(54);
      var y0 = y;
      fill(COL.fondo); draw(COL.linea, 0.3); doc.roundedRect(mx, y, util, 50, 2.5, 2.5, 'FD');
      fill(tonoCol(nv.tono)); doc.roundedRect(mx, y, 2.2, 50, 1, 1, 'F');
      f('bold', 7.4, COL.gris); doc.text('CALIDAD DEL REPORTE', mx + 7, y + 7);
      f('bold', 30, tonoCol(nv.tono)); doc.text(A.global === null ? '—' : String(Math.round(A.global)), mx + 7, y + 22);
      f('normal', 8, COL.gris); doc.text('de 100', mx + 7, y + 28);
      f('bold', 8.6, tonoCol(nv.tono)); doc.text(nv.t, mx + 7, y + 35);
      var bx = mx + 52, bw = util - 52 - 8, by = y + 7;
      A.comps.forEach(function (q) {
        var tq = nivel(q.v).tono;
        f('bold', 8, COL.tinta); doc.text(q.t, bx, by);
        f('bold', 8, q.v === null ? COL.gris2 : tonoCol(tq)); doc.text(q.v === null ? 'N/A' : String(Math.round(q.v)), bx + bw, by, { align: 'right' });
        barraH(bx, by + 1.5, bw, q.v || 0, tonoCol(tq));
        f('normal', 6.5, COL.gris2); doc.text(q.n, bx, by + 7.4);
        by += 11.2;
      });
      y = y0 + 56;
    }

    subt(A.avances ? 'Avances destacados' : 'Hallazgos clave');
    A.hallazgos.forEach(function (h) { var al = /^ALERTA/.test(h); parrafo(h, { t: 8.5, vineta: true, despues: 1.4, e: al ? 'bold' : 'normal', col: al ? COL.malo : COL.tinta, vcol: al ? COL.malo : COL.verde2 }); });
    y += 2;

    /* ───────────── 1. CUENTAS Y EJECUCIÓN ───────────── */
    hoja();
    seccion('Cuentas y ejecución financiera', 'Cada cuenta radicada con su periodo, los días que tardó en radicarse después del cierre del periodo, su valor y en qué va el pago.');
    tabla([
      { t: 'N°', w: 9, al: 'c', e: 'bold' }, { t: 'Periodo', w: 34 }, { t: 'Radicada', w: 19, al: 'c' }, { t: 'Días', w: 11, al: 'c' },
      { t: 'Cobro', w: 23, al: 'd' }, { t: 'Estado', w: 27 }, { t: 'Orden de pago', w: 0 }, { t: 'Egreso', w: 28 }
    ], A.porCuenta.map(function (q) {
      var x = q.x, dr = q.diasRad;
      return [x.informe + (x.total ? '/' + x.total : ''), x.desde ? f2(x.desde) + ' al ' + f2(x.hasta) : '—', f2(x.radicada) || '—',
        { t: nd(dr), col: dr === null ? COL.gris2 : (dr > 15 ? COL.malo : (dr > 5 ? COL.aviso : COL.ok)), e: 'bold' },
        plata(x.cobro) || '—', { t: x.estado, col: tonoCol(tono(x.estado) || 'verde'), e: 'bold' },
        x.orden ? 'N° ' + x.orden + (x.fechaOrden ? ' · ' + f2(x.fechaOrden) : '') : '—',
        x.egreso ? 'N° ' + x.egreso + (x.fechaEgreso ? ' · ' + f2(x.fechaEgreso) : '') : '—'];
    }));
    subt('Tiempos del trámite (días)');
    tabla([
      { t: 'Cuenta', w: 18, al: 'c', e: 'bold' }, { t: 'Radicar', w: 0, al: 'c' }, { t: 'Revisión', w: 30, al: 'c' },
      { t: 'Orden de pago', w: 30, al: 'c' }, { t: 'Pago (egreso)', w: 30, al: 'c' }, { t: 'Ciclo total', w: 26, al: 'c', e: 'bold' }
    ], A.porCuenta.map(function (q) { return [q.informe, nd(q.diasRad), nd(q.revision), nd(q.orden), nd(q.pago), nd(q.ciclo)]; }));

    if (A.avances) {
      seccion('Avances por periodo', 'Las cifras de gestión que el contratista reporta en cada cuenta (cantidades, porcentajes y entregables), tomadas de sus actividades.');
      tabla([{ t: 'Cuenta', w: 16, al: 'c', e: 'bold' }, { t: 'Periodo', w: 36 }, { t: 'Cifras de gestión reportadas', w: 0 }],
        A.porCuenta.map(function (q, j) {
          var x = q.x;
          return [x.informe, x.desde ? f2(x.desde) + ' al ' + f2(x.hasta) : '—', A.hitos[j].length ? A.hitos[j].join(' · ') : 'Avances descritos en las actividades del periodo'];
        }));
      seccion('Evolución por obligación', 'Cada obligación con lo realizado en cada periodo, en orden, tal como se radicó.');
      A.obl.forEach(function (o, i) {
        cabe(24);
        f('bold', 9.4, COL.verde); doc.text('Obligación ' + o.n + (A.porObl[i].general ? ' (general)' : ''), mx, y); y += 4.2;
        parrafo(o.texto, { t: 7.8, col: COL.gris, despues: 1.6 });
        A.cuentas.forEach(function (x, j) {
          var z = A.celdas[i][j];
          if (!z.texto) return;
          cabe(12);
          f('bold', 7.6, COL.verde2); doc.text('Cuenta ' + x.informe + (x.desde ? '  ·  ' + f2(x.desde) + ' al ' + f2(x.hasta) : ''), mx + 3, y); y += 3.8;
          parrafo(z.texto, { t: 8.2, x: mx + 3, despues: 0.6 });
          var adj = ((x.adjuntos || [])[i] || []);
          if (adj.length) parrafo('Soportes: ' + adj.join(' · '), { t: 7.2, x: mx + 3, col: COL.gris, despues: 0.6 });
          y += 1.6;
        });
        y += 2;
      });
    } else {
      /* ───────────── 2. CALIDAD DE LA REDACCIÓN ───────────── */
      seccion('Calidad de la redacción: ¿cuantifica?', 'Cada actividad se clasifica por las cifras de gestión que contiene (cantidades, entregables, valores). No cuentan fechas, el número del contrato o de la cuenta, la numeración ni los nombres de los archivos.');
      matriz(function (z) { return { t: CORTO_RED[z.clase], fondo: FONDO_RED[z.clase], e: 'bold', col: z.clase === 'desc' ? COL.malo : (z.clase === 'cuant' ? COL.ok : COL.tinta) }; },
        'C = cuantifica (2 o más cifras de gestión) · P = parcial (1 cifra) · D = solo describe · NR = no requerida en el periodo · — = sin actividad. Filas en gris: obligaciones generales (de conducta o de forma), que no se miden.');
      tabla([
        { t: 'Cuenta', w: 18, al: 'c', e: 'bold' }, { t: 'Con actividad', w: 24, al: 'c' }, { t: 'Cuantifica', w: 22, al: 'c' },
        { t: 'Parcial', w: 20, al: 'c' }, { t: 'Solo describe', w: 24, al: 'c' }, { t: 'No requerida', w: 24, al: 'c' }, { t: 'Sin actividad', w: 0, al: 'c' }
      ], A.porCuenta.map(function (q) {
        return [q.informe, q.reales + ' de ' + q.total, q.cuant + ' (' + pc(q.cuant, q.reales) + ' %)', q.parcial, { t: q.desc, col: q.desc ? COL.malo : COL.tinta }, q.noreq, { t: q.sin, col: q.sin ? COL.aviso : COL.tinta }];
      }));

      /* ───────────── 3. COPIA Y PEGA ───────────── */
      seccion('Copia y pega entre cuentas', 'Porcentaje del texto de cada actividad que ya estaba escrito en una cuenta anterior de la misma obligación (frases de 4 palabras; cambiar solo las cifras no cuenta como texto nuevo). Las actividades “no requeridas” no se miden.');
      if (A.cuentas.length < 2) parrafo('Hace falta al menos una segunda cuenta para comparar la redacción.', { t: 8.5, col: COL.gris });
      else matriz(function (z, j) {
        if (j === 0) return { t: 'base', col: COL.gris2 };
        if (z.rep === null) return { t: CORTO_RED[z.clase] === 'C' || CORTO_RED[z.clase] === 'P' || CORTO_RED[z.clase] === 'D' ? '—' : CORTO_RED[z.clase], col: COL.gris2 };
        return { t: z.rep + '%', e: 'bold', fondo: z.rep > 70 ? FONDO_RED.desc : (z.rep >= 30 ? FONDO_RED.parcial : FONDO_RED.cuant), col: z.rep > 70 ? COL.malo : COL.tinta };
      }, 'Menos de 30 % = redacción original · 30 a 70 % = reutiliza parte del texto · más de 70 % = copia y pega.');

      /* ───────────── 4. EVIDENCIAS Y ADJUNTOS ───────────── */
      seccion('Evidencias y adjuntos por obligación', 'Número de evidencias y adjuntos cargados en cada obligación y cuenta. En rojo, las actividades cuyo texto dice que adjunta un soporte que no está cargado.');
      matriz(function (z) {
        if (PUNTOS_RED[z.clase] === undefined) return { t: z.soporte ? (z.anexo ? 'A' : String(z.soporte)) : CORTO_RED[z.clase], col: COL.gris2 };
        if (z.anexo) return { t: 'A', e: 'bold', fondo: FONDO_RED.cuant };
        if (!z.soporte) return { t: z.menciona ? '0 !' : '0', e: 'bold', fondo: z.menciona ? FONDO_RED.desc : FONDO_RED.parcial, col: z.menciona ? COL.malo : COL.tinta };
        return { t: String(z.soporte), e: 'bold', fondo: FONDO_RED.cuant };
      }, 'Número = evidencias + adjuntos de esa obligación · A = anexo general de la cuenta (formato anterior al 05/10) · "0 !" = el texto menciona un adjunto que no está cargado · filas en gris = obligaciones generales, no entran en los puntajes.');

      /* ───────────── 5. DEVOLUCIONES ───────────── */
      seccion('Devoluciones y motivos', 'Cada vez que una cuenta se devolvió o se marcó incompleta, con quién lo hizo y el motivo que quedó registrado.');
      var devs = [];
      A.porCuenta.forEach(function (q) { q.devoluciones.forEach(function (v) { devs.push([q.informe, f2(v.fecha) || '—', v.estado, nombre(v.quien) || '—', v.motivo || 'Sin motivo registrado']); }); });
      if (!devs.length) parrafo('No hay devoluciones registradas en las cuentas de este contrato.', { t: 8.5, col: COL.gris });
      else tabla([{ t: 'Cuenta', w: 15, al: 'c', e: 'bold' }, { t: 'Fecha', w: 20, al: 'c' }, { t: 'Estado', w: 24 }, { t: 'Quién', w: 34 }, { t: 'Motivo', w: 0 }], devs);
    }

    /* ───────────── 6. SEGURIDAD SOCIAL ───────────── */
    seccion('Seguridad social', 'Planilla y aportes declarados en cada cuenta.');
    tabla([
      { t: 'Cuenta', w: 15, al: 'c', e: 'bold' }, { t: 'Planilla', w: 0 }, { t: 'Mes', w: 22 }, { t: 'Base', w: 24, al: 'd' },
      { t: 'Salud', w: 22, al: 'd' }, { t: 'Pensión', w: 22, al: 'd' }, { t: 'Riesgos', w: 20, al: 'd' }
    ], A.porCuenta.map(function (q) {
      var x = q.x;
      return [q.informe, (x.planilla || '—') + (x.planilla2 ? ' y ' + x.planilla2 : ''), (x.mesPlanilla || '—') + (x.mesPlanilla2 ? ' y ' + x.mesPlanilla2 : ''),
        plata(x.base) || '—', plata(x.salud) || '—', plata(x.pension) || '—', plata(x.riesgos) || '—'];
    }));

    if (!A.avances) {
      /* ───────────── 7. ALERTAS ───────────── */
      seccion('Alertas de control', 'Situaciones que el supervisor debe revisar. Rojo: requieren acción; ámbar: revisar; azul: informativas.');
      if (!A.alertas.length) parrafo('No se encontraron alertas de control en las cuentas de este contrato.', { t: 8.5, col: COL.gris });
      A.alertas.forEach(function (a) { parrafo('Cuenta ' + a.cuenta + ': ' + a.t, { t: 8.5, vineta: true, vcol: tonoCol(a.tono), despues: 1.4 }); });
    }

    /* ───────────── 8. CONCLUSIONES ───────────── */
    seccion(A.avances ? 'Conclusión' : 'Conclusiones y recomendaciones');
    parrafo(A.conclusion, { t: 9, lh: 4.4, despues: 3 });
    subt(A.avances ? 'Próximos pasos' : 'Recomendaciones al supervisor');
    A.recomendaciones.forEach(function (r) { parrafo(r, { t: 8.7, vineta: true, despues: 1.6 }); });

    if (!A.avances) {
      /* ───────────── 27/10 · AVANCES LOGRADOS (contratos en INFORME_AVANCES) ───────────── */
    if (A.seccionAvances) {
      seccion('Avances logrados con el desarrollo del ecosistema', 'Lo que este contrato ha dejado en funcionamiento, con las cifras de gestión que reporta en cada periodo (tomadas de sus actividades).');
      var nH = A.hitos.reduce(function (a, L) { return a + L.length; }, 0), ultH = A.hitos[A.hitos.length - 1] || [];
      parrafo('A lo largo de ' + A.cuentas.length + (A.cuentas.length === 1 ? ' periodo' : ' periodos') + ' el contrato reporta ' + nH + ' cifras de gestión' +
        (ultH.length ? '. En la cuenta más reciente: ' + ultH.join(' · ') + '.' : '.'), { t: 8.8, lh: 4.3, despues: 3 });
      tabla([{ t: 'Cuenta', w: 16, al: 'c', e: 'bold' }, { t: 'Periodo', w: 36 }, { t: 'Cifras de gestión reportadas', w: 0 }],
        A.porCuenta.map(function (q, j) {
          var x = q.x;
          return [x.informe, x.desde ? f2(x.desde) + ' al ' + f2(x.hasta) : '—', A.hitos[j].length ? A.hitos[j].join(' · ') : 'Avances descritos en las actividades del periodo'];
        }));
    }

    /* ───────────── ANEXO A: ACTIVIDADES COMPLETAS ───────────── */
      hoja();
      nSec = 0;
      f('bold', 13, COL.verde); doc.text('Anexo A · Actividades reportadas (texto completo)', mx, y + 4); y += 10;
      parrafo('Texto tal como lo radicó el contratista, por cuenta y por obligación, con su clasificación.', { t: 8.2, col: COL.gris, despues: 3 });
      subt('Obligaciones del contrato');
      A.obl.forEach(function (o) { parrafo(o.n + '. ' + o.texto, { t: 8, col: COL.tinta, despues: 1 }); });
      y += 3;
      A.cuentas.forEach(function (x, j) {
        cabe(26);
        fill(COL.verde2); doc.roundedRect(mx, y, util, 8, 1.5, 1.5, 'F');
        f('bold', 9, COL.blanco); doc.text('Cuenta ' + x.informe + (x.total ? ' de ' + x.total : '') + (x.desde ? '  ·  ' + f2(x.desde) + ' al ' + f2(x.hasta) : ''), mx + 3, y + 5.4);
        f('bold', 7.5, COL.blanco); doc.text(String(x.estado || ''), W - mx - 3, y + 5.4, { align: 'right' });
        y += 12;
        A.obl.forEach(function (o, i) {
          var z = A.celdas[i][j];
          cabe(16);
          f('bold', 8.2, COL.verde); doc.text('Obligación ' + o.n, mx, y);
          var et = (z.gen ? 'Obligación general (no se mide)' : ETIQUETA_RED[z.clase] + (z.rep !== null ? ' · ' + z.rep + ' % repetido' + (z.ident ? ' (texto idéntico a la cuenta ' + z.repCon + ')' : (z.rep > 70 ? ' (de la cuenta ' + z.repCon + ', con cambios menores)' : '')) : '')) +
            (z.anexo ? ' · anexo general de la cuenta' : (z.soporte ? ' · ' + z.soporte + ' soporte(s)' : ''));
          f('bold', 6.8, !z.gen && (z.clase === 'desc' || (z.rep !== null && z.rep > 70)) ? COL.malo : COL.gris);
          doc.text(et, W - mx, y, { align: 'right' });
          y += 4;
          parrafo(z.texto || 'Sin actividad reportada.', { t: 8.3, col: z.texto ? COL.tinta : COL.gris2, despues: 0.6 });
          var adj = ((x.adjuntos || [])[i] || []);
          if (adj.length) parrafo('Adjuntos: ' + adj.join(' · '), { t: 7.4, col: COL.gris, despues: 0.6 });
          y += 2;
        });
        y += 3;
      });
    }

    /* ───────────── ANEXO B: PAGO Y DOCUMENTOS ───────────── */
    hoja();
    f('bold', 13, COL.verde); doc.text((A.avances ? 'Anexo' : 'Anexo B') + ' · Detalle de pago y documentos por cuenta', mx, y + 4); y += 12;
    A.cuentas.forEach(function (x) {
      cabe(22);
      f('bold', 9.2, COL.tinta); doc.text('Cuenta ' + x.informe + (x.total ? ' de ' + x.total : ''), mx, y);
      draw(COL.linea, 0.25); doc.line(mx, y + 1.8, W - mx, y + 1.8); y += 6;
      var filas = [
        ['Saldo anterior / cobro / nuevo saldo', [plata(x.saldo), plata(x.cobro), plata(x.nuevo)].join(' / ')],
        ['Revisión', x.revisada ? f2(x.revisada) + (x.decidio ? ' · ' + nombre(x.decidio) : '') : ''],
        ['Neto girado', plata(x.neto)],
        ['Descuentos aplicados', descuentosLegibles(x.descuentos)],
        ['Detalles del pago', x.detallesPago],
        ['RP de la cesión', x.rpCesion],
        ['Informe de supervisión', x.informeSup],
        ['Acta de cumplimiento', x.acta],
        ['Observaciones', x.observaciones]
      ].filter(function (p) { return String(p[1] || '').replace(/[\s\/]/g, ''); });
      filas.forEach(function (p) {
        cabe(9);
        f('bold', 6.8, COL.gris); doc.text(p[0].toUpperCase(), mx, y); y += 3.6;
        parrafo(p[1], { t: 8.2, despues: 1.6 });
      });
      y += 3;
    });

    /* ───────────── NOTA METODOLÓGICA ───────────── */
    cabe(40);
    subt('Nota metodológica');
    (A.avances ? [
      'Este contrato se presenta como INFORME DE AVANCES (llave INFORME_AVANCES de la configuración): no se califica la redacción de las actividades ni se compara el texto entre cuentas; se muestran los avances reportados en cada periodo.',
      'Cifras de gestión: cantidades, porcentajes y entregables que aparecen en las actividades. No se cuentan fechas, años, el número del contrato o de la cuenta, ni los nombres de los archivos.',
      'Los datos salen de las cuentas registradas en el aplicativo al momento de generar el informe.'
    ] : [
      'Cuantificación: una actividad "cuantifica" si contiene 2 o más cifras de gestión, "parcial" si tiene 1 y "solo describe" si no tiene ninguna. Puntaje: 100, 60 y 20; el componente es el promedio.',
      'Originalidad: 100 menos el promedio del % repetido. El % repetido es la parte del texto de una actividad (frases de 4 palabras, con las cifras normalizadas) que ya aparecía en alguna cuenta anterior de la misma obligación.',
      'Soporte: % de actividades con contenido que tienen al menos una evidencia o adjunto en su obligación.',
      'Oportunidad: por cuenta, 100 si se radicó hasta 5 días después del cierre del periodo, 60 entre 6 y 15 días y 20 después; el componente es el promedio.',
      'Calidad del reporte: promedio de los componentes con dato. 80 o más: sólido; 60 a 79: aceptable con mejoras; menos de 60: requiere atención.',
      'Obligaciones generales: las de conducta o de forma (horario, independencia, elementos de trabajo, cronograma, entrega de la cuenta de cobro, aportes). Se muestran, pero no entran en ningún puntaje.',
      'Los datos salen de las cuentas registradas en el aplicativo al momento de generar el informe. Las actividades "no requeridas" o vacías no entran en los puntajes de redacción.'
    ]).forEach(function (t) { parrafo(t, { t: 7.8, col: COL.gris, vineta: true, despues: 1.2 }); });

    /* pie en todas las hojas */
    var total = doc.internal.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      draw(COL.linea, 0.2); doc.line(mx, H - 11, W - mx, H - 11);
      f('normal', 6.8, COL.gris2);
      ajustar('Documento generado por el sistema. ' + municipio, 'normal', 6.8, util - 30, COL.gris2); doc.text('Documento generado por el sistema. ' + municipio, mx, H - 7);
      doc.text('Página ' + p + ' de ' + total, W - mx, H - 7, { align: 'right' });
    }
    var archivo = (K.piezas.exportar.nombreArchivo ? K.piezas.exportar.nombreArchivo((A.avances ? 'Informe de avances ' : 'Informe gerencial ') + (c.nombre || '') + ' - ' + (c.contrato || '')) : 'Informe gerencial') + '.pdf';
    doc.save(archivo);
    return { paginas: total, archivo: archivo };

    /* La matriz obligación × cuenta: filas = obligaciones; columnas = cuentas
       (en bloques de hasta 11 para que quepan en la hoja). */
    function matriz(celda, leyenda) {
      var N = A.cuentas.length;
      for (var b = 0; b < N; b += 11) {
        var idx = [];
        for (var j = b; j < Math.min(N, b + 11); j++) idx.push(j);
        var cols = [{ t: 'Obligación', w: 0, e: 'bold' }].concat(idx.map(function (j) { return { t: 'C' + A.cuentas[j].informe, w: 13, al: 'c' }; }));
        tabla(cols, A.obl.map(function (o, i) {
          var g = A.porObl[i].general;
          return [{ t: 'Obligación ' + o.n + (g ? ' (general)' : ''), col: g ? COL.gris : COL.tinta, e: 'bold' }].concat(idx.map(function (j) {
            var z = A.celdas[i][j], r = celda(z, j);
            if (g) r = { t: r.t, col: COL.gris2, fondo: [240, 242, 241] };
            r.al = 'c'; return r;
          }));
        }), { t: 7.2, despues: 1.5 });
      }
      if (leyenda) parrafo(leyenda, { t: 7.2, col: COL.gris, despues: 3 });
    }
  }

  function f2(iso) { return iso ? K.fecha(iso) : ''; }

  /** El informe gerencial en PDF. Devuelve {paginas, archivo, msCarga, msDibujo}. */
  function aGerencial(d) {
    if (!K.piezas.exportar || !K.piezas.exportar.recursosPDF) return Promise.reject(new Error('Falta el exportador.'));
    return K.piezas.exportar.recursosPDF().then(function (R) {
      var t1 = Date.now();
      var A = analizar(d);
      var out = dibujarGerencial(d, A, R);
      out.msCarga = R.msCarga; out.msDibujo = Date.now() - t1;
      try { console.info('[informe gerencial]', out); } catch (e) {}
      return out;
    });
  }

  K.piezas.informeCuentas = {
    columnas: columnas, cifras: cifras, tono: tono, aExcel: aExcel, aPDF: aPDF,
    aGerencial: aGerencial, analizar: analizar, nivel: nivel, descuentosLegibles: descuentosLegibles,
    _redaccion: redaccion, _repetido: repetido, _cifrasGestion: cifrasGestion
  };
}());
