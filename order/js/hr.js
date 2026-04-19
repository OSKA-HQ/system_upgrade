// ═══════════════════════════════════════════════════════════════
// OSKA Works — HR Docs (Phase 4 분리)
//   · Leave Request (연차신청/결재/일괄연차)
//   · 조직도 (생산본부/사업본부/지사 네트워크)
//   · HR Docs 문서, 이슈현황, 외근 보고서
//   · pushWorkNotification (공통 알림 헬퍼 — 타 파일에서도 호출)
//   · getApprovalChain (결재선 헬퍼)
// ═══════════════════════════════════════════════════════════════

// ===== Leave Request (연차신청서) =====
// HR DOCS 탭 상태
let hrDocsTab = 'leave'; // 'leave' | 'issue' | 'report' | 'org'
let leaveCalMonth = new Date().getMonth();
let leaveCalYear = new Date().getFullYear();

// ═══════════════════════════════════════════════════════════════
// [HR] HR Docs — 인사/연차/조직도/이슈/외근·보고서
//   · renderLeave (연차신청/결재/달력/일괄연차)
//   · 조직도 (생산본부/사업본부/지사 네트워크)
//   · 연차 2단계 결재선 (부서이사 → 대표이사)
//   · 이슈/외근 보고서
// ═══════════════════════════════════════════════════════════════
function renderLeave() {
  // 본사 전용 체크
  if (currentType !== 'hq') {
    return `
      <div class="min-h-screen bg-white animate-fade-in">
        ${renderNav()}
        <main class="pt-20 pb-20 max-w-5xl mx-auto px-6 text-center">
          <i data-lucide="lock" class="w-16 h-16 text-neutral-200 mx-auto mb-4"></i>
          <h1 class="text-2xl font-black text-neutral-400 mb-2">접근 제한</h1>
          <p class="text-sm text-neutral-300">이 페이지는 본사 전용입니다.</p>
          <button onclick="navigate('home')" class="mt-6 bg-black text-white rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-neutral-800">홈으로</button>
        </main>
      </div>`;
  }

  const waitingCount = leaveRequests.filter(r => r.status === '대기').length;
  const approvedCount = leaveRequests.filter(r => r.status === '승인').length;
  const rejectedCount = leaveRequests.filter(r => r.status === '반려').length;

  const statusColor = {
    '대기': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    '1차승인': 'bg-blue-100 text-blue-700 border-blue-300',
    '최종승인': 'bg-green-100 text-green-700 border-green-300',
    '승인': 'bg-green-100 text-green-700 border-green-300',
    '반려': 'bg-red-100 text-red-700 border-red-300'
  };

  // 탭별 콘텐츠
  const tabActive = 'border-b-2 border-black text-black';
  const tabInactive = 'border-b-2 border-transparent text-neutral-400 hover:text-neutral-600';

  // leaveRequests 리스트 HTML을 미리 생성 (중첩 템플릿 리터럴 회피)
  const leaveListHTML = leaveRequests.length > 0 ? leaveRequests.map(function(req) {
    const sc = statusColor[req.status] || statusColor['대기'];
    const actions = getLeaveActions(req);

    // 결재 단계 표시
    const stageLabel = req.stages === 2
      ? (req.status === '대기' ? '1차 결재 대기 (' + (req.firstApprover||'?') + ')' :
         req.status === '1차승인' ? '최종 결재 대기 (이한울)' :
         req.status === '최종승인' ? '최종 승인 완료' : req.status)
      : (req.status === '최종승인' ? '최종 승인 완료' : req.status);

    const approveButtons = (actions.canFirst || actions.canFinal || actions.canReject) ?
      '<div class="flex gap-2">' +
      (actions.canFirst ? '<button onclick="approveLeave(\'' + req.id + '\',\'first\')" class="bg-blue-100 text-blue-700 rounded px-3 py-1 text-[9px] font-black hover:bg-blue-200 transition-colors">1차 승인</button>' : '') +
      (actions.canFinal ? '<button onclick="approveLeave(\'' + req.id + '\',\'final\')" class="bg-green-100 text-green-700 rounded px-3 py-1 text-[9px] font-black hover:bg-green-200 transition-colors">최종 승인</button>' : '') +
      (actions.canReject ? '<button onclick="rejectLeave(\'' + req.id + '\')" class="bg-red-100 text-red-700 rounded px-3 py-1 text-[9px] font-black hover:bg-red-200 transition-colors">반려</button>' : '') +
      '</div>' : '';

    const approvalInfo = req.firstApprovedBy
      ? '<div><span class="font-black">1차결재:</span> ' + req.firstApprovedBy + '</div>'
      : (req.rejectedBy ? '<div class="text-red-500"><span class="font-black">반려:</span> ' + req.rejectedBy + (req.rejectReason ? ' — ' + req.rejectReason : '') + '</div>' : '');
    const finalInfo = req.finalApprovedBy ? '<div><span class="font-black">최종결재:</span> ' + req.finalApprovedBy + '</div>' : '';

    return '<div class="bg-white border border-neutral-200 rounded-xl p-4">' +
      '<div class="flex items-start justify-between mb-3">' +
        '<div>' +
          '<h4 class="font-black text-sm mb-1">' + req.applicant + '</h4>' +
          '<span class="text-[9px] px-2 py-1 rounded border ' + sc + '">' + stageLabel + '</span>' +
        '</div>' +
        approveButtons +
      '</div>' +
      '<div class="grid grid-cols-2 gap-3 text-[10px] text-neutral-600">' +
        '<div><span class="font-black">유형:</span> ' + req.type + '</div>' +
        '<div><span class="font-black">기간:</span> ' + formatDate(req.startDate) + ' ~ ' + formatDate(req.endDate) + '</div>' +
        '<div><span class="font-black">사유:</span> ' + (req.reason||'-') + '</div>' +
        approvalInfo + finalInfo +
      '</div>' +
    '</div>';
  }).join('') : '<p class="text-[10px] text-neutral-300 py-4">신청 내역이 없습니다.</p>';

  // ── 달력 HTML 미리 계산 ──
  const calMonthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const calDayNames = ['일','월','화','수','목','금','토'];
  const calFirstDay = new Date(leaveCalYear, leaveCalMonth, 1).getDay();
  const calLastDate = new Date(leaveCalYear, leaveCalMonth + 1, 0).getDate();
  // 달력에 표시할 이벤트 맵: { 'YYYY-MM-DD': [{label, color}] }
  const calEvents = {};
  function addCalEvent(dateStr, label, color) {
    if (!dateStr) return;
    if (!calEvents[dateStr]) calEvents[dateStr] = [];
    calEvents[dateStr].push({ label, color });
  }
  // 연차 이벤트
  leaveRequests.forEach(function(r) {
    if (!r.startDate) return;
    var cur = new Date(r.startDate);
    var end = new Date(r.endDate || r.startDate);
    while (cur <= end) {
      var ds = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
      var color = r.status === '승인' ? 'bg-green-400' : r.status === '반려' ? 'bg-red-300' : 'bg-yellow-400';
      addCalEvent(ds, (r.applicant || '?') + ' ' + (r.type || '연차'), color);
      cur.setDate(cur.getDate() + 1);
    }
  });
  // 주요일정 이벤트 (schedules)
  schedules.forEach(function(s) {
    if (!s.date) return;
    var color = s.type === 'site_visit' ? 'bg-blue-400' : s.type === 'showroom' ? 'bg-purple-400' : 'bg-neutral-400';
    addCalEvent(s.date, s.title || s.type || '일정', color);
  });
  // 달력 셀 생성
  var calCells = '';
  var cellIdx = 0;
  // 빈 셀
  for (var ci = 0; ci < calFirstDay; ci++) {
    calCells += '<div class="min-h-[90px] bg-neutral-50/50"></div>';
    cellIdx++;
  }
  // 날짜 셀
  var todayStr = getTodayKST();
  for (var d = 1; d <= calLastDate; d++) {
    var ds2 = leaveCalYear + '-' + String(leaveCalMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var isToday = ds2 === todayStr;
    var dayEvents = calEvents[ds2] || [];
    var evHTML = dayEvents.slice(0,2).map(function(e) { return '<div class="text-[7px] font-bold px-1 py-0.5 rounded ' + e.color + ' text-white truncate">' + e.label + '</div>'; }).join('');
    if (dayEvents.length > 2) evHTML += '<div class="text-[7px] text-neutral-400">+' + (dayEvents.length-2) + '</div>';
    calCells += '<div class="min-h-[90px] border border-neutral-100 p-1 ' + (isToday ? 'bg-black/5 ring-1 ring-black ring-inset' : 'bg-white hover:bg-neutral-50') + '">' +
      '<div class="text-[10px] font-black mb-1 ' + (isToday ? 'text-black' : (cellIdx % 7 === 0 ? 'text-red-500' : cellIdx % 7 === 6 ? 'text-blue-500' : 'text-neutral-600')) + '">' + d + '</div>' +
      evHTML + '</div>';
    cellIdx++;
  }
  const calendarContent = '<div>' +
    // 헤더
    '<div class="flex items-center justify-between mb-4">' +
      '<button onclick="leaveCalMonth--;if(leaveCalMonth<0){leaveCalMonth=11;leaveCalYear--;}render();" class="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-all"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>' +
      '<span class="text-sm font-black">' + leaveCalYear + '년 ' + calMonthNames[leaveCalMonth] + '</span>' +
      '<button onclick="leaveCalMonth++;if(leaveCalMonth>11){leaveCalMonth=0;leaveCalYear++;}render();" class="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-all"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>' +
    '</div>' +
    // 요일 헤더
    '<div class="grid grid-cols-7 mb-1">' +
      calDayNames.map(function(d,i){ return '<div class="text-center text-[9px] font-black py-1 ' + (i===0?'text-red-400':i===6?'text-blue-400':'text-neutral-400') + '">' + d + '</div>'; }).join('') +
    '</div>' +
    // 날짜 그리드
    '<div class="grid grid-cols-7 gap-px bg-neutral-200 border border-neutral-200 rounded-xl overflow-hidden">' + calCells + '</div>' +
    // 범례
    '<div class="flex gap-4 mt-3 text-[9px] text-neutral-500">' +
      '<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>승인 연차</span>' +
      '<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>대기 연차</span>' +
      '<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>현장방문</span>' +
      '<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-neutral-400 inline-block"></span>기타일정</span>' +
    '</div>' +
  '</div>';

  // 전직원 일괄연차 버튼: ADMIN_ACCOUNTS(어드민 계정)에서만 표시
  const isAdminAccount = (currentType === 'hq'); // hq 계정 = 어드민 접근 가능 (isHQ는 다른 함수 스코프)
  const leaveContent = `
    <!-- 달력 (항상 상단 표시) -->
    <div class="mb-6">
      ${calendarContent}
    </div>

    <!-- 통계 + 버튼 -->
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p class="text-[10px] text-yellow-600 font-black uppercase tracking-widest mb-1">대기중</p>
        <p class="text-2xl font-black text-yellow-700">${waitingCount}</p>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-xl p-4">
        <p class="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">승인됨</p>
        <p class="text-2xl font-black text-green-700">${approvedCount}</p>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <p class="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">반려됨</p>
        <p class="text-2xl font-black text-red-700">${rejectedCount}</p>
      </div>
    </div>

    <div class="mb-6 flex gap-3">
      <button onclick="openLeaveRequest()" class="bg-black text-white rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors">+ 연차신청</button>
      ${isAdminAccount ? `
      <button onclick="openBulkLeaveForm()" class="bg-red-500 text-white rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors flex items-center gap-2">
        <i data-lucide="users" class="w-3.5 h-3.5"></i> 전직원 일괄 연차
      </button>` : ''}
    </div>

    <!-- 목록 (항상 하단 표시) -->
    <div class="space-y-3">
      ${leaveListHTML}
    </div>
  `;

  // 이슈 목록 테이블 HTML
  const issueTableHTML = hrIssues.length > 0 ? hrIssues.map(function(iss) {
    const statusCls = iss.status === '완료' ? 'bg-green-100 text-green-700 border-green-300' :
                      iss.status === '진행중' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      'bg-yellow-100 text-yellow-700 border-yellow-300';
    const hasSimalseo = iss.simalseo ? true : false;
    const hasSayuseo = iss.sayuseo ? true : false;
    return '<tr class="border-b border-neutral-100 hover:bg-neutral-50">' +
      '<td class="px-3 py-3 text-[10px] text-neutral-400">' + (iss.date || '-') + '</td>' +
      '<td class="px-3 py-3 text-[10px] font-bold">' + (iss.department || '-') + '</td>' +
      '<td class="px-3 py-3 text-[10px] font-bold">' + (iss.target || '-') + '</td>' +
      '<td class="px-3 py-3 text-[10px] font-black">' + (iss.title || '-') + '</td>' +
      '<td class="px-3 py-3 text-[10px] text-neutral-500 max-w-[200px]"><div class="truncate" title="' + (iss.content || '').replace(/"/g, '&quot;') + '">' + (iss.content || '-') + '</div></td>' +
      '<td class="px-3 py-3 text-[10px]">' + (iss.author || '-') + '</td>' +
      '<td class="px-3 py-3"><span class="text-[9px] px-2 py-0.5 rounded border ' + statusCls + '">' + (iss.status || '등록') + '</span></td>' +
      '<td class="px-3 py-3 text-center"><div class="flex items-center gap-1 justify-center">' +
        '<button onclick="openResponseDoc(\'' + iss.id + '\', \'시말서\')" class="px-2 py-1 rounded-lg text-[8px] font-black transition-all ' + (hasSimalseo ? 'bg-red-100 text-red-600 border border-red-200' : 'border border-neutral-200 text-neutral-400 hover:border-red-300 hover:text-red-500') + '">' + (hasSimalseo ? '시말서 확인' : '시말서 작성') + '</button>' +
        '<button onclick="openResponseDoc(\'' + iss.id + '\', \'사유서\')" class="px-2 py-1 rounded-lg text-[8px] font-black transition-all ' + (hasSayuseo ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'border border-neutral-200 text-neutral-400 hover:border-orange-300 hover:text-orange-500') + '">' + (hasSayuseo ? '사유서 확인' : '사유서 작성') + '</button>' +
      '</div></td></tr>';
  }).join('') : '<tr><td colspan="8" class="px-6 py-12 text-center text-neutral-300 text-[10px]">등록된 이슈가 없습니다.</td></tr>';

  const issueContent = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] text-neutral-400">총 <span class="font-black text-black">${hrIssues.length}</span>건</p>
      </div>
      <button onclick="openIssueForm()" class="bg-black text-white rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors">+ 새 이슈 작성</button>
    </div>

    <div class="border border-neutral-200 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] border-collapse">
          <thead>
            <tr class="bg-neutral-50 border-b border-neutral-200">
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">날짜</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">부서</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">대상자</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">제목</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">내용</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">작성자</th>
              <th class="px-3 py-3 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">상태</th>
              <th class="px-3 py-3 text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest">대응문서</th>
            </tr>
          </thead>
          <tbody>
            ${issueTableHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const reportContent = `
    <div class="mb-6">
      <button onclick="openHRDocForm('report')" class="bg-black text-white rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors">+ 보고서 작성</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
      <div onclick="openHRDocForm('외근보고서')" class="bg-white border border-neutral-200 rounded-xl p-4 hover:border-black transition-all cursor-pointer text-center">
        <i data-lucide="map-pin" class="w-6 h-6 text-blue-400 mx-auto mb-2"></i>
        <p class="text-[10px] font-black">외근 보고서</p>
      </div>
      <div onclick="openHRDocForm('외근계획서')" class="bg-white border border-neutral-200 rounded-xl p-4 hover:border-black transition-all cursor-pointer text-center">
        <i data-lucide="route" class="w-6 h-6 text-green-400 mx-auto mb-2"></i>
        <p class="text-[10px] font-black">외근 계획서</p>
      </div>
      <div onclick="openHRDocForm('업무보고')" class="bg-white border border-neutral-200 rounded-xl p-4 hover:border-black transition-all cursor-pointer text-center">
        <i data-lucide="clipboard-list" class="w-6 h-6 text-purple-400 mx-auto mb-2"></i>
        <p class="text-[10px] font-black">업무 보고</p>
      </div>
    </div>
    <div id="hrReportsList" class="space-y-3">
      <p class="text-[10px] text-neutral-300 py-4">등록된 보고서가 없습니다. (Firestore 연동 예정)</p>
    </div>
  `;

  // ===== 조직도 콘텐츠 =====
  // ===== 조직도 데이터 =====
  // 대표이사 직속 부서
  // #21 R&R 동적 로드: Firestore orgRNR 우선, 없으면 하드코딩 fallback
  function getTeamRNR(teamName, fallback) {
    const override = (typeof ORG_RNR_OVERRIDE !== 'undefined' && ORG_RNR_OVERRIDE) ? ORG_RNR_OVERRIDE[teamName] : null;
    if (Array.isArray(override) && override.length > 0) return override;
    return fallback || [];
  }
  // ── 직원 데이터 헬퍼 (allHQEmployees 우선, 없으면 fallback) ──
  function empsByDept(deptName) { return allHQEmployees.filter(function(e){ return e.dept === deptName; }); }
  function toOrgPerson(e) { return { name: e.name, title: e.position + (e.status && e.status !== '재직' ? ' (' + e.status + ')' : ''), phone: e.phone || '', note: e.status !== '재직' && e.status ? e.status : '' }; }
  function teamLeader(deptName) {
    var emps = empsByDept(deptName);
    var leader = emps.find(function(e){ return e.position==='팀장'||e.position==='실장'||e.position==='이사'||e.position==='대표이사'; }) || emps[0];
    return leader ? toOrgPerson(leader) : { name: '-', title: '-', phone: '' };
  }
  function teamMembers(deptName, leaderName) {
    return empsByDept(deptName).filter(function(e){ return e.name !== leaderName; }).map(toOrgPerson);
  }

  const ORG_DIRECT = [
    {
      name: 'R&D 기업부설연구소', sub: 'Corporate Research Institute',
      leader: (function(){ var e=allHQEmployees.find(function(x){return x.dept==='R&D'&&(x.position==='대표이사'||x.position==='이사');}); return e ? toOrgPerson(e) : {name:'이한울',title:'대표 (역임)',phone:''}; })(),
      members: [],
      rnr: getTeamRNR('R&D 기업부설연구소', ['신제품 기획 및 설계 (시스템 퍼글러, 글라스 시스템 등)', '건축 외장 솔루션 기술 개발 및 특허 관리', '스마트 견적 시스템(Smart Quotation) 고도화 및 IT 솔루션 관리'])
    },
    {
      name: 'Global Design Lab', sub: '글로벌 트렌드 분석',
      leader: { name: '실비아 (Silvia)', title: 'Lab Director', phone: '', note: '이탈리아 현지' },
      members: [],
      rnr: getTeamRNR('Global Design Lab', ['이탈리아 현지 시장조사 및 글로벌 트렌드 분석', '해외 디자인 레퍼런스 수집 및 제품 기획 지원'])
    }
  ];

  // 본부장 찾기
  var prodHead = (function(){ var e=empsByDept('생산본부').find(function(x){return x.position==='이사'||x.position==='팀장';}); return e ? {name:e.name,title:e.position+' · 생산본부장 / QC 총괄',phone:e.phone||''} : {name:'이우경',title:'이사 · 생산본부장 / QC 총괄',phone:''}; })();
  var bizHead = (function(){ var e=empsByDept('사업본부').find(function(x){return x.position==='이사';}); return e ? {name:e.name,title:e.position+' · 사업본부 총괄',phone:e.phone||''} : {name:'정진현',title:'이사 · 사업본부 총괄',phone:'010-2156-3259'}; })();

  // 팀별 리더/멤버 (allHQEmployees 있으면 동적, 없으면 fallback)
  var hasEmpData = allHQEmployees.length > 0;
  var imTeamLeader = hasEmpData ? teamLeader('임가공팀') : {name:'이남주',title:'팀장',phone:''};
  var imTeamMembers = hasEmpData ? teamMembers('임가공팀', imTeamLeader.name) : [{name:'도성진',title:'사원',phone:''},{name:'투진드라',title:'사원',phone:''}];
  var packLeader = hasEmpData ? teamLeader('포장출하팀') : {name:'김명석',title:'팀장',phone:'010-3339-0947'};
  var asLeader = hasEmpData ? teamLeader('기술지원팀') : {name:'김수묵',title:'팀장',phone:'010-2718-9005'};
  var brandLeader = hasEmpData ? teamLeader('브랜드전략팀') : {name:'김민정',title:'팀장',phone:'010-2656-1725'};
  var brandMembers = hasEmpData ? teamMembers('브랜드전략팀', brandLeader.name) : [{name:'김연아',title:'프로',phone:'010-9550-9375'},{name:'김도희',title:'프로',phone:'010-5560-2997'},{name:'김상이',title:'팀장',phone:'010-8874-6022',note:'육아휴직중'}];
  var salesLeader = hasEmpData ? teamLeader('기술영업팀') : {name:'김선준',title:'실장',phone:'010-5568-5902'};
  var salesMembers = hasEmpData ? teamMembers('기술영업팀', salesLeader.name) : [{name:'장윤서',title:'프로',phone:'010-6762-7391'}];
  var mgmtLeader = hasEmpData ? teamLeader('경영지원실') : {name:'정진현',title:'이사 (역임)',phone:'010-2156-3259'};

  const ORG_DIVISIONS = [
    {
      name: '생산본부', sub: 'Production Division',
      head: prodHead,
      teams: [
        { name: '임가공팀', leader: imTeamLeader, members: imTeamMembers, rnr: getTeamRNR('임가공팀', ['알루미늄 프로파일 가공 및 주요 부속 정밀 조립', '공정별 중간 품질 검사 수행']) },
        { name: '포장출하팀', leader: packLeader, members: [], rnr: getTeamRNR('포장출하팀', ['완제품 최종 검수 및 포장', '물류 배송 스케줄링 및 상차 관리']) },
        { name: '기술지원팀 (AS)', leader: asLeader, members: [], rnr: getTeamRNR('기술지원팀 (AS)', ['현장 실측 지원 및 시공 기술 자문', '제품 하자 보수(A/S) 및 고객 기술 대응']) }
      ]
    },
    {
      name: '사업본부', sub: 'Business Division',
      head: bizHead,
      teams: [
        { name: '경영지원실', leader: mgmtLeader, members: [], rnr: getTeamRNR('경영지원실', ['인사/노무, 재무/회계관리', '자재 수급 계획 및 구매 단가 관리']) },
        { name: '브랜드전략팀', leader: brandLeader, members: brandMembers, rnr: getTeamRNR('브랜드전략팀', ['OSKA, GLASST, THE DECK 브랜드 마케팅 및 디자인', '웹사이트 UI/UX 관리 및 카탈로그 제작']) },
        { name: '기술영업팀', leader: salesLeader, members: salesMembers, rnr: getTeamRNR('기술영업팀', ['B2B/B2C 기술 영업 및 총판 관리', '영업지원: 설계 검토 및 스마트 시스템 기반 견적 산출']) }
      ]
    }
  ];

  // ─── 빌더 함수 ───
  function orgPhone(phone) {
    if (!phone) return '';
    return '<a href="tel:' + phone + '" class="text-[9px] text-neutral-400 hover:text-neutral-700 mt-0.5 block">' + phone + '</a>';
  }
  // 팀장/리더 카드 (부각)
  function orgLeaderRow(p) {
    const note = p.note ? ' <span class="text-[7px] px-1 py-0.5 rounded bg-neutral-200 text-neutral-500 font-black">' + p.note + '</span>' : '';
    return '<div class="flex items-center justify-between py-2">' +
      '<div>' +
        '<span class="text-[11px] font-black text-black">' + p.name + note + '</span>' +
        '<span class="ml-1.5 text-[9px] font-bold text-neutral-500 border border-neutral-300 rounded px-1.5 py-0.5">' + p.title + '</span>' +
        orgPhone(p.phone) +
      '</div>' +
      (p.phone ? '<a href="tel:' + p.phone + '" class="w-6 h-6 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:border-black hover:text-black transition-all"><i data-lucide="phone" class="w-3 h-3"></i></a>' : '') +
    '</div>';
  }
  // 일반 멤버 행
  function orgMemberRow(p) {
    const note = p.note ? ' <span class="text-[7px] px-1 py-0.5 rounded bg-neutral-100 text-neutral-400 font-black">' + p.note + '</span>' : '';
    return '<div class="flex items-center justify-between py-1.5 pl-3 border-l-2 border-neutral-100">' +
      '<div>' +
        '<span class="text-[10px] font-bold text-neutral-600">' + p.name + note + '</span>' +
        '<span class="text-[9px] text-neutral-400 ml-1">' + p.title + '</span>' +
        orgPhone(p.phone) +
      '</div>' +
      (p.phone ? '<a href="tel:' + p.phone + '" class="text-neutral-300 hover:text-neutral-600 transition-colors"><i data-lucide="phone" class="w-3 h-3"></i></a>' : '') +
    '</div>';
  }
  // 팀 블록
  function orgTeamBlock(team) {
    const rnrId = 'rnr_' + team.name.replace(/[\s()&]/g,'_');
    const membersHTML = team.members.map(orgMemberRow).join('');
    const rnrHTML = team.rnr.map(function(r) { return '<li class="text-[9px] text-neutral-400 flex gap-1.5"><span class="text-neutral-300 shrink-0">—</span>' + r + '</li>'; }).join('');
    return '<div class="border border-neutral-200 rounded-xl overflow-hidden mb-2">' +
      '<div class="bg-neutral-50 border-b border-neutral-200 px-4 py-2 flex items-center justify-between">' +
        '<span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">' + team.name + '</span>' +
        '<button onclick="var el=document.getElementById(\'' + rnrId + '\');el.classList.toggle(\'hidden\');" class="text-[8px] text-neutral-400 hover:text-black font-black flex items-center gap-1 transition-colors"><i data-lucide="list" class="w-3 h-3"></i>R&R</button>' +
      '</div>' +
      '<div class="px-4">' +
        orgLeaderRow(team.leader) +
        (membersHTML ? '<div class="pb-2 space-y-0">' + membersHTML + '</div>' : '') +
      '</div>' +
      '<div id="' + rnrId + '" class="hidden px-4 pt-2 pb-3 border-t border-neutral-100 bg-neutral-50">' +
        '<ul class="space-y-1">' + rnrHTML + '</ul>' +
      '</div>' +
    '</div>';
  }
  // 직속 부서 블록 (컴팩트)
  function orgDirectBlock(dept) {
    const rnrId = 'rnr_direct_' + dept.name.replace(/[\s()&]/g,'_');
    const rnrHTML = dept.rnr.map(function(r) { return '<li class="text-[9px] text-neutral-400 flex gap-1.5"><span class="text-neutral-300 shrink-0">—</span>' + r + '</li>'; }).join('');
    return '<div class="border border-neutral-200 rounded-xl overflow-hidden">' +
      '<div class="bg-neutral-50 border-b border-neutral-200 px-4 py-2 flex items-center justify-between">' +
        '<div><p class="text-[9px] font-black text-neutral-700">' + dept.name + '</p><p class="text-[8px] text-neutral-400">' + dept.sub + '</p></div>' +
        '<button onclick="var el=document.getElementById(\'' + rnrId + '\');el.classList.toggle(\'hidden\');" class="text-[8px] text-neutral-400 hover:text-black font-black flex items-center gap-1 transition-colors"><i data-lucide="list" class="w-3 h-3"></i>R&R</button>' +
      '</div>' +
      '<div class="px-4">' + orgLeaderRow(dept.leader) + '</div>' +
      '<div id="' + rnrId + '" class="hidden px-4 pt-2 pb-3 border-t border-neutral-100 bg-neutral-50">' +
        '<ul class="space-y-1">' + rnrHTML + '</ul>' +
      '</div>' +
    '</div>';
  }

  // ─── HTML 조립 ───
  // 직속 부서 행
  const directHTML = ORG_DIRECT.map(orgDirectBlock).join('');
  // 본부 블록
  const divisionsHTML = ORG_DIVISIONS.map(function(div) {
    const headRow = div.head ? '<div class="px-4 pb-3 border-b border-neutral-100">' + orgLeaderRow(div.head) + '</div>' : '';
    const teamsHTML = div.teams.map(orgTeamBlock).join('');
    return '<div class="border border-neutral-300 rounded-2xl overflow-hidden">' +
      '<div class="bg-neutral-900 text-white px-5 py-3">' +
        '<p class="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">' + div.sub + '</p>' +
        '<p class="text-sm font-black">' + div.name + '</p>' +
      '</div>' +
      headRow +
      '<div class="p-4 space-y-0">' + teamsHTML + '</div>' +
    '</div>';
  }).join('');

  // ─── 지사 데이터 ───
  // 지사 데이터: allBranches(Firebase)에서 동적 생성, 없으면 빈 배열
  const ORG_BRANCHES = Object.keys(allBranches).length > 0
    ? Object.entries(allBranches)
        .filter(function(e) { return e[1].type === 'branch' || e[1].type === 'dealer'; })
        .map(function(e) {
          var name = e[0]; var data = e[1];
          return {
            name: name,
            region: (data.regions || []).join(' · '),
            status: data.status || 'active',
            rep: { name: data.ownerName || '-', title: '대표', phone: data.phone || '' },
            staff: (data.staff || []).map(function(s) { return { name: s.name || '', title: s.position || '담당', phone: s.phone || '' }; })
          };
        })
    : [];

  // 지사 카드 빌더
  const branchCardsHTML = ORG_BRANCHES.map(function(b) {
    const staffHTML = b.staff.map(orgMemberRow).join('');
    const isClosed   = b.status === 'closed';
    const isInactive = b.status === 'dormant'; // Firebase 저장값은 'dormant'
    const headerBg = isClosed ? 'bg-neutral-400' : isInactive ? 'bg-neutral-600' : 'bg-neutral-800';
    const statusBadge = isClosed
      ? '<span class="text-[7px] font-black px-1.5 py-0.5 rounded bg-neutral-300 text-neutral-600">폐지</span>'
      : isInactive
      ? '<span class="text-[7px] font-black px-1.5 py-0.5 rounded bg-neutral-500 text-neutral-200">비활성</span>'
      : '<span class="text-[7px] font-black px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">운영중</span>';
    const repRow = isClosed
      ? '<div class="px-4 py-2 opacity-50">' + orgLeaderRow(b.rep) + '</div>'
      : '<div class="px-4">' + orgLeaderRow(b.rep) + '</div>';
    return '<div class="border rounded-xl overflow-hidden ' + (isClosed ? 'border-neutral-200 opacity-70' : 'border-neutral-300') + '">' +
      '<div class="' + headerBg + ' text-white px-4 py-2.5 flex items-center justify-between">' +
        '<div>' +
          (b.region ? '<p class="text-[7px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">' + b.region + '</p>' : '') +
          '<p class="text-[11px] font-black">' + b.name + '</p>' +
        '</div>' +
        statusBadge +
      '</div>' +
      repRow +
      (staffHTML ? '<div class="px-4 pb-2 border-t border-neutral-100">' + staffHTML + '</div>' : '') +
    '</div>';
  }).join('');

  const orgContent = '<div class="space-y-5">' +
    // CEO (중앙)
    '<div class="flex justify-center">' +
      '<div class="border-2 border-black rounded-2xl px-10 py-4 text-center">' +
        '<p class="text-[8px] font-black uppercase tracking-[0.3em] text-neutral-400 mb-1">CEO / 대표이사</p>' +
        '<p class="text-xl font-black tracking-tight">이한울</p>' +
      '</div>' +
    '</div>' +
    // 직속 부서 (중앙 2열)
    '<div>' +
      '<p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-2 text-center">대표이사 직속</p>' +
      '<div class="grid grid-cols-2 gap-3 max-w-2xl mx-auto">' + directHTML + '</div>' +
    '</div>' +
    // 구분선
    '<div class="border-t-2 border-neutral-200"></div>' +
    // 생산본부 | 사업본부 | 지사네트워크 — 3열
    '<div class="grid grid-cols-3 gap-5 items-start">' +
      divisionsHTML +
      '<div>' +
        '<p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-3">지사 네트워크</p>' +
        '<div class="grid grid-cols-2 gap-3">' + branchCardsHTML + '</div>' +
      '</div>' +
    '</div>' +
    '<p class="text-[9px] text-neutral-400 text-center">R&R 버튼으로 업무 범위 확인 · 전화번호 클릭 시 전화 앱 연동</p>' +
  '</div>';

  let activeContent = leaveContent;
  if (hrDocsTab === 'issue') activeContent = issueContent;
  else if (hrDocsTab === 'report') activeContent = reportContent;
  else if (hrDocsTab === 'org') activeContent = orgContent;

  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-5xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tighter">HR Docs</h1>
            <p class="text-sm text-neutral-400 mt-1">인사 기록</p>
          </div>
          <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>

        <!-- 탭 네비게이션 -->
        <div class="flex gap-6 mb-8 border-b border-neutral-100">
          <button onclick="hrDocsTab='org'; render();" class="pb-3 text-[11px] font-black uppercase tracking-widest transition-all ${hrDocsTab === 'org' ? tabActive : tabInactive}">
            <i data-lucide="network" class="w-3.5 h-3.5 inline-block mr-1"></i>조직도
          </button>
          <button onclick="hrDocsTab='leave'; render();" class="pb-3 text-[11px] font-black uppercase tracking-widest transition-all ${hrDocsTab === 'leave' ? tabActive : tabInactive}">
            <i data-lucide="calendar-off" class="w-3.5 h-3.5 inline-block mr-1"></i>연차 · 휴가
          </button>
          <button onclick="hrDocsTab='issue'; render();" class="pb-3 text-[11px] font-black uppercase tracking-widest transition-all ${hrDocsTab === 'issue' ? tabActive : tabInactive}">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 inline-block mr-1"></i>이슈현황
          </button>
          <button onclick="hrDocsTab='report'; render();" class="pb-3 text-[11px] font-black uppercase tracking-widest transition-all ${hrDocsTab === 'report' ? tabActive : tabInactive}">
            <i data-lucide="clipboard-list" class="w-3.5 h-3.5 inline-block mr-1"></i>외근 · 보고서
          </button>
        </div>

        ${activeContent}
      </main>
      ${renderFooter()}

      <!-- 연차신청 모달 -->
      <div id="leaveModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-black">연차신청</h3>
            <button onclick="closeLeaveRequest()" class="text-neutral-400 hover:text-black">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">신청자</label>
              <input type="text" id="leaveApplicant" value="${currentManager || currentBranch}" class="input-base mt-1 bg-neutral-100 text-neutral-500 cursor-not-allowed" readonly tabindex="-1">
              <p class="text-[9px] text-neutral-400 mt-1 ml-1">로그인 계정으로 자동 설정됩니다.</p>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">연차 유형</label>
              <select id="leaveType" class="input-base mt-1" onchange="toggleLeaveTimeSlot()">
                <option value="연차">연차 (1일)</option>
                <option value="반차">반차 (0.5일)</option>
                <option value="반반차">반반차 (0.25일)</option>
                <option value="병가">병가</option>
                <option value="경조사">경조사</option>
                <option value="긴급">긴급 휴가</option>
                <option value="공가">공가</option>
                <option value="특별">특별 휴가</option>
              </select>
            </div>
            <!-- 반차 시간대 선택 -->
            <div id="halfDaySlot" class="hidden">
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">반차 시간대</label>
              <select id="leaveHalfType" class="input-base mt-1">
                <option value="오전반차">오전반차 (09:00~14:00)</option>
                <option value="오후반차">오후반차 (14:00~18:00)</option>
              </select>
            </div>
            <!-- 반반차 시간대 선택 -->
            <div id="quarterDaySlot" class="hidden">
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">반반차 시간대</label>
              <select id="leaveQuarterType" class="input-base mt-1">
                <option value="09:00~11:00">09:00 ~ 11:00</option>
                <option value="11:00~14:00">11:00 ~ 14:00</option>
                <option value="14:00~16:00">14:00 ~ 16:00</option>
                <option value="16:00~18:00">16:00 ~ 18:00</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">시작일</label>
              <input type="date" id="leaveStartDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">종료일</label>
              <input type="date" id="leaveEndDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">사유 <span class="text-neutral-300">(선택)</span></label>
              <textarea id="leaveReason" placeholder="사유를 입력하세요 (선택사항)" class="input-base mt-1"></textarea>
            </div>
            <div class="flex gap-2">
              <button onclick="closeLeaveRequest()" class="flex-1 bg-neutral-200 text-black rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-300 transition-colors text-[11px]">취소</button>
              <button onclick="saveLeaveRequest()" class="flex-1 bg-black text-white rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors text-[11px]">신청</button>
            </div>
          </div>
        </div>
      </div>

      <!-- HR 문서 작성 모달 -->
      <!-- 이슈 작성 모달 -->
      <div id="issueFormModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-black">새 이슈 작성</h3>
            <button onclick="closeIssueForm()" class="text-neutral-400 hover:text-black">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">작성자</label>
              <input type="text" id="issueAuthor" value="${currentManager}" class="input-base mt-1" readonly>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">부서</label>
              <select id="issueDept" class="input-base mt-1" onchange="updateIssueMemberList()">
                <option value="">부서 선택</option>
                ${Object.keys(DEPARTMENTS).map(d => '<option value="' + d + '">' + d + '</option>').join('')}
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">대상자</label>
              <select id="issueTarget" class="input-base mt-1">
                <option value="">대상자 선택 (부서를 먼저 선택하세요)</option>
              </select>
              <input type="text" id="issueTargetManual" placeholder="목록에 없으면 직접 입력" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">날짜</label>
              <input type="date" id="issueDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">제목</label>
              <input type="text" id="issueTitle" placeholder="이슈 제목" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">내용</label>
              <textarea id="issueContent" placeholder="이슈 내용을 상세히 입력하세요" class="input-base mt-1" rows="5"></textarea>
            </div>
            <div class="flex gap-2">
              <button onclick="closeIssueForm()" class="flex-1 bg-neutral-200 text-black rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-300 transition-colors text-[11px]">취소</button>
              <button onclick="saveIssue()" class="flex-1 bg-black text-white rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors text-[11px]">등록</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 시말서/사유서 작성 모달 -->
      <div id="responseDocModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-black" id="responseDocTitle">시말서 작성</h3>
            <button onclick="closeResponseDoc()" class="text-neutral-400 hover:text-black">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div id="responseDocInfo" class="bg-neutral-50 rounded-xl p-4 mb-4 text-[10px]"></div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">작성자 (대상자)</label>
              <input type="text" id="responseAuthor" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">내용</label>
              <textarea id="responseContent" placeholder="내용을 작성하세요" class="input-base mt-1" rows="8"></textarea>
            </div>
            <div class="flex gap-2">
              <button onclick="closeResponseDoc()" class="flex-1 bg-neutral-200 text-black rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-300 transition-colors text-[11px]">취소</button>
              <button onclick="saveResponseDoc()" class="flex-1 bg-black text-white rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors text-[11px]">저장</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 기존 HR Doc 모달 (보고서용 유지) -->
      <div id="hrDocModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-black" id="hrDocModalTitle">문서 작성</h3>
            <button onclick="closeHRDocForm()" class="text-neutral-400 hover:text-black">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">작성자</label>
              <input type="text" id="hrDocAuthor" value="${currentManager || currentBranch}" class="input-base mt-1 bg-neutral-100 text-neutral-500 cursor-not-allowed" readonly tabindex="-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">문서 유형</label>
              <input type="text" id="hrDocType" class="input-base mt-1" disabled>
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">대상자 (해당시)</label>
              <input type="text" id="hrDocTarget" placeholder="대상자 성명" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">날짜</label>
              <input type="date" id="hrDocDate" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">제목</label>
              <input type="text" id="hrDocTitle" placeholder="제목을 입력하세요" class="input-base mt-1">
            </div>
            <div>
              <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">내용</label>
              <textarea id="hrDocContent" placeholder="내용을 상세히 입력하세요" class="input-base mt-1" rows="5"></textarea>
            </div>
            <div class="flex gap-2">
              <button onclick="closeHRDocForm()" class="flex-1 bg-neutral-200 text-black rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-300 transition-colors text-[11px]">취소</button>
              <button onclick="saveHRDoc()" class="flex-1 bg-black text-white rounded-xl py-3 font-black uppercase tracking-widest hover:bg-neutral-800 transition-colors text-[11px]">저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openLeaveRequest() {
  leaveModalOpen = true;
  document.getElementById('leaveModal').classList.remove('hidden');
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('leaveStartDate').value = today;
  document.getElementById('leaveEndDate').value = today;
}

function openBulkLeaveForm() {
  const modal = document.createElement('div');
  modal.id = 'bulkLeaveModal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm';
  const today = getTodayKST();
  // 재직중 본사 직원 목록
  const staffList = (window._HQ_EMPLOYEES_BULK || []).filter(e => e.status === '재직').map(e => e.name).join(', ') || '본사 재직 전직원';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-black flex items-center gap-2"><i data-lucide="users" class="w-4 h-4 text-red-500"></i>전직원 일괄 연차 공지</h3>
        <button onclick="document.getElementById('bulkLeaveModal').remove()" class="text-neutral-400 hover:text-black"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-xl p-3">
        <p class="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">적용 대상</p>
        <p class="text-[10px] text-red-700 font-bold">${staffList}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">시작일 *</label><input type="date" id="bulkStart" class="input-base mt-1 w-full" value="${today}" /></div>
        <div><label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">종료일 *</label><input type="date" id="bulkEnd" class="input-base mt-1 w-full" value="${today}" /></div>
      </div>
      <div><label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">유형</label>
        <select id="bulkType" class="input-base mt-1 w-full">
          <option value="연차">연차</option><option value="공가">공가</option><option value="특별">특별 휴가</option>
        </select>
      </div>
      <div><label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">사유 *</label>
        <input type="text" id="bulkReason" class="input-base mt-1 w-full" placeholder="예: 회사 창립기념일, 공휴일 브릿지" />
      </div>
      <div class="flex gap-3 pt-2 border-t border-neutral-100">
        <button onclick="document.getElementById('bulkLeaveModal').remove()" class="flex-1 h-11 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-black uppercase hover:bg-neutral-200">취소</button>
        <button onclick="submitBulkLeave()" class="flex-1 h-11 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-600 flex items-center justify-center gap-2">
          <i data-lucide="megaphone" class="w-3.5 h-3.5"></i>게시
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
}

async function submitBulkLeave() {
  const startDate = document.getElementById('bulkStart').value;
  const endDate = document.getElementById('bulkEnd').value;
  const type = document.getElementById('bulkType').value;
  const reason = document.getElementById('bulkReason').value.trim();
  if (!startDate || !endDate || !reason) { alert('날짜와 사유를 모두 입력하세요.'); return; }
  // 어드민 비밀번호 확인
  const pw = prompt('어드민 비밀번호를 입력하세요:');
  if (pw === null) return;
  if (pw.trim() !== (window._ADMIN_PW_BULK || '')) { alert('비밀번호가 올바르지 않습니다.'); return; }
  await saveBulkLeave(startDate, endDate, type, reason);
  document.getElementById('bulkLeaveModal')?.remove();
}

async function saveBulkLeave(startDate, endDate, type, reason) {
  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    // 재직중 본사 직원 각각 연차 등록
    const targets = (window._HQ_EMPLOYEES_BULK || []).filter(e => e.status === '재직');
    const promises = targets.length > 0
      ? targets.map(emp => addDoc(collection(db, 'works_leave_requests'), {
          applicant: emp.name,
          type: type || '연차',
          timeSlot: '',
          startDate, endDate,
          reason: reason,
          branch: '본사',
          isBulk: true,
          status: '승인',
          approvedBy: currentManager || '관리자',
          approvedAt: new Date().toISOString(),
          createdAt: serverTimestamp()
        }))
      : [addDoc(collection(db, 'works_leave_requests'), {
          applicant: '전직원',
          type: type || '연차',
          timeSlot: '',
          startDate, endDate,
          reason,
          branch: '본사',
          isBulk: true,
          status: '승인',
          approvedBy: currentManager || '관리자',
          approvedAt: new Date().toISOString(),
          createdAt: serverTimestamp()
        })];
    await Promise.all(promises);
    alert(`✅ ${targets.length || 1}명 전직원 일괄 연차가 공지되었습니다.`);
    render();
  } catch(e) { alert('등록 실패: ' + e.message); }
}

function toggleLeaveTimeSlot() {
  const type = document.getElementById('leaveType').value;
  const halfSlot = document.getElementById('halfDaySlot');
  const quarterSlot = document.getElementById('quarterDaySlot');
  if (halfSlot) halfSlot.classList.toggle('hidden', type !== '반차');
  if (quarterSlot) quarterSlot.classList.toggle('hidden', type !== '반반차');
}

function closeLeaveRequest() {
  leaveModalOpen = false;
  document.getElementById('leaveModal').classList.add('hidden');
}

// ===== 알람 발송 (order/index.html 전용) =====
async function pushWorkNotification(message, type, recipientId, recipientTypes) {
  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_notifications'), {
      message: message,
      type: type || 'info',
      recipientId: recipientId || '',   // '' = 전체, 'hq' = 본사전체, '이름' = 특정인
      recipientTypes: Array.isArray(recipientTypes) ? recipientTypes : [],  // #28: ['hq','branch','dealer','construction'] 조합
      senderId: currentManager || currentBranch || '',
      read: false,
      createdAt: serverTimestamp()
    });
  } catch(e) { console.warn('pushWorkNotification error:', e); }
}

