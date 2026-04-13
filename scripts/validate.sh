#!/bin/bash
# OSKA 통합관리시스템 — 블랙 자동 검증 스크립트
# 사용법: bash scripts/validate.sh [파일경로]
# 예시: bash scripts/validate.sh order/index.html

set -uo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

TARGET="${1:-order/index.html}"

if [ ! -f "$TARGET" ]; then
  echo -e "${RED}파일을 찾을 수 없습니다: $TARGET${NC}"
  exit 1
fi

echo "========================================"
echo " OSKA 블랙 — 자동 검증"
echo " 대상: $TARGET"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# ── 1. 함수 참조 완결성 검사 ──
echo "[ 1/6 ] 함수 참조 완결성 검사"

# onclick, onchange, oninput 속성값에서 최상위 함수 호출만 추출
# 예: onclick="saveEditPanel()" → saveEditPanel
# 예: onclick="crmPage=Math.max(0,crmPage-1);render();" → render
# .method() 패턴(체이닝)은 제외
REFERENCED=$(grep -oP '(?:onclick|onchange|oninput)="[^"]*"' "$TARGET" 2>/dev/null \
  | grep -oP '(?<![.\w])([a-zA-Z_][a-zA-Z0-9_]*)\s*\(' \
  | sed 's/\s*($//' | sort -u)

MISSING_FUNCS=""
# 내장/브라우저 API + 메서드 호출 스킵 목록
SKIP_FUNCS="window document console alert confirm prompt parseInt parseFloat Math Date Array Object String JSON Number Boolean RegExp Error this event history location navigator fetch setTimeout setInterval clearTimeout clearInterval clearInterval encodeURIComponent decodeURIComponent open close focus blur print scroll scrollTo scrollBy getComputedStyle requestAnimationFrame cancelAnimationFrame atob btoa getElementById getElementsByClassName querySelector querySelectorAll createElement appendChild removeChild insertBefore replaceChild remove cloneNode setAttribute getAttribute removeAttribute classList contains add toggle innerHTML textContent style value checked selected src href target type name id className parentNode childNodes firstChild lastChild nextSibling previousSibling push pop shift unshift splice slice concat join map filter reduce forEach find findIndex includes indexOf sort reverse keys values entries from isArray assign freeze create hasOwnProperty toString valueOf replace match search split trim toLowerCase toUpperCase startsWith endsWith repeat padStart padEnd charAt charCodeAt substring substr localeCompare toFixed toPrecision toLocaleString getTime getFullYear getMonth getDate getHours getMinutes getSeconds setTime setFullYear setMonth setDate max min abs ceil floor round random pow sqrt log log2 log10 sign trunc now parse stringify stopPropagation preventDefault"

for func in $REFERENCED; do
  SKIP=false
  for s in $SKIP_FUNCS; do
    if [ "$func" = "$s" ]; then SKIP=true; break; fi
  done
  $SKIP && continue
  if ! grep -qP "function\s+${func}\s*\(" "$TARGET" 2>/dev/null; then
    MISSING_FUNCS="$MISSING_FUNCS $func"
  fi
done

if [ -z "$MISSING_FUNCS" ]; then
  echo -e "  ${GREEN}✅ 통과${NC} — 모든 참조 함수가 정의되어 있습니다."
  ((PASS++))
else
  echo -e "  ${RED}❌ 실패${NC} — 정의되지 않은 함수:"
  for f in $MISSING_FUNCS; do
    echo -e "    ${RED}→ $f()${NC}"
  done
  ((FAIL++))
fi
echo ""

# ── 2. 변수/상수 참조 검사 ──
echo "[ 2/6 ] 주요 상수 정의 확인"

CONSTANTS="CRM_GRADES CRM_PRODUCTS CRM_CHANNELS REGIONS_DATA CRM_GRADE_COLORS CRM_GRADE_DOT CRM_PAGE_SIZE"
MISSING_CONST=""
for c in $CONSTANTS; do
  if grep -q "$c" "$TARGET" 2>/dev/null; then
    if ! grep -qP "(const|let|var)\s+$c\s*=" "$TARGET" 2>/dev/null; then
      MISSING_CONST="$MISSING_CONST $c"
    fi
  fi
done

if [ -z "$MISSING_CONST" ]; then
  echo -e "  ${GREEN}✅ 통과${NC} — 모든 상수가 정의되어 있습니다."
  ((PASS++))
else
  echo -e "  ${RED}❌ 실패${NC} — 정의되지 않은 상수:"
  for c in $MISSING_CONST; do
    echo -e "    ${RED}→ $c${NC}"
  done
  ((FAIL++))
fi
echo ""

# ── 3. 백틱 매칭 검사 ──
echo "[ 3/6 ] 템플릿 리터럴 백틱 매칭"

BACKTICK_COUNT=$(grep -o '`' "$TARGET" | wc -l)
if [ $((BACKTICK_COUNT % 2)) -eq 0 ]; then
  echo -e "  ${GREEN}✅ 통과${NC} — 백틱 ${BACKTICK_COUNT}개 (짝수)"
  ((PASS++))
else
  echo -e "  ${RED}❌ 실패${NC} — 백틱 ${BACKTICK_COUNT}개 (홀수, 짝이 안 맞음)"
  ((FAIL++))
fi
echo ""

# ── 4. onSnapshot에서 render() 직접 호출 검사 ──
echo "[ 4/6 ] 렌더링 안전성 (throttle 패턴)"

