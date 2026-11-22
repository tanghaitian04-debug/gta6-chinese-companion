import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import sharp from 'sharp'

const config = JSON.parse(readFileSync('src/data/map.json','utf8'))
const revision = config.rasterRevision
const path = 'public/assets/gta6-leonida-atlas/basemap.webp'
const done = 'public/map/.built-version'
if (existsSync(done) && readFileSync(done,'utf8') === revision && existsSync('public/icon-512.png')) process.exit(0)
const work = mkdtempSync(join(tmpdir(),'leonida-map-'))
try {
  const input = process.env.LEONIDA_MAP_SOURCE
  const asset = input ? readFileSync(input) : fetchRaster()
  const gitBlob = createHash('sha1').update(`blob ${asset.length}\0`).update(asset).digest('hex')
  if (gitBlob !== '755954b816ca52d4a4ea113c57e040c51b7462e9') throw new Error('地图源文件校验失败')
  const meta=await sharp(asset).metadata()
  if(meta.width!==10000||meta.height!==10000) throw new Error('地图源尺寸不匹配')
  const {width,height,crop,tileSize,maxTileZoom}=config
  mkdirSync('public/map',{recursive:true})
  const map=await sharp(asset).extract(crop).png().toBuffer()
  await Promise.all([
    sharp(map).resize({height:1240}).webp({quality:81}).toFile('public/map/overview.webp'),
    sharp(map).extract({left:490,top:460,width:6150,height:8850}).resize({width:1210})
      .modulate({brightness:0.85,saturation:1.12,hue:32}).webp({quality:82}).toFile('public/map/cover.webp'),
    sharp('public/icon.svg').resize(192,192).png().toFile('public/icon-192.png'),
    sharp('public/icon.svg').resize(512,512).png().toFile('public/icon-512.png'),
  ])
  for(let z=1;z<=maxTileZoom;z++){
    const ratio=2**(config.sourceZoom-z)
    const w=Math.ceil(width/ratio)
    const h=Math.ceil(height/ratio)
    const output=await sharp(map).resize(w,h,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true})
    const cols=Math.ceil(w/tileSize)
    const rows=Math.ceil(h/tileSize)
    for(let x=0;x<cols;x++){
      const directory=`public/map/tiles/${z}/${x}`
      mkdirSync(directory,{recursive:true})
      await Promise.all(Array.from({length:rows},(_,y)=>{
        const tw=Math.min(tileSize,w-x*tileSize)
        const th=Math.min(tileSize,h-y*tileSize)
        const channels=output.info.channels
        const tile=Buffer.alloc(tw*th*channels)
        for(let row=0;row<th;row++){
          const start=((y*tileSize+row)*w+x*tileSize)*channels
          output.data.copy(tile,row*tw*channels,start,start+tw*channels)
        }
        return sharp(tile,{raw:{width:tw,height:th,channels}})
          .extend({top:0,bottom:tileSize-th,left:0,right:tileSize-tw,background:'#395f73'})
          .webp({quality:80}).toFile(`${directory}/${y}.webp`)
      }))
    }
  }
  writeFileSync(done,revision)
} finally {rmSync(work,{force:true,recursive:true})}

function fetchRaster(){
  const gitArgs={stdio:['ignore','ignore','inherit'],timeout:150000}
  execFileSync('git',['init','--quiet',work],gitArgs)
  execFileSync('git',['-C',work,'fetch','--depth=1','--filter=blob:none',
    'https://github.com/navanem/gta6-leonida-atlas.git',revision],gitArgs)
  // Configure the same promisor repository so Git can retrieve the single requested raster.
  execFileSync('git',['-C',work,'remote','add','origin','https://github.com/navanem/gta6-leonida-atlas.git'],gitArgs)
  execFileSync('git',['-C',work,'config','remote.origin.promisor','true'],gitArgs)
  execFileSync('git',['-C',work,'config','remote.origin.partialclonefilter','blob:none'],gitArgs)
  return execFileSync('git',['-C',work,'show',`${revision}:${path}`],{maxBuffer:10_000_000,timeout:120000})
}
