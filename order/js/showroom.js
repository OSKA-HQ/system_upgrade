// ═══════════════════════════════════════════════════════════════
// OSKA Works — 쇼룸예약 + CDM 패널 (Phase 3 분리)
// ═══════════════════════════════════════════════════════════════

// ===== CDM Panel (쇼룸예약 + 현장방문 통합) =====
// ═══════════════════════════════════════════════════════════════
// [CDM PANEL] 쇼룸 예약 + 현장방문 통합 패널
//   · renderCDMPanel — showroom_reservations + works_schedules(site_visit) 통합 뷰
//   · 현장방문 + 버튼, 상태 관리 (예약요청/확정/방문완료/취소)
// ═══════════════════════════════════════════════════════════════
function renderCDMPanel() {
  const statusColor = {
    '예약요청': 'bg-blue-100 text-blue-700 border-blue-300',
    '확정': 'bg-purple-100 text-purple-700 border-purple-300',
    '방문완료': 'bg-green-100 text-green-700 border-green-300',
    '취소': 'bg-gray-100 text-gray-700 border-gray-300'
  };
  // 쇼룸 예약
  const rooms = [...showroomReservations].map(r => ({ ...r, _type: 'showroom' }));
  // 현장방문 일정 (works_schedules에서 site_visit 타입)
  const visits = schedules.filter(s => s.type === 'site_visit').map(s => ({ ...s, _type: 'visit' }));
  // 날짜 기준 합쳐서 최신순 정렬
  const combined = [...rooms, ...visits].sort((a, b) => {
    const da = a.date || (a.createdAt?.seconds ? timestampToDateKST(a.createdAt.seconds) : '');
    const db2 = b.date || (b.createdAt?.seconds ? timestampToDateKST(b.createdAt.seconds) : '');
    return db2.localeCompare(da);
  });

  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-6xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tighter">쇼룸 · 현장방문</h1>
            <p class="text-sm text-neutral-400 mt-1">쇼룸 예약 + 현장방문 통합 관리</p>
          </div>
          <div class="flex items-center gap-3">
            <button onclick="openSiteVisitForm()" class="h-10 px-5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2">
              <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> + 현장방문
            </button>
            <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
              <i data-lucide="x" class="w-6 h-6"></i>
            </button>
          </div>
        </div>

        <!-- 통계 -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-white border border-neutral-200 rounded-xl p-4 text-center">
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">쇼룸 예약</p>
            <p class="text-2xl font-black">${rooms.length}</p>
            <p class="text-[9px] text-neutral-300">${rooms.filter(r=>r.status==='확정').length}건 확정</p>
          </div>
          <div class="bg-white border border-neutral-200 rounded-xl p-4 text-center">
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">현장방문</p>
            <p class="text-2xl font-black">${visits.length}</p>
            <p class="text-[9px] text-neutral-300">이번달 등록</p>
          </div>
          <div class="bg-white border border-neutral-200 rounded-xl p-4 text-center">
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">이번달 합계</p>
            <p class="text-2xl font-black">${combined.filter(c => {
              const d = c.date || '';
              const ym = new Date().toISOString().slice(0,7);
              return d.startsWith(ym);
            }).length}</p>
          </div>
        </div>

        <!-- 통합 목록 -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="px-4 py-3 text-left font-black">유형</th>
                <th class="px-4 py-3 text-left font-black">날짜/시간</th>
                <th class="px-4 py-3 text-left font-black">고객/내용</th>
                <th class="px-4 py-3 text-left font-black">연락처</th>
                <th class="px-4 py-3 text-left font-black">관심제품/내용</th>
                <th class="px-4 py-3 text-left font-black">상태</th>
                <th class="px-4 py-3 text-center font-black">관리</th>
              </tr>
            </thead>
            <tbody>
              ${combined.length > 0 ? combined.map(item => {
                if (item._type === 'showroom') {
                  return `<tr class="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td class="px-4 py-3"><span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">쇼룸</span><br><span class="text-[9px] text-neutral-400">${item.showroom||''}</span></td>
                    <td class="px-4 py-3">${formatDate(item.date)} ${item.time||''}</td>
                    <td class="px-4 py-3 font-black">${item.name||'-'}</td>
                    <td class="px-4 py-3">${item.phone||'-'}</td>
                    <td class="px-4 py-3 text-[10px]">${item.products||'-'}</td>
                    <td class="px-4 py-3">
                      <select class="text-[10px] px-2 py-1 rounded border ${statusColor[item.status]||statusColor['예약요청']}" onchange="updateReservationStatus('${item.id}',this.value)">
                        <option value="예약요청" ${item.status==='예약요청'?'selected':''}>예약요청</option>
                        <option value="확정" ${item.status==='확정'?'selected':''}>확정</option>
                        <option value="방문완료" ${item.status==='방문완료'?'selected':''}>방문완료</option>
                        <option value="취소" ${item.status==='취소'?'selected':''}>취소</option>
                      </select>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button onclick="deleteReservation('${item.id}')" class="text-neutral-300 hover:text-red-500">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </td>
                  </tr>`;
                } else {
                  return `<tr class="border-b border-neutral-100 hover:bg-blue-50/30 transition-colors">
                    <td class="px-4 py-3"><span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">현장방문</span></td>
                    <td class="px-4 py-3">${formatDate(item.startDate||item.date)} ${item.time||''}</td>
                    <td class="px-4 py-3 font-black">${item.customer||item.title||'-'}</td>
                    <td class="px-4 py-3">${item.phone||'-'}</td>
                    <td class="px-4 py-3 text-[10px]">${item.memo||item.product||'-'}</td>
                    <td class="px-4 py-3"><span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">방문예정</span></td>
                    <td class="px-4 py-3 text-center">
                      <button onclick="deleteSchedule('${item.id}')" class="text-neutral-300 hover:text-red-500">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </td>
                  </tr>`;
                }
              }).join('') : `
                <tr><td colspan="7" class="px-4 py-12 text-center text-neutral-300">
                  <i data-lucide="map-pin" class="w-8 h-8 mx-auto mb-2 text-neutral-200"></i>
                  <p>등록된 방문 일정이 없습니다</p>
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

// ===== Showroom Reservation (쇼룸예약 관리) =====
// ═══════════════════════════════════════════════════════════════
// [SHOWROOM] 쇼룸예약 관리 (CDM Panel에서 주로 사용)
//   · renderShowroomMgmt — 쇼룸 예약 전용 뷰
//   · updateReservationStatus, deleteReservation
//   · showroom_reservations 컬렉션
// ═══════════════════════════════════════════════════════════════
function renderShowroomMgmt() {
  const statusColor = {
    '예약요청': 'bg-blue-100 text-blue-700 border-blue-300',
    '확정': 'bg-purple-100 text-purple-700 border-purple-300',
    '방문완료': 'bg-green-100 text-green-700 border-green-300',
    '취소': 'bg-gray-100 text-gray-700 border-gray-300'
  };

  const filteredReservations = showroomFilter === '전체'
    ? showroomReservations
    : showroomReservations.filter(r => r.showroom === showroomFilter);

  const showrooms = [...new Set(showroomReservations.map(r => r.showroom || '기본'))];

  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-6xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-black tracking-tighter">쇼룸예약 관리</h1>
          <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>

        <!-- 필터 -->
        <div class="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex gap-2">
          <select id="showroomFilter" class="input-base" onchange="updateShowroomFilter(this.value)">
            <option value="전체">전체 쇼룸</option>
            ${showrooms.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>

        <!-- 예약 테이블 -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="px-4 py-3 text-left font-black">쇼룸</th>
                <th class="px-4 py-3 text-left font-black">예약일시</th>
                <th class="px-4 py-3 text-left font-black">고객명</th>
                <th class="px-4 py-3 text-left font-black">연락처</th>
                <th class="px-4 py-3 text-left font-black">관심제품</th>
                <th class="px-4 py-3 text-left font-black">상태</th>
                <th class="px-4 py-3 text-center font-black">액션</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReservations.length > 0 ? filteredReservations.map(res => `
                <tr class="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td class="px-4 py-3">${res.showroom || '기본'}</td>
                  <td class="px-4 py-3">${formatDate(res.date)} ${res.time || ''}</td>
                  <td class="px-4 py-3 font-black">${res.name}</td>
                  <td class="px-4 py-3">${res.phone}</td>
                  <td class="px-4 py-3 text-[10px]">${res.products || '-'}</td>
                  <td class="px-4 py-3">
                    <select class="text-[10px] px-2 py-1 rounded border ${statusColor[res.status] || statusColor['예약요청']}" onchange="updateReservationStatus('${res.id}', this.value)">
                      <option value="예약요청" ${res.status === '예약요청' ? 'selected' : ''}>예약요청</option>
                      <option value="확정" ${res.status === '확정' ? 'selected' : ''}>확정</option>
                      <option value="방문완료" ${res.status === '방문완료' ? 'selected' : ''}>방문완료</option>
                      <option value="취소" ${res.status === '취소' ? 'selected' : ''}>취소</option>
                    </select>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <button onclick="deleteReservation('${res.id}')" class="text-neutral-300 hover:text-red-500 transition-colors">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="7" class="px-4 py-8 text-center text-neutral-300 text-[10px]">예약이 없습니다.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- 메모 -->
        <div class="mt-6 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
          <p class="text-[10px] text-neutral-500">
            <i data-lucide="info" class="w-4 h-4 inline mr-2"></i>
            상태 변경: 예약요청 → 확정 → 방문완료 → 취소
          </p>
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

function updateShowroomFilter(value) {
  showroomFilter = value;
  render();
}

async function updateReservationStatus(id, status) {
  try {
    const { db, doc, updateDoc, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await updateDoc(doc(db, 'showroom_reservations', id), { status });
    // 확정 시 주요일정 다이어리에 자동 등록 + 본사 담당자 알림
    if (status === '확정') {
      const res = showroomReservations.find(r => r.id === id);
      if (res) {
        await addDoc(collection(db, 'works_schedules'), {
          type: 'showroom',
          title: `[쇼룸] ${res.name || '고객'} - ${res.showroom || ''}`,
          date: res.date || '',
          time: res.time || '',
          phone: res.phone || '',
          customer: res.name || '',
          memo: res.message || '',
          branch: '본사',
          createdAt: serverTimestamp()
        });
        // 알림 (CDM Panel #4) — 본사 담당자 전체 대상
        try {
          await pushWorkNotification(
            `[쇼룸 확정] ${res.name || '고객'} / ${res.date || ''} ${res.time || ''} / ${res.showroom || ''}`,
            'showroom_confirmed',
            'hq'
          );
        } catch(e) { console.warn('쇼룸 확정 알림 실패:', e); }
      }
    } else if (status === '취소') {
      const res = showroomReservations.find(r => r.id === id);
      if (res) {
        try {
          await pushWorkNotification(
            `[쇼룸 취소] ${res.name || '고객'} / ${res.date || ''} ${res.time || ''}`,
            'showroom_cancelled',
            'hq'
          );
        } catch(e) { console.warn('쇼룸 취소 알림 실패:', e); }
      }
    }
  } catch(e) { console.error('Status update error:', e); alert('상태 업데이트 실패'); }
}

async function deleteReservation(id) {
  if (!confirm('이 예약을 삭제하시겠습니까?')) return;
  try {
    const { db, doc, deleteDoc } = window.WORKS_DB;
    await deleteDoc(doc(db, 'showroom_reservations', id));
  } catch(e) { console.error('Delete error:', e); alert('삭제 실패'); }
}

