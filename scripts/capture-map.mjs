import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,devices} from '@playwright/test'

const baseline=process.argv[2]
if(!baseline)throw new Error('Provide the baseline checkout path.')
const output='test-results/map-evidence'
const path='/gta6-chinese-companion/'
const servers=[]
const snapshots=[]
async function serve(directory,port){
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:directory,stdio:'inherit'})
  servers.push(server)
  const url='http://127.0.0.1:'+port+path
  for(let retry=0;retry<50;retry++){
    if(await fetch(url).then(r=>r.ok,()=>false))return url
    await new Promise(resolve=>setTimeout(resolve,200))
  }
  throw new Error('Preview unavailable: '+url)
}
async function capture(browser,url,name,{ratio,zoom,device={},legacy=false,route='map'}={}){
  const context=await browser.newContext({viewport:{width:1260,height:820},deviceScaleFactor:ratio,serviceWorkers:'block',...device})
  try{
    const page=await context.newPage()
    const faults=[]
    page.on('pageerror',error=>faults.push(error.message))
    page.on('response',response=>{if(response.url().includes('/map/tiles/')&&!response.ok())faults.push(response.status()+' '+response.url())})
    if(zoom!==undefined){
      await page.addInitScript(({zoom,legacy})=>{
        const lat=-15409/64
        const lng=15518/64
        localStorage.setItem('leonida-companion.map.v1',JSON.stringify(legacy
          ? {lat:lat+5376/64,lng:lng-5384/64,zoom}
          : {lat,lng,zoom,grid:'gtadb-leonida'}))
        localStorage.setItem('leonida-companion.labels','false')
      },{zoom,legacy})
    }
    await page.goto(url+'#/'+route,{waitUntil:'networkidle'})
    const canvas=page.getByTestId('map-canvas')
    if(route.startsWith('map')){
      await canvas.waitFor()
      await page.locator('.leaflet-image-layer').first().waitFor()
      if(zoom!==undefined)await page.locator('.leaflet-tile-loaded[src$=".jpg"]').first().waitFor()
    }
    await page.screenshot({path:output+'/'+name+'.png',animations:'disabled',timeout:12000})
    if(faults.length)throw new Error(name+': '+faults.join(', '))
    if(zoom!==undefined){
      const sample=await canvas.evaluate(node=>{
        const tiles=[...node.querySelectorAll('.leaflet-tile-loaded[src$=".jpg"]')].map(img=>({
          width:img.naturalWidth, displayed:img.getBoundingClientRect().width,
          url:new URL(img.src).pathname,
        }))
        return {zoom:node.dataset.zoom,maxZoom:node.dataset.maxZoom,dpr:devicePixelRatio,tiles:tiles.length,
          minimumSourcePixelsPerCssPixel:Math.min(...tiles.map(t=>t.width/t.displayed)),sample:tiles[0]?.url}
      })
      if(!legacy&&sample.minimumSourcePixelsPerCssPixel<sample.dpr-.02)throw new Error(name+': 缩放超出原生像素 '+JSON.stringify(sample))
      snapshots.push({name,...sample})
    }
  }finally{await context.close()}
}
const opened=[]
try{
  await mkdir(output,{recursive:true})
  const [oldSite,newSite]=await Promise.all([serve(baseline,4174),serve('.',4175)])
  const chrome=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})
  opened.push(chrome)
  const safari=await webkit.launch()
  opened.push(safari)
  await capture(chrome,oldSite,'01-v1-same-street-dpr1',{ratio:1,zoom:6,legacy:true})
  await capture(chrome,newSite,'02-v2-same-street-dpr1',{ratio:1,zoom:6})
  await capture(chrome,newSite,'03-v2-retina-dpr2',{ratio:2,zoom:5})
  await capture(chrome,newSite,'04-v2-retina-dpr3',{ratio:3,zoom:4.25})
  await capture(chrome,newSite,'05-v2-state-overview',{ratio:1})
  await capture(chrome,newSite,'06-v2-city-zoom',{ratio:1,zoom:3})
  await capture(safari,newSite,'07-v2-iphone-map',{device:devices['iPhone 15'],route:'map?id=stock-key-lento-market'})
  await capture(safari,newSite,'08-v2-iphone-landscape',{device:devices['iPhone 15 landscape'],route:'map?id=stock-key-lento-market'})
  await capture(safari,newSite,'09-v2-ipad-map',{device:devices['iPad Pro 11'],route:'map?id=vice-city-airport'})
  await capture(chrome,newSite,'10-v2-android-reading',{device:devices['Pixel 7'],route:'library?id=vehicle-ganado-personal'})
  await writeFile(output+'/native-pixels.json',JSON.stringify(snapshots,null,2)+'\n')
}finally{
  await Promise.all(opened.map(browser=>browser.close()))
  for(const server of servers)server.kill()
}
