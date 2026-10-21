import sys, json, time, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
APPS=['contratista','contratacion','supervision','admin','contabilidad','tesoreria','comunicaciones']
PX={'server':'http://127.0.0.1:37241','bypass':'<-loopback>'}
res={}
def servir(d,port):
    h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=d)
    h.log_message=lambda *a:None
    s=socketserver.ThreadingTCPServer(('127.0.0.1',port),h); s.daemon_threads=True
    threading.Thread(target=s.serve_forever,daemon=True).start(); return s
def banner(pg):
    return pg.evaluate("()=>{var b=document.querySelector('.kit-conex');return b?{on:b.classList.contains('kit-conex--on'),lenta:b.classList.contains('kit-conex--lenta'),txt:b.innerText.trim()}:null}")
with sync_playwright() as p:
    b=p.chromium.launch(proxy=PX)
    for i,a in enumerate(APPS):
        srv=None; ctx=b.new_context(service_workers='block'); pg=ctx.new_page()
        base='https://botheart911.github.io/%s-flandes/'%a
        import os, mimetypes
        def hacer(a, base):
          def local(rt, *x):
              path=rt.request.url.split('?')[0].split('#')[0][len(base):] or 'index.html'
              f='/home/claude/%s-flandes/%s'%(a,path)
              if os.path.isfile(f): rt.fulfill(status=200, body=open(f,'rb').read(), headers={'Content-Type':(mimetypes.guess_type(f)[0] or 'application/octet-stream')+'; charset=utf-8'})
              else: print('404',rt.request.url); rt.fulfill(status=404, body='')
          return local
        ctx.route(base+'**', hacer(a, base))
        bodies=[]
        pg.on('request', lambda r: bodies.append(r.post_data) if 'script.google' in r.url and r.method=='POST' else None)
        pg.on('pageerror',lambda e:print('E',str(e)[:200])); pg.on('console',lambda m:print('C',m.text[:160]) if m.type=='error' else None)
        pg.goto(base, wait_until='domcontentloaded'); pg.wait_for_function('window.KIT && KIT.piezas.conexion',timeout=20000)
        print('kit cargado',flush=True); pg.wait_for_timeout(1500)
        r={}
        # 1 ping real
        t=time.time(); r['ping_real']=pg.evaluate("()=>KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>'ok',e=>e.codigo)"); r['ping_ms']=int((time.time()-t)*1000)
        # 2 cortar red con la app abierta: banner inmediato
        ctx.set_offline(True); t=time.time()
        pg.wait_for_function("document.querySelector('.kit-conex.kit-conex--on')",timeout=3000); r['banner_offline_ms']=int((time.time()-t)*1000)
        r['banner_txt']=banner(pg)['txt']
        # 3 carga en curso sin red: queda esperando, vuelve sola con el mismo rid
        bodies.clear()
        pg.evaluate("()=>{window.__r=null;KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>window.__r='ok',e=>window.__r=e.codigo)}")
        pg.wait_for_timeout(1500); r['espera_sin_red']=pg.evaluate('window.__r')
        ctx.set_offline(False); t=time.time()
        pg.wait_for_function("window.__r!==null",timeout=60000); r['vuelve_ms']=int((time.time()-t)*1000); r['vuelve']=pg.evaluate('window.__r')
        pg.wait_for_timeout(400); r['banner_tras_volver']=banner(pg)['on']
        rids=[json.loads(x).get('rid') for x in bodies if x]; r['envios']=len(rids); r['mismo_rid']=len(set(rids))<=1
        # 4 wifi sin internet (navigator dice online): todo externo cae
        def tumbar(route): route.abort('internetdisconnected')
        pg.route('**/*google*/**',tumbar); pg.route('https://www.gstatic.com/**',tumbar)
        pg.evaluate("()=>{window.__r=null;KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>window.__r='ok',e=>window.__r=e.codigo)}")
        t=time.time(); pg.wait_for_function("document.querySelector('.kit-conex.kit-conex--on')",timeout=8000); r['banner_wifi_sin_internet_ms']=int((time.time()-t)*1000)
        pg.unroute('**/*google*/**'); pg.unroute('https://www.gstatic.com/**')
        pg.evaluate("document.querySelector('.kit-conex__b').click()")
        pg.wait_for_function("window.__r!==null",timeout=60000); r['reintentar_banner']=pg.evaluate('window.__r'); r['banner_tras_reintentar']=banner(pg)['on']
        # 5 falla del servidor con red buena: mensaje honesto, sin banner, un reintento con mismo rid
        bodies.clear(); pg.route('https://script.google.com/**',lambda rt: rt.abort('failed'))
        r['servidor']=pg.evaluate("()=>KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>'ok',e=>e.codigo+' | '+e.message)")
        r['servidor_banner']=banner(pg)['on']; rids=[json.loads(x).get('rid') for x in bodies if x]; r['servidor_envios']=len(rids); r['servidor_mismo_rid']=len(set(rids))==1
        pg.unroute('https://script.google.com/**')
        # 6 internet lento: sonda tarda 3 s y el servidor cae
        def lenta(rt): time.sleep(3); rt.fulfill(status=204,body='')
        pg.route('https://www.gstatic.com/**',lenta); pg.route('https://script.google.com/**',lambda rt: rt.abort('failed'))
        r['lenta']=pg.evaluate("()=>KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>'ok',e=>e.codigo)")
        pg.unroute('https://www.gstatic.com/**'); pg.unroute('https://script.google.com/**')
        # 7 servidor lento (ms 3000), red buena
        def tarda(rt): time.sleep(5); rt.continue_()
        pg.route('https://script.google.com/**',tarda)
        r['servidor_lento']=pg.evaluate("()=>KIT.pedir('ping',{},{app:'CORE',sinToken:true,ms:3000}).then(()=>'ok',e=>e.codigo+' | '+e.message)")
        r['servidor_lento_banner']=banner(pg)['on']
        pg.unroute('https://script.google.com/**')
        res[a]=r; ctx.close()
        print(a, json.dumps(r,ensure_ascii=False), flush=True)
    b.close()
