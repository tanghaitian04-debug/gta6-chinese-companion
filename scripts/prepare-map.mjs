import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import sharp from 'sharp'

const configuration=readFileSync('src/data/map.json','utf8')
const map=JSON.parse(configuration)
const sourcePath='maps/tiles/6/'+map.tileSet
const repository='https://github.com/rolux/gtadb.org.git'
const stamp=createHash('sha256').update(configuration).update(readFileSync(new URL(import.meta.url))).digest('hex')
const done='public/map/.built-version'
const ocean='#2c67a4'
if(existsSync(done)&&readFileSync(done,'utf8')===stamp&&existsSync('public/map/overview.webp')&&existsSync('public/icon-512.png'))process.exit(0)

const scratch=mkdtempSync(join(tmpdir(),'leonida-v18-'))
try{
  const checkout=process.env.LEONIDA_GTADB_CHECKOUT||fetchSource()
  const revision=execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
  if(revision!==map.revision)throw new Error('地图资源版本不匹配')
  rmSync('public/map/tiles',{force:true,recursive:true})
  const root=join(checkout,sourcePath)
  let native=0
  for(let sourceZoom=0;sourceZoom<map.upstreamRanges.length;sourceZoom++){
    const layer=sourceZoom+1
    const worldTile=map.tileSize*2**(map.maxTileZoom-layer)
    const [x0,y0,x1,y1]=map.coverage
    const [minX,minY,maxX,maxY]=map.upstreamRanges[sourceZoom]
    for(let x=Math.floor(x0/worldTile);x<Math.ceil(x1/worldTile);x++){
      const output=`public/map/tiles/${layer}/${x}`
      mkdirSync(output,{recursive:true})
      for(let y=Math.floor(y0/worldTile);y<Math.ceil(y1/worldTile);y++){
        if(x<minX||x>maxX||y<minY||y>maxY)continue
        const tile=join(root,String(sourceZoom),`${sourceZoom},${y},${x}.jpg`)
        if(!existsSync(tile))throw new Error('上游瓦片缺失：'+tile)
        copyFileSync(tile,`${output}/${y}.jpg`)
        if(layer===map.maxTileZoom)native++
      }
    }
  }

  const previewZ=3
  const scale=2**(map.maxTileZoom-previewZ)
  const tileWorld=map.tileSize*scale
  const [x0,y0,x1,y1]=map.coverage
  const minTileX=Math.floor(x0/tileWorld),minTileY=Math.floor(y0/tileWorld)
  const tiles=[]
  for(let x=minTileX;x<Math.ceil(x1/tileWorld);x++){
    for(let y=minTileY;y<Math.ceil(y1/tileWorld);y++){
      const input=`public/map/tiles/${previewZ}/${x}/${y}.jpg`
      if(existsSync(input))tiles.push({input,left:(x-minTileX)*256,top:(y-minTileY)*256})
    }
  }
  const width=Math.ceil(x1/tileWorld)*256-minTileX*256
  const height=Math.ceil(y1/tileWorld)*256-minTileY*256
  const overview=await sharp({create:{width,height,channels:3,background:ocean}}).composite(tiles).png().toBuffer()
  const crop={left:x0/scale-minTileX*256,top:y0/scale-minTileY*256,width:(x1-x0)/scale,height:(y1-y0)/scale}
  await Promise.all([
    sharp(overview).extract(crop).resize({height:1500}).webp({quality:92}).toFile('public/map/overview.webp'),
    sharp(overview).extract(crop).resize({width:1210}).modulate({brightness:0.78,saturation:0.9,hue:25}).webp({quality:86}).toFile('public/map/cover.webp'),
    sharp('public/icon.svg').resize(192,192).png().toFile('public/icon-192.png'),
    sharp('public/icon.svg').resize(512,512).png().toFile('public/icon-512.png'),
  ])
  writeFileSync(done,stamp)
  console.log(`Yanis v18：${native} 张原生层瓦片，按原字节发布。`)
}finally{rmSync(scratch,{force:true,recursive:true})}

function fetchSource(){
  const run=(...args)=>execFileSync('git',args,{stdio:['ignore','ignore','inherit'],timeout:240000})
  run('init','--quiet',scratch)
  run('-C',scratch,'remote','add','origin',repository)
  run('-C',scratch,'fetch','--depth=1','--filter=blob:none','origin',map.revision)
  run('-C',scratch,'sparse-checkout','set','--no-cone','/'+sourcePath+'/')
  run('-C',scratch,'checkout','--quiet','--detach',map.revision)
  return scratch
}
