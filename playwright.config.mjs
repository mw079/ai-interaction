import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/browser',
  testMatch:'*.spec.mjs',
  use:{
    browserName:'chromium',
    channel:process.env.PLAYWRIGHT_CHANNEL||undefined
  },
  projects:[
    {name:'desktop',use:{viewport:{width:1280,height:720}}},
    {name:'narrow',use:{viewport:{width:390,height:720}}}
  ]
});
