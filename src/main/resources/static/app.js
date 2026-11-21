const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadedDocsList = document.getElementById('uploadedDocsList');
const docCountBadge = document.getElementById('docCountBadge');
const clearDocsBtn = document.getElementById('clearDocsBtn');
const fileFilterSelect = document.getElementById('fileFilterSelect');
const newChatBtn = document.getElementById('newChatBtn');

const chatSessionsList = document.getElementById('chatSessionsList');
const sessionCountBadge = document.getElementById('sessionCountBadge');
const clearSessionsBtn = document.getElementById('clearSessionsBtn');
const activeSessionTitle = document.getElementById('activeSessionTitle');

const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');

function generateNewSessionId() {
    return 'session-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

let sessionId = localStorage.getItem('docchat_session_id');
if (!sessionId) {
    sessionId = generateNewSessionId();
    localStorage.setItem('docchat_session_id', sessionId);
}

// Khởi chạy: Tải danh sách tài liệu và khôi phục lịch sử hội thoại từ Server
window.addEventListener('DOMContentLoaded', async () => {
    fetchDocuments();
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

        const metaSpan = document.createElement('span');
        metaSpan.className = 'doc-item-meta';
        metaSpan.textContent = `${doc.chunks} đoạn văn • ${doc.uploadedAt || ''}`;

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(metaSpan);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-doc';
        delBtn.title = `Xóa tài liệu ${doc.fileName}`;
        delBtn.textContent = '✖';
        delBtn.addEventListener('click', () => deleteSingleDocument(doc.fileName));

        li.appendChild(infoDiv);
        li.appendChild(delBtn);
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

// ================= QUẢN LÝ LỊCH SỬ ĐA PHIÊN HỘI THOẠI =================

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
            const sessions = await res.json();
            renderSessionList(sessions);
            return sessions;
        }
    } catch (err) {
        console.error('Lỗi tải danh sách phiên chat:', err);
    }
    return [];
}

function renderSessionList(sessions) {
    sessionCountBadge.textContent = sessions ? sessions.length : 0;

    if (!sessions || sessions.length === 0) {
        chatSessionsList.innerHTML = '<li class="empty-item">Chưa có lịch sử trò chuyện.</li>';
        return;
    }

    chatSessionsList.innerHTML = '';
    sessions.forEach(session => {
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
            localStorage.setItem('docchat_session_id', sessionId);
            renderWelcomeMessage();
            await fetchSessions();
            return;
        }
        const session = await res.json();
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
                    const bubble = appendMessage('ai', msg.content);
                    if (msg.sources && msg.sources.length > 0) {
                        bubble.innerHTML = renderMarkdown(msg.content) + renderSourcesHtml(msg.sources);
                    }
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
                <p>Xin chào! Hãy tải lên tài liệu (<strong>PDF, Word, Excel, PowerPoint, TXT</strong>) ở cột bên trái, sau đó đặt câu hỏi về nội dung bên trong.</p>
                <p>✨ <strong>Tính năng mới:</strong> Tự động lưu trữ Vector &amp; lịch sử trò chuyện bền vững xuống đĩa, hỗ trợ chuyển đổi/đổi tên nhiều cuộc trò chuyện, trích dẫn nguồn và lọc theo từng file!</p>
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
            if (targetId === sessionId && activeSessionTitle) {
                activeSessionTitle.textContent = `2. ${updated.title}`;
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
        localStorage.setItem('docchat_session_id', sessionId);
        renderWelcomeMessage();
        await fetchSessions();
    } catch (err) {
        console.error('Lỗi xóa toàn bộ lịch sử:', err);
    }
});

// ================= XỬ LÝ TÀI LIỆU & CHAT =================

// 1. Khi người dùng chọn file
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
        uploadBtn.disabled = false;
    } else {
        fileNameDisplay.textContent = 'Nhấn để chọn file tài liệu';
        uploadBtn.disabled = true;
    }
});

// 2. Xử lý sự kiện nhấn nút Upload tài liệu
uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Đang đọc và phân tích...';
    uploadStatus.className = 'status-box hidden';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        uploadStatus.textContent = data.message;
        if (response.ok && data.status === 'success') {
            uploadStatus.className = 'status-box success';
            await fetchDocuments();
        } else {
            uploadStatus.className = 'status-box error';
        }
    } catch (error) {
        uploadStatus.textContent = 'Không thể kết nối tới máy chủ: ' + error.message;
        uploadStatus.className = 'status-box error';
    } finally {
        uploadBtn.disabled = false;
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

// 5. Tạo phiên hội thoại mới (New Chat Session - giữ nguyên các phiên cũ ở cột trái)
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
    localStorage.setItem('docchat_session_id', sessionId);
    renderWelcomeMessage();
    await fetchSessions();
});

// 6. Các nút gợi ý câu hỏi nhanh (Quick Actions)
document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt && !sendBtn.disabled) {
            questionInput.value = prompt;
            chatForm.requestSubmit();
        }
    });
});

// 7. Hàm chuyển đổi Markdown cơ bản sang HTML an toàn, đẹp mắt
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderMarkdown(rawText) {
    const escaped = escapeHtml(rawText);
    const lines = escaped.split('\n');
    let html = '';
    let inList = false;

    for (let rawLine of lines) {
        let line = rawLine.trim();
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        if (line.startsWith('* ') || line.startsWith('- ')) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += `<li>${line.substring(2)}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (line.length > 0) {
                html += `<p>${line}</p>`;
            }
        }
    }
    if (inList) {
        html += '</ul>';
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
        const answerHtml = renderMarkdown(data.answer || 'Không nhận được phản hồi.');
        const sourcesHtml = renderSourcesHtml(data.sources);
        loadingBubble.innerHTML = answerHtml + sourcesHtml;

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
    } else {
        bubble.innerHTML = renderMarkdown(text);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return bubble;
}