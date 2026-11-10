/* ============================================================
   KIT-FLANDES · PIEZA 38 · «REDACTEMOS UNA ACTIVIDAD JUNTOS» (10/11/2026)
   Por qué
     La versión sugerida de «Te ayudo» acostumbraba al contratista a pegar
     lo que la app le entregaba. Ahora la app NO le da un texto para
     copiar: le PREGUNTA, con voz o texto, lo que solo él sabe, y con SUS
     respuestas se redacta el párrafo.
   Qué hace
     Botón «Redactemos una actividad juntos, {nombre}» (robot). Abre un
     diálogo guiado por la obligación:
       0. ¿La realizaste en el periodo?  No → por qué no (y termina).
       1. Cuántos (las cosas que se cuentan en ESA obligación).
       2. Para quién o con quién.
       3. Cuándo, dentro del periodo de la cuenta.
       4. ¿Tienes evidencia? Sí, la subo / La subo después / No requiere.
       5. Detalles libres: «enséñame un poco de tu trabajo».
     No avanza con respuestas que no entiende. Lo interpreta TODO en el
     teléfono, al instante (cifras en número o en palabras, fechas contra
     el periodo real); Gemini solo arma el guion de la obligación (una vez,
     se guarda) y redacta el párrafo final. Si Google no responde, el
     párrafo lo arma el redactor local: nunca se queda sin entregar.
   Lo que nunca hace
     · Inventar: toda cifra, mes o nombre del párrafo debe salir de sus
       respuestas o de la obligación; si Gemini agrega algo, se descarta
       su versión y se usa la local.
     · Repetir la cuenta anterior: el párrafo se mide con el bombillo
       «qué distinto»; si sale en rojo, se vuelve a redactar una vez.
     · Guardar solo: el párrafo va al campo, debajo de lo que ya había,
       con una línea en blanco; él lo edita y guarda como siempre.
   Medición y aprendizaje (sin viajes extra)
     Eventos a la cola de «Te ayudo» (ruta teAyudoRegistrar): abrir, cada
     paso (ms, voz/texto/botón, intentos), lo que no entendió (sin cifras
     ni nombres) y el cierre. En ADMIN se revisa lo aprendido por tema.
   Cómo se usa (borrador)
     var r = K.piezas.redactemos.crear({
       app, n, informe, obligacion, area, nombre,
       contexto: function () { return Promise<{periodo, anteriores:[texto], medir(fn), extra}> },
       soporte: function () { return nº de evidencias cargadas },
       alTerminar: function ({texto, evid, realizada}) {}
     });
     caja.appendChild(r.nodo);
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;
  K.piezas = K.piezas || {};

  /* ══════════════ utilidades de texto ══════════════ */
  function st(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function limpio(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function capital(s) { s = limpio(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function conPunto(s) { s = limpio(s).replace(/[,;:\s]+$/, ''); return s && !/[.!?…]$/.test(s) ? s + '.' : s; }
  function titulo(n) { return String(n || '').toLowerCase().replace(/(^|\s)([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function lista(a, y) {
    a = a.filter(Boolean);
    if (a.length < 2) return a[0] || '';
    return a.slice(0, -1).join(', ') + ' ' + (y || 'y') + ' ' + a[a.length - 1];
  }
  function al(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ══════════════ números en palabras → cifras ══════════════ */
  var NUM = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
    veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
    cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
    cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900, mil: 1000
  };
  /** «dos aplicaciones y treinta y dos soportes» → «2 aplicaciones y 32 soportes». «un»/«una» solo cuentan si piden. */
  function enCifras(texto, conUn) {
    var partes = String(texto || '').split(/([A-Za-zÁÉÍÓÚÑÜáéíóúñü]+)/), out = [], i = 0;
    while (i < partes.length) {
      var w = st(partes[i]);
      if (NUM.hasOwnProperty(w) && (conUn || !/^(un|una|uno)$/.test(w))) {
        var total = 0, actual = 0, j = i, ultimo = i;
        while (j < partes.length) {
          var x = st(partes[j]);
          if (j % 2 === 1 && NUM.hasOwnProperty(x) && (conUn || !/^(un|una|uno)$/.test(x) || j > i)) {
            if (x === 'mil') { total += (actual || 1) * 1000; actual = 0; }
            else actual += NUM[x];
            ultimo = j; j++;
            continue;
          }
          if (j % 2 === 0 && /^\s+$/.test(partes[j])) { j++; continue; }
          if (j % 2 === 1 && x === 'y' && j + 2 < partes.length && NUM.hasOwnProperty(st(partes[j + 2])) && NUM[st(partes[j + 2])] < 10) { j++; continue; }
          break;
        }
        out.push(String(total + actual));
        i = ultimo + 1;
        continue;
      }
      out.push(partes[i]);
      i++;
    }
    return out.join('');
  }

  /* ══════════════ meses y periodo ══════════════ */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES_RE = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|set|oct|nov|dic)\\.?';
  function mesN(w) {
    w = st(w).replace(/\./g, '');
    if (w === 'setiembre' || w === 'set') return 9;
    for (var i = 0; i < 12; i++) if (MESES[i] === w || MESES[i].slice(0, 3) === w || (w === 'sept' && i === 8)) return i + 1;
    return 0;
  }
  function iso(a, m, d) { return a + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
  function existe(a, m, d) { var x = new Date(Date.UTC(a, m - 1, d)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  function fechaCorta(s) {
    if (!s) return '';
    var p = s.split('-');
    return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1];
  }
  /** Meses (con su año) que toca el periodo: [{a, m}] */
  function mesesDe(per) {
    if (!per || !per.desde || !per.hasta) return [];
    var a = Number(per.desde.slice(0, 4)), m = Number(per.desde.slice(5, 7)), out = [];
    var fa = Number(per.hasta.slice(0, 4)), fm = Number(per.hasta.slice(5, 7));
    for (var g = 0; g < 14; g++) {
      out.push({ a: a, m: m });
      if (a === fa && m === fm) break;
      m++; if (m > 12) { m = 1; a++; }
    }
    return out;
  }
  function anioPara(m, per) {
    var ms = mesesDe(per);
    for (var i = 0; i < ms.length; i++) if (ms[i].m === m) return ms[i].a;
    if (per && per.desde) return Number(per.desde.slice(0, 4));
    return new Date().getFullYear();
  }
  function dentro(f, per) { return !per || !per.desde || !per.hasta || (f >= per.desde && f <= per.hasta); }
  function periodoTexto(per) {
    if (!per || !per.desde || !per.hasta) return '';
    var d = per.desde.split('-'), h = per.hasta.split('-');
    if (d[1] === h[1]) return 'del ' + Number(d[2]) + ' al ' + Number(h[2]) + ' de ' + MESES[Number(h[1]) - 1];
    return 'del ' + fechaCorta(per.desde) + ' al ' + fechaCorta(per.hasta);
  }

  /* ══════════════ 1 · CUÁNTOS ══════════════ */
  var VAGOS = /\b(un par|varios|varias|algunos|algunas|muchos|muchas|pocos|pocas|bastantes|diversos|diversas|unos cuantos|unas cuantas|vari[oa]s?)\b/;
  var NO_UNIDAD = /^(y|e|o|de|del|el|la|los|las|en|para|con|por|a|al|que|mas|veces|vez|dias|dia|semanas|semana|meses|mes|horas|hora|ano|anos)$/;
  function raiz(w) { w = st(w).replace(/[^a-zñ]/g, ''); return w.slice(0, Math.max(4, Math.min(6, w.length - 2))); }
  function igualCosa(w, c) {
    var r = raiz(w);
    if (r.length < 3) return false;
    return [c.plural, c.singular].some(function (x) {
      var p = st(x).split(/\s+/)[0];
      return p.indexOf(r) === 0 || r.indexOf(raiz(p)) === 0;
    });
  }
  /**
   * cantidades(texto, cosas) -> {ok, items:[{n, u}], aclarar}
   * cosas = [{plural, singular}] del guion de la obligación.
   */
  function cantidades(texto, cosas) {
    cosas = cosas || [];
    var orig = limpio(texto);
    if (!orig) return { ok: false, aclarar: 'vacio' };
    var t = enCifras(orig.toLowerCase(), true);
    var items = [], sinQue = [], re = /(\d{1,6})(?:[.,]\d+)?/g, m;
    while ((m = re.exec(t))) {
      var n = Number(m[1]), resto = t.slice(re.lastIndex), antes = t.slice(Math.max(0, m.index - 14), m.index);
      /* fechas y años no son cantidades */
      if (new RegExp('^\\s*(de\\s+)?' + MES_RE + '\\b', 'i').test(resto) || /\/\d/.test(resto.slice(0, 2)) || /\d\/\s*$/.test(antes)) continue;
      if (n >= 1900 && n <= 2100) continue;
      if (/(el|del|al|dia|dias)\s*$/.test(st(antes))) continue;
      var pal = (/^\s+(?:de\s+(?:las?\s+|los\s+)?)?([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+){0,2})/.exec(resto) || [])[1] || '';
      var w = pal.split(/\s+/)[0] || '';
      if (!w || NO_UNIDAD.test(st(w))) { sinQue.push(n); continue; }
      var cosa = null;
      cosas.some(function (c) { if (igualCosa(w, c)) { cosa = c; return true; } return false; });
      /* 10/11 · prueba en vivo: con la palabra del guion salía «realicé 2 aplicaciones creadas»; se usan SUS palabras */
      var u = w;
      /* «2 aplicaciones nuevas», «3 informes técnicos»: el adjetivo que sigue se conserva si él lo dijo */
      var sig = pal.split(/\s+/)[1];
      if (sig && /(ico|ica|icos|icas|al|ales|ivo|iva|ivos|ivas|ado|ada|ados|adas|nuevo|nueva|nuevos|nuevas)$/.test(st(sig))) u += ' ' + sig;
      items.push({ n: n, u: u });
    }
    if (!items.length && sinQue.length) {
      if (cosas.length === 1) {
        sinQue.forEach(function (n) { items.push({ n: n, u: n === 1 ? cosas[0].singular : cosas[0].plural }); });
      } else return { ok: false, aclarar: 'que', n: sinQue[0] };
    }
    if (!items.length) return { ok: false, aclarar: VAGOS.test(st(orig)) ? 'vago' : 'numero' };
    if (!items.some(function (x) { return x.n > 0; })) return { ok: false, aclarar: 'cero' };
    return { ok: true, items: items.filter(function (x) { return x.n > 0; }) };
  }
  function textoCantidades(items) { return lista(items.map(function (x) { return x.n + ' ' + x.u; })); }

  /* ══════════════ 2 · PARA QUIÉN / CON QUIÉN ══════════════ */
  var NADA = /^(si|no|nada|nadie|ninguno|ninguna|no se|no recuerdo|ok|listo|ya|normal|todo|todos|igual|n\/a|na)$/;
  function quien(texto) {
    var t = limpio(texto).replace(/[.!?]+$/, '');
    var s = st(t);
    if (!t || NADA.test(s) || s.replace(/[^a-zñ]/g, '').length < 4) return { ok: false, aclarar: 'quien' };
    if (/^[\d\s.,/-]+$/.test(s)) return { ok: false, aclarar: 'quien' };
    var palabras = s.split(/\s+/).filter(function (w) { return /[a-zñ]{2,}/.test(w); });
    if (palabras.length < 2 && !/^[A-ZÁÉÍÓÚÑ]/.test(t)) return { ok: false, aclarar: 'quien' };
    /* la primera letra baja solo si es una palabra común («La secretaría» → «la secretaría»; «Hacienda» se queda) */
    var t2 = /^(la|el|los|las|un|una|unos|unas|mi|mis|su|sus|nuestro|nuestra|para|con|a|al|junto|en|de|ante|hacia|desde|por|todos|todas|toda|todo)\b/.test(s) || !/^[A-ZÁÉÍÓÚÑ]/.test(t) || /^[A-ZÁÉÍÓÚÑ ]+$/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
    var frase = /^(para|con|a|al|junto|en|de|ante|hacia|desde|por)\b/.test(s) ? t2 : 'para ' + t2;
    return { ok: true, frase: frase };
  }

  /* ══════════════ 3 · CUÁNDO ══════════════ */
  var ORD = { primera: 1, primer: 1, '1a': 1, '1ra': 1, segunda: 2, '2a': 2, '2da': 2, tercera: 3, '3a': 3, '3ra': 3, cuarta: 4, '4a': 4, '4ta': 4, quinta: 5, '5a': 5, ultima: 9 };
  var ORD_TX = { 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta', 9: 'última' };
  /**
   * cuando(texto, periodo) -> {ok, frase, fechas:[iso], fuera:[iso], aclarar}
   */
  function cuando(texto, per) {
    var orig = limpio(texto);
    if (!orig) return { ok: false, aclarar: 'cuando' };
    var t = st(enCifras(orig, false)).replace(/\b(\d{1,2})(?:ro|ero|o)\b/g, '$1');
    var frases = [], fechas = [], fuera = [], sinMes = [];
    var meses = mesesDe(per);
    function poner(d, m) {
      var a = anioPara(m, per);
      if (!existe(a, m, d)) return null;
      var f = iso(a, m, d);
      fechas.push(f);
      if (!dentro(f, per)) fuera.push(f);
      return f;
    }
    var usado = t;
    /* a · del 3 al 7 de octubre · entre el 28 de septiembre y el 3 de octubre */
    usado = usado.replace(new RegExp('(?:del|desde el|entre el|entre)\\s+(\\d{1,2})(?:\\s+de\\s+' + MES_RE + ')?\\s+(?:al|y el|hasta el|a)\\s+(\\d{1,2})\\s+(?:de\\s+)?' + MES_RE, 'g'), function (x, d1, m1, d2, m2) {
      var M2 = mesN(m2), M1 = m1 ? mesN(m1) : M2;
      var f1 = poner(Number(d1), M1), f2 = poner(Number(d2), M2);
      if (f1 && f2) frases.push(M1 === M2 ? 'entre el ' + Number(d1) + ' y el ' + Number(d2) + ' de ' + MESES[M2 - 1] : 'entre el ' + fechaCorta(f1) + ' y el ' + fechaCorta(f2));
      return ' ';
    });
    /* b · 3, 7 y 15 de octubre · 15 de octubre · 15 oct */
    usado = usado.replace(new RegExp('((?:\\d{1,2}\\s*(?:,|y|e)\\s*)*\\d{1,2})\\s+(?:de\\s+)?' + MES_RE + '(?:\\s+(?:de\\s+)?(?:del?\\s+)?20\\d\\d)?', 'g'), function (x, dias, mes) {
      var M = mesN(mes), ds = dias.match(/\d{1,2}/g).map(Number), ok = [];
      ds.forEach(function (d) { if (poner(d, M)) ok.push(d); });
      if (ok.length === 1) frases.push('el ' + ok[0] + ' de ' + MESES[M - 1]);
      else if (ok.length > 1) frases.push('los días ' + lista(ok.map(String)) + ' de ' + MESES[M - 1]);
      return ' ';
    });
    /* c · 15/10 · 15/10/2026 */
    usado = usado.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, function (x, d, m) {
      var f = poner(Number(d), Number(m));
      if (f) frases.push('el ' + fechaCorta(f));
      return ' ';
    });
    /* d · semanas del periodo */
    var sem = [];
    usado = usado.replace(/\b(?:la\s+|las\s+)?((?:(?:primera|primer|segunda|tercera|cuarta|quinta|ultima|\d(?:a|ra|da|ta))\s*(?:,|y|e)?\s*)+)\s*semanas?\b/g, function (x, ords) {
      (ords.match(/primera|primer|segunda|tercera|cuarta|quinta|ultima|\d(?:a|ra|da|ta)/g) || []).forEach(function (o) { var n = ORD[o]; if (n && sem.indexOf(n) < 0) sem.push(n); });
      return ' ';
    });
    if (sem.length) {
      sem.sort(function (a, b) { return a - b; });
      frases.push('durante ' + (sem.length === 1 ? 'la ' + ORD_TX[sem[0]] + ' semana' : lista(sem.map(function (n) { return 'la ' + ORD_TX[n]; })) + ' semana') + ' del periodo');
    }
    /* e · días sueltos sin mes: «el 15», «los días 3 y 7» */
    usado.replace(/\b(?:el|los dias|los|dia|dias)\s+((?:\d{1,2}\s*(?:,|y|e)\s*)*\d{1,2})\b/g, function (x, dias) {
      dias.match(/\d{1,2}/g).forEach(function (d) { sinMes.push(Number(d)); });
      return ' ';
    });
    if (sinMes.length) {
      var candidatos = meses.filter(function (mm) {
        return sinMes.every(function (d) { return existe(mm.a, mm.m, d) && dentro(iso(mm.a, mm.m, d), per); });
      });
      if (candidatos.length === 1) {
        var M = candidatos[0].m, ok = [];
        sinMes.forEach(function (d) { if (poner(d, M)) ok.push(d); });
        frases.push(ok.length === 1 ? 'el ' + ok[0] + ' de ' + MESES[M - 1] : 'los días ' + lista(ok.map(String)) + ' de ' + MESES[M - 1]);
      } else if (!frases.length) return { ok: false, aclarar: candidatos.length ? 'mes' : (meses.length ? 'fuera' : 'mes') };
    }
    /* f · todo el periodo, a diario, cada semana, de lunes a viernes */
    if (!frases.length) {
      var s = t;
      if (/de lunes a viernes/.test(s)) frases.push('de lunes a viernes durante el periodo');
      else if (/(todos los dias|a diario|diariamente|cada dia)/.test(s)) frases.push('a diario durante el periodo');
      else if (/(cada semana|semanalmente|todas las semanas)/.test(s)) frases.push('cada semana del periodo');
      else if (/(todo el (periodo|mes)|durante (el|todo el) (periodo|mes)|en el transcurso del (periodo|mes)|permanente|constante|continu)/.test(s)) frases.push('durante todo el periodo');
      else {
        var dia = /\b(?:los|cada|todos los)\s+(lunes|martes|miercoles|jueves|viernes|sabados|domingos)\b/.exec(s);
        if (dia) frases.push('los ' + ({ miercoles: 'miércoles', sabados: 'sábados' }[dia[1]] || dia[1]) + ' del periodo');
      }
    }
    if (!frases.length) return { ok: false, aclarar: /\b(hoy|ayer|antier|anteayer|esta semana|la semana pasada|el mes pasado)\b/.test(t) ? 'relativo' : 'cuando' };
    return { ok: !fuera.length, frase: lista(frases), fechas: fechas, fuera: fuera, aclarar: fuera.length ? 'fuera' : '' };
  }

  /* ══════════════ 4 · EVIDENCIA · 5 · DETALLE · NO REALIZADA ══════════════ */
  function evidenciaQue(texto) {
    var t = limpio(texto).replace(/[.!?]+$/, '');
    if (!t || NADA.test(st(t)) || st(t).replace(/[^a-zñ]/g, '').length < 4) return { ok: false };
    return { ok: true, que: t.charAt(0).toLowerCase() + t.slice(1) };
  }
  function palabras(t) { return (st(t).match(/[a-zñ]{2,}/g) || []); }
  function detalle(texto) {
    var t = limpio(texto);
    if (palabras(t).length < 6 || t.length < 25) return { ok: false, aclarar: 'detalle' };
    return { ok: true, texto: t };
  }
  function motivo(texto) {
    var t = limpio(texto).replace(/[.!?]+$/, '');
    if (palabras(t).length < 4) return { ok: false };
    t = t.replace(/^(porque|por que|debido a que|ya que|pues|es que|fue porque|no se hizo porque|no lo hice porque|no la hice porque)\s+/i, '');
    return { ok: true, texto: t.charAt(0).toLowerCase() + t.slice(1) };
  }
  var NO_EJEC = 'Durante el periodo no se ejecutaron actividades en esta obligación debido a que ';
  function parrafoNo(mot) { return conPunto(NO_EJEC + mot); }

  /* ══════════════ el redactor local (respaldo y cuando Gemini no está) ══════════════ */
  var ABRE = ['En cumplimiento de esta obligación, adelanté', 'Como parte de esta obligación, llevé a cabo', 'Para esta obligación ejecuté', 'En el periodo de esta cuenta realicé'];
  function local(A, anteriores) {
    var inicios = (anteriores || []).map(function (x) { return st(x).slice(0, 25); });
    var abre = ABRE.filter(function (a) { return inicios.indexOf(st(a).slice(0, 25)) < 0; });
    var p1 = al(abre.length ? abre : ABRE) + ' ' + textoCantidades(A.cantidades) + ' ' + A.quien + ', ' + A.cuando + '.';
    var out = [p1];
    if (A.detalle) out.push(conPunto(capital(A.detalle)));
    if (A.evid === 'noreq') out.push('No requiere adjunto.');
    else if (A.evidQue) out.push(al(['Como evidencia quedó ', 'Como soporte de lo anterior queda ', 'La evidencia de esta actividad es ']) + A.evidQue + '.');
    return out.join(' ').replace(/\s{2,}/g, ' ');
  }

  /* ══════════════ la guarda: nada que él no haya dicho ══════════════ */
  function revisar(texto, fuentes, A) {
    var t = limpio(texto), F = st(fuentes);
    if (!t || t.length < 50 || t.length > 1600) return 'largo';
    if (/[\[\]⟦⟧]/.test(t)) return 'corchetes';
    var nums = {}; (F.match(/\d+/g) || []).forEach(function (n) { nums[String(Number(n))] = 1; });
    var malo = (t.match(/\d+/g) || []).filter(function (n) { return !nums[String(Number(n))]; });
    if (malo.length) return 'cifra:' + malo[0];
    var faltan = (A.cantidades || []).filter(function (c) { return !new RegExp('(^|\\D)' + c.n + '(\\D|$)').test(t); });
    if (faltan.length) return 'sinCantidad';
    var mesMalo = (st(t).match(new RegExp('\\b' + '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)' + '\\b', 'g')) || [])
      .filter(function (m) { return F.indexOf(m) < 0; });
    if (mesMalo.length) return 'mes:' + mesMalo[0];
    var nombre = null;
    t.replace(/([^.!?:\s]\s+)([A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,})/g, function (m, a, w) { if (!nombre && F.indexOf(st(w)) < 0) nombre = w; return m; });
    if (nombre) return 'nombre:' + nombre;
    return '';
  }

  /* ══════════════ el diálogo ══════════════ */
  var PASOS = ['realizada', 'cuantos', 'quien', 'cuando', 'evidencia', 'detalle'];
  var PASO_TX = ['Periodo', 'Cuántos', 'Quién', 'Cuándo', 'Evidencia', 'Detalles'];

  function nombreCorto(n) {
    var p = String(n || '').trim().split(/\s+/).filter(Boolean);
    return titulo(p.length > 1 ? p[0] + ' ' + p[1] : (p[0] || ''));
  }

  function crear(o) {
    var nom = nombreCorto(o.nombre);
    var nodo = K.nodo('<div class="rd"><button type="button" class="kit-btn rd__btn">' + K.icono('robot', 20) +
      '<span class="rd__btx"></span></button></div>');
    var btn = nodo.querySelector('.rd__btn'), btx = nodo.querySelector('.rd__btx');
    function rotulo() {
      var otra = !!String(o.area.value || '').trim();
      btx.textContent = 'Redactemos ' + (otra ? 'otra' : 'una') + ' actividad juntos' + (nom ? ', ' + nom : '');
    }
    rotulo();
    o.area.addEventListener('input', rotulo);
    /* 10/11 · App Check tarda ~3,5 s la primera vez: se pide de fondo al aparecer el botón (no gasta cupo de Gemini) */
    var G0 = K.piezas.gemini;
    if (G0 && G0.precalentar && G0.disponible && G0.disponible()) setTimeout(function () { if (nodo.isConnected) G0.precalentar(); }, 1500);
    btn.addEventListener('click', function () { abrir(o, rotulo); });
    return { nodo: nodo, actualizar: rotulo };
  }

  function registrar(e) {
    try { if (K.piezas.teayudo && K.piezas.teayudo.registrar) K.piezas.teayudo.registrar(e); } catch (x) {}
  }
  /** Lo que se guarda para aprender: sin cifras, sin correos, sin el nombre de la persona. */
  function anonimo(t) {
    var G = K.piezas.gemini, x = String(t || '').slice(0, 160);
    try { if (G && G._limpiar) x = G._limpiar(x); } catch (e) {}
    return x.replace(/\d+/g, '#');
  }

  function abrir(o, alCerrar) {
    var T = K.piezas.teayudo, G = K.piezas.gemini, V = K.piezas.voz;
    var tema = T && T._tema ? T._tema(o.obligacion, '') : { ent: ['informe', 'acta', 'listado'], cu: 'actividades' };
    var A = { realizada: null, cantidades: null, quien: '', cuando: '', fechas: [], evid: '', evidQue: '', detalle: '', motivo: '' };
    var ctx = { periodo: null, anteriores: [], medir: null, extra: null };
    var guion = null, pasoI = 0, intentos = 0, fallosVoz = 0, ultimaVia = 'texto', t0 = Date.now(), tPaso = Date.now(), terminado = false, vivo = true;
    var base = { app: o.app || '', obl: o.n, informe: o.informe || '' };
    function ev(tipo, extra) { var e = { tipo: 'rd.' + tipo }; for (var k in base) e[k] = base[k]; for (var q in (extra || {})) e[q] = extra[q]; registrar(e); }
    ev('abrir');

    /* contexto (periodo, anteriores, motor) y guion: de fondo, sin frenar la primera pregunta */
    var pCtx = Promise.resolve().then(function () { return o.contexto ? o.contexto() : null; })
      .then(function (c) { if (c) { for (var k in c) ctx[k] = c[k]; } return ctx; }, function () { return ctx; });
    var guionLocal = { cosas: [{ plural: tema.cu, singular: tema.cu }], quien: [], evidencia: tema.ent.slice(0, 3), local: true };
    var pGuion = (G && G.guion && G.disponible && G.disponible())
      ? G.guion(o.obligacion, { ms: 9000 }).then(function (g) { return g; }, function (e) { ev('guionFallo', { error: String((e && e.message) || '').slice(0, 30) }); return guionLocal; })
      : Promise.resolve(guionLocal);
    if (G && G.guionGuardado) guion = G.guionGuardado(o.obligacion);
    if (G && G.precalentar) G.precalentar();

    var capa = K.nodo(
      '<div class="kit-capa rd-capa" role="dialog" aria-modal="true" aria-label="Redactemos una actividad juntos">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja rd-hoja">' +
      '    <header class="rd-cab">' +
      '      <span class="rd-robot" aria-hidden="true">' + K.icono('robot', 26) + '</span>' +
      '      <div class="rd-cab__tx"><p class="rd-cab__t">Redactemos juntos</p><p class="rd-cab__s">Obligación ' + K.esc(String(o.n)) + '</p></div>' +
      '      <button type="button" class="kit-capa__x rd-x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
      '    </header>' +
      '    <ol class="rd-luces" aria-label="Avance">' + PASOS.map(function (p, i) { return '<li class="rd-luz" data-p="' + p + '"><span class="rd-luz__p"></span><span class="rd-luz__t">' + PASO_TX[i] + '</span></li>'; }).join('') + '</ol>' +
      '    <div class="rd-chat" aria-live="polite"></div>' +
      '    <div class="rd-chips"></div>' +
      '    <form class="rd-pie" autocomplete="off">' +
      '      <textarea class="rd-in" rows="1" placeholder="Escribe o toca el micrófono" aria-label="Tu respuesta"></textarea>' +
      '      <button type="button" class="rd-mic" aria-label="Dictar"' + (V && V.hay() ? '' : ' hidden') + '>' + K.icono('microfono', 22) + '</button>' +
      '      <button type="submit" class="rd-env" aria-label="Enviar">' + K.icono('enviar', 20) + '</button>' +
      '    </form>' +
      '  </section>' +
      '</div>');
    document.body.appendChild(capa);
    var chat = capa.querySelector('.rd-chat'), chips = capa.querySelector('.rd-chips'), form = capa.querySelector('.rd-pie');
    var inp = capa.querySelector('.rd-in'), mic = capa.querySelector('.rd-mic');
    requestAnimationFrame(function () { capa.classList.add('kit-capa--on'); });
    var antesScroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    function luz(paso, estado) {
      var li = capa.querySelector('.rd-luz[data-p="' + paso + '"]');
      if (li) { li.classList.remove('rd-luz--ok', 'rd-luz--ya', 'rd-luz--no'); if (estado) li.classList.add('rd-luz--' + estado); }
    }
    function bajar() { chat.scrollTop = chat.scrollHeight; }
    function decir(html, quien) {
      var b = K.nodo('<div class="rd-msg rd-msg--' + (quien || 'bot') + '"><div class="rd-msg__b">' + html + '</div></div>');
      chat.appendChild(b); bajar();
      return b;
    }
    function escribiendo() { return decir('<span class="rd-dots"><i></i><i></i><i></i></span>', 'bot'); }
    function preguntar(html, ops) {
      ops = ops || {};
      var d = escribiendo();
      setTimeout(function () {
        if (!vivo) return;
        d.querySelector('.rd-msg__b').innerHTML = html + (ops.ej && ops.ej.length ? '<span class="rd-ej">Por ejemplo: ' + ops.ej.map(function (x) { return '«' + K.esc(x) + '»'; }).join(', ') + '</span>' : '');
        ponerChips(ops.chips || []);
        form.hidden = !!ops.soloChips;
        bajar();
        if (!ops.soloChips) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} bajar(); }, 30);
      }, ops.rapido ? 120 : 420);
    }
    function ponerChips(lista) {
      chips.innerHTML = '';
      lista.forEach(function (c) {
        var b = K.nodo('<button type="button" class="rd-chip' + (c.tono ? ' rd-chip--' + c.tono : '') + '">' + (c.icono ? K.icono(c.icono, 16) : '') + K.esc(c.t) + '</button>');
        b.addEventListener('click', function () { ultimaVia = 'boton'; responder(c.v !== undefined ? c.v : c.t, c.t); });
        chips.appendChild(b);
      });
    }
    function no_entendi(html, respuesta) {
      intentos++;
      ev('noEntendi', { paso: sub || PASOS[pasoI] || 'extra', via: ultimaVia, tema: temaKey(), muestra: anonimo(respuesta) });
      if (ultimaVia === 'voz') fallosVoz++;
      if (fallosVoz >= 2 && ultimaVia === 'voz') html += '<br><b>No te entendí bien por voz. ¿Me lo escribes?</b>';
      preguntar(html, { rapido: true, chips: chipsDe(PASOS[pasoI]) });
      if (fallosVoz >= 2) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 200);
    }

    /* ── las preguntas ── */
    var cosas = function () { return (guion || guionLocal).cosas; };
    /* el tipo de obligación, como lo guarda el CORE para aprender (sin tildes, en minúscula) */
    function temaKey() { return cosas().map(function (c) { return st(c.plural); }).join('|'); }
    /* lo aprobado en ADMIN para este tipo de obligación (llega con las actividades anteriores) */
    function aprobado() { var e = ctx.extra; return (e && e.porTema && e.porTema[temaKey()]) || {}; }
    /* para entender la cantidad: lo del guion + las unidades aprobadas */
    function cosasMatch() {
      var u = (aprobado().unidades || []).map(function (x) { return { plural: x, singular: x }; });
      return cosas().concat(u);
    }
    function chipsDe(paso) {
      var g = guion || guionLocal, ex = aprobado();
      if (paso === 'quien') return uniq((ex.quien || []).concat(g.quien || [])).slice(0, 4).map(function (x) { return { t: x }; });
      return [];
    }
    function uniq(a) { var v = {}; return a.filter(function (x) { var k = st(x); if (!x || v[k]) return false; v[k] = 1; return true; }); }
    function concl() { return 'tus ' + textoCantidades(A.cantidades); }
    function concl2() { return concl() + ' ' + A.quien; }

    var preguntas = {
      realizada: function () {
        var per = periodoTexto(ctx.periodo);
        preguntar('Hola' + (nombreCorto(o.nombre) ? ', <b>' + K.esc(nombreCorto(o.nombre)) + '</b>' : '') + '. Vamos a redactar juntos tu actividad de esta obligación.' +
          '<span class="rd-aviso">' + K.icono('lupa', 16) + ' Todo lo que me cuentes queda sujeto a verificación. Dime solo lo que hiciste y puedes demostrar: no inventes nada.</span>' +
          '¿Realizaste esta actividad durante el periodo' + (per ? ' <b>' + K.esc(per) + '</b>' : '') + '?',
          { soloChips: true, chips: [{ t: 'Sí', v: 'si', icono: 'check' }, { t: 'No', v: 'no' }] });
      },
      motivo: function () {
        preguntar('Entiendo. Cuéntame <b>por qué no se ejecutó</b> esta actividad en el periodo; así tu informe no queda pobre.',
          { ej: ['no hubo solicitudes de la dependencia', 'el proceso quedó suspendido mientras llegaba la información'] });
      },
      cuantos: function () {
        /* 10/11 · medido: el guion tarda 1–7 s en frío; se espera hasta 5 s con el robot «escribiendo» y si no, el genérico */
        var espera = guion ? null : escribiendo();
        Promise.race([pGuion, new Promise(function (ok) { setTimeout(function () { ok(null); }, guion ? 0 : 5000); })]).then(function (g) {
          if (espera) espera.remove();
          if (!vivo) return;
          if (g) guion = g;
          var cs = cosas();
          var nombres = cs.length === 1 && cs[0].plural === tema.cu ? tema.cu : lista(cs.map(function (c) { return c.plural; }), 'y/o');
          var ej = cs.slice(0, 3).map(function (c, i) { var n = [2, 4, 3][i]; return n + ' ' + c.plural; });
          preguntar(al(['Empecemos por los números. ', 'Primero lo que se puede contar. ', '']) +
            'Dime la cantidad de <b>' + K.esc(nombres) + '</b> que hiciste en este periodo.', { ej: ej });
        });
      },
      quien: function () {
        preguntar(al(['Cuéntame ahora, ¿p', 'Muy bien. Ahora, ¿p', 'Perfecto. ¿P']) + 'ara quién o con quién hiciste <b>' + K.esc(concl()) + '</b>?', { chips: chipsDe('quien') });
      },
      cuando: function () {
        var per = periodoTexto(ctx.periodo);
        preguntar(al(['Muy bien, ¿e', 'Listo. ¿E', 'Gracias. ¿E']) + 'n qué días de este periodo' + (per ? ' (' + K.esc(per) + ')' : '') + ' hiciste <b>' + K.esc(concl2()) + '</b>?',
          { ej: ['15 de ' + (ctx.periodo && ctx.periodo.hasta ? MESES[Number(ctx.periodo.hasta.slice(5, 7)) - 1] : 'octubre'), 'la segunda semana del periodo', 'del 3 al 7'] });
      },
      evidencia: function () {
        preguntar('Es importante para ayudarte saber si cuentas con <b>imágenes o adjuntos de evidencia</b> para esta actividad.', {
          soloChips: true, chips: [{ t: 'Sí, la subo', v: 'si', icono: 'imagen' }, { t: 'La subo después', v: 'despues' }, { t: 'No requiere', v: 'noreq' }]
        });
      },
      evidQue: function () {
        var g = guion || guionLocal, ex = aprobado();
        preguntar('¿Qué evidencia es? Así lo dejo dicho en tu actividad.', { chips: uniq((ex.evidencia || []).concat(g.evidencia || [], tema.ent)).slice(0, 4).map(function (x) { return { t: x }; }) });
      },
      evidSeguro: function () {
        preguntar('¿Seguro que no requiere adjunto? Si de esta actividad quedó algo que lo demuestre (' + K.esc(lista((guion || guionLocal).evidencia.length ? (guion || guionLocal).evidencia.slice(0, 2) : tema.ent.slice(0, 2), 'o')) + '), es mejor subirlo.',
          { soloChips: true, chips: [{ t: 'Sí, no requiere', v: 'noreq' }, { t: 'Mejor la subo', v: 'si', icono: 'imagen' }] });
      },
      detalle: function () {
        preguntar('Para finalizar, cuéntame más detalles para complementar. <b>Enséñame un poco de tu trabajo</b> en esta obligación: qué hiciste, qué resolviste o qué cambió. Puedes hablarme.');
      }
    };
    var sub = '';   /* motivo · evidQue · evidSeguro · fueraOk */

    function ir(i) {
      if (i > pasoI) { /* medición del paso que se cierra */ ev('paso', { paso: PASOS[pasoI], ms: Date.now() - tPaso, via: ultimaVia, intentos: intentos }); }
      pasoI = i; intentos = 0; fallosVoz = 0; tPaso = Date.now(); sub = '';
      PASOS.forEach(function (p, k) { luz(p, k < i ? 'ok' : (k === i ? 'ya' : '')); });
      preguntas[PASOS[i]]();
    }

    function responder(valor, mostrar) {
      if (terminado) return;
      var txt = limpio(mostrar !== undefined ? mostrar : valor);
      if (!txt) return;
      decir(K.esc(txt), 'yo');
      chips.innerHTML = '';
      inp.value = ''; ajustar();
      var paso = PASOS[pasoI], r;
      if (sub === 'motivo') {
        r = motivo(valor);
        if (!r.ok) return no_entendi('Necesito un poco más: <b>¿qué pasó</b> para que no se ejecutara?', valor);
        A.motivo = r.texto; luz('realizada', 'no');
        return terminar(parrafoNo(A.motivo), 'no');
      }
      if (sub === 'evidQue') {
        r = evidenciaQue(valor);
        if (!r.ok) return no_entendi('Dime en pocas palabras qué evidencia es (por ejemplo, ' + K.esc(tema.ent[0]) + ').', valor);
        A.evidQue = r.que;
        ev('aprende', { que: 'evidencia', tema: temaKey(), muestra: anonimo(r.que) });
        return ir(5);
      }
      if (sub === 'evidSeguro') {
        if (valor === 'noreq') { A.evid = 'noreq'; A.evidQue = ''; return ir(5); }
        A.evid = 'si'; sub = 'evidQue'; return preguntas.evidQue();
      }
      if (sub === 'fueraOk') {
        if (valor === 'si') { return ir(4); }
        sub = ''; A.cuando = ''; return preguntas.cuando();
      }
      switch (paso) {
        case 'realizada':
          if (valor === 'no' || /^no\b/.test(st(valor))) { A.realizada = false; sub = 'motivo'; luz('realizada', 'no'); ev('paso', { paso: 'realizada', ms: Date.now() - tPaso, via: ultimaVia, valor: 'no' }); return preguntas.motivo(); }
          if (valor === 'si' || /^(si|claro|correcto|asi es|afirmativo)\b/.test(st(valor))) { A.realizada = true; return ir(1); }
          return no_entendi('Respóndeme <b>Sí</b> o <b>No</b>: ¿realizaste esta actividad en el periodo?', valor);
        case 'cuantos':
          r = cantidades(valor, cosasMatch());
          if (!r.ok) {
            var cs = cosas().map(function (c) { return c.plural; });
            if (r.aclarar === 'que') return no_entendi('¿' + r.n + ' de qué? Dime, por ejemplo, «' + r.n + ' ' + K.esc(cs[0]) + '».', valor);
            if (r.aclarar === 'vago') return no_entendi('Necesito el <b>número exacto</b>: «varios» o «algunos» no se pueden verificar. ¿Cuántos fueron?', valor);
            if (r.aclarar === 'cero') return no_entendi('Si no hiciste ninguno, lo correcto es decir que no realizaste la actividad. ¿Cuántos hiciste? Si fueron cero, cierra y empieza de nuevo marcando «No».', valor);
            return no_entendi('No logré entender la cantidad. Dímela con un número y lo que contaste, por ejemplo: «' + [2, 4, 3].slice(0, cs.length).map(function (n, i) { return n + ' ' + K.esc(cs[i]); }).join(', ') + '».', valor);
          }
          A.cantidades = r.items;
          ev('aprende', { que: 'unidades', tema: temaKey(), unidades: r.items.map(function (x) { return st(x.u); }).join('|') });
          return ir(2);
        case 'quien':
          r = quien(valor);
          if (!r.ok) return no_entendi('Dime <b>para quién o con quién</b> lo hiciste: una dependencia, un grupo, una comunidad o una entidad.', valor);
          A.quien = r.frase;
          ev('aprende', { que: 'quien', tema: temaKey(), muestra: anonimo(r.frase) });
          return ir(3);
        case 'cuando':
          r = cuando(valor, ctx.periodo);
          if (r.aclarar === 'fuera' && r.frase) {
            A.cuando = r.frase; A.fechas = r.fechas;
            sub = 'fueraOk';
            return preguntar('Ojo: <b>' + K.esc(r.fuera.map(fechaCorta).join(', ')) + '</b> queda fuera de este periodo (' + K.esc(periodoTexto(ctx.periodo)) + '). ¿Fue así?',
              { soloChips: true, rapido: true, chips: [{ t: 'Sí, fue en esa fecha', v: 'si' }, { t: 'Corregir la fecha', v: 'no' }] });
          }
          if (!r.ok) {
            if (r.aclarar === 'mes') return no_entendi('¿De qué mes? Dímelo completo, por ejemplo «15 de octubre».', valor);
            if (r.aclarar === 'fuera') return no_entendi('Esos días no caen en este periodo (' + K.esc(periodoTexto(ctx.periodo)) + '). ¿En qué fechas fue?', valor);
            if (r.aclarar === 'relativo') return no_entendi('Dime la fecha exacta (por ejemplo «15 de octubre»): «hoy» o «ayer» cambian según cuándo se lea el informe.', valor);
            return no_entendi('Dime los días o la semana: «15 de octubre», «del 3 al 7» o «la segunda semana del periodo».', valor);
          }
          A.cuando = r.frase; A.fechas = r.fechas;
          return ir(4);
        case 'evidencia':
          if (valor === 'si' || valor === 'despues') { A.evid = valor; sub = 'evidQue'; luz('evidencia', 'ya'); return preguntas.evidQue(); }
          if (valor === 'noreq') { sub = 'evidSeguro'; return preguntas.evidSeguro(); }
          if (/^si\b/.test(st(valor))) { A.evid = 'si'; sub = 'evidQue'; return preguntas.evidQue(); }
          if (/(despues|luego|mas tarde)/.test(st(valor))) { A.evid = 'despues'; sub = 'evidQue'; return preguntas.evidQue(); }
          if (/(no requiere|no aplica|^no\b)/.test(st(valor))) { sub = 'evidSeguro'; return preguntas.evidSeguro(); }
          return no_entendi('Elige una opción: <b>Sí, la subo</b>, <b>La subo después</b> o <b>No requiere</b>.', valor);
        case 'detalle':
          r = detalle(valor);
          if (!r.ok) return no_entendi(al(['Cuéntame un poco más: ', 'Dame más detalle: ']) + 'qué hiciste exactamente, qué resolviste o qué cambió con tu trabajo.', valor);
          A.detalle = r.texto;
          ev('paso', { paso: 'detalle', ms: Date.now() - tPaso, via: ultimaVia, intentos: intentos });
          luz('detalle', 'ok');
          return redactar();
      }
    }

    /* ── la redacción final ── */
    function redactar() {
      form.hidden = true;
      var d = decir('<span class="rd-dots"><i></i><i></i><i></i></span> Dame un momento, estoy redactando tu actividad…', 'bot');
      var tR = Date.now();
      pCtx.then(function () {
        var fuentes = [o.obligacion, textoCantidades(A.cantidades), A.quien, A.cuando, A.evidQue, A.detalle, 'no requiere adjunto'].join(' • ');
        var datos = {
          obligacion: o.obligacion, cantidades: textoCantidades(A.cantidades), quien: A.quien, cuando: A.cuando,
          evidencia: A.evid === 'noreq' ? 'No requiere adjunto' : (A.evidQue ? A.evidQue + (A.evid === 'despues' ? ' (la sube después)' : '') : ''),
          detalle: A.detalle, anteriores: (ctx.anteriores || []).slice(-3), ms: 8000
        };
        function repetida(t) {
          try { var R = ctx.medir && ctx.medir(t); return !!(R && R.b && R.b[0] && R.b[0].e === 'rojo'); } catch (e) { return false; }
        }
        function completar(t) {
          if (A.evid === 'noreq' && !/no requiere adjunto/.test(st(t))) t = conPunto(t) + ' No requiere adjunto.';
          if (A.evidQue && st(t).indexOf(st(A.evidQue).slice(0, 18)) < 0) t = conPunto(t) + ' Como evidencia quedó ' + A.evidQue + '.';
          return t;
        }
        var origen = 'local', motivoLocal = '';
        var p = (G && G.redactar && G.disponible && G.disponible() && (!G.quedanMejora || G.quedanMejora()))
          ? G.redactar(datos).then(function (t) {
            t = completar(enCifras(t, false).replace(/\s+([.,;:])/g, '$1'));   /* «dos aplicaciones» → «2 aplicaciones»: las cantidades van en cifras; sin espacio antes del punto */
            var malo = revisar(t, fuentes, A);
            if (malo) throw new Error('GUARDA:' + malo);
            if (repetida(t) && G.quedanMejora && G.quedanMejora()) {
              datos.evitar = true;
              return G.redactar(datos).then(function (t2) { t2 = completar(enCifras(t2, false).replace(/\s+([.,;:])/g, '$1')); return revisar(t2, fuentes, A) ? t : t2; }, function () { return t; });
            }
            return t;
          }).then(function (t) { origen = 'gemini'; return t; })
          : Promise.reject(new Error(G ? 'SIN_CUPO' : 'SIN_GEMINI'));
        return p['catch'](function (e) {
          motivoLocal = String((e && e.message) || 'ERROR').slice(0, 40);
          var t = local(A, ctx.anteriores), v = 0;
          while (repetida(t) && v++ < 3) t = local(A, ctx.anteriores);
          return t;
        }).then(function (t) {
          if (!vivo) return;
          d.remove();
          var R = null; try { R = ctx.medir && ctx.medir(t); } catch (e) {}
          var Vv = K.piezas.variacion, verdes = (R && Vv && Vv.verdes) ? Vv.verdes(R) : null;
          ev('fin', { ms: Date.now() - t0, msRedactar: Date.now() - tR, origen: origen, error: motivoLocal, evid: A.evid, realizada: 1, verdes: verdes ? verdes.v + '/' + verdes.n : '' });
          terminar(t, A.evid);
        });
      });
    }

    function terminar(parrafo, evid) {
      terminado = true;
      if (evid === 'no') ev('fin', { ms: Date.now() - t0, origen: 'local', realizada: 0 });
      chips.innerHTML = ''; form.hidden = true;
      PASOS.forEach(function (p) { if (A.realizada !== false) luz(p, 'ok'); });
      escribirEnCampo(parrafo);
      var subir = evid === 'si' || evid === 'despues';
      var fin = K.nodo('<div class="rd-fin" role="status">' +
        '<span class="rd-fin__ico">' + K.icono('check', 34) + '</span>' +
        '<p class="rd-fin__t">¡Hemos terminado!</p>' +
        '<p class="rd-fin__s">Puedes editar el texto' + (subir ? ' y <b>no olvides subir tu evidencia</b>' : '') + '.</p>' +
        '<button type="button" class="kit-btn kit-btn--marca rd-fin__b">Ver mi actividad</button></div>');
      capa.querySelector('.rd-hoja').appendChild(fin);
      K.vibrar && K.vibrar([12, 40, 12]);
      fin.querySelector('button').addEventListener('click', function () { cerrar(true); });
      setTimeout(function () { cerrar(true); }, 2600);
      if (o.alTerminar) { try { o.alTerminar({ texto: parrafo, evid: evid, realizada: evid !== 'no' }); } catch (e) {} }
    }
    function escribirEnCampo(parrafo) {
      var area = o.area, previo = String(area.value || '').replace(/\s+$/, '');
      var baseTx = previo ? previo + '\n\n' : '', i = 0, paso = Math.max(4, Math.ceil(parrafo.length / 40));
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function emitir() { try { area.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
      if (reduce) { area.value = baseTx + parrafo; emitir(); return; }
      (function tecla() {
        i = Math.min(parrafo.length, i + paso);
        area.value = baseTx + parrafo.slice(0, i);
        if (i < parrafo.length) setTimeout(tecla, 16);
        else emitir();
      }());
    }

    var cerrado = false;
    function cerrar(fin) {
      if (cerrado) return; cerrado = true; vivo = false;
      if (V && V.escuchando && V.escuchando()) V.parar();
      if (!fin) ev('cerrar', { paso: sub || PASOS[pasoI], ms: Date.now() - t0 });
      capa.classList.remove('kit-capa--on');
      document.documentElement.style.overflow = antesScroll;
      document.removeEventListener('keydown', alTecla);
      setTimeout(function () { capa.remove(); }, 200);
      if (fin) {
        var subir = A.evid === 'si' || A.evid === 'despues';
        K.aviso('¡Hemos terminado! Puedes editar el texto' + (subir ? ' y no olvides subir tu evidencia.' : '.'), 'ok', 6000);
        try { o.area.focus({ preventScroll: false }); o.area.setSelectionRange(o.area.value.length, o.area.value.length); } catch (e) {}
      }
      if (alCerrar) alCerrar();
    }
    function quiereCerrar() {
      if (terminado || (A.realizada === null && !sub)) return cerrar(false);
      var C = K.piezas.confirmar;
      if (!C || !C.preguntar) return cerrar(false);
      C.preguntar({ titulo: '¿Salir sin terminar?', texto: 'Lo que me contaste no se guarda. Tu actividad queda como estaba.', si: 'Salir', no: 'Seguir' })
        .then(function (ok) { if (ok) cerrar(false); });
    }
    function alTecla(e) { if (e.key === 'Escape' && capa.isConnected) { e.preventDefault(); quiereCerrar(); } }
    document.addEventListener('keydown', alTecla);
    capa.querySelector('.rd-x').addEventListener('click', quiereCerrar);
    capa.querySelector('.kit-capa__velo').addEventListener('click', quiereCerrar);

    /* ── entrada: texto, Enter y micrófono ── */
    function ajustar() { inp.style.height = 'auto'; inp.style.height = Math.min(140, inp.scrollHeight) + 'px'; }
    inp.addEventListener('input', ajustar);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (V && V.escuchando && V.escuchando()) { V.parar(); return; }
      var t = limpio(inp.value);
      if (!t) return;
      if (ultimaVia !== 'voz') ultimaVia = 'texto';
      responder(t);
      ultimaVia = 'texto';
    });
    mic.addEventListener('click', function () {
      if (!V) return;
      if (V.escuchando()) { V.parar(); return; }
      mic.classList.add('rd-mic--on'); mic.setAttribute('aria-label', 'Escuchando: toca para terminar');
      inp.placeholder = 'Te escucho…';
      V.escuchar({ alParcial: function (t) { inp.value = t; ajustar(); } }).then(function (t) {
        mic.classList.remove('rd-mic--on'); mic.setAttribute('aria-label', 'Dictar'); inp.placeholder = 'Escribe o toca el micrófono';
        if (!vivo) return;
        ultimaVia = 'voz';
        responder(t);
        ultimaVia = 'texto';
      }, function (e) {
        mic.classList.remove('rd-mic--on'); mic.setAttribute('aria-label', 'Dictar'); inp.placeholder = 'Escribe o toca el micrófono';
        if (!vivo) return;
        var c = e && e.message;
        if (c === 'BLOQUEADO') { mic.hidden = true; decir('El micrófono está bloqueado en este navegador. Escríbeme tu respuesta.', 'bot'); }
        else { fallosVoz++; decir(fallosVoz >= 2 ? 'No te escuché bien. ¿Me lo escribes?' : 'No te escuché. Toca el micrófono otra vez o escríbeme.', 'bot'); }
        try { inp.focus(); } catch (x) {}
      });
    });

    pCtx.then(function () { if (vivo && pasoI === 0 && A.realizada === null) { /* el periodo ya llegó: la pregunta lo muestra */ } });
    /* la primera pregunta espera el periodo como mucho 600 ms (suele estar ya en memoria) */
    Promise.race([pCtx, new Promise(function (ok) { setTimeout(ok, 600); })]).then(function () { if (vivo) ir(0); });
    return { cerrar: cerrar, _A: A };
  }

  K.piezas.redactemos = {
    crear: crear,
    /* para las pruebas */
    _cantidades: cantidades, _cuando: cuando, _quien: quien, _detalle: detalle, _motivo: motivo, _enCifras: enCifras,
    _local: local, _revisar: revisar, _parrafoNo: parrafoNo, _nombreCorto: nombreCorto, NO_EJEC: NO_EJEC
  };
}());
