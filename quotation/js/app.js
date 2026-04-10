// --- 2. 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    localStorage.removeItem(STORAGE_KEY);
    initDate();
    initRegions();
    initDefaultRows();
    setupAutoSave();
    switchTab(1);
    applyBranchFromURL();
});

// 통합관리 시스템에서 전달받은 지사명 + 담당자 자동 선택
function applyBranchFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const branch = params.get('branch');
        const manager = params.get('manager');
        const managersRaw = params.get('managers');
        const typesRaw = params.get('types');
        if (!branch) return;

        // 전체 담당자 목록으로 드롭다운 재구성
        let allManagers = {};
        let allTypes = {};
        try { if (managersRaw) allManagers = JSON.parse(managersRaw); } catch(e) {}
        try { if (typesRaw) allTypes = JSON.parse(typesRaw); } catch(e) {}

        // 1. 지사 선택
        const sel = document.getElementById('branch-select');
        if (sel) {
            const options = Array.from(sel.options);
            const match = options.find(opt => opt.value === branch);
            if (match) {
                sel.value = branch;
                handleBranchChange();
            } else {
                const directOpt = options.find(opt => opt.value === '직접입력');
                if (directOpt) {
                    sel.value = '직접입력';
                    handleBranchChange();
                    const inp = document.getElementById('branch-input');
                    if (inp) inp.value = branch;
                }
            }
        }

        // 2. 담당자 드롭다운을 등록된 담당자 목록으로 교체
        const hSel = document.getElementById('handler-select');
        if (hSel && Object.keys(allManagers).length > 0) {
            let newOpts = '<option value="">담당자 선택</option>';
            Object.entries(allManagers).forEach(([branchName, managerName]) => {
                // 본사(hq) 제외, 지사/대리점 담당자만 표시
                if (allTypes[branchName] !== 'hq' && managerName) {
                    const fullName = branchName + ' ' + managerName;
                    newOpts += '<option value="' + fullName + '">' + fullName + '</option>';
                }
            });
            newOpts += '<option value="직접 입력">직접 입력</option>';
            hSel.innerHTML = newOpts;
        }

        // 3. 현재 로그인한 지사의 담당자 자동 선택
        if (hSel && manager) {
            const fullName = branch + ' ' + manager;
            const match = Array.from(hSel.options).find(opt => opt.value === fullName);
            if (match) {
                hSel.value = fullName;
            } else {
                // 드롭다운에 없으면 옵션 추가 후 선택
                const opt = document.createElement('option');
                opt.value = fullName;
                opt.text = fullName;
                hSel.insertBefore(opt, hSel.lastElementChild); // '직접 입력' 앞에 추가
                hSel.value = fullName;
            }
            handleHandlerChange();

            // 4. 지사 로그인이면 담당자 변경 불가 (잠금)
            const userType = allTypes[branch] || '';
            if (userType === 'branch' || userType === 'dealer') {
                hSel.disabled = true;
                hSel.style.opacity = '0.7';
                hSel.style.cursor = 'not-allowed';
                // 지사 선택도 잠금
                if (sel) {
                    sel.disabled = true;
                    sel.style.opacity = '0.7';
                    sel.style.cursor = 'not-allowed';
                }
            }
        }
    } catch(e) { console.log('Branch auto-select:', e); }
}

/* [v1.8] 실시간 날짜: YYYY. MM. DD. 형식 */
function initDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const formatted = `${yyyy}. ${mm}. ${dd}.`;
    document.getElementById('view-date-1').textContent = formatted;
    document.getElementById('view-date-2').textContent = formatted;
}

function initRegions() {
    const doSelect = document.getElementById('region-do');
    let opts = '<option value="">시/도 선택</option>';
    Object.keys(regions).forEach(r => opts += `<option value="${r}">${r}</option>`);
    doSelect.innerHTML = opts;
    doSelect.addEventListener('change', function () {
        const siSelect = document.getElementById('region-si');
        const val = this.value;
        if (val && regions[val]) {
            let sOpts = '<option value="">시/군/구 선택</option>';
            regions[val].forEach(s => sOpts += `<option value="${s}">${s}</option>`);
            siSelect.innerHTML = sOpts;
            siSelect.disabled = false;
        } else {
            siSelect.innerHTML = '<option value="">시/군/구</option>';
            siSelect.disabled = true;
        }
        updateRegionBasedCosts(val);
        saveData();
    });
}

function initDefaultRows() {
    addRow();
    addConsRow({ cat: "간접 공사비", name: "출장비", spec: "출장경비", price: 0 });
    addConsRow({ cat: "자재 반입비", name: "운임", spec: "화물비", price: 0 });
    addConsRow({ cat: "자재 반입비", name: "양중비", spec: "사다리차/스카이", price: 300000 });
    addConsRow({ cat: "간접 공사비", name: "공과잡비", spec: "기타 경비", isPercent: true });
    addConsRow({ cat: "간접 공사비", name: "감리비", spec: "기타 경비", isPercent: true });
}

function formatPhoneNumber(el) {
    let val = el.value.replace(/[^0-9]/g, '');
    let res = '';
    if (val.length < 4) res = val;
    else if (val.length < 7) res = val.substr(0, 3) + '-' + val.substr(3);
    else if (val.length < 11) res = val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
    else res = val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7);
    el.value = res;

    // [v1.8] 실시간 허위 번호 체크
    validatePhoneNumber(val);
}

/* [v1.8] 허위 연락처 패턴 체크 로직 */
function validatePhoneNumber(digits) {
    const warnEl = document.getElementById('phone-warn');
    if (digits.length < 10) { warnEl.classList.add('hidden'); return; }

    let isFake = false;
    // 1. 0으로 시작하지 않는 경우 (예: 123-...)
    if (!digits.startsWith('0')) isFake = true;

    // 2. 뒷자리가 모두 같은 경우 (예: 0000, 1111)
    const last4 = digits.slice(-4);
    const last7 = digits.slice(-7);
    if (last4.length === 4 && /^(\d)\1+$/.test(last4)) isFake = true;
    if (last7.length >= 7 && /^(\d)\1+$/.test(last7)) isFake = true;

    // 3. 연속된 숫자인 경우 (예: 1234, 5678)
    const sequentialPatterns = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '5432', '4321'];
    if (sequentialPatterns.some(p => digits.includes(p))) isFake = true;

    // 4. 특정 허위 패턴 (2580 등)
    if (digits.includes('2580')) isFake = true;

    if (isFake) warnEl.classList.remove('hidden');
    else warnEl.classList.add('hidden');
}

