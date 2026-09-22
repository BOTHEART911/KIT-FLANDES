/* ============================================================
   KIT-FLANDES · PRUEBAS DE MUTACIÓN
   Un banco en verde no dice nada si las pruebas no miran donde duele.
   Aquí se rompe el código a propósito, línea por línea, y se comprueba
   que el banco SE PONE ROJO. Una mutación que sobrevive es un hueco.

   Uso:  node mutaciones.js
   ============================================================ */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KIT = path.resolve(__dirname, '..', 'salida', 'KIT-FLANDES', 'kit');

/* [archivo, grupo del banco, qué se rompe, texto original, texto mutado] */
const MUTACIONES = [
  ['kit.js', 'nucleo', 'norm() vuelve a comerse la Ñ',
    ".replace(/ñ/g, '\\u0001').replace(/Ñ/g, '\\u0002')", ''],
  ['kit.js', 'nucleo', 'pesos() toma el punto de miles por decimal',
    "if (p.length > 2 || (p.length === 2 && p[1].length === 3)) s = p.join('');", ''],
  ['kit.js', 'nucleo', 'pesos() trunca en vez de redondear',
    "'$ ' + Math.round(aNumero(v))", "'$ ' + Math.floor(aNumero(v))"],
  ['kit.js', 'nucleo', 'fecha() pasa por Date y se corre un día',
    "if (m) return m[3] + '/' + m[2] + '/' + m[1];", ''],
  ['kit.js', 'nucleo', 'borrarTodo se lleva lo de las otras apps',
    "if (k && k.indexOf(NS) === 0) fuera.push(k);", 'if (k) fuera.push(k);'],
  ['kit.js', 'nucleo', 'el token no viaja al servidor',
    "if (!cuerpo.token && token() && opciones.sinToken !== true) cuerpo.token = token();", ''],
  ['kit.js', 'nucleo', 'la sesión vencida no borra el token',
    "if (p.codigo === 'SESION_VENCIDA' || p.codigo === 'SIN_SESION') ponerToken('');", ''],
  ['kit.js', 'nucleo', 'se manda application/json y Apps Script rebota',
    "'Content-Type': 'text/plain;charset=utf-8'", "'Content-Type': 'application/json'"],
  ['kit.js', 'nucleo', 'medio() no quita la barra de más',
    "var r = String(ruta || '').replace(/^\\/+/, '');", "var r = String(ruta || '');"],
  ['kit.js', 'nucleo', 'esc() deja pasar las comillas',
    ".replace(/\"/g, '&quot;')", ''],

  ['banner.js', 'banner', 'el botón atrás se queda siempre encendido',
    "barra.querySelector('.kit-banner__atras').hidden = !alAtras;", ''],
  ['banner.js', 'banner', 'las iniciales salen de una sola letra',
    "return p[0].charAt(0) + p[1].charAt(0);", 'return p[0].charAt(0);'],
  ['banner.js', 'banner', 'el título entra como HTML',
    "barra.querySelector('.kit-banner__titulo').textContent = String(titulo || '');",
    "barra.querySelector('.kit-banner__titulo').innerHTML = String(titulo || '');"],
  /* NOTA: quitar el cerrarMenu() explícito del item NO es una mutación
     válida: el click burbujea hasta el document y el cierre global lo tapa.
     Es código defensivo, no comportamiento observable. */
  ['banner.js', 'banner', 'el menú no se cierra nunca',
    "document.addEventListener('click', cerrarMenu);", ''],

  ['esqueletos.js', 'esqueletos', 'el esqueleto parpadea en respuestas rápidas',
    'var ANTES_DE_PINTAR = 180;', 'var ANTES_DE_PINTAR = 0;'],
  ['esqueletos.js', 'esqueletos', 'no se retira si la promesa falla',
    'function (e) { quitar(); throw e; }', 'function (e) { throw e; }'],
  ['esqueletos.js', 'esqueletos', 'sin tope de cuantos: 500 nodos',
    'Math.min(opciones.cuantos || 5, 24)', '(opciones.cuantos || 5)'],
  ['esqueletos.js', 'esqueletos', 'no marca aria-busy',
    "caja.setAttribute('aria-busy', 'true');", ''],

  ['guardado.js', 'guardado', 'la barra promete un 100 % que no controla',
    'if (pct > 92) pct = 92;', ''],
  ['guardado.js', 'guardado', 'salir a mitad de guardado no avisa',
    "window.addEventListener('beforeunload', guardia);", ''],
  ['guardado.js', 'guardado', 'el aviso de salida no se suelta al cerrar',
    "if (guardia) { window.removeEventListener('beforeunload', guardia); guardia = null; }", ''],
  ['guardado.js', 'guardado', 'al fallar se queda abierto',
    'function (e) { fallo(); throw e; }', 'function (e) { throw e; }'],

  ['fechas.js', 'fechas', 'la cascada vuelve a pisar los días al montar',
    'if (col.__montando) return;', ''],
  ['fechas.js', 'fechas', 'no se limpian las ruedas huérfanas',
    "K.$$('.kit-rueda').forEach(function (vieja) { vieja.remove(); });", ''],
  ['fechas.js', 'fechas', 'el mes no se recorta con el min',
    'for (d = 1; d <= tot; d++) if (dentro(o, y, m, d)) { vale = true; break; }', 'vale = true;'],
  ['fechas.js', 'fechas', 'los días no se recortan al cambiar de mes',
    'for (d = 1; d <= tot; d++) if (dentro(o, y, m, d)) out.push({ v: d, txt: pad(d) });',
    'for (d = 1; d <= 31; d++) out.push({ v: d, txt: pad(d) });'],
  ['fechas.js', 'fechas', '.value deja de hablar ISO',
    'get: function () { return propio.iso; },', 'get: function () { return aTexto(deISO(propio.iso) || {y:0,m:1,d:1}); },'],
  ['fechas.js', 'fechas', 'aceptar no avisa a la app',
    "try { inp.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}", ''],
  ['fechas.js', 'fechas', 'un campo deshabilitado abre la rueda igual',
    'if (inp.disabled) return;', ''],

  ['adjuntos.js', 'adjuntos', 'el mismo archivo entra dos veces',
    "if (lista[i].name === f.name && lista[i].size === f.size) {", 'if (false) {'],
  ['adjuntos.js', 'adjuntos', 'no hay tope de peso',
    'if (f.size > topeMB * 1048576) {', 'if (false) {'],
  ['adjuntos.js', 'adjuntos', 'no hay tope de cantidad',
    'if (lista.length >= tope) {', 'if (false) {'],
  ['adjuntos.js', 'adjuntos', 'el tipo no se comprueba',
    'if (acepta && !tipoVale(f)) {', 'if (false) {'],
  ['adjuntos.js', 'adjuntos', 'el nombre del archivo entra como HTML',
    "'  <span class=\"kit-adj__nom\" title=\"' + K.esc(f.name) + '\">' + K.esc(f.name) + '</span>' +",
    "'  <span class=\"kit-adj__nom\">' + f.name + '</span>' +"],
  ['adjuntos.js', 'adjuntos', 'sin varios, se acumulan igual',
    'if (!varios) lista = [];', ''],

  ['visor.js', 'visor', 'Drive se incrusta con /view y sale en blanco',
    "return id ? 'https://drive.google.com/file/d/' + id + '/preview' : url;",
    "return url;"],
  ['visor.js', 'visor', 'el id de Drive se saca mal',
    "/(?:drive|docs)\\.google\\.com\\/.*?(?:\\/d\\/|id=)([a-zA-Z0-9_-]{15,})/",
    "/NO-COINCIDE-NUNCA-xyz/"],
  ['visor.js', 'visor', 'el título del documento entra como HTML',
    "capa.querySelector('.kit-visor__t').textContent = d ? (d.titulo || 'Documento') : '';",
    "capa.querySelector('.kit-visor__t').innerHTML = d ? (d.titulo || 'Documento') : '';"],
  ['visor.js', 'visor', 'el iframe se queda cargado al cerrar',
    "capa.querySelector('.kit-visor__lienzo').innerHTML = '';", ''],
  ['visor.js', 'visor', 'una imagen se mete en un iframe',
    "if (tipoDe(d) === 'imagen') {", 'if (false) {'],

  ['carrusel.js', 'carrusel', 'el zoom se pasa de 6x',
    'z = Math.min(MAX, Math.max(MIN, nuevo));', 'z = nuevo;'],
  ['carrusel.js', 'carrusel', 'el zoom se hereda al cambiar de imagen',
    'reset();\n    var el = img();', 'var el = img();'],
  ['carrusel.js', 'carrusel', 'el botón de reemplazar sale siempre',
    "capa.querySelector('.kit-carr__b--rep').classList.toggle('kit-oculto', typeof opts.alReemplazar !== 'function');", ''],

  ['pastillas.js', 'pastillas', 'el texto de la pastilla entra como HTML',
    'K.esc(op.texto) +', 'op.texto +'],
  ['pastillas.js', 'pastillas', 'deja() no filtra nada',
    "return !elegidos[0] || elegidos[0] === v;", 'return true;'],
  ['pastillas.js', 'pastillas', 'los conteos no se formatean',
    "'<span class=\"kit-pastilla__conteo\">' + K.numero(n) + '</span>'",
    "'<span class=\"kit-pastilla__conteo\">' + n + '</span>'"],
  ['pastillas.js', 'pastillas', 'lo que no tiene conteo pinta un cero falso',
    "(n === undefined ? '' :", '(false ? "" :'],
  ['pastillas.js', 'pastillas', '"Todas" no apaga las demás',
    "if (v === '') elegidos = [];", "if (false) elegidos = [];"],

  ['antidoble.js', 'antidoble', 'el candado no se suelta al fallar',
    'function (e) { soltar(); throw e; }', 'function (e) { throw e; }'],
  ['antidoble.js', 'antidoble', 'el candado no frena el segundo clic',
    'if (corriendo) return;', ''],
  ['antidoble.js', 'antidoble', 'soltar dos veces descuenta de más',
    'if (soltado) return;', ''],
  ['antidoble.js', 'antidoble', 'el escudo se hace visible y parece colgada',
    'background: transparent;\n  cursor: progress;', 'background: rgba(0,0,0,.4);\n  cursor: progress;'],

  ['listas.js', 'listas', 'se vuelve al servidor en cada carga',
    'if (cargado && !forzar) return Promise.resolve(filas);', ''],
  ['listas.js', 'listas', 'dos cargas a la vez son dos viajes',
    'if (enVuelo) return enVuelo;', ''],
  ['listas.js', 'listas', 'la búsqueda exige el orden de las palabras',
    "var trozos = K.norm(q.busca).split(/\\s+/).filter(Boolean);",
    'var trozos = [K.norm(q.busca)];'],
  ['listas.js', 'listas', 'los números se ordenan como texto',
    "if (!isNaN(nx) && !isNaN(ny) && x !== '' && y !== '') return (nx - ny) * signo;", ''],
  ['listas.js', 'listas', 'una página fuera de rango devuelve vacío',
    'if (pagina > paginas) pagina = paginas;', ''],
  ['listas.js', 'listas', 'la caché caducada se usa igual',
    "if (minutos > 0 && (Date.now() - g.t) > minutos * 60000) return null;", ''],
  ['listas.js', 'listas', 'tras fallar no se puede reintentar',
    'enVuelo = null;\n          throw e;', 'throw e;'],

  ['sesion.js', 'sesion', 'el documento viaja con puntos',
    "var doc = String(documento || '').replace(/[^\\d]/g, '');", 'var doc = String(documento || \'\');'],
  /* 4.4: este patrón llevaba tiempo sin aplicar (la 4.1 le añadió
     appDestino y app:'CORE' a la llamada), así que la mutación se
     contaba como "sobrevivió" sin haber tocado nada. Actualizado. */
  ['sesion.js', 'sesion', 'el login manda el token viejo',
    "K.pedir('login', { documento: doc, clave: clave, appDestino: K.app }, { sinToken: true, app: 'CORE' })",
    "K.pedir('login', { documento: doc, clave: clave, appDestino: K.app }, { app: 'CORE' })"],
  ['sesion.js', 'sesion', 'se entra sin elegir contrato',
    'if (d && d.contratos && d.contratos.length > 1) {', 'if (false) {'],
  ['sesion.js', 'sesion', 'el botón no se suelta tras el error',
    'ocupado(false);\n        error(mensajeDe(e));', 'error(mensajeDe(e));'],
  ['sesion.js', 'sesion', 'el número de WhatsApp se enseña entero',
    "'La enviamos al número que termina en ' + K.esc(String(d.telefono).slice(-4)) + '.'",
    "'La enviamos al ' + K.esc(String(d.telefono)) + '.'"],
  ['sesion.js', 'sesion', 'la sesión guardada no se comprueba',
    "if (K.token()) {", 'if (false) {'],
  ['sesion.js', 'sesion', '"olvidé" llama sin documento',
    "if (!doc) { error('Escribe primero tu documento y vuelve a tocar aquí.'); return; }", ''],

  ['instalar.js', 'instalar', 'el aviso del navegador se deja escapar',
    'e.preventDefault();\n      aviso = e;', 'aviso = null;'],
  ['instalar.js', 'instalar', 'iPad con iPadOS no se reconoce como iOS',
    "return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;", 'return false;'],
  ['instalar.js', 'instalar', 'se ofrece instalar aunque ya esté instalada',
    "if (instalada()) return 'instalada';", ''],
  /* 4.4: igual que la de sesión, este patrón ya no existía en el
     archivo. Ahora se muta el caso de verdad: en iPhone, decir que
     cualquier navegador es Safari. */
  ['instalar.js', 'instalar', 'en iPhone fuera de Safari no se avisa',
    "if (esIOS()) return esSafari() ? 'ios-safari' : 'ios-otro';",
    "if (esIOS()) return 'ios-safari';"],

  ['soporte.js', 'soporte', 'se manda un reporte de dos letras',
    'if (msj.length < 10) return marcar', 'if (false) return marcar'],
  ['soporte.js', 'soporte', 'si el CORE falla, el reporte se pierde',
    'porWhatsapp(msj, ctx, hoja);', ''],
  ['soporte.js', 'soporte', 'el botón no se suelta tras fallar',
    'b.disabled = false;\n          b.classList.remove(\'kit-ocupado\');\n          /* el CORE no contesta', '/* el CORE no contesta'],

  ['insights.js', 'insights', 'arranca solo al abrir la vista',
    "hoja.querySelector('.kit-ins__iniciar').addEventListener('click', function () { correr(hoja); });",
    "correr(hoja);"],
  ['insights.js', 'insights', 'calcula sobre la primera lectura, no sobre lo filtrado ahora',
    "var f = typeof cfg.filas === 'function' ? cfg.filas() : (cfg.filas || []);",
    "if (!cfg.__pegado) cfg.__pegado = (typeof cfg.filas === 'function' ? cfg.filas() : (cfg.filas || [])); var f = cfg.__pegado;"],
  ['insights.js', 'insights', 'no dice sobre cuántos registros calculó',
    "salida.appendChild(K.nodo('<p class=\"kit-ins__pie-nota\">Calculado sobre <b>' + K.numero(filas.length) +", "if (false) salida.appendChild(K.nodo('<p class=\"kit-ins__pie-nota\">Calculado sobre <b>' + K.numero(filas.length) +"],
  ['insights.js', 'insights', 'el reparto no se ordena',
    'return b.n - a.n;', 'return 0;'],
  ['insights.js', 'insights', 'con la vista vacía calcula ceros',
    'if (!filas.length) {', 'if (false) {'],
  ['insights.js', 'insights', 'arrastrar el robot abre el panel',
    "if (fab.__arrastro) { fab.__arrastro = false; return; }", ''],

  ['exportar.js', 'exportar', 'Excel recibe los pesos como texto y no suma',
    "if (col.tipo === 'pesos' || col.tipo === 'numero') return K.aNumero(v);", ''],
  ['exportar.js', 'exportar', 'el CSV separa con coma y sale en una columna',
    "return /[\";\\n]/.test(s) ? '\"' + s.replace(/\"/g, '\"\"') + '\"' : s;", 'return s;'],
  ['creditos.js', 'creditos', 'el pie espera al servidor y sale vacío un instante',
    "pie.innerHTML = html(POR_DEFECTO);", "pie.innerHTML = '';"],
  ['creditos.js', 'creditos', 'el texto del CORE entra como HTML',
    "'<p class=\"kit-cred__autor\">' + K.esc(t.autor) + '</p>'",
    "'<p class=\"kit-cred__autor\">' + t.autor + '</p>'"],
  ['creditos.js', 'creditos', 'si el CORE falla, el pie se queda sin nombre',
    ".catch(function () { return POR_DEFECTO; });", ".catch(function () { return {autor:'', frase:''}; });"],
  ['creditos.js', 'creditos', 'no se usa lo que manda el CORE',
    "autor: (c && c.MARCA_AUTOR) || POR_DEFECTO.autor,", "autor: POR_DEFECTO.autor,"],
  ['creditos.css', 'creditos', 'la frase pesa igual que el nombre',
    "font: 300 13px/1.4 var(--k-fuente);", "font: 700 19px/1.4 var(--k-fuente);"],
  ['creditos.js', 'creditos', 'el año no se pone aunque se pida',
    "if (opciones.anio) {\n        pie.querySelector('.kit-cred__cop').textContent =\n          'Copyright © ' + new Date().getFullYear();\n      }\n    });", "});"],
  ['exportar.js', 'exportar', 'el CSV pierde el BOM y las tildes salen rotas',
    'new Blob([BOM + txt]', 'new Blob([txt]'],
  ['exportar.js', 'exportar', 'el nombre del archivo conserva las tildes',
    "String(t || 'informe').normalize('NFD')", "String(t || 'informe')"],
  ['kit.js', 'nucleo', 'norm() deja de quitar tildes',
    ".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')", ''],
  ['exportar.js', 'exportar', 'el rango de fechas no recorta',
    'if (desde && v < desde) return false;', ''],
  ['exportar.js', 'exportar', 'la columna fija se puede desmarcar',
    "(c.fijo ? ' disabled' : '')", "''"],
  ['exportar.js', 'exportar', 'el respaldo de impresión no escapa los datos',
    "return '<td>' + K.esc(valor(f, c)) + '</td>';", "return '<td>' + valor(f, c) + '</td>';"],
  ['exportar.js', 'exportar', 'el membrete se queda sin municipio',
    "K.esc(m.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES')", "''"]
];

