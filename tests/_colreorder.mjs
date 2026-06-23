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
const colOrder = async ()=> p.evaluate(()=>{
  // read the dynamic column header names (font-cond uppercase labels in the sticky header)
  const heads=[...document.querySelectorAll('[data-cue-scroll] .sticky, [data-cue-scroll]')]
  // fallback: collect header label texts
  const labels=[...document.querySelectorAll('span')].map(s=>s.textContent?.trim()).filter(Boolean)
  return labels.filter(t=>t==='Col1'||t==='Col2')
})
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
  // drag Col1 header onto Col2 to reorder
  const c1 = await p.getByText('Col1',{exact:true}).first().boundingBox()
  const c2 = await p.getByText('Col2',{exact:true}).first().boundingBox()
  if(c1&&c2){
    await p.mouse.move(c1.x+6, c1.y+c1.height/2); await p.mouse.down()
    await p.mouse.move(c1.x+20, c1.y+c1.height/2, {steps:4}); await p.waitForTimeout(120)
    await p.mouse.move(c2.x+c2.width/2, c2.y+c2.height/2, {steps:8}); await p.waitForTimeout(150)
    await p.mouse.up(); await p.waitForTimeout(1000)
  } else warn('could not find Col1/Col2 headers')
  // check for the error toast
  const errToast = await p.getByText(/not-null|violates|null value/i).count()
  errToast===0 ? ok('no not-null constraint error toast after reorder') : warn(`error toast present (count=${errToast})`)
  const afterDrag = await colOrder()
  console.log('after drag:', JSON.stringify(afterDrag))
  // reload → confirm the new order persisted (proves the DB update succeeded)
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200)
  const afterReload = await colOrder()
  console.log('after reload:', JSON.stringify(afterReload))
  if(JSON.stringify(afterReload)===JSON.stringify(['Col2','Col1'])) ok('reorder persisted to DB (Col2 before Col1)')
  else if(JSON.stringify(afterReload)===JSON.stringify(afterDrag) && JSON.stringify(afterDrag)!==JSON.stringify(['Col1','Col2'])) ok('reorder persisted ('+JSON.stringify(afterReload)+')')
  else warn('order after reload: '+JSON.stringify(afterReload)+' (drag may not have triggered)')
}catch(e){ console.log('SCRIPT ERROR:',e.message) }
finally{ await b.close() }
