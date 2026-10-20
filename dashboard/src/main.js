import * as XLSX from 'xlsx';
import { normalizeWorkbook, mergeRecords, filterRecords, summarize, groupStores, createReportWorkbook, defaultSources } from './sales-data.js';
import './style.css';
import { renderOperations, renderWeather } from './operations.js';

const $ = selector => document.querySelector(selector);
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => new Intl.NumberFormat('ko-KR', {maximumFractionDigits:2}).format(v);
const noteKey = 'momentroom-record-notes';
function readNotes() { try { const notes = JSON.parse(localStorage.getItem(noteKey) || '{}'); return notes && typeof notes === 'object' ? notes : {}; } catch { return {}; } }
const state = {rows:[], filters:{}, search:'', page:1, pageSize:50, notes:readNotes(), tab:'sales', imports:[], template:null, ready:false};
const filterFields = ['점포','채널','기준주','브랜드','장르','상태'];
const visibleRows = () => filterRecords(state.rows, state.filters, state.search);
function notify(message, error=false) { const el=document.createElement('div'); el.className=`toast${error?' error':''}`; el.setAttribute('role','status'); el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),4000); }
function reportIssue(error) { return error.message || String(error); }
function sourceText(row) { const file=row._file||row.source_file||row._sourceFile||row.sourceFile||''; const line=row._row||row.source_row||row._sourceRow||row.sourceRow||''; return file ? `${file}${line?` · ${line}행`:''}` : row.출처; }