/* el CSS del escudo vive en antidoble.css, no en el .js */
function rutaDe(archivo) {
  return path.join(KIT, archivo);
}

function correrBanco(grupo) {
  try {
    execFileSync('node', [path.join(__dirname, 'banco.js'), grupo],
      { stdio: 'pipe', timeout: 300000 });
    return true;     /* verde: la mutación SOBREVIVIÓ */
  } catch (e) {
    return false;    /* rojo: cazada */
  }
}

(function () {
  let cazadas = 0;
  const vivas = [];

  console.log(`\n  Probando ${MUTACIONES.length} mutaciones…\n`);

  MUTACIONES.forEach(([archivo, grupo, que, antes, despues], n) => {
    /* la del escudo visible toca el CSS */
    const f = (que.indexOf('escudo se hace visible') >= 0)
      ? rutaDe('antidoble.css') : rutaDe(archivo);

    const original = fs.readFileSync(f, 'utf8');
    if (original.indexOf(antes) < 0) {
      vivas.push(`${archivo} · ${que}\n      NO SE PUDO APLICAR: el texto original ya no está en el archivo`);
      return;
    }
    fs.writeFileSync(f, original.replace(antes, despues));
    const sobrevivio = correrBanco(grupo);
    fs.writeFileSync(f, original);

    if (sobrevivio) vivas.push(`${archivo} · ${que}`);
    else cazadas++;
    process.stdout.write(sobrevivio ? '·' : '×');
    if ((n + 1) % 40 === 0) process.stdout.write('\n');
  });

  console.log(`\n\n  CAZADAS ${cazadas} de ${MUTACIONES.length}\n`);
  if (vivas.length) {
    console.log('  ── mutaciones que SOBREVIVIERON (huecos en las pruebas) ──');
    vivas.forEach(v => console.log('   ' + v));
    console.log('');
  }
  process.exit(vivas.length ? 1 : 0);
})();
