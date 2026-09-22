/* ============================================================
   KIT-FLANDES · BANCO DE PRUEBAS
   Corre las piezas en Chromium de verdad (Playwright), no en un simulador
   de DOM: la rueda de fechas y los esqueletos dependen de scrollTop, de
   animaciones y de layout real, y en jsdom pasarían siempre.

   Uso:  node banco.js            todas
         node banco.js fechas     solo las de una pieza
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..', 'salida', 'KIT-FLANDES');
const soloPieza = process.argv[2] || '';

let verdes = 0, rojas = 0;
const fallos = [];
let grupoActual = '';

function grupo(n) { grupoActual = n; }

async function prueba(nombre, fn) {
  if (soloPieza && !grupoActual.toLowerCase().includes(soloPieza.toLowerCase())
      && !nombre.toLowerCase().includes(soloPieza.toLowerCase())) return;
  try {
    await fn();
    verdes++;
  } catch (e) {
    rojas++;
    fallos.push(`[${grupoActual}] ${nombre}\n    ${e.message}`);
  }
}

function igual(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg || 'distinto'}: esperaba ${B}, llegó ${A}`);
}
function cierto(v, msg) { if (!v) throw new Error(msg || 'esperaba verdadero'); }
function falso(v, msg) { if (v) throw new Error(msg || 'esperaba falso'); }

/* Página en blanco con el kit cargado. `piezas` = ['banner','fechas',...] */
async function pagina(browser, piezas = [], htmlCuerpo = '') {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();

  const css = ['base.css', ...piezas.map(p => `${p}.css`)]
    .filter(f => fs.existsSync(path.join(RAIZ, 'kit', f)))
    .map(f => `<link rel="stylesheet" href="kit/${f}">`).join('\n');
  /* 4.4: iconos.js va SIEMPRE detrás de kit.js. Desde esta entrega las
     piezas dibujan sus botones con K.icono(), así que el set es parte del
     kit y no de una app. (kit.js deja además un K.icono de respaldo que
     devuelve vacío, para que a una app que se olvide del <script> se le
     queden los botones sin dibujo en vez de reventar.) */
  const js = ['kit.js', 'iconos.js', ...piezas.map(p => `${p}.js`)]
    .filter(f => fs.existsSync(path.join(RAIZ, 'kit', f)))
    .map(f => `<script src="kit/${f}"></script>`).join('\n');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#06402B">
<title>banco</title>
<script>window.MARCA={API_URL:'https://ejemplo.invalido/exec',APP:'CONTRATISTA',
  STORAGE_NS:'flandes.contratista.',MEDIOS_BASE:'https://botheart911.github.io/ALCALDIA-MEDIOS/'};</script>
${css}
</head><body class="kit-fondo">${htmlCuerpo}
${js}
</body></html>`;

  const f = path.join(RAIZ, '__banco.html');
  fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction('!!window.KIT');
  return { page, ctx };
}

(async () => {
  const browser = await chromium.launch();

  /* ═══════════ NÚCLEO ═══════════ */
  grupo('nucleo');
  {
    const { page, ctx } = await pagina(browser);

    await prueba('KIT existe y trae la versión', async () => {
      igual(await page.evaluate(() => typeof KIT), 'object');
      cierto(await page.evaluate(() => /^\d+\.\d+\.\d+$/.test(KIT.version)), 'versión con formato');
    });

    await prueba('lee la marca', async () => {
      igual(await page.evaluate(() => KIT.app), 'CONTRATISTA');
      igual(await page.evaluate(() => KIT.ns), 'flandes.contratista.');
    });

    await prueba('esc() cierra las cinco puertas de HTML', async () => {
      igual(await page.evaluate(() => KIT.esc('<a href="x">\'&</a>')),
        '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;');
    });

    await prueba('esc() con null y undefined no revienta', async () => {
      igual(await page.evaluate(() => KIT.esc(null) + '|' + KIT.esc(undefined)), '|');
    });

    await prueba('norm() quita tildes y sube a mayúsculas', async () => {
      igual(await page.evaluate(() => KIT.norm(' josé ramírez ñandú ')), 'JOSE RAMIREZ ÑANDU');
    });

    await prueba('norm() deja la Ñ, que sí distingue nombres', async () => {
      cierto(await page.evaluate(() => KIT.norm('peña') !== KIT.norm('pena')), 'PEÑA ≠ PENA');
    });

    await prueba('guardar usa el espacio de nombres de la app', async () => {
      await page.evaluate(() => KIT.guardar.escribir('x', { a: 1 }));
      igual(await page.evaluate(() => localStorage.getItem('flandes.contratista.x')), '{"a":1}');
      igual(await page.evaluate(() => KIT.guardar.leer('x')), { a: 1 });
    });

    await prueba('guardar.leer devuelve el valor por defecto si no hay nada', async () => {
      igual(await page.evaluate(() => KIT.guardar.leer('no-existe', 'vacio')), 'vacio');
    });

    await prueba('borrarTodo NO toca lo de las otras apps', async () => {
      await page.evaluate(() => {
        localStorage.setItem('flandes.tesoreria.sesion', 'otra-app');
        KIT.guardar.escribir('mio', 1);
        KIT.guardar.borrarTodo();
      });
      igual(await page.evaluate(() => localStorage.getItem('flandes.tesoreria.sesion')), 'otra-app');
      igual(await page.evaluate(() => localStorage.getItem('flandes.contratista.mio')), null);
    });

    await prueba('medio() arma la URL de ALCALDIA-MEDIOS', async () => {
      igual(await page.evaluate(() => KIT.medio('img/logo.webp')),
        'https://botheart911.github.io/ALCALDIA-MEDIOS/img/logo.webp');
    });

    await prueba('medio() tolera la barra de más', async () => {
      igual(await page.evaluate(() => KIT.medio('/sound/ver.mp3')),
        'https://botheart911.github.io/ALCALDIA-MEDIOS/sound/ver.mp3');
    });

    await prueba('medio() respeta una URL absoluta', async () => {
      igual(await page.evaluate(() => KIT.medio('https://otro.com/a.png')), 'https://otro.com/a.png');
    });

    await prueba('pesos() con el formato de Colombia', async () => {
      igual(await page.evaluate(() => KIT.pesos(1234567)), '$ 1.234.567');
      igual(await page.evaluate(() => KIT.pesos('  2.500  ')), '$ 2.500');
      igual(await page.evaluate(() => KIT.pesos(null)), '$ 0');
    });

    await prueba('pesos() redondea, no trunca', async () => {
      igual(await page.evaluate(() => KIT.pesos(1500.6)), '$ 1.501');
    });

    await prueba('fecha() pasa ISO a dd/mm/aaaa', async () => {
      igual(await page.evaluate(() => KIT.fecha('2026-09-21')), '21/09/2026');
    });

    await prueba('fecha() no inventa cuando no es fecha', async () => {
      igual(await page.evaluate(() => KIT.fecha('N/A')), 'N/A');
      igual(await page.evaluate(() => KIT.fecha('')), '');
    });

    await prueba('fecha() no se corre un día por la zona horaria', async () => {
      /* el error clásico: new Date('2026-01-01') en UTC-5 da 31/12/2025 */
      igual(await page.evaluate(() => KIT.fecha('2026-01-01')), '01/01/2026');
    });

    await prueba('aviso() se pinta y se retira solo', async () => {
      await page.evaluate(() => KIT.aviso('hola', 'ok', 400));
      cierto(await page.locator('.kit-aviso').isVisible(), 'el aviso se ve');
      await page.waitForTimeout(900);
      igual(await page.locator('.kit-aviso').count(), 0);
    });

    await prueba('tema: alterna y se recuerda', async () => {
      await page.evaluate(() => KIT.ponerTema('oscuro'));
      igual(await page.evaluate(() => document.documentElement.getAttribute('data-tema')), 'oscuro');
      igual(await page.evaluate(() => KIT.guardar.leer('tema')), 'oscuro');
      await page.evaluate(() => KIT.alternarTema());
      igual(await page.evaluate(() => KIT.temaActual()), 'claro');
    });

    await prueba('tema oscuro cambia de verdad el color del papel', async () => {
      const claro = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--k-papel').trim());
      await page.evaluate(() => KIT.ponerTema('oscuro'));
      const oscuro = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--k-papel').trim());
      cierto(claro !== oscuro, `--k-papel debía cambiar (${claro} vs ${oscuro})`);
      await page.evaluate(() => KIT.ponerTema('claro'));
    });

    await prueba('theme-color del navegador sigue al tema', async () => {
      await page.evaluate(() => KIT.ponerTema('oscuro'));
      igual(await page.getAttribute('meta[name="theme-color"]', 'content'), '#0d1512');
      await page.evaluate(() => KIT.ponerTema('claro'));
      igual(await page.getAttribute('meta[name="theme-color"]', 'content'), '#06402B');
    });

    await prueba('pedir() falla con SIN_RED cuando el servidor no existe', async () => {
      const r = await page.evaluate(async () => {
        try { await KIT.pedir('ping', {}, { ms: 2500 }); return 'no falló'; }
        catch (e) { return e.codigo; }
      });
      cierto(r === 'SIN_RED' || r === 'TIEMPO', `esperaba SIN_RED, llegó ${r}`);
    });

    await prueba('pedir() manda app y action en el cuerpo', async () => {
      const cuerpo = await page.evaluate(async () => {
        let visto = null;
        const real = window.fetch;
        window.fetch = (u, o) => { visto = JSON.parse(o.body); return Promise.resolve({ text: () => Promise.resolve('{"ok":true,"data":1}') }); };
        await KIT.pedir('cuentaListar', { desde: 'x' });
        window.fetch = real;
        return visto;
      });
      igual(cuerpo.app, 'CONTRATISTA');
      igual(cuerpo.action, 'cuentaListar');
      igual(cuerpo.desde, 'x');
    });

    await prueba('pedir() adjunta el token guardado', async () => {
      const cuerpo = await page.evaluate(async () => {
        KIT.ponerToken('T-123');
        let visto = null;
        const real = window.fetch;
        window.fetch = (u, o) => { visto = JSON.parse(o.body); return Promise.resolve({ text: () => Promise.resolve('{"ok":true,"data":1}') }); };
        await KIT.pedir('yo');
        window.fetch = real;
        return visto;
      });
      igual(cuerpo.token, 'T-123');
    });

    await prueba('pedir() manda text/plain (si no, Apps Script rebota por CORS)', async () => {
      const ct = await page.evaluate(async () => {
        let visto = null;
        const real = window.fetch;
        window.fetch = (u, o) => { visto = o.headers['Content-Type']; return Promise.resolve({ text: () => Promise.resolve('{"ok":true,"data":1}') }); };
        await KIT.pedir('ping');
        window.fetch = real;
        return visto;
      });
      cierto(/text\/plain/.test(ct), `esperaba text/plain, llegó ${ct}`);
    });

    await prueba('pedir() traduce el HTML de Apps Script a RESPUESTA_NO_JSON', async () => {
      const cod = await page.evaluate(async () => {
        const real = window.fetch;
        window.fetch = () => Promise.resolve({ text: () => Promise.resolve('<!DOCTYPE html><html>...') });
        try { await KIT.pedir('ping'); return 'no falló'; }
        catch (e) { return e.codigo; }
        finally { window.fetch = real; }
      });
      igual(cod, 'RESPUESTA_NO_JSON');
    });

    await prueba('pedir() borra el token si la sesión venció', async () => {
      const quedo = await page.evaluate(async () => {
        KIT.ponerToken('T-viejo');
        const real = window.fetch;
        window.fetch = () => Promise.resolve({ text: () => Promise.resolve('{"ok":false,"codigo":"SESION_VENCIDA","error":"x"}') });
        try { await KIT.pedir('yo'); } catch (e) {}
        window.fetch = real;
        return KIT.token();
      });
      igual(quedo, '');
    });

    await ctx.close();
  }

  /* ═══════════ BANNER ═══════════ */
  grupo('banner');
  {
    const { page, ctx } = await pagina(browser, ['banner']);

    await prueba('montar pinta la barra una sola vez', async () => {
      await page.evaluate(() => { KIT.piezas.banner.montar({ titulo: 'Contratación' }); KIT.piezas.banner.montar({ titulo: 'Contratación' }); });
      igual(await page.locator('.kit-banner').count(), 1);
    });

    await prueba('el título se ve', async () => {
      igual(await page.locator('.kit-banner__titulo').innerText(), 'Contratación');
    });

    await prueba('el cuerpo se separa para que la barra no tape nada', async () => {
      const pt = await page.evaluate(() => parseInt(getComputedStyle(document.body).paddingTop, 10));
      cierto(pt >= 50, `el body debía bajar, tiene ${pt}px`);
    });

    await prueba('sin foto, salen las iniciales', async () => {
      await page.evaluate(() => KIT.piezas.banner.perfil({ nombre: 'OSCAR POLANIA', foto: '' }));
      igual(await page.locator('.kit-banner__foto span').innerText(), 'OP');
    });

    await prueba('un solo nombre da dos letras, no una', async () => {
      await page.evaluate(() => KIT.piezas.banner.perfil({ nombre: 'Prensa' }));
      igual(await page.locator('.kit-banner__foto span').innerText(), 'PR');
    });

    await prueba('sin nombre no se rompe', async () => {
      await page.evaluate(() => KIT.piezas.banner.perfil({ nombre: '' }));
      igual(await page.locator('.kit-banner__foto span').innerText(), '··');
    });

    await prueba('el atrás está apagado mientras no haya a dónde ir', async () => {
      cierto(await page.locator('.kit-banner__atras').isHidden(), 'debía estar oculto');
    });

    await prueba('atras(fn) lo enciende y lo llama al pulsar', async () => {
      await page.evaluate(() => { window.__volvi = 0; KIT.piezas.banner.atras(() => { window.__volvi++; }); });
      cierto(await page.locator('.kit-banner__atras').isVisible(), 'debía verse');
      await page.locator('.kit-banner__atras').click();
      igual(await page.evaluate(() => window.__volvi), 1);
    });

    await prueba('atras(null) lo vuelve a apagar', async () => {
      await page.evaluate(() => KIT.piezas.banner.atras(null));
      cierto(await page.locator('.kit-banner__atras').isHidden(), 'debía ocultarse');
    });

    await prueba('vista() cambia el título y el de la pestaña', async () => {
      await page.evaluate(() => KIT.piezas.banner.vista('Cuentas por revisar'));
      igual(await page.locator('.kit-banner__titulo').innerText(), 'Cuentas por revisar');
      cierto((await page.title()).indexOf('Cuentas por revisar') === 0, 'el <title> debía empezar por la vista');
    });

    await prueba('el título no deja entrar HTML', async () => {
      await page.evaluate(() => KIT.piezas.banner.vista('<img src=x onerror=alert(1)>'));
      igual(await page.locator('.kit-banner__titulo img').count(), 0);
    });

    await prueba('el menú se abre, se usa y se cierra solo', async () => {
      await page.evaluate(() => {
        window.__toque = 0;
        KIT.piezas.banner.montar({ titulo: 'X', nombre: 'ANA GAMBOA', rol: 'ADMIN',
          menu: [{ texto: 'Mi perfil', al: () => { window.__toque++; } }] });
      });
      await page.locator('.kit-banner__perfil').click();
      cierto(await page.locator('.kit-banner__menu').isVisible(), 'debía abrirse');
      await page.locator('.kit-banner__mi', { hasText: 'Mi perfil' }).click();
      igual(await page.evaluate(() => window.__toque), 1);
      cierto(await page.locator('.kit-banner__menu').isHidden(), 'debía cerrarse tras elegir');
    });

    await prueba('el menú se cierra al tocar fuera', async () => {
      await page.locator('.kit-banner__perfil').click();
      await page.mouse.click(600, 600);
      cierto(await page.locator('.kit-banner__menu').isHidden(), 'debía cerrarse');
    });

    await prueba('el botón de tema cambia el tema', async () => {
      const antes = await page.evaluate(() => KIT.temaActual());
      await page.locator('.kit-banner__tema').click();
      cierto(await page.evaluate(() => KIT.temaActual()) !== antes, 'debía cambiar');
    });

    await ctx.close();
  }

  /* ═══════════ ESQUELETOS ═══════════ */
  grupo('esqueletos');
  {
    const { page, ctx } = await pagina(browser, ['esqueletos'], '<div id="lista"></div>');

    await prueba('no parpadea si la respuesta es rápida', async () => {
      await page.evaluate(() => { const q = KIT.piezas.esqueletos.poner('#lista'); q(); });
      await page.waitForTimeout(300);
      igual(await page.locator('.kit-esq').count(), 0);
    });

    await prueba('una espera de 100 ms tampoco pinta nada (el umbral es 180)', async () => {
      /* el caso real: la respuesta llega rápida pero no instantánea. Si el
         umbral desaparece, aquí se ve el parpadeo. */
      await page.evaluate(() => {
        window.__vioEsq = false;
        KIT.piezas.esqueletos.mientras('#lista', new Promise(r => setTimeout(r, 100)));
        const reloj = setInterval(() => {
          if (document.querySelector('.kit-esq')) { window.__vioEsq = true; clearInterval(reloj); }
        }, 15);
        setTimeout(() => clearInterval(reloj), 400);
      });
      await page.waitForTimeout(600);
      falso(await page.evaluate(() => window.__vioEsq), 'con 100 ms no debía llegar a pintarse');
    });

    await prueba('aparece cuando la espera es larga', async () => {
      await page.evaluate(() => { window.__q = KIT.piezas.esqueletos.poner('#lista', { forma: 'tarjetas', cuantos: 4 }); });
      await page.waitForTimeout(320);
      igual(await page.locator('.kit-esq__tarjeta').count(), 4);
    });

    await prueba('marca aria-busy mientras carga', async () => {
      igual(await page.getAttribute('#lista', 'aria-busy'), 'true');
    });

    await prueba('se retira y quita aria-busy', async () => {
      await page.evaluate(() => window.__q());
      await page.waitForTimeout(700);
      igual(await page.locator('.kit-esq').count(), 0);
      igual(await page.getAttribute('#lista', 'aria-busy'), null);
    });

    await prueba('las cinco formas existen', async () => {
      igual(await page.evaluate(() => KIT.piezas.esqueletos.formas.sort()),
        ['ficha', 'filas', 'tabla', 'tarjetas', 'texto']);
    });

    await prueba('cuantos se corta en 24 para no colgar la página', async () => {
      await page.evaluate(() => { window.__q2 = KIT.piezas.esqueletos.poner('#lista', { forma: 'filas', cuantos: 500 }); });
      await page.waitForTimeout(320);
      igual(await page.locator('.kit-esq__fila').count(), 24);
      await page.evaluate(() => window.__q2());
      await page.waitForTimeout(700);
    });

    await prueba('mientras() lo quita aunque la promesa falle', async () => {
      const cod = await page.evaluate(async () => {
        try { await KIT.piezas.esqueletos.mientras('#lista',
          new Promise((_, no) => setTimeout(() => no(new Error('x')), 300))); }
        catch (e) { return 'falló'; }
      });
      igual(cod, 'falló');
      await page.waitForTimeout(700);
      igual(await page.locator('.kit-esq').count(), 0);
    });

    await prueba('un destino que no existe no rompe nada', async () => {
      igual(await page.evaluate(() => { KIT.piezas.esqueletos.poner('#no-existe')(); return 'ok'; }), 'ok');
    });

    await prueba('el brillo está apagado si el usuario pidió menos movimiento', async () => {
      const ctx2 = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 800, height: 600 } });
      const p2 = await ctx2.newPage();
      await p2.goto('file://' + path.join(RAIZ, '__banco.html'));
      await p2.waitForFunction('!!window.KIT');
      await p2.evaluate(() => KIT.piezas.esqueletos.poner('#lista', { cuantos: 1 }));
      await p2.waitForTimeout(320);
      const anim = await p2.evaluate(() => getComputedStyle(document.querySelector('.kit-esq__bloque')).animationName);
      igual(anim, 'none');
      await ctx2.close();
    });

    await ctx.close();
  }

  /* ═══════════ GUARDADO (COHETE) ═══════════ */
  grupo('guardado');
  {
    const { page, ctx } = await pagina(browser, ['guardado']);

    await prueba('abre y se ve el cohete', async () => {
      await page.evaluate(() => KIT.piezas.guardado.abrir({ titulo: 'Radicando' }));
      cierto(await page.locator('.kit-guard--on').isVisible(), 'debía verse');
      igual(await page.locator('.kit-guard__t').innerText(), 'Radicando');
      /* 4.4: el cohete pasó de emoji a SVG y ahora viaja por el cielo
         en vez de balancearse en el sitio. Se comprueban las dos cosas. */
      cierto(await page.locator('.kit-guard__cohete svg').count() === 1,
        'el cohete tiene que ser un SVG del set, no un emoji');
      cierto(!/[\u{1F680}]/u.test(await page.locator('.kit-guard__cielo').innerText()),
        'no debe quedar ningún emoji de cohete');
      const anim = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.kit-guard__nave')).animationName);
      igual(anim, 'kit-guard-viaja');
    });

    await prueba('la barra avanza sola', async () => {
      const a = await page.evaluate(() => parseFloat(document.querySelector('.kit-guard__bar').style.width) || 0);
      await page.waitForTimeout(900);
      const b = await page.evaluate(() => parseFloat(document.querySelector('.kit-guard__bar').style.width) || 0);
      cierto(b > a, `debía avanzar (${a} → ${b})`);
    });

    await prueba('la barra NO llega al 100 % sin respuesta', async () => {
      /* el incremento tiene un suelo por tic: sin el tope, en una espera
         larga la barra se pasaría del 100 % y prometería un final que el
         servidor no ha dado */
      await page.waitForTimeout(9000);
      const w = await page.evaluate(() => parseFloat(document.querySelector('.kit-guard__bar').style.width));
      cierto(w <= 92.01, `se pasó del 92 %: ${w}`);
    });

    await prueba('los pasos van cambiando', async () => {
      const t = await page.locator('.kit-guard__paso').innerText();
      cierto(t.length > 0, 'debía haber un paso escrito');
    });

    await prueba('listo() pone 100 %, verde y cierra', async () => {
      /* sin await: listo() no resuelve hasta que cierra, y hay que mirar ANTES */
      await page.evaluate(() => { KIT.piezas.guardado.listo({ titulo: '¡Radicada!', espera: 400 }); });
      await page.waitForTimeout(80);
      igual(await page.locator('.kit-guard__t').innerText(), '¡Radicada!');
      igual(await page.evaluate(() => document.querySelector('.kit-guard__bar').style.width), '100%');
      cierto(await page.locator('.kit-guard__ok').isVisible(), 'el ✅ debía verse');
      await page.waitForTimeout(600);
      falso(await page.evaluate(() => KIT.piezas.guardado.abierto()), 'debía estar cerrado');
    });

    await prueba('mientras() devuelve el valor de la promesa', async () => {
      const v = await page.evaluate(() => KIT.piezas.guardado.mientras(
        Promise.resolve({ n: 7 }), { titulo: 'x', listo: { espera: 100 } }).then(r => r.n));
      igual(v, 7);
    });

    await prueba('mientras() propaga el error y cierra sin fiesta', async () => {
      const r = await page.evaluate(async () => {
        try { await KIT.piezas.guardado.mientras(Promise.reject(new Error('no se pudo')), { titulo: 'x' }); return 'no falló'; }
        catch (e) { return e.message + '|' + KIT.piezas.guardado.abierto(); }
      });
      igual(r, 'no se pudo|false');
    });

    await prueba('mientras la ventana está abierta, salir pide confirmación', async () => {
      const hay = await page.evaluate(() => {
        KIT.piezas.guardado.abrir({ titulo: 'x' });
        const ev = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(ev);
        const puesto = ev.defaultPrevented;
        KIT.piezas.guardado.cerrar();
        return puesto;
      });
      cierto(hay, 'debía impedir la salida');
    });

    await prueba('al cerrar se suelta el aviso de salida', async () => {
      const hay = await page.evaluate(() => {
        const ev = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(ev);
        return ev.defaultPrevented;
      });
      falso(hay, 'ya no debía impedir la salida');
    });

    await prueba('en una espera normal de Apps Script ya va por la mitad larga', async () => {
      /* si la curva es demasiado lenta, a los 4 s la barra va por el 45 % con
         la operación casi hecha, y el usuario cree que la app se atascó */
      const w = await page.evaluate(() => {
        KIT.piezas.guardado.cerrar();
        KIT.piezas.guardado.abrir({ titulo: 'ritmo' });
        return new Promise(r => setTimeout(() =>
          r(parseFloat(document.querySelector('.kit-guard__bar').style.width)), 4000));
      });
      cierto(w >= 65, `a los 4 s debía ir por encima del 65 %, va por ${w}`);
      await page.evaluate(() => KIT.piezas.guardado.cerrar());
    });

    await ctx.close();
  }

  /* ═══════════ RUEDA DE FECHAS ═══════════ */
  grupo('fechas');
  {
    const cuerpo = `
      <input id="f1" type="date" data-kit-fecha value="2026-09-21">
      <input id="f2" type="date" data-kit-fecha data-desde="2010" min="2024-03-05" max="2026-12-31">
      <input id="f3" type="text" data-kit-fecha data-anio-fijo="2026">
      <input id="f4" type="text" data-kit-fecha data-solo-anio data-desde="1975">`;
    const { page, ctx } = await pagina(browser, ['fechas'], cuerpo);

    await prueba('montar() prepara los cuatro campos', async () => {
      igual(await page.evaluate(() => KIT.piezas.fechas.montar()), 4);
    });

    await prueba('montar() dos veces no los prepara de nuevo', async () => {
      igual(await page.evaluate(() => KIT.piezas.fechas.montar()), 0);
    });

    await prueba('el campo deja de ser type=date (no sale el calendario nativo)', async () => {
      igual(await page.getAttribute('#f1', 'type'), 'text');
    });

    await prueba('.value sigue hablando ISO hacia el backend', async () => {
      igual(await page.evaluate(() => document.getElementById('f1').value), '2026-09-21');
    });

    await prueba('en pantalla se lee dd/mm/aaaa', async () => {
      igual(await page.inputValue('#f1'), '21/09/2026');
    });

    await prueba('escribir .value en ISO repinta la pantalla', async () => {
      await page.evaluate(() => { document.getElementById('f1').value = '2025-01-02'; });
      igual(await page.inputValue('#f1'), '02/01/2025');
      igual(await page.evaluate(() => document.getElementById('f1').value), '2025-01-02');
    });

    await prueba('tocar el campo abre la rueda', async () => {
      await page.locator('#f1').click();
      cierto(await page.locator('.kit-rueda').isVisible(), 'debía abrirse');
    });

    await prueba('la rueda arranca en la fecha que ya tenía el campo', async () => {
      const sel = await page.evaluate(() => {
        const c = document.querySelector('.kit-rueda__col[data-col="dia"]');
        return c.querySelector('.kit-rueda__item.sel').textContent;
      });
      igual(sel, '02');
    });

    await prueba('el mes sale escrito, no en número', async () => {
      const m = await page.evaluate(() =>
        document.querySelector('.kit-rueda__col[data-col="mes"] .kit-rueda__item.sel').textContent);
      igual(m, 'Enero');
    });

    await prueba('Cancelar no cambia nada', async () => {
      await page.locator('.kit-rueda__cancelar').click();
      await page.waitForTimeout(250);
      igual(await page.evaluate(() => document.getElementById('f1').value), '2025-01-02');
      igual(await page.locator('.kit-rueda').count(), 0);
    });

    await prueba('Escape cierra', async () => {
      await page.locator('#f1').click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      igual(await page.locator('.kit-rueda').count(), 0);
    });

    await prueba('elegir con las flechas y aceptar guarda en ISO', async () => {
      await page.locator('#f1').click();
      await page.locator('.kit-rueda__fl[data-col="dia"][data-p="1"]').click();   // 02 → 03
      await page.locator('.kit-rueda__ok').click();
      await page.waitForTimeout(250);
      igual(await page.evaluate(() => document.getElementById('f1').value), '2025-01-03');
      igual(await page.inputValue('#f1'), '03/01/2025');
    });

    await prueba('aceptar dispara change (la app se entera)', async () => {
      const n = await page.evaluate(async () => {
        window.__ch = 0;
        document.getElementById('f1').addEventListener('change', () => { window.__ch++; });
        document.getElementById('f1').click();
        await new Promise(r => setTimeout(r, 120));
        document.querySelector('.kit-rueda__ok').click();
        await new Promise(r => setTimeout(r, 250));
        return window.__ch;
      });
      igual(n, 1);
    });

    await prueba('el min del input recorta los años de la rueda', async () => {
      await page.locator('#f2').click();
      const anios = await page.evaluate(() =>
        [...document.querySelectorAll('.kit-rueda__col[data-col="anio"] .kit-rueda__item')].map(e => +e.textContent));
      cierto(Math.min(...anios) >= 2024, `el mínimo debía ser 2024, es ${Math.min(...anios)}`);
      cierto(Math.max(...anios) <= 2026, `el máximo debía ser 2026, es ${Math.max(...anios)}`);
    });

    await prueba('con min a mitad de año, enero no se ofrece', async () => {
      await page.evaluate(() => {
        const c = document.querySelector('.kit-rueda__col[data-col="anio"]');
        const it = [...c.querySelectorAll('.kit-rueda__item')].find(e => e.textContent === '2024');
        it.click();
      });
      await page.waitForTimeout(220);
      const meses = await page.evaluate(() =>
        [...document.querySelectorAll('.kit-rueda__col[data-col="mes"] .kit-rueda__item')].map(e => e.textContent));
      falso(meses.indexOf('Enero') >= 0, 'enero de 2024 está antes del min y no debía salir');
      cierto(meses.indexOf('Marzo') >= 0, 'marzo sí debía salir');
      await page.locator('.kit-rueda__cancelar').click();
      await page.waitForTimeout(250);
    });

    await prueba('año fijo: no hay columna de año y se ve la pastilla', async () => {
      await page.locator('#f3').click();
      igual(await page.locator('.kit-rueda__col[data-col="anio"]').count(), 0);
      igual(await page.locator('.kit-rueda__anio').innerText(), '2026');
      await page.locator('.kit-rueda__ok').click();
      await page.waitForTimeout(250);
      cierto(/^\d{4}-\d{2}-\d{2}$/.test(await page.evaluate(() => document.getElementById('f3').value)), 'debía quedar ISO');
      cierto((await page.evaluate(() => document.getElementById('f3').value)).indexOf('2026-') === 0, 'con el año fijo');
    });

    await prueba('solo año: una sola columna', async () => {
      await page.locator('#f4').click();
      igual(await page.locator('.kit-rueda__col[data-col="dia"]').count(), 0);
      igual(await page.locator('.kit-rueda__col[data-col="mes"]').count(), 0);
      igual(await page.locator('.kit-rueda__col[data-col="anio"]').count(), 1);
    });

    await prueba('solo año: va del actual hacia atrás, hasta 1975', async () => {
      const a = await page.evaluate(() =>
        [...document.querySelectorAll('.kit-rueda__col[data-col="anio"] .kit-rueda__item')].map(e => +e.textContent));
      igual(Math.min(...a), 1975);
      cierto(a[0] > a[a.length - 1], 'debía venir en orden descendente');
      await page.locator('.kit-rueda__cancelar').click();
      await page.waitForTimeout(250);
    });

    await prueba('febrero de año bisiesto trae 29 días', async () => {
      const n = await page.evaluate(async () => {
        KIT.piezas.fechas.abrir({ anioDesde: 2024, anioHasta: 2024, valor: { y: 2024, m: 2, d: 1 } });
        await new Promise(r => setTimeout(r, 150));
        const n = document.querySelectorAll('.kit-rueda__col[data-col="dia"] .kit-rueda__item').length;
        KIT.piezas.fechas.cerrar();
        return n;
      });
      igual(n, 29);
    });

    await prueba('febrero de año normal trae 28', async () => {
      const n = await page.evaluate(async () => {
        KIT.piezas.fechas.abrir({ anioDesde: 2026, anioHasta: 2026, valor: { y: 2026, m: 2, d: 1 } });
        await new Promise(r => setTimeout(r, 150));
        const n = document.querySelectorAll('.kit-rueda__col[data-col="dia"] .kit-rueda__item').length;
        KIT.piezas.fechas.cerrar();
        return n;
      });
      igual(n, 28);
    });

    await prueba('pasar de 31 de enero a febrero no deja un día imposible', async () => {
      const r = await page.evaluate(async () => {
        KIT.piezas.fechas.abrir({ anioDesde: 2026, anioHasta: 2026, valor: { y: 2026, m: 1, d: 31 } });
        await new Promise(res => setTimeout(res, 150));
        const mes = document.querySelector('.kit-rueda__col[data-col="mes"]');
        [...mes.querySelectorAll('.kit-rueda__item')].find(e => e.textContent === 'Febrero').click();
        await new Promise(res => setTimeout(res, 250));
        const dias = [...document.querySelectorAll('.kit-rueda__col[data-col="dia"] .kit-rueda__item')].map(e => +e.textContent);
        document.querySelector('.kit-rueda__ok').click();
        await new Promise(res => setTimeout(res, 250));
        return Math.max(...dias);
      });
      igual(r, 28);
    });

    await prueba('aISO y aTexto son inversas', async () => {
      igual(await page.evaluate(() => KIT.piezas.fechas.aTexto(KIT.piezas.fechas.deISO('2026-03-07'))), '07/03/2026');
      igual(await page.evaluate(() => KIT.piezas.fechas.aISO(KIT.piezas.fechas.deTexto('07/03/2026'))), '2026-03-07');
    });

    await prueba('deISO con basura devuelve null, no una fecha inventada', async () => {
      igual(await page.evaluate(() => KIT.piezas.fechas.deISO('hola')), null);
      igual(await page.evaluate(() => KIT.piezas.fechas.deTexto('32/13/2026') === null), false);
    });

    await prueba('un campo deshabilitado no abre la rueda', async () => {
      await page.evaluate(() => { document.getElementById('f1').disabled = true; });
      await page.locator('#f1').click({ force: true });
      await page.waitForTimeout(150);
      igual(await page.locator('.kit-rueda').count(), 0);
      await page.evaluate(() => { document.getElementById('f1').disabled = false; });
    });

    await ctx.close();
  }

  /* ═══════════ ADJUNTOS ═══════════ */
  grupo('adjuntos');
  {
    const { page, ctx } = await pagina(browser, ['adjuntos'], '<div id="zona"></div>');

    const soltar = async (nombres) => page.evaluate((ns) => {
      const dt = new DataTransfer();
      ns.forEach(([n, t, kb]) => dt.items.add(new File([new Uint8Array(kb * 1024)], n, { type: t })));
      const z = document.getElementById('zona');
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      z.dispatchEvent(ev);
    }, nombres);

    await prueba('montar deja la zona lista', async () => {
      await page.evaluate(() => {
        window.__ult = null;
        window.__adj = KIT.piezas.adjuntos.montar('#zona', {
          acepta: 'application/pdf,image/*', varios: true, maximoMB: 1, maximo: 3,
          alCambiar: (a) => { window.__ult = a.map(f => f.name); }
        });
      });
      cierto(await page.locator('.kit-adj__soltar').isVisible(), 'debía verse la zona');
    });

    await prueba('arrastrar un PDF lo adjunta', async () => {
      await soltar([['informe.pdf', 'application/pdf', 20]]);
      igual(await page.evaluate(() => window.__ult), ['informe.pdf']);
      igual(await page.locator('.kit-adj__item').count(), 1);
    });

    await prueba('el mismo archivo dos veces no entra dos veces', async () => {
      await soltar([['informe.pdf', 'application/pdf', 20]]);
      igual(await page.locator('.kit-adj__item').count(), 1);
    });

    await prueba('un tipo no admitido se rechaza', async () => {
      await soltar([['virus.exe', 'application/x-msdownload', 10]]);
      igual(await page.locator('.kit-adj__item').count(), 1);
    });

    await prueba('un archivo que se pasa de peso se rechaza', async () => {
      await soltar([['gordo.pdf', 'application/pdf', 2048]]);
      igual(await page.locator('.kit-adj__item').count(), 1);
    });

    await prueba('el tope de cantidad se respeta', async () => {
      await soltar([['a.pdf', 'application/pdf', 5], ['b.pdf', 'application/pdf', 5], ['c.pdf', 'application/pdf', 5]]);
      igual(await page.locator('.kit-adj__item').count(), 3);
    });

    await prueba('una imagen muestra miniatura, no icono', async () => {
      await page.evaluate(() => window.__adj.limpiar());
      await soltar([['foto.png', 'image/png', 5]]);
      igual(await page.locator('.kit-adj__mini').count(), 1);
    });

    await prueba('la X quita el archivo', async () => {
      await page.locator('.kit-adj__x').click();
      igual(await page.locator('.kit-adj__item').count(), 0);
      igual(await page.evaluate(() => window.__ult), []);
    });

    await prueba('el nombre del archivo no puede inyectar HTML', async () => {
      await soltar([['<img src=x onerror=alert(1)>.pdf', 'application/pdf', 5]]);
      igual(await page.locator('.kit-adj__nom img').count(), 0);
      cierto((await page.locator('.kit-adj__nom').innerText()).indexOf('<img') === 0, 'debía verse como texto');
    });

    await prueba('aBase64 devuelve lo que espera el CORE', async () => {
      const r = await page.evaluate(() => window.__adj.aBase64());
      igual(r.length, 1);
      cierto(typeof r[0].datos === 'string' && r[0].datos.length > 0, 'debía traer datos');
      igual(r[0].tipo, 'application/pdf');
    });

    await prueba('pesoLegible con las tres escalas', async () => {
      igual(await page.evaluate(() => KIT.piezas.adjuntos.pesoLegible(512)), '512 B');
      igual(await page.evaluate(() => KIT.piezas.adjuntos.pesoLegible(2048)), '2 KB');
      igual(await page.evaluate(() => KIT.piezas.adjuntos.pesoLegible(3 * 1048576)), '3.0 MB');
    });

    await prueba('sin varios, el segundo reemplaza al primero', async () => {
      await page.evaluate(() => {
        document.getElementById('zona').innerHTML = '';
        window.__adj2 = KIT.piezas.adjuntos.montar('#zona', { varios: false, maximoMB: 5 });
      });
      await soltar([['uno.pdf', 'application/pdf', 5]]);
      await soltar([['dos.pdf', 'application/pdf', 5]]);
      igual(await page.evaluate(() => window.__adj2.archivos().map(f => f.name)), ['dos.pdf']);
    });

    await ctx.close();
  }

  /* ═══════════ VISOR ═══════════ */
  grupo('visor');
  {
    const { page, ctx } = await pagina(browser, ['visor']);

    await prueba('saca el id de un enlace de Drive /file/d/', async () => {
      igual(await page.evaluate(() => KIT.piezas.visor.idDrive('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view?usp=sharing')),
        '1AbCdEfGhIjKlMnOpQ');
    });

    await prueba('saca el id de la forma open?id=', async () => {
      igual(await page.evaluate(() => KIT.piezas.visor.idDrive('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQ')),
        '1AbCdEfGhIjKlMnOpQ');
    });

    await prueba('una URL que no es de Drive no da id', async () => {
      igual(await page.evaluate(() => KIT.piezas.visor.idDrive('https://ejemplo.com/a.pdf')), '');
    });

    await prueba('para ver, convierte a /preview (si no, el iframe sale en blanco)', async () => {
      igual(await page.evaluate(() => KIT.piezas.visor.paraVer('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view')),
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/preview');
    });

    await prueba('para descargar, usa uc?export=download', async () => {
      cierto((await page.evaluate(() => KIT.piezas.visor.paraBajar('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view')))
        .indexOf('export=download') > 0, 'debía ser enlace de descarga');
    });

    await prueba('una URL ajena se deja intacta', async () => {
      igual(await page.evaluate(() => KIT.piezas.visor.paraVer('https://ejemplo.com/a.pdf')), 'https://ejemplo.com/a.pdf');
    });

    await prueba('abrir con varios documentos pinta los puntos', async () => {
      await page.evaluate(() => KIT.piezas.visor.abrir([
        { titulo: 'Planilla', url: 'https://ejemplo.com/1.pdf' },
        { titulo: 'Informe', url: 'https://ejemplo.com/2.pdf' },
        { titulo: 'Cédula', url: 'https://ejemplo.com/3.png', tipo: 'imagen' }
      ]));
      igual(await page.locator('.kit-visor__punto').count(), 3);
      igual(await page.locator('.kit-visor__t').innerText(), 'Planilla');
      igual(await page.locator('.kit-visor__cuenta').innerText(), '1 de 3');
    });

    await prueba('el Anterior está apagado en el primero', async () => {
      cierto(await page.locator('.kit-visor__nav[data-p="-1"]').isDisabled(), 'debía estar apagado');
    });

    await prueba('Siguiente cambia de documento', async () => {
      await page.locator('.kit-visor__nav[data-p="1"]').click();
      igual(await page.locator('.kit-visor__t').innerText(), 'Informe');
      igual(await page.locator('.kit-visor__cuenta').innerText(), '2 de 3');
    });

    await prueba('las flechas del teclado también navegan', async () => {
      await page.keyboard.press('ArrowRight');
      igual(await page.locator('.kit-visor__t').innerText(), 'Cédula');
      await page.keyboard.press('ArrowLeft');
      igual(await page.locator('.kit-visor__t').innerText(), 'Informe');
    });

    await prueba('un documento de tipo imagen se pinta como <img>, no como iframe', async () => {
      await page.evaluate(() => KIT.piezas.visor.ir(2));
      igual(await page.locator('.kit-visor__lienzo img').count(), 1);
      igual(await page.locator('.kit-visor__lienzo iframe').count(), 0);
    });

    await prueba('minimizar encoge la ventana y quita el velo', async () => {
      await page.locator('.kit-visor__b[data-a="encoger"]').click();
      cierto(await page.evaluate(() => document.querySelector('.kit-visor').classList.contains('kit-visor--chico')), 'debía encoger');
      igual(await page.evaluate(() => getComputedStyle(document.querySelector('.kit-visor__velo')).display), 'none');
    });

    await prueba('volver al tamaño normal', async () => {
      await page.locator('.kit-visor__b[data-a="encoger"]').click();
      falso(await page.evaluate(() => document.querySelector('.kit-visor').classList.contains('kit-visor--chico')), 'debía volver');
    });

    await prueba('el título del documento no inyecta HTML', async () => {
      await page.evaluate(() => KIT.piezas.visor.abrir([{ titulo: '<b>x</b>', url: 'https://ejemplo.com/1.pdf' }]));
      igual(await page.locator('.kit-visor__t b').count(), 0);
    });

    await prueba('con un solo documento se esconde el pie', async () => {
      cierto(await page.locator('.kit-visor__pie').isHidden(), 'el pie sobra con uno solo');
    });

    await prueba('Escape cierra y suelta el iframe', async () => {
      await page.keyboard.press('Escape');
      falso(await page.evaluate(() => KIT.piezas.visor.abierto()), 'debía cerrarse');
      igual(await page.locator('.kit-visor__lienzo iframe').count(), 0);
    });

    await prueba('abrir sin documentos no rompe', async () => {
      igual(await page.evaluate(() => { KIT.piezas.visor.abrir([]); return KIT.piezas.visor.abierto(); }), false);
    });

    await ctx.close();
  }

  /* ═══════════ CARRUSEL ═══════════ */
  grupo('carrusel');
  {
    const { page, ctx } = await pagina(browser, ['carrusel']);

    await prueba('abre con la tira de miniaturas', async () => {
      await page.evaluate(() => KIT.piezas.carrusel.abrir([
        { url: 'https://ejemplo.com/a.png', titulo: 'Firma' },
        { url: 'https://ejemplo.com/b.png', titulo: 'Cédula' }
      ]));
      igual(await page.locator('.kit-carr__tira').count(), 2);
      igual(await page.locator('.kit-carr__t').innerText(), 'Firma');
    });

    await prueba('empieza al 100 %', async () => {
      igual(await page.evaluate(() => KIT.piezas.carrusel.nivel()), 1);
      igual(await page.locator('.kit-carr__z').innerText(), '100%');
    });

    await prueba('el botón + acerca', async () => {
      await page.locator('.kit-carr__b[data-a="mas"]').click();
      cierto(await page.evaluate(() => KIT.piezas.carrusel.nivel()) > 1, 'debía acercar');
    });

    await prueba('el zoom no pasa de 6x por más que se insista', async () => {
      await page.evaluate(() => { for (let k = 0; k < 40; k++) KIT.piezas.carrusel.zoom(KIT.piezas.carrusel.nivel() + 1); });
      igual(await page.evaluate(() => KIT.piezas.carrusel.nivel()), 6);
    });

    await prueba('el zoom no baja de 1x', async () => {
      await page.evaluate(() => { for (let k = 0; k < 40; k++) KIT.piezas.carrusel.zoom(KIT.piezas.carrusel.nivel() - 1); });
      igual(await page.evaluate(() => KIT.piezas.carrusel.nivel()), 1);
    });

    await prueba('⤢ vuelve al tamaño original', async () => {
      await page.evaluate(() => KIT.piezas.carrusel.zoom(3));
      await page.locator('.kit-carr__b[data-a="reset"]').click();
      igual(await page.evaluate(() => KIT.piezas.carrusel.nivel()), 1);
    });

    await prueba('cambiar de imagen deja el zoom en 1 (no se hereda)', async () => {
      await page.evaluate(() => KIT.piezas.carrusel.zoom(4));
      await page.evaluate(() => KIT.piezas.carrusel.ir(1));
      igual(await page.evaluate(() => KIT.piezas.carrusel.nivel()), 1);
      igual(await page.locator('.kit-carr__t').innerText(), 'Cédula');
    });

    await prueba('el botón de reemplazar solo sale si hay a quién avisar', async () => {
      cierto(await page.locator('.kit-carr__b--rep').isHidden(), 'sin alReemplazar debía estar oculto');
      await page.evaluate(() => KIT.piezas.carrusel.abrir([{ url: 'https://ejemplo.com/a.png', titulo: 'x' }],
        { alReemplazar: () => {} }));
      cierto(await page.locator('.kit-carr__b--rep').isVisible(), 'con alReemplazar debía verse');
    });

    await prueba('con una sola imagen no hay flechas ni tira', async () => {
      cierto(await page.locator('.kit-carr__fl--izq').isHidden(), 'sobra la flecha');
      cierto(await page.locator('.kit-carr__tiras').isHidden(), 'sobra la tira');
    });

    await prueba('Escape cierra', async () => {
      await page.keyboard.press('Escape');
      falso(await page.evaluate(() => KIT.piezas.carrusel.abierto()), 'debía cerrarse');
    });

    await ctx.close();
  }

  /* ═══════════ PASTILLAS ═══════════ */
  grupo('pastillas');
  {
    const { page, ctx } = await pagina(browser, ['pastillas'], '<div id="filtros"></div>');

    await prueba('monta las opciones que se le dan', async () => {
      await page.evaluate(() => {
        window.__v = null;
        window.__p = KIT.piezas.pastillas.montar('#filtros', {
          opciones: [{ valor: '', texto: 'Todas' }, { valor: 'REPORTADA', texto: 'Reportadas', tono: 'ok' },
                     { valor: 'DEVUELTA', texto: 'Devueltas', tono: 'malo' }],
          valor: '',
          alCambiar: (v) => { window.__v = v; }
        });
      });
      igual(await page.locator('.kit-pastilla').count(), 3);
    });

    await prueba('la elegida queda marcada', async () => {
      igual(await page.getAttribute('.kit-pastilla[data-valor=""]', 'aria-pressed'), 'true');
    });

    await prueba('tocar otra cambia el valor y avisa', async () => {
      await page.locator('.kit-pastilla[data-valor="DEVUELTA"]').click();
      igual(await page.evaluate(() => window.__v), 'DEVUELTA');
      igual(await page.evaluate(() => window.__p.valor()), 'DEVUELTA');
      igual(await page.getAttribute('.kit-pastilla[data-valor=""]', 'aria-pressed'), 'false');
    });

    await prueba('los conteos se pintan con formato', async () => {
      await page.evaluate(() => window.__p.conteos({ '': 9459, REPORTADA: 40, DEVUELTA: 14 }));
      igual(await page.locator('.kit-pastilla[data-valor=""] .kit-pastilla__conteo').innerText(), '9.459');
    });

    await prueba('lo que no traiga conteo se queda sin número (mejor que un cero falso)', async () => {
      await page.evaluate(() => window.__p.conteos({ '': 5 }));
      igual(await page.locator('.kit-pastilla[data-valor="DEVUELTA"] .kit-pastilla__conteo').count(), 0);
    });

    await prueba('deja() filtra según lo elegido', async () => {
      await page.evaluate(() => window.__p.poner('DEVUELTA'));
      cierto(await page.evaluate(() => window.__p.deja('DEVUELTA')), 'debía dejar pasar');
      falso(await page.evaluate(() => window.__p.deja('APROBADA')), 'no debía dejar pasar');
    });

    await prueba('con "todas" pasa todo', async () => {
      await page.evaluate(() => window.__p.poner(''));
      cierto(await page.evaluate(() => window.__p.deja('LO-QUE-SEA')), 'debía dejar pasar todo');
    });

    await prueba('contarSobre saca los conteos de las filas', async () => {
      const m = await page.evaluate(() => window.__p.contarSobre(
        [{ e: 'A' }, { e: 'A' }, { e: 'B' }], 'e'));
      igual(m, { '': 3, A: 2, B: 1 });
    });

    await prueba('opcionesDesde arma las pastillas con lo que traen los datos', async () => {
      await page.evaluate(() => window.__p.opcionesDesde(
        [{ s: 'HACIENDA' }, { s: 'GOBIERNO' }, { s: 'HACIENDA' }, { s: '' }], 's'));
      igual(await page.locator('.kit-pastilla').count(), 3);   /* Todas + 2 */
      igual(await page.locator('.kit-pastilla').nth(1).innerText(), 'GOBIERNO');  /* ordenadas */
    });

    await prueba('varias a la vez', async () => {
      await page.evaluate(() => {
        document.getElementById('filtros').innerHTML = '';
        window.__m = KIT.piezas.pastillas.montar('#filtros', {
          multiple: true,
          opciones: [{ valor: '', texto: 'Todas' }, { valor: 'A', texto: 'A' }, { valor: 'B', texto: 'B' }]
        });
        window.__m.poner(['A']);
      });
      await page.locator('.kit-pastilla[data-valor="B"]').click();
      igual(await page.evaluate(() => window.__m.valor().sort()), ['A', 'B']);
    });

    await prueba('en múltiple, "Todas" apaga las demás', async () => {
      await page.locator('.kit-pastilla[data-valor=""]').click();
      igual(await page.evaluate(() => window.__m.valor()), []);
      cierto(await page.evaluate(() => window.__m.deja('LO-QUE-SEA')), 'sin nada marcado pasa todo');
    });

    await prueba('el texto de la opción no inyecta HTML', async () => {
      await page.evaluate(() => window.__m.opciones([{ valor: 'x', texto: '<i>hola</i>' }]));
      igual(await page.locator('.kit-pastilla i').count(), 0);
    });

    await ctx.close();
  }

  /* ═══════════ ANTI DOBLE CLIC ═══════════ */
  grupo('antidoble');
  {
    const { page, ctx } = await pagina(browser, ['antidoble'], '<button id="b">Reportar</button>');

    await prueba('una() deja pasar el primer clic', async () => {
      const n = await page.evaluate(async () => {
        window.__n = 0;
        const f = KIT.piezas.antidoble.una(() => { window.__n++; return new Promise(r => setTimeout(r, 300)); });
        f();
        return window.__n;
      });
      igual(n, 1);
    });

    await prueba('una() bloquea el segundo mientras el primero vuela', async () => {
      const n = await page.evaluate(async () => {
        window.__n = 0;
        const f = KIT.piezas.antidoble.una(() => { window.__n++; return new Promise(r => setTimeout(r, 300)); });
        f(); f(); f();
        await new Promise(r => setTimeout(r, 60));
        return window.__n;
      });
      igual(n, 1);
    });

    await prueba('una() suelta el candado al terminar bien', async () => {
      const n = await page.evaluate(async () => {
        window.__n = 0;
        const f = KIT.piezas.antidoble.una(() => { window.__n++; return new Promise(r => setTimeout(r, 120)); });
        await f();
        await f();
        return window.__n;
      });
      igual(n, 2);
    });

    await prueba('una() suelta el candado AUNQUE FALLE (si no, hay que recargar)', async () => {
      const n = await page.evaluate(async () => {
        window.__n = 0;
        const f = KIT.piezas.antidoble.una(() => { window.__n++; return Promise.reject(new Error('x')); });
        try { await f(); } catch (e) {}
        try { await f(); } catch (e) {}
        return window.__n;
      });
      igual(n, 2);
    });

    await prueba('una() suelta el candado si la función lanza sin promesa', async () => {
      const n = await page.evaluate(async () => {
        window.__n = 0;
        const f = KIT.piezas.antidoble.una(() => { window.__n++; throw new Error('x'); });
        try { f(); } catch (e) {}
        try { f(); } catch (e) {}
        return window.__n;
      });
      igual(n, 2);
    });

    await prueba('el escudo se levanta mientras se guarda', async () => {
      await page.evaluate(() => {
        window.__soltar = KIT.piezas.antidoble.escudo();
      });
      cierto(await page.evaluate(() => KIT.piezas.antidoble.ocupado()), 'debía estar ocupado');
      igual(await page.evaluate(() => getComputedStyle(document.querySelector('.kit-escudo')).display), 'block');
    });

    await prueba('el escudo es invisible (si se viera, parecería colgada)', async () => {
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.kit-escudo')).backgroundColor);
      cierto(/rgba\(0, 0, 0, 0\)|transparent/.test(bg), `debía ser transparente, es ${bg}`);
    });

    await prueba('el escudo se baja al soltar', async () => {
      await page.evaluate(() => window.__soltar());
      falso(await page.evaluate(() => KIT.piezas.antidoble.ocupado()), 'debía bajarse');
      igual(await page.evaluate(() => getComputedStyle(document.querySelector('.kit-escudo')).display), 'none');
    });

    await prueba('dos escudos a la vez: el primero en soltar no lo baja', async () => {
      const r = await page.evaluate(() => {
        const s1 = KIT.piezas.antidoble.escudo();
        const s2 = KIT.piezas.antidoble.escudo();
        s1();
        const aMedias = KIT.piezas.antidoble.ocupado();
        s2();
        return [aMedias, KIT.piezas.antidoble.ocupado()];
      });
      igual(r, [true, false]);
    });

    await prueba('soltar dos veces el mismo escudo no descuenta de más', async () => {
      const r = await page.evaluate(() => {
        const s1 = KIT.piezas.antidoble.escudo();
        const s2 = KIT.piezas.antidoble.escudo();
        s1(); s1(); s1();
        const sigue = KIT.piezas.antidoble.ocupado();
        s2();
        return [sigue, KIT.piezas.antidoble.ocupado()];
      });
      igual(r, [true, false]);
    });

    await prueba('el botón marcado se bloquea y se suelta solo', async () => {
      await page.evaluate(() => {
        document.getElementById('b').setAttribute('data-kit-una-vez', '300');
        window.__c = 0;
        document.getElementById('b').addEventListener('click', () => { window.__c++; });
        KIT.piezas.antidoble.montar();
      });
      await page.locator('#b').click();
      igual(await page.evaluate(() => window.__c), 1);
      cierto(await page.locator('#b').isDisabled(), 'debía quedar bloqueado');
      await page.waitForTimeout(500);
      falso(await page.locator('#b').isDisabled(), 'debía soltarse');
    });

    await ctx.close();
  }

  /* ═══════════ LISTAS (CARGA ÚNICA) ═══════════ */
  grupo('listas');
  {
    const { page, ctx } = await pagina(browser, ['listas']);

    const crear = async (extra = '{}') => page.evaluate((e) => {
      window.__viajes = 0;
      window.__L = KIT.piezas.listas.crear(Object.assign({
        clave: 'id',
        traer: () => { window.__viajes++; return Promise.resolve({
          campos: ['id', 'nombre', 'estado', 'monto'],
          filas: [
            [1, 'EDILBERTO RAMÍREZ', 'REPORTADA', 2500000],
            [2, 'ANA PEÑA',          'DEVUELTA',  900000],
            [3, 'ANA PENA',          'REPORTADA', 1200000],
            [4, 'JOSÉ GÓMEZ',        'APROBADA',  300000]
          ] }); }
      }, JSON.parse(e)));
    }, extra);

    await prueba('el formato compacto se expande a objetos', async () => {
      igual(await page.evaluate(() => KIT.piezas.listas.expandir(
        { campos: ['a', 'b'], filas: [[1, 2], [3, 4]] })), [{ a: 1, b: 2 }, { a: 3, b: 4 }]);
    });

    await prueba('expandir aguanta que ya vengan objetos', async () => {
      igual(await page.evaluate(() => KIT.piezas.listas.expandir([{ a: 1 }])), [{ a: 1 }]);
    });

    await prueba('cargar trae las filas', async () => {
      await crear();
      igual(await page.evaluate(() => window.__L.cargar().then(f => f.length)), 4);
    });

    await prueba('cargar dos veces NO vuelve al servidor', async () => {
      await page.evaluate(() => window.__L.cargar());
      igual(await page.evaluate(() => window.__viajes), 1);
    });

    await prueba('refrescar sí vuelve', async () => {
      await page.evaluate(() => window.__L.refrescar());
      igual(await page.evaluate(() => window.__viajes), 2);
    });

    await prueba('dos cargas a la vez comparten el mismo viaje', async () => {
      const v = await page.evaluate(async () => {
        window.__L.olvidar();
        window.__viajes = 0;
        await Promise.all([window.__L.cargar(), window.__L.cargar(), window.__L.cargar()]);
        return window.__viajes;
      });
      igual(v, 1);
    });

    await prueba('filtrar pasa en el dispositivo, sin viajes', async () => {
      const r = await page.evaluate(() => {
        const antes = window.__viajes;
        const v = window.__L.ver({ filtra: f => f.estado === 'REPORTADA' });
        return [v.total, window.__viajes - antes];
      });
      igual(r, [2, 0]);
    });

    await prueba('buscar ignora tildes', async () => {
      igual(await page.evaluate(() => window.__L.ver({ busca: 'ramirez', campos: ['nombre'] }).total), 1);
      igual(await page.evaluate(() => window.__L.ver({ busca: 'gomez', campos: ['nombre'] }).total), 1);
    });

    await prueba('buscar distingue PEÑA de PENA', async () => {
      igual(await page.evaluate(() => window.__L.ver({ busca: 'peña', campos: ['nombre'] }).total), 1);
      igual(await page.evaluate(() => window.__L.ver({ busca: 'peña', campos: ['nombre'] }).filas[0].id), 2);
    });

    await prueba('buscar por varias palabras en cualquier orden', async () => {
      igual(await page.evaluate(() => window.__L.ver({ busca: 'ramirez edilberto', campos: ['nombre'] }).total), 1);
    });

    await prueba('ordenar por número ordena como número, no como texto', async () => {
      igual(await page.evaluate(() => window.__L.ver({ ordena: 'monto' }).filas.map(f => f.monto)),
        [300000, 900000, 1200000, 2500000]);
    });

    await prueba('ordenar al revés', async () => {
      igual(await page.evaluate(() => window.__L.ver({ ordena: 'monto', desc: true }).filas[0].monto), 2500000);
    });

    await prueba('ordenar por texto usa el orden del español', async () => {
      igual(await page.evaluate(() => window.__L.ver({ ordena: 'nombre' }).filas[0].nombre), 'ANA PENA');
    });

    await prueba('paginar da total y páginas correctos', async () => {
      const v = await page.evaluate(() => window.__L.ver({ porPagina: 3, pagina: 2 }));
      igual([v.total, v.paginas, v.pagina, v.filas.length], [4, 2, 2, 1]);
    });

    await prueba('pedir una página que no existe cae en la última', async () => {
      igual(await page.evaluate(() => window.__L.ver({ porPagina: 3, pagina: 99 }).pagina), 2);
    });

    await prueba('una() encuentra por la clave', async () => {
      igual(await page.evaluate(() => window.__L.una(2).nombre), 'ANA PEÑA');
      igual(await page.evaluate(() => window.__L.una(999)), null);
    });

    await prueba('cambiar toca la fila sin volver al servidor', async () => {
      const r = await page.evaluate(() => {
        const antes = window.__viajes;
        window.__L.cambiar(2, { estado: 'APROBADA' });
        return [window.__L.una(2).estado, window.__viajes - antes];
      });
      igual(r, ['APROBADA', 0]);
    });

    await prueba('quitar saca la fila y deja de encontrarse', async () => {
      const r = await page.evaluate(() => [window.__L.quitar(4), window.__L.una(4), window.__L.total()]);
      igual(r, [true, null, 3]);
    });

    await prueba('meter la pone de primera', async () => {
      igual(await page.evaluate(() => { window.__L.meter({ id: 9, nombre: 'NUEVA' }); return window.__L.todas()[0].id; }), 9);
    });

    await prueba('la caché evita el viaje en la siguiente sesión', async () => {
      const v = await page.evaluate(async () => {
        window.__viajes = 0;
        const A = KIT.piezas.listas.crear({ clave: 'id', cache: 'pru', cacheMinutos: 5,
          traer: () => { window.__viajes++; return Promise.resolve({ campos: ['id'], filas: [[1], [2]] }); } });
        await A.cargar();
        const B = KIT.piezas.listas.crear({ clave: 'id', cache: 'pru', cacheMinutos: 5,
          traer: () => { window.__viajes++; return Promise.resolve({ campos: ['id'], filas: [[1], [2]] }); } });
        const filas = await B.cargar();
        return [filas.length, window.__viajes];
      });
      igual(v[0], 2);
      igual(v[1], 1);   /* el segundo salió de la caché */
    });

    await prueba('la caché caducada no se usa', async () => {
      const v = await page.evaluate(async () => {
        window.__viajes = 0;
        KIT.guardar.escribir('lista.vieja', { t: Date.now() - 99 * 60000, d: { campos: ['id'], filas: [[7]] } });
        const A = KIT.piezas.listas.crear({ clave: 'id', cache: 'vieja', cacheMinutos: 1,
          traer: () => { window.__viajes++; return Promise.resolve({ campos: ['id'], filas: [[1]] }); } });
        const f = await A.cargar();
        return [f[0].id, window.__viajes];
      });
      igual(v, [1, 1]);
    });

    await prueba('si el servidor falla, el error llega a la app', async () => {
      const m = await page.evaluate(async () => {
        const A = KIT.piezas.listas.crear({ traer: () => Promise.reject(new Error('caído')) });
        try { await A.cargar(); return 'no falló'; } catch (e) { return e.message + '|' + A.cargado(); }
      });
      igual(m, 'caído|false');
    });

    await prueba('tras fallar se puede reintentar', async () => {
      const n = await page.evaluate(async () => {
        let veces = 0;
        const A = KIT.piezas.listas.crear({ traer: () => { veces++; return veces === 1 ? Promise.reject(new Error('x')) : Promise.resolve([{ id: 1 }]); } });
        try { await A.cargar(); } catch (e) {}
        const f = await A.cargar();
        return f.length;
      });
      igual(n, 1);
    });

    await ctx.close();
  }

  /* ═══════════ SESIÓN ═══════════ */
  grupo('sesion');
  {
    const { page, ctx } = await pagina(browser, ['sesion', 'conexion']);

    /* el CORE de verdad no se toca: se finge la respuesta */
    const fingir = async (respuesta) => page.evaluate((r) => {
      window.__pedidos = [];
      window.KIT.pedir = (accion, datos, op) => {
        window.__pedidos.push({ accion, datos, op });
        const p = r[accion];
        if (!p) return Promise.reject(Object.assign(new Error('no'), { codigo: 'ERROR' }));
        if (p.error) return Promise.reject(Object.assign(new Error(p.error.msg || 'x'), { codigo: p.error.codigo }));
        return Promise.resolve(p);
      };
    }, respuesta);

    await prueba('la puerta se pinta si no hay sesión', async () => {
      await fingir({});
      await page.evaluate(() => KIT.piezas.sesion.entrar({ titulo: 'CONTRATACIÓN' }));
      cierto(await page.locator('.kit-sesion').isVisible(), 'debía verse la puerta');
      igual(await page.locator('.kit-sesion__t').innerText(), 'CONTRATACIÓN');
    });

    await prueba('sin documento, avisa y no llama al servidor', async () => {
      await page.evaluate(() => { window.__pedidos = []; });
      await page.locator('.kit-sesion__entrar').click();
      igual(await page.evaluate(() => window.__pedidos.length), 0);
      await page.waitForTimeout(300);   /* el aviso se abre con transición */
      cierto(await page.locator('.kit-sesion__error--on').isVisible(), 'debía avisar');
      igual(await page.locator('.kit-sesion__error').innerText(), 'Escribe tu número de documento.');
    });

    await prueba('el documento se limpia de puntos antes de mandarlo', async () => {
      await fingir({ login: { token: 'T1', usuario: { nombre: 'ANA', rol: 'CREADOR' } } });
      await page.fill('[name="documento"]', '1.070.590.350');
      await page.fill('[name="clave"]', 'secreta');
      await page.locator('.kit-sesion__entrar').click();
      await page.waitForTimeout(150);
      igual(await page.evaluate(() => window.__pedidos[0].datos.documento), '1070590350');
    });

    await prueba('el login NO manda token (es la puerta)', async () => {
      igual(await page.evaluate(() => window.__pedidos[0].op.sinToken), true);
    });

    await prueba('al entrar se guarda el token y el usuario', async () => {
      await page.waitForTimeout(250);
      igual(await page.evaluate(() => KIT.token()), 'T1');
      igual(await page.evaluate(() => KIT.piezas.sesion.yo().nombre), 'ANA');
    });

    await prueba('la puerta se retira al entrar', async () => {
      await page.waitForTimeout(350);
      igual(await page.locator('.kit-sesion').count(), 0);
    });

    await prueba('la contraseña NO se guarda en el dispositivo', async () => {
      const hay = await page.evaluate(() => {
        let malo = false;
        for (let i = 0; i < localStorage.length; i++) {
          if (String(localStorage.getItem(localStorage.key(i))).indexOf('secreta') >= 0) malo = true;
        }
        return malo;
      });
      falso(hay, 'la contraseña no puede quedar en localStorage');
    });

    await prueba('el documento sí se recuerda para la próxima', async () => {
      igual(await page.evaluate(() => KIT.guardar.leer('sesion.ultimoDocumento')), '1070590350');
    });

    await prueba('salir borra token y usuario', async () => {
      await page.evaluate(() => KIT.piezas.sesion.salir(true));
      igual(await page.evaluate(() => KIT.token()), '');
      igual(await page.evaluate(() => KIT.piezas.sesion.yo()), null);
    });

    await prueba('un error del servidor se muestra, no se traga', async () => {
      await fingir({ login: { error: { codigo: 'CLAVE_MALA', msg: 'Contraseña incorrecta. Te quedan 4 intentos.' } } });
      await page.fill('[name="documento"]', '123');
      await page.fill('[name="clave"]', 'mala');
      await page.locator('.kit-sesion__entrar').click();
      await page.waitForTimeout(200);
      igual(await page.locator('.kit-sesion__error').innerText(), 'Contraseña incorrecta. Te quedan 4 intentos.');
    });

    await prueba('el botón se suelta tras el error (si no, hay que recargar)', async () => {
      falso(await page.locator('.kit-sesion__entrar').isDisabled(), 'debía soltarse');
      igual(await page.locator('.kit-sesion__entrar').innerText(), 'Entrar');
    });

    await prueba('sin red, el mensaje dice que es la conexión', async () => {
      await fingir({ login: { error: { codigo: 'SIN_RED' } } });
      await page.locator('.kit-sesion__entrar').click();
      await page.waitForTimeout(200);
      cierto((await page.locator('.kit-sesion__error').innerText()).indexOf('No hay internet') === 0, 'debía culpar a la conexión');
    });

    await prueba('el ojo muestra y esconde la contraseña', async () => {
      igual(await page.getAttribute('[name="clave"]', 'type'), 'password');
      await page.locator('.kit-sesion__ojo').click();
      igual(await page.getAttribute('[name="clave"]', 'type'), 'text');
      await page.locator('.kit-sesion__ojo').click();
      igual(await page.getAttribute('[name="clave"]', 'type'), 'password');
    });

    await prueba('con dos contratos, se pide elegir', async () => {
      await fingir({ login: { token: 'T2', contratos: [
        { idContrato: '1070602493-027', secretaria: 'HACIENDA', supervisor: 'DIEGO' },
        { idContrato: '1070602493-031', secretaria: 'GOBIERNO', supervisor: 'LIDA' }
      ] } });
      await page.fill('[name="documento"]', '1070602493');
      await page.fill('[name="clave"]', 'x');
      await page.locator('.kit-sesion__entrar').click();
      await page.waitForTimeout(250);
      igual(await page.locator('.kit-sesion__contrato').count(), 2);
    });

    await prueba('con dos contratos NO se entra todavía', async () => {
      igual(await page.evaluate(() => KIT.token()), '');
    });

    await prueba('elegir contrato manda el id y entra', async () => {
      await page.evaluate(() => {
        const antes = window.KIT.pedir;
        window.KIT.pedir = (a, d, o) => {
          window.__pedidos.push({ accion: a, datos: d, op: o });
          if (a === 'elegirContrato') return Promise.resolve({ token: 'T3', usuario: { nombre: 'EDILBERTO' } });
          return antes(a, d, o);
        };
      });
      await page.locator('.kit-sesion__contrato').first().click();
      await page.waitForTimeout(300);
      const p = await page.evaluate(() => window.__pedidos[window.__pedidos.length - 1]);
      igual(p.datos.idContrato, '1070602493-027');
      igual(await page.evaluate(() => KIT.token()), 'T3');
    });

    await prueba('con sesión guardada, se comprueba contra el CORE antes de entrar', async () => {
      const r = await page.evaluate(async () => {
        KIT.ponerToken('T-viejo');
        window.__pedidos = [];
        window.KIT.pedir = (a) => { window.__pedidos.push(a); return Promise.resolve({ nombre: 'YO' }); };
        let entro = null;
        await KIT.piezas.sesion.entrar({ alEntrar: (y) => { entro = y; } });
        return [window.__pedidos, entro && entro.nombre];
      });
      igual(r[0], ['yo']);
      igual(r[1], 'YO');
    });

    await prueba('si el token guardado ya no vale, se vuelve a la puerta', async () => {
      await page.evaluate(async () => {
        KIT.ponerToken('T-caducado');
        window.__pedidos = [];
        window.KIT.pedir = (a, d, o) => {
          window.__pedidos.push({ accion: a, datos: d, op: o });
          return Promise.reject(Object.assign(new Error('x'), { codigo: 'SESION_VENCIDA' }));
        };
        await KIT.piezas.sesion.entrar({});
      });
      await page.waitForTimeout(150);
      cierto(await page.locator('.kit-sesion').isVisible(), 'debía volver a la puerta');
      igual(await page.evaluate(() => KIT.token()), '');
    });

    await prueba('"olvidé" sin documento no llama al servidor', async () => {
      await page.evaluate(() => { window.__pedidos = []; });
      await page.fill('[name="documento"]', '');
      await page.locator('.kit-sesion__olvide').click();
      await page.waitForTimeout(120);
      igual(await page.evaluate(() => window.__pedidos.length), 0);
    });

    await prueba('"olvidé" manda el documento y NO enseña la clave', async () => {
      await page.evaluate(() => {
        window.__pedidos = [];
        window.KIT.pedir = (a, d) => { window.__pedidos.push({ a, d }); return Promise.resolve({ telefono: '3103230712' }); };
      });
      await page.fill('[name="documento"]', '1070590350');
      await page.locator('.kit-sesion__olvide').click();
      await page.waitForTimeout(250);
      igual(await page.evaluate(() => window.__pedidos[0].a), 'recuperarClave');
      const txt = await page.locator('.kit-resc__hoja').innerText();
      cierto(txt.indexOf('0712') > 0, 'debía decir los últimos 4 dígitos');
      falso(txt.indexOf('3103230712') > 0, 'NO debía enseñar el número completo');
    });

    await ctx.close();
  }

  /* ═══════════ INSTALAR ═══════════ */
  grupo('instalar');
  {
    const { page, ctx } = await pagina(browser, ['instalar', 'bienvenida'], '<div id="donde"></div>');

    await prueba('en Chromium de escritorio, sin aviso previo, es el caso escritorio', async () => {
      await page.evaluate(() => KIT.piezas.instalar.vigilar());
      igual(await page.evaluate(() => KIT.piezas.instalar.caso()), 'escritorio');
      cierto(await page.evaluate(() => KIT.piezas.instalar.sePuede()),
             'sin aviso del navegador TAMBIEN se ofrece: hay camino que ensenar');
      igual(await page.evaluate(() => KIT.piezas.instalar.etiqueta()), 'Como instalarla'.replace('Como','Cómo'));
    });

    await prueba('cuando llega el aviso del navegador, ya se puede', async () => {
      await page.evaluate(() => {
        const e = new Event('beforeinstallprompt');
        e.prompt = () => { window.__promptLlamado = true; };
        e.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(e);
      });
      igual(await page.evaluate(() => KIT.piezas.instalar.caso()), 'listo');
    });

    await prueba('el botón aparece solo cuando se puede', async () => {
      await page.evaluate(() => KIT.piezas.instalar.boton('#donde'));
      cierto(await page.locator('.kit-inst__b').isVisible(), 'debía verse');
    });

    await prueba('pulsar el botón llama al aviso de verdad del navegador', async () => {
      await page.locator('.kit-inst__b').click();
      await page.waitForTimeout(150);
      cierto(await page.evaluate(() => window.__promptLlamado), 'debía llamar a prompt()');
    });

    await prueba('el aviso del navegador solo sirve una vez', async () => {
      igual(await page.evaluate(() => KIT.piezas.instalar.caso()), 'escritorio');
    });

    await prueba('si ya está instalada, no se ofrece nada', async () => {
      const c = await page.evaluate(() => {
        const real = window.matchMedia;
        window.matchMedia = (q) => q.indexOf('standalone') >= 0 ? { matches: true } : real(q);
        const r = KIT.piezas.instalar.caso();
        window.matchMedia = real;
        return r;
      });
      igual(c, 'instalada');
    });

    await prueba('en el computador se dice donde esta el icono de instalar', async () => {
      /* sin await: abrir() no resuelve hasta que el usuario cierra la hoja */
      await page.evaluate(() => { KIT.piezas.instalar.abrir(); });
      await page.waitForTimeout(150);
      const t = await page.locator('.kit-inst__cuerpo').innerText();
      cierto(/barra de direcciones/i.test(t), 'debía decir dónde mirar');
      cierto(/Chrome|Edge/.test(t), 'debía nombrar los navegadores que sí pueden');
    });

    await prueba('cada plataforma tiene su propio camino, sin cajon de sastre', async () => {
      const casos = ['ios-safari', 'ios-otro', 'mac-safari', 'embebido', 'firefox', 'escritorio'];
      const vistos = {};
      for (const c of casos) {
        const t = await page.evaluate((cc) => {
          const h = document.createElement('div');
          h.innerHTML = KIT.piezas.instalar.__pasos(cc);
          return h.innerText || h.textContent;
        }, c);
        cierto(t && t.length > 80, 'el caso ' + c + ' debía traer pasos');
        cierto(!vistos[t], 'el caso ' + c + ' no debía repetir el texto de otro');
        vistos[t] = true;
      }
      const ios = await page.evaluate(() => {
        const h = document.createElement('div');
        h.innerHTML = KIT.piezas.instalar.__pasos('ios-safari');
        return h.innerText || h.textContent;
      });
      cierto(/Compartir/.test(ios), 'iOS debía hablar de Compartir');
      const mac = await page.evaluate(() => {
        const h = document.createElement('div');
        h.innerHTML = KIT.piezas.instalar.__pasos('mac-safari');
        return h.innerText || h.textContent;
      });
      cierto(/Dock/.test(mac), 'Mac debía hablar del Dock');
      const emb = await page.evaluate(() => {
        const h = document.createElement('div');
        h.innerHTML = KIT.piezas.instalar.__pasos('embebido');
        return h.innerText || h.textContent;
      });
      cierto(/WhatsApp|Instagram/.test(emb), 'el navegador interno debía avisarse');
    });

    await prueba('ofrece copiar el enlace como salida', async () => {
      cierto(await page.locator('.kit-inst__copiar').isVisible(), 'debía ofrecer copiar');
      await page.locator('.kit-capa__x').click();
    });

    await prueba('LA PUERTA NO SE ESCONDE: sale la segunda vez y la tercera', async () => {
      for (let i = 1; i <= 3; i++) {
        await page.evaluate(() => { KIT.piezas.bienvenida.abrir({ titulo: 'X', sub: 'Y' }); });
        await page.waitForTimeout(120);
        cierto(await page.locator('.kit-bien').isVisible(), 'debía salir en la vuelta ' + i);
        await page.locator('.kit-bien__seguir').click();
        await page.waitForTimeout(320);
      }
    });

    await prueba('la puerta NO sale si la app ya corre instalada', async () => {
      const salida = await page.evaluate(async () => {
        const real = window.matchMedia;
        window.matchMedia = (q) => q.indexOf('standalone') >= 0 ? { matches: true } : real(q);
        const r = await KIT.piezas.bienvenida.abrir({ titulo: 'X' });
        window.matchMedia = real;
        return r;
      });
      igual(salida, 'saltada');
    });

    await prueba('la puerta NO sale si se llega con destino en la direccion', async () => {
      const salida = await page.evaluate(async () => {
        location.hash = '#/cuentas';
        const r = await KIT.piezas.bienvenida.abrir({ titulo: 'X' });
        location.hash = '';
        return r;
      });
      igual(salida, 'saltada');
    });

    await prueba('el rotulo del boton lo dicta la plataforma', async () => {
      await page.evaluate(() => { KIT.piezas.bienvenida.abrir({ titulo: 'X' }); });
      await page.waitForTimeout(120);
      const r = await page.locator('.kit-bien__rot').innerText();
      igual(r, await page.evaluate(() => KIT.piezas.instalar.etiqueta()));
      await page.locator('.kit-bien__seguir').click();
      await page.waitForTimeout(320);
    });

    /* iPhone: se cambia el userAgent en un contexto nuevo */
    await prueba('en iPhone se enseña el camino de Compartir', async () => {
      const ctx2 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 }
      });
      const p2 = await ctx2.newPage();
      await p2.goto('file://' + path.join(RAIZ, '__banco.html'));
      await p2.waitForFunction('!!window.KIT');
      igual(await p2.evaluate(() => KIT.piezas.instalar.caso()), 'ios-safari');
      cierto(await p2.evaluate(() => KIT.piezas.instalar.sePuede()), 'en iPhone sí se puede, a mano');
      await p2.evaluate(() => { KIT.piezas.instalar.abrir(); });
      await p2.waitForTimeout(150);
      const t = await p2.locator('.kit-inst__cuerpo').innerText();
      cierto(/Compartir/.test(t), 'debía nombrar Compartir');
      cierto(/pantalla de inicio/i.test(t), 'debía nombrar Añadir a pantalla de inicio');
      await ctx2.close();
    });

    await prueba('un iPad con iPadOS 13+ se reconoce, aunque se haga pasar por Mac', async () => {
      /* iPadOS manda userAgent de Macintosh: solo se delata por el táctil.
         Si esto falla, en iPad no sale ninguna instrucción de instalación. */
      const ctx4 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        viewport: { width: 1024, height: 768 },
        hasTouch: true, isMobile: false
      });
      const p4 = await ctx4.newPage();
      await p4.goto('file://' + path.join(RAIZ, '__banco.html'));
      await p4.waitForFunction('!!window.KIT');
      await p4.evaluate(() => { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true }); });
      igual(await p4.evaluate(() => KIT.piezas.instalar.caso()), 'ios-safari');
      await ctx4.close();
    });

    await prueba('en iPhone pero fuera de Safari, se avisa', async () => {
      const ctx3 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 }
      });
      const p3 = await ctx3.newPage();
      await p3.goto('file://' + path.join(RAIZ, '__banco.html'));
      await p3.waitForFunction('!!window.KIT');
      igual(await p3.evaluate(() => KIT.piezas.instalar.caso()), 'ios-otro');
      await p3.evaluate(() => { KIT.piezas.instalar.abrir(); });
      await p3.waitForTimeout(150);
      const t3 = await p3.locator('.kit-inst__cuerpo').innerText();
      cierto(/solo Safari/i.test(t3), 'debía avisar que hace falta Safari');
      cierto(/no llegan los avisos/i.test(t3), 'debía decir que sin instalar no hay avisos');
      await ctx3.close();
    });

    await ctx.close();
  }

  /* ═══════════ SOPORTE ═══════════ */
  grupo('soporte');
  {
    const { page, ctx } = await pagina(browser, ['soporte', 'adjuntos']);

    await prueba('abre con el formulario', async () => {
      await page.evaluate(() => { KIT.piezas.soporte.abrir({ vista: "Radicar cuenta" }); });
      cierto(await page.locator('.kit-sop__hoja').isVisible(), 'debía abrirse');
      cierto(await page.locator('.kit-sop__zona .kit-adj__soltar').isVisible(), 'debía traer la zona de fotos');
    });

    await prueba('enseña lo que va a mandar, sin esconderlo', async () => {
      /* el <details> está cerrado: innerText no ve lo de dentro */
      const t = await page.locator('.kit-sop__datos').evaluate(e => e.textContent);
      cierto(/Aplicación/.test(t), 'debía listar la app');
      cierto(/Navegador/.test(t), 'debía listar el navegador');
      cierto(/Radicar cuenta/.test(t), 'debía listar la vista');
    });

    await prueba('un mensaje demasiado corto no se manda', async () => {
      await page.evaluate(() => { window.__env = 0; window.KIT.pedir = () => { window.__env++; return Promise.resolve({}); }; });
      await page.fill('.kit-sop__cuerpo textarea', 'no va');
      await page.locator('.kit-sop__si').click();
      await page.waitForTimeout(150);
      igual(await page.evaluate(() => window.__env), 0);
      cierto(await page.locator('.kit-sop__error--on').isVisible(), 'debía avisar');
    });

    await prueba('con mensaje suficiente, se manda con el contexto', async () => {
      await page.evaluate(() => {
        window.__ult = null;
        window.KIT.pedir = (a, d) => { window.__ult = { a, d }; return Promise.resolve({}); };
      });
      await page.fill('.kit-sop__cuerpo textarea', 'Al guardar la cuenta sale un error rojo y no se radica.');
      await page.locator('.kit-sop__si').click();
      await page.waitForTimeout(350);
      igual(await page.evaluate(() => window.__ult.a), 'soporte');
      igual(await page.evaluate(() => window.__ult.d.contexto.vista), 'Radicar cuenta');
      cierto(await page.evaluate(() => window.__ult.d.mensaje.length > 20), 'debía llevar el mensaje');
    });

    await prueba('tras enviar, la hoja se cierra', async () => {
      igual(await page.locator('.kit-sop__hoja').count(), 0);
    });

    await prueba('si el CORE no contesta, ofrece WhatsApp', async () => {
      await page.evaluate(() => {
        KIT.piezas.soporte.abrir({ vista: 'X' });
        window.KIT.pedir = () => Promise.reject(Object.assign(new Error('x'), { codigo: 'SIN_RED' }));
      });
      await page.fill('.kit-sop__cuerpo textarea', 'El servidor no responde desde ayer por la tarde.');
      await page.locator('.kit-sop__si').click();
      await page.waitForTimeout(350);
      cierto(await page.locator('.kit-sop__wa').isVisible(), 'debía ofrecer WhatsApp');
      cierto(await page.locator('.kit-sop__error--on').isVisible(), 'debía explicar por qué');
    });

    await prueba('el botón se suelta para poder reintentar', async () => {
      falso(await page.locator('.kit-sop__si').isDisabled(), 'debía soltarse');
    });

    await ctx.close();
  }

  /* ═══════════ INSIGHTS ═══════════ */
  grupo('insights');
  {
    const { page, ctx } = await pagina(browser, ['insights', 'pastillas']);

    /* LIDA aparece la PRIMERA a propósito, pero DIEGO tiene más: así la
       prueba del reparto distingue "ordenado" de "en el orden que vino" */
    const datos = [
      { estado: 'DEVUELTA', supervisor: 'LIDA SÁNCHEZ', valor: 900000 },
      { estado: 'REPORTADA', supervisor: 'DIEGO GARCIA', valor: 2500000 },
      { estado: 'REPORTADA', supervisor: 'DIEGO GARCIA', valor: 1500000 }
    ];

    await prueba('el botón se monta y flota', async () => {
      await page.evaluate((d) => {
        window.__filas = d;
        KIT.piezas.insights.montar({
          vista: 'Cuentas por revisar',
          filas: () => window.__filas,
          filtros: () => 'Estado: todos',
          medidas: [
            { titulo: 'Cuentas', calcula: (f) => f.length },
            { titulo: 'Valor total', calcula: (f) => KIT.pesos(f.reduce((s, x) => s + x.valor, 0)) },
            { titulo: 'Por supervisor', reparto: 'supervisor' }
          ],
          botones: [{ texto: '¿Cuál es la más alta?', responde: (f) =>
            'La más alta vale ' + KIT.pesos(Math.max.apply(null, f.map(x => x.valor))) + '.' }]
        });
      }, datos);
      cierto(await page.locator('.kit-ins__fab').isVisible(), 'debía verse el robot');
    });

    await prueba('NO arranca solo: primero hay que pulsar Iniciar', async () => {
      await page.locator('.kit-ins__fab').click();
      cierto(await page.locator('.kit-ins__iniciar').isVisible(), 'debía pedir Iniciar');
      igual(await page.locator('.kit-ins__medidas').count(), 0);
    });

    await prueba('Iniciar calcula las medidas', async () => {
      await page.locator('.kit-ins__iniciar').click();
      await page.waitForTimeout(120);
      igual(await page.locator('.kit-ins__medida').nth(0).locator('b').innerText(), '3');
      igual(await page.locator('.kit-ins__medida').nth(1).locator('b').innerText(), '$ 4.900.000');
    });

    await prueba('el reparto sale ordenado de mayor a menor', async () => {
      /* LIDA va primera en los datos y DIEGO tiene más: si no se ordena,
         el orden natural dejaría a LIDA arriba y la prueba lo vería */
      const filas = await page.locator('.kit-ins__reparto li').allInnerTexts();
      cierto(filas[0].indexOf('DIEGO') >= 0, `DIEGO tiene 2, va primero; salió "${filas[0]}"`);
    });

    await prueba('dice sobre cuántos registros calculó', async () => {
      const t = await page.locator('.kit-ins__pie-nota').innerText();
      cierto(/3\s+registros/.test(t), 'debía decir 3 registros');
      cierto(/Estado: todos/.test(t), 'debía decir el filtro');
    });

    await prueba('trabaja sobre lo FILTRADO, no sobre todo', async () => {
      await page.evaluate(() => {
        window.__filas = window.__filas.filter(f => f.estado === 'DEVUELTA');
        document.querySelector('.kit-capa__x').click();
      });
      await page.locator('.kit-ins__fab').click();
      await page.locator('.kit-ins__iniciar').click();
      await page.waitForTimeout(120);
      igual(await page.locator('.kit-ins__medida').nth(0).locator('b').innerText(), '1');
      cierto(/1\s+registro/.test(await page.locator('.kit-ins__pie-nota').innerText()), 'debía decir 1 registro');
    });

    await prueba('un botón de pregunta responde sobre lo de pantalla', async () => {
      await page.locator('.kit-ins__botones .kit-pastilla').first().click();
      await page.waitForTimeout(900);
      igual(await page.locator('.kit-ins__respuesta').innerText(), 'La más alta vale $ 900.000.');
    });

    await prueba('con la vista vacía lo dice, no calcula ceros', async () => {
      await page.evaluate(() => {
        window.__filas = [];
        document.querySelector('.kit-capa__x').click();
      });
      await page.locator('.kit-ins__fab').click();
      await page.locator('.kit-ins__iniciar').click();
      await page.waitForTimeout(120);
      cierto(await page.locator('.kit-ins__vacio').isVisible(), 'debía decir que no hay nada');
      igual(await page.locator('.kit-ins__medida').count(), 0);
      await page.locator('.kit-capa__x').click();
    });

    await prueba('repartir cuenta y saca porcentajes', async () => {
      const r = await page.evaluate(() => KIT.piezas.insights.repartir(
        [{ a: 'X' }, { a: 'X' }, { a: 'Y' }, { a: '' }], 'a'));
      igual(r[0], { k: 'X', n: 2, pct: 50 });
      igual(r.length, 3);
    });

    await prueba('el robot se puede mover y recuerda dónde quedó', async () => {
      const caja = await page.locator('.kit-ins__fab').boundingBox();
      await page.mouse.move(caja.x + 27, caja.y + 27);
      await page.mouse.down();
      await page.mouse.move(400, 400, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(120);
      const p = await page.evaluate(() => KIT.guardar.leer('insights.pos'));
      cierto(p && p.x > 0, 'debía guardar la posición');
    });

    await prueba('arrastrar NO abre el panel', async () => {
      igual(await page.locator('.kit-ins__hoja').count(), 0);
    });

    await ctx.close();
  }

  /* ═══════════ EXPORTADOR ═══════════ */
  grupo('exportar');
  {
    const { page, ctx } = await pagina(browser, ['exportar', 'fechas']);

    const cols = [
      { campo: 'id', titulo: 'ID Contrato', fijo: true },
      { campo: 'nombre', titulo: 'Contratista' },
      { campo: 'valor', titulo: 'Valor', tipo: 'pesos' },
      { campo: 'fecha', titulo: 'Radicación', tipo: 'fecha' }
    ];
    const filas = [
      { id: '1070602493-027', nombre: 'EDILBERTO RAMÍREZ', valor: 2500000, fecha: '2026-09-10' },
      { id: '1070590350-003', nombre: 'ANA PEÑA', valor: '1.200.000', fecha: '2026-08-02' },
      { id: '1070111222-009', nombre: 'JOSÉ GÓMEZ', valor: 900000, fecha: '2026-07-15' }
    ];

    await prueba('valor() da el texto con formato', async () => {
      igual(await page.evaluate(([c, f]) => KIT.piezas.exportar.valor(f[0], c[2]), [cols, filas]), '$ 2.500.000');
      igual(await page.evaluate(([c, f]) => KIT.piezas.exportar.valor(f[0], c[3]), [cols, filas]), '10/09/2026');
    });

    await prueba('valorCrudo() da NÚMERO para que Excel pueda sumar', async () => {
      igual(await page.evaluate(([c, f]) => KIT.piezas.exportar.valorCrudo(f[0], c[2]), [cols, filas]), 2500000);
    });

    await prueba('valorCrudo() entiende "1.200.000" como millón doscientos mil', async () => {
      igual(await page.evaluate(([c, f]) => KIT.piezas.exportar.valorCrudo(f[1], c[2]), [cols, filas]), 1200000);
    });

    await prueba('el nombre del archivo queda limpio de tildes y signos', async () => {
      igual(await page.evaluate(() => KIT.piezas.exportar.limpiarNombre('Cuentas · Revisión 2026/09')),
        'Cuentas_Revision_202609');
    });

    await prueba('el modal se abre con las columnas', async () => {
      await page.evaluate(([c, f]) => {
        window.__f = f;
        KIT.piezas.exportar.modal({ titulo: 'Cuentas', columnas: c, campoFecha: 'fecha', filas: () => window.__f });
      }, [cols, filas]);
      igual(await page.locator('.kit-exp__col').count(), 4);
    });

    await prueba('la columna fija no se puede desmarcar', async () => {
      cierto(await page.locator('.kit-exp__col').first().locator('input').isDisabled(), 'la fija va siempre');
      cierto(await page.locator('.kit-exp__col').first().locator('input').isChecked(), 'y marcada');
    });

    await prueba('el contador dice registros y columnas', async () => {
      igual(await page.locator('.kit-exp__cuenta').innerText(), '3 registros · 4 columnas');
    });

    await prueba('desmarcar una columna actualiza el contador', async () => {
      await page.locator('.kit-exp__col').nth(1).locator('input').uncheck();
      igual(await page.locator('.kit-exp__cuenta').innerText(), '3 registros · 3 columnas');
    });

    await prueba('el rango de fechas recorta las filas', async () => {
      await page.evaluate(() => {
        document.querySelector('.kit-exp__desde').value = '2026-08-01';
        document.querySelector('.kit-exp__hasta').value = '2026-09-30';
        document.querySelector('.kit-exp__desde').dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(100);
      cierto((await page.locator('.kit-exp__cuenta').innerText()).indexOf('2 registros') === 0,
        'julio se queda fuera');
    });

    await prueba('sin filas en el rango, los botones se apagan', async () => {
      await page.evaluate(() => {
        document.querySelector('.kit-exp__desde').value = '2030-01-01';
        document.querySelector('.kit-exp__desde').dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(100);
      cierto(await page.locator('.kit-exp__pdf').isDisabled(), 'no hay nada que bajar');
    });

    await prueba('"Marcar todas" marca y desmarca', async () => {
      await page.locator('.kit-exp__todas').click();
      igual(await page.evaluate(() =>
        [...document.querySelectorAll('.kit-exp__col input')].filter(i => i.checked).length), 4);
      await page.locator('.kit-exp__todas').click();
      igual(await page.evaluate(() =>
        [...document.querySelectorAll('.kit-exp__col input')].filter(i => i.checked).length), 1);  /* queda la fija */
      await page.locator('.kit-capa__x').click();
    });

    await prueba('el CSV separa con punto y coma y lleva BOM', async () => {
      const r = await page.evaluate(() => {
        let capturado = null;
        const real = URL.createObjectURL;
        URL.createObjectURL = (b) => { capturado = b; return 'blob:x'; };
        const a = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {};
        KIT.piezas.exportar.aCSV('Prueba', ['A', 'B'], [['uno', 'dos;con punto y coma']]);
        URL.createObjectURL = real;
        HTMLAnchorElement.prototype.click = a;
        /* Blob.text() se come el BOM al decodificar: hay que mirar los bytes */
        return capturado.arrayBuffer().then(b => {
          const u = new Uint8Array(b);
          return { bom: [u[0], u[1], u[2]], txt: new TextDecoder('utf-8').decode(u) };
        });
      });
      igual(r.bom, [0xEF, 0xBB, 0xBF], 'debía empezar por el BOM de UTF-8');
      const t0 = r.txt;
      cierto(t0.indexOf('A;B') >= 0, 'debía separar con ;');
      cierto(t0.indexOf('"dos;con punto y coma"') >= 0, 'debía entrecomillar el que lleva ;');
    });

    await prueba('el respaldo de impresión pinta el membrete', async () => {
      const t = await page.evaluate(([c, f]) => {
        let escrito = '';
        const real = window.open;
        window.open = () => ({ document: { write: (h) => { escrito = h; }, close: () => {} } });
        KIT.piezas.exportar.aImprimir('Cuentas', c, f, { MARCA_MUNICIPIO: 'MUNICIPIO DE FLANDES', MARCA_NIT: '800100055-6' });
        window.open = real;
        return escrito;
      }, [cols, filas]);
      cierto(t.indexOf('MUNICIPIO DE FLANDES') > 0, 'debía llevar el municipio');
      cierto(t.indexOf('800100055-6') > 0, 'debía llevar el NIT');
      cierto(t.indexOf('EDILBERTO RAM') > 0, 'debía llevar los datos');
      cierto(t.indexOf('window.print()') > 0, 'debía mandar a imprimir');
    });

    await prueba('el respaldo de impresión escapa el HTML de los datos', async () => {
      const t = await page.evaluate(() => {
        let escrito = '';
        const real = window.open;
        window.open = () => ({ document: { write: (h) => { escrito = h; }, close: () => {} } });
        KIT.piezas.exportar.aImprimir('X', [{ campo: 'n', titulo: 'N' }], [{ n: '<script>alert(1)</script>' }], {});
        window.open = real;
        return escrito;
      });
      falso(/<td><script>/.test(t), 'no podía colar un <script> desde los datos');
      cierto(t.indexOf('&lt;script&gt;') > 0, 'debía quedar escapado');
    });

    await ctx.close();
  }

  /* ═══════════ CRÉDITOS ═══════════ */
  grupo('creditos');
  {
    const { page, ctx } = await pagina(browser, ['creditos'], '<div id="pie"></div>');

    await prueba('pinta al instante, sin esperar al servidor', async () => {
      await page.evaluate(() => {
        window.KIT.pedir = () => new Promise(() => {});   /* nunca responde */
        KIT.piezas.creditos.montar('#pie');
      });
      igual(await page.locator('.kit-cred__autor').innerText(), 'Oscar Polania');
      igual(await page.locator('.kit-cred__frase').innerText(), 'Experto en soluciones digitales');
    });

    await prueba('dice Copyright ©, no GOBIERNO DIGITAL', async () => {
      const t = await page.locator('.kit-cred').innerText();
      cierto(/Copyright/i.test(t), 'debía llevar el copyright');
      falso(/GOBIERNO DIGITAL/i.test(t), 'no puede quedar rastro del anterior');
    });

    await prueba('si el CORE trae otros textos, se corrige sola', async () => {
      await page.evaluate(() => {
        document.getElementById('pie').innerHTML = '';
        window.KIT.pedir = () => Promise.resolve({
          MARCA_AUTOR: 'Otro Nombre', MARCA_AUTOR_FRASE: 'Otra frase'
        });
        KIT.piezas.creditos.montar('#pie');
      });
      await page.waitForTimeout(200);
      igual(await page.locator('.kit-cred__autor').innerText(), 'Otro Nombre');
      igual(await page.locator('.kit-cred__frase').innerText(), 'Otra frase');
    });

    await prueba('si el CORE no responde, se queda con los valores de siempre', async () => {
      await page.evaluate(() => {
        KIT.piezas.creditos.olvidar();
        document.getElementById('pie').innerHTML = '';
        window.KIT.pedir = () => Promise.reject(Object.assign(new Error('x'), { codigo: 'SIN_RED' }));
        KIT.piezas.creditos.montar('#pie');
      });
      await page.waitForTimeout(200);
      igual(await page.locator('.kit-cred__autor').innerText(), 'Oscar Polania');
    });

    await prueba('el texto del CORE no puede inyectar HTML', async () => {
      await page.evaluate(() => {
        KIT.piezas.creditos.olvidar();
        document.getElementById('pie').innerHTML = '';
        window.KIT.pedir = () => Promise.resolve({ MARCA_AUTOR: '<img src=x onerror=alert(1)>' });
        KIT.piezas.creditos.montar('#pie');
      });
      await page.waitForTimeout(200);
      igual(await page.locator('.kit-cred__autor img').count(), 0);
    });

    await prueba('con {anio:true} pone el año en curso', async () => {
      await page.evaluate(() => {
        KIT.piezas.creditos.olvidar();
        document.getElementById('pie').innerHTML = '';
        window.KIT.pedir = () => Promise.resolve({});
        KIT.piezas.creditos.montar('#pie', { anio: true });
      });
      await page.waitForTimeout(200);
      /* el CSS lo pinta en mayúsculas: se compara el texto real, no el pintado */
      igual(await page.locator('.kit-cred__cop').evaluate(e => e.textContent),
        'Copyright © ' + new Date().getFullYear());
    });

    await prueba('el nombre pesa más que la frase', async () => {
      const r = await page.evaluate(() => {
        const a = getComputedStyle(document.querySelector('.kit-cred__autor'));
        const f = getComputedStyle(document.querySelector('.kit-cred__frase'));
        return [parseFloat(a.fontSize), parseFloat(f.fontSize), parseInt(a.fontWeight), parseInt(f.fontWeight)];
      });
      cierto(r[0] > r[1], `el nombre debía ser mayor (${r[0]} vs ${r[1]})`);
      cierto(r[2] > r[3], `el nombre debía pesar más (${r[2]} vs ${r[3]})`);
    });

    await prueba('la frase es más clara que el nombre, también en oscuro', async () => {
      const luz = (c) => { const m = c.match(/\d+/g); return (+m[0] * 299 + +m[1] * 587 + +m[2] * 114) / 1000; };
      for (const tema of ['claro', 'oscuro']) {
        const r = await page.evaluate((t) => {
          KIT.ponerTema(t);
          return [getComputedStyle(document.querySelector('.kit-cred__autor')).color,
                  getComputedStyle(document.querySelector('.kit-cred__frase')).color,
                  getComputedStyle(document.documentElement).getPropertyValue('--k-papel').trim()];
        }, tema);
        const fondoClaro = tema === 'claro';
        /* "más clara" = menos contraste contra el fondo, no un color fijo */
        const dAutor = Math.abs(luz(r[0]) - (fondoClaro ? 255 : 20));
        const dFrase = Math.abs(luz(r[1]) - (fondoClaro ? 255 : 20));
        cierto(dAutor > dFrase, `en ${tema} el nombre debía destacar más que la frase`);
      }
      await page.evaluate(() => KIT.ponerTema('claro'));
    });

    await prueba('montar() sin destino lo cuelga del final de la página', async () => {
      const n = await page.evaluate(() => {
        document.getElementById('pie').innerHTML = '';
        KIT.piezas.creditos.montar();
        return document.body.lastElementChild.className;
      });
      cierto(/kit-cred/.test(n), `debía quedar al final, quedó "${n}"`);
    });

    await ctx.close();
  }

  /* ═══════════ VERSIÓN (pieza 23) ═══════════ */
  grupo('version');
  {
    const { page, ctx } = await pagina(browser, ['version']);

    await prueba('sin version.js la pieza se queda quieta y no recarga', async () => {
      const r = await page.evaluate(() => KIT.piezas.version.numero());
      igual(r, '', 'sin APP_VERSION el número tiene que venir vacío');
      const hubo = await page.evaluate(() => KIT.piezas.version.comprobar());
      falso(hubo, 'sin número no puede decidir que hay una versión nueva');
    });

    await prueba('el prefijo de caché sale del nombre de la app', async () => {
      const p = await page.evaluate(() => KIT.piezas.version.prefijo());
      igual(p, 'contratista-', 'prefijo');
    });

    await prueba('limpiarCaches solo se lleva las de esta app', async () => {
      const quedan = await page.evaluate(async () => {
        await caches.open('contratista-v2026.09.21.1');
        await caches.open('contratista-v4.2.0');
        await caches.open('tesoreria-v1');
        await caches.open('sep-group-v3');
        await KIT.piezas.version.limpiarCaches();
        return (await caches.keys()).sort();
      });
      igual(quedan, ['sep-group-v3', 'tesoreria-v1'],
        'las cachés de las otras apps NO se tocan: las siete viven en el mismo origen');
    });

    await prueba('el número cargado se puede fingir para probar', async () => {
      const n = await page.evaluate(() => { KIT.piezas.version._fijar('2026.01.01.1'); return KIT.piezas.version.numero(); });
      igual(n, '2026.01.01.1', 'número fijado');
    });

    await ctx.close();
  }

  await browser.close();
  try { fs.unlinkSync(path.join(RAIZ, '__banco.html')); } catch (e) {}

  console.log(`\n  VERDES ${verdes}   ROJAS ${rojas}\n`);
  if (fallos.length) {
    console.log('  ── lo que salió rojo ──');
    fallos.forEach(f => console.log('  ' + f));
    console.log('');
  }
  process.exit(rojas ? 1 : 0);
})();