function boot() {
 $('#app').innerHTML=`<main class="shell"><header class="topbar"><a class="brand" href="/" aria-label="매출 비교 홈"><span class="brandmark">↗</span><span class="brandname">momentroom<small>STORE OPERATIONS</small></span></a><div class="top-actions"><button class="quiet-btn" id="importBtn" disabled>＋ 데이터 추가</button><input type="file" class="sr-only" id="fileInput" accept=".xlsx,.xls" multiple aria-label="매출 엑셀 파일 추가"><button class="primary-btn" id="exportBtn" disabled>보고양식으로 저장 ↓</button></div></header><nav class="main-tabs" aria-label="운영 메뉴"><button data-tab="sales" class="active">1단계 · 매출 비교</button><button data-tab="events">운영 · 행사 준비</button><button data-tab="weather">운영 · 날씨</button></nav><section class="page-title"><div><div class="eyebrow">SALES OVERVIEW</div><h1>매출 비교</h1><p>세 채널의 실적을 같은 기준으로 비교하고, 회의용 보고서를 저장하세요.</p></div><div class="update-chip" id="dataStatus" role="status">데이터 불러오는 중</div></section><div id="dashboard"><div class="loading"><div class="spinner"></div>원본 3개의 매출 자료를 읽고 있습니다.</div></div><footer class="footer-note">교육용 가상 데이터 · 금액 단위: 만원 · 메모는 현재 브라우저에만 저장되며 팀 공유·서버 백업이 되지 않습니다.</footer></main>`;
 $('#importBtn').onclick=()=>$('#fileInput').click(); $('#fileInput').onchange=handleFiles; $('#exportBtn').onclick=exportReport;
 document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{state.tab=el.dataset.tab;render();});
 loadDefaults().then(()=>{state.ready=true;$('#exportBtn').disabled=false;$('#importBtn').disabled=false;render();}).catch(error=>{ $('#dashboard').innerHTML=`<section class="card panel"><h2>자료를 불러오지 못했습니다</h2><p>${esc(reportIssue(error))}</p><p>로컬 실행 서버와 public/data 경로를 확인해주세요.</p></section>`;$('#dataStatus').textContent='불러오기 실패'; });
}
async function loadDefaults() {
 const loaded=[];
 for (const source of defaultSources) {
  const response=await fetch(source.url); if(!response.ok)throw new Error(`${source.file}: 파일을 읽을 수 없습니다.`);
  const result=normalizeWorkbook(source.file,await response.arrayBuffer(),source.channel);
  loaded.push(...result.rows); state.imports.push({file:source.file,added:result.rows.length,duplicates:0,error:''});
 }
 const merged=mergeRecords([],loaded);state.rows=merged.rows;
 const response=await fetch('/data/report-template.xlsx');if(!response.ok)throw new Error('04 보고양식을 읽을 수 없습니다.'); state.template=await response.arrayBuffer();
}
function selectFilter(field) { const values=[...new Set(state.rows.map(row=>String(row[field])))].sort((a,b)=>a.localeCompare(b,'ko'));return `<label class="filter-control"><span>${field}</span><select data-filter="${field}" id="filter-${field}"><option value="">전체</option>${values.map(value=>`<option value="${esc(value)}" ${state.filters[field]===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label>`; }
function metric(label,value,unit,foot) { return `<article class="card metric"><div class="metric-label">${label}</div><div class="metric-value">${value}<span class="metric-unit">${unit}</span></div><div class="metric-foot">${foot}</div></article>`; }
function storeChart(rows) {
 const stores=groupStores(rows);if(!stores.length)return '<div class="table-empty">조건에 맞는 점포가 없습니다.</div>';
 const max=Math.max(...stores.flatMap(s=>[s.sales,s.target]),1);
 return `<div class="store-chart" role="img" aria-label="점포별 매출과 목표 비교, 단위 만원">${stores.map(store=>`<div class="store-row"><strong>${esc(store.store)}</strong><div class="store-bars"><div class="store-bar-line"><span class="bar-type">매출</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,store.sales/max*100)}%"></div></div><span class="bar-value">${fmt(store.sales)} 만원</span></div><div class="store-bar-line"><span class="bar-type">목표</span><div class="bar-track"><div class="bar-fill target" style="width:${Math.max(0,store.target/max*100)}%"></div></div><span class="bar-value">${fmt(store.target)} 만원</span></div></div></div>`).join('')}</div>`;
}
function tableRows(rows) { if(!rows.length)return '<tr><td colspan="12" class="table-empty">조건에 맞는 매출 기록이 없습니다. 필터를 초기화해보세요.</td></tr>';return rows.map(row=>`<tr><td><span class="record-id">${esc(row.record_id)}</span><br>${esc(row.기준주)}</td><td>${esc(row.점포)}</td><td>${esc(row.브랜드)}</td><td>${esc(row.장르)}</td><td>${esc(row.채널)}</td><td class="num">${fmt(row.매출_만원)}</td><td class="num">${fmt(row.목표_만원)}</td><td class="num">${row.목표_만원===0?'—':`${(row.매출_만원/row.목표_만원*100).toFixed(1)}%`}</td><td><span class="status-pill ${row.상태==='확정'?'done':''}">${esc(row.상태)}</span></td><td class="provenance" title="${esc(sourceText(row))}">${esc(row.출처)}<small>${esc(sourceText(row))}</small></td><td>${esc(row.기준일)}</td><td><input class="memo-input" data-record="${esc(row.record_id)}" aria-label="${esc(row.record_id)} 메모" placeholder="메모 입력" value="${esc(state.notes[row.record_id]||'')}"></td></tr>`).join(''); }
function importHistory() { return `<details class="import-history" ${state.imports.some(x=>x.error)?'open':''}><summary>불러오기 기록 · ${state.imports.length}개 파일</summary><ul>${state.imports.map(log=>`<li class="${log.error?'import-error':''}"><strong>${esc(log.file)}</strong> · ${log.error?`거부: ${esc(log.error)} · 기존 자료 보존`:`추가 ${log.added}건 · 중복 제외 ${log.duplicates}건`}</li>`).join('')}</ul></details>`; }
function render() {
 document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.tab===state.tab);el.setAttribute('aria-current',el.dataset.tab===state.tab?'page':'false');});
 $('#dataStatus').textContent=`● ${fmt(state.rows.length)}개 기록 적재`;
 $('#exportBtn').hidden=state.tab!=='sales';$('#importBtn').hidden=state.tab!=='sales';
 if(state.tab!=='sales') {
  const selected=state.tab;$('.eyebrow').textContent='OPERATIONS';$('#dataStatus').textContent=selected==='events'?'기준일 2026-10-20 · 개인 점검':'서버 날씨 · 예제 전환 지원';
  if(selected==='events')renderOperations(()=>state.tab===selected);else renderWeather(()=>state.tab===selected,true);return;
 }
 $('.eyebrow').textContent='SALES OVERVIEW';$('.page-title h1').textContent='매출 비교';$('.page-title p').textContent='세 채널의 실적을 같은 기준으로 비교하고, 회의용 보고서를 저장하세요.';
 const rows=visibleRows(), summary=summarize(rows);const pageCount=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.min(state.page,pageCount);const start=(state.page-1)*state.pageSize;const pageRows=rows.slice(start,start+state.pageSize);
 $('#dashboard').innerHTML=`<section class="filterbar" aria-label="공통 매출 조건">${filterFields.map(selectFilter).join('')}<label class="filter-control search-control"><span>기록 검색</span><input id="salesSearch" class="searchbox" type="search" placeholder="브랜드·점포·기록 검색" value="${esc(state.search)}"></label><button class="clear-btn" id="clearFilters">조건 초기화 ↺</button></section><div class="results-context" aria-live="polite"><strong>${fmt(rows.length)}건</strong>의 같은 조건을 요약·차트·표·보고 파일에 적용합니다.</div><section class="summary-grid">${metric('총 매출',fmt(summary.sales),'만원',`선택된 ${rows.length}개 기록의 합계`)}${metric('총 목표',fmt(summary.target),'만원',`목표 차이 ${fmt(summary.sales-summary.target)}만원`)}${metric('목표 달성률',summary.attain===null?'—':summary.attain.toFixed(1),summary.attain===null?'':'%',summary.attain===null?'목표 합계가 0입니다.':'총 매출 ÷ 총 목표 × 100')}</section><section class="card panel comparison-panel"><div class="panel-heading"><div><h2 class="panel-title">점포별 매출 비교</h2><p class="panel-subtitle">현재 조건의 매출과 목표 · 단위 만원</p></div><div class="chart-key"><span><i class="key-dot actual"></i>매출</span><span><i class="key-dot goal"></i>목표</span></div></div>${storeChart(rows)}</section><section class="card sales-panel"><div class="sales-head"><div><h2 class="panel-title">매출 기록</h2><p class="panel-subtitle">${rows.length?start+1:0}–${Math.min(start+state.pageSize,rows.length)} / ${rows.length}건 · 메모는 record_id별로 이 브라우저에 저장됩니다.</p></div><button class="quiet-btn" id="exportTable">조건 전체 ${rows.length}건 저장 ↓</button></div><div class="table-scroll"><table class="sales-table"><thead><tr><th>기록 / 기준주</th><th>점포</th><th>브랜드</th><th>장르</th><th>채널</th><th class="num">매출 (만원)</th><th class="num">목표 (만원)</th><th class="num">달성률</th><th>상태</th><th>출처 / 원본 행</th><th>기준일</th><th>메모</th></tr></thead><tbody>${tableRows(pageRows)}</tbody></table></div><div class="task-bottom"><span>페이지 ${state.page} / ${pageCount} · 페이지당 50건</span><div><button class="text-btn" id="prevPage" ${state.page<=1?'disabled':''}>← 이전</button><button class="text-btn" id="nextPage" ${state.page>=pageCount?'disabled':''}>다음 →</button></div></div></section>${importHistory()}`;
 bindSales();
}
function bindSales() {
 document.querySelectorAll('[data-filter]').forEach(el=>el.onchange=()=>{state.filters[el.dataset.filter]=el.value;state.page=1;render();});
 $('#clearFilters').onclick=()=>{state.filters={};state.search='';state.page=1;render();};
 $('#salesSearch').oninput=event=>{const pos=event.target.selectionStart;state.search=event.target.value;state.page=1;render();const input=$('#salesSearch');input.focus();if(pos!==null)try{input.setSelectionRange(pos,pos);}catch{}};
 document.querySelectorAll('[data-record]').forEach(el=>{
  let saveFailed=false;
  el.oninput=()=>{
   if(el.value)state.notes[el.dataset.record]=el.value;else delete state.notes[el.dataset.record];
   try{localStorage.setItem(noteKey,JSON.stringify(state.notes));saveFailed=false;}
   catch{if(!saveFailed)notify('브라우저 저장 공간에 메모를 저장할 수 없습니다.',true);saveFailed=true;}
  };
  el.onchange=()=>{if(!saveFailed)notify('메모를 이 브라우저에 저장했습니다.');};
 });
 $('#prevPage').onclick=()=>{state.page--;render();};$('#nextPage').onclick=()=>{state.page++;render();};$('#exportTable').onclick=exportReport;
}
async function handleFiles(event) {
 const files=[...event.target.files];if(!files.length)return;
 for(const file of files) { try {const parsed=normalizeWorkbook(file.name,await file.arrayBuffer()); const merged=mergeRecords(state.rows,parsed.rows);state.rows=merged.rows;state.imports.push({file:file.name,added:merged.added,duplicates:merged.duplicates,error:''});}catch(error){state.imports.push({file:file.name,error:reportIssue(error)});} }
 event.target.value='';state.page=1;render();notify(`불러오기 완료 · 현재 ${state.rows.length}개 기록. 상세 결과는 불러오기 기록에서 확인하세요.`);
}
function exportReport() {
 if(!state.ready)return;try {const rows=visibleRows();const workbook=createReportWorkbook(state.template,rows,state.notes);const stamp=new Date().toISOString().replace(/[:.]/g,'-');const filename=`매출비교_보고_${stamp}.xlsx`;XLSX.writeFile(workbook,filename);notify(`현재 조건 전체 ${rows.length}건을 새 보고 파일로 저장했습니다.`);}catch(error){notify(`파일 저장 실패: ${reportIssue(error)}`,true);}
}
boot();
