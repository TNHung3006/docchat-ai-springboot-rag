const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadedDocsList = document.getElementById('uploadedDocsList');
const docCountBadge = document.getElementById('docCountBadge');
const clearDocsBtn = document.getElementById('clearDocsBtn');
const fileFilterSelect = document.getElementById('fileFilterSelect');
const newChatBtn = document.getElementById('newChatBtn');
const exportChatBtn = document.getElementById('exportChatBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const activeModelBadge = document.getElementById('activeModelBadge');

const chatSessionsList = document.getElementById('chatSessionsList');
const sessionCountBadge = document.getElementById('sessionCountBadge');
const clearSessionsBtn = document.getElementById('clearSessionsBtn');
const sessionSearchInput = document.getElementById('sessionSearchInput');
const activeSessionTitle = document.getElementById('activeSessionTitle');

const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');

// Modal Xem đoạn văn (Chunks Preview)
const chunksModal = document.getElementById('chunksModal');
const chunksModalTitle = document.getElementById('chunksModalTitle');
const closeChunksModalBtn = document.getElementById('closeChunksModalBtn');
const chunkSearchInput = document.getElementById('chunkSearchInput');
const chunkCountInfo = document.getElementById('chunkCountInfo');
const chunksModalBody = document.getElementById('chunksModalBody');

// Modal Cài đặt AI (Settings)
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const currentMaskedKey = document.getElementById('currentMaskedKey');
const settingsApiKey = document.getElementById('settingsApiKey');
const settingsModelName = document.getElementById('settingsModelName');
const settingsTemperature = document.getElementById('settingsTemperature');
const tempValueLabel = document.getElementById('tempValueLabel');
const settingsMaxResults = document.getElementById('settingsMaxResults');
const settingsMinScore = document.getElementById('settingsMinScore');
const settingsStatus = document.getElementById('settingsStatus');

let selectedFilesQueue = [];
let allSessionsCache = [];
let activeSessionData = null;
let currentPreviewChunks = [];

function generateNewSessionId() {
    return 'session-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

let sessionId = localStorage.getItem('docchat_session_id');
if (!sessionId) {
    sessionId = generateNewSessionId();
    localStorage.setItem('docchat_session_id', sessionId);
}

// Khởi chạy: Tải danh sách tài liệu, lịch sử hội thoại và cấu hình AI từ Server
window.addEventListener('DOMContentLoaded', async () => {
    fetchDocuments();
    fetchCurrentSettingsBadge();
    await initChatHistory();
});

async function fetchDocuments() {
    try {
        const res = await fetch('/api/documents');
        if (res.ok) {
            const docs = await res.json();
            renderDocumentList(docs);
        }
    } catch (err) {
        console.error('Không thể tải danh sách tài liệu:', err);
    }
}

function renderDocumentList(docs) {
    docCountBadge.textContent = docs.length;
    const currentFilter = fileFilterSelect.value;

    fileFilterSelect.innerHTML = '<option value="ALL">📚 Tất cả tài liệu đã nạp</option>';

    if (!docs || docs.length === 0) {
        uploadedDocsList.innerHTML = '<li class="empty-item">Chưa có tài liệu nào được nạp.</li>';
        return;
    }

    uploadedDocsList.innerHTML = '';
    docs.forEach(doc => {
        const li = document.createElement('li');
        li.dataset.filename = doc.fileName;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'doc-item-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'doc-item-name';
        nameSpan.title = doc.fileName;
        nameSpan.textContent = `📄 ${doc.fileName}`;

        const sizeText = doc.sizeBytes ? ` • ${formatFileSize(doc.sizeBytes)}` : '';
        const metaSpan = document.createElement('span');
        metaSpan.className = 'doc-item-meta';
        metaSpan.textContent = `${doc.chunks} đoạn${sizeText} • ${doc.uploadedAt || ''}`;

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(metaSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'doc-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view-chunks';
        viewBtn.title = `Xem các đoạn văn (chunks) của ${doc.fileName}`;
        viewBtn.textContent = '👁️';
        viewBtn.addEventListener('click', () => openChunksPreview(doc.fileName));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-doc';
        delBtn.title = `Xóa tài liệu ${doc.fileName}`;
        delBtn.textContent = '✖';
        delBtn.addEventListener('click', () => deleteSingleDocument(doc.fileName));

        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(delBtn);

        li.appendChild(infoDiv);
        li.appendChild(actionsDiv);
        uploadedDocsList.appendChild(li);

        const opt = document.createElement('option');
        opt.value = doc.fileName;
        opt.textContent = `📄 ${doc.fileName}`;
        fileFilterSelect.appendChild(opt);
    });

    if (Array.from(fileFilterSelect.options).some(o => o.value === currentFilter)) {
        fileFilterSelect.value = currentFilter;
    }
}

// ================= XEM CHI TIẾT ĐOẠN VĂN (CHUNKS PREVIEW MODAL) =================

async function openChunksPreview(fileName) {
    chunksModalTitle.textContent = `📄 Các đoạn văn đã cắt: ${fileName}`;
    chunkSearchInput.value = '';
    chunksModalBody.innerHTML = '<p style="color:#94a3b8;">Đang tải danh sách đoạn văn...</p>';
    chunksModal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/documents/${encodeURIComponent(fileName)}/chunks`);
        if (res.ok) {
            const data = await res.json();
            currentPreviewChunks = data.chunks || [];
            renderChunksList('');
        } else {
            chunksModalBody.innerHTML = '<p style="color:#f87171;">Không thể tải dữ liệu đoạn văn.</p>';
        }
    } catch (err) {
        chunksModalBody.innerHTML = `<p style="color:#f87171;">Lỗi kết nối: ${escapeHtml(err.message)}</p>`;
    }
}

function renderChunksList(keyword) {
    const filter = (keyword || '').trim().toLowerCase();
    const matched = currentPreviewChunks
        .map((text, idx) => ({ index: idx + 1, text }))
        .filter(item => !filter || item.text.toLowerCase().includes(filter));

    chunkCountInfo.textContent = `${matched.length} / ${currentPreviewChunks.length} đoạn`;

    if (matched.length === 0) {
        chunksModalBody.innerHTML = '<p style="color:#94a3b8;font-style:italic;">Không tìm thấy đoạn văn nào khớp với từ khóa.</p>';
        return;
    }

    chunksModalBody.innerHTML = matched.map(item => `
        <div class="chunk-card">
            <div class="chunk-card-header">
                <span>Đoạn #${item.index}</span>
                <span>${item.text.length} ký tự</span>
            </div>
            <div class="chunk-card-text">${escapeHtml(item.text)}</div>
        </div>
    `).join('');
}

chunkSearchInput.addEventListener('input', () => {
    renderChunksList(chunkSearchInput.value);
});

closeChunksModalBtn.addEventListener('click', () => {
    chunksModal.classList.add('hidden');
});

chunksModal.addEventListener('click', (e) => {
    if (e.target === chunksModal) {
        chunksModal.classList.add('hidden');
    }
});

// ================= QUẢN LÝ LỊCH SỬ ĐA PHIÊN HỘI THOẠI & TÌM KIẾM =================

async function initChatHistory() {
    try {
        const sessions = await fetchSessions();
        if (sessions && sessions.length > 0) {
            const exists = sessions.some(s => s.id === sessionId);
            const targetId = exists ? sessionId : sessions[0].id;
            await loadSession(targetId);
        } else {
            renderWelcomeMessage();
        }
    } catch (err) {
        console.error('Không thể tải lịch sử trò chuyện:', err);
    }
}

async function fetchSessions() {
    try {
        const res = await fetch('/api/chat/sessions');
        if (res.ok) {
            allSessionsCache = await res.json();
            renderSessionList(allSessionsCache, sessionSearchInput ? sessionSearchInput.value : '');
            return allSessionsCache;
        }
    } catch (err) {
        console.error('Lỗi tải danh sách phiên chat:', err);
    }
    return [];
}

if (sessionSearchInput) {
    sessionSearchInput.addEventListener('input', () => {
        renderSessionList(allSessionsCache, sessionSearchInput.value);
    });
}

function renderSessionList(sessions, searchKeyword = '') {
    sessionCountBadge.textContent = sessions ? sessions.length : 0;

    if (!sessions || sessions.length === 0) {
        chatSessionsList.innerHTML = '<li class="empty-item">Chưa có lịch sử trò chuyện.</li>';
        return;
    }

    const filter = (searchKeyword || '').trim().toLowerCase();
    const filtered = sessions.filter(s => !filter || (s.title && s.title.toLowerCase().includes(filter)));

    if (filtered.length === 0) {
        chatSessionsList.innerHTML = '<li class="empty-item">Không tìm thấy cuộc trò chuyện phù hợp.</li>';
        return;
    }

    chatSessionsList.innerHTML = '';
    filtered.forEach(session => {
        const li = document.createElement('li');
        li.dataset.sessionId = session.id;
        if (session.id === sessionId) {
            li.classList.add('active');
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'doc-item-info';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'doc-item-name';
        titleSpan.title = session.title;
        titleSpan.textContent = `💬 ${session.title}`;

        const turns = Math.floor((session.messageCount || 0) / 2);
        const metaSpan = document.createElement('span');
        metaSpan.className = 'doc-item-meta';
        metaSpan.textContent = `${turns} câu hỏi • ${session.updatedAt || ''}`;

        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(metaSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'session-actions';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-rename-session';
        renameBtn.title = 'Đổi tên cuộc trò chuyện';
        renameBtn.textContent = '✏️';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            promptRenameSession(session.id, session.title);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-doc';
        delBtn.title = 'Xóa cuộc trò chuyện này';
        delBtn.textContent = '✖';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSingleSession(session.id);
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(delBtn);

        li.appendChild(infoDiv);
        li.appendChild(actionsDiv);

        li.addEventListener('click', () => loadSession(session.id));
        chatSessionsList.appendChild(li);
    });
}

async function loadSession(targetSessionId) {
    try {
        const res = await fetch(`/api/chat/sessions/${encodeURIComponent(targetSessionId)}`);
        if (!res.ok) {
            sessionId = targetSessionId;
            activeSessionData = null;
            localStorage.setItem('docchat_session_id', sessionId);
            renderWelcomeMessage();
            await fetchSessions();
            return;
        }
        const session = await res.json();
        activeSessionData = session;
        sessionId = session.id;
        localStorage.setItem('docchat_session_id', sessionId);

        if (activeSessionTitle) {
            activeSessionTitle.textContent = `2. ${session.title || 'Trò chuyện với tài liệu'}`;
        }

        chatMessages.innerHTML = '';
        if (!session.messages || session.messages.length === 0) {
            renderWelcomeMessage();
        } else {
            session.messages.forEach(msg => {
                if (msg.role === 'user') {
                    appendMessage('user', msg.content);
                } else {
                    appendAiMessageWithTools(msg.content, msg.sources);
                }
            });
        }
        await fetchSessions();
    } catch (err) {
        console.error('Lỗi khi mở phiên trò chuyện:', err);
    }
}

function renderWelcomeMessage() {
    if (activeSessionTitle) {
        activeSessionTitle.textContent = '2. Trò chuyện với tài liệu';
    }
    chatMessages.innerHTML = `
        <div class="message ai-message">
            <div class="avatar">🤖</div>
            <div class="bubble">
                <p>Xin chào! Hãy kéo thả hoặc tải lên nhiều tài liệu (<strong>PDF, Word, Excel, PowerPoint, TXT</strong>) ở cột bên trái, sau đó đặt câu hỏi về nội dung bên trong.</p>
                <p>✨ <strong>Tính năng nổi bật:</strong> Kéo thả nhiều file, xem chi tiết các đoạn văn (👁️ Chunks), trích dẫn nguồn, lọc theo từng file, sao chép câu trả lời, xuất file báo cáo <code>.md</code> và tùy chỉnh thông số AI trực tiếp trong <strong>⚙️ Cài đặt</strong>!</p>
            </div>
        </div>
    `;
}

async function promptRenameSession(targetId, currentTitle) {
    const newTitle = window.prompt('Nhập tên mới cho cuộc trò chuyện:', currentTitle || '');
    if (newTitle === null || newTitle.trim() === '' || newTitle.trim() === currentTitle) {
        return;
    }
    try {
        const res = await fetch(`/api/chat/sessions/${encodeURIComponent(targetId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
        });
        if (res.ok) {
            const updated = await res.json();
            if (targetId === sessionId) {
                activeSessionData = updated;
                if (activeSessionTitle) {
                    activeSessionTitle.textContent = `2. ${updated.title}`;
                }
            }
            await fetchSessions();
        }
    } catch (err) {
        console.error('Không thể đổi tên cuộc trò chuyện:', err);
    }
}

async function deleteSingleSession(targetId) {
    try {
        await fetch(`/api/chat/sessions/${encodeURIComponent(targetId)}`, {
            method: 'DELETE'
        });
        const remaining = await fetchSessions();
        if (targetId === sessionId) {
            if (remaining && remaining.length > 0) {
                await loadSession(remaining[0].id);
            } else {
                sessionId = generateNewSessionId();
                activeSessionData = null;
                localStorage.setItem('docchat_session_id', sessionId);
                renderWelcomeMessage();
            }
        }
    } catch (err) {
        console.error('Lỗi xóa phiên hội thoại:', err);
    }
}

clearSessionsBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/chat/sessions', { method: 'DELETE' });
        sessionId = generateNewSessionId();
        activeSessionData = null;
        localStorage.setItem('docchat_session_id', sessionId);
        renderWelcomeMessage();
        await fetchSessions();
    } catch (err) {
        console.error('Lỗi xóa toàn bộ lịch sử:', err);
    }
});

