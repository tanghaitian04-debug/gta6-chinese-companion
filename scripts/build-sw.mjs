import {createHash} from 'node:crypto'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const assets = readdirSync('dist/assets').map(name=>'assets/'+name)
const files = ['index.html','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest','map/cover.webp','map/overview.webp','map/blank.svg','map/water.svg',...assets]
const hash = createHash('sha256')
for(const name of files) hash.update(readFileSync(join('dist',name)))
const cache='leonida-app-'+hash.digest('hex').slice(0,18)
writeFileSync('dist/sw.js',`
const shell = ${JSON.stringify(cache)};
const files = ${JSON.stringify(files)};
const tiles = shell + '-tiles';
const scope = self.registration.scope;
const asset = path => new URL(path, scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(shell).then(cache => cache.addAll(files.map(asset))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('leonida-app-') && key !== shell && key !== tiles).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET' || !request.url.startsWith(scope)) return;
  if(request.mode === 'navigate'){
    event.respondWith(fetch(request).catch(() => caches.open(shell).then(cache => cache.match(asset('index.html')))));
    return;
  }
  if(request.url.startsWith(asset('map/tiles/'))){
    event.respondWith((async() => {
      const cache = await caches.open(tiles);
      const saved = await cache.match(request);
      if(saved) return saved;
      try{
        const response = await fetch(request);
        if(response.ok){
          await cache.put(request,response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0,Math.max(0,keys.length-220)).map(key=>cache.delete(key)));
        }
        return response;
      }catch{
        return caches.open(shell).then(cache => cache.match(asset('map/blank.svg')));
      }
    })());
    return;
  }
  if(files.some(path => asset(path) === request.url)){
    // These build assets are immutable and identical for same-origin requests with different Origin headers.
    event.respondWith(caches.open(shell).then(cache=>cache.match(request,{ignoreVary:true})).then(saved=>saved||fetch(request)));
  }
});
`)
writeFileSync('dist/.nojekyll','')

const clientDeps = Object.keys(JSON.parse(readFileSync('package.json','utf8')).dependencies)
const notices = clientDeps.map(name => {
  const dir = 'node_modules/' + name
  const license = readdirSync(dir).find(file => /^(li[cs]en[cs]e|copying)(\.|$)/i.test(file))
  const metadata = JSON.parse(readFileSync(dir + '/package.json','utf8'))
  return name + ' — ' + (metadata.license ?? 'see package') + '\n' + (license ? readFileSync(dir + '/' + license,'utf8') : 'https://www.npmjs.com/package/' + name)
})
writeFileSync('dist/third-party-notices.txt',notices.join('\n\n--------------------------------\n\n'))