// ===== 결재선 헬퍼 =====
// 신청자 이름으로 결재 체계 반환
function getApprovalChain(applicantName) {
  const emp = allHQEmployees.find(function(e){ return e.name === applicantName; });
  if (!emp) return { stages: 1, firstApprover: null, finalApprover: '이한울' };

  const productionDepts = ['생산본부', '임가공팀', '포장출하팀', '기술지원팀'];
  const businessDepts = ['사업본부', '경영지원실', '브랜드전략팀', '기술영업팀'];
  const dept = emp.dept || '';

  // 부서장 본인이 신청하면 직결
  if (applicantName === '이우경' || applicantName === '정진현' || applicantName === '이한울') {
    return { stages: 1, firstApprover: null, finalApprover: '이한울' };
  }
  if (productionDepts.includes(dept)) {
    return { stages: 2, firstApprover: '이우경', finalApprover: '이한울', dept: dept };
  }
  if (businessDepts.includes(dept)) {
    return { stages: 2, firstApprover: '정진현', finalApprover: '이한울', dept: dept };
  }
  return { stages: 1, firstApprover: null, finalApprover: '이한울', dept: dept };
}

// 현재 로그인한 사람이 이 연차 카드에서 할 수 있는 액션 반환
function getLeaveActions(req) {
  const chain = {
    stages: req.stages || 1,
    firstApprover: req.firstApprover || null,
    finalApprover: req.finalApprover || '이한울'
  };
  const me = currentManager;
  const actions = { canFirst: false, canFinal: false, canReject: false };

  if (req.status === '대기') {
    if (chain.stages === 1 && me === chain.finalApprover) {
      actions.canFinal = true; actions.canReject = true;
    } else if (chain.stages === 2 && me === chain.firstApprover) {
      actions.canFirst = true; actions.canReject = true;
    }
    // 이한울은 언제든 개입 가능 (직결 처리)
    if (me === '이한울' && chain.stages === 2) {
      actions.canFinal = true; actions.canReject = true;
    }
  } else if (req.status === '1차승인') {
    if (me === chain.finalApprover || me === '이한울') {
      actions.canFinal = true; actions.canReject = true;
    }
  }
  return actions;
}

