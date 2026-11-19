// Live, opt-in quality and latency smoke test against the local app.
import assert from 'node:assert/strict';
import {readSSE} from '../public/shared/stream.js';

const app=new URL(process.env.LUNA_BASE_URL||'http://127.0.0.1:4317');
assert.equal(app.protocol,'http:','Use the local HTTP development server.');
assert.equal(app.hostname,'127.0.0.1','Use a loopback address for this smoke test.');
assert.ok(!app.username&&!app.password,'The URL should contain only the local app address.');
const configResponse=await fetch(new URL('/api/config',app),{signal:AbortSignal.timeout(5000)});
assert.ok(configResponse.ok,'Start the local app before running the smoke test.');
assert.ok((await configResponse.json()).serverKey,'Configure the local app’s OpenAI key before running the smoke test.');

const cases=[
  {
    name:'Kepler',
    text:'Explain Kepler’s equal-areas law for undergraduates. Connect it to conservation of angular momentum.',
    confirm:[{type:'audience',phrase:'Kepler’s equal-areas law',value:'Undergraduate'}],
    check(answer){
      assert.match(answer,/angular momentum/i);
      assert.match(answer,/equal areas|areal (?:velocity|speed|rate)|sweep/i);
    }
  },
  {
    name:'Evaporation and sublimation',
    text:'Explain the difference between evaporation and sublimation.',
    check(answer){
      assert.match(answer,/evaporation.*liquid|liquid.*evaporation/i);
      assert.match(answer,/sublimation.*solid|solid.*sublimation/i);
      assert.match(answer,/gas|vapor/i);
    }
  },
  {
    name:'Kyoto choice',
    text:'Plan a five-day April trip for two adults. Compare Tokyo with Kyoto (Focus on Kyoto). We like temples and historic neighborhoods.',
    confirm:[{type:'goal',phrase:'Which city should the trip focus on?',value:'Focus on Kyoto'}],
    check(answer){
      assert.match(answer,/Kyoto/i);
      assert.match(answer,/temples?|historic|traditional/i);
    }
  }
];

for(const {name,text,confirm=[],check} of cases){
  const start=performance.now();
  const response=await fetch(new URL('/api/preview',app),{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
    body:JSON.stringify({
      text,phase:'preview',format:'Auto',audience:'',stream:true,
      context:JSON.stringify({draft:text,confirmed:confirm})
    })
  });
  assert.ok(response.ok,name+' returned HTTP '+response.status);
  assert.match(response.headers.get('Content-Type'),/text\/event-stream/);
  let firstAnswerMs,final;
  for await(const event of readSSE(response.body)){
    if(event.type==='error')assert.fail(name+': '+event.error);
    if(event.type==='partial'&&event.preview?.answer?.trim()&&firstAnswerMs===undefined){
      firstAnswerMs=Math.round(performance.now()-start);
    }
    if(event.type==='done')final=event;
  }
  const totalMs=Math.round(performance.now()-start);
  assert.equal(final?.model,'gpt-6-luna',name+' must come from live Luna.');
  assert.notEqual(firstAnswerMs,undefined,name+' must stream answer text.');
  const answer=final.preview.body.join(' ').trim();
  assert.ok(answer,name+' returned an empty answer.');
  console.log(name+' · first answer '+firstAnswerMs+' ms · complete '+totalMs+' ms');
  console.log('  '+answer);
  check(answer);
}
