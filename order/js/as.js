// ═══════════════════════════════════════════════════════════════
// OSKA Works — AS 접수현황 (Phase 3 분리 · #3 고도화)
// ═══════════════════════════════════════════════════════════════
// [AS REQUESTS] AS 접수현황 (as/ 사이트에서 유입)
//   · renderASRequests — 접수/처리중/완료/보류 상태 관리 + 담당자 배정 + 이력
//   · works_as_requests 컬렉션 (AS 사이트 Firebase 연동)
//   · updateASStatus, openASDetailModal, saveASAssignee, appendASHistory
// ═══════════════════════════════════════════════════════════════
function renderASRequests() {
  const statusColor = {
    '접수': 'bg-red-50 text-red-500 border-red-200',
    '처리중': 'bg-orange-50 text-orange-500 border-orange-200',
    '완료': 'bg-green-50 text-green-600 border-green-200',
    '보류': 'bg-neutral-100 text-neutral-500 border-neutral-200'
  };
  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-6xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tighter">AS 접수현황</h1>
            <p class="text-sm text-neutral-400 mt-1">AS 접수 관리 패널</p>
          </div>
          <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>

        <!-- 통계 -->
        <div class="grid grid-cols-4 gap-4 mb-6">
          ${['접수','처리중','완료','보류'].map(s => `
            <div class="bg-white border border-neutral-200 rounded-xl p-4 text-center">
              <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">${s}</p>
              <p class="text-2xl font-black">${asRequests.filter(r=>(r.status||'접수')===s).length}</p>
            </div>
          `).join('')}
        </div>

        <!-- AS 접수 목록 -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="px-3 py-3 text-left font-black">접수일</th>
                <th class="px-3 py-3 text-left font-black">고객명</th>
                <th class="px-3 py-3 text-left font-black">연락처</th>
                <th class="px-3 py-3 text-left font-black">위치</th>
                <th class="px-3 py-3 text-right font-black">금액(VAT)</th>
                <th class="px-3 py-3 text-left font-black">담당자</th>
                <th class="px-3 py-3 text-left font-black">상태</th>
                <th class="px-3 py-3 text-center font-black">상세</th>
              </tr>
            </thead>
            <tbody>
              ${asRequests.length > 0 ? asRequests.map(r => `
                <tr class="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td class="px-3 py-3 text-[10px]">${r.createdAt ? formatDateTime(r.createdAt) : (r.submitTime || '-')}</td>
                  <td class="px-3 py-3 font-black">${r.customerName||'-'}</td>
                  <td class="px-3 py-3">${r.customerPhone||'-'}</td>
                  <td class="px-3 py-3 text-[10px]">${[r.sido, r.sigungu].filter(Boolean).join(' ')||'-'}</td>
                  <td class="px-3 py-3 text-right font-black">${r.totalAmount ? '₩'+Number(r.totalAmount).toLocaleString('ko-KR') : '-'}</td>
                  <td class="px-3 py-3">${r.assignee ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">${r.assignee}</span>` : '<span class="text-neutral-300 text-[10px]">미배정</span>'}</td>
                  <td class="px-3 py-3">
                    <select class="text-[10px] px-2 py-1 rounded border ${statusColor[r.status||'접수']}" onchange="updateASStatus('${r.id}',this.value)">
                      ${['접수','처리중','완료','보류'].map(s=>`<option value="${s}" ${(r.status||'접수')===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td class="px-3 py-3 text-center">
                    <button onclick="openASDetailModal('${r.id}')" class="text-neutral-400 hover:text-black transition-colors">
                      <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" class="px-4 py-12 text-center text-neutral-300">
                  <i data-lucide="tool" class="w-8 h-8 mx-auto mb-2 text-neutral-200"></i>
                  <p>AS 접수 내역이 없습니다</p>
                  <p class="text-[9px] mt-1">AS 견적 사이트에서 접수하면 여기에 표시됩니다</p>
                </td></tr>
              `}
            </tbody>
          </table>
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

async function updateASStatus(id, status) {
  try {
    const { db, doc, updateDoc, serverTimestamp } = window.WORKS_DB;
    await updateDoc(doc(db, 'works_as_requests', id), { status, updatedAt: serverTimestamp() });
    await appendASHistory(id, '상태변경 → ' + status);
  } catch(e) { console.error(e); alert('상태 변경 실패'); }
}

function openASDetailModal(id) {
  const r = asRequests.find(x => x.id === id);
  if (!r) return;
  const existing = document.getElementById('asDetailModal');
  if (existing) existing.remove();
  const hist = Array.isArray(r.history) ? r.history : [];
  const fmtHistTs = ts => {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  };
  // 담당자 후보 = 본사 직원 목록 (ACCOUNT_MANAGERS 우선, 없으면 빈 배열)
  const candidates = (typeof ACCOUNT_MANAGERS !== 'undefined') ? Object.entries(ACCOUNT_MANAGERS)
    .filter(([id, mgr]) => (typeof ACCOUNT_TYPES !== 'undefined' && ACCOUNT_TYPES[id] === 'hq'))
    .map(([id, mgr]) => mgr) : [];
  const modal = document.createElement('div');
  modal.id = 'asDetailModal';
  modal.className = 'fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <i data-lucide="tool" class="w-5 h-5 text-orange-500"></i>
          <h3 class="text-base font-black">AS 접수 상세</h3>
        </div>
        <button onclick="document.getElementById('asDetailModal').remove()" class="text-neutral-400 hover:text-black">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- 고객/위치 정보 -->
      <div class="grid grid-cols-2 gap-3 mb-5 text-[11px]">
        <div class="bg-neutral-50 rounded-xl p-3">
          <p class="text-[9px] font-black text-neutral-400 uppercase">고객명</p>
          <p class="font-black mt-1">${r.customerName || '-'}</p>
        </div>
        <div class="bg-neutral-50 rounded-xl p-3">
          <p class="text-[9px] font-black text-neutral-400 uppercase">연락처</p>
          <p class="font-black mt-1">${r.customerPhone || '-'}</p>
        </div>
        <div class="bg-neutral-50 rounded-xl p-3">
          <p class="text-[9px] font-black text-neutral-400 uppercase">위치</p>
          <p class="font-black mt-1">${[r.sido, r.sigungu].filter(Boolean).join(' ') || '-'}</p>
        </div>
        <div class="bg-neutral-50 rounded-xl p-3">
          <p class="text-[9px] font-black text-neutral-400 uppercase">접수일</p>
          <p class="font-black mt-1">${r.createdAt ? formatDateTime(r.createdAt) : (r.submitTime || '-')}</p>
        </div>
        <div class="bg-amber-50 rounded-xl p-3 col-span-2">
          <p class="text-[9px] font-black text-amber-500 uppercase">금액 (VAT 포함)</p>
          <p class="text-xl font-black text-amber-700 mt-1">${r.totalAmount ? '₩'+Number(r.totalAmount).toLocaleString('ko-KR') : '-'}</p>
        </div>
        ${r.memo ? `<div class="bg-neutral-50 rounded-xl p-3 col-span-2">
          <p class="text-[9px] font-black text-neutral-400 uppercase">고객 메모</p>
          <p class="mt-1">${r.memo}</p>
        </div>` : ''}
        ${r.authorName ? `<div class="bg-neutral-50 rounded-xl p-3 col-span-2">
          <p class="text-[9px] font-black text-neutral-400 uppercase">외부 접수자</p>
          <p class="mt-1">${r.authorName}</p>
        </div>` : ''}
      </div>

      <!-- 담당자 배정 -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
        <p class="text-[9px] font-black text-blue-600 uppercase mb-2">담당자 배정</p>
        <div class="flex gap-2">
          <select id="asAssigneeSelect" class="flex-1 h-9 px-2 text-[11px] bg-white border border-blue-200 rounded-lg font-bold">
            <option value="">미배정</option>
            ${candidates.map(m => `<option value="${m}" ${r.assignee === m ? 'selected' : ''}>${m}</option>`).join('')}
            ${r.assignee && !candidates.includes(r.assignee) ? `<option value="${r.assignee}" selected>${r.assignee}</option>` : ''}
          </select>
          <button onclick="saveASAssignee('${id}')" class="h-9 px-4 bg-blue-500 text-white rounded-lg text-[11px] font-black hover:bg-blue-600">배정</button>
        </div>
      </div>

      <!-- 처리 이력 -->
      <div class="bg-white border border-neutral-200 rounded-xl p-3 mb-5">
        <p class="text-[9px] font-black text-neutral-400 uppercase mb-3">처리 이력 (${hist.length}건)</p>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          ${hist.length > 0 ? hist.slice().reverse().map(h => `
            <div class="flex items-start gap-2 text-[10px] border-l-2 border-orange-300 pl-2 py-1">
              <div class="flex-1">
                <p class="font-bold">${h.action || h.note || '-'}</p>
                <p class="text-neutral-400 mt-0.5">${fmtHistTs(h.ts)} · ${h.by || '-'}</p>
              </div>
            </div>
          `).join('') : '<p class="text-[10px] text-neutral-300 text-center py-2">아직 이력이 없습니다</p>'}
        </div>
        <div class="flex gap-2 mt-3">
          <input type="text" id="asHistoryNote" placeholder="처리 내용 기록" class="flex-1 h-8 px-2 text-[11px] bg-white border border-neutral-200 rounded-lg" />
          <button onclick="appendASHistoryFromInput('${id}')" class="h-8 px-3 bg-orange-500 text-white rounded-lg text-[10px] font-black hover:bg-orange-600">이력 추가</button>
        </div>
      </div>

      <div class="flex gap-2">
        <button onclick="document.getElementById('asDetailModal').remove()" class="flex-1 h-10 border border-neutral-200 rounded-lg text-[11px] font-black text-neutral-400 hover:border-black hover:text-black">닫기</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (window.lucide) lucide.createIcons();
}

async function saveASAssignee(id) {
  const select = document.getElementById('asAssigneeSelect');
  if (!select) return;
  const assignee = select.value;
  try {
    const { db, doc, updateDoc, serverTimestamp } = window.WORKS_DB;
    await updateDoc(doc(db, 'works_as_requests', id), { assignee, updatedAt: serverTimestamp() });
    await appendASHistory(id, assignee ? ('담당자 배정 → ' + assignee) : '담당자 해제');
    // 담당자에게 알림
    if (assignee) {
      try { await pushWorkNotification('[AS 배정] ' + assignee + ' 담당 배정됨', 'as_assigned', assignee); } catch(e) {}
    }
    document.getElementById('asDetailModal')?.remove();
  } catch(e) { alert('배정 실패: ' + e.message); }
}

async function appendASHistoryFromInput(id) {
  const input = document.getElementById('asHistoryNote');
  if (!input) return;
  const note = input.value.trim();
  if (!note) { alert('처리 내용을 입력하세요.'); return; }
  await appendASHistory(id, note);
  document.getElementById('asDetailModal')?.remove();
  openASDetailModal(id);
}

async function appendASHistory(id, action) {
  try {
    const r = asRequests.find(x => x.id === id);
    if (!r) return;
    const hist = Array.isArray(r.history) ? r.history.slice() : [];
    hist.push({
      ts: new Date().toISOString(),
      action,
      by: (typeof currentManager !== 'undefined' && currentManager) ? currentManager : (typeof currentBranch !== 'undefined' ? currentBranch : '시스템')
    });
    const { db, doc, updateDoc } = window.WORKS_DB;
    await updateDoc(doc(db, 'works_as_requests', id), { history: hist });
  } catch(e) { console.warn('appendASHistory error:', e); }
}