async function saveLeaveRequest() {
  // 신청자는 폼 입력이 아닌 로그인 계정에서 강제 바인딩
  const applicant = currentManager || currentBranch || '미상';
  const type = document.getElementById('leaveType').value;
  const startDate = document.getElementById('leaveStartDate').value;
  const endDate = document.getElementById('leaveEndDate').value;
  const reason = document.getElementById('leaveReason').value;
  // 반차/반반차 시간대
  let timeSlot = '';
  if (type === '반차') timeSlot = document.getElementById('leaveHalfType')?.value || '';
  if (type === '반반차') timeSlot = document.getElementById('leaveQuarterType')?.value || '';

  if (!applicant || !startDate || !endDate) { alert('신청자와 날짜를 입력하세요.'); return; }

  // 결재 체계 자동 계산
  const chain = getApprovalChain(applicant);
  const emp = allHQEmployees.find(function(e){ return e.name === applicant; });

  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_leave_requests'), {
      applicant, type, timeSlot, startDate, endDate, reason,
      branch: currentBranch || '본사',
      applicantDept: emp ? emp.dept : '',
      stages: chain.stages,
      firstApprover: chain.firstApprover || '',
      finalApprover: chain.finalApprover,
      status: '대기',
      createdAt: serverTimestamp()
    });

    // 알람: 1차 결재자(또는 이한울)에게 신청 알람
    const notifyTarget = chain.stages === 2 ? chain.firstApprover : chain.finalApprover;
    await pushWorkNotification(
      applicant + '님이 ' + type + ' 신청을 했습니다 (' + startDate + '~' + endDate + ')',
      'leave_request', notifyTarget
    );

    closeLeaveRequest();
    alert('신청이 등록되었습니다.');
  } catch(e) { console.error('Leave save error:', e); alert('신청 등록 실패'); }
}

