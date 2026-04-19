// ═══════════════════════════════════════════════════════════════
// OSKA Works — 공지사항 (Phase 4 분리)
//   UI: renderNotice, shouldShowNotice, toggleNoticeDetail 등
//   DB: saveNotice, deleteNotice, approveNotice, rejectNotice
// ═══════════════════════════════════════════════════════════════

// ----- 공유 유틸 -----

// #28 공지 배포 범위(scope) → 알림 수신 타입 배열
// 누적형: hq < branch < dealer < construction < all
function scopeToRecipientTypes(scope) {
  switch (scope) {
    case 'hq':           return ['hq'];
    case 'branch':       return ['hq', 'branch'];
    case 'dealer':       return ['hq', 'branch', 'dealer'];
    case 'construction': return ['hq', 'branch', 'dealer', 'construction'];
    case 'all':          return ['hq', 'branch', 'dealer', 'construction'];
    default:             return ['hq'];
  }
}

// ----- UI -----

// ===== 공지사항 =====
// ═══════════════════════════════════════════════════════════════
// [NOTICE] 공지사항 (공통)
//   · renderNotice, createNotice, approveNotice, rejectNotice
//   · 배포범위 필터: 본사만/지사포함/대리점포함/시공포함/전체공개
// ═══════════════════════════════════════════════════════════════
function renderNotice() {
  const isHQ = currentType === 'hq';

  // 현재 로그인 타입에 따라 표시할 공지 필터링
  function shouldShowNotice(notice) {
    if (!notice.scope) return true; // scope이 없으면 모두에게 표시
    switch (currentType) {
      case 'hq':
        // 본사: hq, branch, dealer, construction, all 모두 표시
        return ['hq', 'branch', 'dealer', 'construction', 'all'].includes(notice.scope);
      case 'branch':
        // 지사: branch, construction, all만 표시
        return ['branch', 'construction', 'all'].includes(notice.scope);
      case 'dealer':
        // 대리점: dealer, all만 표시
        return ['dealer', 'all'].includes(notice.scope);
      case 'construction':
        // 시공: construction, all만 표시
        return ['construction', 'all'].includes(notice.scope);
      default:
        // 기타: all만 표시
        return notice.scope === 'all';
    }
  }

  // scope 값을 레이블로 변환
  function getScopeLabel(scope) {
    const labels = {
      'hq': '본사만',
      'branch': '지사 포함',
      'dealer': '대리점 포함',
      'construction': '시공 포함',
      'all': '전체 공개'
    };
    return labels[scope] || '본사만';
  }

  // 예약 공지 필터 (#10): scheduledAt이 현재 시각 이후면 일반 사용자에게 숨김
  function isReadyByScheduled(n) {
    if (!n.scheduledAt) return true;
    return new Date(n.scheduledAt).getTime() <= Date.now();
  }
  // '예약' 상태 공지는 도달 전까지 어드민(이한울/Master)만 미리보기 가능
  const isSchedulerAdmin = currentManager === '이한울' || currentManager === 'Master';
  const filteredNotices = notices.filter(n => {
    if (n.status === '검토중') return isHQ; // 검토 대기는 본사만
    if (n.status === '예약') {
      if (isReadyByScheduled(n)) return shouldShowNotice(n); // 예약 시각 지나면 모두에게 공개
      return isSchedulerAdmin; // 아직이면 관리자만
    }
    if (n.status === '배포') {
      if (!isReadyByScheduled(n)) return isSchedulerAdmin; // scheduledAt이 있어도 안전장치
      return shouldShowNotice(n);
    }
    return isHQ;
  });

  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-4xl mx-auto px-6">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-xl font-black tracking-tight">공지사항</h1>
            <p class="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Company Notices</p>
          </div>
          ${isHQ ? `
          <button id="btnNewNotice" class="text-[10px] font-black bg-black text-white px-4 py-2 rounded-xl hover:bg-neutral-800 transition-all flex items-center gap-1.5">
            <i data-lucide="plus" class="w-3 h-3"></i> 새 공지
          </button>` : ''}
        </div>

        <div class="space-y-3">
          ${filteredNotices.length > 0
            ? filteredNotices.map(n => {
                const scopeLabel = getScopeLabel(n.scope);
                const isPending = n.status === '검토중';
                return `
              <div class="border ${isPending ? 'border-yellow-300 bg-yellow-50/30' : 'border-neutral-100'} rounded-xl p-5 hover:border-neutral-300 transition-all">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  ${n.important ? '<span class="text-[8px] font-black bg-red-50 text-red-500 px-1.5 py-0.5 rounded uppercase">중요</span>' : ''}
                  ${isPending ? '<span class="text-[8px] font-black bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded uppercase">검토 대기</span>' : ''}
                  <span class="text-[8px] font-black bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">${scopeLabel}</span>
                  <span class="text-[9px] text-neutral-300 font-bold">${formatDate(n.createdAt)}</span>
                  <span class="text-[9px] text-neutral-400 font-bold ml-auto">${n.author || ''}</span>
                </div>
                <h3 class="text-sm font-black mb-2">${n.title || ''}</h3>
                <p class="text-[12px] text-neutral-500 leading-relaxed whitespace-pre-wrap">${n.content || ''}</p>
                ${isHQ ? `
                <div class="mt-3 pt-3 border-t border-neutral-50 flex gap-2">
                  ${isPending && (currentManager === '이한울' || currentManager === 'Master') ? `
                    <button onclick="approveNotice('${n.id}')" class="text-[9px] font-bold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors">승인 배포</button>
                    <button onclick="rejectNotice('${n.id}')" class="text-[9px] font-bold text-red-400 hover:text-red-600 transition-colors">반려</button>
                  ` : ''}
                  <button onclick="deleteNotice('${n.id}')" class="text-[9px] font-bold text-neutral-300 hover:text-red-500 transition-colors ml-auto">삭제</button>
                </div>` : ''}
              </div>`;
              }).join('')
            : `<div class="text-center py-16">
                <i data-lucide="megaphone" class="w-10 h-10 text-neutral-200 mx-auto mb-4"></i>
                <p class="text-sm text-neutral-300 font-bold">공지사항이 없습니다</p>
              </div>`
          }
        </div>
      </main>
      ${renderFooter()}
    </div>

    <!-- 공지 작성 모달 -->
    ${isHQ ? `
    <div id="noticeModal" class="fixed inset-0 bg-black/60 z-[100] hidden flex items-center justify-center p-6">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <span class="text-[10px] font-black tracking-widest uppercase text-neutral-400">새 공지 작성</span>
          <button onclick="document.getElementById('noticeModal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-[9px] font-black text-neutral-300 mb-1.5 uppercase tracking-widest">제목</label>
            <input type="text" id="noticeTitle" class="input-base" placeholder="공지 제목" />
          </div>
          <div>
            <label class="block text-[9px] font-black text-neutral-300 mb-1.5 uppercase tracking-widest">내용</label>
            <textarea id="noticeContent" class="input-base" rows="6" placeholder="공지 내용을 입력하세요..."></textarea>
          </div>
          <!-- 배포 범위 -->
          <div>
            <label class="block text-[9px] font-black text-neutral-300 mb-2 uppercase tracking-widest">배포 범위</label>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 cursor-pointer hover:border-black transition-all">
                <input type="radio" name="noticeScope" value="hq" checked class="w-3 h-3" />
                <span class="text-[10px] font-bold">본사만</span>
              </label>
              <label class="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 cursor-pointer hover:border-black transition-all">
                <input type="radio" name="noticeScope" value="branch" class="w-3 h-3" />
                <span class="text-[10px] font-bold">지사 포함</span>
              </label>
              <label class="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 cursor-pointer hover:border-black transition-all">
                <input type="radio" name="noticeScope" value="dealer" class="w-3 h-3" />
                <span class="text-[10px] font-bold">대리점 포함</span>
              </label>
              <label class="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 cursor-pointer hover:border-black transition-all">
                <input type="radio" name="noticeScope" value="construction" class="w-3 h-3" />
                <span class="text-[10px] font-bold">시공 포함</span>
              </label>
              <label class="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 cursor-pointer hover:border-black transition-all col-span-2">
                <input type="radio" name="noticeScope" value="all" class="w-3 h-3" />
                <span class="text-[10px] font-bold">전체 공개</span>
              </label>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <input type="checkbox" id="noticeImportant" class="w-4 h-4" />
              <label for="noticeImportant" class="text-[10px] font-bold text-neutral-500">중요 공지</label>
            </div>
            <!-- 어드민 계정은 즉시 배포, 일반 hq는 검토 요청 -->
            <span class="text-[9px] text-neutral-400 font-bold">${currentManager === '이한울' || currentManager === 'Master' ? '즉시 배포됩니다' : '관리자 검토 후 배포됩니다'}</span>
          </div>
          <!-- 예약 발송 (#10) -->
          <div class="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <div class="flex items-center gap-2 mb-2">
              <input type="checkbox" id="noticeUseScheduled" class="w-4 h-4" onchange="document.getElementById('noticeScheduleBox').classList.toggle('hidden', !this.checked)" />
              <label for="noticeUseScheduled" class="text-[10px] font-black text-sky-600 cursor-pointer">
                <i data-lucide="clock" class="w-3 h-3 inline -mt-0.5"></i> 예약 발송
              </label>
            </div>
            <div id="noticeScheduleBox" class="hidden">
              <input type="datetime-local" id="noticeScheduledAt" class="input-base text-[11px]" />
              <p class="text-[9px] text-sky-500 mt-1">설정한 시각이 되어야 배포됩니다 (로그인한 사용자가 확인할 때 자동 공개)</p>
            </div>
          </div>
          <button id="btnSaveNotice" class="w-full h-11 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all">
            ${currentManager === '이한울' || currentManager === 'Master' ? '공지 등록' : '검토 요청'}
          </button>
        </div>
      </div>
    </div>` : ''}
  `;
}

// ----- DB 저장/삭제 -----

// ===== 공지사항 저장/삭제 =====
async function saveNotice() {
  const title = document.getElementById('noticeTitle')?.value.trim();
  const content = document.getElementById('noticeContent')?.value.trim();
  const important = document.getElementById('noticeImportant')?.checked || false;
  const scopeEl = document.querySelector('input[name="noticeScope"]:checked');
  const scope = scopeEl ? scopeEl.value : 'hq';
  if (!title || !content) { alert('제목과 내용을 입력하세요.'); return; }

  // 예약 발송 (#10)
  const useScheduled = document.getElementById('noticeUseScheduled')?.checked;
  const scheduledAtInput = document.getElementById('noticeScheduledAt')?.value;
  let scheduledAt = '';
  if (useScheduled && scheduledAtInput) {
    const sDate = new Date(scheduledAtInput);
    if (isNaN(sDate.getTime())) { alert('올바른 예약 일시를 입력하세요.'); return; }
    if (sDate.getTime() <= Date.now()) { alert('예약 일시는 현재 시각 이후로 설정하세요.'); return; }
    scheduledAt = sDate.toISOString();
  }

  // 어드민(이한울/Master)은 즉시 배포, 일반 본사 직원은 검토 요청
  const isAdminUser = currentManager === '이한울' || currentManager === 'Master';
  let status = isAdminUser ? '배포' : '검토중';
  if (isAdminUser && scheduledAt) status = '예약'; // 어드민이 예약한 공지

  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_notices'), {
      title, content, important, scope,
      author: currentManager || currentBranch || '본사',
      status: status,
      scheduledAt: scheduledAt || null,
      createdAt: serverTimestamp()
    });

    if (!isAdminUser) {
      // 관리자에게 검토 요청 알람
      await pushWorkNotification(
        currentManager + '님이 공지사항 검토를 요청했습니다: "' + title + '"',
        'notice_review', '이한울'
      );
      alert('검토 요청이 등록되었습니다. 관리자 승인 후 배포됩니다.');
    } else if (scheduledAt) {
      const kst = new Date(scheduledAt);
      alert('✅ 예약 공지 등록 완료\n' + kst.toLocaleString('ko-KR') + ' 이후 자동 배포됩니다.');
    } else {
      // #28 배포 범위(scope) → recipientTypes 배열 매핑
      // 누적형: hq ⊂ branch ⊂ dealer ⊂ construction ⊂ all
      const types = scopeToRecipientTypes(scope);
      await pushWorkNotification('[공지] ' + title, 'notice', '', types);
      alert('공지가 등록되었습니다.');
    }

    document.getElementById('noticeModal').classList.add('hidden');
  } catch(e) { console.error('Notice save error:', e); alert('공지 등록 실패'); }
}

async function approveNotice(id) {
  if (!confirm('이 공지를 승인하고 배포하시겠습니까?')) return;
  try {
    const { db, doc, updateDoc } = window.WORKS_DB;
    const notice = notices.find(function(n){ return n.id === id; });
    await updateDoc(doc(db, 'works_notices', id), {
      status: '배포',
      approvedBy: currentManager || 'Master',
      approvedAt: new Date().toISOString()
    });
    if (notice) {
      // #28 scope → recipientTypes 매핑
      const types = scopeToRecipientTypes(notice.scope || 'hq');
      await pushWorkNotification('[공지] ' + notice.title, 'notice', '', types);
      // 작성자에게도 승인 알람
      await pushWorkNotification('"' + notice.title + '" 공지가 승인되어 배포되었습니다.', 'notice_approved', notice.author);
    }
    alert('공지가 승인되어 배포되었습니다.');
  } catch(e) { alert('승인 실패: ' + e.message); }
}

async function rejectNotice(id) {
  const reason = prompt('반려 사유를 입력하세요:');
  if (reason === null) return;
  try {
    const { db, doc, updateDoc } = window.WORKS_DB;
    const notice = notices.find(function(n){ return n.id === id; });
    await updateDoc(doc(db, 'works_notices', id), {
      status: '반려',
      rejectedBy: currentManager || 'Master',
      rejectReason: reason || ''
    });
    if (notice) {
      await pushWorkNotification('"' + notice.title + '" 공지 등록이 반려되었습니다.' + (reason ? ' 사유: ' + reason : ''), 'notice_rejected', notice.author);
    }
    alert('공지가 반려되었습니다.');
  } catch(e) { alert('반려 실패: ' + e.message); }
}

async function deleteNotice(id) {
  if (!confirm('이 공지를 삭제하시겠습니까?')) return;
  try {
    const { db, doc, deleteDoc } = window.WORKS_DB;
    await deleteDoc(doc(db, 'works_notices', id));
  } catch(e) { console.error('Notice delete error:', e); alert('삭제 실패'); }
}