UNSAFE_RENDER=$(grep -n "onSnapshot" "$TARGET" 2>/dev/null | head -20)
DIRECT_RENDER_IN_SNAPSHOT=0
if [ -n "$UNSAFE_RENDER" ]; then
  # onSnapshot 콜백 근처(+5줄)에서 render() 직접 호출 확인
  while IFS= read -r line; do
    LINENUM=$(echo "$line" | cut -d: -f1)
    END=$((LINENUM + 8))
    CHUNK=$(sed -n "${LINENUM},${END}p" "$TARGET")
    if echo "$CHUNK" | grep -qP '[^d]render\(\)' 2>/dev/null; then
      if ! echo "$CHUNK" | grep -q 'throttledRender' 2>/dev/null; then
        DIRECT_RENDER_IN_SNAPSHOT=1
        echo -e "  ${RED}→ 라인 ${LINENUM} 근처: onSnapshot에서 render() 직접 호출${NC}"
      fi
    fi
  done <<< "$UNSAFE_RENDER"
fi

if [ "$DIRECT_RENDER_IN_SNAPSHOT" -eq 0 ]; then
  echo -e "  ${GREEN}✅ 통과${NC} — onSnapshot에서 throttledRender() 올바르게 사용 중"
  ((PASS++))
else
  echo -e "  ${RED}❌ 실패${NC} — onSnapshot 콜백에서 render() 직접 호출 발견"
  ((FAIL++))
fi
echo ""

# ── 5. lucide.createIcons() 호출 확인 ──
echo "[ 5/6 ] Lucide 아이콘 갱신 확인"

# 동적 DOM 삽입 함수에서 lucide.createIcons() 호출 여부
DYNAMIC_FUNCS=$(grep -n 'document\.body\.appendChild\|\.innerHTML\s*=' "$TARGET" 2>/dev/null | grep -v '^\s*//' | head -20)
LUCIDE_OK=1
MISSING_LUCIDE=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  LINENUM=$(echo "$line" | cut -d: -f1)
  # 해당 함수 블록 끝까지 확인 (대략 +30줄)
  END=$((LINENUM + 30))
  FUNC_BLOCK=$(sed -n "${LINENUM},${END}p" "$TARGET")
  if echo "$line" | grep -q 'appendChild' 2>/dev/null; then
    if ! echo "$FUNC_BLOCK" | grep -q 'lucide.createIcons\|lucide\.createIcons' 2>/dev/null; then
      MISSING_LUCIDE="$MISSING_LUCIDE $LINENUM"
      LUCIDE_OK=0
    fi
  fi
done <<< "$DYNAMIC_FUNCS"

if [ "$LUCIDE_OK" -eq 1 ]; then
  echo -e "  ${GREEN}✅ 통과${NC} — appendChild 후 lucide.createIcons() 호출 확인됨"
  ((PASS++))
else
  echo -e "  ${YELLOW}⚠️ 경고${NC} — appendChild 후 lucide.createIcons() 누락 가능 (라인:${MISSING_LUCIDE})"
  ((WARN++))
fi
echo ""

# ── 6. Firestore 필드 일관성 (save vs open 비교) ──
echo "[ 6/6 ] Firestore 필드 일관성"

SAVE_FIELDS=$(grep -A 30 'function saveEditPanel' "$TARGET" 2>/dev/null | grep -oP "[a-zA-Z]+(?=\s*:)" | sort -u)
SAVE_CRM_FIELDS=$(grep -A 30 'function saveCRMCustomer' "$TARGET" 2>/dev/null | grep -oP "[a-zA-Z]+(?=\s*[:,])" | sort -u)

if [ -n "$SAVE_FIELDS" ] && [ -n "$SAVE_CRM_FIELDS" ]; then
  # saveEditPanel에는 있는데 saveCRMCustomer에는 없는 필드 (또는 그 반대) 감지
  DIFF=$(comm -23 <(echo "$SAVE_CRM_FIELDS") <(echo "$SAVE_FIELDS") | grep -v -E '^(newNo|dateObj|yearStr|monthStr|no|createdAt|const|let|var|try|catch|if|return|await|function|db|doc|collection|addDoc|updateDoc|serverTimestamp|getDoc|setDoc|deleteDoc|query|orderBy|onSnapshot|where|getDocs)$' || true)
  if [ -z "$DIFF" ]; then
    echo -e "  ${GREEN}✅ 통과${NC} — 등록/수정 함수의 필드가 일치합니다."
    ((PASS++))
  else
    echo -e "  ${YELLOW}⚠️ 경고${NC} — 등록에는 있지만 수정에 없는 필드:"
    for f in $DIFF; do
      echo -e "    ${YELLOW}→ $f${NC}"
    done
    ((WARN++))
  fi
else
  echo -e "  ${YELLOW}⚠️ 경고${NC} — save 함수를 찾을 수 없어 비교 생략"
  ((WARN++))
fi
echo ""

# ── 결과 요약 ──
echo "========================================"
echo " 검증 결과 요약"
echo "========================================"
echo -e "  ${GREEN}✅ 통과: ${PASS}${NC}"
echo -e "  ${RED}❌ 실패: ${FAIL}${NC}"
echo -e "  ${YELLOW}⚠️ 경고: ${WARN}${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}▶ 전체 통과 — 커밋 가능합니다.${NC}"
  exit 0
else
  echo -e "${RED}▶ 실패 항목이 있습니다. 수정 후 다시 검증하세요.${NC}"
  exit 1
fi
