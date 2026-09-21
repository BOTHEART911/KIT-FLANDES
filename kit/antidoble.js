/* ============================================================
   KIT-FLANDES · CAPA 12 · ANTI DOBLE CLIC
   Ya probada en las 6 apps de Jhonny; aquí queda como pieza del kit.

   El problema real
     El contratista toca "Reportar cuenta", no ve respuesta inmediata y
     vuelve a tocar. Se radican dos cuentas. Con Apps Script, que tarda
     segundos, pasa a diario.

   Dos candados, como en las otras apps

     1) CANDADO DEL CONTROL — el botón se bloquea mientras su acción
        está en el aire, y se suelta pase lo que pase.
     2) ESCUDO DE PANTALLA — una capa invisible sobre todo, para que no
        se pueda tocar OTRA cosa mientras se guarda. Sin esto, el usuario
        toca "Reportar" y acto seguido "Atrás", y deja el guardado a medias.

   Cómo se usa

     // envuelve la función de guardar
     boton.addEventListener('click', KIT.piezas.antidoble.una(function () {
       return KIT.pedir('cuentaGuardar', datos);   // devuelve la promesa
     }));

     // o marca el botón y se encarga sola
     <button data-kit-una-vez>Reportar cuenta</button>
     KIT.piezas.antidoble.montar();

     // escudo a mano
     var fin = KIT.piezas.antidoble.escudo();  ...  fin();

   Regla que no se negocia
     El candado se suelta SIEMPRE, también cuando la promesa falla. Un
     botón que se queda muerto tras un error obliga a recargar la app, y
     eso es peor que el doble clic.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/antidoble] falta kit.js'); } catch (e) {} return; }

  var escudos = 0;
  var capaEscudo = null;

  function escudo() {
    escudos++;
    if (!capaEscudo) {
      capaEscudo = K.nodo('<div class="kit-escudo" aria-hidden="true"></div>');
      document.body.appendChild(capaEscudo);
    }
    capaEscudo.classList.add('kit-escudo--on');
    var soltado = false;
    return function soltar() {
      if (soltado) return;               /* soltar dos veces no debe abrir el escudo antes de tiempo */
      soltado = true;
      escudos = Math.max(0, escudos - 1);
      if (!escudos && capaEscudo) capaEscudo.classList.remove('kit-escudo--on');
    };
  }

  /**
   * una(fn) → función que solo corre una vez a la vez.
   * Si fn devuelve una promesa, el candado dura hasta que se resuelva.
   */
  function una(fn, opciones) {
    opciones = opciones || {};
    var corriendo = false;

    return function () {
      if (corriendo) return;
      var control = this && this.nodeType === 1 ? this : null;
      corriendo = true;

      var soltarEscudo = opciones.sinEscudo ? function () {} : escudo();
      var textoAntes = null;

      if (control) {
        control.disabled = true;
        control.setAttribute('aria-busy', 'true');
        control.classList.add('kit-ocupado');
        if (opciones.texto) { textoAntes = control.textContent; control.textContent = opciones.texto; }
      }

      function soltar() {
        corriendo = false;
        soltarEscudo();
        if (control) {
          control.disabled = false;
          control.removeAttribute('aria-busy');
          control.classList.remove('kit-ocupado');
          if (textoAntes !== null) control.textContent = textoAntes;
        }
      }

      var r;
      try {
        r = fn.apply(this, arguments);
      } catch (e) {
        soltar();
        throw e;
      }

      if (r && typeof r.then === 'function') {
        return r.then(
          function (v) { soltar(); return v; },
          function (e) { soltar(); throw e; }
        );
      }
      /* sin promesa: se suelta al terminar el turno, que basta para
         frenar el doble toque rápido */
      setTimeout(soltar, opciones.ms || 600);
      return r;
    };
  }

  /** Marca [data-kit-una-vez] en el HTML y esto hace el resto. */
  function montar(ambito) {
    var raiz = ambito ? (typeof ambito === 'string' ? K.$(ambito) : ambito) : document;
    if (!raiz) return 0;
    var n = 0;
    K.$$('[data-kit-una-vez]', raiz).forEach(function (el) {
      if (el.__kitUnaVez) return;
      el.__kitUnaVez = true;
      n++;
      el.addEventListener('click', function (e) {
        if (el.__kitOcupado) { e.stopImmediatePropagation(); e.preventDefault(); return; }
        el.__kitOcupado = true;
        var soltar = escudo();
        el.disabled = true;
        el.classList.add('kit-ocupado');
        var ms = +(el.dataset.kitUnaVez || 0) || 900;
        setTimeout(function () {
          el.__kitOcupado = false;
          el.disabled = false;
          el.classList.remove('kit-ocupado');
          soltar();
        }, ms);
      }, true);
    });
    return n;
  }

  K.piezas.antidoble = {
    una: una, escudo: escudo, montar: montar,
    ocupado: function () { return escudos > 0; }
  };
}());
