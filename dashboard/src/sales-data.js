import * as XLSX from 'xlsx';

export const canonical = ['record_id', '기준주', '점포', '브랜드', '장르', '채널', '매출_만원', '목표_만원', '비용_만원', '상태', '출처', '기준일'];
export const headerAliases = {
  record_id: ['record_id', '레코드ID', '기록번호'],
  기준주: ['기준주', '주차', '주간기준일'],
  점포: ['점포', '점포명', '영업점'],
  브랜드: ['브랜드', '브랜드명', '행사브랜드'],
  장르: ['장르', '카테고리', '상품군'],
  채널: ['채널', '유통채널', '판매채널'],
  매출_만원: ['매출_만원', '실적(만원)', '매출액_만원'],
  목표_만원: ['목표_만원', '목표매출(만원)', '목표액_만원'],
  비용_만원: ['비용_만원', '집행비용(만원)', '사용비용_만원'],
  상태: ['상태', '진행상태', '진행현황'],
  출처: ['출처', '근거자료', '자료출처'],
  기준일: ['기준일', '확인일', '기준일자'],
};
export const reportHeaders = ['record_id', '채널', '기준주', '점포', '브랜드', '장르', '매출_만원', '목표_만원', '목표차이_만원', '달성률', '비용_만원', '비용차감액_만원', '상태', '메모', '출처', '기준일'];
export const defaultSources = [
  { file: '01_영업실적.xlsx', url: '/data/sales-store.xlsx', channel: '영업' },
  { file: '02_온라인실적.xlsx', url: '/data/sales-online.xlsx', channel: '온라인' },
  { file: '03_팝업실적.xlsx', url: '/data/sales-popup.xlsx', channel: '팝업' },
];

function expectedFromFile(fileName) {
  const name = fileName.normalize('NFC');
  if (/온라인|sales-online/i.test(name)) return '온라인';
  if (/팝업|sales-popup/i.test(name)) return '팝업';
  if (/영업|sales-store/i.test(name)) return '영업';
  return '';
}

function dateText(value, date1904 = false) {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!date) throw new Error('유효하지 않은 Excel 날짜');
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const match = String(value ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
  if (!match) throw new Error('날짜는 YYYY-MM-DD 또는 Excel 날짜여야 합니다');
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() + 1 !== Number(m) || date.getUTCDate() !== Number(d)) throw new Error('유효하지 않은 날짜');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Validate the whole file before returning any rows, so a rejected import is atomic. */
export function normalizeWorkbook(fileName, bytes, expectedChannel = '') {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const sourceSheet = workbook.Sheets['원본'];
  // Inspect a single-sheet error sample for actionable missing-column feedback.
  const sheet = sourceSheet || (workbook.SheetNames.length === 1 ? workbook.Sheets[workbook.SheetNames[0]] : null);
  if (!sheet) throw new Error(`${fileName}: ‘원본’ 시트가 없습니다.`);
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  const headers = (matrix[0] || []).map(value => String(value).trim().normalize('NFC'));
  const indexes = {};
  for (const key of canonical) {
    const matches = headers.flatMap((header, index) => headerAliases[key].includes(header) ? [index] : []);
    if (matches.length > 1) throw new Error(`${fileName}: 같은 필드의 열이 중복되었습니다: ${key}`);
    if (matches.length) indexes[key] = matches[0];
  }
  const missing = canonical.filter(key => indexes[key] === undefined);
  if (missing.length) throw new Error(`${fileName}: 필수 열 누락: ${missing.join(', ')}`);
  if (!sourceSheet) throw new Error(`${fileName}: ‘원본’ 시트가 없습니다.`);
  const expected = expectedChannel || expectedFromFile(fileName);
  const rows = [];
  const issues = [];
  matrix.slice(1).forEach((cells, index) => {
    if (!cells.some(value => value !== '' && value !== null && value !== undefined)) return;
    const excelRow = index + 2;
    const row = { _file: fileName, _row: excelRow };
    for (const key of canonical) row[key] = cells[indexes[key]];
    const fail = message => issues.push({ file: fileName, row: excelRow, record_id: String(row.record_id ?? ''), message });
    for (const key of canonical.filter(key => !['매출_만원', '목표_만원', '비용_만원', '기준주', '기준일'].includes(key))) row[key] = String(row[key] ?? '').trim();
    if (!row.record_id) fail('record_id가 비어 있습니다.');
    for (const key of ['매출_만원', '목표_만원', '비용_만원']) {
      const value = row[key];
      const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
      if (value === '' || value === null || value === undefined || !Number.isFinite(numeric)) fail(`${key}: 유효한 금액이 아닙니다.`);
      row[key] = numeric;
    }
    for (const key of ['기준주', '기준일']) {
      try { row[key] = dateText(row[key], workbook.Workbook?.WBProps?.date1904); }
      catch (error) { fail(`${key}: ${error.message}`); }
    }
    if (!['영업', '온라인', '팝업'].includes(row.채널)) fail(`알 수 없는 채널 ‘${row.채널}’입니다.`);
    else if (expected && row.채널 !== expected) fail(`채널 불일치: 기대 ‘${expected}’, 실제 ‘${row.채널}’.`);
    rows.push(row);
  });
  if (issues.length) {
    const error = new Error(issues.map(issue => `${issue.file} · Excel ${issue.row}행 · ${issue.record_id || 'ID 없음'}: ${issue.message}`).join('\n'));
    error.issues = issues;
    throw error;
  }
  return { rows, issues };
}