function switchTab(num) {
    const p1 = document.getElementById('page-1');
    const p2 = document.getElementById('page-2');
    const b1 = document.getElementById('nav-btn-1');
    const b2 = document.getElementById('nav-btn-2');
    const footerP1 = document.getElementById('footer-page-1');
    const footerP2 = document.getElementById('footer-page-2');

    if (num === 2) {
        const bSel = document.getElementById('branch-select');
        const bVal = bSel.value;
        const bInp = document.getElementById('branch-input').value.trim();
        if (!bVal || (bVal === '직접입력' && !bInp)) { alert("지사를 선택하거나 기입해주세요."); bSel.focus(); return; }
        const hSel = document.getElementById('handler-select');
        const hVal = hSel.value;
        const hInp = document.getElementById('handler-input').value.trim();
        if (!hVal || (hVal === '직접 입력' && !hInp)) { alert("담당자를 선택하거나 기입해주세요."); hSel.focus(); return; }
        const phone = document.getElementById('cust-phone').value.trim();
        const regionDo = document.getElementById('region-do').value;
        const regionSi = document.getElementById('region-si').value;
        if (!phone) { alert("연락처는 필수 입력 항목입니다."); document.getElementById('cust-phone').focus(); return; }
        if (!regionDo || !regionSi || regionSi === "시/군/구 선택") { alert("설치 현장 주소는 필수 선택 항목입니다."); document.getElementById('region-do').focus(); return; }

        // 가짜 번호 경고가 떠있는 상태에서 진행 시 최종 확인
        const warnEl = document.getElementById('phone-warn');
        if (!warnEl.classList.contains('hidden')) {
            if (!confirm("입력하신 연락처가 허위 번호 패턴과 일치합니다. 그대로 진행하시겠습니까?")) {
                document.getElementById('cust-phone').focus();
                return;
            }
        }
        syncCustomerInfo();
    }

    if (num === 1) {
        p1.classList.remove('hidden'); p2.classList.add('hidden');
        b1.className = "flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-bold shadow-sm bg-white text-gray-900 transition-all";
        b2.className = "flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 transition-all";
        footerP1.classList.remove('hidden'); footerP1.classList.add('flex'); footerP2.classList.add('hidden'); footerP2.classList.remove('flex');
    } else {
        p1.classList.add('hidden'); p2.classList.remove('hidden');
        b2.className = "flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-bold shadow-sm bg-white text-gray-900 transition-all";
        b1.className = "flex-1 md:flex-none px-6 py-2.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 transition-all";
        footerP1.classList.add('hidden'); footerP1.classList.remove('flex'); footerP2.classList.remove('hidden'); footerP2.classList.add('flex');
    }
    window.scrollTo(0, 0);
}

function handleBranchChange() {
    const sel = document.getElementById('branch-select');
    const inp = document.getElementById('branch-input');
    inp.classList.toggle('hidden', sel.value !== '직접입력');
    calcTotal(); saveData();
}

function handleHandlerChange() {
    const sel = document.getElementById('handler-select');
    const inp = document.getElementById('handler-input');
    inp.classList.toggle('hidden', sel.value !== '직접 입력');
    saveData();
}

function syncCustomerInfo() {
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const rDo = document.getElementById('region-do').value;
    const rSi = document.getElementById('region-si').value;
    const rDet = document.getElementById('cust-addr-detail').value;

    document.getElementById('est-cust-name').textContent = name || '고객님';
    document.getElementById('est-cust-phone').textContent = phone || '-';
    document.getElementById('est-cust-addr').textContent = `${rDo} ${rSi} ${rDet}`.trim() || '-';

    const bSel = document.getElementById('branch-select');
    const bInp = document.getElementById('branch-input');
    const branch = bSel.value === '직접입력' ? bInp.value : bSel.value;
    const hSel = document.getElementById('handler-select');
    const hInp = document.getElementById('handler-input');
    const handler = hSel.value === '직접 입력' ? hInp.value : hSel.value;

    let fullHandler = handler;
    if (branch && handler && !handler.includes(branch)) fullHandler = `${branch} ${handler}`;
    document.getElementById('est-handler').textContent = fullHandler || '-';

    const managerPhone = managerPhones[hSel.value];
    document.getElementById('est-supplier-phone').textContent = managerPhone ? `1800-5945 / ${managerPhone}` : "1800-5945";
}

function showWarningModal() { document.getElementById('discount-modal').classList.add('active'); }
function closeWarningModal() { document.getElementById('discount-modal').classList.remove('active'); }

// --- 4. 견적 계산 로직 ---
function formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function parseNum(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }

function addRow() {
    const tbody = document.getElementById('est-tbody');
    const tr = document.createElement('tr');
    let prodOpts = '<option value="">제품 선택</option>';
    productCategories.forEach(cat => {
        prodOpts += `<optgroup label="${cat.label}">`;
        cat.items.forEach(item => prodOpts += `<option value="${item}">${item}</option>`);
        prodOpts += `</optgroup>`;
    });
    tr.innerHTML = `
                <td><input type="tel" class="excel-input text-center" placeholder="No"></td>
                <td><select class="excel-input" onchange="handleProdChange(this)">${prodOpts}</select><input type="text" class="excel-input hidden" placeholder="직접 입력"></td>
                <td class="spec-cell"><input type="text" class="excel-input text-center" placeholder="규격"></td>
                <td><select class="excel-input text-center color-select" disabled onchange="calcRow(this)"><option value="">선택</option><option value="화이트">화이트</option><option value="차콜">차콜</option><option value="기타">기타(할증)</option></select></td>
                <td class="option-cell"><input type="text" class="excel-input" placeholder="옵션"></td>
                <td><input type="text" class="excel-input text-center" value="식"></td>
                <td><input type="tel" class="excel-input text-center qty" value="1" oninput="calcRow(this)"></td>
                <td><input type="tel" class="excel-input text-right price" placeholder="0" oninput="handleManualPrice(this)"></td>
                <td class="text-right px-2 font-medium"><span class="sum">0</span></td>
                <td class="text-center hidden-on-print"><button onclick="delRow(this)" class="text-gray-400 hover:text-red-500 font-bold px-2">×</button></td>
            `;
    tbody.appendChild(tr);
    saveData();
}

function handleProdChange(sel) {
    const tr = sel.closest('tr');
    const prodName = sel.value;
    const specCell = tr.querySelector('.spec-cell');
    const optionCell = tr.querySelector('.option-cell');
    const colorSelect = tr.querySelector('.color-select');
    colorSelect.disabled = false; colorSelect.value = '';
    const priceInput = tr.querySelector('.price');
    priceInput.value = '';
    priceInput.dataset.basePrice = 0;
    priceInput.dataset.manualOverride = '';
    // 잠금 아이콘 제거
    const lockIcon = priceInput.parentElement.querySelector('.lock-icon');
    if (lockIcon) lockIcon.remove();
    const customInput = sel.nextElementSibling;
    if (prodName === 'custom' || prodName === '직접 입력') { sel.classList.add('hidden'); customInput.classList.remove('hidden'); customInput.focus(); return; }

    /* [v1.8] 색상 할증 명시 */
    const otherOption = colorSelect.querySelector('option[value="기타"]');
    if (prodName.includes("OPERA")) otherOption.textContent = "기타";
    else if (prodName.includes("AIREA") || prodName.includes("ATHENA")) otherOption.textContent = "기타 (+10%)";
    else if (prodName.includes("STAY") || prodName.includes("Tone") || prodName.includes("Glass") || prodName.includes("Folding") || prodName.includes("LYRA")) otherOption.textContent = "기타 (+15%)";
    else { otherOption.textContent = "기타 (할증)"; colorSelect.disabled = true; }

    if (prodName.includes("STAY") || prodName.includes("Tone") || prodName.includes("AIREA") || prodName.includes("OPERA") || prodName.includes("ATHENA")) {
        let isAirea = prodName.includes("AIREA") || prodName.includes("OPERA") || prodName.includes("ATHENA");
        let pivots = isAirea ? aireaPivots : (prodName.includes("수동") ? stayPivots.manual : stayPivots.electric);
        let pOpts = pivots.map(p => `<option value="${p}">${p}</option>`).join('');
        /* [v1.8] 높이(H) 할증: ATHENA 제외, 파고라 제품군(STAY, Tone, AIREA, OPERA)에 높이 옵션 제공 */
        let heightHtml = prodName.includes("ATHENA") ? '' : `<div class="flex items-center gap-1 mt-1"><span class="text-xs text-gray-500 w-8">H</span><select class="excel-input bg-gray-50 height-select" onchange="calcPergola(this)"><option value="3000">3000이하</option><option value="6000">6000이하(+100만)</option></select></div>`;
        specCell.innerHTML = `<div class="flex flex-col gap-1"><div class="flex items-center gap-1"><span class="text-xs text-gray-500 w-8">Span</span><input type="tel" class="excel-input bg-gray-50 span-input" placeholder="mm" oninput="calcPergola(this)"></div><div class="flex items-center gap-1"><span class="text-xs text-gray-500 w-8">Pivot</span><select class="excel-input bg-gray-50 pivot-select" onchange="calcPergola(this)"><option value="">선택</option>${pOpts}</select></div>${heightHtml}</div>`;
        let ledOpts = isAirea ? `<label class="chk-wrap py-0"><input type="checkbox" class="opt-dual" onchange="calcRow(this)"> 듀얼라인등</label><label class="chk-wrap py-0"><input type="checkbox" class="opt-blade" onchange="calcRow(this)"> 블레이드</label>` : `<label class="chk-wrap py-0"><input type="checkbox" class="opt-led" onchange="calcRow(this)"> 싱글라인등</label>`;
        optionCell.innerHTML = `<div class="flex flex-col gap-1 text-xs">${ledOpts}<div class="flex items-center gap-1"><label class="chk-wrap py-0"><input type="checkbox" onchange="togglePillar(this)"> 기둥추가</label><input type="tel" class="excel-input w-12 text-center bg-gray-50 opt-pillar" disabled placeholder="0" oninput="calcRow(this)"></div></div>`;
    } else if (prodName === "Solar Panel") { specCell.innerHTML = '<input type="text" class="excel-input text-center" value="180*1000" readonly>'; optionCell.innerHTML = ''; }
    else if (prodName === "Solar Inverter") { specCell.innerHTML = '<input type="text" class="excel-input text-center" value="자재시공일체" readonly>'; optionCell.innerHTML = ''; }
    else if (prodName === "Glass Sliding") { specCell.innerHTML = `<select class="excel-input text-center" onchange="calcRow(this)"><option value="2500">~2500mm</option><option value="2800">~2800mm</option></select>`; optionCell.innerHTML = `<input type="text" class="excel-input text-gray-500" value="시공비 일체" readonly>`; }
    else if (prodName === "Glass Folding") { specCell.innerHTML = `<input type="text" class="excel-input text-center" value="H ~2500mm" readonly>`; optionCell.innerHTML = `<input type="text" class="excel-input text-gray-500" value="시공비 별도" readonly>`; }
    else if (prodName.includes("Basic Folding")) { specCell.innerHTML = `<input type="text" class="excel-input text-center" value="H ~2500mm" readonly>`; optionCell.innerHTML = `<input type="text" class="excel-input" value="시공비 별도" readonly>`; }
    else if (prodName.includes("Fix Glass") || prodName.includes("Glass Door")) { specCell.innerHTML = '<input type="text" class="excel-input text-center" placeholder="규격 입력">'; optionCell.innerHTML = '<input type="text" class="excel-input text-gray-500" value="시공비 별도" readonly>'; }
    else if (prodName.includes("Stone Deck")) { specCell.innerHTML = '<input type="text" class="excel-input text-center" value="min 30m2" readonly>'; optionCell.innerHTML = ''; }
    else { specCell.innerHTML = `<input type="text" class="excel-input text-center" placeholder="규격">`; optionCell.innerHTML = `<input type="text" class="excel-input" placeholder="옵션">`; }
    calcRow(sel);
}

