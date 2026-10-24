/* ============================================================
   KIT-FLANDES · PIEZA 32 · ASISTENTE DE AYUDA (texto y voz)
   24/10/2026 · entrega 1 (CONTRATISTA primero; luego las otras 6 apps)

   El robot de Insights deja de ser solo información: ahora pregunta
   "¿en qué te puedo ayudar?", entiende lo que la persona escribe o dicta,
   responde con la base de conocimiento y la LLEVA al sitio.

   Reglas del pliego que esta pieza hace cumplir
     · CERO viajes para responder: el buscador de intenciones corre en el
       teléfono, con la base que ya está en el dispositivo y el estado que
       la app trajo al arrancar. (Gemini, entrega 2, solo si no hay una
       coincidencia segura, y solo para ELEGIR el tema.)
     · La respuesta que ve la persona es SIEMPRE el texto de la base: el
       asistente no inventa plazos, reglas ni montos.
     · NUNCA guarda, reporta ni envía nada por la persona: lleva al sitio
       (abre la vista o el modal) y ahí lo hace ella con sus botones.
     · Lo bloqueado se explica y se ofrece el botón que lo destraba
       (la app lo dice con su adaptador: puerta()).
     · La conversación vive mientras la app esté abierta: cambiar de vista
       y volver no la borra; al cerrar la app se pierde (no se guarda).
     · Voz: si la pregunta fue DICTADA, la respuesta se lee sola; si fue
       escrita o con botón, queda el parlante en cada respuesta. Voz de
       Inworld (la del CORE) con caída sin aviso a la del teléfono. El
       interruptor de silencio se recuerda en el dispositivo.
     · Llamada de atención UNA vez por día y por dispositivo: el aviso
       "¡Te ayudo ahora!" sale del botón y vuelve a entrar.
     · Preguntas registradas ANÓNIMAS (app, vista, fecha, pregunta, cómo
       se resolvió y 👍/👎), en cola en el teléfono y enviadas en un solo
       viaje de fondo con su rid (un reintento no duplica filas).

   Cómo se usa
     K.piezas.asistente.configurar({
       app: 'CONTRATISTA',
       base: [ ...temas ],                // la semilla embebida (respaldo)
       adaptador: {                       // lo que solo la app sabe
         vista()            -> 'cuenta'   // la vista actual
         estado()           -> 'ACTIVO' | 'TERMINADO'
         dato(clave)        -> texto      // {{clave}} de las respuestas
         urgente()          -> null | { texto, accion }
         destino(id)        -> { etiqueta, ir() }
         puerta(id)         -> null | { texto, accion }   // bloqueado
         accion(nombre)     -> { etiqueta, hacer(pregunta) }
       }
     });
     K.piezas.asistente.base(temas, sello)   // la que mandó el CORE
     K.piezas.asistente.abrir(cfgInsights)   // lo llama el botón
     K.piezas.asistente.buscar('frase', { vista, estado })   // ADMIN · Probar

   Pareja: kit/asistente.css. Usa la voz de kit/insights.js.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/asistente] falta kit.js'); } catch (e) {} return; }

  /* ══════════════ estado de la pieza ══════════════ */

  var CFG = { app: '', adaptador: null };
  var TEMAS = [];             /* la base activa, ya indexada */
  var POR_ID = {};
  var IDF = {};               /* peso de cada raíz en la base */
  var VOCAB = {};             /* raíces que la app conoce */
  var SELLO = '';
  var CHAT = [];              /* la conversación: vive en memoria y nada más */
  var abierto = null;
  var ultimaGuia = '';        /* la guía de la vista que ya quedó en el chat */
  var ultimoUrgente = '';
  var entrada = null;         /* modo pantalla de entrada: { adaptador } */
  var MEDIDAS = [];           /* tiempos de pantalla (ms) para las pruebas */

  var BASE_K = 'asistente.base';
  var COLA_K = 'asistente.cola';
  var ENVIO_K = 'asistente.envio';
  var SILENCIO_K = 'asistente.silencio';
  var LLAMADA_K = 'asistente.llamada';

  /* ══════════════ el buscador de intenciones ══════════════ */

  var VACIAS = ('a al algo alguna alguno algunos ante antes aqui asi aun bien cada como con contra cual cuales cuando de del desde donde dos el q k xq pq ella ellas ellos en entre era es esa ese eso esta estan estas este esto estos fue hay hacia hasta la las le les lo los mas me mi mia mio mis muy nada ni no nos nosotros o otra otro para pero poco por porque pues que quien quienes se sea segun ser si sin sobre solo son su sus tambien tan te ti tiene tienen todo todos tu tus un una uno unos unas usted ustedes vamos voy y ya yo ' +
    'quiero quisiera necesito puedo puede podria deseo favor porfa porfavor gracias hola buenas buenos dias tardes noches saber ayudame ayudeme dime digame decir hago hace hacer haga tengo tener estoy esta saber ver mire mira oiga oye senor senora claro bueno listo entonces osea pues como hago donde').split(' ');
  var VACIA = {};
  VACIAS.forEach(function (w) { if (w) VACIA[w] = 1; });
  /* "hacer" y "ver" vacían la frase, pero en "hacer la cuenta" manda "cuenta" */

  var SINONIMOS = {
    clave: 'contrasen', password: 'contrasen', contrasena: 'contrasen',
    plata: 'pag', dinero: 'pag', consign: 'pag', gir: 'pag', pagu: 'pag', abon: 'pag',
    celular: 'telefon', cel: 'telefon', movil: 'telefon',
    imag: 'foto', fotografi: 'foto', pantallaz: 'foto', captur: 'foto',
    notificacion: 'avis', notificacione: 'avis', alert: 'avis', mensaj: 'avis',
    certificad: 'certific', constanci: 'certific',
    radiqu: 'radic', subi: 'sub', suba: 'sub',
    supervisora: 'supervisor', supervisores: 'supervisor',
    secopii: 'secop', ii: '',
    whatsap: 'whatsapp', guasap: 'whatsapp', wasap: 'whatsapp',
    informe: 'inform', informes: 'inform',
    dev: 'devuelt', rechaz: 'devuelt', devolv: 'devuelt', devolvi: 'devuelt',
    aplicacion: 'app', aplicativo: 'app', aplic: 'app', plataform: 'app'
  };

  var SUFIJOS = ['aciones', 'amientos', 'imientos', 'amiento', 'imiento', 'acion', 'iciones', 'icion',
    'adores', 'ador', 'mente', 'ando', 'iendo', 'aron', 'ieron', 'aste', 'iste', 'amos', 'emos', 'imos',
    'aban', 'aba', 'ados', 'idos', 'adas', 'idas', 'ado', 'ido', 'ada', 'ida', 'ar', 'er', 'ir',
    'an', 'en', 'as', 'es', 'os', 'a', 'o', 'e', 's'];

  function plano(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function raiz(w) {
    if (/^\d+$/.test(w)) return w;
    if (SINONIMOS[w] !== undefined) return SINONIMOS[w];
    var r = w;
    for (var i = 0; i < SUFIJOS.length; i++) {
      var s = SUFIJOS[i];
      if (r.length - s.length >= 4 && r.slice(-s.length) === s) { r = r.slice(0, -s.length); break; }
    }
    if (SINONIMOS[r] !== undefined) return SINONIMOS[r];
    return r;
  }

  function fichas(s) {
    var out = [];
    plano(s).split(' ').forEach(function (w) {
      if (!w || VACIA[w]) return;
      var r = raiz(w);
      if (r && out.indexOf(r) < 0) out.push(r);
    });
    return out;
  }

  /** Distancia de edición, cortada: solo interesa si es 1 o 2. */
  function cerca(a, b) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 2) return 3;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i];
      var min = i;
      for (j = 1; j <= lb; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < min) min = cur[j];
      }
      if (min > 2) return 3;
      prev = cur;
    }
    return prev[lb];
  }

  /** Cuánto se parecen dos raíces (1 iguales; 0 nada). */
  function parecido(a, b) {
    if (a === b) return 1;
    if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 0.85;
    if (a.length >= 6 && b.length >= 6) {
      /* misma raíz larga con otra terminación (suspender / suspensión) */
      var k = 0; while (k < a.length && k < b.length && a.charAt(k) === b.charAt(k)) k++;
      if (k >= 6 && Math.max(a.length, b.length) - k <= 2) return 0.8;
      var d = cerca(a, b);
      if (d === 1) return 0.8;
      if (d === 2 && a.length >= 8) return 0.65;
    }
    return 0;
  }

  function peso(t) { return IDF[t] || 1.6; }

  /** Qué tan bien explica una frase de la base la pregunta (0..1). */
  function puntuar(q, f) {
    if (!q.length || !f.length) return 0;
    var sq = 0, wq = 0, sf = 0, wf = 0, i, j, m;
    for (i = 0; i < q.length; i++) {
      m = 0;
      for (j = 0; j < f.length; j++) { var p = parecido(q[i], f[j]); if (p > m) m = p; }
      sq += peso(q[i]) * m; wq += peso(q[i]);
    }
    for (j = 0; j < f.length; j++) {
      m = 0;
      for (i = 0; i < q.length; i++) { var p2 = parecido(q[i], f[j]); if (p2 > m) m = p2; }
      sf += peso(f[j]) * m; wf += peso(f[j]);
    }
    var cq = wq ? sq / wq : 0, cf = wf ? sf / wf : 0;
    /* tope 0,95: la frase idéntica de la base (1,0) siempre le gana a una
       que solo comparte las mismas raíces */
    return Math.min(0.95, 0.62 * cq + 0.38 * cf);
  }

  function listaVistas(v) {
    return String(v || '').split(/[,;|]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function indexar(temas) {
    var df = {}, n = 0;
    TEMAS = []; POR_ID = {}; VOCAB = {};
    (temas || []).forEach(function (t) {
      if (!t || !t.id) return;
      var activo = !(t.activo === false || /^(NO|FALSE|0)$/i.test(String(t.activo === undefined ? '' : t.activo)));
      if (!activo) return;
      var frases = Array.isArray(t.frases) ? t.frases : String(t.frases || '').split(/\n|\|/);
      frases = frases.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
      var tema = {
        id: String(t.id), titulo: String(t.titulo || t.id), vistas: listaVistas(t.vista),
        estado: String(t.estado || '').toUpperCase().trim(), respuesta: String(t.respuesta || ''),
        accion: String(t.accion || '').trim(), orden: Number(t.orden) || 0,
        frases: frases, fichas: [], planas: []
      };
      tema.fichas = [fichas(tema.titulo)].concat(frases.map(fichas)).filter(function (f) { return f.length; });
      tema.planas = [plano(tema.titulo)].concat(frases.map(plano));
      tema.fichas.forEach(function (f) { n++; f.forEach(function (w) { df[w] = (df[w] || 0) + 1; VOCAB[w] = 1; }); });
      TEMAS.push(tema);
      POR_ID[tema.id] = tema;
    });
    IDF = {};
    Object.keys(df).forEach(function (w) { IDF[w] = Math.log(1 + n / df[w]); });
    TEMAS.forEach(function (t, i) { if (!t.orden) t.orden = i + 1; });
  }

  function esEntradaTema(t) { return t.vistas.indexOf('entrada') >= 0; }

  /** ¿Este tema aplica ahora? (pantalla de entrada o app, y el estado) */
  function aplica(t, o) {
    if (o.entrada) return esEntradaTema(t);
    if (esEntradaTema(t)) return false;
    if (t.estado && t.estado !== o.estado) return false;
    return true;
  }

  /**
   * Busca el tema. Devuelve
   *   { tipo: 'tema', tema, puntaje, candidatos }     coincidencia segura
   *   { tipo: 'dudas', candidatos }                    "¿Quisiste decir…?"
   *   { tipo: 'fuera', candidatos }                    nada que ver con la app
   */
  var SEGURO = 0.6, MARGEN = 0.05;

  function buscar(frase, o) {
    o = o || {};
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var q = fichas(frase), pq = plano(frase);
    var res = [];
    TEMAS.forEach(function (t) {
      if (!aplica(t, o)) return;
      var m = 0;
      for (var i = 0; i < t.fichas.length; i++) {
        var s = puntuar(q, t.fichas[i]);
        if (s > m) m = s;
      }
      /* la frase de la base aparece entera dentro de lo que escribió */
      for (var k = 0; k < t.planas.length; k++) {
        var pl = t.planas[k];
        if (pl && pq === pl) { m = 1; break; }
        /* la frase de la base, entera dentro de lo que escribió: vale más cuanto más ocupa */
        if (pl && pl.length >= 6 && (' ' + pq + ' ').indexOf(' ' + pl + ' ') >= 0) m = Math.max(m, 0.78 + 0.15 * pl.length / pq.length);
      }
      if (m <= 0) return;
      if (o.vista && t.vistas.indexOf(o.vista) >= 0) m += 0.04;
      if (t.estado && t.estado === o.estado) m += 0.12;
      res.push({ tema: t, crudo: m, puntaje: Math.min(1, m) });
    });
    res.sort(function (a, b) { return b.crudo - a.crudo || a.tema.orden - b.tema.orden; });
    var top = res[0], seg = res[1];
    var conoce = q.some(function (w) { return VOCAB[w] || Object.keys(VOCAB).some(function (v) { return parecido(w, v) >= 0.85; }); });
    var out;
    if (top && top.crudo >= SEGURO && (!seg || top.crudo - seg.crudo >= MARGEN || seg.crudo < SEGURO)) {
      out = { tipo: 'tema', tema: top.tema, puntaje: top.puntaje, candidatos: res.slice(0, 3) };
    } else if (top && conoce && top.crudo >= 0.2) {
      out = { tipo: 'dudas', candidatos: res.slice(0, 3), puntaje: top.puntaje };
    } else {
      out = { tipo: 'fuera', candidatos: res.slice(0, 3), puntaje: top ? top.puntaje : 0 };
    }
    out.ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
    return out;
  }

  /**
   * Un motor aparte, con su propia base, que NO toca el del asistente de la
   * app (ADMIN · Probar). El buscador es síncrono: se cambia el estado, se
   * busca y se devuelve, sin que nada más corra en medio.
   */
  function motor(temas) {
    var antes = { T: TEMAS, P: POR_ID, I: IDF, V: VOCAB };
    indexar(temas);
    var mio = { T: TEMAS, P: POR_ID, I: IDF, V: VOCAB };
    TEMAS = antes.T; POR_ID = antes.P; IDF = antes.I; VOCAB = antes.V;
    function con(fn) {
      var g = { T: TEMAS, P: POR_ID, I: IDF, V: VOCAB };
      TEMAS = mio.T; POR_ID = mio.P; IDF = mio.I; VOCAB = mio.V;
      try { return fn(); } finally { TEMAS = g.T; POR_ID = g.P; IDF = g.I; VOCAB = g.V; }
    }
    return {
      buscar: function (f, o) { return con(function () { return buscar(f, o); }); },
      frecuentes: function (vista, estado) {
        return con(function () {
          var o = { estado: estado || 'ACTIVO', entrada: vista === 'entrada' };
          return TEMAS.filter(function (t) { return aplica(t, o) && t.vistas.indexOf(vista) >= 0; })
            .sort(function (a, b) { return (a.estado ? -1 : 0) - (b.estado ? -1 : 0) || a.orden - b.orden; }).slice(0, 4);
        });
      },
      tema: function (id) { return mio.P[id] || null; },
      temas: function () { return mio.T.slice(); }
    };
  }

  /* ══════════════ la base ══════════════ */

  function base(temas, sello) {
    if (!Array.isArray(temas) || !temas.length) return false;
    indexar(temas);
    SELLO = String(sello || '');
    if (sello) { try { K.guardar.escribir(BASE_K, { sello: SELLO, app: CFG.app, temas: temas }); } catch (e) {} }
    return true;
  }

  /** El sello de la base que el teléfono ya tiene (viaja con el arranque). */
  function selloGuardado() {
    var g = K.guardar.leer(BASE_K, null);
    return (g && g.app === CFG.app && g.sello) || '';
  }

  function configurar(c) {
    c = c || {};
    if (c.app) CFG.app = String(c.app).toUpperCase();
    if (c.adaptador) CFG.adaptador = c.adaptador;
    if (c.remoto) CFG.remoto = c.remoto;
    /* entrega 2 · si la app carga kit/gemini.js y tiene llave, Gemini es el remoto por defecto */
    else if (!CFG.remoto && K.piezas.gemini && K.piezas.gemini.disponible()) {
      CFG.remoto = K.piezas.gemini.elegir;
      CFG.precalentar = K.piezas.gemini.precalentar;
    }
    if (c.precalentar) CFG.precalentar = c.precalentar;
    /* la base guardada en el dispositivo manda sobre la semilla embebida */
    var g = K.guardar.leer(BASE_K, null);
    if (g && g.app === CFG.app && Array.isArray(g.temas) && g.temas.length) { indexar(g.temas); SELLO = g.sello || ''; }
    else if (c.base) indexar(c.base);
    return K.piezas.asistente;
  }

  /* ══════════════ textos ══════════════ */

  function rico(t) {
    return K.esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  function ad() { return (entrada && entrada.adaptador) || CFG.adaptador || {}; }

  function dato(k) {
    try { var v = ad().dato ? ad().dato(k) : ''; return v === undefined || v === null ? '' : String(v); } catch (e) { return ''; }
  }

  function llenar(t) {
    return String(t || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (_, k) { return dato(k); })
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function vistaAhora() { try { return entrada ? 'entrada' : (ad().vista ? ad().vista() : ''); } catch (e) { return ''; } }
  function estadoAhora() { try { return entrada ? '' : String((ad().estado && ad().estado()) || 'ACTIVO').toUpperCase(); } catch (e) { return 'ACTIVO'; } }

  /** Lo que un tema propone hacer: botones listos para pintar. */
  function botonesDe(tema, pregunta) {
    var a = String(tema.accion || ''), out = [];
    if (!a) return { botones: out, extra: '' };
    var extra = '';
    if (a.indexOf('ir:') === 0) {
      var id = a.slice(3);
      var p = null;
      try { p = ad().puerta ? ad().puerta(id) : null; } catch (e) { p = null; }
      if (p && p.texto) {
        extra = p.texto;
        if (p.accion) out = out.concat(botonesDe({ accion: p.accion }, pregunta).botones);
      } else {
        var d = null;
        try { d = ad().destino ? ad().destino(id) : null; } catch (e) { d = null; }
        if (d && d.ir) out.push({ texto: d.etiqueta || 'Ir', icono: 'adelante', hacer: d.ir, lleva: true });
      }
    } else if (a.indexOf('preguntar:') === 0) {
      a.slice(10).split('|').forEach(function (id) {
        var t = POR_ID[id.trim()];
        if (t) out.push({ texto: t.titulo, tema: t });
      });
    } else {
      var ac = null;
      try { ac = ad().accion ? ad().accion(a) : null; } catch (e) { ac = null; }
      if (ac && ac.hacer) out.push({ texto: ac.etiqueta || a, icono: ac.icono || 'adelante', hacer: function () { ac.hacer(pregunta); }, lleva: ac.cierra !== false });
    }
    return { botones: out, extra: extra };
  }

  /* ══════════════ la cola de preguntas (anónimas) ══════════════ */

  function nuevoId() { return 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function encolar(item) {
    var c = K.guardar.leer(COLA_K, []) || [];
    var i = -1;
    for (var k = 0; k < c.length; k++) if (c[k].id === item.id) { i = k; break; }
    if (i >= 0) { for (var p in item) if (Object.prototype.hasOwnProperty.call(item, p)) c[i][p] = item[p]; }
    else c.push(item);
    if (c.length > 80) c = c.slice(-80);
    K.guardar.escribir(COLA_K, c);
    programarEnvio();
  }

  var relojEnvio = null, enviando = false;
  function programarEnvio(ms) {
    clearTimeout(relojEnvio);
    relojEnvio = setTimeout(enviar, ms === undefined ? 4000 : ms);
  }

  /** Un viaje de fondo con todo lo pendiente. Mismo rid hasta que llegue. */
  function enviar() {
    if (enviando || entrada || !CFG.app || !K.token || !K.token()) return;
    if (abierto) { programarEnvio(6000); return; }   /* mientras conversa, no compite */
    var lote = K.guardar.leer(ENVIO_K, null);
    if (!lote || !lote.lista || !lote.lista.length) {
      var c = K.guardar.leer(COLA_K, []) || [];
      if (!c.length) return;
      lote = { rid: 'AS' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), lista: c.slice(0, 40) };
      K.guardar.escribir(ENVIO_K, lote);
      K.guardar.escribir(COLA_K, c.slice(40));
    }
    enviando = true;
    K.pedir('asistenteRegistrar', { lista: lote.lista, rid: lote.rid }, { ms: 30000 })
      .then(function () {
        K.guardar.borrar(ENVIO_K);
        enviando = false;
        if ((K.guardar.leer(COLA_K, []) || []).length) programarEnvio(1500);
      }, function (e) {
        enviando = false;
        /* el CORE todavía no tiene la ruta: se guarda y se reintenta en la próxima apertura */
        if (e && /no tiene la accion/i.test(String(e.message || ''))) return;
        programarEnvio(60000);
      });
  }

  /* ══════════════ la voz ══════════════ */

  function silencio() { return !!K.guardar.leer(SILENCIO_K, false); }

  var VOZ_LOCAL = null;
  function vozTelefono() {
    if (!('speechSynthesis' in window)) return null;
    if (VOZ_LOCAL) return VOZ_LOCAL;
    var vs = window.speechSynthesis.getVoices() || [];
    var pref = ['es-CO', 'es-US', 'es-MX', 'es-419', 'es-ES'];
    for (var i = 0; i < pref.length && !VOZ_LOCAL; i++) {
      for (var j = 0; j < vs.length; j++) if (String(vs[j].lang).replace('_', '-') === pref[i]) { VOZ_LOCAL = vs[j]; break; }
    }
    if (!VOZ_LOCAL) for (var k = 0; k < vs.length; k++) if (/^es/i.test(vs[k].lang)) { VOZ_LOCAL = vs[k]; break; }
    return VOZ_LOCAL;
  }
  if ('speechSynthesis' in window) { try { window.speechSynthesis.onvoiceschanged = function () { VOZ_LOCAL = null; vozTelefono(); }; } catch (e) {} }

  var hablandoLocal = false, alCambiarVoz = null;
  function avisarVoz() { if (alCambiarVoz) { try { alCambiarVoz(sonando()); } catch (e) {} } }

  function decirLocal(t) {
    if (!('speechSynthesis' in window)) return;
    var I = K.piezas.insights && K.piezas.insights.voz;
    var limpio = I && I.trocear ? I.trocear(t).join(' ') : String(t || '').replace(/\*\*/g, '');
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(limpio);
      var v = vozTelefono();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'es-CO';
      u.rate = 1;
      u.onend = u.onerror = function () { hablandoLocal = false; avisarVoz(); };
      hablandoLocal = true; avisarVoz();
      window.speechSynthesis.speak(u);
    } catch (e) { hablandoLocal = false; avisarVoz(); }
  }

  function sonando() {
    var R = K.piezas.insights && K.piezas.insights.voz;
    return hablandoLocal || !!(R && R.suena && R.suena());
  }

  function callar() {
    var R = K.piezas.insights && K.piezas.insights.voz;
    try { if (R) R.parar(); } catch (e) {}
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
    hablandoLocal = false; avisarVoz();
  }

  /** Lee el texto: Inworld si está y responde a tiempo; si no, la voz del teléfono, sin avisar. */
  function hablar(t) {
    callar();
    var R = K.piezas.insights && K.piezas.insights.voz;
    var ins = K.piezas.insights;
    var usarLocal = function (resto) { decirLocal(resto || t); };
    if (!R || !ins || !ins.vozDisponible) return usarLocal();
    /* si todavía no se sabe si hay Inworld (primera apertura), no se espera más de 1,2 s */
    var listo = false;
    var tope = setTimeout(function () { if (!listo) { listo = true; usarLocal(); } }, 1200);
    ins.vozDisponible().then(function (vc) {
      if (listo) return; listo = true; clearTimeout(tope);
      if (!vc || !vc.configurada) return usarLocal();
      R.hablar(t, function () { avisarVoz(); }, { respaldo: usarLocal, espera: 3000 });
    }, function () { if (listo) return; listo = true; clearTimeout(tope); usarLocal(); });
  }

  /* ══════════════ el dictado ══════════════ */

  function Reconocedor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  function puedeDictar() { return !!Reconocedor() && (window.isSecureContext !== false); }

  /* ══════════════ el modal ══════════════ */

  function abrir(cfgVista, opciones) {
    opciones = opciones || {};
    if (abierto) abierto.cerrar();
    var t0 = Date.now();
    /* dentro del toque: Safari solo deja sonar después de un gesto */
    try { var R = K.piezas.insights && K.piezas.insights.voz; if (R) R.desbloquear(); } catch (e) {}
    cfgVista = cfgVista || {};
    var dicta = puedeDictar();
    var vista = vistaAhora();
    var titulo = entrada ? 'Te ayudo a entrar' : 'Asistente';

    var hoja = K.nodo(
      '<div class="kit-capa kit-as" role="dialog" aria-modal="true" aria-label="Asistente de ayuda">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-as__hoja">' +
      '    <header class="kit-capa__h kit-as__h">' +
      '      <span class="kit-as__robot">' + K.icono('robot', 22) + '</span>' +
      '      <span class="kit-as__t"><b>' + K.esc(titulo) + '</b><small>' + K.esc(cfgVista.vista || '') + '</small></span>' +
      '      <button type="button" class="kit-as__mudo" aria-pressed="false"></button>' +
      '      <button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
      '    </header>' +
      '    <div class="kit-capa__cuerpo kit-as__chat" aria-live="polite"></div>' +
      '    <footer class="kit-as__pie">' +
      '      <p class="kit-as__pide"></p>' +
      '      <div class="kit-as__frec" role="group" aria-label="Preguntas frecuentes"></div>' +
      '      <form class="kit-as__form" autocomplete="off">' +
      '        <input class="kit-as__in" type="text" enterkeyhint="send" maxlength="200" aria-label="Escribe tu pregunta">' +
      '        <button type="button" class="kit-as__mic" aria-label="Dictar">' + K.icono('microfono', 20) + '</button>' +
      '        <button type="submit" class="kit-as__env" aria-label="Enviar">' + K.icono('enviar', 18) + '</button>' +
      '      </form>' +
      (CFG.remoto && !entrada && K.piezas.gemini ? '      <p class="kit-as__legal">Protegido por reCAPTCHA · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacidad</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Términos</a></p>' : '') +
      '    </footer>' +
      '  </section>' +
      '</div>');
    document.body.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('kit-capa--on'); });

    var chat = hoja.querySelector('.kit-as__chat');
    var frec = hoja.querySelector('.kit-as__frec');
    var form = hoja.querySelector('.kit-as__form');
    var inp = hoja.querySelector('.kit-as__in');
    var bMic = hoja.querySelector('.kit-as__mic');
    var bMudo = hoja.querySelector('.kit-as__mudo');
    var pide = hoja.querySelector('.kit-as__pide');

    pide.textContent = dicta ? 'Selecciona, escribe o dime en qué te puedo ayudar' : 'Selecciona o escribe en qué te puedo ayudar';
    inp.placeholder = dicta ? 'Escribe o toca el micrófono' : 'Escribe tu pregunta';
    if (!dicta) bMic.hidden = true;

    var rec = null;
    function cerrar() {
      callar();
      if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
      hoja.classList.remove('kit-capa--on');
      setTimeout(function () { if (hoja.parentNode) hoja.remove(); }, 200);
      if (abierto && abierto.hoja === hoja) abierto = null;
      document.removeEventListener('keydown', tecla);
      programarEnvio(2500);
    }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', tecla);
    hoja.querySelector('.kit-capa__x').addEventListener('click', cerrar);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', cerrar);
    abierto = { cerrar: cerrar, hoja: hoja };

    /* ---- silencio, recordado en el teléfono ---- */
    function pintarMudo() {
      var m = silencio();
      bMudo.innerHTML = K.icono(m ? 'silencio' : 'altavoz', 18);
      bMudo.setAttribute('aria-pressed', String(m));
      bMudo.setAttribute('aria-label', m ? 'Voz apagada: toca para activarla' : 'Voz activada: toca para silenciar');
      bMudo.title = m ? 'Voz apagada' : 'Voz activada';
      bMudo.classList.toggle('kit-as__mudo--on', m);
    }
    bMudo.addEventListener('click', function () {
      K.guardar.escribir(SILENCIO_K, !silencio());
      if (silencio()) callar();
      pintarMudo();
      K.vibrar(8);
    });
    pintarMudo();

    /* ---- lo que ya se habló en esta sesión de la app ---- */
    CHAT.forEach(function (m) { pintar(m, false); });

    /* ---- lo urgente primero (una vez por cambio) y la guía de la vista ---- */
    if (!entrada) {
      var u = null;
      try { u = ad().urgente ? ad().urgente() : null; } catch (e) { u = null; }
      var uTxt = u && u.texto ? llenar(u.texto) : '';
      if (uTxt && uTxt !== ultimoUrgente) {
        ultimoUrgente = uTxt;
        decir({ quien: 'as', clase: 'urgente', texto: uTxt, botones: u.accion ? botonesDe({ accion: u.accion }, '').botones : [] });
      }
    }
    var guia = '';
    try { guia = String(typeof cfgVista.guia === 'function' ? cfgVista.guia() : (cfgVista.guia || '')); } catch (e) { guia = ''; }
    var llaveGuia = vista + '|' + guia;
    if (guia && llaveGuia !== ultimaGuia) {
      ultimaGuia = llaveGuia;
      decir({ quien: 'as', clase: 'guia', texto: guia, titulo: cfgVista.vista || '', medidas: medidasDe(cfgVista) });
    } else if (!CHAT.length) {
      decir({ quien: 'as', clase: 'guia', texto: entrada ? 'Hola. Te ayudo a entrar a la app: olvidé mi contraseña, no tengo acceso o cómo instalarla.' : '¿En qué te puedo ayudar?' });
    }

    /* ---- preguntas frecuentes de ESTA vista ---- */
    frecuentes(vista).forEach(function (t) {
      var b = K.nodo('<button type="button" class="kit-pastilla kit-as__chip">' + K.esc(t.titulo) + '</button>');
      b.addEventListener('click', function () { K.vibrar(6); responderTema(t, t.titulo, 'boton'); });
      frec.appendChild(b);
    });

    /* ---- escribir ---- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = String(inp.value || '').trim();
      if (!t) return;
      inp.value = '';
      preguntar(t, 'texto');
    });

    /* ---- dictar ---- */
    bMic.addEventListener('click', function () {
      if (rec) { try { rec.stop(); } catch (e) {} return; }
      var R2 = Reconocedor();
      if (!R2) return;
      callar();
      try {
        rec = new R2();
        rec.lang = 'es-CO';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.continuous = false;
      } catch (e) { rec = null; return; }
      var final = '';
      bMic.classList.add('kit-as__mic--on');
      bMic.setAttribute('aria-label', 'Escuchando: toca para terminar');
      inp.placeholder = 'Te escucho…';
      rec.onresult = function (ev) {
        var parcial = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
          else parcial += ev.results[i][0].transcript;
        }
        inp.value = (final + ' ' + parcial).trim();
      };
      rec.onerror = function (ev) {
        if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')) {
          K.aviso('El micrófono está bloqueado en este navegador. Puedes escribir tu pregunta.', 'aviso', 5000);
        }
      };
      rec.onend = function () {
        bMic.classList.remove('kit-as__mic--on');
        bMic.setAttribute('aria-label', 'Dictar');
        inp.placeholder = 'Escribe o toca el micrófono';
        var t = String(final || inp.value || '').trim();
        rec = null;
        if (t) { inp.value = ''; preguntar(t, 'voz'); }
      };
      try { rec.start(); K.vibrar(10); } catch (e) { rec = null; bMic.classList.remove('kit-as__mic--on'); }
    });

    /* ---- conversar ---- */

    function preguntar(t, modo) {
      decir({ quien: 'yo', texto: t });
      var r = buscar(t, { vista: vista, estado: estadoAhora(), entrada: !!entrada });
      MEDIDAS.push({ que: 'buscar', ms: r.ms });
      if (r.tipo === 'tema') return responderTema(r.tema, t, modo, 'LOCAL');
      if (CFG.remoto && !entrada) {
        /* entrega 2 · Gemini solo ELIGE un tema; con 3 s de tope y caída sin aviso */
        var listo = false, t0r = Date.now();
        var tope = setTimeout(function () { if (!listo) { listo = true; dudas(r, t, modo); } }, 3000);
        Promise.resolve().then(function () {
          return CFG.remoto(t, vista, TEMAS.filter(function (x) { return aplica(x, { estado: estadoAhora() }); }).map(function (x) { return { id: x.id, titulo: x.titulo }; }));
        }).then(function (id) {
          if (listo) return; listo = true; clearTimeout(tope);
          MEDIDAS.push({ que: 'remoto', ms: Date.now() - t0r, id: id || '' });
          if (id && POR_ID[id]) responderTema(POR_ID[id], t, modo, 'GEMINI');
          else if (id === 'FUERA') dudas({ tipo: 'fuera', candidatos: [] }, t, modo);
          else dudas(r, t, modo);
        }, function () { if (listo) return; listo = true; clearTimeout(tope); dudas(r, t, modo); });
        return;
      }
      dudas(r, t, modo);
    }

    function dudas(r, t, modo) {
      var id = nuevoId();
      var b = (r.candidatos || []).filter(function (c) { return c.puntaje >= 0.18; }).map(function (c) { return { texto: c.tema.titulo, tema: c.tema }; });
      var txt = r.tipo === 'fuera' && !b.length
        ? 'Solo te puedo ayudar con la app. Pregúntame por tu cuenta, tus documentos, tus pagos o tus trámites.'
        : (r.tipo === 'fuera' ? 'Solo te puedo ayudar con la app. ¿Quisiste decir…?' : '¿Quisiste decir…?');
      b.push({ texto: 'Hablar con soporte', icono: 'salvavidas', soporte: true, hacer: function () { soporte(t); }, lleva: true });
      decir({ quien: 'as', texto: txt, botones: b, pregunta: t, idPregunta: id, voto: true });
      encolar({ id: id, app: CFG.app, vista: vista, fecha: new Date().toISOString(), pregunta: t.slice(0, 200), resolucion: 'SIN RESPUESTA', tema: '', voto: '' });
      if (modo === 'voz' && !silencio()) hablar(txt.replace('¿Quisiste decir…?', '¿Quisiste decir alguno de estos temas?'));
    }

    function responderTema(tema, pregunta, modo, resolucion) {
      if (modo === 'boton' && pregunta !== tema.titulo) decir({ quien: 'yo', texto: pregunta });
      else if (modo === 'boton') decir({ quien: 'yo', texto: tema.titulo });
      var txt = llenar(tema.respuesta);
      var bs = botonesDe(tema, pregunta);
      if (bs.extra) txt = (txt ? txt + '\n\n' : '') + llenar(bs.extra);
      var id = nuevoId();
      decir({ quien: 'as', texto: txt, botones: bs.botones, tema: tema.id, idPregunta: id, voto: true, pregunta: pregunta, resolucion: modo === 'boton' ? 'LOCAL' : (resolucion || 'LOCAL') });
      if (modo !== 'boton') {
        encolar({ id: id, app: CFG.app, vista: vista, fecha: new Date().toISOString(), pregunta: String(pregunta).slice(0, 200), resolucion: resolucion || 'LOCAL', tema: tema.id, voto: '' });
      }
      if (modo === 'voz' && !silencio()) hablar(txt);
    }

    function soporte(pregunta) {
      var ac = null;
      try { ac = ad().accion ? ad().accion('soporte') : null; } catch (e) { ac = null; }
      if (ac && ac.hacer) { cerrar(); ac.hacer(pregunta); }
    }

    /** Añade un mensaje a la conversación y lo pinta. */
    function decir(m) {
      CHAT.push(m);
      if (CHAT.length > 60) CHAT = CHAT.slice(-60);
      pintar(m, true);
    }

    function pintar(m, nuevo) {
      var el;
      if (m.quien === 'yo') {
        el = K.nodo('<div class="kit-as__m kit-as__m--yo"><p></p></div>');
        el.querySelector('p').textContent = m.texto;
      } else {
        el = K.nodo('<div class="kit-as__m kit-as__m--as' + (m.clase ? ' kit-as__m--' + m.clase : '') + '">' +
          (m.clase === 'urgente' ? '<span class="kit-as__marca">' + K.icono('aviso', 15) + ' Lo más urgente</span>' : '') +
          (m.clase === 'guia' && m.titulo ? '<span class="kit-as__marca">' + K.icono('bombilla', 15) + ' ' + K.esc(m.titulo) + '</span>' : '') +
          '<p>' + rico(m.texto) + '</p></div>');
        if (m.medidas && m.medidas.length) {
          var md = K.nodo('<div class="kit-as__medidas"></div>');
          m.medidas.forEach(function (x) { md.appendChild(K.nodo('<span><b>' + K.esc(x.v) + '</b>' + K.esc(x.t) + '</span>')); });
          el.appendChild(md);
        }
        if ((m.botones || []).length) {
          var bs = K.nodo('<div class="kit-as__acc"></div>');
          m.botones.forEach(function (b) {
            var bt = K.nodo('<button type="button" class="kit-btn ' + (b.tema ? 'kit-as__op' : (b.soporte ? 'kit-as__sop' : 'kit-btn--marca kit-as__ir')) + '">' +
              (b.icono ? K.icono(b.icono, 16) : '') + '<span></span></button>');
            bt.querySelector('span').textContent = b.texto;
            bt.addEventListener('click', function () {
              K.vibrar(8);
              if (b.tema) { responderTema(b.tema, b.texto, 'boton'); return; }
              if (b.lleva) cerrar();
              try { b.hacer(); } catch (e) { K.aviso('No pude llevarte ahí. Búscalo en el inicio.', 'aviso', 4000); }
            });
            bs.appendChild(bt);
          });
          el.appendChild(bs);
        }
        var her = K.nodo('<div class="kit-as__her"></div>');
        var hab = K.nodo('<button type="button" class="kit-as__hab" aria-label="Escuchar">' + K.icono('altavoz', 15) + '</button>');
        hab.addEventListener('click', function () {
          if (sonando()) { callar(); return; }
          hablar(m.texto);
        });
        her.appendChild(hab);
        if (m.voto) {
          var t = K.nodo('<span class="kit-as__voto"><span>¿Te sirvió?</span>' +
            '<button type="button" data-v="SI" aria-label="Sí me sirvió">' + K.icono('pulgar-arriba', 15) + '</button>' +
            '<button type="button" data-v="NO" aria-label="No me sirvió">' + K.icono('pulgar-abajo', 15) + '</button></span>');
          t.querySelectorAll('button').forEach(function (b) {
            if (m.votado === b.getAttribute('data-v')) b.classList.add('kit-as__voto--on');
            b.addEventListener('click', function () {
              var v = b.getAttribute('data-v');
              m.votado = v;
              t.querySelectorAll('button').forEach(function (x) { x.classList.toggle('kit-as__voto--on', x === b); });
              encolar({ id: m.idPregunta, app: CFG.app, vista: vista, fecha: new Date().toISOString(),
                pregunta: String(m.pregunta || '').slice(0, 200), resolucion: m.resolucion || (m.tema ? 'LOCAL' : 'SIN RESPUESTA'), tema: m.tema || '', voto: v === 'SI' ? '👍' : '👎' });
              if (v === 'NO') {
                decir({ quien: 'as', texto: 'Gracias, lo voy a aprender. Si quieres, cuéntaselo a soporte.',
                  botones: [{ texto: 'Hablar con soporte', icono: 'salvavidas', soporte: true, lleva: true, hacer: function () { soporte(m.pregunta || ''); } }] });
              } else K.aviso('Gracias.', 'ok', 1500);
            });
          });
          her.appendChild(t);
        }
        el.appendChild(her);
      }
      chat.appendChild(el);
      if (nuevo) {
        el.classList.add('kit-as__m--nuevo');
        requestAnimationFrame(function () { chat.scrollTop = chat.scrollHeight; });
      }
    }

    function pintarVozAbierta() {
      hoja.querySelectorAll('.kit-as__hab').forEach(function (b) { b.classList.toggle('kit-as__hab--on', sonando()); });
    }
    alCambiarVoz = pintarVozAbierta;

    requestAnimationFrame(function () { chat.scrollTop = chat.scrollHeight; });
    if (!opciones.sinFoco && window.matchMedia && window.matchMedia('(hover: hover)').matches) setTimeout(function () { inp.focus(); }, 120);
    MEDIDAS.push({ que: 'abrir', ms: Date.now() - t0 });
    /* entrega 2 · el SDK de Gemini y el token de App Check se preparan mientras la persona escribe */
    if (CFG.precalentar && !entrada) setTimeout(function () { try { CFG.precalentar(); } catch (e) {} }, 600);
    return abierto;
  }

  /** Lo que la vista trae en cifras (Insights): pasan como tarjetas en la guía. */
  function medidasDe(c) {
    var out = [];
    try {
      var filas = typeof c.filas === 'function' ? (c.filas() || []) : [];
      (c.medidas || []).forEach(function (m) {
        if (m.reparto) return;
        var v; try { v = m.calcula(filas); } catch (e) { v = null; }
        if (v === null || v === undefined || v === '') return;
        out.push({ v: String(v), t: m.titulo || '' });
      });
    } catch (e) {}
    return out;
  }

  /** Las preguntas frecuentes de la vista: hasta 4, por orden de la base. */
  function frecuentes(vista) {
    var o = { estado: estadoAhora(), entrada: !!entrada };
    var l = TEMAS.filter(function (t) { return aplica(t, o) && t.vistas.indexOf(vista) >= 0; });
    if (!entrada && o.estado === 'TERMINADO') {
      var t1 = TEMAS.filter(function (t) { return t.estado === 'TERMINADO'; });
      l = t1.concat(l.filter(function (t) { return t1.indexOf(t) < 0; }));
    }
    l.sort(function (a, b) { return (a.estado ? -1 : 0) - (b.estado ? -1 : 0) || a.orden - b.orden; });
    return l.slice(0, 4);
  }

  /* ══════════════ la llamada de atención (una vez por día) ══════════════ */

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function llamar(fab) {
    if (!fab || !fab.isConnected || fab.hidden) return false;
    if (K.guardar.leer(LLAMADA_K, '') === hoy()) return false;
    K.guardar.escribir(LLAMADA_K, hoy());
    var r = fab.getBoundingClientRect();
    var izquierda = r.left > window.innerWidth / 2;
    var g = K.nodo('<div class="kit-as-llama' + (izquierda ? ' kit-as-llama--izq' : '') + '" role="status">¡Te ayudo ahora!</div>');
    g.style.top = Math.max(8, r.top + r.height / 2 - 20) + 'px';
    if (izquierda) g.style.right = Math.max(8, window.innerWidth - r.left + 10) + 'px';
    else g.style.left = (r.right + 10) + 'px';
    document.body.appendChild(g);
    fab.classList.add('kit-ins__fab--llama');
    requestAnimationFrame(function () { g.classList.add('kit-as-llama--on'); });
    setTimeout(function () { g.classList.remove('kit-as-llama--on'); g.classList.add('kit-as-llama--entra'); }, 3400);
    setTimeout(function () { fab.classList.remove('kit-ins__fab--llama'); if (g.parentNode) g.remove(); }, 4100);
    return true;
  }

  /* ══════════════ la pantalla de entrada ══════════════ */

  /** Prende el asistente en la entrada (sin sesión ni estado). */
  function enEntrada(adaptador) {
    entrada = { adaptador: adaptador || {} };
    CHAT = []; ultimaGuia = ''; ultimoUrgente = '';
    var ins = K.piezas.insights;
    if (!ins) return null;
    var fab = ins.montar({ vista: 'Entrada', clave: 'entrada', guia: '', botones: [] });
    if (fab) fab.classList.add('kit-ins__fab--entrada');
    setTimeout(function () { llamar(fab); }, 1600);
    return fab;
  }

  /** Sale de la entrada: la conversación de la entrada no pasa a la app. */
  function salirEntrada() {
    if (!entrada) return;
    entrada = null;
    CHAT = []; ultimaGuia = ''; ultimoUrgente = '';
    if (abierto) abierto.cerrar();
    var ins = K.piezas.insights;
    if (ins && ins.ocultar) ins.ocultar();
    try { var f = document.querySelector('.kit-ins__fab'); if (f) f.classList.remove('kit-ins__fab--entrada'); } catch (e) {}
  }

  K.piezas.asistente = {
    configurar: configurar,
    base: base,
    selloGuardado: selloGuardado,
    sello: function () { return SELLO; },
    abrir: abrir,
    buscar: buscar,
    motor: motor,
    fichas: fichas,
    listo: function () { return TEMAS.length > 0; },
    temas: function () { return TEMAS.slice(); },
    frecuentes: frecuentes,
    llamar: llamar,
    enEntrada: enEntrada,
    salirEntrada: salirEntrada,
    enEntradaAhora: function () { return !!entrada; },
    hablar: hablar,
    callar: callar,
    enviar: function () { programarEnvio(0); },
    olvidar: function () { CHAT = []; ultimaGuia = ''; ultimoUrgente = ''; },
    puedeDictar: puedeDictar,
    _medidas: function () { return MEDIDAS.slice(); },
    _chat: function () { return CHAT.slice(); }
  };
}());
