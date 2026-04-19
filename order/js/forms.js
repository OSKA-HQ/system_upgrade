// ═══════════════════════════════════════════════════════════════
// OSKA Works — 서식 자료실 (Phase 3 분리)
// ═══════════════════════════════════════════════════════════════
// ===== 서식 자료실 =====
// ═══════════════════════════════════════════════════════════════
// [FORMS] 서식 자료실 (Firebase Storage)
//   · renderForms, openFormUploadModal, submitFormUpload
//   · 본사 직원 업로드 → 어드민 승인 → 전체 다운로드
//   · works_forms 컬렉션
// ═══════════════════════════════════════════════════════════════
function renderForms() {
  const approvedForms = worksForms.filter(f => f.status === 'approved');
  const pendingForms = worksForms.filter(f => f.status === 'pending');
  const canUpload = (currentType === 'hq');
  const isAdmin = (currentType === 'hq'); // 어드민 승인은 어드민 패널에서 처리
  return `
    <div class="min-h-screen bg-white animate-fade-in">
      ${renderNav()}
      <main class="pt-20 pb-20 max-w-5xl mx-auto px-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tighter">서식 자료실</h1>
            <p class="text-sm text-neutral-400 mt-1">업무 서식 다운로드</p>
          </div>
          <div class="flex items-center gap-3">
            ${canUpload ? `<button onclick="openFormUploadModal()" class="h-10 px-5 bg-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all flex items-center gap-2">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i> 서식 등록 요청
            </button>` : ''}
            <button onclick="navigate('home')" class="text-neutral-400 hover:text-black transition-colors">
              <i data-lucide="x" class="w-6 h-6"></i>
            </button>
          </div>
        </div>

        ${canUpload && pendingForms.length > 0 ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <i data-lucide="clock" class="w-4 h-4 text-amber-500"></i>
          <p class="text-[10px] font-black text-amber-700">승인 대기 중인 서식 ${pendingForms.length}건 — 어드민 패널에서 승인 후 게시됩니다</p>
        </div>` : ''}

        <!-- 승인된 서식 목록 -->
        <div class="space-y-3">
          ${approvedForms.length > 0 ? approvedForms.map(f => `
            <div class="bg-white border border-neutral-200 rounded-xl p-5 hover:border-teal-300 transition-all group">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                  <div class="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                    <i data-lucide="file-text" class="w-5 h-5 text-teal-500"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="font-black text-sm">${f.title || '제목 없음'}</p>
                    <p class="text-[10px] text-neutral-400 mt-0.5">${f.description || ''}</p>
                    <p class="text-[9px] text-neutral-300 mt-0.5">${f.approvedAt ? formatDate(f.approvedAt) : ''} · ${f.submittedByName || ''}</p>
                  </div>
                </div>
                <a href="${f.fileUrl}" download="${f.fileName || '서식'}" target="_blank"
                   class="h-9 px-4 bg-teal-500 text-white rounded-lg text-[10px] font-black hover:bg-teal-600 transition-all flex items-center gap-1.5 shrink-0 ml-4">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i> 다운로드
                </a>
              </div>
            </div>
          `).join('') : `
            <div class="py-16 text-center">
              <i data-lucide="file-down" class="w-10 h-10 mx-auto text-neutral-200 mb-3"></i>
              <p class="text-neutral-400 font-black">등록된 서식이 없습니다</p>
              ${canUpload ? `<p class="text-[10px] text-neutral-300 mt-1">"서식 등록 요청" 버튼으로 서식을 등록하세요</p>` : ''}
            </div>
          `}
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

function openFormUploadModal() {
  const modal = document.createElement('div');
  modal.id = 'formUploadModal';
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <i data-lucide="upload" class="w-5 h-5 text-teal-500"></i>
          <h3 class="text-base font-black">서식 등록 요청</h3>
        </div>
        <button onclick="document.getElementById('formUploadModal').remove()" class="text-neutral-400 hover:text-black">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-[10px] text-amber-700 font-bold">
        관리자 검토 후 승인되면 서식 자료실에 게시됩니다.
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">서식명 *</label>
          <input type="text" id="formTitle" class="input-base mt-1 w-full" placeholder="예: 견적서 표준 양식 v2" />
        </div>
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">설명</label>
          <textarea id="formDesc" class="input-base mt-1 w-full" rows="2" placeholder="서식 용도 및 설명"></textarea>
        </div>
        <div>
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">파일 첨부 *</label>
          <input type="file" id="formFile" class="mt-1 w-full text-[11px] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer" accept=".pdf,.docx,.xlsx,.hwp,.doc,.xls" />
          <p class="text-[9px] text-neutral-300 mt-1">PDF, Word, Excel, HWP 파일 지원</p>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="document.getElementById('formUploadModal').remove()" class="flex-1 h-11 border border-neutral-200 rounded-xl text-sm font-black text-neutral-400 hover:border-black transition-all">취소</button>
        <button onclick="submitFormUpload()" class="flex-1 h-11 bg-teal-500 text-white rounded-xl text-sm font-black hover:bg-teal-600 transition-all">등록 요청</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

async function submitFormUpload() {
  const title = document.getElementById('formTitle')?.value.trim();
  const desc = document.getElementById('formDesc')?.value.trim() || '';
  const fileInput = document.getElementById('formFile');
  const file = fileInput?.files?.[0];
  if (!title) { alert('서식명을 입력하세요.'); return; }
  if (!file) { alert('파일을 첨부하세요.'); return; }

  const submitBtn = document.querySelector('#formUploadModal button:last-child');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '업로드 중...'; }

  try {
    const { storage, ref, uploadBytes, getDownloadURL } = window.WORKS_STORAGE;
    const storageRef = ref(storage, `works_forms/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(snapshot.ref);

    const { db, collection, addDoc, serverTimestamp } = window.WORKS_DB;
    await addDoc(collection(db, 'works_forms'), {
      title, description: desc,
      fileUrl, fileName: file.name, fileSize: file.size,
      status: 'pending',
      submittedBy: currentBranch || currentManager || '',
      submittedByName: currentManager || currentBranch || '',
      createdAt: serverTimestamp()
    });
    document.getElementById('formUploadModal')?.remove();
    alert('서식 등록 요청이 완료되었습니다. 관리자 승인 후 게시됩니다.');
  } catch(e) {
    console.error(e);
    alert('업로드 실패: ' + e.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '등록 요청'; }
  }
}