// ================= KÉO THẢ & UPLOAD NHIỀU TÀI LIỆU (MULTI-FILE DRAG & DROP) =================

function updateSelectedFilesQueue(fileList) {
    selectedFilesQueue = Array.from(fileList || []);
    if (selectedFilesQueue.length === 1) {
        const f = selectedFilesQueue[0];
        fileNameDisplay.textContent = `${f.name} (${formatFileSize(f.size)})`;
        uploadBtn.disabled = false;
    } else if (selectedFilesQueue.length > 1) {
        const totalSize = selectedFilesQueue.reduce((acc, f) => acc + f.size, 0);
        fileNameDisplay.textContent = `Đã chọn ${selectedFilesQueue.length} file (${formatFileSize(totalSize)})`;
        uploadBtn.disabled = false;
    } else {
        fileNameDisplay.textContent = 'Kéo thả file vào đây hoặc nhấn để chọn';
        uploadBtn.disabled = true;
    }
}

fileInput.addEventListener('change', () => {
    updateSelectedFilesQueue(fileInput.files);
});

['dragenter', 'dragover'].forEach(evtName => {
    dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(evtName => {
    dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        updateSelectedFilesQueue(e.dataTransfer.files);
    }
});

uploadBtn.addEventListener('click', async () => {
    if (!selectedFilesQueue || selectedFilesQueue.length === 0) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = `Đang nạp ${selectedFilesQueue.length} tài liệu...`;
    uploadStatus.className = 'status-box hidden';

    const formData = new FormData();
    selectedFilesQueue.forEach(f => formData.append('files', f));

    try {
        const response = await fetch('/api/documents/upload-batch', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        uploadStatus.textContent = data.message;
        if (response.ok && data.status === 'success') {
            uploadStatus.className = 'status-box success';
            selectedFilesQueue = [];
            fileInput.value = '';
            updateSelectedFilesQueue([]);
            await fetchDocuments();
        } else {
            uploadStatus.className = 'status-box error';
        }
    } catch (error) {
        uploadStatus.textContent = 'Không thể kết nối tới máy chủ: ' + error.message;
        uploadStatus.className = 'status-box error';
    } finally {
        uploadBtn.disabled = selectedFilesQueue.length === 0;
        uploadBtn.textContent = 'Nạp tài liệu vào bộ nhớ AI';
    }
});

// 3. Xóa từng tài liệu riêng lẻ
async function deleteSingleDocument(fileName) {
    try {
        const response = await fetch(`/api/documents/${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        uploadStatus.textContent = data.message || `Đã xóa ${fileName}`;
        uploadStatus.className = 'status-box success';
        await fetchDocuments();
    } catch (error) {
        uploadStatus.textContent = 'Lỗi khi xóa tài liệu: ' + error.message;
        uploadStatus.className = 'status-box error';
    }
}

// 4. Xóa toàn bộ tài liệu trong bộ nhớ
clearDocsBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/documents', { method: 'DELETE' });
        const data = await response.json();
        await fetchDocuments();
        uploadStatus.textContent = data.message || 'Đã xóa bộ nhớ tài liệu.';
        uploadStatus.className = 'status-box success';
    } catch (error) {
        uploadStatus.textContent = 'Lỗi khi xóa bộ nhớ: ' + error.message;
        uploadStatus.className = 'status-box error';
    }
});

// 5. Tạo phiên hội thoại mới
newChatBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Cuộc trò chuyện mới' })
        });
        if (res.ok) {
            const newSession = await res.json();
            await loadSession(newSession.id);
            questionInput.focus();
            return;
        }
    } catch (ignored) {
    }
    sessionId = generateNewSessionId();
    activeSessionData = null;
    localStorage.setItem('docchat_session_id', sessionId);
    renderWelcomeMessage();
    await fetchSessions();
});

// 6. Xuất toàn bộ phiên hội thoại hiện tại ra file Markdown (.md)
exportChatBtn.addEventListener('click', async () => {
    try {
        const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
            alert('Chưa có nội dung tin nhắn nào trong phiên hội thoại này để xuất!');
            return;
        }
        const session = await res.json();
        if (!session.messages || session.messages.length === 0) {
            alert('Cuộc trò chuyện này chưa có tin nhắn nào để xuất!');
            return;
        }

        let md = `# 📚 DocChat AI - Bản Ghi Cuộc Trò Chuyện\n\n`;
        md += `- **Chủ đề:** ${session.title || 'Trò chuyện với tài liệu'}\n`;
        md += `- **Thời gian cập nhật:** ${session.updatedAt || ''}\n\n---\n\n`;

        session.messages.forEach(msg => {
            if (msg.role === 'user') {
                md += `### 🧑 Người dùng (${msg.timestamp || ''})\n${msg.content}\n\n`;
            } else {
                md += `### 🤖 DocChat AI (${msg.timestamp || ''})\n${msg.content}\n\n`;
                if (msg.sources && msg.sources.length > 0) {
                    md += `**📖 Nguồn trích dẫn:**\n`;
                    msg.sources.forEach((src, i) => {
                        md += `> ${i + 1}. **${src.fileName}**: "${src.snippet}"\n`;
                    });
                    md += `\n`;
                }
                md += `---\n\n`;
            }
        });

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (session.title || 'docchat-export')
            .replace(/[^a-zA-Z0-9À-ỹ\s-_]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase() || 'docchat-session';
        a.href = url;
        a.download = `${safeName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Không thể xuất cuộc trò chuyện: ' + err.message);
    }
});

// ================= BẢNG CÀI ĐẶT AI (SETTINGS MODAL) =================

async function fetchCurrentSettingsBadge() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const s = await res.json();
            if (activeModelBadge) {
                activeModelBadge.textContent = `${s.modelName} • Top ${s.maxResults}`;
            }
        }
    } catch (ignored) {
    }
}

openSettingsBtn.addEventListener('click', async () => {
    settingsStatus.className = 'status-box hidden';
    settingsApiKey.value = '';
    settingsModal.classList.remove('hidden');

    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const s = await res.json();
            currentMaskedKey.textContent = s.maskedApiKey || 'Chưa cấu hình';
            currentMaskedKey.style.color = s.apiKeyConfigured ? '#4ade80' : '#f87171';
            if (Array.from(settingsModelName.options).some(o => o.value === s.modelName)) {
                settingsModelName.value = s.modelName;
            }
            settingsTemperature.value = s.temperature;
            tempValueLabel.textContent = s.temperature;
            settingsMaxResults.value = s.maxResults;
            settingsMinScore.value = s.minScore;
        }
    } catch (err) {
        currentMaskedKey.textContent = 'Không thể tải cấu hình';
    }
});

settingsTemperature.addEventListener('input', () => {
    tempValueLabel.textContent = settingsTemperature.value;
});

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
cancelSettingsBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettingsModal();
    }
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        apiKey: settingsApiKey.value.trim(),
        modelName: settingsModelName.value,
        temperature: parseFloat(settingsTemperature.value),
        maxResults: parseInt(settingsMaxResults.value, 10),
        minScore: parseFloat(settingsMinScore.value)
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const updated = await res.json();
            currentMaskedKey.textContent = updated.maskedApiKey;
            currentMaskedKey.style.color = updated.apiKeyConfigured ? '#4ade80' : '#f87171';
            settingsApiKey.value = '';
            if (activeModelBadge) {
                activeModelBadge.textContent = `${updated.modelName} • Top ${updated.maxResults}`;
            }
            settingsStatus.textContent = '✅ Đã lưu và áp dụng cài đặt AI mới ngay lập tức!';
            settingsStatus.className = 'status-box success';
        } else {
            settingsStatus.textContent = '❌ Không thể lưu cài đặt.';
            settingsStatus.className = 'status-box error';
        }
    } catch (err) {
        settingsStatus.textContent = '❌ Lỗi kết nối: ' + err.message;
        settingsStatus.className = 'status-box error';
    }
});

// 7. Các nút gợi ý câu hỏi nhanh (Quick Actions)
document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt && !sendBtn.disabled) {
            questionInput.value = prompt;
            chatForm.requestSubmit();
        }
    });
});

// ================= BỘ HIỂN THỊ MARKDOWN NÂNG CAO & NÚT COPY =================

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatInlineMarkdown(line) {
    return line
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderMarkdown(rawText) {
    const escaped = escapeHtml(rawText || '');
    const lines = escaped.split('\n');
    let html = '';
    let inUl = false;
    let inOl = false;
    let inCodeBlock = false;
    let codeBuffer = [];

    const closeLists = () => {
        if (inUl) {
            html += '</ul>';
            inUl = false;
        }
        if (inOl) {
            html += '</ol>';
            inOl = false;
        }
    };

    for (let rawLine of lines) {
        const trimmed = rawLine.trim();

        if (trimmed.startsWith('```')) {
            closeLists();
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBuffer = [];
            } else {
                html += `<pre><code>${codeBuffer.join('\n')}</code></pre>`;
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(rawLine);
            continue;
        }

        if (trimmed.startsWith('### ')) {
            closeLists();
            html += `<h3>${formatInlineMarkdown(trimmed.substring(4))}</h3>`;
        } else if (trimmed.startsWith('## ')) {
            closeLists();
            html += `<h2>${formatInlineMarkdown(trimmed.substring(3))}</h2>`;
        } else if (trimmed.startsWith('# ')) {
            closeLists();
            html += `<h1>${formatInlineMarkdown(trimmed.substring(2))}</h1>`;
        } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            if (inOl) {
                html += '</ol>';
                inOl = false;
            }
            if (!inUl) {
                html += '<ul>';
                inUl = true;
            }
            html += `<li>${formatInlineMarkdown(trimmed.substring(2))}</li>`;
        } else if (/^\d+\.\s+/.test(trimmed)) {
            if (inUl) {
                html += '</ul>';
                inUl = false;
            }
            if (!inOl) {
                html += '<ol>';
                inOl = true;
            }
            html += `<li>${formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</li>`;
        } else {
            closeLists();
            if (trimmed.length > 0) {
                html += `<p>${formatInlineMarkdown(trimmed)}</p>`;
            }
        }
    }

    closeLists();
    if (inCodeBlock) {
        html += `<pre><code>${codeBuffer.join('\n')}</code></pre>`;
    }
    return html || escaped;
}

function renderSourcesHtml(sources) {
    if (!sources || sources.length === 0) return '';

    let itemsHtml = '';
    sources.forEach((src, idx) => {
        itemsHtml += `
            <div class="citation-item">
                <div class="citation-file">📌 Nguồn ${idx + 1}: ${escapeHtml(src.fileName)}</div>
                <div class="citation-snippet">"${escapeHtml(src.snippet)}"</div>
            </div>
        `;
    });

    return `
        <details class="citations-box">
            <summary>📖 Xem ${sources.length} đoạn trích dẫn nguồn từ tài liệu</summary>
            <div class="citations-list">${itemsHtml}</div>
        </details>
    `;
}

function populateAiBubbleContent(bubble, rawAnswerText, sources) {
    const answerHtml = renderMarkdown(rawAnswerText || 'Không nhận được phản hồi.');
    const sourcesHtml = renderSourcesHtml(sources);
    bubble.innerHTML = answerHtml + sourcesHtml;

    const toolbar = document.createElement('div');
    toolbar.className = 'message-toolbar';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-copy-msg';
    copyBtn.textContent = '📋 Sao chép';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(rawAnswerText || '');
            copyBtn.textContent = '✅ Đã chép';
            setTimeout(() => {
                copyBtn.textContent = '📋 Sao chép';
            }, 1800);
        } catch (err) {
            console.error('Không thể sao chép:', err);
        }
    });

    toolbar.appendChild(copyBtn);
    bubble.appendChild(toolbar);
}

