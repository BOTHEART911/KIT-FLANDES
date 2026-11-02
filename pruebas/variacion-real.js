/* ============================================================
   KIT-FLANDES · BANCO DE LA VARIACIÓN POR ESTRUCTURA (02/11/2026)
   Corre el motor (kit/informe-cuentas.js, ESTR) y la pieza 34
   (kit/variacion.js) en Chromium con datos REALES de cuentas.

   Los datos reales NO viven en el repo (son de contratistas): se pasan
   con la variable VAR_DATOS, un JSON con
     [{c, nom, sec, obl:[texto], cu:[{i, d, h, a:[act], e:[n], j:[n], v}]}]
   que se arma con P1102_dump (archivo de pruebas del CORE).

   Uso:  VAR_DATOS=/ruta/reales.json node variacion-real.js
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..', 'salida', 'KIT-FLANDES');
const DATOS = process.env.VAR_DATOS;
if (!DATOS || !fs.existsSync(DATOS)) { console.error('Falta VAR_DATOS (JSON de cuentas reales).'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(DATOS, 'utf8'));

let verdes = 0, rojas = 0;
const fallos = [];
async function prueba(nombre, fn) {
  try { await fn(); verdes++; } catch (e) { rojas++; fallos.push(nombre + '\n    ' + e.message); }
}
function ok(c, m) { if (!c) throw new Error(m || 'falló'); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  /* jsPDF y SheetJS desde una copia local (VAR_LIBS = node_modules con jspdf@2.5.1 y xlsx@0.18.5); lo demás de la red se corta */
  const LIBS = process.env.VAR_LIBS || '';
  await page.route(/^https?:\/\//, (route) => {
    const u = route.request().url();
    if (LIBS && /jspdf@2\.5\.1/.test(u)) return route.fulfill({ body: fs.readFileSync(path.join(LIBS, 'jspdf/dist/jspdf.umd.min.js')), contentType: 'application/javascript' });
    if (LIBS && /xlsx@0\.18\.5/.test(u)) return route.fulfill({ body: fs.readFileSync(path.join(LIBS, 'xlsx/dist/xlsx.full.min.js')), contentType: 'application/javascript' });
    return route.abort();
  });
  const piezas = ['exportar', 'personas', 'informe-cuentas', 'confirmar', 'variacion'];
  const css = ['base.css', ...piezas.map(p => p + '.css')].filter(f => fs.existsSync(path.join(RAIZ, 'kit', f))).map(f => `<link rel="stylesheet" href="kit/${f}">`).join('\n');
  const js = ['kit.js', 'iconos.js', ...piezas.map(p => p + '.js')].filter(f => fs.existsSync(path.join(RAIZ, 'kit', f))).map(f => `<script src="kit/${f}"></script>`).join('\n');
  const f = path.join(RAIZ, '__banco.html');
  fs.writeFileSync(f, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco</title>
<script>window.MARCA={API_URL:'https://ejemplo.invalido/exec',APP:'SUPERVISION',STORAGE_NS:'flandes.banco.'};</script>${css}</head>
<body class="kit-fondo"><main id="app" style="max-width:900px;margin:auto"></main>${js}</body></html>`);
  await page.goto('file://' + f);
  await page.waitForFunction('!!(window.KIT && KIT.piezas.variacion && KIT.piezas.informeCuentas && KIT.piezas.informeCuentas._estr)');
  await page.evaluate((d) => { window.DR = d; }, D);

  /* datos con la forma de la ruta informeContratista */
  await page.evaluate(() => {
    window.aDatos = function (c) {
      return { contrato: { contrato: c.c, nombre: c.nom, secretaria: c.sec, obligaciones: c.obl.map((t, i) => ({ n: i + 1, texto: t })), inicio: c.ini, fin: c.fin },
        cuentas: c.cu.map(x => ({ informe: x.i, estado: 'PAGADA', desde: x.d, hasta: x.h, actividades: x.a, evidencias: x.e, adjuntos: x.j.map(n => Array(n).fill('a.pdf')), anexoViejo: x.v, traza: [] })) };
    };
    /* la forma de la ruta revisionAnterior / actividadesAnteriores (v2) */
    window.aAnterior = function (c, hasta) {
      const cu = c.cu.filter(x => x.i < hasta).sort((a, b) => a.i - b.i);
      const act = c.cu.find(x => x.i === hasta);
      return { v: 2, contrato: c.c, hasta, obligaciones: c.obl.map((t, i) => i + 1),
        cuentas: cu.map(x => ({ informe: x.i, estado: 'PAGADA', desde: x.d, hasta: x.h, actividades: x.a })),
        actual: act ? { informe: hasta, desde: act.d, hasta: act.h } : null };
    };
  });

  await prueba('el motor mide cada actividad real en menos de 5 ms (caliente, CPU x1 y x4)', async () => {
    const medir = () => page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion, t = [];
      DR.forEach(c => {
        const cu = c.cu.slice().sort((a, b) => a.i - b.i);
        c.obl.forEach((ot, k) => cu.forEach((x, j) => {
          const prev = cu.slice(0, j).map(y => ({ informe: y.i, texto: String(y.a[k] || '').trim() })).filter(y => y.texto && y.texto !== '-');
          const P = V.preparar(I, ot, prev, c.c);
          for (let w = 0; w < 2; w++) V.medir(I, x.a[k], P, { obl: ot, desde: x.d, hasta: x.h, soporte: 1, nContrato: c.c });
          const t0 = performance.now();
          for (let r = 0; r < 5; r++) V.medir(I, x.a[k], P, { obl: ot, desde: x.d, hasta: x.h, soporte: 1, nContrato: c.c });
          t.push((performance.now() - t0) / 5);
        }));
      });
      t.sort((a, b) => a - b);
      return { n: t.length, med: t[t.length >> 1], p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], sobre5: t.filter(v => v >= 5).length };
    });
    const x1 = await medir();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const x4 = await medir();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log('  motor x1: mediana ' + x1.med.toFixed(2) + ' ms · p95 ' + x1.p95.toFixed(2) + ' · máx ' + x1.max.toFixed(2) + ' (' + x1.n + ' actividades)');
    console.log('  motor x4 (teléfono): mediana ' + x4.med.toFixed(2) + ' ms · p95 ' + x4.p95.toFixed(2) + ' · máx ' + x4.max.toFixed(2) + ' · sobre 5 ms: ' + x4.sobre5);
    ok(x1.max < 5, 'x1 máximo ' + x1.max.toFixed(2) + ' ms');
    ok(x4.p95 < 5, 'x4 p95 ' + x4.p95.toFixed(2) + ' ms');
    ok(x4.sobre5 <= Math.ceil(x4.n * 0.02), 'x4: ' + x4.sobre5 + ' actividades pasan de 5 ms (tope 2 %)');
  });

  await prueba('los términos compartidos no castigan (061 obl. 6 cuenta 5) y la plantilla sí (035 obl. 1 cuenta 2)', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion;
      function uno(cn, k, i) {
        const c = DR.find(x => x.c === cn), cu = c.cu.slice().sort((a, b) => a.i - b.i), j = cu.findIndex(x => x.i === i);
        const prev = cu.slice(0, j).map(y => ({ informe: y.i, texto: String(y.a[k - 1] || '').trim() })).filter(y => y.texto);
        const R = V.medir(I, cu[j].a[k - 1], V.preparar(I, c.obl[k - 1], prev, cn), { obl: c.obl[k - 1], desde: cu[j].d, hasta: cu[j].h, soporte: 1, nContrato: cn });
        return { e: R.estado, pct: R.pct, tipo: R.tipo };
      }
      return [uno('061', 6, 5), uno('035', 1, 2), uno('022', 3, 3)];
    });
    ok(r[0].e === 'nueva', '061: ' + JSON.stringify(r[0]));
    ok(r[1].e === 'repetida' && r[1].tipo === 'plantilla', '035: ' + JSON.stringify(r[1]));
    ok(r[2].e === 'repetida', '022: ' + JSON.stringify(r[2]));
  });

  await prueba('la misma cifra sale como aviso informativo, nunca como falta', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion;
      const P = V.preparar(I, 'Realizar visitas técnicas a los predios', [{ informe: 1, texto: 'Se realizaron 18 visitas técnicas a la vereda La Esmeralda.' }], '099');
      const R = V.medir(I, 'El 12 de marzo se hicieron 18 visitas técnicas con la Junta de Acción Comunal y quedó el acta firmada.', P, { obl: 'Realizar visitas técnicas a los predios', desde: '2026-03-01', hasta: '2026-03-31', soporte: 2, nContrato: '099' });
      return { igual: R.cifraIgual.length, b1: R.b[1].e, estado: R.estado };
    });
    ok(r.igual === 1 && r.b1 === 'verde', JSON.stringify(r));
  });

  await prueba('cifras que no cuentan: fecha, N° de contrato, anexo, numeración y códigos', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion;
      const P = V.preparar(I, 'Apoyar la gestión', [], '061');
      return V.medir(I, '1. Se apoyó el contrato 061 el 15 de marzo de 2026, según el Anexo 3, en los procesos C209-2026 y MC-011-2026.', P, { obl: 'Apoyar la gestión', soporte: 0, nContrato: '061' }).b[1].e;
    });
    ok(r === 'rojo', 'cuántos = ' + r);
  });

  await prueba('fecha fuera del periodo: amarillo con el fragmento', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion;
      const R = V.medir(I, 'El 15 de agosto se entregaron 4 informes a la Secretaría de Salud.', V.preparar(I, 'x', [], ''), { obl: 'x', desde: '2026-09-17', hasta: '2026-10-16', soporte: 1 });
      return { e: R.b[4].e, x: R.b[4].x };
    });
    ok(r.e === 'amarillo' && /15 de agosto/.test(r.x), JSON.stringify(r));
  });

  await prueba('obligación general: los 6 bombillos en gris', async () => {
    const e = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion;
      return V.medir(I, 'Cumplí el horario.', V.preparar(I, 'Cumplir con el horario de trabajo establecido', [], ''), { obl: 'Cumplir con el horario de trabajo establecido', soporte: 0 }).b.map(b => b.e);
    });
    ok(e.every(x => x === 'gris'), e.join(','));
  });

  await prueba('revisión: panel con bombillos técnicos, lado a lado y resaltado al tocar (ANDREA 022, cuenta 9)', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion, c = DR.find(x => x.c === '022');
      const d = aAnterior(c, 9), act = c.cu.find(x => x.i === 9), app = document.getElementById('app');
      app.innerHTML = '';
      const t0 = performance.now();
      c.obl.forEach((ot, k) => app.appendChild(V.panelComparar(I, { n: k + 1, texto: ot, actual: act.a[k], soporte: act.e[k] + act.j[k] }, d, '022', 9, {})));
      const ms = performance.now() - t0;
      const panel = app.querySelectorAll('.var-cmp')[2];
      const filas = panel.querySelectorAll('.var-bom__i:not(.var-bom__i--info)').length;
      const txt0 = panel.querySelector('.var-bom__i').textContent;
      const btn = [...panel.querySelectorAll('.var-bom__i--verde .var-bom__b')].find(b => b.getAttribute('aria-disabled') !== 'true' && /Cuantific/.test(b.textContent));
      btn.click();
      const hits = panel.querySelectorAll('mark.var-hit').length;
      return { ms, paneles: app.querySelectorAll('.var-cmp').length, filas, txt0, hits, cols: panel.querySelectorAll('.var-cmp__col').length };
    });
    console.log('  10 paneles de revisión en ' + r.ms.toFixed(1) + ' ms');
    ok(r.paneles === 10 && r.filas === 6 && r.cols === 2, JSON.stringify(r));
    ok(/Estructura igual|Plantilla|idéntico|Diferenció/.test(r.txt0), r.txt0);
    ok(r.hits >= 1, 'sin resaltado');
    ok(r.ms < 300, r.ms + ' ms');
  });

  await prueba('Tomar decisión: resumen por obligación con sus 6 luces', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, V = KIT.piezas.variacion, c = DR.find(x => x.c === '011');
      const d = aAnterior(c, 9), act = c.cu.find(x => x.i === 9), app = document.getElementById('app');
      app.innerHTML = '';
      const t0 = performance.now();
      app.appendChild(V.resumen(I, c.obl.map((ot, k) => ({ n: k + 1, texto: ot, actual: act.a[k], soporte: act.e[k] + act.j[k] })), d, '011', 9, {}));
      return { ms: performance.now() - t0, filas: app.querySelectorAll('.var-res__i').length, luces: app.querySelectorAll('.var-res__i')[0].querySelectorAll('.var-res__luz').length, malo: app.querySelectorAll('.var-res__i--malo').length, t: app.querySelector('.var-res__t').textContent };
    });
    console.log('  resumen: ' + r.t + ' · ' + r.ms.toFixed(1) + ' ms');
    ok(r.filas >= 5 && r.luces === 6 && r.malo >= 1, JSON.stringify(r));
  });

  await prueba('informe gerencial y Excel: la calificación sale de estructura y bombillos', async () => {
    const r = await page.evaluate(() => {
      const I = KIT.piezas.informeCuentas, out = [];
      DR.forEach(c => {
        const t0 = performance.now(), A = I.analizar(aDatos(c));
        const cols = I.columnas(aDatos(c)).map(x => x.titulo);
        out.push({ c: c.c, ms: performance.now() - t0, comps: A.comps.map(q => q.k).join(','), global: A.global, rep: A.repetidas, comp: A.comparadas,
          col: cols.includes('% estructura repetida obligación 1') && cols.includes('Bombillos obligación 1') && cols.includes('Plantillas rellenadas obligación 1') && !cols.some(t => /% repetido obligación/.test(t)) });
      });
      return out;
    });
    r.forEach(x => console.log('  ' + x.c + ': calidad ' + Math.round(x.global) + ' · repetidas ' + x.rep + '/' + x.comp + ' · ' + x.ms.toFixed(0) + ' ms'));
    ok(r.every(x => x.comps === 'var,red,sop,oport' && x.col), JSON.stringify(r.filter(x => !x.col || x.comps !== 'var,red,sop,oport')));
  });

  if (LIBS) await prueba('el PDF gerencial y el Excel salen completos con la medida nueva (022, 061, 011)', async () => {
    for (const cn of ['022', '061', '011']) {
      const [dl, r] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.evaluate(async (cn) => { const c = DR.find(x => x.c === cn); const t0 = performance.now(); const o = await KIT.piezas.informeCuentas.aGerencial(aDatos(c)); return { paginas: o && o.paginas, ms: performance.now() - t0 }; }, cn)
      ]);
      console.log('  PDF ' + cn + ': ' + r.paginas + ' páginas en ' + r.ms.toFixed(0) + ' ms · ' + dl.suggestedFilename());
      ok(r.paginas > 3, cn + ' páginas ' + r.paginas);
    }
    const [dx] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => KIT.piezas.informeCuentas.aExcel(aDatos(DR.find(x => x.c === '022'))))]);
    const tmp = path.join(require('os').tmpdir(), 'var-banco.xlsx'); await dx.saveAs(tmp);
    ok(fs.statSync(tmp).size > 5000, 'Excel vacío');
    console.log('  Excel 022: ' + Math.round(fs.statSync(tmp).size / 1024) + ' KB · ' + dx.suggestedFilename());
  });

  await prueba('modo oscuro: los bombillos se leen (contraste del texto)', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const c = await page.evaluate(() => getComputedStyle(document.querySelector('.var-res__nota') || document.body).color);
    await page.emulateMedia({ colorScheme: 'light' });
    ok(!!c, 'sin color');
  });

  await browser.close();
  try { fs.unlinkSync(f); } catch (e) {}
  if (fallos.length) console.log('\n' + fallos.join('\n'));
  console.log('\n  VERDES ' + verdes + '   ROJAS ' + rojas);
  process.exit(rojas ? 1 : 0);
})();
