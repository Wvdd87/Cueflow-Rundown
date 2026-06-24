import { chromium } from 'playwright'
const BASE='http://localhost:3000'
const rand=Math.floor(Math.random()*1e6)
const EMAIL=`cr.${rand}@gmail.com`, PW='TestPass123!'
const ok=m=>console.log('  ✅',m), warn=m=>console.log('  ⚠️ ',m)
const b=await chromium.launch({headless:true})
const p=await (await b.newContext({viewport:{width:1300,height:820}})).newPage()
p.on('pageerror',e=>console.log('[pageerror]',e.message))
async function addColumn(name){
  await p.getByTestId('edit-columns-btn').click(); await p.waitForTimeout(200)
  await p.getByTestId('add-column-btn').click(); await p.waitForTimeout(300)
  await p.getByTestId('column-name').fill(name); await p.getByTestId('add-column-submit').click(); await p.waitForTimeout(700)
}
const colOrder = async ()=> p.evaluate(()=>[...document.querySelectorAll('span')].map(s=>s.textContent?.trim()).filter(t=>t==='Col1'||t==='Col2'))
try{
  await p.goto(`${BASE}/signup`,{waitUntil:'networkidle'})
  await p.fill('input[name="full_name"]','Cr'); await p.fill('input[name="email"]',EMAIL); await p.fill('input[name="password"]',PW)
  await p.click('button[type="submit"]'); await p.waitForURL('**/dashboard',{timeout:20000})
  await p.getByRole('button',{name:/new rundown/i}).first().click(); await p.waitForTimeout(400)
  await p.fill('input[name="name"]','Cr'); await p.getByRole('button',{name:/^create$/i}).click()
  await p.waitForURL('**/rundown/**',{timeout:20000}); await p.waitForTimeout(600)
  await p.getByRole('button',{name:/add first cue/i}).first().click(); await p.waitForTimeout(600)
  await addColumn('Col1'); await addColumn('Col2')
  console.log('before:', JSON.stringify(await colOrder()))
  const pos = await p.evaluate(()=>{
    const head=(name)=>{ const s=[...document.querySelectorAll('span')].find(x=>x.textContent?.trim()===name); return s?.closest('.group\\/col')||s?.parentElement }
    const h1=head('Col1'), h2=head('Col2')
    const grip=h1?.querySelector('[title="Drag to reorder column"]')
    const g=grip?.getBoundingClientRect(), r2=h2?.getBoundingClientRect()
    return g&&r2? {gx:g.x+g.width/2, gy:g.y+g.height/2, tx:r2.x+r2.width/2, ty:r2.y+r2.height/2} : null
  })
  if(pos){
    await p.mouse.move(pos.gx, pos.gy); await p.mouse.down()
    await p.mouse.move(pos.gx+8, pos.gy, {steps:3}); await p.waitForTimeout(120)
    await p.mouse.move(pos.tx, pos.ty, {steps:10}); await p.waitForTimeout(150)
    await p.mouse.move(pos.tx+4, pos.ty, {steps:2}); await p.waitForTimeout(120)
    await p.mouse.up(); await p.waitForTimeout(1200)
  } else warn('could not locate grip/target')
  const errToast = await p.getByText(/not-null|violates|null value/i).count()
  errToast===0 ? ok('no not-null constraint error toast') : warn(`ERROR TOAST present (count=${errToast})`)
  console.log('after drag:', JSON.stringify(await colOrder()))
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1300)
  const after = await colOrder()
  console.log('after reload:', JSON.stringify(after))
  if(JSON.stringify(after)===JSON.stringify(['Col2','Col1'])) ok('reorder PERSISTED to DB (Col2 before Col1)')
  else warn('order after reload: '+JSON.stringify(after))
}catch(e){ console.log('SCRIPT ERROR:',e.message) }
finally{ await b.close() }