function togglePillar(chk) {
    const inp = chk.closest('.option-cell').querySelector('.opt-pillar');
    inp.disabled = !chk.checked; if (!chk.checked) inp.value = '';
    calcRow(chk);
}

function calculatePergolaPrice(model, type, span, pivotVal) {
    let sIdx = -1;
    if (span <= 1000) sIdx = 0; else if (span <= 1500) sIdx = 1; else if (span <= 2000) sIdx = 2; else if (span <= 2500) sIdx = 3; else if (span <= 3000) sIdx = 4; else if (span <= 3500) sIdx = 5; else if (span <= 4000) sIdx = 6;
    if (sIdx === -1) return 0;
    let pIdx = -1;
    if (model.includes('AIREA') || model.includes('OPERA') || model.includes('ATHENA')) {
        pIdx = aireaPivots.indexOf(parseInt(pivotVal)); if (pIdx === -1) return 0;
        let base, sStep, pStep, k;
        if (model.includes('AIREA') || model.includes('ATHENA')) {
            if (type === 'solar') { base = 10340000; sStep = 660000; pStep = 220000; k = 55000; }
            else { base = 9400000; sStep = 600000; pStep = 200000; k = 50000; }
        } else {
            if (type === 'solar') { base = 15180000; sStep = 660000; pStep = 440000; k = 55000; }
            else { base = 13800000; sStep = 600000; pStep = 400000; k = 50000; }
        }
        return base + (sIdx * sStep) + (pIdx * pStep) + (sIdx * pIdx * k);
    } else {
        const pivotList = type === 'manual' ? stayPivots.manual : stayPivots.electric;
        pIdx = pivotList.indexOf(parseInt(pivotVal)); if (pIdx === -1) return 0;
        let basePrice = model.includes('STAY') ? (type === 'manual' ? 4100000 : 4600000) : (type === 'manual' ? 7600000 : 8100000);
        return basePrice + (pIdx * 100000) + (sIdx * 300000);
    }
}

function calcPergola(el) {
    const tr = el.closest('tr');
    const prodName = tr.querySelector('td:nth-child(2) select').value;
    const span = parseInt(tr.querySelector('.span-input')?.value) || 0;
    const pivot = parseInt(tr.querySelector('.pivot-select')?.value) || 0;
    /* [v1.8] 높이 할증: .height-select 로 클래스명 명확화 */
    const heightSelect = tr.querySelector('.height-select');
    const heightPlus = heightSelect ? heightSelect.value === '6000' : false;
    if (span > 0 && pivot > 0) {
        let type = prodName.includes('전동') ? 'electric' : (prodName.includes('Solar') ? 'solar' : 'manual');
        let base = calculatePergolaPrice(prodName, type, span, pivot);
        if (heightPlus) base += 1000000;
        tr.querySelector('.price').dataset.basePrice = base;
        calcRow(el);
    }
}

function calcRow(el) {
    const tr = el.closest('tr');
    const prodName = tr.querySelector('td:nth-child(2) select').value;
    const priceInput = tr.querySelector('.price');

    // [특수견적] 수동 단가 고정 모드: 사용자가 직접 입력한 단가를 유지
    if (priceInput.dataset.manualOverride === "true") {
        const manualPrice = parseFloat(priceInput.dataset.manualPrice) || parseNum(priceInput.value);
        priceInput.value = manualPrice || '';
        tr.querySelector('.sum').textContent = formatNumber(manualPrice * parseNum(tr.querySelector('.qty').value));
        syncDirectCosts(); calcTotal(); saveData();
        return;
    }

    let base = parseFloat(priceInput.dataset.basePrice) || 0;

    if (prodName === "Solar Panel") base = 60000;
    else if (prodName === "Solar Inverter") base = 2000000;
    else if (prodName === "Glass Sliding") base = tr.querySelector('.spec-cell select')?.value === '2800' ? 700000 : 600000;
    else if (prodName === "Glass Folding") base = 450000;
    else if (prodName.includes("Basic Folding")) base = prodName.includes("단열") ? 550000 : 350000;
    else if (prodName.includes("Glass Door")) base = 800000;
    else if (prodName.includes("Fix Glass")) base = prodName.includes("단열") ? 300000 : 170000;
    else if (prodName.includes("Stone Deck")) base = prodName.includes("각관") ? 200000 : 150000;

    let addon = 0;
    if (tr.querySelector('.opt-led')?.checked) addon += prodName.includes('수동') ? 1000000 : 500000;
    if (tr.querySelector('.opt-dual')?.checked) addon += 1000000;
    if (tr.querySelector('.opt-blade')?.checked) addon += 1000000;
    if (tr.querySelector('.opt-pillar')?.value) addon += (parseInt(tr.querySelector('.opt-pillar').value) || 0) * 500000;
    const color = tr.querySelector('.color-select').value;
    if (color === '기타') base = Math.round(base * (prodName.includes("AIREA") || prodName.includes("ATHENA") ? 1.1 : 1.15));

    priceInput.value = (base + addon) > 0 ? (base + addon) : '';
    tr.querySelector('.sum').textContent = formatNumber((base + addon) * parseNum(tr.querySelector('.qty').value));
    syncDirectCosts(); calcTotal(); saveData();
}

