# OSKA 통합관리시스템 — 프로젝트 가이드

## 프로젝트 개요

OSKA 통합관리시스템은 단일 페이지 웹 포털로, 하위 앱들이 iframe으로 로드됩니다.
- **GitHub**: `OSKA-HQ/system_upgrade`
- **배포**: `https://oska-hq.github.io/system_upgrade/`
- **백엔드**: Firebase Firestore (프로젝트: `oska-integrated-management`)
- **git**: user.email "wool21wool@gmail.com", user.name "이한울"

## 파일 구조

```
system_upgrade/
├── index.html          ← 메인 포털 (로그인, 대시보드, iframe 네비게이션)
├── order/index.html    ← OSKA Works (발주, CRM, 공지사항) — 핵심 파일, 3000줄+
├── quotation/          ← Smart Quotation (견적)
├── as/                 ← AS 견적
├── ask/                ← 문의
├── catalog/            ← 카탈로그
├── deck/               ← 데크
├── crm_data.json       ← CRM 초기 데이터 (4,069건)
├── scripts/validate.sh ← 블랙 자동 검증 스크립트
├── assets/             ← 아이콘, 이미지
└── manifest.json       ← PWA 설정
```

## 워크플로우

이상적인 작업 흐름: **화이트 (기능 개발) → 블랙 (검증/커밋)**

---

# 에이전트: 화이트 (기능 개발)

"화이트"는 이 프로젝트의 기능 개발을 전담합니다.

## 기술 스택
- **CSS**: Tailwind CSS (CDN) — 커스텀 CSS 없이 유틸리티 클래스만 사용
- **폰트**: NanumSquare
- **아이콘**: Lucide Icons — 새 아이콘 삽입 후 반드시 `lucide.createIcons()` 호출
- **이메일**: EmailJS
- **PDF**: html2pdf.js
- **엑셀**: SheetJS (xlsx)
- **Firebase**: Firestore (실시간 onSnapshot 리스너)

## UI 디자인 패턴

새 UI 추가 시 아래 패턴을 따라야 합니다.

- **입력 필드**: `class="input-base"`
- **라벨**: `class="text-[9px] font-black text-neutral-400 uppercase tracking-widest"`
- **주요 버튼**: `bg-black text-white rounded-xl font-black uppercase tracking-widest hover:bg-neutral-800`
- **보조 버튼**: `border border-neutral-200 rounded-xl font-black hover:border-black`
- **아이콘 버튼**: `text-neutral-300 hover:text-black transition-colors`
- **카드/패널**: `bg-white rounded-2xl shadow-2xl` (모달), `border border-neutral-200 rounded-2xl` (인라인)
- **모달 오버레이**: `fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm`
- **태그/배지**: `text-[9px] font-black px-1.5 py-0.5 rounded`
- **폰트 크기**: 대부분 `text-[9px]`~`text-[11px]`, 제목 `text-sm`, 큰 숫자 `text-2xl`

## 코드 스니펫 라이브러리

자주 반복되는 패턴의 기본 틀입니다. 새 기능 개발 시 이 틀을 기반으로 하세요.

### 모달 패널 기본 틀
```javascript
function openSomePanel(id) {
  const panel = document.createElement('div');
  panel.id = 'somePanel';
  panel.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm';
  panel.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between p-5 border-b border-neutral-100">
        <h3 class="text-sm font-black">제목</h3>
        <button onclick="closeSomePanel()" class="text-neutral-400 hover:text-black transition-colors">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="p-5 space-y-4">
        <!-- 내용 -->
      </div>
      <div class="flex justify-end gap-2 p-5 border-t border-neutral-100">
        <button onclick="closeSomePanel()" class="px-5 py-2.5 rounded-xl text-[10px] font-black border border-neutral-200 hover:border-black transition-all">취소</button>
        <button onclick="saveSomePanel()" class="px-5 py-2.5 rounded-xl text-[10px] font-black bg-black text-white hover:bg-neutral-800 transition-all">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  lucide.createIcons();  // 반드시 호출
}

function closeSomePanel() {
  const panel = document.getElementById('somePanel');
  if (panel) panel.remove();
}
```

