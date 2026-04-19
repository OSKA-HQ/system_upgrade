// ═══════════════════════════════════════════════════════════════
// OSKA Works — 공통 유틸 함수 (Phase 2 분리)
//
// 순수 함수만 포함. 앱 상태 의존 없음 (constants.js의 상수만 참조).
// 날짜 포맷, 통화 포맷, 채널/브랜드 헬퍼 등.
// ═══════════════════════════════════════════════════════════════

// ─── 통화 포맷 ─────────────────────────────────────────────────
function formatCurrency(n) {
  return n ? '₩' + n.toLocaleString('ko-KR') : '₩0';
}

// ─── 날짜/시간 포맷 (KST 기준) ─────────────────────────────────
// 오늘 날짜 'YYYY-MM-DD' (KST 로컬 기준, toISOString() 타임존 버그 회피)
function getTodayKST() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Firestore timestamp.seconds → 'YYYY-MM-DD' (KST)
function timestampToDateKST(seconds) {
  if (!seconds) return '-';
  const d = new Date(seconds * 1000);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Firestore Timestamp 객체 또는 일반 Date → 'YYYY.MM.DD'
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// 날짜 + 시분초 (CRM 유입시간용)
function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  return `${date} / ${time}`;
}

// Date 객체 → 'YYYY.MM.DD' (대시보드 표시용)
function formatDateKR(d) {
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}

// ─── 채널 타입 판별 (유입 / 고도화 / A/S) ─────────────────────
// CHANNEL_TYPE 상수는 constants.js에서 정의
function getChannelType(channel) {
  if (!channel) return '유입';
  if (CHANNEL_TYPE['A/S'].includes(channel)) return 'A/S';
  if (CHANNEL_TYPE['고도화'].includes(channel)) return '고도화';
  return '유입';
}

// ─── 브랜드 UI 헬퍼 ────────────────────────────────────────────
// CRM_BRANDS, CRM_BRAND_COLORS 상수는 constants.js에서 정의
function getBrandColor(brand) {
  return CRM_BRAND_COLORS[brand] || 'bg-neutral-100 text-neutral-600';
}

// <select> 옵션 HTML 생성 (selected 자동 처리)
function renderBrandOptions(selected) {
  return CRM_BRANDS.map(b =>
    `<option value="${b}" ${selected === b ? 'selected' : ''}>${b}</option>`
  ).join('');
}

// 필터용 옵션 (전체 옵션 포함)
function renderBrandFilterOptions(selected, includeAll) {
  const allOpt = includeAll
    ? `<option value="전체" ${selected === '전체' ? 'selected' : ''}>전체 브랜드</option>`
    : '';
  return allOpt + CRM_BRANDS.map(b =>
    `<option value="${b}" ${selected === b ? 'selected' : ''}>${b}</option>`
  ).join('');
}