function appendAiMessageWithTools(rawAnswerText, sources) {
    const bubble = appendMessage('ai', '');
    populateAiBubbleContent(bubble, rawAnswerText, sources);
    return bubble;
}

// 8. Xử lý sự kiện gửi câu hỏi Chat
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;

    appendMessage('user', question);
    questionInput.value = '';
    sendBtn.disabled = true;

    const selectedFilter = fileFilterSelect.value;
    const loadingBubble = appendMessage('ai', 'Đang tìm kiếm trong tài liệu và phân tích...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                sessionId,
                fileFilter: selectedFilter
            })
        });
        const data = await response.json();
        populateAiBubbleContent(loadingBubble, data.answer || 'Không nhận được phản hồi.', data.sources);

        // Cập nhật lại danh sách lịch sử phiên hội thoại ở cột trái
        const sessions = await fetchSessions();
        const active = sessions.find(s => s.id === sessionId);
        if (active && activeSessionTitle) {
            activeSessionTitle.textContent = `2. ${active.title}`;
        }
    } catch (error) {
        loadingBubble.textContent = 'Lỗi kết nối: ' + error.message;
    } finally {
        sendBtn.disabled = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;

    const avatar = document.createElement('div');
    avatar.className = sender === 'user' ? 'avatar user-avatar' : 'avatar ai-avatar';
    avatar.textContent = sender === 'user' ? '🧑' : '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (sender === 'user') {
        bubble.textContent = text;
    } else if (text) {
        bubble.innerHTML = renderMarkdown(text);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return bubble;
}
