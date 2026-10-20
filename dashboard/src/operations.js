import * as XLSX from 'xlsx';
export const buckets=['전체 미완료','지연','오늘 마감','2일 내 임박','이후','날짜 확인 필요'];
export function taskBucket(task,date) {
 if(['완료','취소'].includes(task.상태))return null;
 if(!task.마감일)return '날짜 확인 필요';
 const diff=(Date.parse(task.마감일)-Date.parse(date))/86400000;
 return diff<0?'지연':diff===0?'오늘 마감':diff<=2?'2일 내 임박':'이후';
}
export function parseTasks(csv) {
 const wb=XLSX.read(csv.replace(/^\uFEFF/,''),{type:'string',raw:true});
 const tasks=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
 if(tasks.some(t=>!t.task_id)||new Set(tasks.map(t=>t.task_id)).size!==tasks.length)throw new Error('task_id가 비어 있거나 중복된 준비 항목이 있습니다.');
 return tasks;
}
export function selectTasks(tasks,{date='2026-10-20',role='',bucket='전체 미완료',search=''}={}) {
 return tasks.filter(t=>taskBucket(t,date)&&(!role||t.담당역할===role)&&(bucket==='전체 미완료'||taskBucket(t,date)===bucket)&&(!search||Object.values(t).some(v=>String(v).includes(search))));
}
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const key='momentroom-operation-tasks-v1';
let saved={};try {const raw=JSON.parse(localStorage.getItem(key)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))saved=raw;}catch{}
const state={tasks:null,date:'2026-10-20',role:'',bucket:'전체 미완료',search:'',weather:null,weatherLoading:false,weatherMode:'actual',boardWeather:{},boardLoading:new Set()};
function persist(){try{localStorage.setItem(key,JSON.stringify(saved));$('#localStatus').textContent='이 브라우저에 저장됨';}catch{$('#localStatus').textContent='저장 실패 · 브라우저 저장 공간을 확인해주세요.';}}
const time=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'정보 없음';
function brief(){return `<section class="card panel brief"><span class="sample-pill">교육용 가상 행사</span><h2>모먼트룸 팝업스토어 — 책상 위, 작은 숲</h2><p>도자기 머그, 작은 트레이, 패브릭 매트로 책상 한편에 초록빛 여유를 더합니다.</p><dl><div><dt>기간</dt><dd>2026년 10월 23일(금)~11월 1일(일)</dd></div><div><dt>장소·운영 시간</dt><dd>예제A점 5층 팝업존 · 매일 오전 10시 30분~오후 8시</dd></div><div><dt>구매 혜택</dt><dd>3만원 이상 구매 시 엽서 세트 1개 증정</dd></div><div><dt>조건</dt><dd>매일 선착순 30명 · 1인 1회 · 준비 수량 소진 시 종료 · 별도 할인 없음</dd></div></dl><small>출처: B · 07_팝업브리프.md</small></section>`;}
export const eventDates={start:'2026-10-23',end:'2026-11-01'};
export function rainActions(weather,tasks) {
 const linked=tasks.filter(t=>!['완료','취소'].includes(t.상태)&&/우천/.test(`${t.준비항목} ${t.확인사항}`));
 return (weather?.forecast||[]).filter(day=>day.date>=eventDates.start&&day.date<=eventDates.end&&Number.isFinite(day.pop)&&day.pop>=.6).map(day=>({...day,tasks:linked}));
}
function card(t){const local=saved[t.task_id]||{};return `<article class="task-card" data-task-card="${esc(t.task_id)}"><button class="task-card-open" data-open-task="${esc(t.task_id)}" aria-label="${esc(t.task_id)} ${esc(t.준비항목)} 상세 열기"><span class="card-id">${esc(t.task_id)} · ${esc(t.우선순위)}</span><h4>${esc(t.준비항목)}</h4><p>${esc(t.담당역할)}</p><p>마감 ${esc(t.마감일||'날짜 확인 필요')}</p><span class="status-pill">원본 ${esc(t.상태)}</span><small>상세 보기 ↗</small></button><label class="card-check"><input type="checkbox" data-check="${esc(t.task_id)}" aria-label="${esc(t.task_id)} 확인" ${local.checked?'checked':''}> 개인 확인</label><label class="card-note">내 메모<input data-operation-note="${esc(t.task_id)}" aria-label="${esc(t.task_id)} 운영 메모" value="${esc(local.note||'')}"></label></article>`;}
function weatherLinks(){
 const w=state.boardWeather[state.weatherMode];
 const controls=`<div class="rain-controls"><label>연결할 날씨<select id="boardWeatherMode"><option value="actual" ${state.weatherMode==='actual'?'selected':''}>실제 서버 조회</option><option value="sample" ${state.weatherMode==='sample'?'selected':''}>예제 날씨 · 연결 연습</option></select></label><button id="reloadBoardWeather" class="quiet-btn">날씨 다시 조회</button></div>`;
 if(!w)return `<section class="card panel rain-panel"><h2>우천 준비 연결</h2>${controls}<p role="status">날씨 불러오는 중…</p></section>`;
 const sample=w.mode!=='live',alerts=rainActions(w,state.tasks);
 return `<section class="card panel rain-panel"><div class="panel-heading"><h2>우천 준비 연결</h2>${controls}</div><p class="weather-mode ${sample?'sample':'live'}"><strong>${sample?'예제 · 실제 예보 아님':'실제 연결 · OpenWeather'}</strong> · ${state.weatherMode==='sample'?'연결 연습용 예제 선택':sample?`서버 예제 전환: ${esc(w.message)}`:'서버에서 받은 예보'}</p><p class="panel-subtitle">행사 기간 ${eventDates.start} ~ ${eventDates.end}와 겹치는 날짜 중 강수확률 60% 이상 · 점검 기준일과 예보 날짜는 별개입니다.<br>${esc(w.location?.name||'')} · ${esc(w.location?.note||'')}<br>출처: ${esc(w.source?.name||'정보 없음')} · 자료 조회 ${time(w.fetchedAt)} · 화면 조회 ${time(w.checkedAt||w.fetchedAt)} (한국)</p>${alerts.length?alerts.map(a=>`<article class="rain-alert"><strong>${esc(a.date)} · 강수확률 ${Math.round(a.pop*100)}%</strong><p>${sample?'예제':'실제 예보'}에 따른 우천 준비 · 담당 필터와 별도로 관련 항목을 연결합니다.</p>${a.tasks.length?a.tasks.map(t=>`<button class="rain-task-link" data-open-task="${esc(t.task_id)}">${esc(t.task_id)} · ${esc(t.준비항목)} 열기 <small>${esc(t.담당역할)}</small></button>`).join(''):'<p>연결할 미완료 우천 항목이 없습니다.</p>'}</article>`).join(''):'<p class="rain-clear">조회된 예보 중 행사 기간과 겹치고 강수확률 60% 이상인 날짜가 없습니다.</p>'}<p class="panel-subtitle">예보 범위에 없는 행사 날짜는 판단하지 않습니다. 연결은 원본 상태나 개인 확인을 자동으로 바꾸지 않습니다.</p></section>`;
}
async function loadBoardWeather(mode){
 if(state.boardLoading.has(mode))return;
 state.boardLoading.add(mode);
 try {
  const response=await fetch(mode==='sample'?'/data/weather-sample.json':'/api/weather',{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('weather');
  state.boardWeather[mode]={...await response.json(),...(mode==='sample'?{mode:'sample',checkedAt:new Date().toISOString()}:{} )};
 } catch {
  try {const response=await fetch('/data/weather-sample.json');if(!response.ok)throw Error('sample');state.boardWeather[mode]={...await response.json(),mode:'sample',message:'날씨 서버에 연결하지 못해 예제로 전환했습니다.',checkedAt:new Date().toISOString()};}
  catch {state.boardWeather[mode]={mode:'sample',forecast:[],message:'서버와 예제 자료를 모두 읽을 수 없습니다.',source:{name:'조회 실패'},checkedAt:new Date().toISOString()};}
 } finally {state.boardLoading.delete(mode);}
}
function bindLocal(root=document){
 root.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{saved[el.dataset.check]={...saved[el.dataset.check],checked:el.checked};persist();document.querySelectorAll('[data-check]').forEach(other=>{if(other.dataset.check===el.dataset.check)other.checked=el.checked;});});
 root.querySelectorAll('[data-operation-note]').forEach(el=>el.oninput=()=>{saved[el.dataset.operationNote]={...saved[el.dataset.operationNote],note:el.value};persist();document.querySelectorAll('[data-operation-note]').forEach(other=>{if(other!==el&&other.dataset.operationNote===el.dataset.operationNote)other.value=el.value;});});
}
function openTask(id){
 const t=state.tasks.find(t=>t.task_id===id);if(!t)return;
 const previous=document.activeElement;document.querySelector('#taskDetail')?.remove();
 const local=saved[id]||{},dialog=document.createElement('dialog');dialog.id='taskDetail';dialog.className='task-detail';dialog.setAttribute('aria-labelledby','detailTitle');
 dialog.innerHTML=`<div class="detail-heading"><span>${esc(t.task_id)} · ${esc(t.업무영역)}</span><button id="closeTask" class="quiet-btn" aria-label="준비 항목 상세 닫기">닫기 ✕</button></div><h2 id="detailTitle">${esc(t.준비항목)}</h2><dl><div><dt>ID</dt><dd>${esc(id)}</dd></div><div><dt>담당 역할</dt><dd>${esc(t.담당역할)}</dd></div><div><dt>마감일</dt><dd>${esc(t.마감일||'날짜 확인 필요 · 임의 날짜를 지정하지 않습니다.')}</dd></div><div><dt>기준일 / 분류</dt><dd>${state.date} · ${taskBucket(t,state.date)||'완료·취소 제외'}</dd></div><div><dt>원본 상태 / 우선순위</dt><dd>${esc(t.상태)} / ${esc(t.우선순위)}</dd></div><div class="detail-instructions"><dt>확인사항</dt><dd>${esc(t.확인사항)}</dd></div></dl><label class="card-check"><input type="checkbox" data-check="${esc(id)}" aria-label="${esc(id)} 상세 확인" ${local.checked?'checked':''}> 개인 확인 · 원본 상태 유지</label><label class="card-note">내 메모<textarea data-operation-note="${esc(id)}" aria-label="${esc(id)} 상세 메모" rows="4">${esc(local.note||'')}</textarea></label><p class="panel-subtitle">출처: C · 08_행사준비.csv · 체크·메모는 이 브라우저에만 저장됩니다.</p>`;
 document.body.append(dialog);bindLocal(dialog);dialog.onclose=()=>{dialog.remove();if(previous?.isConnected)previous.focus();};dialog.querySelector('#closeTask').onclick=()=>dialog.close();dialog.showModal();
}
export async function renderOperations(isCurrent){
 $('.page-title h1').textContent='운영 · 행사 준비';$('.page-title p').textContent='같은 기준일·담당 조건으로 준비 항목을 다섯 보드에서 확인하세요.';
 try {
  if(!state.tasks){const response=await fetch('/data/event-preparation.csv');if(!response.ok)throw new Error('준비표를 읽을 수 없습니다.');state.tasks=parseTasks(await response.text());}
  if(!isCurrent())return;
  $('#dataStatus').textContent=`기준일 ${state.date} · 개인 점검`;
  const rows=selectTasks(state.tasks,{...state,bucket:'전체 미완료'}),roles=[...new Set(state.tasks.map(t=>t.담당역할))].sort();
  $('#dashboard').innerHTML=`<details class="event-brief"><summary>행사 브리프 · 2026-10-23 ~ 11-01 · 예제A점 5층</summary>${brief()}</details><section class="card panel board-toolbar"><div class="panel-heading"><div><h2>준비 항목 카드 보드</h2><p class="panel-subtitle">원본72건 · 완료24·취소6 제외 · 미완료42건 · 현재 조건 <strong id="boardCount">${rows.length}건</strong><br>출처: C · 08_행사준비.csv · 모든 열이 같은 기준일·담당·검색 조건을 사용합니다.</p></div><button id="marketingOnly" class="primary-btn">마케팅 담당만 보기</button></div><div class="filterbar"><label class="filter-control"><span>점검 기준일</span><input id="operationDate" type="date" value="${state.date}"></label><label class="filter-control"><span>담당 역할</span><select id="operationRole"><option value="">전체 역할</option>${roles.map(role=>`<option ${role===state.role?'selected':''}>${esc(role)}</option>`).join('')}</select></label><label class="filter-control"><span>준비 항목 검색</span><input type="search" id="operationSearch" value="${esc(state.search)}" placeholder="항목·담당·확인사항 검색"></label><button id="clearBoardFilters" class="quiet-btn">전체 담당 보기</button></div><p class="local-hint">체크는 개인 점검 표시이며 원본 완료 상태·분류는 바뀌지 않습니다. 체크·메모는 이 브라우저에만 저장됩니다. <span id="localStatus" role="status"></span></p></section><section class="task-board" aria-label="준비 항목 다섯 분류 보드">${buckets.slice(1).map((bucket,index)=>{const list=rows.filter(t=>taskBucket(t,state.date)===bucket);return `<section class="board-column board-column-${index}" aria-label="${bucket} 보드"><header><h3>${bucket}</h3><span class="count-badge">${list.length}건</span></header><div class="board-cards">${list.map(card).join('')||'<p class="board-empty">해당 항목 없음</p>'}</div></section>`;}).join('')}</section>${weatherLinks()}`;
  $('#operationDate').onchange=e=>{if(e.target.value){state.date=e.target.value;renderOperations(isCurrent);}};
  $('#operationRole').onchange=e=>{state.role=e.target.value;renderOperations(isCurrent);};
  $('#marketingOnly').onclick=()=>{state.role='마케팅 담당';state.search='';renderOperations(isCurrent);};
  $('#clearBoardFilters').onclick=()=>{state.role='';state.search='';renderOperations(isCurrent);};
  $('#operationSearch').oninput=e=>{state.search=e.target.value;renderOperations(isCurrent).then(()=>$('#operationSearch')?.focus());};
  $('#boardWeatherMode').onchange=e=>{state.weatherMode=e.target.value;renderOperations(isCurrent);};
  $('#reloadBoardWeather').onclick=()=>{delete state.boardWeather[state.weatherMode];renderOperations(isCurrent);};
  document.querySelectorAll('[data-open-task]').forEach(el=>el.onclick=()=>openTask(el.dataset.openTask));bindLocal();
  const mode=state.weatherMode;
  if(!state.boardWeather[mode]&&!state.boardLoading.has(mode))loadBoardWeather(mode).then(()=>{if(isCurrent()&&state.weatherMode===mode&&!document.querySelector('#taskDetail'))renderOperations(isCurrent);});
 }catch(error){if(isCurrent())$('#dashboard').innerHTML=`<div class="card panel">운영 자료 오류: ${esc(error.message)}</div>`;}
}
export async function renderWeather(isCurrent,refresh=false){
 $('.page-title h1').textContent='운영 · 날씨';$('.page-title p').textContent='현재 날씨와 향후 5일 예보의 출처·날짜를 확인하세요.';
 if(state.weatherLoading){$('#dashboard').innerHTML='<p role="status">날씨 서버에 조회 중입니다.</p>';return;}
 if(!state.weather||refresh){
  state.weatherLoading=true;$('#dashboard').innerHTML='<p role="status">날씨 서버에 조회 중입니다. (요청 제한 5초)</p>';
  try {const response=await fetch('/api/weather',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('route');state.weather=await response.json();}
  catch {try {const response=await fetch('/data/weather-sample.json');if(!response.ok)throw new Error('sample');state.weather={...await response.json(),mode:'sample',reason:'server-unavailable',message:'앱 날씨 서버에 연결하지 못해 예제로 전환했습니다.',checkedAt:new Date().toISOString(),cached:false};}catch{state.weather=null;}}
  finally {state.weatherLoading=false;}
 }
 if(!isCurrent())return;
 const w=state.weather;
 if(!w){$('#dashboard').innerHTML='<section class="card panel">날씨 서버와 예제 자료를 모두 읽지 못했습니다. <button id="retryWeather">다시 조회</button></section>';$('#retryWeather').onclick=()=>renderWeather(isCurrent,true);return;}
 const sample=w.mode!=='live',c=w.current;
 $('#dashboard').innerHTML=`<section class="card panel weather-panel"><div class="panel-heading"><div><h2>${esc(w.location.name)}</h2><p>${esc(w.location.note)}</p></div><button class="quiet-btn" id="refreshWeather">다시 조회</button></div><div class="weather-mode ${sample?'sample':'live'}" role="status"><strong>${sample?'예제 데이터 · 실제 관측·예보 아님':'실제 연결 · OpenWeather 실시간 응답'}</strong><p>${esc(w.message)}</p>${sample?`<p>전환 이유: ${esc(w.reason)}</p>`:''}</div><div class="weather-main"><div><p>현재 날씨${sample?' (예제)':''}</p><div class="weather-temp">${esc(c.temp)}°C</div><p>${esc(c.description)} · 체감 ${esc(c.feelsLike)}°C · 습도 ${esc(c.humidity)}% · 바람 ${esc(c.wind)}m/s</p></div></div><h3>5일 날씨${sample?' (예제)':''}</h3><div class="forecast">${w.forecast.map(d=>`<article class="forecast-day"><div class="forecast-date">${esc(d.date)}</div><p>${esc(d.description)}</p><div>${esc(d.min)}° ~ ${esc(d.max)}°C</div><p>강수 ${Math.round(d.pop*100)}%</p><small>${d.slots}개 시간대</small></article>`).join('')}</div><p class="local-hint">${esc(w.forecastNote||'교육용 가상 자료입니다. 표시 날짜는 실제 관측·예보 날짜가 아닙니다.')}</p><dl class="weather-meta"><div><dt>출처</dt><dd>${w.source.url?`<a href="https://openweathermap.org/" target="_blank" rel="noreferrer">${esc(w.source.name)}</a>`:esc(w.source.name)}</dd></div><div><dt>앱 조회 시각 (한국)</dt><dd>${time(w.checkedAt||w.fetchedAt)}</dd></div><div><dt>${sample?'예제 자료 시각':'제공처 조회 시각'} (한국)</dt><dd>${time(w.fetchedAt)}</dd></div><div><dt>${sample?'예제 관측 시각':'관측 시각'} (한국)</dt><dd>${time(w.observedAt)}</dd></div><div><dt>캐시</dt><dd>${w.cached?'10분 서버 캐시 사용':'이번 요청 결과'} · 실패 시 예제 전환</dd></div></dl><p class="local-hint">모의 성공·오류·시간 제한·캐시 검사는 검사 보고서에 따로 기록하며 이 화면의 실제 연결 결과와 구분합니다.</p></section>`;
 $('#refreshWeather').onclick=()=>renderWeather(isCurrent,true);
}