export function mergeRecords(existing, incoming) {
  const rows = [];
  const seen = new Set();
  let duplicates = 0;
  let added = 0;
  for (const row of existing) {
    if (!seen.has(row.record_id)) { seen.add(row.record_id); rows.push(row); }
  }
  for (const row of incoming) {
    if (seen.has(row.record_id)) { duplicates++; continue; }
    seen.add(row.record_id); rows.push(row); added++;
  }
  return { rows, added, duplicates };
}

export function filterRecords(rows, filters = {}, search = '') {
  const query = String(search).trim().toLocaleLowerCase('ko');
  return rows.filter(row => Object.entries(filters).every(([key, value]) => !value || String(row[key]) === String(value)) &&
    (!query || canonical.map(key => String(row[key] ?? '')).join(' ').toLocaleLowerCase('ko').includes(query)));
}

export function summarize(rows) {
  const totals = rows.reduce((sum, row) => ({ sales: sum.sales + row.매출_만원, target: sum.target + row.목표_만원, cost: sum.cost + row.비용_만원 }), { sales: 0, target: 0, cost: 0 });
  return { ...totals, attain: totals.target === 0 ? null : totals.sales / totals.target * 100 };
}

export function groupStores(rows) {
  const stores = new Map();
  for (const row of rows) {
    const group = stores.get(row.점포) || { store: row.점포, sales: 0, target: 0 };
    group.sales += row.매출_만원; group.target += row.목표_만원; stores.set(row.점포, group);
  }
  return [...stores.values()].sort((a, b) => a.store.localeCompare(b.store, 'ko'));
}

/** Read a fresh copy of the template for each export; clear all old row cells. */
export function createReportWorkbook(templateBytes, rows, notes = {}) {
  const workbook = templateBytes ? XLSX.read(templateBytes, { type: 'array', cellStyles: true }) : XLSX.utils.book_new();
  let sheet = workbook.Sheets['보고'];
  if (!sheet) { sheet = {}; XLSX.utils.book_append_sheet(workbook, sheet, '보고'); }
  const numberFormats = {};
  for (let column = 0; column < reportHeaders.length; column++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 1, c: column })];
    if (cell?.z) numberFormats[column] = cell.z;
  }
  for (const address of Object.keys(sheet)) if (!address.startsWith('!') && XLSX.utils.decode_cell(address).r > 0) delete sheet[address];
  delete sheet['!merges'];
  delete sheet['!rows'];
  XLSX.utils.sheet_add_aoa(sheet, [reportHeaders], { origin: 'A1' });
  const output = rows.map(row => [row.record_id, row.채널, row.기준주, row.점포, row.브랜드, row.장르, row.매출_만원, row.목표_만원,
    row.매출_만원 - row.목표_만원, row.목표_만원 === 0 ? null : row.매출_만원 / row.목표_만원, row.비용_만원,
    row.매출_만원 - row.비용_만원, row.상태, notes[row.record_id] || '', row.출처, row.기준일]);
  if (output.length) XLSX.utils.sheet_add_aoa(sheet, output, { origin: 'A2' });
  for (let row = 1; row <= output.length; row++) for (let column = 0; column < reportHeaders.length; column++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell) cell.z = column === 9 ? '0.0%' : numberFormats[column] || (cell.t === 'n' ? '#,##0.##' : 'General');
  }
  sheet['!ref'] = `A1:P${output.length + 1}`;
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  sheet['!cols'] = reportHeaders.map((header, column) => ({ wch: column === 13 || column === 14 ? 30 : header.length > 8 ? 20 : 16 }));
  return workbook;
}
