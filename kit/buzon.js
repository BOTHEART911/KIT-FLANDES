/* ============================================================
   KIT-FLANDES · PIEZA 22 · BUZÓN DE AVISOS ("Mis notificaciones")

   Por qué existe
     El push se pierde. Llega al teléfono, la persona está ocupada, lo
     desliza, y ese aviso ya no existe en ninguna parte. Si decía "tu cuenta
     fue devuelta", se entera cuando pasa el mes. Esta pieza es el sitio
     donde los avisos quedan y se vuelven a leer.

   De dónde sale el patrón
     De "Ponte al día" de JHONNY-PERDOMO, que ya resolvió esto bien:
       · la marca de leído es un timestamp, no un campo por elemento;
       · el contador se calcula con lo que ya vino en la llamada del inicio,
         sin una segunda consulta;
       · lo nuevo se distingue con borde de color y una pastilla, no con un
         tono de fondo que en modo oscuro no se ve;
       · la fecha se dice dos veces: la exacta y la relativa, y la relativa
         se calla pasados 30 días para no decir "hace 400 días".

   Qué se hace distinto
     Allí el leído vivía solo en el aparato (localStorage), así que quien
     entraba desde el computador volvía a ver todo como nuevo. Aquí el CORE
     guarda la marca, y el aparato solo la refleja.

   Cómo se usa

     KIT.piezas.buzon.montar('#zona', {
       pedir:   function () { return KIT.pedir('misAvisos'); },
       marcar:  function (ids) { return KIT.pedir('avisoLeido', {ids: ids}); },
       alContar: function (n) { ... },       // para pintar la burbuja
       alTocar: function (aviso) { ... }     // opcional: ir a la vista
     });

     KIT.piezas.buzon.noLeidos()   lo último que se supo

   Pareja: kit/buzon.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/buzon] falta kit.js'); } catch (e) {} return; }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* Se marca leído con un respiro, no al instante: si se marcara al pintar,
     la pastilla "Nuevo" desaparecería antes de que diera tiempo a verla y
     nadie entendería qué cambió. */
  var ESPERA_MARCAR = 1500;

  var ultimoConteo = 0;

  /* 4.7 · EL CONTADOR SE ENTERA DE QUE YA LEISTE.
     Antes el número solo se guardaba aquí dentro: la burbuja del
     inicio se pintaba con lo que trajo el arranque y no volvía a
     mirar, así que seguía en 1 después de leer el comunicado. Ahora
     cada cambio se anuncia con el evento 'kit:buzon' y quien pinte
     una burbuja se entera sin pedir nada al servidor. */
  function contar(n) {
    n = Math.max(0, Number(n) || 0);
    var cambio = n !== ultimoConteo;
    ultimoConteo = n;
    if (cambio) K.disparar('kit:buzon', { noLeidos: n });
  }

  /* ── fechas ── */

  function fechaLarga(aviso) {
    var d = deFecha(aviso);
    if (!d) return aviso.fecha || '';
    var h = d.getHours(), ampm = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 || 12;
    var min = ('0' + d.getMinutes()).slice(-2);
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() +
           ' · ' + h12 + ':' + min + ' ' + ampm;
  }

  function deFecha(aviso) {
    if (aviso.ts) return new Date(aviso.ts);
    var m = String(aviso.fecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  }

  function relativa(aviso) {
    var d = deFecha(aviso);
    if (!d) return '';
    var seg = Math.round((Date.now() - d.getTime()) / 1000);
    if (seg < 0) return '';
    if (seg < 90) return 'ahora';
    if (seg < 3600) return 'hace ' + Math.round(seg / 60) + ' min';
    if (seg < 86400) return 'hace ' + Math.round(seg / 3600) + ' h';
    var dias = Math.round(seg / 86400);
    if (dias === 1) return 'ayer';
    if (dias <= 30) return 'hace ' + dias + ' días';
    return '';   /* pasado un mes la relativa ya no informa de nada */
  }

  /* ── pintar ── */

  function tarjeta(aviso) {
    var nuevo = !aviso.leida;
    var rel = relativa(aviso);
    return '<article class="kit-buz-tar' + (nuevo ? ' kit-buz-tar--nuevo' : '') + '"' +
           ' data-id="' + K.esc(aviso.id) + '">' +
           (nuevo ? '<span class="kit-buz-flag">Nuevo</span>' : '') +
           '<h3 class="kit-buz-t">' + K.esc(aviso.titulo || 'Aviso') + '</h3>' +
           '<p class="kit-buz-f">' + K.esc(fechaLarga(aviso)) +
             (rel ? ' <span class="kit-buz-rel">· ' + K.esc(rel) + '</span>' : '') + '</p>' +
           '<p class="kit-buz-c">' + K.esc(aviso.cuerpo || '') + '</p>' +
           (aviso.referencia
             ? '<p class="kit-buz-ref">Informe ' + K.esc(aviso.referencia) + '</p>' : '') +
           '</article>';
  }

  function vacio() {
    return '<div class="kit-buz-vacio">' +
           '  <p class="kit-buz-vacio__t">Todavía no tienes avisos</p>' +
           '  <p class="kit-buz-vacio__p">Cuando tu cuenta cambie de estado, te lo avisamos ' +
           '  al teléfono y además te lo dejamos aquí guardado.</p>' +
           '</div>';
  }

  function montar(destino, opciones) {
    opciones = opciones || {};
    var zona = typeof destino === 'string' ? K.id(destino.replace(/^#/, '')) : destino;
    if (!zona) return null;

    zona.classList.add('kit-buz');
    zona.innerHTML = '';

    var filtro = K.nodo('<div class="kit-buz-filtro"></div>');
    var cuerpo = K.nodo('<div class="kit-buz-lista"></div>');
    zona.appendChild(filtro);
    zona.appendChild(cuerpo);

    var todos = [], soloNuevos = false, marcando = null;

    function pintar() {
      var lista = soloNuevos ? todos.filter(function (a) { return !a.leida; }) : todos;
      cuerpo.innerHTML = lista.length
        ? lista.map(tarjeta).join('')
        : (soloNuevos
            ? '<div class="kit-buz-vacio"><p class="kit-buz-vacio__t">Estás al día</p>' +
              '<p class="kit-buz-vacio__p">No te queda ningún aviso sin leer.</p></div>'
            : vacio());

      if (opciones.alTocar) {
        [].forEach.call(cuerpo.querySelectorAll('.kit-buz-tar'), function (t) {
          t.addEventListener('click', function () {
            var a = buscar(t.getAttribute('data-id'));
            if (a) opciones.alTocar(a);
          });
        });
      }
    }

    function buscar(id) {
      for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
      return null;
    }

    function pintarFiltro() {
      var sinLeer = todos.filter(function (a) { return !a.leida; }).length;
      if (!todos.length) { filtro.innerHTML = ''; return; }
      filtro.innerHTML =
        '<button type="button" class="kit-pastilla" aria-pressed="' + (!soloNuevos) +
        '" data-f="todos">Todos <span class="kit-pastilla__conteo">' + todos.length + '</span></button>' +
        '<button type="button" class="kit-pastilla" aria-pressed="' + (!!soloNuevos) +
        '" data-f="nuevos">Sin leer <span class="kit-pastilla__conteo">' + sinLeer + '</span></button>';

      [].forEach.call(filtro.querySelectorAll('[data-f]'), function (b) {
        b.addEventListener('click', function () {
          soloNuevos = b.getAttribute('data-f') === 'nuevos';
          K.vibrar(6);
          pintarFiltro(); pintar();
        });
      });
    }

    function cargar() {
      return Promise.resolve(opciones.pedir()).then(function (d) {
        todos = (d && d.avisos) || [];
        contar((d && d.noLeidos) || 0);
        if (opciones.alContar) opciones.alContar(ultimoConteo);

        pintarFiltro();
        pintar();

        /* Los que se acaban de enseñar se dan por leídos, con el respiro de
           rigor. Si la llamada falla no pasa nada grave: se volverán a ver
           como nuevos y se intentará otra vez. */
        var sinLeer = todos.filter(function (a) { return !a.leida; })
                           .map(function (a) { return a.id; });
        if (sinLeer.length && opciones.marcar) {
          clearTimeout(marcando);
          marcando = setTimeout(function () {
            Promise.resolve(opciones.marcar(sinLeer)).then(function () {
              todos.forEach(function (a) { a.leida = true; });
              contar(0);
              if (opciones.alContar) opciones.alContar(0);
              pintarFiltro();
            })['catch'](function () {});
          }, ESPERA_MARCAR);
        }
        return todos;
      });
    }

    return {
      cargar: cargar,
      avisos: function () { return todos.slice(); },
      elemento: function () { return zona; }
    };
  }

  K.piezas.buzon = {
    montar: montar,
    noLeidos: function () { return ultimoConteo; },
    recordar: contar,
    relativa: relativa,
    fechaLarga: fechaLarga
  };
}());