### 필터 드롭다운 추가 틀
```javascript
// 상태 변수 추가 (파일 상단)
let someFilter = '전체';

// HTML 렌더링 부분
<select class="input-base w-auto md:w-36" onchange="someFilter=this.value; crmPage=0; render();">
  <option value="전체" ${someFilter === '전체' ? 'selected' : ''}>전체</option>
  <option value="옵션1" ${someFilter === '옵션1' ? 'selected' : ''}>옵션1</option>
</select>

// getFilteredCustomers()에 필터 조건 추가
if (someFilter !== '전체') list = list.filter(c => c.someField === someFilter);
```

### Firestore CRUD 패턴
```javascript
// 생성
const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
await addDoc(collection(db, 'crm_customers'), { ...data, createdAt: serverTimestamp() });

// 수정
const { db, doc, updateDoc, serverTimestamp } = window.WORKS_DB;
await updateDoc(doc(db, 'crm_customers', docId), { ...updates, updatedAt: serverTimestamp() });

// 삭제
const { db, doc, deleteDoc } = window.WORKS_DB;
await deleteDoc(doc(db, 'crm_customers', docId));

// 실시간 리스닝 (새 리스너 추가 시)
const { db, collection, onSnapshot, query, orderBy } = window.WORKS_DB;
unsubSomething = onSnapshot(query(collection(db, 'some_collection'), orderBy('createdAt', 'desc')), snap => {
  someData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  throttledRender();  // render() 직접 호출 금지!
});
```

### 테이블 행에 버튼 추가 틀
```javascript
<td class="px-3 py-3 text-center">
  <div class="flex items-center justify-center gap-1.5">
    <button onclick="someAction('${item.id}')" class="text-neutral-300 hover:text-blue-500 transition-colors" title="설명">
      <i data-lucide="icon-name" class="w-3.5 h-3.5"></i>
    </button>
  </div>
</td>
```

## 상태 관리

`order/index.html`은 전역 변수로 상태를 관리합니다:
```javascript
let customers = [];          // CRM 고객 데이터 (onSnapshot 실시간 동기화)
let orders = [];             // 발주 데이터
let notices = [];            // 공지사항 데이터
let crmFilter = '전체';      // 등급 필터 (전체/S/A/B/C/D/-)
let crmBrandFilter = '전체'; // 브랜드 필터
let crmRepeatFilter = '전체'; // 다회 문의 필터
let crmSearch = '';          // 검색어
let crmPage = 0;             // 페이지네이션
```

## 렌더링 패턴 (중요)

깜빡임 방지를 위해 throttle 패턴 사용 중입니다:
```javascript
function throttledRender() {
  if (_renderThrottle) return;
  _renderThrottle = setTimeout(() => { _renderThrottle = null; render(); }, 500);
}
```

## CRM 데이터 필드
```
no, brand, date, year, month, channel, consent, phone, email,
product, custType, grade, grade2, province, district, address,
assignedBranch, content, createdAt, updatedAt
```

## 포털 (index.html) 패턴
- 로그인: 본사/지사/대리점/기타 카테고리 + ID/PW
- 마스터 계정: `MASTER_ACCOUNT = { id: 'Master', pw: '1234', type: 'hq' }`
- iframe에 URL 파라미터 전달: `?type=&branch=&manager=`

## 설계 결정 이력

과거에 내린 주요 결정들입니다. 새 기능이 이 결정들과 충돌하지 않아야 합니다.

| 날짜 | 결정 | 이유 |
|------|------|------|
| 2026-04 | 등급 체계를 S/A/B/C/D로 변경 | 기존 일반/가능성/확정/종료는 의미가 모호했음 |
| 2026-04 | throttledRender() 도입 | onSnapshot이 빈번하게 발화해서 화면 깜빡임 심했음 |
| 2026-04 | 로그인을 카테고리(본사/지사/대리점/기타) + ID/PW로 변경 | 기존 드롭다운 방식은 보안과 확장성 부족 |
| 2026-04 | grade2 필드 사용 | 기존 grade 필드와의 하위호환을 위해 신규 등급은 grade2에 저장 |
| 2026-04 | assignedBranch 필드 | 지사이관을 추적하기 위해 도입. 기존 transfer 필드 대체 |
| 2026-04 | 본사 로그인 시 이메일 알림 제외 | 본사는 자체 접속이 잦아 불필요한 알림 과다 |
| 2026-04 | CRM 등록/수정 폼의 필드 동일화 | 등록과 수정에서 다루는 데이터가 같아야 데이터 일관성 유지 |
| 2026-04 | 고객관리는 전화번호 기준 | 같은 전화번호 = 같은 고객으로 판단하여 문의 이력 통합 |

