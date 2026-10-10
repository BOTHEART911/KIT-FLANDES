/* ============================================================
   KIT-FLANDES · INFORME GERENCIAL (10/10/2026)

   El PDF para la jefatura: portada membretada, resumen ejecutivo con
   indicadores, gráficas de barras, dona de resultados, calendario de
   actividad, distribución por tipo / secretaría / contratista, anexo con
   el detalle y nota metodológica. Se arma EN EL TELÉFONO con las filas
   que la vista ya tiene: cero viajes al servidor.

   No se carga al abrir la app. Lo pide K.piezas.exportar.aGerencial()
   la primera vez que alguien toca "Informe gerencial", junto con jsPDF.

   Lo que manda cada app (todo en texto ya listo para leer):

     KIT_GERENCIAL.dibujar({
       app: 'Contratación',              // el aplicativo
       persona: 'YESICA ALFARO',         // de quién es el informe
       rol: 'Revisora',                  // opcional
       desde: '2026-01-01', hasta: '2026-10-10',   // el rango que escogió
       nombre: 'Informe gerencial ...',  // nombre del archivo
       palabra: ['registro', 'registros'],
       etiquetas: { tipo: 'Actividad', categoria: 'Secretaría', sujeto: 'Contratista', monto: 'Valor' },
       tonos: { ok: 'Aprobadas', malo: 'Devueltas', aviso: 'En trámite', info: 'Informativas' },
       registros: [{ fecha: '2026-03-04', hora: '10:22', tipo: 'Cuenta aprobada', tono: 'ok',
                     categoria: 'Secretaría de Salud', sujeto: 'Juan Pérez', monto: 1500000,
                     ref: 'Contrato 029 · cuenta 4' }],
       kpis: [{ etiqueta, valor, nota, tono }],   // opcional: reemplaza los de por defecto
       secciones: [{ titulo, intro, kpis, graficas: [{ titulo, tipo: 'barras'|'barrasH'|'proporcion',
                     datos: [{ etiqueta, valor, tono }], formato: 'numero'|'pesos', nota }] }],
       hallazgos: ['...']                // opcional: se suman a los automáticos
     }, marca, escudoPNG, iconoPNG)
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;

  var C = {
    verde: [6, 64, 43], verde2: [17, 104, 70], verde3: [120, 170, 145], verdeClaro: [232, 242, 236],
    oro: [201, 158, 46], tinta: [22, 32, 27], gris: [96, 110, 103], gris2: [150, 160, 155],
    linea: [219, 227, 222], fondo: [245, 248, 246], blanco: [255, 255, 255],
    ok: [30, 132, 73], malo: [192, 57, 43], aviso: [214, 140, 20], info: [41, 98, 160]
  };
  var TONOS_TXT = { ok: 'Favorables', malo: 'Con observaciones', aviso: 'En trámite', info: 'Informativos' };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /* ══════════════ números y fechas ══════════════ */

  function num(v) { return (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('es-CO'); }
  function ent(v) { return Math.round(Number(v) || 0).toLocaleString('es-CO'); }
  function plata(v) { return '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO'); }
  function plataCorta(v) {
    v = Number(v) || 0;
    var a = Math.abs(v);
    if (a >= 1e9) return '$ ' + num(v / 1e9) + ' mil M';
    if (a >= 1e6) return '$ ' + num(v / 1e6) + ' M';
    if (a >= 1e3) return '$ ' + num(v / 1e3) + ' mil';
    return plata(v);
  }
  function pct(a, b) { return b ? (Math.round(a / b * 1000) / 10).toLocaleString('es-CO') + ' %' : '0 %'; }
  function fmt(v, f) { return f === 'pesos' ? plata(v) : ent(v); }
  function fmtCorto(v, f) { return f === 'pesos' ? plataCorta(v) : ent(v); }

  function aFecha(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function aIso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dma(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function largo(iso) { var d = aFecha(iso); return d ? d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() : ''; }
  function diaSemana(d) { return (d.getDay() + 6) % 7; }            /* 0 = lunes */
  function lunes(d) { var x = new Date(d); x.setDate(x.getDate() - diaSemana(x)); return x; }
  function sumarDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function entre(a, b) { return Math.round((b - a) / 864e5); }
  function titular(s) {
    s = String(s || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.replace(/ (De|Del|La|Las|Los|Y|E|En|Para|Por|A) /g, function (m) { return m.toLowerCase(); });
  }

  /* ══════════════ el análisis ══════════════ */

  function contar(regs, campo, conMonto) {
    var m = {}, orden = [];
    regs.forEach(function (r) {
      var k = String(r[campo] || '').trim() || 'Sin dato';
      if (!m[k]) { m[k] = { etiqueta: k, valor: 0, monto: 0, tonos: {} }; orden.push(k); }
      m[k].valor++;
      if (conMonto) m[k].monto += Number(r.monto) || 0;
      if (r.tono) m[k].tonos[r.tono] = (m[k].tonos[r.tono] || 0) + 1;
    });
    return orden.map(function (k) { return m[k]; }).sort(function (a, b) { return b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'); });
  }

  function analizar(sp) {
    var regs = (sp.registros || []).filter(function (r) { return aFecha(r.fecha); })
      .sort(function (a, b) { return String(a.fecha + (a.hora || '')).localeCompare(String(b.fecha + (b.hora || ''))); });
    var A = { regs: regs, total: regs.length };
    var fechas = regs.map(function (r) { return r.fecha.slice(0, 10); });
    A.desde = sp.desde || fechas[0] || aIso(new Date());
    A.hasta = sp.hasta || fechas[fechas.length - 1] || aIso(new Date());
    if (A.hasta > aIso(new Date())) A.hasta = aIso(new Date());
    if (A.desde > A.hasta) A.desde = A.hasta;
    /* el rango pedido va en la portada; el análisis (días hábiles, serie,
       tendencia) arranca en el primer registro si el rango empieza antes:
       si no, un "Este año" con datos desde septiembre sale distorsionado */
    A.pedido = { desde: A.desde, hasta: A.hasta };
    if (fechas[0] && fechas[0] > A.desde) { A.recortado = true; A.desde = fechas[0]; }
    var d0 = aFecha(A.desde), d1 = aFecha(A.hasta);
    A.diasRango = entre(d0, d1) + 1;

    var habiles = 0, x;
    for (x = new Date(d0); x <= d1; x = sumarDias(x, 1)) if (diaSemana(x) < 5) habiles++;
    A.habiles = habiles;

    var porDia = {};
    fechas.forEach(function (f) { porDia[f] = (porDia[f] || 0) + 1; });
    A.porDia = porDia;
    A.diasActivos = Object.keys(porDia).length;
    A.promedio = A.diasActivos ? A.total / A.diasActivos : 0;
    var pico = null;
    Object.keys(porDia).forEach(function (f) { if (!pico || porDia[f] > porDia[pico]) pico = f; });
    A.diaPico = pico;

    A.hayMonto = regs.some(function (r) { return Number(r.monto) > 0; });
    A.monto = regs.reduce(function (s, r) { return s + (Number(r.monto) || 0); }, 0);
    A.porTipo = contar(regs, 'tipo', A.hayMonto);
    A.porCategoria = contar(regs.filter(function (r) { return r.categoria; }), 'categoria', A.hayMonto);
    A.porSujeto = contar(regs.filter(function (r) { return r.sujeto; }), 'sujeto', A.hayMonto);

    var t = { ok: 0, malo: 0, aviso: 0, info: 0 };
    regs.forEach(function (r) { t[r.tono || 'info'] = (t[r.tono || 'info'] || 0) + 1; });
    A.tonos = t;
    A.decididos = t.ok + t.malo;

    var sem = [0, 0, 0, 0, 0, 0, 0];
    regs.forEach(function (r) { sem[diaSemana(aFecha(r.fecha))]++; });
    A.semana = sem;

    /* la serie en el tiempo: por día, por semana o por mes según el largo del rango */
    var modo = A.diasRango <= 31 ? 'dia' : (A.diasRango <= 120 ? 'semana' : 'mes');
    var cubos = [], idx = {};
    if (modo === 'dia') {
      for (x = new Date(d0); x <= d1; x = sumarDias(x, 1)) { idx[aIso(x)] = cubos.length; cubos.push({ etiqueta: ('0' + x.getDate()).slice(-2), largo: dma(aIso(x)), valor: 0, monto: 0, finde: diaSemana(x) > 4 }); }
    } else if (modo === 'semana') {
      for (x = lunes(d0); x <= d1; x = sumarDias(x, 7)) { idx[aIso(x)] = cubos.length; cubos.push({ etiqueta: x.getDate() + ' ' + MES3[x.getMonth()], largo: 'semana del ' + dma(aIso(x)), valor: 0, monto: 0 }); }
    } else {
      for (x = new Date(d0.getFullYear(), d0.getMonth(), 1, 12); x <= d1; x = new Date(x.getFullYear(), x.getMonth() + 1, 1, 12)) {
        idx[x.getFullYear() + '-' + x.getMonth()] = cubos.length;
        cubos.push({ etiqueta: MES3[x.getMonth()] + (d0.getFullYear() !== d1.getFullYear() ? " '" + String(x.getFullYear()).slice(2) : ''), largo: MESES[x.getMonth()] + ' de ' + x.getFullYear(), valor: 0, monto: 0 });
      }
    }
    regs.forEach(function (r) {
      var d = aFecha(r.fecha), k;
      if (modo === 'dia') k = aIso(d); else if (modo === 'semana') k = aIso(lunes(d)); else k = d.getFullYear() + '-' + d.getMonth();
      var i = idx[k];
      if (i === undefined) return;
      cubos[i].valor++; cubos[i].monto += Number(r.monto) || 0;
    });
    A.modo = modo;
    A.serie = cubos;
    var cPico = null;
    cubos.forEach(function (c) { if (!cPico || c.valor > cPico.valor) cPico = c; });
    A.cuboPico = cPico && cPico.valor ? cPico : null;

    /* tendencia: segunda mitad del rango contra la primera */
    var mitad = aIso(sumarDias(d0, Math.floor(A.diasRango / 2)));
    var a1 = 0, a2 = 0;
    regs.forEach(function (r) { if (r.fecha < mitad) a1++; else a2++; });
    A.mitades = [a1, a2];
    A.tendencia = a1 ? (a2 - a1) / a1 : (a2 ? 1 : 0);
    return A;
  }

  function hallazgos(sp, A) {
    var pal = sp.palabra || ['registro', 'registros'], E = sp.etiquetas || {}, TT = tonosTxt(sp);
    var h = [];
    if (!A.total) return ['En el periodo no hay ' + pal[1] + ' para analizar.'];
    if (A.porTipo[0]) h.push('Lo más frecuente fue «' + A.porTipo[0].etiqueta + '»: ' + ent(A.porTipo[0].valor) + ' ' + (A.porTipo[0].valor === 1 ? pal[0] : pal[1]) + ' (' + pct(A.porTipo[0].valor, A.total) + ' del total).');
    if (A.cuboPico && A.serie.length > 1) h.push('El pico de actividad fue ' + (A.modo === 'mes' ? 'en ' : (A.modo === 'semana' ? 'la ' : 'el ')) + A.cuboPico.largo + ', con ' + ent(A.cuboPico.valor) + ' ' + (A.cuboPico.valor === 1 ? pal[0] : pal[1]) + '.');
    if (A.decididos >= 3) h.push('De lo decidido, ' + pct(A.tonos.ok, A.decididos) + ' fue ' + (TT.ok || 'favorable').toLowerCase() + ' y ' + pct(A.tonos.malo, A.decididos) + ' ' + (TT.malo || 'con observaciones').toLowerCase() + '.');
    if (A.porCategoria.length > 1) h.push('La ' + (E.categoria || 'categoría').toLowerCase() + ' con más movimiento fue ' + titular(A.porCategoria[0].etiqueta) + ' (' + pct(A.porCategoria[0].valor, A.total) + ').');
    if (A.porSujeto.length > 1) {
      var top5 = A.porSujeto.slice(0, 5).reduce(function (s, x) { return s + x.valor; }, 0);
      h.push('Se atendieron ' + ent(A.porSujeto.length) + ' ' + (E.sujetos || (E.sujeto ? E.sujeto.toLowerCase() + 's' : 'personas')) + ' distintos; los 5 más frecuentes concentran el ' + pct(top5, A.total) + '.');
    }
    if (A.diasRango >= 14 && A.mitades[0] + A.mitades[1] >= 6) {
      var t = A.tendencia;
      h.push(Math.abs(t) < 0.1 ? 'El ritmo se mantuvo estable entre la primera y la segunda mitad del periodo.'
        : 'En la segunda mitad del periodo la actividad ' + (t > 0 ? 'creció' : 'bajó') + ' ' + pct(Math.abs(t), 1) + ' frente a la primera.');
    }
    var fin = A.semana[5] + A.semana[6];
    if (fin) h.push(ent(fin) + ' ' + (fin === 1 ? pal[0] : pal[1]) + ' se hicieron en fin de semana.');
    if (A.recortado) h.push('El primer registro del periodo es del ' + largo(A.desde) + '; los promedios y la tendencia se calculan desde esa fecha.');
    return h.concat(sp.hallazgos || []).slice(0, 8);
  }

  function tonosTxt(sp) { var t = {}, k; for (k in TONOS_TXT) t[k] = (sp.tonos && sp.tonos[k]) || TONOS_TXT[k]; return t; }

  function sintesis(sp, A) {
    var pal = sp.palabra || ['registro', 'registros'];
    if (!A.total) return 'Entre el ' + largo(A.desde) + ' y el ' + largo(A.hasta) + ' no hay ' + pal[1] + ' de ' + sp.persona + ' en ' + sp.app + '.';
    var t = 'Entre el ' + largo(A.desde) + ' y el ' + largo(A.hasta) + ', ' + sp.persona + ' registró ' + ent(A.total) + ' ' + (A.total === 1 ? pal[0] : pal[1]) +
      ' en ' + sp.app + ', en ' + ent(A.diasActivos) + (A.diasActivos === 1 ? ' día' : ' días') + ' con actividad de ' + ent(A.habiles) + ' hábiles del periodo' +
      ' (promedio de ' + num(A.promedio) + ' por día activo).';
    if (A.hayMonto) t += ' El valor asociado suma ' + plata(A.monto) + '.';
    if (A.porTipo.length > 1) t += ' Se registraron ' + A.porTipo.length + ' tipos de actuación distintos.';
    return t;
  }

  /* ══════════════ el dibujo ══════════════ */

  function dibujar(sp, marca, escudo, icono) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var mx = 16, util = W - mx * 2, abajo = H - 18, arriba = 30;
    var A = analizar(sp), E = sp.etiquetas || {}, TT = tonosTxt(sp), pal = sp.palabra || ['registro', 'registros'];
    var M = marca || {};
    var municipio = String(M.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES');
    var generado = new Date();
    var codigo = verificacion(sp, A, generado);
    var y = 0;

    function rgb(c) { return c || C.tinta; }
    function fuente(e, t, c) { doc.setFont('helvetica', e); doc.setFontSize(t); var k = rgb(c); doc.setTextColor(k[0], k[1], k[2]); }
    function relleno(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function trazo(c, g) { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(g || 0.2); }
    function cortar(txt, e, t, w) { fuente(e, t); return doc.splitTextToSize(String(txt == null ? '' : txt), w); }
    function recorte(txt, e, t, w) {
      fuente(e, t);
      txt = String(txt == null ? '' : txt);
      if (doc.getTextWidth(txt) <= w) return txt;
      while (txt.length > 1 && doc.getTextWidth(txt + '…') > w) txt = txt.slice(0, -1);
      return txt + '…';
    }
    function opaco(o) { try { doc.setGState(new doc.GState({ opacity: o })); } catch (e) { /* jsPDF viejo: sin transparencia */ } }

    /* ── cabecera y pie de las páginas interiores ── */
    function cabecera() {
      relleno(C.verde); doc.rect(0, 0, W, 18, 'F');
      relleno(C.oro); doc.rect(0, 18, W, 0.9, 'F');
      if (escudo) { try { doc.addImage(escudo, 'PNG', mx, 3, 12, 12); } catch (e) {} }
      var xt = escudo ? mx + 15 : mx;
      fuente('bold', 9.5, C.blanco); doc.text(municipio, xt, 8.4);
      fuente('normal', 7.2, [205, 225, 214]); doc.text((M.MARCA_NIT ? 'NIT ' + M.MARCA_NIT + '  ·  ' : '') + 'Aplicativo ' + sp.app, xt, 12.6);
      fuente('bold', 8.5, C.blanco); doc.text('INFORME GERENCIAL', W - mx, 8.4, { align: 'right' });
      fuente('normal', 7.2, [205, 225, 214]); doc.text(recorte(sp.persona, 'normal', 7.2, 80), W - mx, 12.6, { align: 'right' });
      y = arriba;
    }
    function nuevaPagina() { doc.addPage(); cabecera(); }
    function cabe(h) { if (y + h > abajo) { nuevaPagina(); return false; } return true; }

    function seccion(n, titulo, intro) {
      cabe(22);
      relleno(C.verde); doc.roundedRect(mx, y, 7.5, 7.5, 1.4, 1.4, 'F');
      fuente('bold', 9, C.blanco); doc.text(String(n), mx + 3.75, y + 5.2, { align: 'center' });
      fuente('bold', 13.5, C.verde); doc.text(titulo, mx + 11, y + 5.6);
      relleno(C.oro); doc.rect(mx + 11, y + 8, 22, 0.8, 'F');
      y += 13;
      if (intro) {
        var l = cortar(intro, 'normal', 8.6, util);
        fuente('normal', 8.6, C.gris);
        l.forEach(function (t) { doc.text(t, mx, y); y += 4.1; });
        y += 2;
      }
    }
    function subtitulo(t, nota) {
      cabe(16);
      fuente('bold', 9.8, C.tinta); doc.text(t, mx, y);
      if (nota) { fuente('normal', 7.4, C.gris2); doc.text(recorte(nota, 'normal', 7.4, 90), W - mx, y, { align: 'right' }); }
      trazo(C.linea, 0.25); doc.line(mx, y + 2, W - mx, y + 2);
      y += 7;
    }

    /* ── 1. PORTADA ── */
    function portada() {
      var alto = 150;
      relleno(C.verde); doc.rect(0, 0, W, alto, 'F');
      /* fondo con formas suaves */
      opaco(0.07); relleno(C.blanco);
      doc.circle(W - 18, 22, 46, 'F'); doc.circle(W - 40, alto - 8, 30, 'F'); doc.circle(-10, alto - 30, 38, 'F');
      opaco(0.12);
      var bx = W - mx - 62, by = alto - 26, hs = [10, 17, 13, 24, 19, 31, 27, 38];
      hs.forEach(function (h, i) { doc.roundedRect(bx + i * 8, by - h, 5.4, h, 1, 1, 'F'); });
      opaco(1);
      relleno(C.oro); doc.rect(0, alto, W, 2.2, 'F');

      if (escudo) { try { doc.addImage(escudo, 'PNG', mx, 20, 26, 26); } catch (e) {} }
      var xt = escudo ? mx + 31 : mx;
      fuente('bold', 15, C.blanco); doc.text(municipio, xt, 30);
      fuente('normal', 9, [205, 225, 214]);
      if (M.MARCA_NIT) doc.text('NIT ' + M.MARCA_NIT, xt, 36);
      doc.text('Ecosistema digital FLANDES-CORE', xt, M.MARCA_NIT ? 41 : 36);

      relleno(C.oro); doc.rect(mx, 66, 30, 1.2, 'F');
      fuente('bold', 11, [214, 233, 222]); doc.text('INFORME', mx, 78);
      fuente('bold', 34, C.blanco); doc.text('Gerencial', mx, 93);
      fuente('normal', 12.5, [214, 233, 222]); doc.text('Gestión registrada en el aplicativo ' + sp.app, mx, 104);

      /* la tarjeta de datos */
      var ty = alto + 18, th = 64;
      relleno(C.fondo); trazo(C.linea, 0.3); doc.roundedRect(mx, ty, util, th, 3, 3, 'FD');
      relleno(C.verde2); doc.roundedRect(mx, ty, 2.2, th, 1, 1, 'F');
      if (icono) { try { doc.addImage(icono, 'PNG', W - mx - 26, ty + 8, 18, 18); } catch (e) {} }
      var filas = [
        ['RESPONSABLE', sp.persona + (sp.rol ? '  ·  ' + sp.rol : '')],
        ['APLICATIVO', sp.app],
        ['PERIODO ANALIZADO', 'Del ' + largo(A.pedido.desde) + ' al ' + largo(A.pedido.hasta),
         A.recortado ? 'Con registros desde el ' + largo(A.desde) : ent(A.diasRango) + (A.diasRango === 1 ? ' día' : ' días')],
        ['FECHA DE GENERACIÓN', largo(aIso(generado)) + ', ' + generado.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })]
      ];
      var yy = ty + 11;
      filas.forEach(function (f) {
        fuente('bold', 7, C.gris2); doc.text(f[0], mx + 9, yy);
        fuente('bold', 11, C.tinta); doc.text(recorte(f[1], 'bold', 11, util - 44), mx + 9, yy + 5.4);
        if (f[2]) { fuente('bold', 7, C.gris2); var wl = doc.getTextWidth(f[0]); fuente('normal', 7, C.verde2); doc.text('·  ' + f[2], mx + 9 + wl + 2, yy); }
        yy += 13.4;
      });

      /* tres cifras grandes de entrada */
      var cy = ty + th + 12, cw = (util - 8) / 3;
      var cif = [[ent(A.total), A.total === 1 ? titular(pal[0]) : titular(pal[1])], [ent(A.diasActivos), 'Días con actividad'],
                 A.hayMonto ? [plataCorta(A.monto), E.monto || 'Valor asociado'] : [num(A.promedio), 'Promedio por día activo']];
      cif.forEach(function (c, i) {
        var x0 = mx + i * (cw + 4);
        fuente('bold', 19, C.verde); doc.text(c[0], x0, cy + 6);
        fuente('normal', 8, C.gris); doc.text(c[1], x0, cy + 12);
        if (i < 2) { trazo(C.linea, 0.3); doc.line(x0 + cw + 1.5, cy - 2, x0 + cw + 1.5, cy + 13); }
      });

      fuente('normal', 7.2, C.gris2);
      doc.text('Código de verificación ' + codigo + '  ·  Documento generado automáticamente a partir de los registros del aplicativo.', W / 2, H - 12, { align: 'center' });
    }

    /* ── piezas de dibujo ── */
    function tarjetasKpi(lista) {
      var porFila = 3, gap = 4, w = (util - gap * (porFila - 1)) / porFila, h = 23;
      var filas = Math.ceil(lista.length / porFila);
      cabe(filas * (h + gap));
      lista.forEach(function (k, i) {
        var c = i % porFila, f = Math.floor(i / porFila);
        var x0 = mx + c * (w + gap), y0 = y + f * (h + gap);
        var tono = C[k.tono] || C.verde;
        relleno(C.blanco); trazo(C.linea, 0.3); doc.roundedRect(x0, y0, w, h, 2.2, 2.2, 'FD');
        relleno(tono); doc.roundedRect(x0, y0, w, 1.6, 0.8, 0.8, 'F');
        fuente('normal', 7.4, C.gris); doc.text(recorte(String(k.etiqueta).toUpperCase(), 'normal', 7.4, w - 8), x0 + 4, y0 + 7.4);
        fuente('bold', 15.5, tono === C.verde ? C.tinta : tono); doc.text(recorte(k.valor, 'bold', 15.5, w - 8), x0 + 4, y0 + 15.2);
        if (k.nota) { fuente('normal', 6.8, C.gris2); doc.text(recorte(k.nota, 'normal', 6.8, w - 8), x0 + 4, y0 + 19.8); }
      });
      y += filas * (h + gap) + 2;
    }

    function barrasV(datos, op) {
      op = op || {};
      var h = op.alto || 58, x0 = mx + 14, w = util - 14;
      cabe(h + 16);
      var campo = op.campo || 'valor', f = op.formato;
      var max = Math.max.apply(null, datos.map(function (d) { return d[campo]; }).concat([1]));
      var paso = escala(max), tope = Math.ceil(max / paso) * paso || 1;
      var base = y + h;
      /* rejilla */
      fuente('normal', 6.4, C.gris2);
      for (var v = 0; v <= tope + 1e-9; v += paso) {
        var yy = base - (v / tope) * h;
        trazo(v === 0 ? C.gris2 : C.linea, v === 0 ? 0.3 : 0.15);
        doc.line(x0, yy, x0 + w, yy);
        doc.text(fmtCorto(v, f), x0 - 2, yy + 1.1, { align: 'right' });
      }
      var n = datos.length, slot = w / Math.max(n, 1), bw = Math.min(slot * 0.66, 14);
      var mejor = -1, i;
      for (i = 0; i < n; i++) if (mejor < 0 || datos[i][campo] > datos[mejor][campo]) mejor = i;
      var cadaEtiqueta = Math.ceil(n / 16);
      datos.forEach(function (d, i) {
        var bh = (d[campo] / tope) * h, xb = x0 + i * slot + (slot - bw) / 2;
        if (bh > 0) {
          relleno(i === mejor && d[campo] > 0 ? C.oro : (d.finde ? C.verde3 : C.verde2));
          doc.roundedRect(xb, base - bh, bw, bh, Math.min(1.1, bw / 3), Math.min(1.1, bw / 3), 'F');
          if (bh > 1.2) doc.rect(xb, base - Math.min(1.1, bh), bw, Math.min(1.1, bh), 'F');
        }
        if (n <= 18 && d[campo] > 0) { fuente('bold', 6.6, C.tinta); doc.text(fmtCorto(d[campo], f), xb + bw / 2, base - bh - 1.4, { align: 'center' }); }
        if (i % cadaEtiqueta === 0) { fuente('normal', 6.4, C.gris); doc.text(String(d.etiqueta), xb + bw / 2, base + 4.2, { align: 'center' }); }
      });
      /* promedio */
      var prom = datos.reduce(function (s, d) { return s + d[campo]; }, 0) / Math.max(n, 1);
      if (op.promedio !== false && prom > 0 && n > 2) {
        var yp = base - (prom / tope) * h;
        trazo(C.malo, 0.3); doc.setLineDashPattern([1.2, 1], 0); doc.line(x0, yp, x0 + w, yp); doc.setLineDashPattern([], 0);
        fuente('bold', 6.4, C.malo); doc.text('Promedio ' + fmtCorto(prom, f), x0 + 1, yp - 1.3);
      }
      y = base + 9;
      leyendaV(op);
    }
    function leyendaV(op) {
      var items = [[C.verde2, 'Actividad'], [C.oro, 'Valor más alto']];
      if (op.finde) items.push([C.verde3, 'Fin de semana']);
      var x = mx;
      items.forEach(function (it) {
        relleno(it[0]); doc.roundedRect(x, y - 2.4, 3, 3, 0.6, 0.6, 'F');
        fuente('normal', 6.8, C.gris); doc.text(it[1], x + 4.5, y); x += 6 + doc.getTextWidth(it[1]) + 5;
      });
      y += 6;
    }
    function escala(max) {
      var crudo = max / 4, p = Math.pow(10, Math.floor(Math.log10(Math.max(crudo, 1e-9))));
      var n = crudo / p;
      return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    }

    function barrasH(datos, op) {
      op = op || {};
      var f = op.formato, campo = op.campo || 'valor';
      var lista = datos.slice(0, op.max || 10), resto = datos.slice(op.max || 10);
      if (resto.length) lista.push({ etiqueta: 'Otros (' + resto.length + ')', valor: resto.reduce(function (s, d) { return s + d.valor; }, 0), monto: resto.reduce(function (s, d) { return s + (d.monto || 0); }, 0), otros: true });
      var total = datos.reduce(function (s, d) { return s + d[campo]; }, 0) || 1;
      var max = Math.max.apply(null, lista.map(function (d) { return d[campo]; }).concat([1]));
      var rh = 7, lw = op.ancho || 62, bw = util - lw - 34;
      lista.forEach(function (d, i) {
        cabe(rh);
        var yy = y;
        if (i % 2 === 0) { relleno(C.fondo); doc.rect(mx, yy - 1.2, util, rh, 'F'); }
        fuente(d.otros ? 'italic' : 'normal', 7.8, C.tinta);
        doc.text(recorte(op.titular === false ? d.etiqueta : titular(d.etiqueta), d.otros ? 'italic' : 'normal', 7.8, lw - 3), mx + 2, yy + 3.4);
        var bl = Math.max((d[campo] / max) * bw, d[campo] > 0 ? 0.8 : 0);
        relleno(d.tono ? (C[d.tono] || C.verde2) : (i === 0 && !d.otros ? C.oro : (d.otros ? C.gris2 : C.verde2)));
        doc.roundedRect(mx + lw, yy + 0.6, bl, 3.8, 0.8, 0.8, 'F');
        fuente('bold', 7.6, C.tinta); doc.text(fmt(d[campo], f), mx + lw + bl + 1.8, yy + 3.4);
        fuente('normal', 7.2, C.gris); doc.text(pct(d[campo], total), W - mx - 1, yy + 3.4, { align: 'right' });
        y += rh;
      });
      y += 4;
    }

    function proporcion(datos, op) {
      op = op || {};
      var total = datos.reduce(function (s, d) { return s + d.valor; }, 0);
      if (!total) return;
      cabe(20);
      var x = mx, hh = 7;
      datos.forEach(function (d) {
        if (!d.valor) return;
        var w = d.valor / total * util;
        relleno(C[d.tono] || C.verde2); doc.rect(x, y, w, hh, 'F');
        if (w > 14) { fuente('bold', 7, C.blanco); doc.text(pct(d.valor, total), x + w / 2, y + 4.7, { align: 'center' }); }
        x += w;
      });
      y += hh + 5;
      leyenda(datos.filter(function (d) { return d.valor; }), op.formato, mx, util);
      y += 3;
    }
    function leyenda(datos, f, x0, ancho) {
      var x = x0;
      datos.forEach(function (d) {
        var t = d.etiqueta + ': ' + fmt(d.valor, f);
        fuente('normal', 7.2, C.gris);
        var w = doc.getTextWidth(t) + 9;
        if (x + w > x0 + ancho) { x = x0; y += 5; }
        relleno(C[d.tono] || C.verde2); doc.roundedRect(x, y - 2.5, 3, 3, 0.6, 0.6, 'F');
        doc.text(t, x + 4.5, y); x += w;
      });
      y += 5;
    }

    function dona(cx, cy, r0, r1, datos) {
      var total = datos.reduce(function (s, d) { return s + d.valor; }, 0);
      if (!total) return;
      var a = -Math.PI / 2;
      datos.forEach(function (d) {
        if (!d.valor) return;
        var b = a + d.valor / total * Math.PI * 2;
        sector(cx, cy, r0, r1, a, b, C[d.tono] || C.verde2);
        a = b;
      });
      fuente('bold', 15, C.tinta); doc.text(ent(total), cx, cy + 1.4, { align: 'center' });
      fuente('normal', 6.6, C.gris); doc.text(total === 1 ? pal[0] : pal[1], cx, cy + 5.6, { align: 'center' });
    }
    function sector(cx, cy, r0, r1, a, b, col) {
      var pasos = Math.max(2, Math.ceil((b - a) / (Math.PI / 60))), pts = [], i, t;
      for (i = 0; i <= pasos; i++) { t = a + (b - a) * i / pasos; pts.push([cx + r1 * Math.cos(t), cy + r1 * Math.sin(t)]); }
      for (i = pasos; i >= 0; i--) { t = a + (b - a) * i / pasos; pts.push([cx + r0 * Math.cos(t), cy + r0 * Math.sin(t)]); }
      var rel = [];
      for (i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
      relleno(col); trazo(col, 0.05);
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
    }

    /** Calendario de actividad: una celda por día, más oscura cuanto más se hizo. */
    function calendario() {
      var d0 = aFecha(A.desde), d1 = aFecha(A.hasta);
      if (entre(d0, d1) > 371) d0 = sumarDias(d1, -371);
      var ini = lunes(d0), semanas = Math.ceil((entre(ini, d1) + 1) / 7);
      var lw = 14, cel = Math.min(semanas <= 8 ? 8 : 5.2, (util - lw) / semanas), gap = Math.min(0.7, cel * 0.15);
      var hh = 7 * cel + 12;
      cabe(hh + 8);
      var max = Math.max.apply(null, Object.keys(A.porDia).map(function (k) { return A.porDia[k]; }).concat([1]));
      fuente('normal', 6.2, C.gris);
      ['Lun', 'Mié', 'Vie', 'Dom'].forEach(function (t, i) { doc.text(t, mx, y + 6 + [0, 2, 4, 6][i] * cel + cel * 0.7); });
      var mesAnt = -1;
      for (var s = 0; s < semanas; s++) {
        for (var dd = 0; dd < 7; dd++) {
          var f = sumarDias(ini, s * 7 + dd);
          var x = mx + lw + s * cel, yy = y + 6 + dd * cel;
          if (f < d0 || f > d1) continue;
          var n = A.porDia[aIso(f)] || 0;
          relleno(n ? mezcla(C.verdeClaro, C.verde, 0.25 + 0.75 * Math.sqrt(n / max)) : [238, 242, 240]);
          doc.roundedRect(x, yy, cel - gap, cel - gap, 0.5, 0.5, 'F');
          if (dd === 0 && f.getMonth() !== mesAnt) {
            mesAnt = f.getMonth();
            fuente('normal', 6.2, C.gris); doc.text(MES3[mesAnt], x, y + 3.6);
          }
        }
      }
      y += 6 + 7 * cel + 4;
      /* escala */
      fuente('normal', 6.4, C.gris); doc.text('Menos', W - mx - 40, y + 2.2);
      [0, 0.25, 0.5, 0.75, 1].forEach(function (p, i) {
        relleno(p ? mezcla(C.verdeClaro, C.verde, 0.25 + 0.75 * p) : [238, 242, 240]); doc.roundedRect(W - mx - 31 + i * 4.2, y - 0.2, 3.4, 3.4, 0.5, 0.5, 'F');
      });
      doc.text('Más', W - mx, y + 2.2, { align: 'right' });
      fuente('normal', 6.4, C.gris2); doc.text('Día con más actividad: ' + (A.diaPico ? dma(A.diaPico) + ' (' + ent(A.porDia[A.diaPico]) + ')' : '—'), mx, y + 2.2);
      y += 9;
    }
    function mezcla(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }

    function vinetas(lista) {
      lista.forEach(function (t, i) {
        var l = cortar(t, 'normal', 8.6, util - 9);
        cabe(l.length * 4.3 + 2);
        relleno([C.verde2, C.oro, C.info, C.ok, C.aviso, C.verde3, C.verde2, C.oro][i % 8]);
        doc.circle(mx + 2, y - 1.1, 1.2, 'F');
        fuente('normal', 8.6, C.tinta);
        l.forEach(function (x) { doc.text(x, mx + 6, y); y += 4.3; });
        y += 1.8;
      });
    }

    function tabla(cols, filas, op) {
      op = op || {};
      var anchos = cols.map(function (c) { return c.ancho; });
      var libre = util - anchos.reduce(function (s, a) { return s + (a || 0); }, 0);
      var sinAncho = anchos.filter(function (a) { return !a; }).length || 1;
      anchos = anchos.map(function (a) { return a || libre / sinAncho; });
      function cab() {
        relleno(C.verde); doc.rect(mx, y, util, 7, 'F');
        var x = mx;
        cols.forEach(function (c, i) { fuente('bold', 7.2, C.blanco); doc.text(c.titulo, x + 1.6, y + 4.7); x += anchos[i]; });
        y += 7;
      }
      cab();
      filas.forEach(function (f, n) {
        var celdas = cols.map(function (c, i) { return cortar(f[i], c.negrilla ? 'bold' : 'normal', 7.2, anchos[i] - 3).slice(0, 3); });
        var hh = Math.max.apply(null, celdas.map(function (l) { return l.length; })) * 3.4 + 2.6;
        if (y + hh > abajo) { nuevaPagina(); cab(); }
        if (n % 2) { relleno(C.fondo); doc.rect(mx, y, util, hh, 'F'); }
        var x = mx;
        celdas.forEach(function (l, i) {
          var c = cols[i];
          fuente(c.negrilla ? 'bold' : 'normal', 7.2, c.color ? (C[c.color(f)] || C.tinta) : C.tinta);
          l.forEach(function (t, j) { doc.text(t, c.derecha ? x + anchos[i] - 1.6 : x + 1.6, y + 3.9 + j * 3.4, c.derecha ? { align: 'right' } : undefined); });
          x += anchos[i];
        });
        trazo(C.linea, 0.15); doc.line(mx, y + hh, W - mx, y + hh);
        y += hh;
      });
      y += 4;
    }

    /* ══════════ armar el documento ══════════ */

    portada();

    /* 2. RESUMEN EJECUTIVO */
    nuevaPagina();
    var n = 1;
    seccion(n++, 'Resumen ejecutivo', null);
    var kp = sp.kpis || [
      { etiqueta: titular(pal[1]) + ' en el periodo', valor: ent(A.total), nota: A.porTipo.length + (A.porTipo.length === 1 ? ' tipo de actuación' : ' tipos de actuación') },
      { etiqueta: 'Días con actividad', valor: ent(A.diasActivos), nota: pct(Math.min(A.diasActivos, A.habiles), A.habiles) + ' de ' + ent(A.habiles) + ' días hábiles' },
      { etiqueta: 'Promedio por día activo', valor: num(A.promedio), nota: 'Pico: ' + (A.diaPico ? dma(A.diaPico) + ' con ' + ent(A.porDia[A.diaPico]) : '—') },
      A.decididos ? { etiqueta: TT.ok, valor: pct(A.tonos.ok, A.decididos), nota: ent(A.tonos.ok) + ' de ' + ent(A.decididos) + ' decididos', tono: 'ok' }
                  : { etiqueta: E.sujetos ? titular(E.sujetos) + ' atendidos' : 'Distintos atendidos', valor: ent(A.porSujeto.length), nota: E.sujeto ? 'por ' + E.sujeto.toLowerCase() : '' },
      A.decididos ? { etiqueta: TT.malo, valor: pct(A.tonos.malo, A.decididos), nota: ent(A.tonos.malo) + ' de ' + ent(A.decididos) + ' decididos', tono: A.tonos.malo ? 'malo' : 'ok' }
                  : { etiqueta: (E.categoria || 'Categoría') + 's', valor: ent(A.porCategoria.length), nota: A.porCategoria[0] ? 'Mayor: ' + titular(A.porCategoria[0].etiqueta) : '' },
      A.hayMonto ? { etiqueta: E.monto || 'Valor asociado', valor: plataCorta(A.monto), nota: plata(A.monto), tono: 'info' }
                 : { etiqueta: 'Tendencia del periodo', valor: (A.tendencia > 0 ? '+' : '') + pct(A.tendencia, 1), nota: 'segunda mitad frente a la primera', tono: A.tendencia >= 0 ? 'ok' : 'aviso' }
    ];
    tarjetasKpi(kp);

    subtitulo('Síntesis');
    var sl = cortar(sintesis(sp, A), 'normal', 9, util);
    cabe(sl.length * 4.6 + 4);
    fuente('normal', 9, C.tinta);
    sl.forEach(function (t) { doc.text(t, mx, y); y += 4.6; });
    y += 4;

    /* dona de resultados + hallazgos al lado */
    var hz = hallazgos(sp, A);
    var tonosD = ['ok', 'aviso', 'malo', 'info'].map(function (k) { return { etiqueta: TT[k], valor: A.tonos[k] || 0, tono: k }; }).filter(function (d) { return d.valor; });
    subtitulo('Hallazgos clave');
    if (tonosD.length > 1) {
      cabe(58);
      var y0 = y, cw = 62;
      dona(mx + cw / 2, y0 + 23, 13, 22, tonosD);
      var yl = y0 + 51, guardo = y;
      y = yl;
      tonosD.forEach(function (d) {
        relleno(C[d.tono]); doc.roundedRect(mx + 4, y - 2.5, 3, 3, 0.6, 0.6, 'F');
        fuente('normal', 7.2, C.gris); doc.text(d.etiqueta + ': ' + ent(d.valor) + ' (' + pct(d.valor, A.total) + ')', mx + 8.5, y); y += 4.4;
      });
      var yFin = y;
      /* los hallazgos en la columna derecha */
      y = guardo + 2;
      var xh = mx + cw + 6, wh = util - cw - 6;
      hz.forEach(function (t, i) {
        var l = cortar(t, 'normal', 8.4, wh - 6);
        relleno([C.verde2, C.oro, C.info, C.ok, C.aviso, C.verde3, C.verde2, C.oro][i % 8]);
        doc.circle(xh + 1.6, y - 1.1, 1.1, 'F');
        fuente('normal', 8.4, C.tinta);
        l.forEach(function (x) { doc.text(x, xh + 5, y); y += 4.1; });
        y += 1.8;
      });
      y = Math.max(y, yFin) + 4;
    } else vinetas(hz);

    /* 3. SECCIONES PROPIAS DE LA APP (p. ej. lo financiero) */
    (sp.secciones || []).forEach(function (s) {
      nuevaPagina();
      seccion(n++, s.titulo, s.intro);
      if (s.kpis && s.kpis.length) tarjetasKpi(s.kpis);
      (s.graficas || []).forEach(function (g) {
        if (!g.datos || !g.datos.length) return;
        subtitulo(g.titulo, g.nota);
        if (g.tipo === 'barras') barrasV(g.datos, { formato: g.formato, alto: g.alto });
        else if (g.tipo === 'proporcion') proporcion(g.datos, { formato: g.formato });
        else barrasH(g.datos, { formato: g.formato, max: g.max, titular: g.titular });
      });
      if (s.tabla) { subtitulo(s.tabla.titulo, s.tabla.nota); tabla(s.tabla.cols, s.tabla.filas); }
    });

    if (A.total) {
      /* 4. EVOLUCIÓN EN EL TIEMPO */
      nuevaPagina();
      seccion(n++, 'Evolución en el tiempo', 'Cómo se repartió la actividad a lo largo del periodo, ' +
        (A.modo === 'dia' ? 'día por día.' : (A.modo === 'semana' ? 'semana por semana (cada barra empieza el lunes).' : 'mes a mes.')));
      subtitulo(titular(pal[1]) + ' por ' + (A.modo === 'dia' ? 'día' : A.modo), A.cuboPico ? 'Mayor: ' + A.cuboPico.largo : '');
      barrasV(A.serie, { finde: A.modo === 'dia' });
      if (A.hayMonto) {
        subtitulo((E.monto || 'Valor') + ' por ' + (A.modo === 'dia' ? 'día' : A.modo));
        barrasV(A.serie, { campo: 'monto', formato: 'pesos', alto: 44 });
      }
      subtitulo('Calendario de actividad', A.diasRango > 371 ? 'últimas 53 semanas del rango' : '');
      calendario();
      subtitulo('Por día de la semana');
      barrasV(DIAS.map(function (d, i) { return { etiqueta: d.slice(0, 3), valor: A.semana[i], finde: i > 4 }; }), { alto: 34, promedio: false, finde: true });

      /* 5. DISTRIBUCIÓN */
      nuevaPagina();
      seccion(n++, 'Distribución de la gestión', 'Qué se hizo, en qué ' + (E.categoria || 'categoría').toLowerCase() + ' y con quién.');
      subtitulo('Por ' + (E.tipo || 'tipo').toLowerCase(), A.porTipo.length + (A.porTipo.length === 1 ? ' tipo' : ' tipos'));
      barrasH(A.porTipo.map(function (d) { return { etiqueta: d.etiqueta, valor: d.valor, monto: d.monto }; }), { max: 12, titular: false });
      if (tonosD.length > 1) { subtitulo('Resultado'); proporcion(tonosD); }
      if (A.porCategoria.length) {
        subtitulo('Por ' + (E.categoria || 'categoría').toLowerCase(), A.porCategoria.length + ' en total');
        barrasH(A.porCategoria, { max: 10 });
      }
      if (A.porSujeto.length) {
        subtitulo((E.sujeto || 'Sujeto') + 's con más ' + pal[1], 'los 10 primeros de ' + ent(A.porSujeto.length));
        barrasH(A.porSujeto, { max: 10 });
      }
      if (A.hayMonto && A.porTipo.length > 1) {
        subtitulo((E.monto || 'Valor') + ' por ' + (E.tipo || 'tipo').toLowerCase());
        barrasH(A.porTipo.map(function (d) { return { etiqueta: d.etiqueta, valor: d.monto }; }).sort(function (a, b) { return b.valor - a.valor; }), { formato: 'pesos', titular: false, ancho: 56 });
      }

      /* 6. ANEXO: el detalle */
      nuevaPagina();
      var TOPE = 400, det = A.regs.slice(-TOPE).reverse();
      seccion(n++, 'Anexo · Detalle de ' + pal[1], A.total > TOPE ? 'Los ' + ent(TOPE) + ' más recientes de ' + ent(A.total) + '. El detalle completo está en la descarga en Excel de Mis registros.'
        : 'Los ' + ent(A.total) + ' ' + pal[1] + ' del periodo, del más reciente al más antiguo.');
      var cols = [{ titulo: 'Fecha', ancho: 24 }, { titulo: E.tipo || 'Tipo', ancho: 42, negrilla: true, color: function (f) { return f.tono; } },
                  { titulo: E.sujeto || 'Sujeto' }, { titulo: E.categoria || 'Categoría', ancho: 40 }];
      if (A.hayMonto) cols.push({ titulo: E.monto || 'Valor', ancho: 26, derecha: true });
      tabla(cols, det.map(function (r) {
        var f = [dma(r.fecha) + (r.hora ? ' ' + String(r.hora).slice(0, 5) : ''), r.tipo,
                 (r.sujeto ? titular(r.sujeto) : '') + (r.ref ? (r.sujeto ? ' · ' : '') + r.ref : ''), titular(r.categoria || '')];
        if (A.hayMonto) f.push(r.monto ? plata(r.monto) : '');
        f.tono = r.tono === 'malo' ? 'malo' : '';
        return f;
      }));
    }

    /* 7. NOTA METODOLÓGICA Y FIRMA */
    cabe(58);
    if (y > arriba + 5) y += 2;
    subtitulo('Nota metodológica');
    var notas = [
      'Fuente: registros del aplicativo ' + sp.app + ' del ecosistema FLANDES-CORE, consultados en el momento de generar este informe.',
      'Periodo pedido: del ' + dma(A.pedido.desde) + ' al ' + dma(A.pedido.hasta) + (A.recortado ? '; el análisis arranca en el primer registro (' + dma(A.desde) + ')' : '') + '. Los días hábiles cuentan de lunes a viernes (no descuentan festivos).',
      'Los porcentajes de resultado se calculan sobre lo decidido (' + TT.ok.toLowerCase() + ' y ' + TT.malo.toLowerCase() + '); lo informativo o en trámite no entra en esa cuenta.',
      'Código de verificación ' + codigo + '. Generado el ' + generado.toLocaleString('es-CO') + '.'
    ];
    notas.forEach(function (t) {
      var l = cortar(t, 'normal', 7.6, util);
      fuente('normal', 7.6, C.gris);
      l.forEach(function (x) { doc.text(x, mx, y); y += 3.7; });
      y += 1;
    });
    y += 12;
    cabe(18);
    trazo(C.tinta, 0.3); doc.line(mx, y, mx + 70, y);
    fuente('bold', 8.6, C.tinta); doc.text(sp.persona, mx, y + 4.5);
    fuente('normal', 7.4, C.gris); doc.text((sp.rol ? sp.rol + ' · ' : '') + 'Responsable de la información', mx, y + 8.4);

    /* pies con número de página (la portada no lleva) */
    var tot = doc.internal.getNumberOfPages();
    for (var p = 2; p <= tot; p++) {
      doc.setPage(p);
      trazo(C.linea, 0.3); doc.line(mx, H - 12, W - mx, H - 12);
      fuente('normal', 6.8, C.gris2);
      doc.text(recorte('Informe gerencial · ' + sp.app + ' · ' + sp.persona + ' · ' + dma(A.pedido.desde) + ' al ' + dma(A.pedido.hasta), 'normal', 6.8, util - 30), mx, H - 8);
      fuente('bold', 6.8, C.verde); doc.text('Página ' + p + ' de ' + tot, W - mx, H - 8, { align: 'right' });
    }

    var nombre = (K && K.piezas && K.piezas.exportar ? K.piezas.exportar.nombreArchivo(sp.nombre || 'Informe gerencial') : 'Informe_gerencial') + '.pdf';
    doc.save(nombre);
    return { paginas: tot, nombre: nombre, total: A.total };
  }

  /** Un código corto para cotejar el impreso con el sistema. */
  function verificacion(sp, A, f) {
    var s = [sp.app, sp.persona, A.desde, A.hasta, A.total, A.monto, f.getTime()].join('|'), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'FC-' + h.toString(36).toUpperCase().slice(0, 6) + '-' + f.getFullYear();
  }

  window.KIT_GERENCIAL = { dibujar: dibujar, analizar: analizar, hallazgos: hallazgos, sintesis: sintesis, _titular: titular };
}());
