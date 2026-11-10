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

  function parar() { if (rec) { try { rec.stop(); } catch (e) {} } }
  function escuchando() { return !!rec; }

  K.piezas.voz = { hay: hay, escuchar: escuchar, parar: parar, escuchando: escuchando };
}());
