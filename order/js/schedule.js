// ═══════════════════════════════════════════════════════════════
// OSKA Works — 주요일정 다이어리 (Phase 3 분리)
// ═══════════════════════════════════════════════════════════════
// ===== Schedule (주요일정 다이어리) =====
// ═══════════════════════════════════════════════════════════════
// [SCHEDULE] 주요일정 다이어리 (달력)
//   · renderSchedule — 월간 달력 + 이벤트(연차/쇼룸/현장방문)
// ═══════════════════════════════════════════════════════════════
function renderSchedule() {
  const year = scheduleMonth.getFullYear();
  const month = scheduleMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthSchedules = schedules.filter(s => {
    const start = new Date(s.startDate);
    return start.getFullYear() === year && start.getMonth() === month;
  });

  const dayArray = [];
  for (let i = 0; i < firstDay; i++) dayArray.push(null);
  for (let i = 1; i <= daysInMonth; i++) dayArray.push(i);

  const typeColors = {
    '박람회': 'bg-red-100 text-red-700 border-red-300',
    '연차': 'bg-blue-100 text-blue-700 border-blue-300',
    '쇼룸방문': 'bg-green-100 text-green-700 border-green-300',
    '기타': 'bg-gray-100 text-gray-700 border-gray-300'
  };

  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-4xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-black tracking-tighter">주요일정 다이어리</h1>
          <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>

        <!-- 월 네비게이션 -->
        <div class="flex items-center justify-between mb-6 bg-white border border-neutral-200 rounded-xl p-4">
          <button onclick="schedulePrevMonth()" class="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
          </button>
          <h2 class="text-lg font-black text-center flex-1">${year}년 ${month + 1}월</h2>
          <button onclick="scheduleNextMonth()" class="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <i data-lucide="chevron-right" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- 캘린더 그리드 -->
        <div class="bg-white border border-neutral-200 rounded-xl p-4 mb-6">
          <div class="grid grid-cols-7 gap-2">
            ${['일', '월', '화', '수', '목', '금', '토'].map(d => `
              <div class="text-center text-[10px] font-black text-neutral-400 py-2">${d}</div>
            `).join('')}
            ${dayArray.map((day, idx) => {
              if (!day) return '<div></div>';
              const daySchedules = monthSchedules.filter(s => {
                const start = new Date(s.startDate);
                return start.getDate() === day;
              });
              return `
                <div class="border border-neutral-100 rounded-lg p-2 min-h-20 bg-white hover:bg-neutral-50 transition-colors cursor-pointer" onclick="openScheduleDay(${day})">
                  <div class="text-sm font-black mb-1">${day}</div>
                  <div class="space-y-1">
                    ${daySchedules.slice(0, 2).map(s => `
                      <div class="text-[8px] px-1 py-0.5 rounded border ${typeColors[s.type] || typeColors['기타']}">${s.type}</div>
                    `).join('')}
                    ${daySchedules.length > 2 ? `<div class="text-[8px] text-neutral-400">+${daySchedules.length - 2}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 일정 목록 -->
        <div class="space-y-3 mb-6">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black">${year}년 ${month + 1}월 일정</h3>
            <button onclick="openAddSchedule()" class="bg-black text-white rounded-lg px-4 py-2 text-[10px] font-black hover:bg-neutral-800 transition-colors">+ 일정 추가</button>
          </div>
          ${monthSchedules.length > 0 ? monthSchedules.map(s => `
            <div class="bg-white border border-neutral-200 rounded-xl p-4">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <h4 class="font-black text-sm mb-1">${s.title}</h4>
                  <span class="text-[9px] px-2 py-1 rounded border ${typeColors[s.type] || typeColors['기타']}">${s.type}</span>
                </div>
                <button onclick="deleteSchedule('${s.id}')" class="text-neutral-300 hover:text-red-500 transition-colors">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
              <p class="text-[10px] text-neutral-500 mt-2">${formatDate(s.startDate)} ~ ${formatDate(s.endDate)}</p>
              ${s.description ? `<p class="text-[10px] text-neutral-600 mt-2">${s.description}</p>` : ''}
            </div>
          `).join('') : '<p class="text-[10px] text-neutral-300 py-4">이번 달 일정이 없습니다.</p>'}
        </div>

        <!-- Google Calendar 연동 -->
        <div class="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
          <button onclick="googleCalendarSync()" class="w-full bg-white border border-neutral-200 rounded-lg py-3 text-[11px] font-black hover:bg-neutral-50 transition-colors">
            <i data-lucide="calendar-plus" class="w-4 h-4 inline mr-2"></i>Google Calendar 연동
          </button>
        </div>
      </main>
      ${renderFooter()}

      <!-- 일정 추가 모달 -->
      <div id="scheduleModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-black">일정 추가</h3>
            <button onclick="closeAddSchedule()" class="text-neutral-400 hover:text-black">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">제목</label>
              <input type="text" id="scheduleTitle" placeholder="제목을 입력하세요" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">일정 유형</label>
              <select id="scheduleType" class="input-base mt-1">
                <option value="박람회">박람회</option>
                <option value="연차">연차</option>
                <option value="쇼룸방문">쇼룸방문</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">시작일</label>
              <input type="date" id="scheduleStartDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">종료일</label>
              <input type="date" id="scheduleEndDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">설명</label>
              <textarea id="scheduleDescription" placeholder="설명을 입력하세요" class="input-base mt-1"></textarea>
            </div>
            <div class="flex gap-2">
              <button onclick="closeAddSchedule()" class="flex-1 bg-neutral-200 text-black rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-300 transition-colors text-[11px]">취소</button>
              <button onclick="saveSchedule()" class="flex-1 bg-black text-white rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors text-[11px]">저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function schedulePrevMonth() {
  scheduleMonth = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() - 1);
  render();
}

function scheduleNextMonth() {
  scheduleMonth = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1);
  render();
}

function openAddSchedule() {
  scheduleModalOpen = true;
  document.getElementById('scheduleModal').classList.remove('hidden');
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('scheduleStartDate').value = today;
  document.getElementById('scheduleEndDate').value = today;
}

function closeAddSchedule() {
  scheduleModalOpen = false;
  document.getElementById('scheduleModal').classList.add('hidden');
}

async function saveSchedule() {
  const title = document.getElementById('scheduleTitle').value;
  const type = document.getElementById('scheduleType').value;
  const startDate = document.getElementById('scheduleStartDate').value;
  const endDate = document.getElementById('scheduleEndDate').value;
  const description = document.getElementById('scheduleDescription').value;

  if (!title || !startDate || !endDate) { alert('필수 항목을 입력하세요.'); return; }

  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_schedules'), {
      title, type, startDate, endDate, description,
      createdBy: currentBranch || '본사',
      createdAt: serverTimestamp()
    });
    closeAddSchedule();
    alert('일정이 등록되었습니다.');
  } catch(e) { console.error('Schedule save error:', e); alert('일정 등록 실패'); }
}

async function deleteSchedule(id) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  try {
    const { db, doc, deleteDoc } = window.WORKS_DB;
    await deleteDoc(doc(db, 'works_schedules', id));
  } catch(e) { console.error('Schedule delete error:', e); alert('삭제 실패'); }
}

function openScheduleDay(day) {
  alert(`${scheduleMonth.getFullYear()}년 ${scheduleMonth.getMonth() + 1}월 ${day}일의 일정입니다.`);
}

function googleCalendarSync() {
  alert('Blaze 업그레이드 후 설정 가능합니다');
}