async function approveLeave(id, stage) {
  // stage: 'first' = 1차 승인, 'final' = 최종 승인
  const leave = leaveRequests.find(function(l){ return l.id === id; });
  if (!leave) return;
  const stageLabel = stage === 'first' ? '1차 승인' : '최종 승인';
  if (!confirm(leave.applicant + '님의 ' + leave.type + ' 신청을 ' + stageLabel + '하시겠습니까?')) return;

  try {
    const { db, doc, updateDoc, collection, addDoc, serverTimestamp } = window.WORKS_DB;

    if (stage === 'first') {
      // 1차 승인: 상태를 '1차승인'으로, 최종 결재자(이한울)에게 알람
      await updateDoc(doc(db, 'works_leave_requests', id), {
        status: '1차승인',
        firstApprovedBy: currentManager || '관리자',
        firstApprovedAt: new Date().toISOString()
      });
      // 알람: 신청자에게 1차 승인 통보 + 최종 결재자에게 요청
      await pushWorkNotification(
        currentManager + '이(가) ' + leave.applicant + '님의 ' + leave.type + '을 1차 승인했습니다.',
        'leave_first', leave.applicant
      );
      await pushWorkNotification(
        '[결재 요청] ' + leave.applicant + '님의 ' + leave.type + ' 최종 승인이 필요합니다 (' + leave.startDate + '~' + leave.endDate + ')',
        'leave_request', leave.finalApprover || '이한울'
      );

    } else {
      // 최종 승인: 상태를 '최종승인'으로 변경 + 일정 자동 등록
      await updateDoc(doc(db, 'works_leave_requests', id), {
        status: '최종승인',
        finalApprovedBy: currentManager || '관리자',
        finalApprovedAt: new Date().toISOString()
      });
      // 주요일정 다이어리 자동 연동
      const timeInfo = leave.timeSlot ? ' (' + leave.timeSlot + ')' : '';
      await addDoc(collection(db, 'works_schedules'), {
        type: 'leave',
        title: '[' + leave.type + timeInfo + '] ' + leave.applicant,
        date: leave.startDate,
        endDate: leave.endDate !== leave.startDate ? leave.endDate : '',
        memo: leave.reason || '',
        branch: leave.branch || '본사',
        createdAt: serverTimestamp()
      });
      // 알람: 신청자 + 1차 결재자에게 최종 승인 통보
      await pushWorkNotification(
        leave.applicant + '님의 ' + leave.type + '이 최종 승인되었습니다 (' + leave.startDate + '~' + leave.endDate + ')',
        'leave_final', leave.applicant
      );
      if (leave.firstApprover) {
        await pushWorkNotification(
          leave.applicant + '님의 ' + leave.type + '이 대표이사 최종 승인 완료되었습니다.',
          'leave_final', leave.firstApprover
        );
      }
    }
  } catch(e) { console.error('Approve error:', e); alert('승인 실패: ' + e.message); }
}