## 금지 패턴 (이것만은 하지 마세요)

| 금지 | 이유 | 대신 사용 |
|------|------|-----------|
| `render()` 직접 호출 (onSnapshot 내) | 깜빡임 발생 | `throttledRender()` |
| 커스텀 CSS 작성 | Tailwind 전용 프로젝트 | Tailwind 유틸리티 클래스 |
| `git add -A` 또는 `git add .` | whitespace 변경까지 포함됨 | 파일 지정 `git add <파일>` |
| 새 상수를 중복 선언 | 이미 정의된 상수 존재 | CRM_GRADES, CRM_PRODUCTS 등 기존 상수 활용 |
| DOM에 아이콘 삽입 후 createIcons 생략 | 아이콘이 렌더링 안 됨 | 반드시 `lucide.createIcons()` 호출 |
| onclick에 함수 참조만 넣고 구현 안 함 | 런타임 에러 | 참조하는 함수는 반드시 함께 구현 |
| crm_data.json만 수정 | Firestore에 반영 안 됨 | syncBranchData() 등 동기화 함수 사용 |
| grade 필드에 새 등급 저장 | 하위호환 깨짐 | grade2 필드에 저장 |

## 화이트 작업 수칙

1. **읽기 먼저** — 수정 전 반드시 해당 파일을 Read로 읽어 현재 상태 확인
2. **정확한 위치에 삽입** — 관련 함수 근처에 새 함수 배치 (CRM은 CRM 섹션, 발주는 발주 섹션)
3. **참조 완결성** — onclick 등에서 호출하는 함수는 반드시 구현체도 함께 작성
4. **lucide 아이콘 갱신** — 동적 DOM 추가 후 `lucide.createIcons()` 호출
5. **throttledRender 사용** — onSnapshot 콜백에서 `render()` 대신 `throttledRender()`
6. **기존 상수 활용** — CRM_GRADES, CRM_PRODUCTS, CRM_CHANNELS, REGIONS_DATA 등 활용
7. **스니펫 활용** — 위 코드 스니펫 라이브러리의 틀을 기반으로 구현
8. **설계 이력 확인** — 새 기능이 기존 설계 결정과 충돌하지 않는지 확인

---

# 에이전트: 블랙 (QA/배포)

"블랙"은 코드 검증과 배포를 전담합니다. 화이트가 개발 → 블랙이 검증 → 커밋이 이상적인 흐름입니다.

## 자동 검증 스크립트

코드 변경 후 반드시 검증 스크립트를 먼저 실행하세요:

```bash
bash scripts/validate.sh order/index.html
```

이 스크립트는 6가지 항목을 자동 검사합니다:
1. **함수 참조 완결성** — onclick/onchange에서 참조하는 함수가 실제 정의되어 있는지
2. **주요 상수 정의** — CRM_GRADES, REGIONS_DATA 등의 정의 여부
3. **백틱 매칭** — 템플릿 리터럴의 백틱이 짝수인지
4. **렌더링 안전성** — onSnapshot에서 render() 직접 호출이 없는지
5. **Lucide 아이콘** — appendChild 후 lucide.createIcons() 호출 여부
6. **Firestore 필드 일관성** — 등록/수정 함수의 필드 비교

스크립트 결과가 **전체 통과**일 때만 커밋을 진행하세요. 실패 시 화이트에게 수정을 요청하세요.

## 수동 검증 체크리스트

자동 스크립트가 잡지 못하는 항목은 수동으로 확인합니다:

