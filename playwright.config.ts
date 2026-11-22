import {defineConfig,devices} from '@playwright/test'

const launchOptions=process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:undefined
const local='http://127.0.0.1:4173/gta6-chinese-companion/'
export default defineConfig({
  testDir:'tests/e2e',
  fullyParallel:true,
  workers:process.env.CI ? 2 : 3,
  timeout:23000,
  expect:{timeout:8500},
  reporter:'list',
  use:{baseURL:process.env.LIVE_URL||local,trace:'retain-on-failure',actionTimeout:8500,navigationTimeout:12000},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],launchOptions,viewport:{width:1365,height:900}}},
    {name:'iphone',use:{...devices['iPhone 15'],defaultBrowserType:'webkit'}},
    {name:'iphone-landscape',use:{...devices['iPhone 15 landscape'],defaultBrowserType:'webkit'}},
    {name:'ipad',use:{...devices['iPad Pro 11'],defaultBrowserType:'webkit'}},
    {name:'android',use:{...devices['Pixel 7'],launchOptions}},
  ],
  webServer:process.env.LIVE_URL?undefined:{command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',url:local,reuseExistingServer:!process.env.CI,timeout:15000},
})
