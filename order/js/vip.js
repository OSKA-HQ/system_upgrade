// ═══════════════════════════════════════════════════════════════
// OSKA Works — VIP 계약고객 관리 (Phase 3 분리)
// ═══════════════════════════════════════════════════════════════
// ===== VIP 계약고객 관리 (#4) =====
// ═══════════════════════════════════════════════════════════════
// [VIP] VIP 계약고객 관리 (CRM에서 분리)
//   · renderVIP, openContractModal, saveContract
//   · crm_contracts 컬렉션
//   · CRM "계약" 버튼으로 일반 고객 → VIP 이관
// ═══════════════════════════════════════════════════════════════
function renderVIP() {
  const isAdminAccount = (currentType === 'hq');
  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-5xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <i data-lucide="crown" class="w-6 h-6 text-amber-400"></i>
            <div>
              <h1 class="text-3xl font-black tracking-tighter">VIP 계약고객</h1>
              <p class="text-[11px] text-neutral-400 mt-0.5">계약 완료 고객 전용 관리 패널</p>
            </div>
          </div>
          <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>

        <!-- 통계 -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p class="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">전체 계약</p>
            <p class="text-3xl font-black text-amber-600">${vipContracts.length}</p>
          </div>
          <div class="bg-white border border-neutral-200 rounded-2xl p-5 text-center">
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">이번달</p>
            <p class="text-3xl font-black">${vipContracts.filter(c => { const d = c.contractDate; return d && d.startsWith(new Date().toISOString().slice(0,7)); }).length}</p>
          </div>
          <div class="bg-white border border-neutral-200 rounded-2xl p-5 text-center">
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">총 계약금액</p>
            <p class="text-xl font-black">${formatCurrency(vipContracts.reduce((s,c) => s+(c.contractAmount||0), 0))}</p>
          </div>
        </div>

        <!-- 계약고객 목록 -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="px-4 py-3 text-left font-black">고객명</th>
                <th class="px-4 py-3 text-left font-black">연락처</th>
                <th class="px-4 py-3 text-left font-black">제품</th>
                <th class="px-4 py-3 text-left font-black">계약일</th>
                <th class="px-4 py-3 text-right font-black">계약금액</th>
                <th class="px-4 py-3 text-left font-black">지사</th>
                <th class="px-4 py-3 text-left font-black">메모</th>
              </tr>
            </thead>
            <tbody>
              ${vipContracts.length > 0 ? vipContracts.map(c => `
                <tr class="border-b border-neutral-100 hover:bg-amber-50/30 transition-colors">
                  <td class="px-4 py-3 font-black">${c.customerName || '-'}</td>
                  <td class="px-4 py-3">${c.phone || '-'}</td>
                  <td class="px-4 py-3 text-[10px]">${c.product || '-'}</td>
                  <td class="px-4 py-3">${c.contractDate || '-'}</td>
                  <td class="px-4 py-3 text-right font-black text-amber-600">${c.contractAmount ? formatCurrency(c.contractAmount) : '-'}</td>
                  <td class="px-4 py-3"><span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-green-50 text-green-600">${c.assignedBranch || '-'}</span></td>
                  <td class="px-4 py-3 text-neutral-400 max-w-[150px] truncate">${c.contractMemo || '-'}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="7" class="px-4 py-12 text-center text-neutral-300 text-sm font-bold">
                  <i data-lucide="crown" class="w-8 h-8 mx-auto mb-2 text-neutral-200"></i>
                  <p>계약완료 고객이 없습니다.</p>
                  <p class="text-[9px] mt-1">CRM에서 고객의 "계약" 버튼을 눌러 등록하세요.</p>
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

function openContractModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const today = getTodayKST();
  const modal = document.createElement('div');
  modal.id = 'contractModal';
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <i data-lucide="crown" class="w-5 h-5 text-amber-400"></i>
          <h3 class="text-base font-black">계약완료 처리</h3>
        </div>
        <button onclick="document.getElementById('contractModal').remove()" class="text-neutral-400 hover:text-black">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-[10px]">
        <p class="font-black text-amber-700">${c.phone || ''} · ${c.product || '제품 미지정'}</p>
        <p class="text-amber-500 mt-0.5">이 고객을 VIP 계약고객으로 등록합니다</p>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">고객명 *</label>
          <input type="text" id="contractName" class="input-base mt-1" placeholder="고객 이름" />
        </div>
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">계약일 *</label>
          <input type="date" id="contractDate" class="input-base mt-1" value="${today}" />
        </div>
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">계약금액 (원)</label>
          <input type="number" id="contractAmount" class="input-base mt-1" placeholder="예: 8500000" min="0" />
        </div>
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">계약 내용 / 메모</label>
          <textarea id="contractMemo" class="input-base mt-1" rows="2" placeholder="계약 내용, 특이사항 등"></textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="document.getElementById('contractModal').remove()" class="flex-1 h-11 border border-neutral-200 rounded-xl text-sm font-black text-neutral-400 hover:border-black hover:text-black transition-all">취소</button>
        <button onclick="saveContract('${customerId}')" class="flex-1 h-11 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600 transition-all">계약완료 등록</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

async function saveContract(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const name = document.getElementById('contractName')?.value.trim();
  const date = document.getElementById('contractDate')?.value;
  const amount = +(document.getElementById('contractAmount')?.value) || 0;
  const memo = document.getElementById('contractMemo')?.value.trim() || '';
  if (!name) { alert('고객명을 입력하세요.'); return; }
  if (!date) { alert('계약일을 입력하세요.'); return; }
  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'crm_contracts'), {
      customerId: customerId,
      customerName: name,
      phone: c.phone || '',
      product: c.product || '',
      assignedBranch: c.assignedBranch || '',
      contractDate: date,
      contractAmount: amount,
      contractMemo: memo,
      registeredBy: currentManager || currentBranch || '',
      createdAt: serverTimestamp()
    });
    document.getElementById('contractModal')?.remove();
    navigate('vip');
  } catch(e) { console.error(e); alert('저장 실패: ' + e.message); }
}
