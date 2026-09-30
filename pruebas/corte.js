/* KIT-FLANDES · corte al cambiar de vista y cola de fondo (29/09). Uso: node corte.js */
const { chromium } = require('playwright'); const fs=require('fs');
const KIT=require('path').resolve(__dirname,'..','kit')+'/'; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let v=0,r=0; const ok=(c,m)=>{ if(c)v++; else {r++; console.log('ROJA:',m);} };
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const llegadas=[];
 await ctx.route('https://core.prueba/**', async rt=>{ const a=JSON.parse(rt.request().postData()); llegadas.push(a.action); await sleep(a.ms||300); rt.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{a:a.action,n:llegadas.length}})}); });
 await ctx.route('http://sitio.prueba/**', rt=>{ const u=new URL(rt.request().url()); if(u.pathname==='/') return rt.fulfill({contentType:'text/html; charset=utf-8',body:`<script>window.MARCA={API_URL:'https://core.prueba/exec',APP:'CONTRATISTA',STORAGE_NS:'t.'};</script><script src="/kit/kit.js"></script><script src="/kit/iconos.js"></script><script src="/kit/banner.js"></script><body><div id=app></div></body>`}); rt.fulfill({contentType:'application/javascript; charset=utf-8',body:fs.readFileSync(KIT+u.pathname.replace('/kit/',''))}); });
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('ERR',e.message)); await p.goto('http://sitio.prueba/');
 const E=(f)=>p.evaluate(f);
 // 1) fondo espera al primer plano
 llegadas.length=0;
 let res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('Inicio'); const t0=Date.now(); const t={};
   const a=KIT.pedir('inicio',{ms:800}).then(()=>t.inicio=Date.now()-t0);
   const f=KIT.pedir('seguimiento',{ms:100},{fondo:true}).then(()=>t.fondo=Date.now()-t0);
   await Promise.all([a,f]); return t; });
 ok(res.fondo>=res.inicio+350, 'fondo sale después del primer plano '+JSON.stringify(res)); ok(llegadas.join()=='inicio,seguimiento','orden '+llegadas);
 // 2) cambio de vista descarta lo que no salió
 llegadas.length=0;
 res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('x'); const lento=KIT.pedir('inicio',{ms:600,z:1});
   let err=null; const f=KIT.pedir('seguimientoHistoria',{},{fondo:true}).catch(e=>err=e.codigo);
   await new Promise(r=>setTimeout(r,50)); location.hash='#/borrador'; KIT.piezas.banner.vista('BORRADOR');
   await lento; await f; await new Promise(r=>setTimeout(r,700)); return err; });
 ok(res==='CANCELADA','descartada con CANCELADA: '+res); ok(!llegadas.includes('seguimientoHistoria'),'nunca llegó al servidor: '+llegadas);
 // 3) adopción por misma petición: un solo viaje, sale ya
 llegadas.length=0;
 res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('i'); const lento=KIT.pedir('inicio',{ms:800,y:1});
   const p1=KIT.pedir('seguimiento',{historia:false},{fondo:true}); await new Promise(r=>setTimeout(r,50));
   location.hash='#/seguimiento'; KIT.piezas.banner.vista('ESTADO'); const t0=Date.now(); const p2=KIT.pedir('seguimiento',{historia:false});
   const d=await p2; const d1=await p1; return {mismo:p1===p2, ms:Date.now()-t0, d, d1}; });
 ok(res.mismo && llegadas.filter(x=>x==='seguimiento').length===1,'un solo viaje '+llegadas); ok(res.ms<700,'adoptada sale ya ('+res.ms+' ms)');
 // 4) adoptar(promesa)
 llegadas.length=0;
 res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('i'); const lento=KIT.pedir('inicio',{ms:500,w:1});
   const memo=KIT.pedir('ordenes',{},{fondo:true,app:'CONTABILIDAD'}); await new Promise(r=>setTimeout(r,20));
   location.hash='#/ordenes'; KIT.piezas.banner.vista('ORDENES'); KIT.vista.adoptar(memo); try{ await memo; return 'ok'; }catch(e){ return e.codigo; } });
 ok(res==='ok','adoptar() salva la promesa guardada: '+res);
 // 5) subruta / misma vista: no corta
 res=await E(async()=>{ location.hash='#/borrador'; KIT.piezas.banner.vista('B'); const lento=KIT.pedir('inicio',{ms:400,q:1}); let err='';
   const f=KIT.pedir('misAvisos',{},{fondo:true}).catch(e=>err=e.codigo); location.hash='#/borrador/7'; KIT.piezas.banner.vista('B7'); await lento; await f; return err; });
 ok(res==='','subruta no corta: '+res);
 // 6) escritura caduca la lectura de fondo en vuelo
 llegadas.length=0;
 res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('i'); const f=KIT.pedir('cuentaEstado',{ms:600},{fondo:true}); await new Promise(r=>setTimeout(r,450));
   await KIT.pedir('cuentaGuardar',{ms:50}); const g=KIT.pedir('cuentaEstado',{ms:600}); await g; return {mismo:f===g}; });
 ok(!res.mismo && llegadas.filter(x=>x==='cuentaEstado').length===2,'tras guardar no hereda lo de antes '+llegadas);
 // 7) escrituras nunca en cola ni deduplicadas
 llegadas.length=0;
 res=await E(async()=>{ const a=KIT.pedir('cuentaGuardar',{x:1},{fondo:true}); const c=KIT.pedir('cuentaGuardar',{x:1}); await Promise.all([a,c]); return a===c; });
 ok(!res && llegadas.filter(x=>x==='cuentaGuardar').length===2,'escrituras sin cola ni dedupe');
 // 8) luego() muere al cambiar de vista; setTimeout normal no
 res=await E(async()=>{ location.hash='#/inicio'; KIT.piezas.banner.vista('i'); let a=0,b=0; KIT.vista.luego(()=>a=1,100); setTimeout(()=>b=1,100); location.hash='#/avisos'; KIT.piezas.banner.vista('av'); await new Promise(r=>setTimeout(r,200)); return [a,b]; });
 ok(res[0]===0&&res[1]===1,'luego cortado, setTimeout intacto '+res);
 // 9) aviso ignora CANCELADA
 res=await E(()=>[KIT.aviso('Se canceló.'), !!KIT.aviso('hola')]); ok(res[0]===null&&res[1],'aviso silencioso '+JSON.stringify(res));
 // 10) fondo máximo 2 a la vez
 llegadas.length=0;
 res=await E(async()=>{ const ps=['borradorEstado','misAvisos','directorio','comunicados'].map(a=>KIT.pedir(a,{ms:400,k:9},{fondo:true})); await new Promise(r=>setTimeout(r,450+400)); const e=KIT.vista._estado(); await Promise.all(ps); return e; });
 ok(res.fondoVuelo<=2,'máx 2 de fondo: '+JSON.stringify(res));
 console.log(`${v} verdes, ${r} rojas`); await b.close(); })();