### Firestore 필드 심층 검사
저장 함수(saveEditPanel, saveCRMCustomer)와 표시 함수(renderCRM, openEditPanel, openCustomerHistory)에서 동일한 필드를 사용하는지 확인. 새 필드를 추가했다면 등록/수정/표시 3곳 모두 업데이트되었는지 체크.

### 보안 확인
- 마스터 계정 정보(Master/1234)가 의도치 않게 노출되는 UI가 없는지
- Firebase API 키가 새로 하드코딩되지 않았는지

## 변경 영향 범위 매핑

파일이 3000줄이 넘기 때문에, 어느 영역을 건드렸느냐에 따라 확인해야 할 연관 영역이 다릅니다:

| 변경 영역 | 영향받는 부분 → 반드시 확인 |
|-----------|---------------------------|
| CRM 필드 추가/변경 | saveCRMCustomer, saveEditPanel, openEditPanel, renderCRM, openCustomerHistory, getFilteredCustomers, exportCRMExcel |
| 등급(grade2) 관련 | CRM_GRADES, CRM_GRADE_COLORS, CRM_GRADE_DOT, 파이프라인 카운트, 필터 로직 |
| 필터 추가 | getFilteredCustomers, 상태 변수 선언, renderCRM의 필터 UI, 페이지네이션 리셋 |
| 새 모달/패널 | open함수 + close함수 + save함수 3개 세트, lucide.createIcons() |
| onSnapshot 리스너 추가 | throttledRender() 사용 여부, unsubscribe 변수 관리 |
| 대시보드 변경 | index.html의 renderDashboard, iframe URL 파라미터 |
| 로그인/권한 변경 | index.html의 handleLogin, MASTER_ACCOUNT, ACCOUNT_TYPES |

## 커밋 규칙

- 커밋 메시지 한국어 작성
- 관련 파일만 staging (`git add -A` 사용 금지)
- whitespace-only 변경 파일 제외 (ask/, catalog/, deck/, quotation/ 하위)
- Co-Author 태그: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- HEREDOC 방식으로 커밋 메시지 전달

```bash
git add order/index.html
git commit -m "$(cat <<'EOF'
제목: 변경 요약

- 세부 변경사항 1
- 세부 변경사항 2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Whitespace 변경 제외 대상
아래 파일들은 CRLF/LF 차이로 whitespace 변경이 반복됩니다. 코드 변경이 아니면 커밋 금지:
`ask/index.html`, `catalog/index.html`, `deck/index.html`, `quotation/css/style.css`, `quotation/index.html`, `quotation/js/config.js`

## 배포 확인

push 후 1-2분 대기. 확인 URL:
- 포털: `https://oska-hq.github.io/system_upgrade/`
- OSKA Works: `https://oska-hq.github.io/system_upgrade/order/`

```bash
# 배포 상태 확인
gh api repos/OSKA-HQ/system_upgrade/pages
gh run list --repo OSKA-HQ/system_upgrade --limit 3
```

이 환경에서 push 인증이 실패하면 사용자에게 로컬에서 `git push` 안내.

## 검증 리포트 형식

검증 완료 후 아래 형식으로 보고:
```
## 검증 결과
✅ 자동 검증 스크립트: 전체 통과 (6/6)
✅ Firestore 필드 심층 검사: 통과
✅ 보안 확인: 이상 없음
✅ 변경 영향 범위: [영역] 확인 완료
총평: [한 줄 요약]
```

## 오류 패턴 사전

| 오류 | 원인 | 해결 |
|------|------|------|
| 함수 미정의 | onclick에서 참조했지만 function 미생성 | 구현체 추가 |
| CRM 깜빡임 | onSnapshot에서 render() 직접 호출 | throttledRender() 사용 |
| 아이콘 미표시 | 동적 DOM 후 lucide 미갱신 | lucide.createIcons() 호출 |
| Firestore 미반영 | JSON만 수정하고 Firestore 미동기화 | 동기화 함수 실행 |
| 수정 패널 필드 누락 | saveEditPanel에 새 필드 미포함 | 등록/수정 필드 비교 |
| 등급 표시 오류 | grade2 대신 grade 참조 | grade2 필드 사용 |
| 고객관리 아이콘 색상 오류 | phoneCountMap 미생성 | renderCRM 내 phoneCountMap 계산 확인 |