async function rejectLeave(id) {
  const leave = leaveRequests.find(function(l){ return l.id === id; });
  if (!leave) return;
  const reason = prompt('반려 사유를 입력하세요 (선택):') ;
  if (reason === null) return;
  try {
    const { db, doc, updateDoc } = window.WORKS_DB;
    await updateDoc(doc(db, 'works_leave_requests', id), {
      status: '반려',
      rejectedBy: currentManager || '관리자',
      rejectReason: reason || '',
      rejectedAt: new Date().toISOString()
    });
    // 알람: 신청자에게 반려 통보
    await pushWorkNotification(
      leave.applicant + '님의 ' + leave.type + ' 신청이 반려되었습니다.' + (reason ? ' 사유: ' + reason : ''),
      'leave_reject', leave.applicant
    );
  } catch(e) { console.error('Reject error:', e); alert('반려 실패'); }
}

// ===== HR DOCS 문서 관련 함수 =====
// ===== 이슈현황 함수 =====
function openIssueForm() {
  const modal = document.getElementById('issueFormModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('issueDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('issueAuthor').value = currentManager || '';
  lucide.createIcons();
}

function closeIssueForm() {
  const modal = document.getElementById('issueFormModal');
  if (modal) modal.classList.add('hidden');
}

function updateIssueMemberList() {
  const dept = document.getElementById('issueDept').value;
  const sel = document.getElementById('issueTarget');
  sel.innerHTML = '<option value="">대상자 선택</option>';
  if (dept && DEPARTMENTS[dept]) {
    DEPARTMENTS[dept].forEach(function(m) {
      sel.innerHTML += '<option value="' + m + '">' + m + '</option>';
    });
    sel.innerHTML += '<option value="__manual__">직접 입력</option>';
  }
}

async function saveIssue() {
  const author = document.getElementById('issueAuthor')?.value;
  const dept = document.getElementById('issueDept')?.value;
  const targetSel = document.getElementById('issueTarget')?.value;
  const targetManual = document.getElementById('issueTargetManual')?.value;
  const target = (targetSel === '__manual__' || !targetSel) ? targetManual : targetSel;
  const date = document.getElementById('issueDate')?.value;
  const title = document.getElementById('issueTitle')?.value;
  const content = document.getElementById('issueContent')?.value;

  if (!dept || !target || !title || !content) {
    alert('부서, 대상자, 제목, 내용은 필수 항목입니다.');
    return;
  }

  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_hr_issues'), {
      author: author || currentManager || '',
      department: dept,
      target: target,
      date: date || '',
      title: title,
      content: content,
      status: '등록',
      simalseo: null,
      sayuseo: null,
      createdAt: serverTimestamp()
    });
    closeIssueForm();
    alert('이슈가 등록되었습니다.');
  } catch(e) {
    console.error('Issue save error:', e);
    alert('저장 실패: ' + e.message);
  }
}

