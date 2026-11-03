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
     02/11 · el % repetido es de ESTRUCTURA (no de palabras) y cada
       actividad lleva sus 6 bombillos: el mismo motor (ESTR) que usan el
       borrador del contratista y la revisión (kit/variacion.js).
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

  var NO_REQ = /(no\s+fue\s+requerid|no\s+(se\s+)?(le\s+)?(ha\s+)?requiri|no\s+se\s+requiri|no\s+fue\s+solicitad|no\s+se\s+solicit|no\s+aplic|no\s+hubo\s+(actividad|requerimiento)|sin\s+actividad|no\s+se\s+present[oó]\s+(ninguna|requerimiento)|no\s+se\s+ejecut|no\s+se\s+realizaron\s+actividades|no\s+se\s+realizo\s+(durante|en)\s+(el|este)\s+periodo)/i;
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

  /* ══════════════ 02/11 · MOTOR DE VARIACIÓN POR ESTRUCTURA ══════════════
     UN solo motor para el borrador del contratista (bombillos en vivo), la
     revisión de Supervisión y Contratación, el informe gerencial y su Excel.
     Lo que se mide es la FORMA de escribir, no el vocabulario:
       · léxico protegido por obligación (palabras de la obligación, los
         sustantivos que el contratista usa en 2+ cuentas, términos de gestión,
         dependencias y entidades): nunca cuenta como repetido;
       · esqueleto: cifras, números en letras y códigos -> #, fechas -> FECHA,
         léxico -> T; quedan conectores, verbos con su forma, orden y puntuación;
       · repetida si: esqueleto >= 60 % igual (4-gramas), idéntica, plantilla
         rellenada en la mitad o más de sus frases, o mismo orden de frases.
     Y 6 bombillos: qué distinto, cuántos, para quién, resultado, cuándo y
     soporte. Sin IA y sin viajes: todo corre en el teléfono (< 5 ms).
     Calibrado el 02/11/2026 con 8 contratos reales (364 actividades). */
  var ESTR = (function () {
    /* sin tildes y en minúscula, rápido: la mayoría de palabras no tiene tildes */
    var TILDE = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N' };
    var RTILDE = /[áéíóúüñÁÉÍÓÚÜÑ]/g;
    function st(s) {
      s = String(s || '');
      if (!/[^\x00-\x7f]/.test(s)) return s;
      s = s.replace(RTILDE, function (c) { return TILDE[c]; });
      return /[^\x00-\x7f]/.test(s) ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
    }
    var MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
    var MES_N = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
    var NUMW = 'un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti[a-z]+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|mil';
    var RNUM = new RegExp('^(' + NUMW + ')$'), RNUMF = new RegExp('^(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti[a-z]+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|mil)$');
    var RMES = new RegExp('^(' + MESES + ')$');
    var MES_ABR = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', sept: 'septiembre', set: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };
    var FUN = {};
    ('a al ante bajo con contra de del desde durante en entre hacia hasta mediante para por segun sin sobre tras y e o u ni que como cuando donde cual cuales quien el la los las lo un una unos unas este esta estos estas ese esa esos esas su sus se le les me mi mis nos no si ya mas muy tambien asi cada todo toda todos todas dicha dicho dichas dichos misma mismo mismas mismos otro otra otros otras es son fue fueron ha han he hay ser sido esta estan etc').split(' ').forEach(function (w) { FUN[w] = 1; });
    /* términos de gestión y entidades: nunca cuentan como repetidos */
    var GEST = /^(document|visita|atencion|proceso|publicacion|informe|oficio|acta|reunion|capacitacion|base|datos|expediente|tramite|solicitud|peticion|pqr|derecho|tutela|requerimiento|resolucion|contrato|cuenta|cobro|factura|predio|contribuyente|usuario|ciudadan|beneficiari|registro|certificad|constancia|listado|relacion|formato|matriz|plataforma|sistema|aplicativo|archivo|carpeta|correo|comunicacion|notificacion|liquidacion|acuerdo|convenio|plan|programa|proyecto|actividad|evidencia|anexo|soporte|seguimiento|control|revision|verificacion|apoyo|asesoria|orientacion|jornada|mesa|comite|taller|campana|secretari|alcald|despacho|oficina|dependencia|hacienda|gobierno|planeacion|salud|concejo|personeria|contraloria|procuraduria|gobernacion|dian|sisben|secop|juzgado|fiscalia|policia|icbf|comisaria|inspeccion|tesoreria|contabilidad|almacen|juridic|municipi|flandes|tolima|entidad|comunidad|barrio|vereda|poblacion|junta|asociacion|fundacion|colegio|institucion|hospital|eps|ips|ese|caso|evento|reporte|consolidado|respuesta|minuta|estudio|poliza|cronograma|indicador|meta|encuesta|ficha|historia|paciente|productor|predial|impuesto|cartera|cobro|embargo|titulo|acto|expediente|radicado|consulta|contenido|pieza|video|boletin|noticia|red|redes)/;
    var CONTABLE = /^(document|visita|atencion|proceso|publicacion|informe|oficio|acta|reunion|capacitacion|expediente|tramite|solicitud|peticion|pqr|derecho|tutela|requerimiento|resolucion|contrato|cuenta|factura|predio|contribuyente|usuario|ciudadan|beneficiari|registro|certificad|constancia|listado|formato|archivo|correo|comunicacion|notificacion|liquidacion|acuerdo|convenio|actividad|evidencia|jornada|mesa|comite|taller|campana|caso|evento|reporte|respuesta|minuta|estudio|poliza|encuesta|ficha|paciente|productor|persona|familia|nino|nina|adulto|joven|estudiante|funcionari|servidor|contratista|asistente|participante|hora|dia|semana|mes|pieza|video|boletin|noticia|publicacion|post|contenido|cuna|mensaje|llamada|acto|auto|mandamiento|embargo|titulo|cobro|recibo|pago|radicado|consulta|vacuna|dosis|muestra|animal|bovino|ave|cerdo|perro|gato|arbol|hectarea|metro|kilometro|obra|punto|sede|institucion|colegio|barrio|vereda|grupo|equipo|modulo|vista|app|aplicacion|herramienta|indicador|meta|objetivo|item|matriz|base|tabla|grafica|hoja|plantilla|carpeta|folio|pagina)/;
    var LUGAR_O_GENTE = /^(secretari|alcald|despacho|oficina|dependencia|concejo|personeria|contraloria|procuraduria|gobernacion|dian|juzgado|fiscalia|policia|icbf|comisaria|inspeccion|tesoreria|contabilidad|almacen|hospital|eps|ips|ese|entidad|comunidad|barrio|vereda|poblacion|junta|asociacion|fundacion|colegio|institucion|escuela|contribuyente|ciudadan|usuari|beneficiari|personal|persona|familia|nino|nina|adulto|joven|estudiante|docente|funcionari|servidor|contratista|productor|campesin|victima|lider|madre|padre|paciente|medico|enfermer|area|equipo|grupo|ministerio|superintendencia|registraduria|notaria|banco|empresa|operador|proveedor|supervisor|jefe|director|gerente|alcalde|alcaldesa|secretario|secretaria)/;
    var RESULTADO_V = /^(entreg|elabor|public|radic|aprob|logr|expid|emit|proyect|present|remit|envi|firm|notific|gener|consolid|actualiz|carg|suscrib|adjudic|socializ|diseñ|disen|desarroll|implement|culmin|termin|finaliz|resolv|respond|tramit|archiv|digitaliz|organiz|realiz)(o|e|aron|amos|ado|ada|ados|adas|ido|ida|idos|idas|io|ieron)$/;
    var RESULTADO_N = /^(informe|acta|oficio|listado|resolucion|registro|certificad|constancia|consolidado|matriz|respuesta|concepto|decreto|circular|minuta|cronograma|plan|programa|protocolo|manual|instructivo|boletin|pieza|video|ficha|auto|mandamiento|entregable|producto|presentacion|dashboard|tablero|aplicacion|modulo)/;

    /* las pruebas por palabra se recuerdan (la misma palabra se repite mucho y la regex es larga) */
    function memo(re) { var c = {}; return function (w) { var v = c[w]; if (v === undefined) { v = re.test(w); c[w] = v; } return v; }; }
    var esGest = memo(GEST), esCont = memo(CONTABLE), esGente = memo(LUGAR_O_GENTE), esResV = memo(RESULTADO_V), esResN = memo(RESULTADO_N);

    function tokens(texto) {
      var t = String(texto || ''), out = [], re = /[A-Za-z]{1,5}-?\d+(?:-\d+)+|[A-Z]{1,5}\d+|\d+(?:-\d+)+|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|\d+(?:[.,]\d+)*%?|[.;:!?()\/-]|\n/g, m;
      while ((m = re.exec(t))) out.push({ o: m[0], w: st(m[0]).toLowerCase(), i: m.index, f: m.index + m[0].length, cod: /\d-\d|[A-Za-z]-?\d/.test(m[0]) });
      return out;
    }
    function esVerbo(k) { return /[óé]$/.test(k.o) || /(aron|ieron|amos|imos|ando|iendo|aba|aban|ar|er|ir)$/.test(k.w); }
    function palabra(k) { return /^[a-zñ]+$/.test(k.w); }

    /* Marca qué tokens son cifras de gestión, fechas, códigos o numeración (no cifras). */
    function clasificar(k, nContrato) {
      var i, a;
      var nC = String(nContrato || '').replace(/\D/g, '').replace(/^0+/, '');
      /* 02/11 · «28 sep», «19 de oct.»: el mes abreviado cuenta como mes cuando lleva el día delante */
      for (i = 1; i < k.length; i++) {
        var ab = MES_ABR[k[i].w];
        if (ab && (/^\d{1,2}$/.test(k[i - 1].o) || (k[i - 1].w === 'de' && k[i - 2] && /^\d{1,2}$/.test(k[i - 2].o)))) k[i].w = ab;
      }
      for (i = 0; i < k.length; i++) {
        a = k[i]; a.tipo = '';
        if (a.cod) { a.tipo = 'codigo'; continue; }
        if (RMES.test(a.w)) { a.tipo = 'mes'; continue; }
        var dig = /^\d/.test(a.o), nw = RNUM.test(a.w);
        if (!dig && !nw) continue;
        var ant = k[i - 1], sig = k[i + 1], ant2 = k[i - 2];
        /* fecha: 19 de marzo, 21/09/2026, años */
        if (dig && sig && sig.w === 'de' && k[i + 2] && RMES.test(k[i + 2].w)) { a.tipo = 'fecha'; continue; }
        if (dig && sig && RMES.test(sig.w)) { a.tipo = 'fecha'; continue; }
        if (dig && /^(19|20)\d\d$/.test(a.o)) { a.tipo = 'fecha'; continue; }
        if (dig && sig && sig.o === '/' && k[i + 2] && /^\d/.test(k[i + 2].o)) { a.tipo = 'fecha'; k[i + 2].tipo = 'fecha'; if (k[i + 4] && k[i + 3].o === '/') k[i + 4].tipo = 'fecha'; i += 2; continue; }
        if (ant && ant.o === '/' && ant2 && /^\d/.test(ant2.o)) { a.tipo = 'fecha'; continue; }
        /* códigos: C209-2026, MC-011-2026, CPS340 */
        if (dig && ant && ant.f === a.i && (ant.o === '-' && ant2 && ant2.f === ant.i && /^[A-Za-z0-9]/.test(ant2.o) || /^[A-Za-z]+$/.test(ant.o))) { a.tipo = 'codigo'; continue; }
        if (dig && sig && sig.o === '-' && k[i + 2] && /^\d/.test(k[i + 2].o)) { a.tipo = 'codigo'; continue; }
        /* contrato N, anexo N, numeral N, N° */
        if (ant && /^(contrato|cuenta|obligacion|informe|item|numeral|punto|vigencia|anexo|n|no|nro|numero|resolucion|decreto|acuerdo|ley|articulo|radicado|cps|cto)$/.test(ant.w)) { a.tipo = 'codigo'; continue; }
        /* numeración "1." "2)" al empezar renglón o frase */
        if (dig && sig && (sig.o === '.' || sig.o === ')') && (!ant || ant.o === '\n' || ant.o === '.' || ant.o === '-' || ant.o === ';' || ant.o === ':')) { a.tipo = 'numeral'; continue; }
        if (dig && /^\d{7,}$/.test(a.o.replace(/[.,]/g, '')) && !/[.,]\d{3}$/.test(a.o)) { a.tipo = 'codigo'; continue; }
        if (dig && nC && a.o.replace(/^0+/, '') === nC) { a.tipo = 'codigo'; continue; }
        /* "un/una/uno" solo es cifra si le sigue un sustantivo contable directo (y aun así, débil) */
        if (!dig && !RNUMF.test(a.w)) { a.tipo = 'uno'; continue; }
        a.tipo = 'cifra';
      }
      return k;
    }

    /** Léxico protegido de UNA obligación. */
    function lexico(oblTexto, previos) {
      var L = {};
      tokens(oblTexto).forEach(function (k) { if (k.w.length > 3 && !FUN[k.w] && palabra(k)) L[k.w] = 1; });
      var cuenta = {};
      (previos || []).forEach(function (p) {
        var vistos = {};
        tokens(p).forEach(function (k) { if (k.w.length > 3 && !FUN[k.w] && palabra(k) && !esVerbo(k)) vistos[k.w] = 1; });
        for (var w in vistos) cuenta[w] = (cuenta[w] || 0) + 1;
      });
      for (var w2 in cuenta) if (cuenta[w2] >= 2) L[w2] = 1;
      return L;
    }

    /**
     * Esqueleto: [{s, i, f}] (marca y tramo del texto original).
     * ligero=true solo cambia cifras, fechas y nombres (plantilla rellenada).
     */
    function esqueleto(texto, L, ligero, nContrato, kPre) {
      var k = kPre || clasificar(tokens(texto), nContrato), out = [], prev = '', inicio = true;
      for (var i = 0; i < k.length; i++) {
        var a = k[i], s;
        if (a.o === '\n' || a.o === '.' || a.o === ';' || a.o === '!' || a.o === '?') { s = '.'; inicio = true; }
        else if (a.o === ':') s = ':';
        else if (a.o === '(' || a.o === ')' || a.o === '/' || a.o === '-') continue;
        else if (a.tipo === 'numeral') continue;
        else if (a.tipo === 'fecha' || a.tipo === 'mes') s = 'FECHA';
        else if (a.tipo) s = '#';
        else if (!ligero && (L[a.w] || esGest(a.w))) s = 'T';
        else if (!inicio && /^[A-ZÁÉÍÓÚÑ]/.test(a.o) && !FUN[a.w] && a.w.length > 1) s = ligero ? 'NOMBRE' : 'T';
        else s = a.w;
        var c0 = s.charCodeAt(0); if ((c0 >= 97 && c0 <= 122) || c0 === 241) inicio = false;
        var ult = out[out.length - 1];
        /* marcadores seguidos (# ( # ), FECHA de FECHA, T T, ..) en uno solo */
        if (ult && (s === ult.s && (s === '#' || s === 'T' || s === 'NOMBRE' || s === '.' || s === 'FECHA') || (s === '#' && ult.s === 'FECHA') || (s === 'FECHA' && ult.s === '#'))) {
          ult.f = a.f; if (s === 'FECHA') ult.s = 'FECHA'; continue;
        }
        if ((s === 'de' || s === 'del' || s === 'y' || s === 'al') && ult && (ult.s === 'FECHA' || ult.s === '#') && k[i + 1] && (k[i + 1].tipo === 'fecha' || k[i + 1].tipo === 'mes')) continue;
        if (s === '.' && !out.length) continue;
        out.push({ s: s, i: a.i, f: a.f });
      }
      while (out.length && out[out.length - 1].s === '.') out.pop();
      return out;
    }
    function marcas(E) { return E.map(function (x) { return x.s; }); }
    function tejas(w, n) {
      var o = {}, c = 0, i, kk, L = w.length;
      if (L < n) { if (L) { o[w.join(' ')] = [0]; c = 1; } return { set: o, n: c }; }
      for (i = 0; i + n <= L; i++) {
        kk = n === 4 ? w[i] + ' ' + w[i + 1] + ' ' + w[i + 2] + ' ' + w[i + 3] : (n === 3 ? w[i] + ' ' + w[i + 1] + ' ' + w[i + 2] : w.slice(i, i + n).join(' '));
        if (o[kk] === undefined) { o[kk] = [i]; c++; } else o[kk].push(i);
      }
      return { set: o, n: c };
    }
    /** Frases de un esqueleto: trozos entre puntos. */
    function trozos(E) {
      var F = [], cur = [];
      E.forEach(function (x) { if (x.s === '.' || x.s === ':') { if (cur.length) F.push(cur); cur = []; } else cur.push(x); });
      if (cur.length) F.push(cur);
      return F;
    }

    var N = 4;             /* n-gramas del esqueleto */
    var MIN_ESQ = 8;       /* por debajo, solo cuenta si el esqueleto es idéntico */
    var U_EST = 60;        /* % de estructura que se marca como repetida */
    var MIN_FRASE = 6;     /* palabras para que una frase pueda ser plantilla */

    /**
     * Prepara una obligación UNA vez: léxico y esqueletos de las cuentas anteriores.
     * previos: [{informe, texto, cifras?}] del más viejo al más nuevo.
     */
    function preparar(oblTexto, previos, nContrato) {
      var P = { obl: oblTexto, nC: nContrato, previos: [] };
      var textos = (previos || []).map(function (p) { return p.texto; });
      P.L = lexico(oblTexto, textos);
      (previos || []).forEach(function (p) {
        var k = clasificar(tokens(p.texto), nContrato);
        var E = esqueleto(p.texto, P.L, false, nContrato, k), m = marcas(E);
        var fr = {};
        trozos(esqueleto(p.texto, P.L, true, nContrato, k)).forEach(function (f) { fr[marcas(f).join(' ')] = 1; });
        var idx = {}, tam = [];
        trozos(E).forEach(function (f, fi) { var tf = tejas(marcas(f), 3); tam.push(tf.n); for (var g in tf.set) (idx[g] = idx[g] || []).push(fi); });
        P.previos.push({ informe: p.informe, texto: p.texto, m: m, tej: tejas(m, N).set, frases: fr, idx: idx, crudo: normal(p.texto), cifras: cifrasCon(p.texto, P.L, nContrato, k) });
      });
      return P;
    }
    function normal(s) { return st(s).toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim(); }

    /** Cifras de gestión con su "qué": [{n, que, i, f}] */
    function cifrasCon(texto, L, nContrato, kPre) {
      var k = kPre || clasificar(tokens(texto), nContrato), out = [];
      for (var i = 0; i < k.length; i++) {
        var a = k[i];
        if (a.tipo !== 'cifra') continue;
        var valor = /^\d/.test(a.o) ? a.o.replace(/[^\d,%]/g, '') : a.w;
        /* número en letras seguido de (38): un solo número */
        var j = i + 1, salto = 0, que = null;
        while (j < k.length && salto <= 3) {
          var b = k[j];
          if (b.o === '(' || b.o === ')' || (b.tipo === 'cifra' && j === i + 2 && k[i + 1].o === '(')) { if (b.tipo === 'cifra') { valor = b.o; k[j].tipo = 'eco'; } j++; continue; }
          if (b.o === '.' || b.o === ';' || b.o === '\n' || b.o === ':') break;
          if (b.tipo === 'cifra' || b.tipo === 'uno' || (b.w === 'y' && k[j + 1] && k[j + 1].tipo === 'cifra')) { j++; continue; }   /* "setenta y seis (76)" es un solo número */
          if (palabra(b)) {
            if (esCont(b.w) || L[b.w] || esGest(b.w) || (/(s|es)$/.test(b.w) && b.w.length > 3 && !FUN[b.w] && !esVerbo(b) && !/^(veces|mas|menos|pesos)$/.test(b.w))) { que = b; break; }
            salto++;   /* hasta 3 palabras entre la cifra y su qué */
          }
          j++;
        }
        var ini = a.i;
        if (/^\d/.test(a.o) && k[i - 1] && k[i - 1].o === '(' && k[i - 2] && (k[i - 2].tipo === 'cifra' || k[i - 2].tipo === 'uno')) ini = k[i - 2].i;
        if (que) out.push({ n: String(valor).replace(/^0+(?=\d)/, ''), que: que.w.replace(/(es|s)$/, ''), i: ini, f: frase(k, k.indexOf(que)) });
      }
      return out;
    }

    var SISTEMA = /^(modulo|plataforma|drive|excel|word|pdf|secop|sistema|aplicativo|app|software|dashboard|formato|anexo|plan|informe)$/;
    function bQuien(texto, k) {
      /* preposición + (artículo) + destinatario: dependencia, comunidad, entidad, población o nombre propio */
      for (var i = 0; i < k.length; i++) {
        var a = k[i], ini = i;
        var prep = /^(para|con|ante|al|a|hacia)$/.test(a.w) || /^dirigid[oa]s?$/.test(a.w) || (a.w === 'apoyo' && k[i - 1] && k[i - 1].w === 'en' && k[i + 1] && /^(de|a|al)$/.test(k[i + 1].w));
        if (!prep) continue;
        if (a.w === 'a' && k[i + 1] && /^(traves|cabo|fin|partir|tiempo|cargo|nivel|corte)$/.test(k[i + 1].w)) continue;
        if (a.w === 'al' && k[i + 1] && /^(interior|dia|corte|cierre|respecto)$/.test(k[i + 1].w)) continue;
        var j = i + 1;
        while (j < k.length && palabra(k[j]) && /^(el|la|los|las|un|una|unos|unas|sus|su|del|de|a|al|dicha|dicho|esta|este|estas|estos|todo|toda|todos|todas|cada|diferentes|distintas|distintos|varias|varios)$/.test(k[j].w)) j++;
        /* 02/11 · «con 32 estudiantes», «a 15 familias»: la cifra entre la preposición y el grupo */
        if (k[j] && k[j].tipo === 'cifra' && k[j + 1] && palabra(k[j + 1]) && esGente(k[j + 1].w)) j++;
        var b = k[j];
        if (!b || !palabra(b)) continue;
        if (esGente(b.w) || (/^[A-ZÁÉÍÓÚÑ]/.test(b.o) && b.w.length > 2 && !FUN[b.w] && !RMES.test(b.w) && !RNUM.test(b.w) && !SISTEMA.test(b.w) && !esGest(b.w) || /^[A-ZÁÉÍÓÚÑ]/.test(b.o) && esGente(b.w))) return { i: k[ini].i, f: hastaFin(k, j) };
      }
      return null;
    }
    function hastaFin(k, j) { var f = k[j].f; for (var q = j + 1; q < k.length && q <= j + 4 && palabra(k[q]) && /^[A-ZÁÉÍÓÚÑ]/.test(k[q].o); q++) f = k[q].f; return f; }

    /** El sustantivo con su complemento: "Plan de acción", "informe de visitas", "acta de la reunión". */
    function frase(k, j) {
      var f = k[j].f, q = j + 1;
      if (k[q] && /^(de|del|para)$/.test(k[q].w)) {
        var r = q + 1;
        if (k[r] && /^(la|el|los|las)$/.test(k[r].w)) r++;
        if (k[r] && palabra(k[r]) && !FUN[k[r].w]) f = k[r].f;
      }
      return f;
    }
    function bResultado(k) {
      /* 03/11 · primero el ENTREGABLE (lo que quedó: «Plan de acción»); si no lo nombra, el verbo de resultado */
      for (var i = 0; i < k.length; i++) { var a = k[i]; if (palabra(a) && esResN(a.w)) return { i: a.i, f: frase(k, i), que: 'entregable' }; }
      for (i = 0; i < k.length; i++) {
        a = k[i]; if (!palabra(a)) continue;
        /* verbo conjugado (se entregó, elaboré, radicaron) o participio con su auxiliar (fue aprobado, quedaron publicados);
           un participio suelto suele ser adjetivo ("los eventos presentados") y no cuenta */
        var aux = k[i - 1] && /^(fue|fueron|quedo|quedaron|quedando|sido|ha|han|he|hemos|esta|estan|queda|quedan)$/.test(k[i - 1].w);
        if (esResV(a.w) && !/^(realiz)/.test(a.w) && (/[óé]$/.test(a.o) || /(aron|ieron|amos)$/.test(a.w) || (k[i - 1] && k[i - 1].w === 'se') ||
            (aux && /(ado|ada|ados|adas|ido|ida|idos|idas)$/.test(a.w)))) return { i: a.i, f: a.f, que: 'verbo' };
        if (/^(quedo|quedaron|quedando|logrando|obteniendo|dejando)$/.test(a.w)) return { i: a.i, f: a.f, que: 'verbo' };
      }
      return null;
    }

    function isoMas(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
    function bCuando(k, desde, hasta) {
      var hall = null, fuera = [];
      var y0 = desde ? +desde.slice(0, 4) : null;
      for (var i = 0; i < k.length; i++) {
        var a = k[i];
        if (a.tipo === 'mes') {
          if (!hall || hall.debil) hall = { i: k[i - 2] && k[i - 1] && k[i - 1].w === 'de' && /^\d/.test(k[i - 2].o) ? k[i - 2].i : (k[i - 1] && /^\d{1,2}$/.test(k[i - 1].o) ? k[i - 1].i : a.i), f: a.f };
          var d = k[i - 2] && k[i - 1] && k[i - 1].w === 'de' && /^\d{1,2}$/.test(k[i - 2].o) ? +k[i - 2].o : (k[i - 1] && /^\d{1,2}$/.test(k[i - 1].o) ? +k[i - 1].o : null);
          var y = null;
          if (k[i + 1] && /^(de|del)$/.test(k[i + 1].w) && k[i + 2] && /^(19|20)\d\d$/.test(k[i + 2].o)) y = +k[i + 2].o;
          if (d && desde && hasta) {
            var iso = isoMas(y || y0, MES_N[a.w], d), ini = k[i - 2] && k[i - 1].w === 'de' ? k[i - 2].i : k[i - 1].i;
            if (iso < restar(desde, 3) || iso > sumar(hasta, 3)) fuera.push({ i: ini, f: y ? k[i + 2].f : a.f, iso: iso });
          }
        } else if (a.tipo === 'fecha' && /^\d{1,2}$/.test(a.o) && k[i + 1] && k[i + 1].o === '/' && k[i + 2] && /^\d{1,2}$/.test(k[i + 2].o)) {
          hall = hall || { i: a.i, f: k[i + 2].f };
          var yy = k[i + 4] && k[i + 3].o === '/' ? +k[i + 4].o : y0; if (yy && yy < 100) yy += 2000;
          if (desde && hasta && yy) { var iso2 = isoMas(yy, +k[i + 2].o, +a.o); if (iso2 < restar(desde, 3) || iso2 > sumar(hasta, 3)) fuera.push({ i: a.i, f: (k[i + 4] || k[i + 2]).f, iso: iso2 }); }
        } else if (!hall && palabra(a) && /^(semana|semanas|dia|dias|diario|diaria|diariamente|semanal|semanalmente|quincena|lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/.test(a.w)) {
          hall = { i: a.i, f: a.f, debil: true };
        }
      }
      return hall ? { i: hall.i, f: hall.f, fuera: fuera } : null;
    }
    function sumar(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function restar(iso, n) { return sumar(iso, -n); }

    var NO_REQ = /(no\s+fue\s+requerid|no\s+(se\s+)?(le\s+)?(ha\s+)?requiri|no\s+se\s+requiri|no\s+fue\s+solicitad|no\s+se\s+solicit|no\s+aplic|no\s+hubo\s+(actividad|requerimiento)|sin\s+actividad|no\s+se\s+present[oó]\s+(ninguna|requerimiento)|no\s+se\s+ejecut|no\s+se\s+realizaron\s+actividades)/i;
    /* 03/11 · EL SOPORTE (bombillo 6)
         verde   = hay evidencias o adjuntos cargados, o escribe que la actividad NO requiere adjunto;
         naranja = no cargó nada, pero dice DÓNDE puede verificarlo el supervisor (carpeta física, expediente,
                   SECOP, un enlace…), o la obligación, por su redacción, no pide un producto (asistir, atender,
                   acompañar…): falta decir que no requiere adjunto o subir el soporte;
         rojo    = obligación que pide un producto (elaborar, presentar, informe, acta…) sin soporte ni dónde
                   verificarlo, o el texto dice que adjunta algo que no está cargado. */
    var NO_ADJ = /\bno\s+(requiere|requirio|necesita|genera|genero|aplica|lleva)\s+(de\s+)?(un\s+|una\s+|ningun\s+|ninguna\s+)?(adjunto|anexo|soporte|evidencia|archivo|documento)s?\b|\bsin\s+(adjunto|anexo|soporte)s?\s+(por|porque|ya)\b|\b(adjunto|anexo|soporte|evidencia)s?\s*:?\s*no\s+aplica\b/;
    var DONDE = /\b((se\s+encuentra(n)?\s+)?soportad[oa]s?\s+en|consignad[oa]s?\s+en|registrad[oa]s?\s+en\s+(la|el)\s+(bitacora|plataforma|sistema|libro|aplicativo)|bitacora\s+(denominada|de|del)|carpeta\s+(fisica|digital|compartida|de\s+\w+|n|no|numero)|archivo\s+(fisico|de\s+gestion|central|digital)|expediente\s+(n|no|numero|fisico|\d)|reposa|se\s+encuentra(n)?\s+(en|disponible)|se\s+puede(n)?\s+(revisar|consultar|verificar|ver)|puede(n)?\s+ser\s+(consultad|verificad|revisad)|disponible(s)?\s+(en|para)|(consultar|verificar|revisar)\s+en|secop|https?:\/\/|www\.|correo\s+(electronico\s+)?(enviado|remitido|del|de\s+la|institucional)|radicad[oa]s?\s+(con|bajo|en|n|no)|oficio\s+(n|no|numero)|folios?\s+\d|libro\s+(de|radicador)|(en|del)\s+(el\s+)?drive\s+(de\s+la|del|institucional|compartido))/;
    var DICE_ADJ = /\b(se\s+adjunta|adjunto\s+(el|la|los|las)|se\s+anexa|anexo\s+(el|la|los|las)|ver\s+anexo|en\s+el\s+anexo)\b/;
    var OBL_PRODUCTO = /(elaborar|presentar|entregar|proyectar|rendir|publicar|disenar|consolidar|actualizar|cargar|radicar|levantar|documentar|sistematizar|digitalizar|redactar|construir|formular|producir|generar|informe|documento|acta|base de datos|registro|reporte|matriz|estudio|plan |concepto|respuesta|piezas|contenido)/;
    function bSoporte(texto, obl, soporte) {
      var t = st(texto).toLowerCase(), m;
      if (soporte > 0) return { e: 'verde', d: 'La obligación tiene ' + soporte + (soporte === 1 ? ' soporte cargado.' : ' soportes cargados.'), como: 'cargado' };
      if ((m = NO_ADJ.exec(t))) return { e: 'verde', d: 'Indicaste que no requiere adjunto. Tu supervisor puede pedirte el soporte si lo necesita.', r: [[m.index, m.index + m[0].length]], como: 'noRequiere' };
      if ((m = DONDE.exec(t))) {
        var fin = texto.slice(m.index).search(/\.(\s|$)|[;\n]/), hasta = m.index + (fin < 0 ? texto.length - m.index : fin);
        if (hasta - m.index > 90) hasta = m.index + 90;
        return { e: 'amarillo', d: 'Dices dónde se puede verificar: «' + texto.slice(m.index, hasta).trim() + '». Para el verde: sube el soporte o, si esta obligación no lo requiere, escribe «no requiere adjunto».', r: [[m.index, hasta]], como: 'donde' };
      }
      if ((m = DICE_ADJ.exec(t))) return { e: 'rojo', d: 'Tu texto dice que adjunta un soporte, pero esta obligación no tiene nada cargado: súbelo aquí.', r: [[m.index, m.index + m[0].length]], como: 'diceAdjunta' };
      if (!OBL_PRODUCTO.test(st(obl || '').toLowerCase() + ' ')) return { e: 'amarillo', d: 'Esta obligación puede no requerir adjunto. Si es así, escríbelo («no requiere adjunto»); si no, sube la evidencia o di dónde la puede verificar tu supervisor.', como: 'oblSinProducto' };
      return { e: 'rojo', d: 'Esta obligación pide un producto y no tiene evidencias ni adjuntos cargados.', como: 'nada' };
    }


    /**
     * Analiza UNA actividad.
     * ctx = {general, desde, hasta, soporte (n de evidencias+adjuntos), nContrato}
     * -> {estado, pct, con, plantillas, orden, ident, b:[6 bombillos], cifraIgual:[], rep:[[i,f]]}
     * bombillo: {k, e:'verde'|'rojo'|'gris'|'amarillo', d (qué detectó), r:[[i,f]]}
     */
    /** A qué bombillo pertenece un [dato por llenar]. */
    function kDeCorchete(x) {
      var w = st(x).toLowerCase();
      if (/numero|cantidad|cuant|total|cifra|n°/.test(w)) return 1;
      if (/fecha|dia|semana|mes\b|cuando|hora|periodo/.test(w)) return 4;
      if (/adjunt|anex/.test(w)) return 5;
      if (/listado|registro|acta|informe|entregable|soporte|evidencia|document|fotograf|planilla|oficio|resultado|producto|base de datos|pieza|enlace/.test(w)) return 3;
      if (/instituc|dependencia|secretar|comunidad|quien|beneficiari|poblacion|entidad|colegio|escuela|nombre|participant|destinatar|grupo|estudiante|vereda|barrio|sector|usuario|lugar/.test(w)) return 2;
      return 3;
    }

    function analizar(texto, P, ctx) {
      ctx = ctx || {};
      var t0 = String(texto || '').trim();
      /* 02/11 · «Te ayudo»: lo que está entre [corchetes] es un dato que el contratista aún debe llenar.
         Se mide en blanco (no enciende nada) y deja en rojo el bombillo al que pertenece. */
      var CORCH = [];
      var t = t0.replace(/\[[^\[\]\n]{1,80}\]/g, function (m0, i0) { CORCH.push({ i: i0, f: i0 + m0.length, x: m0.slice(1, -1).trim() }); return new Array(m0.length + 1).join(' '); });
      var R = { pct: null, con: null, plantillas: 0, frases: 0, orden: false, ident: false, rep: [], cifraIgual: [], b: [], corchetes: CORCH };
      var vacio = !t.trim() || t === '-' || t.length < 3, noreq = !vacio && NO_REQ.test(st(t)) && !cifrasCon(t, P.L, P.nC).length;
      if (ctx.general || noreq) {
        R.estado = ctx.general ? 'general' : 'noreq';
        for (var g = 0; g < 6; g++) R.b.push({ k: g, e: 'gris', d: ctx.general ? 'Obligación general: no se mide.' : 'Actividad no requerida en el periodo.', r: [] });
        return R;
      }
      if (vacio) { R.estado = 'vacia'; for (var v = 0; v < 6; v++) R.b.push({ k: v, e: 'rojo', d: 'Sin actividad escrita.', r: [] }); return R; }
      var k = clasificar(tokens(t), P.nC);
      var hayPrev = P.previos.length > 0;
      var FL = trozos(esqueleto(t, P.L, true, P.nC, k));
      var FLp = FL.map(function (f) { var c = 0; for (var z = 0; z < f.length; z++) { var c0 = f[z].s.charCodeAt(0); if ((c0 >= 97 && c0 <= 122) || c0 === 241) c++; } return c; });
      /* lo que solo sirve para comparar se arma si hay con qué comparar (primera cuenta: más rápido) */
      var E = hayPrev ? esqueleto(t, P.L, false, P.nC, k) : [], m = hayPrev ? marcas(E) : [], T = hayPrev ? tejas(m, N) : { set: {}, n: 0 };
      var FLs = hayPrev ? FL.map(function (f) { return marcas(f).join(' '); }) : [];
      var FE = hayPrev ? trozos(E).map(function (f) { var tf = tejas(marcas(f), 3); return { n: tf.n, keys: Object.keys(tf.set) }; }) : [];
      var TK = Object.keys(T.set);
      var C = cifrasCon(t, P.L, P.nC, k);
      var crudo = hayPrev ? normal(t) : '', mj = m.join(' '), mejor = null;
      /* 1 · estructura frente a cada cuenta anterior (se toma la más parecida) */
      P.previos.forEach(function (p) {
        var x = 0, tot = 0;
        if (m.length < MIN_ESQ) x = (m.length >= 3 && mj === p.m.join(' ')) ? 100 : 0;
        else { tot = TK.length; for (var ti = 0; ti < tot; ti++) if (p.tej[TK[ti]] !== undefined) x++; x = tot ? Math.round(x * 100 / tot) : 0; }
        var pl = 0, plR = [];
        for (var fi = 0; fi < FL.length; fi++) if (FLp[fi] >= MIN_FRASE && p.frases[FLs[fi]]) { pl++; plR.push([FL[fi][0].i, FL[fi][FL[fi].length - 1].f]); }
        /* mismo orden de frases: cada frase nueva apunta a su gemela anterior (índice invertido de 3-gramas) */
        var orden = [];
        var votos = [];
        for (var q = 0; q < FE.length; q++) {
          var best = -1, bv = 0, ks = FE[q].keys, toc = [];
          if (FE[q].n < 3) continue;
          for (var gi = 0; gi < ks.length; gi++) { var L2 = p.idx[ks[gi]]; if (L2) for (var z = 0; z < L2.length; z++) { if (!votos[L2[z]]) { votos[L2[z]] = 0; toc.push(L2[z]); } votos[L2[z]]++; } }
          for (var vi = 0; vi < toc.length; vi++) { if (votos[toc[vi]] > bv) { bv = votos[toc[vi]]; best = toc[vi]; } votos[toc[vi]] = 0; }
          if (bv / FE[q].n >= 0.7) orden.push(best);
        }
        var ord = orden.length >= 3 && orden.length >= FE.length * 0.6 && orden.every(function (v2, w) { return !w || v2 > orden[w - 1]; });
        var ident = crudo === p.crudo;
        var peso = Math.max(x, ident ? 100 : 0);
        if (!mejor || peso > mejor.pct || (peso === mejor.pct && p.informe > mejor.con)) mejor = { pct: peso, con: p.informe, p: p, ident: ident };
        if (pl > R.plantillas) { R.plantillas = pl; R.plR = plR; R.plCon = p.informe; }
        if (ord) { R.orden = true; R.ordenCon = p.informe; }
      });
      if (mejor) {
        R.pct = mejor.pct; R.con = mejor.con; R.ident = mejor.ident;
        /* tramos del texto que ya estaban (solo frente a la cuenta más parecida) */
        var marca = [];
        if (mejor.ident || m.length < MIN_ESQ && mejor.pct) R.rep = [[0, t.length]];
        else {
          for (var kk2 in T.set) if (mejor.p.tej[kk2]) T.set[kk2].forEach(function (pos) { for (var q2 = pos; q2 < pos + N && q2 < E.length; q2++) marca[q2] = 1; });
          var ab = null;
          for (var e = 0; e < E.length; e++) { if (marca[e]) { if (ab) ab[1] = E[e].f; else ab = [E[e].i, E[e].f]; } else if (ab) { R.rep.push(ab); ab = null; } }
          if (ab) R.rep.push(ab);
        }
      }
      R.frases = FLp.filter(function (n) { return n >= MIN_FRASE; }).length;
      var hay = P.previos.length > 0;
      var repetida = hay && (R.ident || R.pct >= U_EST || (R.plantillas && R.plantillas >= Math.max(1, Math.ceil(R.frases / 2))) || R.orden);
      var motivo = !hay ? '' : R.ident ? 'Es igual a la de la cuenta ' + R.con + '.' :
        R.pct >= U_EST ? 'La forma de escribir es ' + R.pct + ' % igual a la cuenta ' + R.con + '.' :
        R.plantillas && R.plantillas >= Math.max(1, Math.ceil(R.frases / 2)) ? (R.plantillas === 1 ? 'Una frase' : R.plantillas + ' frases') + ' de la cuenta ' + R.plCon + ' con solo las cifras o fechas cambiadas.' :
        R.orden ? 'Las mismas frases, en el mismo orden, que la cuenta ' + R.ordenCon + '.' : 'La forma de escribir cambió frente a la cuenta ' + R.con + ' (' + R.pct + ' % parecida).';
      R.estado = repetida ? 'repetida' : 'nueva';
      R.b.push({ k: 0, e: !hay ? 'gris' : (repetida ? 'rojo' : 'verde'), d: !hay ? 'Primera cuenta: no hay con qué comparar.' : motivo, r: repetida ? (R.plantillas && R.pct < U_EST && !R.ident ? R.plR : R.rep) : [] });
      /* 2 · ¿cuántos? */
      R.b.push(C.length ? { k: 1, e: 'verde', d: 'Cifra con su qué: «' + t0.slice(C[0].i, C[0].f) + '»' + (C.length > 1 ? ' y ' + (C.length - 1) + ' más.' : '.'), r: C.map(function (c) { return [c.i, c.f]; }) }
                         : { k: 1, e: 'rojo', d: 'No hay una cifra acompañada de lo que se contó (visitas, documentos, atenciones…).', r: [] });
      /* misma cifra que la cuenta anterior: aviso informativo */
      var ult = P.previos[P.previos.length - 1];
      if (ult) C.forEach(function (c) { ult.cifras.forEach(function (o) { if (o.n === c.n && o.que === c.que) R.cifraIgual.push({ i: c.i, f: c.f, texto: t0.slice(c.i, c.f), cuenta: ult.informe }); }); });
      /* 3 · ¿para quién o con quién? */
      var q = bQuien(t, k);
      R.b.push(q ? { k: 2, e: 'verde', d: 'Destinatario o participante: «' + t0.slice(q.i, q.f) + '».', r: [[q.i, q.f]] } : { k: 2, e: 'rojo', d: 'No dice para quién o con quién (dependencia, comunidad, entidad…).', r: [] });
      /* 4 · resultado o entregable */
      var rs = bResultado(k);
      R.b.push(rs ? { k: 3, e: 'verde', d: (rs.que === 'verbo' ? 'Resultado: «' : 'Entregable: «') + t0.slice(rs.i, rs.f) + '».', r: [[rs.i, rs.f]] } : { k: 3, e: 'rojo', d: 'No dice qué quedó como resultado o entregable.', r: [] });
      /* 5 · cuándo (sin periodo todavía: no se juzga si cae dentro; se dice cuándo se sabrá) */
      var cu = bCuando(k, ctx.desde, ctx.hasta);
      var sinPer = !(ctx.desde && ctx.hasta);
      R.b.push(!cu ? { k: 4, e: 'rojo', d: 'No ubica la actividad en el tiempo (fechas, semanas, días).', r: [] }
        : cu.fuera.length ? { k: 4, e: 'amarillo', d: 'La fecha «' + t0.slice(cu.fuera[0].i, cu.fuera[0].f) + '» cae fuera del periodo de la cuenta.', r: cu.fuera.map(function (z) { return [z.i, z.f]; }) }
        : { k: 4, e: 'verde', d: 'Ubicada en el tiempo: «' + t0.slice(cu.i, cu.f) + '».' + (sinPer && ctx.avisarPeriodo ? ' Si cae dentro del periodo se determinará cuando ingreses el periodo a relacionar.' : ''), r: [[cu.i, cu.f]] });
      /* 6 · soporte: lo cargado manda; si no hay, se mira si dice DÓNDE verificarlo o que NO requiere adjunto,
         y si la obligación, por su redacción, pide un producto (informe, acta, base de datos…) */
      var so = bSoporte(t, P.obl, ctx.soporte);
      R.b.push({ k: 5, e: so.e, d: so.d, r: so.r || [], como: so.como });
      /* el fragmento que detectó cada bombillo (para el lenguaje del revisor) y por qué se marcó repetida */
      R.b.forEach(function (b) { if (b.k > 0 && b.r.length) b.x = t0.slice(b.r[0][0], b.r[0][1]); });
      R.b[5].n = ctx.soporte || 0;
      CORCH.forEach(function (c) {
        var b = R.b[kDeCorchete(c.x)];
        if (!b || b.e === 'gris') return;
        if (!b.corchete) { b.corchete = []; b.r = []; }
        b.corchete.push(c.x); b.r.push([c.i, c.f]);
        b.e = 'rojo'; b.x = t0.slice(c.i, c.f);
        b.d = 'Llena lo que está entre corchetes: ' + b.corchete.map(function (x) { return '«[' + x + ']»'; }).join(', ') + '.';
      });
      R.tipo = !repetida ? '' : R.ident ? 'identica' : R.pct >= U_EST ? 'estructura' : (R.plantillas && R.plantillas >= Math.max(1, Math.ceil(R.frases / 2))) ? 'plantilla' : 'orden';
      return R;
    }

    return { st: st, tokens: tokens, clasificar: clasificar, lexico: lexico, esqueleto: esqueleto, marcas: marcas, preparar: preparar, analizar: analizar, cifrasCon: cifrasCon, kDeCorchete: kDeCorchete, U: { N: N, MIN_ESQ: MIN_ESQ, U_EST: U_EST, MIN_FRASE: MIN_FRASE } };

  }());

  /* 02/11 · los 6 bombillos: nombre corto y su puntaje (verde 100, amarillo 50, rojo 0, gris no cuenta) */
  var BOMBILLOS = ['Qué hizo distinto', 'Cuántos', 'Para quién', 'Resultado', 'Cuándo', 'Soporte'];
  var PUNTO_B = { verde: 100, amarillo: 50, rojo: 0 };
  /** % de bombillo k en verde (amarillo vale la mitad) sobre las celdas que lo miden. */
  function pctB(celdas, k) {
    var v = [];
    celdas.forEach(function (z) { if (z.b && PUNTO_B[z.b[k]] !== undefined) v.push(PUNTO_B[z.b[k]]); });
    return v.length ? Math.round(prom(v)) : null;
  }
  /** "4 de 6": bombillos en verde de UNA celda (sobre los que aplican). */
  function verdesDe(z) {
    if (!z || !z.b) return null;
    var ap = z.b.filter(function (e) { return e !== 'gris'; });
    return { v: ap.filter(function (e) { return e === 'verde'; }).length, n: ap.length };
  }

  /** El análisis completo de un contrato. Lo usan el PDF, el Excel y la vista. */
  function analizar(d) {
    var c = (d && d.contrato) || {}, obl = c.obligaciones || [];
    var L = ((d && d.cuentas) || []).filter(function (x) { return K.norm(x.estado) !== 'BORRADOR'; })
      .slice().sort(function (a, b) { return (a.informe || 0) - (b.informe || 0); });
    var nC = c.contrato;
    var gen = obl.map(function (o) { return esGeneral(o.texto); });
    var celdas = [];                 /* [obligación][cuenta] */
    obl.forEach(function (o, i) {
      var previos = [];     /* 02/11 · las actividades anteriores de esta obligación, para el motor de estructura */
      celdas[i] = L.map(function (x, j) {
        var txt = String((x.actividades || [])[i] || '').trim();
        var r = redaccion(txt, nC);
        var ev = Number((x.evidencias || [])[i]) || 0;
        var adj = ((x.adjuntos || [])[i] || []).length;
        /* cuentas de antes del 05/10: UN anexo para toda la cuenta; vale como soporte de cada obligación */
        var general = x.anexoViejo && !ev && !adj ? 1 : 0;
        var es = ESTR.analizar(txt, ESTR.preparar(o.texto, previos, nC),
          { general: gen[i], desde: x.desde, hasta: x.hasta, soporte: ev + adj + general, nContrato: nC });
        var medible = PUNTOS_RED[r.clase] !== undefined;
        var rep = medible && previos.length && es.pct !== null ? es.pct : null;
        if (txt && txt !== '-') previos.push({ informe: x.informe, texto: txt });
        return { texto: txt, clase: r.clase, cifras: r.cifras, evid: ev, adj: adj, anexo: general, soporte: ev + adj + general, gen: gen[i],
                 menciona: MENCIONA.test(sinTildes(txt)), rep: rep, repCon: rep !== null ? es.con : null, ident: rep !== null && es.ident, largo: txt.length,
                 /* 02/11 · estructura y bombillos */
                 repetida: rep !== null && es.estado === 'repetida', plantillas: rep !== null ? es.plantillas : 0, frases: es.frases || 0,
                 orden: rep !== null && es.orden, cifraIgual: rep !== null ? es.cifraIgual.length : 0,
                 b: medible && !gen[i] ? es.b.map(function (q) { return q.e; }) : null,
                 bd: medible && !gen[i] ? es.b.map(function (q) { return q.d; }) : null };
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
        comparadas: col.filter(function (z) { return z.rep !== null && !z.gen; }).length,
        repetidas: col.filter(function (z) { return z.repetida && !z.gen; }).length,
        plantillas: col.filter(function (z) { return z.plantillas && !z.gen; }).length,
        bomb: BOMBILLOS.map(function (n, k) { return pctB(reales, k); }),
        soporte: reales.filter(function (z) { return z.soporte > 0; }).length,
        adjuntos: col.reduce(function (a, z) { return a + z.adj; }, 0),
        evidencias: col.reduce(function (a, z) { return a + z.evid; }, 0),
        mencionaSin: col.filter(function (z) { return z.menciona && !z.soporte && mide(z); }).length,
        diasRad: dRad, revision: pos(dias(x.radicada, x.revisada)), orden: pos(dias(x.revisada, x.fechaOrden)), pago: pos(dias(x.fechaOrden, x.fechaEgreso)),
        ciclo: pos(dias(x.radicada, x.fechaEgreso)), devoluciones: devs,
        sugerencias: Number(x.sugerencias) || 0,   /* 27/10 · recomendaciones para la próxima cuenta que recibió (no se califican) */
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
        comparadas: f.filter(function (z) { return z.rep !== null; }).length,
        repetidas: f.filter(function (z) { return z.repetida; }).length,
        plantillas: f.filter(function (z) { return z.plantillas; }).length,
        bomb: BOMBILLOS.map(function (n, k) { return pctB(reales, k); }),
        soporte: reales.filter(function (z) { return z.soporte > 0; }).length,
        nunca: !reales.length && !gen[i], general: gen[i]
      };
    });

    /* puntajes 0-100 */
    var todas = [];
    celdas.forEach(function (f) { f.forEach(function (z) { if (mide(z)) todas.push(z); }); });
    var pCuant = prom(todas.map(function (z) { return PUNTOS_RED[z.clase]; }));
    var reps = []; celdas.forEach(function (f) { f.forEach(function (z) { if (z.rep !== null && !z.gen) reps.push(z.rep); }); });
    var identicas = 0; celdas.forEach(function (f) { f.forEach(function (z) { if (z.ident && !z.gen && PUNTOS_RED[z.clase] !== undefined) identicas++; }); });
    /* 02/11 · la calificación sale de la ESTRUCTURA y de los bombillos (ya no del % de palabras) */
    var comparadas = 0, repetidas = 0, plantillas = 0, ordenIgual = 0, cifraIgual = 0;
    celdas.forEach(function (f) { f.forEach(function (z) {
      if (z.rep === null || z.gen) return;
      comparadas++; if (z.repetida) repetidas++; if (z.plantillas) plantillas++; if (z.orden) ordenIgual++; if (z.cifraIgual) cifraIgual++;
    }); });
    var bombG = BOMBILLOS.map(function (n, k) { return pctB(todas, k); });
    var pVar = comparadas ? (comparadas - repetidas) * 100 / comparadas : null;
    var redV = []; todas.forEach(function (z) { if (!z.b) return; for (var k = 1; k <= 4; k++) if (PUNTO_B[z.b[k]] !== undefined) redV.push(PUNTO_B[z.b[k]]); });
    var pRed = redV.length ? prom(redV) : null;
    /* 03/11 · soporte = bombillo 6: cargado o "no requiere adjunto" 100; dice dónde verificar o la obligación no pide producto 50 */
    var sopV = []; todas.forEach(function (z) { if (z.b && PUNTO_B[z.b[5]] !== undefined) sopV.push(PUNTO_B[z.b[5]]); });
    var pSop = sopV.length ? prom(sopV) : null;
    var pOport = prom(porCuenta.map(function (q) { if (q.diasRad === null) return null; return q.diasRad <= 5 ? 100 : (q.diasRad <= 15 ? 60 : 20); }));
    var comps = [
      { k: 'var', t: 'Variación', v: pVar, n: comparadas ? 'Actividades que no repiten la forma de una cuenta anterior' : 'Hace falta más de una cuenta' },
      { k: 'red', t: 'Redacción completa', v: pRed, n: 'Dice cuántos, para quién, qué resultado y cuándo' },
      { k: 'sop', t: 'Soporte', v: pSop, n: 'Evidencia cargada o dónde verificarla' },
      { k: 'oport', t: 'Oportunidad', v: pOport, n: 'Radicación tras el cierre del periodo' }
    ];
    var global = prom(comps.map(function (q) { return q.v; }));

    /* alertas de control */
    var alertas = [];
    var planillas = {};
    porCuenta.forEach(function (q, j) {
      var x = q.x;
      /* 27/10 · los REVISORES de Supervisión son contratistas autorizados y conciliados con el supervisor:
         que un revisor apruebe su propia cuenta NO es alerta (pedido de Oss) */
      if (x.saldo && x.cobro && x.nuevo !== undefined && x.nuevo !== '' && Math.abs((Number(x.saldo) - Number(x.cobro)) - Number(x.nuevo)) > 1)
        alertas.push({ tono: 'malo', cuenta: x.informe, t: 'El nuevo saldo (' + K.pesos(x.nuevo) + ') no es el saldo anterior menos el cobro (' + K.pesos(Number(x.saldo) - Number(x.cobro)) + ').' });
      if (x.planilla) {
        var kp = String(x.planilla).trim();
        if (planillas[kp]) alertas.push({ tono: 'aviso', cuenta: x.informe, t: 'La planilla ' + kp + ' ya se había presentado en la cuenta ' + planillas[kp] + '.' });
        else planillas[kp] = x.informe;
      }
      if (q.incoherente) alertas.push({ tono: 'info', cuenta: x.informe, t: 'Las fechas del trámite no siguen el orden radicación, revisión, orden y egreso (por ejemplo, un egreso anterior a la radicación). Suele pasar con cuentas registradas antes del aplicativo; esos tiempos no se calculan.' });
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
    var sugTot = porCuenta.reduce(function (a, q) { return a + q.sugerencias; }, 0);

    var A = {
      contrato: c, obl: obl, cuentas: L, celdas: celdas, porCuenta: porCuenta, porObl: porObl,
      comps: comps, global: global, alertas: alertas, cifras: k, plazo: plazo, devoluciones: devTot, sugerencias: sugTot,
      reales: todas.length,
      cuantTot: todas.filter(function (z) { return z.clase === 'cuant'; }).length,
      descTot: todas.filter(function (z) { return z.clase === 'desc'; }).length,
      noreqTot: porCuenta.reduce(function (a, q) { return a + q.noreq; }, 0),
      sinTot: porCuenta.reduce(function (a, q) { return a + q.sin; }, 0),
      copias: repetidas, identicas: identicas, reutiliza: 0, comparadas: comparadas,
      repetidas: repetidas, plantillas: plantillas, ordenIgual: ordenIgual, cifraIgual: cifraIgual, bomb: bombG,
      estrProm: reps.length ? Math.round(prom(reps)) : null,
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
      A.balance = balanceAvances(A, c.avances);
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

  /** 27/10 · El balance de lo logrado: series de cifras que se repiten entre
      cuentas (asignaciones, capacitaciones...) y menciones de cada herramienta
      (lista "herramientas" de la llave INFORME_AVANCES). Todo sale del texto radicado. */
  function balanceAvances(A, cfg) {
    var porUnidad = {};
    A.hitos.forEach(function (L, j) {
      L.forEach(function (h) {
        var m = /^([\d.,]+)\s+(.+)$/.exec(h);
        if (!m || m[2] === '%') return;
        var u = sinTildes(m[2].split(' ')[0]).toLowerCase(), v = K.aNumero ? K.aNumero(m[1]) : Number(m[1]);
        if (!v || u.length < 4) return;
        var s = porUnidad[u] || (porUnidad[u] = { unidad: m[2].split(' ')[0].toLowerCase(), valores: {} });
        s.valores[j] = Math.max(s.valores[j] || 0, v);
      });
    });
    var series = Object.keys(porUnidad).map(function (u) {
      var s = porUnidad[u], js = Object.keys(s.valores).map(Number).sort(function (a, b) { return a - b; });
      var vals = js.map(function (j) { return s.valores[j]; });
      var crece = vals.every(function (v, i) { return !i || v >= vals[i - 1]; });
      return { unidad: s.unidad, cuentas: js, valores: vals, acumulado: crece && vals[vals.length - 1] > vals[0],
               total: vals.reduce(function (a, b) { return a + b; }, 0), ultimo: vals[vals.length - 1], primero: vals[0] };
    }).filter(function (s) { return s.cuentas.length >= 3 && (!s.acumulado || s.ultimo >= s.primero * 1.5) && Math.max.apply(null, s.valores) !== Math.min.apply(null, s.valores); })
      .sort(function (a, b) { return b.cuentas.length - a.cuentas.length || b.total - a.total; }).slice(0, 3);
    var herr = ((cfg && cfg.herramientas) || []).map(function (h) {
      var re = new RegExp(String(h).split('|').map(function (x) { return sinTildes(x).replace(/[.*+?^${}()[\]\\]/g, '\\$&'); }).join('|'), 'i');
      var n = A.cuentas.filter(function (x) { return re.test(sinTildes((x.actividades || []).join(' '))); }).length;
      return { nombre: String(h).split('|')[0], cuentas: n };
    }).filter(function (h) { return h.cuentas; }).sort(function (a, b) { return b.cuentas - a.cuentas; });
    var frases = [];
    series.forEach(function (s) {
      var c0 = A.cuentas[s.cuentas[0]].informe, c1 = A.cuentas[s.cuentas[s.cuentas.length - 1]].informe;
      if (s.acumulado) frases.push('Las ' + s.unidad + ' reportadas pasaron de ' + K.numero(s.primero) + ' (cuenta ' + c0 + ') a ' + K.numero(s.ultimo) + ' (cuenta ' + c1 + '), un crecimiento de ' + K.numero(s.ultimo - s.primero) + '.');
      else frases.push('Se reportan ' + K.numero(s.total) + ' ' + s.unidad + ' en ' + s.cuentas.length + ' periodos (de la cuenta ' + c0 + ' a la ' + c1 + ').');
    });
    if (herr.length) frases.push('Las herramientas con presencia continua en el contrato son: ' + herr.slice(0, 5).map(function (h) { return h.nombre + ' (' + h.cuentas + (h.cuentas === 1 ? ' cuenta' : ' cuentas') + ')'; }).join(', ') + '.');
    return { series: series, herramientas: herr, frases: frases };
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
    /* 02/11 · los 6 bombillos y la estructura (no las palabras) */
    if (A.reales) {
      var bb = A.bomb, partes = [];
      [1, 2, 3, 4].forEach(function (k) { if (bb[k] !== null) partes.push(BOMBILLOS[k].toLowerCase() + ' ' + bb[k] + ' %'); });
      h.push('De ' + A.reales + ' actividades reportadas con contenido, así cumplen lo que debe decir una actividad: ' + partes.join(', ') +
        (bb[5] !== null ? '; con soporte cargado ' + bb[5] + ' %.' : '.'));
    }
    if (A.comparadas) h.push(A.repetidas ? A.repetidas + ' de ' + A.comparadas + ' actividades repiten la FORMA de escribir de una cuenta anterior' +
      (A.identicas ? ' (' + A.identicas + ' idénticas palabra por palabra)' : '') +
      (A.plantillas ? '; en ' + A.plantillas + (A.plantillas === 1 ? ' hay frases que son una plantilla rellenada' : ' hay frases que son plantillas rellenadas') + ': la misma frase con solo las cifras o las fechas cambiadas' : '') +
      '. Compartir los términos técnicos de la obligación no cuenta como repetir.' :
      'Ninguna actividad repite la forma de escribir de una cuenta anterior: la redacción se renueva cuenta a cuenta.');
    if (A.cifraIgual) h.push(A.cifraIgual + (A.cifraIgual === 1 ? ' actividad reporta' : ' actividades reportan') + ' la misma cantidad que en la cuenta anterior (solo se informa: es válido si es un hecho verídico y lo soportan las evidencias).');
    if (A.generales.length) h.push((A.generales.length === 1 ? 'La obligación ' : 'Las obligaciones ') + A.generales.map(function (o) { return o.n; }).join(', ') + (A.generales.length === 1 ? ' es general' : ' son generales') + ' (de conducta o de forma: horario, independencia, elementos de trabajo, entrega de la cuenta). No se les exige cuantificar y es normal que su texto se repita: no entran en los puntajes.');
    if (A.noreqTot) h.push(A.noreqTot + ' registros de obligación dicen que la actividad no fue requerida en el periodo.');
    if (A.nunca.length) h.push((A.nunca.length === 1 ? 'La obligación ' : 'Las obligaciones ') + A.nunca.map(function (o) { return o.n; }).join(', ') + (A.nunca.length === 1 ? ' no registra' : ' no registran') + ' ninguna actividad ejecutada en todo el contrato.');
    var rad = A.porCuenta.filter(function (q) { return q.diasRad !== null; });
    if (rad.length) h.push('Radica en promedio ' + Math.round(prom(rad.map(function (q) { return q.diasRad; }))) + ' día(s) después del cierre de cada periodo; ' + rad.filter(function (q) { return q.diasRad <= 5; }).length + ' de ' + rad.length + ' cuentas dentro de los 5 días.');
    h.push(A.devoluciones ? 'Tiene ' + A.devoluciones + (A.devoluciones === 1 ? ' devolución registrada.' : ' devoluciones registradas.') : 'No registra devoluciones de cuentas.');
    /* 27/10 · solo se informa, no se califica */
    if (A.sugerencias) {
      var conSug = A.porCuenta.filter(function (q) { return q.sugerencias; }).length;
      h.push('Recibió ' + A.sugerencias + (A.sugerencias === 1 ? ' recomendación' : ' recomendaciones') + ' de la supervisión para la próxima cuenta, en ' + conSug + (conSug === 1 ? ' cuenta.' : ' cuentas.'));
    }
    A.alertas.filter(function (a) { return a.tono === 'malo'; }).forEach(function (a) { h.push('ALERTA en la cuenta ' + a.cuenta + ': ' + a.t); });
    return h;
  }

  function recomendaciones(A) {
    var r = [], comp = {};
    A.comps.forEach(function (q) { comp[q.k] = q.v; });
    var bb = A.bomb || [];
    if (bb[1] !== null && bb[1] < 80) r.push('Pedir que cada actividad diga cuántos: la cifra junto a lo que se contó ("18 visitas técnicas", "12 respuestas"), no una cifra suelta ni el número de un anexo.');
    if (bb[2] !== null && bb[2] < 60) r.push('Pedir que cada actividad diga para quién o con quién se hizo (la dependencia, la comunidad, la entidad o la población atendida).');
    if (bb[3] !== null && bb[3] < 80) r.push('Pedir que cada actividad diga qué quedó como resultado o entregable verificable (informe, acta, oficio, listado, registro).');
    if (bb[4] !== null && bb[4] < 60) r.push('Pedir que cada actividad se ubique en el tiempo dentro del periodo (fechas, semanas o días), lo que facilita cruzarla con las evidencias.');
    if (A.repetidas) r.push('Pedir una redacción propia del periodo en las obligaciones que repiten la forma de una cuenta anterior' + (A.plantillas ? ' o que solo cambian las cifras y fechas de una plantilla' : '') + ': no basta con cambiar palabras, hay que contar qué se hizo distinto, con su cifra, su destinatario, su resultado y su fecha.');
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
      cols.push({ titulo: 'Recomendaciones recibidas para la próxima cuenta', campo: function (x) { var q = qc(x); return q ? q.sugerencias : ''; }, tipo: 'numero' });
      cols.push({ titulo: 'Motivos de devolución', campo: function (x) { var q = qc(x); return q ? q.devoluciones.map(function (v) { return K.fecha(v.fecha) + ' ' + v.estado + ' (' + nombre(v.quien) + '): ' + v.motivo; }).join('\n') : ''; } });
      /* 02/11 · por obligación: % de estructura repetida, plantilla rellenada y los 6 bombillos */
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: '% estructura repetida obligación ' + o.n, campo: function (x) { var z = celda(x, i); return z && z.rep !== null ? z.rep : ''; }, tipo: 'numero' });
      });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: 'Repetida obligación ' + o.n, campo: function (x) { var z = celda(x, i); return z && z.rep !== null ? (z.repetida ? (z.ident ? 'Idéntica' : z.plantillas && z.rep < 60 ? 'Plantilla rellenada' : z.orden && z.rep < 60 ? 'Mismo orden de frases' : 'Estructura igual') : 'No') : ''; } });
      });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: 'Plantillas rellenadas obligación ' + o.n, campo: function (x) { var z = celda(x, i); return z && z.rep !== null ? z.plantillas : ''; }, tipo: 'numero' });
      });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: 'Bombillos en verde obligación ' + o.n, campo: function (x) { var z = celda(x, i), v = verdesDe(z); return v ? v.v + ' de ' + v.n : ''; } });
      });
      (c.obligaciones || []).forEach(function (o, i) {
        cols.push({ titulo: 'Bombillos obligación ' + o.n, campo: function (x) {
          var z = celda(x, i);
          if (!z || !z.b) return '';
          return z.b.map(function (e, k) { return BOMBILLOS[k] + ': ' + (e === 'verde' ? 'sí' : e === 'amarillo' ? 'revisar' : e === 'gris' ? 'no aplica' : 'no'); }).join(' · ');
        } });
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

    /** Barras verticales con su valor encima (una serie por cuenta). */
    function barrasV(titulo, etiquetas, valores) {
      var alto = 38, max = Math.max.apply(null, valores) || 1;
      cabe(alto + 20);
      f('bold', 9, COL.tinta); doc.text(titulo, mx, y); y += 4;
      var x0 = mx + 4, ancho = util - 8, base = y + alto, paso = ancho / valores.length, bw = Math.min(14, paso * 0.6);
      draw(COL.linea, 0.25); doc.line(x0, base, x0 + ancho, base);
      valores.forEach(function (v, i) {
        var h = Math.max(0.8, (alto - 6) * v / max), cx = x0 + paso * i + paso / 2;
        fill(i === valores.length - 1 ? COL.ok : COL.verde2); doc.roundedRect(cx - bw / 2, base - h, bw, h, 1, 1, 'F');
        f('bold', 7.2, COL.tinta); doc.text(K.numero(v), cx, base - h - 1.4, { align: 'center' });
        f('normal', 7, COL.gris); doc.text(String(etiquetas[i]), cx, base + 4, { align: 'center' });
      });
      y = base + 10;
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
      /* ───────────── 2. CALIDAD DE LA REDACCIÓN: LOS 6 BOMBILLOS ───────────── */
      seccion('Calidad de la redacción: los 6 bombillos', 'Cada actividad se revisa con seis preguntas: ¿qué hizo distinto a la cuenta anterior?, ¿cuántos? (una cifra junto a lo que se contó), ¿para quién o con quién?, ¿qué quedó como resultado o entregable?, ¿cuándo? (dentro del periodo) y ¿tiene soporte? La celda dice cuántas se cumplen.');
      matriz(function (z) {
        var v = verdesDe(z);
        if (!v) return { t: CORTO_RED[z.clase] === 'C' || CORTO_RED[z.clase] === 'P' || CORTO_RED[z.clase] === 'D' ? '—' : CORTO_RED[z.clase], col: COL.gris2, fondo: FONDO_RED.noreq };
        var r = v.n ? v.v / v.n : 0;
        return { t: v.v + '/' + v.n, e: 'bold', fondo: r >= 0.8 ? FONDO_RED.cuant : (r >= 0.5 ? FONDO_RED.parcial : FONDO_RED.desc), col: r < 0.5 ? COL.malo : COL.tinta };
      }, 'n/m = bombillos en verde de los que aplican (en la primera cuenta no se compara, por eso suelen ser 5) · verde = 80 % o más · ámbar = la mitad o más · rojo = menos de la mitad · NR = no requerida · — = sin actividad · filas en gris: obligaciones generales, no se miden.');
      tabla([
        { t: 'Cuenta', w: 14, al: 'c', e: 'bold' }, { t: 'Distinto', w: 23, al: 'c' }, { t: 'Cuántos', w: 23, al: 'c' }, { t: 'Para quién', w: 23, al: 'c' },
        { t: 'Resultado', w: 23, al: 'c' }, { t: 'Cuándo', w: 23, al: 'c' }, { t: 'Soporte', w: 0, al: 'c' }
      ], A.porCuenta.map(function (q) {
        return [q.informe].concat(q.bomb.map(function (v) {
          return v === null ? { t: '—', col: COL.gris2 } : { t: v + ' %', e: 'bold', col: v >= 80 ? COL.ok : (v >= 50 ? COL.tinta : COL.malo) };
        }));
      }));
      parrafo('Porcentaje de actividades de cada cuenta con el bombillo en verde (una fecha fuera del periodo cuenta la mitad).', { t: 7.2, col: COL.gris, despues: 3 });

      /* ───────────── 3. ESTRUCTURA REPETIDA ───────────── */
      seccion('Estructura repetida entre cuentas', 'Se mide la FORMA de escribir, no el vocabulario: los términos de la obligación, los que el contratista usa en varias cuentas, los de gestión y las dependencias nunca cuentan como repetidos; las cifras, fechas, códigos y nombres se igualan. Una actividad se marca repetida si su esqueleto es 60 % o más igual al de una cuenta anterior, si es idéntica, si la mitad o más de sus frases son una plantilla rellenada (la misma frase con solo cifras o fechas cambiadas) o si repite el mismo orden de frases.');
      if (A.cuentas.length < 2) parrafo('Hace falta al menos una segunda cuenta para comparar la redacción.', { t: 8.5, col: COL.gris });
      else matriz(function (z, j) {
        if (j === 0) return { t: 'base', col: COL.gris2 };
        if (z.rep === null) return { t: CORTO_RED[z.clase] === 'C' || CORTO_RED[z.clase] === 'P' || CORTO_RED[z.clase] === 'D' ? '—' : CORTO_RED[z.clase], col: COL.gris2 };
        var marca = z.ident ? ' =' : (z.repetida && z.rep < 60 ? (z.plantillas ? ' P' : (z.orden ? ' O' : '')) : '');
        return { t: z.rep + '%' + marca, e: 'bold', fondo: z.repetida ? FONDO_RED.desc : FONDO_RED.cuant, col: z.repetida ? COL.malo : COL.tinta };
      }, '% = parte del esqueleto que ya estaba en una cuenta anterior · en rojo = repetida · = idéntica · P = plantilla rellenada · O = mismo orden de frases · en verde = la forma de escribir cambió.');

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

      /* 27/10 · cuántas recomendaciones para la próxima cuenta recibió en cada una (solo se informa: no entra en ningún puntaje) */
      seccion('Recomendaciones recibidas para la próxima cuenta', 'Las que la supervisión le envió al aprobar cada cuenta. Solo se informan: no entran en la calificación.');
      if (!A.sugerencias) parrafo('No recibió recomendaciones de la supervisión en las cuentas de este contrato.', { t: 8.5, col: COL.gris });
      else tabla([{ t: 'Cuenta', w: 22, al: 'c', e: 'bold' }, { t: 'Recomendaciones recibidas', w: 0, al: 'c' }],
        A.porCuenta.map(function (q) { return [q.informe, q.sugerencias || '—']; }));
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
      seccion('Avances logrados con el desarrollo del ecosistema', 'Balance de lo que este contrato ha dejado en funcionamiento, con las cifras que reporta en sus actividades periodo a periodo.');
      var B = A.balance || { series: [], herramientas: [], frases: [] };
      var nH = A.hitos.reduce(function (a, L) { return a + L.length; }, 0), ultH = A.hitos[A.hitos.length - 1] || [];
      subt('Balance');
      parrafo('A lo largo de ' + A.cuentas.length + (A.cuentas.length === 1 ? ' periodo' : ' periodos') + ' el contrato registra ' + nH + ' cifras de gestión en sus actividades, con avance continuo en sus obligaciones de desarrollo y soporte.', { t: 8.8, lh: 4.3, despues: 1.6 });
      B.frases.forEach(function (t) { parrafo(t, { t: 8.6, vineta: true, vcol: COL.ok, despues: 1.4 }); });
      if (ultH.length) parrafo('En la cuenta más reciente: ' + ultH.join(' · ') + '.', { t: 8.6, vineta: true, vcol: COL.ok, despues: 3 });
      /* gráficas: cada serie de cifras por cuenta */
      B.series.forEach(function (s) {
        barrasV((s.acumulado ? 'Evolución de ' : '') + s.unidad.charAt(0).toUpperCase() + s.unidad.slice(1) + ' por cuenta',
          s.cuentas.map(function (j) { return 'C' + A.cuentas[j].informe; }), s.valores);
      });
      if (B.herramientas.length) {
        subt('Herramientas desarrolladas: cuentas en las que se reportan');
        B.herramientas.forEach(function (h) {
          cabe(8);
          f('bold', 8, COL.tinta); doc.text(h.nombre, mx, y);
          f('bold', 8, COL.ok); doc.text(h.cuentas + ' de ' + A.cuentas.length, W - mx, y, { align: 'right' });
          barraH(mx + 62, y - 2.4, util - 62 - 22, h.cuentas * 100 / A.cuentas.length, COL.verde2);
          y += 6.4;
        });
        y += 3;
      }
      subt('Cifras de gestión por periodo');
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
          var vv = verdesDe(z);
          var et = (z.gen ? 'Obligación general (no se mide)' : (vv ? vv.v + ' de ' + vv.n + ' bombillos' : ETIQUETA_RED[z.clase]) +
              (z.rep !== null ? (z.ident ? ' · idéntica a la cuenta ' + z.repCon : (z.repetida ? ' · estructura repetida ' + z.rep + ' % (cuenta ' + z.repCon + ')' + (z.plantillas && z.rep < 60 ? ', plantilla rellenada' : '') : ' · estructura nueva')) : '')) +
            (z.anexo ? ' · anexo general de la cuenta' : (z.soporte ? ' · ' + z.soporte + ' soporte(s)' : ''));
          f('bold', 6.8, !z.gen && (z.repetida || (vv && vv.n && vv.v / vv.n < 0.5)) ? COL.malo : COL.gris);
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
      'Variación: % de las actividades comparables que NO repiten la forma de escribir de una cuenta anterior de la misma obligación. Se mide la estructura (conectores, verbos con su forma, orden y puntuación), no el vocabulario: los términos de la obligación, los sustantivos que el contratista usa en 2 o más cuentas, los términos de gestión y las dependencias se igualan a una misma marca, igual que las cifras, fechas, códigos y nombres. Repetida: esqueleto 60 % o más igual (frases de 4 marcas), idéntica, plantilla rellenada en la mitad o más de sus frases, o el mismo orden de frases.',
      'Redacción completa: promedio de cuatro bombillos por actividad: cuántos (una cifra a 3 palabras o menos de lo que se contó; no valen fechas, el número del contrato ni la numeración de anexos), para quién o con quién (una dependencia, comunidad, entidad, población o nombre propio), resultado o entregable (un verbo como se entregó, se elaboró, se radicó, o un entregable como informe, acta, oficio, listado) y cuándo (fechas, meses, semanas o días; una fecha fuera del periodo vale la mitad). Verde 100, rojo 0.',
      'La misma cifra que en la cuenta anterior se informa, pero no se castiga: es válida si es un hecho verídico y la soportan las evidencias.',
      'Soporte (bombillo 6): 100 si la obligación tiene evidencia o adjunto cargado, o si la actividad dice que no requiere adjunto; 50 si no cargó nada pero dice dónde lo puede verificar el supervisor (carpeta física, expediente, SECOP, enlace…) o si la obligación, por su redacción, no pide un producto; 0 si pide un producto y no hay soporte, o si dice que adjunta algo que no está cargado.',
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
    _redaccion: redaccion, _repetido: repetido, _cifrasGestion: cifrasGestion,
    /* 30/10 · kit/variacion.js marca y mide con estas mismas (una sola regla en todo el ecosistema) */
    _palabras: palabras, _tejas: tejas, _esGeneral: esGeneral,
    /* 02/11 · el motor de estructura y bombillos (uno solo para borrador, revisión, PDF y Excel) */
    _estr: ESTR, _bombillos: BOMBILLOS
  };
}());
