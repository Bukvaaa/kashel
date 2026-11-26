// Снимки для дизайн-аудита в полном разрешении.
// Запуск: AUDIT_BASE=http://localhost:4173/ electron scripts/audit-shots.js <папка> <список.json>
// (адрес — через переменную: Electron с адресом в доводах молча не стартует)
// Список: [{ id, view, w, h, lang, track, crop?, js? }]
//   crop — CSS-селектор, по рамке которого обрезать снимок (с полями 16px),
//          или [x, y, w, h];
//   js   — код, который выполнить в окне перед снимком (открыть окно и т.п.).
const { app, BrowserWindow } = require('electron')
const LOG = (m) => require('fs').appendFileSync(require('path').join(process.cwd(), '_audit', 'shots.log'), m + '\n')
process.on('uncaughtException', (e) => { LOG('ERR ' + e.stack); app.exit(1) })
process.on('unhandledRejection', (e) => { LOG('REJ ' + (e && e.stack || e)); app.exit(1) })
const fs = require('fs')
const path = require('path')

const [outDir, listFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const base = process.env.AUDIT_BASE || 'http://localhost:4173/'
const list = JSON.parse(fs.readFileSync(listFile, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 1440, height: 900, useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  })
  win.webContents.setFrameRate(30)
  const js = (code) => win.webContents.executeJavaScript(code, true)
  await win.loadURL(base)
  await js(`(async()=>{const s=await fetch('/audit-seed.json').then(r=>r.json());localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v)})()`)
  let curLang = null
  const report = []
  for (const s of list) {
    win.setContentSize(s.w, s.h)
    const lang = s.lang || 'ru'
    if (lang !== curLang) {
      await js(`(()=>{const d=JSON.parse(localStorage.getItem('kashel:data.json'));d.settings.language='${lang}';localStorage.setItem('kashel:data.json',JSON.stringify(d));localStorage.setItem('kashel:язык','${lang}')})()`)
      curLang = lang
    }
    await win.loadURL(base)
    await sleep(1200)
    // старая версия встречает экраном входа в облако
    await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/без входа|without signing/i.test(b.textContent));b&&b.click()})()`)
    await sleep(400)
    await js(`import('/audit-layout.js?x='+Date.now()).then(()=>1)`)
    await sleep(100)
    LOG('→ ' + s.id)
    const marks = await js(`(async()=>{
      const A=window.__audit; A.track(${s.track || 0});
      await A.open(A.VIEWS.indexOf('${s.view}'));
      ${s.js || ''}
      await new Promise(r=>setTimeout(r,500));
      document.querySelectorAll('.audit-mk').forEach(e=>e.remove());
      const r=A.scan();
      const skip=(i)=>/seat|canvas|cal-months|nav-item|tabbar/.test(i.where)||i.kind==='мелкая зона клика'||(i.kind==='вылезает'&&(i.over??0)<=4)||i.kind==='системное поле';
      const seen=new Set();const out=[];
      if (${s.mark === false ? 'false' : 'true'}) for(const i of r.issues){ if(skip(i))continue; const k=i.rect.join(); if(seen.has(k))continue; seen.add(k); out.push(i);
        const [x,y,w,h]=i.rect; const d=document.createElement('div'); d.className='audit-mk';
        d.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;outline:2px solid #e11d48;outline-offset:1px;z-index:99999;pointer-events:none;border-radius:4px';
        const l=document.createElement('div'); const v=i.by??i.over; l.textContent=v?('+'+v+' px'):(i.tops?('↕ '+(Math.max(...i.tops)-Math.min(...i.tops))+' px'):'перенос');
        l.style.cssText='position:absolute;right:-2px;top:-19px;background:#e11d48;color:#fff;font:600 12px/17px Segoe UI,system-ui;padding:0 6px;border-radius:4px;white-space:nowrap;letter-spacing:0';
        d.appendChild(l); document.body.appendChild(d); }
      return out;
    })()`)
    await sleep(300)
    let rect
    if (Array.isArray(s.crop)) rect = { x: s.crop[0], y: s.crop[1], width: s.crop[2], height: s.crop[3] }
    else if (s.crop) {
      rect = await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(s.crop)})].find(e=>e.getBoundingClientRect().width>0); if(!e) return null; e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return {x:Math.max(0,Math.floor(r.x-16)),y:Math.max(0,Math.floor(r.y-24)),width:Math.ceil(r.width+32),height:Math.ceil(r.height+40)}})()`)
      if (rect) {
        await sleep(200)
        await js(`(()=>{document.querySelectorAll('.audit-mk').forEach(e=>e.remove())})()`)
      }
    }
    // после прокрутки рамки надо пересчитать — проще снять ещё раз разметку
    if (s.crop && !Array.isArray(s.crop)) {
      await js(`(()=>{const A=window.__audit;const r=A.scan();const skip=(i)=>/seat|canvas|cal-months|nav-item|tabbar/.test(i.where)||i.kind==='мелкая зона клика'||(i.kind==='вылезает'&&(i.over??0)<=4)||i.kind==='системное поле';const seen=new Set();
        if (${s.mark === false ? 'false' : 'true'}) for(const i of r.issues){if(skip(i))continue;const k=i.rect.join();if(seen.has(k))continue;seen.add(k);const [x,y,w,h]=i.rect;const d=document.createElement('div');d.className='audit-mk';
        d.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;outline:2px solid #e11d48;outline-offset:1px;z-index:99999;pointer-events:none;border-radius:4px';
        const l=document.createElement('div');const v=i.by??i.over;l.textContent=v?('+'+v+' px'):(i.tops?('↕ '+(Math.max(...i.tops)-Math.min(...i.tops))+' px'):'перенос');
        l.style.cssText='position:absolute;right:-2px;top:-19px;background:#e11d48;color:#fff;font:600 12px/17px Segoe UI,system-ui;padding:0 6px;border-radius:4px;white-space:nowrap;letter-spacing:0';d.appendChild(l);document.body.appendChild(d);}
        const e=[...document.querySelectorAll(${JSON.stringify(s.crop)})].find(e=>e.getBoundingClientRect().width>0); return null})()`)
      rect = await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(s.crop)})].find(e=>e.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.max(0,Math.floor(r.x-16)),y:Math.max(0,Math.floor(r.y-26)),width:Math.min(innerWidth-Math.max(0,Math.floor(r.x-16)),Math.ceil(r.width+48)),height:Math.min(innerHeight-Math.max(0,Math.floor(r.y-26)),Math.ceil(r.height+44))}})()`)
      await sleep(250)
    }
    const img = await win.webContents.capturePage(rect || undefined)
    fs.writeFileSync(path.join(outDir, s.id + '.png'), img.toPNG())
    report.push({ id: s.id, marks: marks.map((m) => ({ kind: m.kind, where: m.where, text: m.text, by: m.by ?? m.over, rect: m.rect })) })
    LOG('снято ' + s.id + ' ' + (marks || []).length)
  }
  fs.writeFileSync(path.join(outDir, 'marks.json'), JSON.stringify(report, null, 1))
  app.quit()
})
