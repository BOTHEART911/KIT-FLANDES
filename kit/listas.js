/* ============================================================
   KIT-FLANDES · PATRÓN DE CARGA ÚNICA
   Lo que hace que BD Predial abra 9.459 filas sin volver al servidor.

   El patrón, en una línea
     Se pide TODO una vez, en formato compacto, se guarda en memoria, y
     todo lo demás — filtrar, buscar, ordenar, paginar — pasa en el
     dispositivo. Nunca se vuelve al servidor para filtrar.

   Por qué NO se pagina en el servidor
     Cada viaje a Apps Script cuesta entre uno y tres segundos. Paginar de
     a 50 filas significa un viaje por página y otro por cada cambio de
     filtro: la vista se siente rota. Traer las 9.459 de una vez cuesta un
     viaje y después todo es instantáneo.

   Formato compacto
     El servidor no manda un objeto por fila (con las claves repetidas
     9.459 veces) sino {campos:[...], filas:[[...],[...]]}. En BD Predial
     eso bajó la respuesta a menos de la mitad.

   Cómo se usa

     var L = KIT.piezas.listas.crear({
       traer: function () { return KIT.pedir('cuentaListar', { fmt: 2 }); },
       clave: 'idContrato',
       cache: 'cuentas',        // guarda en el dispositivo; opcional
       cacheMinutos: 10
     });

     L.cargar().then(function (filas) { ... });

     L.ver({
       busca: 'ramirez',                       // sin tildes, por varias palabras
       campos: ['contratista', 'documento'],   // dónde buscar
       filtra: function (f) { return f.estado === 'REPORTADA'; },
       ordena: 'fechaRadicacion',
       desc: true,
       pagina: 1, porPagina: 50
     });
     → { filas, total, paginas, pagina }

     L.refrescar()    vuelve a pedir, saltándose la caché
     L.una(id)        una fila por su clave
     L.cambiar(id, {estado:'APROBADA'})   toca la fila en memoria, sin recargar
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/listas] falta kit.js'); } catch (e) {} return; }

  /** {campos, filas} → array de objetos. Si ya vienen objetos, se dejan. */
  function expandir(datos) {
    if (!datos) return [];
    if (Array.isArray(datos)) return datos;
    if (!Array.isArray(datos.filas)) return [];
    var campos = datos.campos || [];
    return datos.filas.map(function (f) {
      var o = {}, i;
      for (i = 0; i < campos.length; i++) o[campos[i]] = f[i];
      return o;
    });
  }

  function crear(op) {
    op = op || {};
    var filas = [];
    var porClave = {};
    var cargado = false;
    var enVuelo = null;
    var cuando = 0;

    function indexar() {
      porClave = {};
      if (!op.clave) return;
      filas.forEach(function (f) { porClave[String(f[op.clave])] = f; });
    }

    function deCache() {
      if (!op.cache) return null;
      var g = K.guardar.leer('lista.' + op.cache, null);
      if (!g || !g.t || !g.d) return null;
      var minutos = op.cacheMinutos === undefined ? 10 : op.cacheMinutos;
      if (minutos > 0 && (Date.now() - g.t) > minutos * 60000) return null;
      return g.d;
    }
    function aCache(datos) {
      if (!op.cache) return;
      /* si no cabe (localStorage ronda los 5 MB) se sigue sin caché:
         es una ayuda, no un requisito */
      K.guardar.escribir('lista.' + op.cache, { t: Date.now(), d: datos });
    }

    function cargar(forzar) {
      if (enVuelo) return enVuelo;
      if (cargado && !forzar) return Promise.resolve(filas);

      if (!forzar) {
        var c = deCache();
        if (c) {
          filas = expandir(c);
          indexar();
          cargado = true;
          cuando = Date.now();
          /* se devuelve lo de la caché YA y se refresca por detrás */
          setTimeout(function () { cargar(true).catch(function () {}); }, 50);
          return Promise.resolve(filas);
        }
      }

      enVuelo = Promise.resolve(op.traer())
        .then(function (datos) {
          filas = expandir(datos);
          indexar();
          cargado = true;
          cuando = Date.now();
          aCache(datos);
          enVuelo = null;
          K.disparar('kit:lista', { cache: op.cache || '', total: filas.length });
          return filas;
        })
        .catch(function (e) {
          enVuelo = null;
          throw e;
        });
      return enVuelo;
    }

    /* ── consultas en el dispositivo ── */

    function texto(f, campos) {
      if (!campos || !campos.length) {
        var s = '', k;
        for (k in f) if (Object.prototype.hasOwnProperty.call(f, k)) s += ' ' + f[k];
        return K.norm(s);
      }
      return K.norm(campos.map(function (c) { return f[c]; }).join(' '));
    }

    function ver(q) {
      q = q || {};
      var out = filas;

      if (typeof q.filtra === 'function') out = out.filter(q.filtra);

      if (q.busca && String(q.busca).trim()) {
        /* por palabras sueltas: "ramirez 1070" encuentra igual que
           "1070 ramirez", que es como busca la gente */
        var trozos = K.norm(q.busca).split(/\s+/).filter(Boolean);
        out = out.filter(function (f) {
          var t = texto(f, q.campos);
          var i;
          for (i = 0; i < trozos.length; i++) if (t.indexOf(trozos[i]) < 0) return false;
          return true;
        });
      }

      if (q.ordena) {
        var campo = q.ordena;
        var signo = q.desc ? -1 : 1;
        out = out.slice().sort(function (a, b) {
          var x = a[campo], y = b[campo];
          if (x === y) return 0;
          if (x === null || x === undefined || x === '') return 1;   /* los vacíos, al final */
          if (y === null || y === undefined || y === '') return -1;
          var nx = Number(x), ny = Number(y);
          if (!isNaN(nx) && !isNaN(ny) && x !== '' && y !== '') return (nx - ny) * signo;
          return String(x).localeCompare(String(y), 'es') * signo;
        });
      }

      var total = out.length;
      var porPagina = q.porPagina || 0;
      var pagina = Math.max(1, q.pagina || 1);
      var paginas = porPagina ? Math.max(1, Math.ceil(total / porPagina)) : 1;
      if (porPagina) {
        if (pagina > paginas) pagina = paginas;
        out = out.slice((pagina - 1) * porPagina, pagina * porPagina);
      }
      return { filas: out, total: total, paginas: paginas, pagina: pagina };
    }

    function una(id) { return porClave[String(id)] || null; }

    /** Cambia una fila en memoria: evita recargar 9.000 filas por un estado. */
    function cambiar(id, cambios) {
      var f = una(id);
      if (!f) return null;
      var k;
      for (k in cambios) if (Object.prototype.hasOwnProperty.call(cambios, k)) f[k] = cambios[k];
      if (op.cache) K.guardar.borrar('lista.' + op.cache);   /* la caché ya no vale */
      return f;
    }

    function quitar(id) {
      var f = una(id);
      if (!f) return false;
      filas = filas.filter(function (x) { return x !== f; });
      indexar();
      if (op.cache) K.guardar.borrar('lista.' + op.cache);
      return true;
    }

    function meter(fila) {
      filas.unshift(fila);
      indexar();
      if (op.cache) K.guardar.borrar('lista.' + op.cache);
      return fila;
    }

    return {
      cargar: function () { return cargar(false); },
      refrescar: function () { return cargar(true); },
      ver: ver, una: una, cambiar: cambiar, quitar: quitar, meter: meter,
      todas: function () { return filas.slice(); },
      total: function () { return filas.length; },
      cargado: function () { return cargado; },
      edad: function () { return cuando ? Date.now() - cuando : -1; },
      olvidar: function () {
        filas = []; porClave = {}; cargado = false; cuando = 0;
        if (op.cache) K.guardar.borrar('lista.' + op.cache);
      }
    };
  }

  K.piezas.listas = { crear: crear, expandir: expandir };
}());
