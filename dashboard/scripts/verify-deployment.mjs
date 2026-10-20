import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { normalizeWorkbook, mergeRecords } from '../src/sales-data.js';
import { parseTasks, taskBucket, selectTasks } from '../src/operations.js';
import { createWeatherService } from '../server/weather.js';
import handler from '../api/weather.js';

const read = file => readFile(new URL(`../${file}`, import.meta.url));
const sample = JSON.parse(await read('public/data/weather-sample.json'));
assert.equal((await read('.env.example')).toString().trim(), 'OPENWEATHER_API_KEY=');
assert.deepEqual((await readdir(new URL('../public/data/', import.meta.url))).sort(),
  ['event-preparation.csv','report-template.xlsx','sales-online.xlsx','sales-popup.xlsx','sales-store.xlsx','weather-sample.json']);
let rows = [];
for (const [file, channel] of [['sales-store.xlsx','영업'],['sales-online.xlsx','온라인'],['sales-popup.xlsx','팝업']]) {
  const parsed = normalizeWorkbook(file, await read(`public/data/${file}`), channel);
  assert.equal(parsed.rows.length, 160);
  assert(parsed.rows.every(row => /^예제[A-D]점$/.test(row.점포) && /^가상브랜드\d{2}$/.test(row.브랜드)));
  rows = mergeRecords(rows, parsed.rows).rows;
}
assert.equal(rows.length, 480);
const template = XLSX.read(await read('public/data/report-template.xlsx'));
assert.equal(XLSX.utils.sheet_to_json(template.Sheets.보고).length, 0);
const tasks = parseTasks((await read('public/data/event-preparation.csv')).toString());
assert.equal(new Set(tasks.map(x => x.task_id)).size, 72);
assert(tasks.every(x => x.자료구분 === '가상'));
for (const [date, expected] of [['2026-10-20',[12,6,12,6,6]],['2026-10-22',[24,6,6,0,6]]]) {
  const selected = selectTasks(tasks, {date});
  assert.deepEqual(['지연','오늘 마감','2일 내 임박','이후','날짜 확인 필요'].map(b => selected.filter(x => taskBucket(x,date) === b).length), expected);
}
const sentinel = 'DEPLOY_TEST_ONLY_NOT_A_REAL_CREDENTIAL';
const loadSample = async () => structuredClone(sample);
for (const [key, status, reason] of [['',0,'missing-key'],[sentinel,401,'unauthorized'],[sentinel,429,'rate-limit'],[sentinel,500,'provider-error']]) {
  let calls = 0;
  const result = await createWeatherService({getKey:()=>key,loadSample,fetchImpl:async()=>{calls++;return {ok:false,status};}})();
  assert.equal(result.mode, 'sample');
  assert.equal(result.reason, reason);
  assert(!JSON.stringify(result).includes(sentinel));
  if (!key) assert.equal(calls, 0);
}
// Invoke the actual Vercel entry point without credentials or an external API call.
const previous = process.env.OPENWEATHER_API_KEY;
delete process.env.OPENWEATHER_API_KEY;
try {
  for (const [method, status] of [['GET',200],['POST',405]]) {
    const res = { headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;} };
    await handler({method},res);
    assert.equal(res.code,status);
    assert.equal(res.headers['Cache-Control'],'no-store');
    if (method === 'GET') {assert.equal(res.body.mode,'sample');assert.equal(res.body.reason,'missing-key');}
    else assert.equal(res.headers.Allow,'GET');
  }
} finally {
  if (previous === undefined) delete process.env.OPENWEATHER_API_KEY;
  else process.env.OPENWEATHER_API_KEY = previous;
}
console.log('PASS: public allowlist · fictional sales 480 · fictional tasks 72 · both date distributions · empty template/env · missing/auth/rate/provider fallback · Vercel GET/POST boundary');