// 시말서/사유서 열기
let _responseIssueId = '';
let _responseDocType = '';

function openResponseDoc(issueId, docType) {
  _responseIssueId = issueId;
  _responseDocType = docType;

  const issue = hrIssues.find(function(i) { return i.id === issueId; });
  if (!issue) { alert('이슈를 찾을 수 없습니다.'); return; }

  const modal = document.getElementById('responseDocModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const titleEl = document.getElementById('responseDocTitle');
  const infoEl = document.getElementById('responseDocInfo');
  const authorEl = document.getElementById('responseAuthor');
  const contentEl = document.getElementById('responseContent');

  if (titleEl) titleEl.textContent = docType + (docType === '시말서' && issue.simalseo ? ' 확인' : docType === '사유서' && issue.sayuseo ? ' 확인' : ' 작성');

  if (infoEl) {
    infoEl.innerHTML = '<p class="font-black mb-1">관련 이슈</p>' +
      '<p><span class="text-neutral-400">제목:</span> ' + (issue.title || '-') + '</p>' +
      '<p><span class="text-neutral-400">부서:</span> ' + (issue.department || '-') + ' · <span class="text-neutral-400">대상자:</span> ' + (issue.target || '-') + '</p>' +
      '<p><span class="text-neutral-400">날짜:</span> ' + (issue.date || '-') + '</p>' +
      '<p class="mt-1 text-neutral-500">' + (issue.content || '') + '</p>';
  }

  // 기존 데이터가 있으면 표시
  const existing = docType === '시말서' ? issue.simalseo : issue.sayuseo;
  if (existing) {
    if (authorEl) authorEl.value = existing.author || '';
    if (contentEl) contentEl.value = existing.content || '';
  } else {
    if (authorEl) authorEl.value = issue.target || '';
    if (contentEl) contentEl.value = '';
  }

  lucide.createIcons();
}

function closeResponseDoc() {
  const modal = document.getElementById('responseDocModal');
  if (modal) modal.classList.add('hidden');
  _responseIssueId = '';
  _responseDocType = '';
}

async function saveResponseDoc() {
  if (!_responseIssueId || !_responseDocType) return;
  const author = document.getElementById('responseAuthor')?.value;
  const content = document.getElementById('responseContent')?.value;

  if (!author || !content) { alert('작성자와 내용을 입력하세요.'); return; }

  try {
    const { db, doc, updateDoc, serverTimestamp } = window.WORKS_DB;
    const field = _responseDocType === '시말서' ? 'simalseo' : 'sayuseo';
    const updateData = {};
    updateData[field] = {
      author: author,
      content: content,
      writtenAt: new Date().toISOString()
    };
    updateData['status'] = '진행중';
    await updateDoc(doc(db, 'works_hr_issues', _responseIssueId), updateData);
    closeResponseDoc();
    alert(_responseDocType + '이(가) 저장되었습니다.');
  } catch(e) {
    console.error('Response doc save error:', e);
    alert('저장 실패: ' + e.message);
  }
}

function openHRDocForm(type) {
  const modal = document.getElementById('hrDocModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const titleEl = document.getElementById('hrDocModalTitle');
  const typeEl = document.getElementById('hrDocType');
  const dateEl = document.getElementById('hrDocDate');
  if (titleEl) titleEl.textContent = type + ' 작성';
  if (typeEl) typeEl.value = type;
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  lucide.createIcons();
}

function closeHRDocForm() {
  const modal = document.getElementById('hrDocModal');
  if (modal) modal.classList.add('hidden');
}

async function saveHRDoc() {
  // 작성자는 로그인 계정에서 강제 바인딩
  const author = currentManager || currentBranch || '미상';
  const docType = document.getElementById('hrDocType')?.value;
  const target = document.getElementById('hrDocTarget')?.value;
  const date = document.getElementById('hrDocDate')?.value;
  const title = document.getElementById('hrDocTitle')?.value;
  const content = document.getElementById('hrDocContent')?.value;

  if (!author || !docType || !title || !content) { alert('필수 항목을 입력하세요.'); return; }

  try {
    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_hr_docs'), {
      author, docType, target: target || '', date, title, content,
      status: '등록',
      createdAt: serverTimestamp()
    });
    closeHRDocForm();
    alert(docType + '이(가) 저장되었습니다.');
  } catch(e) { console.error('HR Doc save error:', e); alert('저장 실패'); }
}

