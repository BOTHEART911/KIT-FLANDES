/* ============================================================
   KIT-FLANDES · PIEZA 37 · DICTADO (10/11/2026)
   Qué hace
     El dictado por voz del teléfono (Web Speech, es-CO), en una pieza
     que pueden usar todas las vistas. Lo usa «Redactemos una actividad
     juntos» (kit/redactemos.js). El asistente (kit/asistente.js) sigue
     con el suyo, que es el mismo método.
     Sin viajes al servidor: el reconocimiento lo hace el navegador.
   Cómo se usa
     K.piezas.voz.hay()                       -> true | false
     K.piezas.voz.escuchar({ alParcial: fn }) -> Promise<texto>
        rechaza con Error('SIN_VOZ' | 'BLOQUEADO' | 'NADA' | 'ERROR')
     K.piezas.voz.parar()                     -> termina y entrega lo oído
   Firefox y algunos iPhone no traen reconocimiento: hay() da false y la
   vista se queda con el campo de texto, sin errores.
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;
  K.piezas = K.piezas || {};

  function Reconocedor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  var rec = null;

  function hay() { return !!Reconocedor(); }

  function escuchar(o) {
    o = o || {};
    var R = Reconocedor();
    if (!R) return Promise.reject(new Error('SIN_VOZ'));
    parar();
    return new Promise(function (ok, no) {
      var final = '', parcial = '', fallo = '';
      try {
        rec = new R();
        rec.lang = o.lang || 'es-CO';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.continuous = !!o.continuo;
      } catch (e) { rec = null; no(new Error('ERROR')); return; }
      var este = rec;
      este.onresult = function (ev) {
        parcial = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) final += ' ' + ev.results[i][0].transcript;
          else parcial += ev.results[i][0].transcript;
        }
        if (o.alParcial) { try { o.alParcial((final + ' ' + parcial).replace(/\s+/g, ' ').trim()); } catch (e) {} }
      };
      este.onerror = function (ev) {
        var c = ev && ev.error;
        fallo = (c === 'not-allowed' || c === 'service-not-allowed') ? 'BLOQUEADO' : (c === 'no-speech' ? 'NADA' : 'ERROR');
      };
      este.onend = function () {
        if (rec === este) rec = null;
        var t = (final + ' ' + parcial).replace(/\s+/g, ' ').trim();
        if (t) ok(t);
        else no(new Error(fallo || 'NADA'));
      };
      try { este.start(); K.vibrar && K.vibrar(10); } catch (e) { rec = null; no(new Error('ERROR')); }
    });
  }

  /**
   * 10/11 · DICTADO LARGO: no se corta porque la persona hace una pausa.
   * El navegador termina el reconocimiento tras unos segundos de silencio; aquí
   * se vuelve a encender solo, sumando lo dicho, hasta que la persona toque
   * parar (o pasen 3 minutos). Nunca envía nada: solo va escribiendo.
   *   K.piezas.voz.dictar({ alTexto: fn(textoTotal), alFin: fn(textoTotal, error) })
   *   -> { parar: fn }
   */
  var dictado = null;
  function dictar(o) {
    o = o || {};
    var R = Reconocedor();
    if (!R) { if (o.alFin) o.alFin('', 'SIN_VOZ'); return { parar: function () {} }; }
    parar();
    var d = { vivo: true, acumulado: '', t0: Date.now(), error: '' };
    dictado = d;
    function total(parcial) { return (d.acumulado + ' ' + (parcial || '')).replace(/\s+/g, ' ').trim(); }
    function encender() {
      if (!d.vivo) return;
      var r;
      try { r = new R(); r.lang = o.lang || 'es-CO'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = true; }
      catch (e) { terminar('ERROR'); return; }
      rec = r;
      r.onresult = function (ev) {
        var parcial = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) d.acumulado = total(ev.results[i][0].transcript);
          else parcial += ev.results[i][0].transcript;
        }
        if (o.alTexto) { try { o.alTexto(total(parcial)); } catch (e) {} }
      };
      r.onerror = function (ev) {
        var c = ev && ev.error;
        if (c === 'not-allowed' || c === 'service-not-allowed') { d.error = 'BLOQUEADO'; d.vivo = false; }
        else if (c === 'audio-capture') { d.error = 'ERROR'; d.vivo = false; }
        /* no-speech, network, aborted: se vuelve a encender en onend */
      };
      r.onend = function () {
        if (rec === r) rec = null;
        if (d.vivo && Date.now() - d.t0 < 180000) { setTimeout(encender, 120); return; }   /* fue una pausa: sigue escuchando */
        terminar(d.error);
      };
      try { r.start(); } catch (e) { setTimeout(encender, 300); }
    }
    function terminar(err) {
      if (dictado === d) dictado = null;
      d.vivo = false;
      if (o.alFin) { try { o.alFin(total(''), err || (total('') ? '' : 'NADA')); } catch (e) {} o.alFin = null; }
    }
    d.terminar = terminar;
    K.vibrar && K.vibrar(10);
    encender();
    return { parar: function () { d.vivo = false; if (rec) { try { rec.stop(); } catch (e) { terminar(''); } } else terminar(''); } };
  }

  function parar() {
    var d = dictado;
    if (d) d.vivo = false;
    if (rec) { try { rec.stop(); } catch (e) { if (d && d.terminar) d.terminar(''); } }
    else if (d && d.terminar) d.terminar('');   /* estaba entre una pausa y la siguiente escucha */
  }
  function escuchando() { return !!rec || !!(dictado && dictado.vivo); }

  K.piezas.voz = { hay: hay, escuchar: escuchar, dictar: dictar, parar: parar, escuchando: escuchando };
}());
