/* ============================================================
   KIT-FLANDES · PIEZA 3 · ESQUELETOS DE CARGA
   Se acabó el loader de pantalla completa.

   Por qué
     El plan lo dice sin rodeos: fuera el loader iOS en todas las vistas,
     solo esqueletos. Un loader tapa la app y hace que cada espera parezca
     un bloqueo; el esqueleto deja ver la forma de lo que viene y se siente
     la mitad de largo.

   Cómo se usa

     var fin = KIT.piezas.esqueletos.poner('#lista', {forma:'tarjetas', cuantos:6});
     ... pinto los datos ...
     fin();                       // los quita

     // o atado a una promesa, que es lo normal:
     KIT.piezas.esqueletos.mientras('#lista', cargar(), {forma:'filas'});

   Formas
     'tarjetas'  bloques con foto, dos líneas y una pastilla
     'filas'     lista de renglones
     'tabla'     cabecera y filas
     'texto'     párrafos
     'ficha'     una tarjeta grande de detalle

   Reglas que se respetan
     · Si la respuesta llega en menos de 180 ms no se pinta nada: el
       parpadeo molesta más que la espera.
     · El esqueleto nunca se queda colgado: si la promesa falla, igual se
       retira y se avisa.

   Pareja: kit/esqueletos.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/esqueletos] falta kit.js'); } catch (e) {} return; }

  var ANTES_DE_PINTAR = 180;   /* ms */
  var MINIMO_EN_PANTALLA = 320; /* ms, para que no dé un tirón */

  var FORMAS = {
    tarjetas: function () {
      return '<div class="kit-esq__tarjeta">' +
             '  <div class="kit-esq__bloque kit-esq__bloque--foto"></div>' +
             '  <div class="kit-esq__lineas">' +
             '    <div class="kit-esq__bloque" style="width:72%"></div>' +
             '    <div class="kit-esq__bloque" style="width:46%"></div>' +
             '    <div class="kit-esq__bloque kit-esq__bloque--pastilla"></div>' +
             '  </div>' +
             '</div>';
    },
    filas: function () {
      return '<div class="kit-esq__fila">' +
             '  <div class="kit-esq__bloque kit-esq__bloque--punto"></div>' +
             '  <div class="kit-esq__bloque" style="width:58%"></div>' +
             '  <div class="kit-esq__bloque kit-esq__bloque--corto"></div>' +
             '</div>';
    },
    tabla: function () {
      return '<div class="kit-esq__tr">' +
             '  <div class="kit-esq__bloque" style="width:22%"></div>' +
             '  <div class="kit-esq__bloque" style="width:34%"></div>' +
             '  <div class="kit-esq__bloque" style="width:18%"></div>' +
             '  <div class="kit-esq__bloque" style="width:14%"></div>' +
             '</div>';
    },
    texto: function () {
      return '<div class="kit-esq__parrafo">' +
             '  <div class="kit-esq__bloque" style="width:96%"></div>' +
             '  <div class="kit-esq__bloque" style="width:88%"></div>' +
             '  <div class="kit-esq__bloque" style="width:64%"></div>' +
             '</div>';
    },
    ficha: function () {
      return '<div class="kit-esq__ficha">' +
             '  <div class="kit-esq__bloque kit-esq__bloque--cabecera"></div>' +
             '  <div class="kit-esq__bloque" style="width:80%"></div>' +
             '  <div class="kit-esq__bloque" style="width:66%"></div>' +
             '  <div class="kit-esq__bloque" style="width:90%"></div>' +
             '  <div class="kit-esq__bloque" style="width:40%"></div>' +
             '</div>';
    }
  };

  function contenedor(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return K.$(ref);
    return ref.nodeType === 1 ? ref : null;
  }

  /**
   * poner(destino, {forma, cuantos, sitio})
   * Devuelve una función que los quita. Llamarla siempre, también al fallar.
   */
  function poner(destino, opciones) {
    opciones = opciones || {};
    var caja = contenedor(destino);
    if (!caja) return function () {};

    var forma = FORMAS[opciones.forma] ? opciones.forma : 'tarjetas';
    var cuantos = Math.max(1, Math.min(opciones.cuantos || 5, 24));
    var capa = null;
    var puesto = 0;
    var muerto = false;

    var reloj = setTimeout(function () {
      if (muerto) return;
      capa = document.createElement('div');
      capa.className = 'kit-esq kit-esq--' + forma;
      capa.setAttribute('aria-hidden', 'true');
      var html = '', i;
      for (i = 0; i < cuantos; i++) html += FORMAS[forma]();
      capa.innerHTML = html;

      if (opciones.sitio === 'antes') caja.insertBefore(capa, caja.firstChild);
      else if (opciones.sitio === 'reemplaza') { caja.innerHTML = ''; caja.appendChild(capa); }
      else caja.appendChild(capa);

      /* que el lector de pantalla sepa que se está cargando */
      caja.setAttribute('aria-busy', 'true');
      puesto = Date.now();
    }, ANTES_DE_PINTAR);

    return function quitar() {
      muerto = true;
      clearTimeout(reloj);
      if (!capa) { caja.removeAttribute('aria-busy'); return; }
      var falta = MINIMO_EN_PANTALLA - (Date.now() - puesto);
      var adios = function () {
        if (capa && capa.parentNode) {
          capa.classList.add('kit-esq--fuera');
          setTimeout(function () { if (capa && capa.parentNode) capa.remove(); }, 180);
        }
        caja.removeAttribute('aria-busy');
      };
      if (falta > 0) setTimeout(adios, falta); else adios();
    };
  }

  /** mientras(destino, promesa, opciones) → la misma promesa, ya vigilada. */
  function mientras(destino, promesa, opciones) {
    var quitar = poner(destino, opciones);
    return Promise.resolve(promesa).then(
      function (v) { quitar(); return v; },
      function (e) { quitar(); throw e; }
    );
  }

  K.piezas.esqueletos = { poner: poner, mientras: mientras, formas: Object.keys(FORMAS) };
}());