function handleManualPrice(inp) {
    const rawVal = parseNum(inp.value);
    inp.dataset.manualOverride = "true";
    inp.dataset.manualPrice = rawVal;
    // 수동 입력 시 잠금 아이콘 표시
    showPriceLock(inp);
    // 수동 모드에서는 직접 합계만 갱신
    const tr = inp.closest('tr');
    const qty = parseNum(tr.querySelector('.qty').value);
    tr.querySelector('.sum').textContent = formatNumber(rawVal * qty);
    syncDirectCosts(); calcTotal(); saveData();
}

function showPriceLock(inp) {
    let lockIcon = inp.parentElement.querySelector('.lock-icon');
    if (!lockIcon) {
        lockIcon = document.createElement('span');
        lockIcon.className = 'lock-icon';
        lockIcon.title = '수동 단가 (클릭시 자동 계산으로 복원)';
        lockIcon.style.cssText = 'position:absolute;top:2px;right:4px;cursor:pointer;font-size:10px;color:#2563eb;z-index:1;';
        lockIcon.textContent = '🔒';
        lockIcon.onclick = function(e) {
            e.stopPropagation();
            inp.dataset.manualOverride = "";
            inp.dataset.manualPrice = "";
            inp.dataset.basePrice = 0;
            lockIcon.remove();
            calcRow(inp);
        };
        inp.parentElement.style.position = 'relative';
        inp.parentElement.appendChild(lockIcon);
    }
}

function addConsRow(item = {}) {
    const tbody = document.getElementById('cons-tbody');
    const tr = document.createElement('tr');
    const isPercent = item.isPercent || false;
    /* [v1.9] readonly 속성 기본 제거로 시공 및 기타 부대비용 전면 편집 권한 허용 */
    tr.innerHTML = `
                <td><input type="text" class="excel-input text-center" value="${item.cat || ''}" placeholder="구분"></td>
                <td>${item.isProductSelect ? `<select class="excel-input cons-prod-select" onchange="setConsPrice(this)"><option value="">선택</option>${Object.keys(constructionPricesMap).map(k => `<option value="${k}">${k}</option>`).join('')}</select>` : `<input type="text" class="excel-input" value="${item.name || ''}" placeholder="항목명">`}</td>
                <td><input type="text" class="excel-input" value="${item.spec || ''}" placeholder="상세"></td>
                <td><input type="text" class="excel-input text-center" value="식"></td>
                <td><input type="tel" class="excel-input text-center c-qty" value="1" oninput="markAsEdited(this); calcCons(this)"></td>
                <td><input type="tel" class="excel-input text-right c-price" value="${item.price || 0}" oninput="markAsEdited(this); calcCons(this)"></td>
                <td class="text-right px-2"><span class="c-sum">0</span></td>
                <td class="text-center hidden-on-print"><button onclick="delRow(this)" class="text-gray-400 hover:text-red-500 font-bold px-2">×</button></td>
            `;
    tbody.appendChild(tr);
    if (item.price || isPercent) calcCons(tr.querySelector('.c-qty'));
}

function markAsEdited(el) {
    const tr = el.closest('tr');
    tr.dataset.userEdited = "true";
}

