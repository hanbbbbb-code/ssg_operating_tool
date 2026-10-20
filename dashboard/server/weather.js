import { readFile } from 'node:fs/promises';

export const CACHE_MS = 10 * 60 * 1000;
export const TIMEOUT_MS = 5000;
const location = { id:'seoul', name:'서울 중구 참고 좌표', note:'예제A점의 실제 위치가 아닙니다.', lat:37.5636, lon:126.9828, timezone:'Asia/Seoul' };
const reasons = { 'missing-key':'서버 날씨 키가 설정되지 않았습니다.', timeout:'OpenWeather 요청이 5초 제한 시간을 초과했습니다.', unauthorized:'OpenWeather 인증에 실패했습니다.', 'rate-limit':'OpenWeather 요청 한도를 초과했습니다.', 'provider-error':'OpenWeather 제공처 응답에 실패했습니다.', 'invalid-response':'OpenWeather 응답 형식이 올바르지 않습니다.' };
const readSample = async () => JSON.parse(await readFile(new URL('../public/data/weather-sample.json', import.meta.url), 'utf8'));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const validWeather = x => finite(x?.dt) && finite(x?.main?.temp) && finite(x?.main?.feels_like) && finite(x?.main?.humidity) && finite(x?.wind?.speed) && typeof x?.weather?.[0]?.description === 'string' && finite(x.weather[0].id);
const fail = code => Object.assign(new Error(code), { code });

export function normalizeWeather(current, forecast, fetchedAt) {
 if (!validWeather(current) || !Array.isArray(forecast?.list) || !forecast.list.length || !finite(forecast?.city?.timezone) || !forecast.list.every(x => validWeather(x) && finite(x.main.temp_min) && finite(x.main.temp_max) && finite(x.pop) && x.pop>=0 && x.pop<=1)) throw fail('invalid-response');
 const groups = new Map();
 for (const slot of [...forecast.list].sort((a,b)=>a.dt-b.dt)) {
  const date = new Date((slot.dt + forecast.city.timezone)*1000).toISOString().slice(0,10);
  const group = groups.get(date) || {date,min:Infinity,max:-Infinity,pop:0,description:slot.weather[0].description,conditionId:slot.weather[0].id,slots:0};
  group.min=Math.min(group.min,slot.main.temp_min);group.max=Math.max(group.max,slot.main.temp_max);group.pop=Math.max(group.pop,slot.pop);group.slots++;
  groups.set(date,group);
 }
 const days=[...groups.values()].slice(0,5);
 if (days.length!==5) throw fail('invalid-response');
 return { mode:'live',status:'실시간 날씨',reason:null,message:'OpenWeather 현재 날씨 및 5일/3시간 예보 응답',location,source:{name:'OpenWeather',url:'https://openweathermap.org/'},fetchedAt,observedAt:new Date(current.dt*1000).toISOString(),cached:false,current:{temp:current.main.temp,feelsLike:current.main.feels_like,humidity:current.main.humidity,wind:current.wind.speed,description:current.weather[0].description,conditionId:current.weather[0].id},forecast:days,forecastNote:'3시간 예보를 현지 날짜별로 집계한 최저·최고·최대 강수확률입니다. 첫날·마지막 날은 일부 시간대만 포함될 수 있습니다.' };
}

export function createWeatherService({getKey=()=>process.env.OPENWEATHER_API_KEY,fetchImpl=fetch,now=Date.now,loadSample=readSample,timeoutMs=TIMEOUT_MS,ttlMs=CACHE_MS}={}) {
 let cache=null, pending=null;
 const fallback=async reason=>({...await loadSample(),mode:'sample',status:'예제 날씨 · 실제 관측·예보 아님',reason,message:reasons[reason]||reasons['provider-error'],checkedAt:new Date(now()).toISOString(),cached:false});
 async function request(key) {
  const controller=new AbortController(); let timer;
  try {
   const job=Promise.all(['weather','forecast'].map(async endpoint=>{
    const url=new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
    url.search=new URLSearchParams({lat:String(location.lat),lon:String(location.lon),units:'metric',lang:'kr',appid:key}).toString();
    const response=await fetchImpl(url,{signal:controller.signal});
    if(!response.ok)throw fail(response.status===401||response.status===403?'unauthorized':response.status===429?'rate-limit':'provider-error');
    try{return await response.json();}catch{throw fail('invalid-response');}
   }));
   const data=await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail('timeout'));},timeoutMs);})]);
   const value=normalizeWeather(...data,new Date(now()).toISOString());
   cache={key,value,expires:now()+ttlMs};return {...value,checkedAt:new Date(now()).toISOString()};
  } catch(error) {controller.abort();return fallback(error.code||'provider-error');}
  finally{clearTimeout(timer);}
 }
 return async function getWeather() {
  const key=String(getKey()||'').trim();
  if(!key)return fallback('missing-key');
  if(cache?.key===key && now()<cache.expires)return {...cache.value,cached:true,checkedAt:new Date(now()).toISOString()};
  if(pending?.key===key)return pending.promise;
  const promise=request(key);pending={key,promise};
  try{return await promise;}finally{if(pending?.promise===promise)pending=null;}
 };
}
export const getWeather=createWeatherService();
