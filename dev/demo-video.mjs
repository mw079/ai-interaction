// Records a demo video of the real app: a short, open request grows into a detailed one through
// live help (answer, question, highlights with pickers, Tab), then Send builds a page with views,
// a change is previewed and made, and Go deeper answers a follow-up question.
//
// Usage (with the app running with a key and a high DAILY_LIMIT, e.g. DAILY_LIMIT=5000 PORT=4319 npm run dev):
//   DEMO_URL=http://127.0.0.1:4319 npm run demo-video
// Writes artifacts/video/ai-interaction-demo.mp4 (1080p, music) and public/demo.mp4 (small, silent,
// looping, shown in the "Try again tomorrow" card). About 12 model requests.
//
// How: Playwright opens a wrapper page on the app's own origin (so the app's frame-ancestors rule
// allows it) that draws the look (gradient, a window around the real app, a cursor with click
// rings, a title card with the name at the start and end, gentle zoom; no text during the video) and drives the app inside it. Chrome streams frames;
// waits for a page are compressed to a few seconds, live help is shown at its real speed. ffmpeg
// turns the frames into video and adds music from demo-music.mjs.
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {demoMusic} from './demo-music.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = (process.env.DEMO_URL || 'http://127.0.0.1:4317').replace(/\/$/, '');
const W = 1920, H = 1080, WIN = {x: 160, y: 60, w: 1600, h: 900}, BAR = 40;
const SPEED = Number(process.env.DEMO_SPEED || 1.25);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const WRAPPER = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#13283d;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif}
#bg{position:absolute;inset:0;background:radial-gradient(120% 95% at 14% 16%,#a9c4e2 0%,#5f8bb8 30%,#2f5d8a 60%,#0f2135 100%)}
#grain{position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
#stage{position:absolute;inset:0;transition:transform 1.1s cubic-bezier(.22,1,.36,1),opacity .9s ease}
#win{position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px;border-radius:14px;overflow:hidden;background:#f6f6f6;box-shadow:0 40px 90px rgba(5,15,30,.55),0 0 0 1px rgba(255,255,255,.14)}
#bar{height:${BAR}px;display:flex;align-items:center;gap:8px;padding:0 16px;background:#f2f2f2;border-bottom:1px solid #e2e2e2;font-size:14px;font-weight:600;color:#3a3a3a}
.dot{width:12px;height:12px;border-radius:50%}.r{background:#ff5f57}.y{background:#febc2e}.g{background:#28c840}
#bar .title{margin-left:14px}#bar .url{margin-left:10px;font-weight:400;color:#8a8a8a}
#app{display:block;width:100%;height:${WIN.h - BAR}px;border:0;background:#f6f6f6}
#cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transform:translate(${W / 2}px,${H / 2}px);transition:transform .75s cubic-bezier(.22,1,.36,1),opacity .5s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
body.titles #cursor{opacity:0}
.ring{position:absolute;z-index:19;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 0 5px rgba(255,255,255,.25);pointer-events:none;animation:ring .6s ease-out forwards}
@keyframes ring{from{transform:scale(.35);opacity:1}to{transform:scale(1.35);opacity:0}}
.card{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;opacity:0;transition:opacity .9s ease;pointer-events:none}
.card.on{opacity:1}
.card h1{margin:0;font-size:92px;font-weight:800;letter-spacing:-.035em}
body.titles #stage{opacity:0;transform:scale(.97)}
</style></head><body class="titles">
<div id="bg"></div><div id="grain"></div>
<div id="stage"><div id="win">
  <div id="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title">AI Interaction</span><span class="url">live demo</span></div>
  <iframe id="app"></iframe>
</div></div>
<div id="intro" class="card on"><h1>AI Interaction</h1></div>
<div id="outro" class="card"><h1>AI Interaction</h1></div>
<svg id="cursor" width="30" height="34" viewBox="0 0 30 34"><path d="M3 2 L3 26 L9.5 20 L14 31 L18.5 29 L14 18.5 L23 18.5 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
</body></html>`;

async function main() {
  const config = await fetch(`${BASE}/api/config`).then(r => r.json()).catch(() => null);
  if (!config?.live) throw new Error(`Start the app with an OpenAI key at ${BASE} (DEMO_URL) before recording.`);
  const work = mkdtempSync(join(tmpdir(), 'ai-interaction-video-'));
  const framesDir = join(work, 'frames');
  mkdirSync(framesDir);
  const outDir = join(ROOT, 'artifacts', 'video');
  mkdirSync(outDir, {recursive: true});

  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'}).catch(() => chromium.launch());
  const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
  // The wrapper is served from the app's own origin, so the app may be shown in its frame.
  await page.route(`${BASE}/__demo`, route => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: WRAPPER}));
  await page.goto(`${BASE}/__demo`);
  const app = page.frameLocator('#app');

  // ---- Frames (CDP screencast). Size the window so the capture is exactly W × H.
  const cdp = await page.context().newCDPSession(page);
  {
    const {windowId} = await cdp.send('Browser.getWindowForTarget');
    const tall = H + 300;
    await cdp.send('Browser.setWindowBounds', {windowId, bounds: {width: W, height: tall}});
    const shown = await new Promise(resolve => {
      cdp.once('Page.screencastFrame', f => {
        cdp.send('Page.screencastFrameAck', {sessionId: f.sessionId}).catch(() => {});
        resolve(f.metadata.deviceHeight ?? H);
      });
      cdp.send('Page.startScreencast', {format: 'jpeg', quality: 50, maxWidth: W, maxHeight: tall});
    });
    await cdp.send('Page.stopScreencast');
    await cdp.send('Browser.setWindowBounds', {windowId, bounds: {width: W, height: H + (tall - shown)}});
  }
  const frames = [];
  cdp.on('Page.screencastFrame', f => {
    const file = join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({file, ts: f.metadata.timestamp ?? Date.now() / 1000});
    cdp.send('Page.screencastFrameAck', {sessionId: f.sessionId}).catch(() => {});
  });
  const cast = async everyNth => {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: everyNth});
  };
  const fast = []; // frame ranges to compress

  // ---- Wrapper helpers.
  const js = fn => page.evaluate(fn);
  // No on-screen text during the video: a short pause where a step begins.
  const beat = () => sleep(700);
  let cursor = {x: W / 2, y: H / 2};
  const moveTo = async (x, y) => {
    const d = Math.hypot(x - cursor.x, y - cursor.y);
    cursor = {x, y};
    await js(`document.getElementById('cursor').style.transform='translate(${x - 3}px,${y - 2}px)'`);
    await page.mouse.move(x, y);
    await sleep(Math.min(900, 300 + d * 0.6));
  };
  const centre = async l => {
    const b = await l.boundingBox();
    if (!b) throw new Error(`Not on screen: ${l}`);
    return {x: b.x + b.width / 2, y: b.y + b.height / 2};
  };
  const ring = (x, y) => js(`(()=>{const r=document.createElement('div');r.className='ring';r.style.left='${x}px';r.style.top='${y}px';document.body.appendChild(r);setTimeout(()=>r.remove(),700);})()`);
  const clickAt = async (p, pauseAfter = 500) => {
    await moveTo(p.x, p.y);
    await ring(p.x, p.y);
    await sleep(120);
    await page.mouse.click(p.x, p.y);
    await sleep(pauseAfter);
  };
  const click = async (l, pauseAfter = 500) => {
    await l.scrollIntoViewIfNeeded();
    await sleep(250);
    await clickAt(await centre(l), pauseAfter);
  };
  const zoom = async (scale, at) => {
    const o = at || {x: W / 2, y: H / 2};
    await js(`(()=>{const s=document.getElementById('stage');s.style.transformOrigin='${o.x}px ${o.y}px';s.style.transform='scale(${scale})';document.body.classList.toggle('zoomed',${scale > 1});})()`);
    await sleep(1200);
  };
  const visible = l => l.isVisible().catch(() => false);
  const until = async (test, ms, what) => {
    for (const end = Date.now() + ms; ; ) {
      if (await test()) return true;
      if (Date.now() > end) {console.warn(`(gave up waiting for ${what})`);return false;}
      await sleep(250);
    }
  };
  /** Wait while frames are thinned out; the wait becomes `seconds` long in the video. */
  const compressed = async (text, test, seconds, ms = 90_000) => {
    await beat();
    await cast(10);
    const from = frames.length;
    const ok = await until(test, ms, text);
    await sleep(400);
    fast.push({from, to: frames.length, seconds});
    await cast(1);
    if (!ok) throw new Error(`Timed out: ${text}`);
  };

  // App parts.
  const box = app.getByRole('textbox', {name: 'Your next instruction'});
  const question = app.locator('#live-question .live-question-button');
  const answer = app.locator('#quick-answer');
  const options = app.locator('#intent-popover:not([hidden]) #popover-options button');
  const ghost = app.locator('#completion-line');
  const pageReady = () => app.locator('.document-panel.has-slide:not([data-generating])').count().then(n => n > 0);
  const tabs = app.locator('[role=tablist][aria-label=Views] [role=tab]');
  const typeSlowly = async text => {for (const ch of text) {await page.keyboard.type(ch);await sleep(45 + Math.random() * 70);}};
  const liveHelpShown = async () => (await visible(answer)) && (await answer.textContent()).trim().length > 0 &&
    (await visible(question)) && !(await question.isDisabled().catch(() => true));

  // ---- The scene.
  await js(`document.getElementById('app').src=${JSON.stringify(`${BASE}/`)}`);
  await box.waitFor({timeout: 30_000});
  await sleep(1500);
  await cast(1);
  await sleep(3400); // title card
  await js(`document.getElementById('intro').classList.remove('on');document.body.classList.remove('titles')`);
  await sleep(1600);

  // 1. A rough thought.
  await beat();
  const composer = await centre(app.locator('.composer'));
  await zoom(1.3, {x: composer.x, y: composer.y - 60});
  await click(box, 300);
  await typeSlowly('Plan a trip to Portugal');
  await until(liveHelpShown, 15_000, 'live help');
  await sleep(600);
  await beat();
  await sleep(4200);

  // 2. Answer the question with one click.
  await beat();
  await click(question, 900);
  if (await until(() => visible(options.first()), 4000, 'question options')) await click(options.first(), 1400);
  else await page.keyboard.press('Escape');
  await until(liveHelpShown, 12_000, 'refreshed live help');
  await sleep(1200);

  // 3. A highlight opens a picker.
  await beat();
  const marks = app.locator('#input-mirror mark:not(.confirmed)');
  let picked = false;
  for (let i = 0; i < Math.min(3, await marks.count()) && !picked; i++) {
    await clickAt(await centre(marks.nth(i)), 900);
    const choice = app.locator('#intent-popover:not([hidden]) #popover-options button.control-option');
    if (await until(() => visible(choice.first()), 2500, 'picker options')) {
      await click(choice.nth(Math.min(1, (await choice.count()) - 1)), 1400);
      picked = true;
    } else await page.keyboard.press('Escape');
  }
  await until(liveHelpShown, 12_000, 'refreshed live help');
  await sleep(1000);

  // 4. Tab accepts the predicted words.
  await click(box, 200);
  await page.keyboard.press('End');
  await page.keyboard.press('Meta+ArrowDown');
  if (await until(() => visible(ghost), 9000, 'Tab prediction')) {
    await beat();
    await sleep(2600);
    await page.keyboard.press('Tab');
    await sleep(2400);
  }
  await zoom(1);

  // 5. Send builds a page.
  await beat();
  await click(app.locator('#build-page'), 300);
  await compressed('Building the page: title and introduction first, then the visual', pageReady, 3.5);
  await compressed('More views join as tabs in the background', async () => (await tabs.count()) >= 2, 2, 20_000).catch(() => {});
  await beat();
  await zoom(1.22, await centre(app.locator('.atlas-visual')));
  const next = app.locator('.atlas-visual [role=tabpanel]:not([hidden]) .dg-step[aria-label=Next], .atlas-visual > .component-block .dg-step[aria-label=Next]').first();
  for (let i = 0; i < 2 && (await visible(next)); i++) await click(next, 1300);
  if ((await tabs.count()) >= 2) {await click(tabs.nth(1), 2200);await click(tabs.nth(0), 1200);}
  await zoom(1);

  // 6. A change, previewed before Send.
  await beat();
  const dock = await centre(app.locator('.composer'));
  await zoom(1.3, {x: dock.x, y: dock.y - 40});
  await click(box, 300);
  await typeSlowly('Add a rainy day option');
  await until(async () => /^Will\b/.test(((await answer.textContent().catch(() => '')) || '').trim()), 15_000, 'change preview');
  await sleep(2600);
  await click(app.locator('#build-page'), 300);
  await zoom(1);
  await compressed('Changing only what you asked for', pageReady, 3);
  await sleep(2200);

  // 7. Go deeper.
  const deeper = app.locator('.atlas-next-button').first();
  if (await visible(deeper)) {
    await beat();
    await click(deeper, 400);
    await until(() => visible(app.locator('.atlas-next-answer')), 15_000, 'Go deeper answer');
    await sleep(600);
    await zoom(1.2, await centre(app.locator('.atlas-next-panel')));
    await sleep(3600);
    await zoom(1);
  }

  await beat();
  await js(`document.getElementById('outro').classList.add('on');document.body.classList.add('titles')`);
  await sleep(4400);
  await cdp.send('Page.stopScreencast');
  await browser.close();

  // ---- Edit: frame durations from timestamps; compressed waits; playback speed.
  const durations = frames.map((f, i) => (i + 1 < frames.length ? Math.max(0, frames[i + 1].ts - f.ts) : 1));
  for (const seg of fast) {
    const raw = durations.slice(seg.from, seg.to).reduce((a, b) => a + b, 0);
    for (let i = seg.from; i < seg.to; i++) durations[i] *= raw > 0 ? seg.seconds / raw : 0;
  }
  for (let i = 0; i < durations.length; i++) durations[i] /= SPEED;
  const list = ['ffconcat version 1.0', ...frames.flatMap((f, i) => [`file '${f.file}'`, `duration ${durations[i].toFixed(5)}`]), `file '${frames.at(-1).file}'`];
  writeFileSync(join(work, 'frames.ffconcat'), list.join('\n'));
  const silent = join(work, 'video.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'frames.ffconcat'),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-movflags', '+faststart', silent]);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', silent]).toString().trim());
  const music = join(work, 'music.wav');
  demoMusic(seconds + 0.5, music);
  const full = join(outDir, 'ai-interaction-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'volume=0.7', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', full]);
  // The card version: small, silent, looping in the "Try again tomorrow" card.
  const card = join(ROOT, 'public', 'demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-an', '-vf', 'scale=960:-2,fps=24', '-c:v', 'libx264',
    '-preset', 'slow', '-crf', '30', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', card]);
  rmSync(work, {recursive: true, force: true});
  console.log(`wrote ${full} (${seconds.toFixed(1)} s, ${frames.length} frames) and ${card}`);
}

main().catch(error => {console.error(error.message || error);process.exit(1);});