/* [v1.8] 직접공사비(인건비) 항목은 테이블 최상단(Prepend)에 위치 */
function addDirectConsRow() {
    const tbody = document.getElementById('cons-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
                <td><input type="text" class="excel-input text-center" value="직접 공사비" placeholder="구분"></td>
                <td><select class="excel-input cons-prod-select" onchange="setConsPrice(this)"><option value="">선택</option>${Object.keys(constructionPricesMap).map(k => `<option value="${k}">${k}</option>`).join('')}</select></td>
                <td><input type="text" class="excel-input" value="인건비/부자재" placeholder="상세"></td>
                <td><input type="text" class="excel-input text-center" value="식"></td>
                <td><input type="tel" class="excel-input text-center c-qty" value="1" oninput="calcCons(this)"></td>
                <td><input type="tel" class="excel-input text-right c-price" value="0" oninput="calcCons(this)"></td>
                <td class="text-right px-2"><span class="c-sum">0</span></td>
                <td class="text-center hidden-on-print"><button onclick="delRow(this)" class="text-gray-400 hover:text-red-500 font-bold px-2">×</button></td>
            `;
    /* Prepend: 항상 최상단 */
    tbody.insertBefore(tr, tbody.firstChild);
}

function addMaterialTransportRow() { addConsRow({ cat: '자재 반입비', name: '운임/양중비' }); }
function addIndirectConsRow() { addConsRow({ cat: '간접 공사비', name: '공과잡비', isPercent: true }); }

function setConsPrice(sel) {
    const tr = sel.closest('tr');
    tr.querySelector('.c-price').value = constructionPricesMap[sel.value] || 0;
    tr.querySelector('td:nth-child(3) input').value = '인건비/부자재';
    calcCons(sel);
}

function calcCons(el) {
    const tr = el.closest('tr');
    tr.querySelector('.c-sum').textContent = formatNumber(parseNum(tr.querySelector('.c-qty').value) * parseNum(tr.querySelector('.c-price').value));
    calcTotal();
}

function syncDirectCosts() {
    const counts = {};
    document.querySelectorAll('#est-tbody tr').forEach(r => {
        const prod = r.querySelector('td:nth-child(2) select').value;
        const qty = parseNum(r.querySelector('.qty').value);
        for (const k in constructionPricesMap) if (prod.includes(k)) { counts[k] = (counts[k] || 0) + qty; break; }
    });
    const consRows = document.querySelectorAll('#cons-tbody tr');
    const usedKeys = new Set();
    consRows.forEach(r => {
        const sel = r.querySelector('.cons-prod-select');
        if (sel && sel.value) {
            if (counts[sel.value]) {
                // 사용자가 수동 편집한 행은 수량 자동변경 안함
                if (!r.dataset.userEdited) r.querySelector('.c-qty').value = counts[sel.value];
                calcCons(sel); usedKeys.add(sel.value);
            } else r.remove();
        }
    });
    // 사용자가 수동 삭제한 항목은 자동 재생성하지 않음
    for (const k in counts) if (!usedKeys.has(k) && !deletedDirectCostKeys.has(k)) { addDirectConsRow(); const rows = document.querySelectorAll('#cons-tbody tr'); const target = rows[0]; target.querySelector('.cons-prod-select').value = k; target.querySelector('.c-qty').value = counts[k]; setConsPrice(target.querySelector('.cons-prod-select')); }
}

/* [v1.8] 지역별 비용 보정: '전북특별자치도' 포함하여 전라도 권역 강화 */
function updateRegionBasedCosts(region) {
    let freight = 300000, travel = 0;
    if (region.includes('제주')) { freight = 1800000; }
    else if (['경상', '부산', '대구', '울산', '전라', '전북', '광주', '강원'].some(k => region.includes(k))) { freight = 500000; }
    else if (['충청', '대전', '세종'].some(k => region.includes(k))) { freight = 400000; }
    if (['경상', '부산', '대구', '울산', '전라', '전북', '광주', '강원', '제주'].some(k => region.includes(k))) { travel = 500000; }
    else if (['충청', '대전', '세종'].some(k => region.includes(k))) { travel = 400000; }

    /* [v1.9] 운임(화물비) 산정 로직 고도화:
       - 파고라(STAY, Tone, AIREA, OPERA, ATHENA): 수량 합산 후 2동당 1회
       - 기타 품목(Glass, Deck, LYRA 등): 수량 관계없이 항목(행) 추가될 때마다 1회씩 합산
    */
    let pergolaQty = 0;
    let otherItemCount = 0;
    const pergolaKeywords = ["STAY", "Tone", "AIREA", "OPERA", "ATHENA"];

    document.querySelectorAll('#est-tbody tr').forEach(r => {
        const prodSel = r.querySelector('td:nth-child(2) select');
        const qtyVal = parseNum(r.querySelector('.qty')?.value);
        if (prodSel && qtyVal > 0) {
            const prodName = prodSel.value;
            const isPergola = pergolaKeywords.some(k => prodName.includes(k));
            if (isPergola) {
                pergolaQty += qtyVal;
            } else if (prodName !== "") {
                // 기타 품목은 항목(행) 개수로 카운트
                otherItemCount += 1;
            }
        }
    });

    // 파고라: 2동당 1회 (올림)
    const pergolaFreightCount = Math.ceil(pergolaQty / 2);
    // 총 운임 횟수 = 파고라 운임 횟수 + 기타 품목 항목 수 (최소 1회 보장)
    const freightQty = Math.max(1, pergolaFreightCount + otherItemCount);

    document.querySelectorAll('#cons-tbody tr').forEach(r => {
        const name = r.querySelector('td:nth-child(2) input')?.value.trim();
        // [v1.9] 운임 수량을 자동화하되, 사용자가 이미 직접 편집한 경우(dataset check) 건너뜁니다
        if (name === '운임' && r.dataset.userEdited !== "true") {
            r.querySelector('.c-price').value = freight;
            r.querySelector('.c-qty').value = freightQty;
            calcCons(r.querySelector('.c-price'));
        }
        if (name === '출장비' && r.dataset.userEdited !== "true") {
            r.querySelector('.c-price').value = travel;
            calcCons(r.querySelector('.c-price'));
        }
    });
}

/* [CRITICAL FIX] 무한 루프 재귀 오류 해결 */
function calcTotal() {
    let prodSum = 0;
    document.querySelectorAll('#est-tbody tr').forEach(tr => prodSum += parseNum(tr.querySelector('.sum').textContent));

    /* [v1.9] 운임 실시간 산정 고도화: 제품 추가/변경 시마다運임 수량을 동적으로 재계산 (수동 편집이 없을 때만 반영) */
    let pergolaQty = 0;
    let otherItemCount = 0;
    const pergolaKeywords = ["STAY", "Tone", "AIREA", "OPERA", "ATHENA"];

    document.querySelectorAll('#est-tbody tr').forEach(r => {
        const prodSel = r.querySelector('td:nth-child(2) select');
        const qtyVal = parseNum(r.querySelector('.qty')?.value);
        if (prodSel && qtyVal > 0) {
            const prodName = prodSel.value;
            const isPergola = pergolaKeywords.some(k => prodName.includes(k));
            if (isPergola) {
                pergolaQty += qtyVal;
            } else if (prodName !== "" && prodName !== "직접 입력" && prodName !== "custom") {
                // 직접입력 등 단순 텍스트 박스로 넘어간 경우는 제외하거나, 기타로 간주 (여기선 제외)
                otherItemCount += 1;
            }
        }
    });

    // 최소 기본 1배차 보장, 파고라 2동당 1 + 기타품목 행 개수당 1
    const freightQty = Math.max(1, Math.ceil(pergolaQty / 2) + otherItemCount);

    document.querySelectorAll('#cons-tbody tr').forEach(r => {
        const name = r.querySelector('td:nth-child(2) input')?.value.trim();
        if (name === '운임') {
            const qtyInp = r.querySelector('.c-qty');
            const priceInp = r.querySelector('.c-price');

            // 사용자가 직접 수정한 적이 없다면 자동화된 수량(freightQty)을 반영
            if (r.dataset.userEdited !== "true") {
                qtyInp.value = freightQty;
            }

            const manualQty = parseNum(qtyInp.value);
            const manualPrice = parseNum(priceInp.value);
            r.querySelector('.c-sum').textContent = formatNumber(manualQty * manualPrice);
        }
    });

    // [v1.9] 간접 공사비 수동 편의성 개방: 
    // 1) 처음 빈 값(또는 0, 기본 세팅 상태)일 때만 자동 계산 (제품 합계의 5%)
    // 2) 데이터 속성에 자동계산 이력을 플래그로 두어 수동 변경값을 보존
    document.querySelectorAll('#cons-tbody tr').forEach(r => {
        const nameInp = r.querySelector('td:nth-child(2) input');
        const name = nameInp?.value.trim();
        if (name === '공과잡비' || name === '감리비') {
            const qtyInp = r.querySelector('.c-qty');
            const priceInp = r.querySelector('.c-price');

            // 수동 입력 기능을 위해 readonly 해제
            if (qtyInp.hasAttribute('readonly')) qtyInp.removeAttribute('readonly');
            if (priceInp.hasAttribute('readonly')) priceInp.removeAttribute('readonly');

            // 사용자가 직접 변경한 값인지 확인하는 로직 (간단한 구현을 위해 값이 수정되었는지를 추적)
            if (r.dataset.userEdited !== "true") {
                const autoPrice = Math.round(prodSum * 0.05);
                priceInp.value = autoPrice;

                // 사용자가 수정한 경우에는 변경되지 않도록 하기 위해 input에 이벤트 추가
                priceInp.addEventListener('input', () => { r.dataset.userEdited = "true"; }, { once: true });
                qtyInp.addEventListener('input', () => { r.dataset.userEdited = "true"; }, { once: true });
            }

            const qty = parseNum(qtyInp.value);
            const price = parseNum(priceInp.value);
            r.querySelector('.c-sum').textContent = formatNumber(price * qty);
        }
    });

    let consSum = 0;
    document.querySelectorAll('#cons-tbody .c-sum').forEach(s => consSum += parseNum(s.textContent));

    const supply = prodSum + consSum, discount = parseNum(document.getElementById('val-discount').value), tax = Math.round((supply - discount) * 0.1);
    document.getElementById('val-prod-sum').textContent = formatNumber(prodSum);
    document.getElementById('val-cons-sum').textContent = formatNumber(consSum);
    document.getElementById('val-supply').textContent = formatNumber(supply);
    document.getElementById('val-tax').textContent = formatNumber(tax);
    document.getElementById('val-total').textContent = formatNumber(supply - discount + tax);
    saveData();
}

function formatDiscount(el) {
    let val = el.value.replace(/,/g, '');
    if (document.getElementById('branch-select').value === '본사' && (parseFloat(val) || 0) > 0 && !discountWarningShown) { showWarningModal(); discountWarningShown = true; }
    else if ((parseFloat(val) || 0) === 0) discountWarningShown = false;
    el.value = !isNaN(val) && val !== '' ? Number(val).toLocaleString() : val;
    calcTotal();
}

// 사용자가 수동 삭제한 직접공사비 추적
let deletedDirectCostKeys = new Set();

function delRow(btn) {
    const tr = btn.closest('tr');
    // 직접공사비(cons-prod-select) 행 삭제 시 추적
    const sel = tr.querySelector('.cons-prod-select');
    if (sel && sel.value) deletedDirectCostKeys.add(sel.value);
    tr.remove();
    syncDirectCosts(); calcTotal();
}
function setupAutoSave() { document.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('input', () => { clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(saveData, 1000); })); }
function saveData(manual = false) { const inputs = {}; document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => inputs[el.id] = el.value); localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); }
function resetData() { if (confirm("모든 데이터를 초기화하시겠습니까?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } }

/* [v1.8] PDF 저장: 파일명 규칙 OSQ_지역_고객명_연락처.pdf + cloneNode 값 캡처 강화 */
async function saveAsPDF() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden'); overlay.classList.add('flex');
    try {
        const hidden = document.getElementById('pdf-hidden-container');
        hidden.innerHTML = '';

        /* [v1.8] PDF 렌더링 강화: cloneNode 전에 select/textarea 값을 실시간 캡처하여 주입 */
        // 1단계: 원본 DOM에서 select의 선택값과 textarea 값을 attribute로 기록
        document.querySelectorAll('#capture-area-1 select, #capture-area-2 select').forEach(sel => {
            sel.setAttribute('data-pdf-value', sel.value);
            const selectedIdx = sel.selectedIndex;
            Array.from(sel.options).forEach((opt, i) => {
                if (i === selectedIdx) opt.setAttribute('selected', 'selected');
                else opt.removeAttribute('selected');
            });
        });
        document.querySelectorAll('#capture-area-1 textarea, #capture-area-2 textarea').forEach(ta => {
            ta.setAttribute('data-pdf-value', ta.value);
            ta.textContent = ta.value;
        });
        document.querySelectorAll('#capture-area-1 input, #capture-area-2 input').forEach(inp => {
            if (inp.type === 'checkbox') {
                if (inp.checked) inp.setAttribute('checked', 'checked');
                else inp.removeAttribute('checked');
            } else {
                inp.setAttribute('value', inp.value);
            }
        });

        const clone1 = document.getElementById('capture-area-1').cloneNode(true);
        const clone2 = document.getElementById('capture-area-2').cloneNode(true);

        const processClone = (node) => {
            // select 값 복원 후 span 치환
            node.querySelectorAll('select').forEach(sel => {
                const val = sel.getAttribute('data-pdf-value') || '';
                const selectedOpt = Array.from(sel.options).find(o => o.value === val);
                const span = document.createElement('span');
                span.textContent = selectedOpt ? selectedOpt.text : val;
                sel.parentNode.replaceChild(span, sel);
            });
            node.querySelectorAll('textarea').forEach(ta => {
                const span = document.createElement('span');
                span.textContent = ta.getAttribute('data-pdf-value') || ta.value;
                span.style.whiteSpace = 'pre-wrap';
                span.style.display = 'block';
                ta.parentNode.replaceChild(span, ta);
            });
            node.querySelectorAll('input').forEach(inp => {
                const span = document.createElement('span');
                if (inp.type === 'checkbox') {
                    span.innerHTML = inp.hasAttribute('checked') ? '&#9745;' : '&#9744;';
                    span.style.fontSize = '16px';
                } else {
                    span.textContent = inp.value;
                }
                inp.parentNode.replaceChild(span, inp);
            });
            node.querySelectorAll('button, .hidden-on-print').forEach(b => b.remove());
            node.classList.add('pdf-mode');
        };
        processClone(clone1); processClone(clone2);
        hidden.appendChild(clone1); hidden.appendChild(clone2);
        await new Promise(r => setTimeout(r, 800));
        const doc = new jspdf.jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const captureOpts = { scale: window.devicePixelRatio > 1 ? 2 : 1.5, useCORS: true, logging: false, allowTaint: true, windowWidth: 1200 };
        const canvas1 = await html2canvas(clone1, captureOpts);
        const img1 = canvas1.toDataURL('image/jpeg', 0.85);
        const h1 = (canvas1.height * pageWidth) / canvas1.width;
        doc.addImage(img1, 'JPEG', 0, 0, pageWidth, h1 > pageHeight ? pageHeight : h1);
        doc.addPage();
        const canvas2 = await html2canvas(clone2, captureOpts);
        const img2 = canvas2.toDataURL('image/jpeg', 0.85);
        const h2 = (canvas2.height * pageWidth) / canvas2.width;
        doc.addImage(img2, 'JPEG', 0, 0, pageWidth, h2 > pageHeight ? pageHeight : h2);

        /* [v1.9] 파일명 규칙: OSQ_지역_고객명_연락처_v1.9.pdf */
        const regionDo = document.getElementById('region-do').value || '';
        const regionSi = document.getElementById('region-si').value || '';
        const regionShort = regionSi || regionDo || '미정';
        const custName = document.getElementById('cust-name').value.trim() || 'VIP';
        const custPhone = document.getElementById('cust-phone').value.trim().replace(/-/g, '') || '0000';
        const fileName = `OSQ_${regionShort}_${custName}_${custPhone}_v1.9.pdf`;

        const pdfBlob = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobURL; link.download = fileName;
        document.body.appendChild(link); link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(blobURL); }, 100);
        sendEmailJS();
    } catch (e) { console.error('PDF Engine Error:', e); alert('PDF 생성 오류 발생'); } finally { overlay.classList.add('hidden'); document.getElementById('pdf-hidden-container').innerHTML = ''; }
}

function sendEmailJS() {
    const bVal = document.getElementById('branch-select').value, bInp = document.getElementById('branch-input').value;
    const hVal = document.getElementById('handler-select').value, hInp = document.getElementById('handler-input').value;
    const cName = document.getElementById('cust-name').value || '고객', cPhone = document.getElementById('cust-phone').value || '-';
    const rFull = `${document.getElementById('region-do').value} ${document.getElementById('region-si').value} ${document.getElementById('cust-addr-detail').value}`;
    let fullText = `[OSKA 견적발송]\n담당: ${(bVal === '직접입력' ? bInp : bVal)} / ${(hVal === '직접 입력' ? hInp : hVal)}\n고객: ${cName} (${cPhone})\n주소: ${rFull}\n금액: ₩${document.getElementById('val-total').textContent}`;
    emailjs.send("service_a3gvyib", "template_nz7rtfr", { cust_name: cName, cust_phone: cPhone, address: rFull, total_price: "₩" + document.getElementById('val-total').textContent, message: fullText });
}

const MANAGER_PW = ['oska', '1234', 'admin'];
function openManagerLogin() { document.getElementById('manager-pw').value = ''; document.getElementById('manager-login-modal').classList.add('active'); setTimeout(() => document.getElementById('manager-pw').focus(), 100); }
function closeManagerLogin() { document.getElementById('manager-login-modal').classList.remove('active'); }
function checkManagerPassword() { if (MANAGER_PW.includes(document.getElementById('manager-pw').value)) { closeManagerLogin(); renderManagerReport(); } }
function closeManagerReport() { document.getElementById('manager-report-modal').classList.remove('active'); }
function renderManagerReport() {
    const tbody = document.getElementById('manager-prod-tbody'); tbody.innerHTML = '';
    let pCTotal = 0, pSTotal = 0, pMTotal = 0;
    document.querySelectorAll('#est-tbody tr').forEach(tr => {
        const prod = tr.querySelector('td:nth-child(2) select')?.value || '';
        if (!["STAY", "Tone", "AIREA", "OPERA", "ATHENA"].some(k => prod.includes(k))) return;
        const consumer = parseNum(tr.querySelector('.sum').textContent);
        if (consumer > 0) {
            let supply = 0, margin = 0, rate = "";
            if (prod.includes("STAY")) { margin = 1500000; supply = consumer - margin; rate = "고정"; }
            else if (prod.includes("Tone")) { margin = 3000000; supply = consumer - margin; rate = "고정"; }
            else { supply = Math.round(consumer * 0.6); margin = consumer - supply; rate = "60%"; }
            pCTotal += consumer; pSTotal += supply; pMTotal += margin;
            tbody.insertAdjacentHTML('beforeend', `<tr><td class="px-4 py-3">${prod}</td><td class="px-4 py-3 text-right">${formatNumber(consumer)}</td><td class="px-4 py-3 text-center">${rate}</td><td class="px-4 py-3 text-right text-blue-600">${formatNumber(supply)}</td><td class="px-4 py-3 text-right text-green-600">${formatNumber(margin)}</td></tr>`);
        }
    });
    document.getElementById('mgr-prod-consumer-total').textContent = formatNumber(pCTotal);
    document.getElementById('mgr-prod-supply-total').textContent = formatNumber(pSTotal);
    document.getElementById('mgr-prod-margin-total').textContent = formatNumber(pMTotal);
    const consSum = parseNum(document.getElementById('val-cons-sum').textContent), disc = parseNum(document.getElementById('val-discount').value);
    document.getElementById('mgr-total-est').textContent = document.getElementById('val-total').textContent;
    document.getElementById('mgr-total-supply').textContent = formatNumber(pSTotal) + " (별도)";
    document.getElementById('mgr-total-margin').textContent = formatNumber(pMTotal + consSum - disc);
    document.getElementById('manager-report-modal').classList.add('active');
}
