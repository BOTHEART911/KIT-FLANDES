/* ============================================================
   KIT-FLANDES · PIEZA 1 · BANNER SUPERIOR
   Foto de perfil, título de la vista y botón atrás.

   Por qué existe
     El plan pide quitar los botones "regresar" sueltos de cada vista y
     dejar UNA sola barra arriba que siempre dice dónde estás y cómo
     salir. El botón atrás aparece solo cuando hay a dónde volver.

   Cómo se usa

     KIT.piezas.banner.montar({
       titulo: 'Contratación',
       foto:   'https://.../yo.jpg',      // opcional; si falta, iniciales
       nombre: 'OSCAR POLANIA',           // para las iniciales y el menú
       rol:    'CREADOR',
       menu: [                            // opcional
         { texto: 'Mi perfil',  al: abrirPerfil },
         { texto: 'Soporte',    al: function(){ KIT.piezas.soporte.abrir(); } },
         { texto: 'Cerrar sesión', al: salir, peligro: true }
       ]
     });

     KIT.piezas.banner.vista('Cuentas por revisar');   // cambia el título
     KIT.piezas.banner.atras(function(){ irA('inicio'); });  // enciende el atrás
     KIT.piezas.banner.atras(null);                    // lo apaga

   Qué NO hace
     No navega. Llama a la función que le des y ya: la app sigue siendo
     la dueña de sus vistas.

   Pareja: kit/banner.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/banner] falta kit.js'); } catch (e) {} return; }

  var barra = null;
  var alAtras = null;
  var cfg = {};

  function iniciales(nombre) {
    /* 4.9 · las mismas iniciales que la cara del inicio y las demás caras
       (nombre + primer apellido): antes aquí salía OM y abajo OP */
    if (K.piezas.personas) return K.piezas.personas.iniciales(nombre);
    var p = K.norm(nombre).split(/\s+/).filter(Boolean);
    if (!p.length) return '··';
    if (p.length === 1) return p[0].slice(0, 2);
    return p[0].charAt(0) + p[1].charAt(0);
  }

  function pintarFoto() {
    var hueco = barra.querySelector('.kit-banner__foto');
    if (!hueco) return;
    hueco.innerHTML = '';
    if (cfg.foto) {
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      /* si la foto no carga (enlace de Drive caducado, por ejemplo)
         se cae con elegancia a las iniciales, no a un icono roto */
      img.onerror = function () { hueco.innerHTML = '<span>' + K.esc(iniciales(cfg.nombre)) + '</span>'; };
      img.src = cfg.foto;
      hueco.appendChild(img);
    } else {
      hueco.innerHTML = '<span>' + K.esc(iniciales(cfg.nombre)) + '</span>';
    }
  }

  function cerrarMenu() {
    var m = barra && barra.querySelector('.kit-banner__menu');
    if (m) m.classList.remove('kit-banner__menu--on');
    var b = barra && barra.querySelector('.kit-banner__perfil');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function alternarMenu() {
    var m = barra.querySelector('.kit-banner__menu');
    if (!m) return;
    var abierto = m.classList.toggle('kit-banner__menu--on');
    barra.querySelector('.kit-banner__perfil').setAttribute('aria-expanded', abierto ? 'true' : 'false');
    K.vibrar(6);
  }

  function pintarMenu() {
    var m = barra.querySelector('.kit-banner__menu');
    if (!m) return;
    m.innerHTML = '';
    (cfg.menu || []).forEach(function (it) {
      var b = K.nodo('<button type="button" class="kit-banner__mi' +
        (it.peligro ? ' kit-banner__mi--peligro' : '') + '">' + K.esc(it.texto) + '</button>');
      b.addEventListener('click', function () {
        cerrarMenu();
        if (typeof it.al === 'function') it.al();
      });
      m.appendChild(b);
    });
    if (cfg.nombre) {
      var cab = K.nodo('<div class="kit-banner__quien"><b>' + K.esc(cfg.nombre) + '</b>' +
        (cfg.rol ? '<span>' + K.esc(cfg.rol) + '</span>' : '') + '</div>');
      m.insertBefore(cab, m.firstChild);
    }
  }

  function montar(opciones) {
    cfg = opciones || {};

    if (!barra) {
      barra = K.nodo(
        '<header class="kit-banner" role="banner">' +
        '  <button type="button" class="kit-banner__atras" aria-label="Volver" hidden>' +
        '    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
        '      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '    </svg>' +
        '  </button>' +
        '  <h1 class="kit-banner__titulo"></h1>' +
        '  <div class="kit-banner__dcha">' +
        '    <button type="button" class="kit-banner__tema" aria-label="Cambiar tema"></button>' +
        '    <button type="button" class="kit-banner__perfil" aria-haspopup="true" aria-expanded="false" aria-label="Mi cuenta">' +
        '      <span class="kit-banner__foto"></span>' +
        '    </button>' +
        '    <nav class="kit-banner__menu"></nav>' +
        '  </div>' +
        '</header>'
      );
      document.body.insertBefore(barra, document.body.firstChild);
      document.documentElement.classList.add('kit-con-banner');

      barra.querySelector('.kit-banner__atras').addEventListener('click', function () {
        K.vibrar(8);
        if (typeof alAtras === 'function') alAtras();
      });
      barra.querySelector('.kit-banner__perfil').addEventListener('click', function (e) {
        e.stopPropagation();
        alternarMenu();
      });
      barra.querySelector('.kit-banner__tema').addEventListener('click', function () {
        K.alternarTema();
        pintarTema();
      });
      document.addEventListener('click', cerrarMenu);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });

      /* AQUÍ HABÍA UN FALLO, quitado el 21/09/2026.
         El banner escuchaba `popstate` y ejecutaba el "atrás" de la vista,
         con la idea de que el botón físico del teléfono hiciera lo mismo
         que el de la barra. Pero las siete apps navegan por hash, y en
         Chromium asignar `location.hash` dispara también `popstate`: cada
         vez que la app entraba a una vista, el banner la devolvía a la
         anterior en el mismo instante. Desde fuera se veía como que las
         vistas "no abren".
         No hace falta reemplazarlo: el botón físico de atrás retrocede en
         el historial, eso cambia el hash, y la app ya enruta con
         `hashchange`. Si algún día se quiere volver a enganchar el
         historial, hay que hacerlo con pushState y una pila propia, no
         atando popstate a una acción de pantalla. */
    }

    vista(cfg.titulo || '');
    pintarFoto();
    pintarMenu();
    pintarTema();
    if (!cfg.menu || !cfg.menu.length) barra.querySelector('.kit-banner__perfil').hidden = !cfg.foto && !cfg.nombre;
    return barra;
  }

  function pintarTema() {
    var b = barra && barra.querySelector('.kit-banner__tema');
    if (!b) return;
    var oscuro = K.temaActual() === 'oscuro';
    b.innerHTML = K.icono(oscuro ? 'sol' : 'luna', 18);
    b.setAttribute('title', oscuro ? 'Modo claro' : 'Modo oscuro');
  }

  function vista(titulo) {
    if (!barra) return;
    barra.querySelector('.kit-banner__titulo').textContent = String(titulo || '');
    document.title = (titulo ? titulo + ' · ' : '') + (cfg.titulo || K.app || 'Flandes');
  }

  /** atras(fn) enciende el botón; atras(null) lo apaga. */
  function atras(fn) {
    alAtras = (typeof fn === 'function') ? fn : null;
    if (!barra) return;
    barra.querySelector('.kit-banner__atras').hidden = !alAtras;
  }

  function perfil(datos) {
    datos = datos || {};
    if (datos.foto !== undefined) cfg.foto = datos.foto;
    if (datos.nombre !== undefined) cfg.nombre = datos.nombre;
    if (datos.rol !== undefined) cfg.rol = datos.rol;
    if (barra) { pintarFoto(); pintarMenu(); }
  }

  K.piezas.banner = {
    montar: montar, vista: vista, atras: atras, perfil: perfil,
    elemento: function () { return barra; }
  };

  /* El tema puede cambiarlo otra pieza; el icono se mantiene al día. */
  K.cuando('kit:tema', pintarTema);
}());
