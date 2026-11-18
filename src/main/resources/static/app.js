const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadedDocsList = document.getElementById('uploadedDocsList');
const docCountBadge = document.getElementById('docCountBadge');
const clearDocsBtn = document.getElementById('clearDocsBtn');
const fileFilterSelect = document.getElementById('fileFilterSelect');
const newChatBtn = document.getElementById('newChatBtn');

const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');

// Quản lý Session ID riêng biệt cho mỗi người dùng / trình duyệt
let sessionId = localStorage.getItem('docchat_session_id');
if (!sessionId) {
    sessionId = 'session-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
    localStorage.setItem('docchat_session_id', sessionId);
}

// Khởi chạy: Tải danh sách tài liệu đang có trên server
window.addEventListener('DOMContentLoaded', () => {
    fetchDocuments();
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

    // Cập nhật dropdown chọn phạm vi tìm kiếm
    fileFilterSelect.innerHTML = '<option value="ALL">📚 Tất cả tài liệu đã nạp</option>';

    if (!docs || docs.length === 0) {
        uploadedDocsList.innerHTML = '<li class="empty-item">Chưa có tài liệu nào được nạp.</li>';
        return;
    }

    uploadedDocsList.innerHTML = '';
    docs.forEach(doc => {
        // Thêm vào danh sách cột trái
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

        // Thêm vào dropdown lọc
        const opt = document.createElement('option');
        opt.value = doc.fileName;
        opt.textContent = `📄 ${doc.fileName}`;
        fileFilterSelect.appendChild(opt);
    });

    if (Array.from(fileFilterSelect.options).some(o => o.value === currentFilter)) {
        fileFilterSelect.value = currentFilter;
    }
}

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

// 5. Làm mới phiên hội thoại (New Chat Session)
newChatBtn.addEventListener('click', async () => {
    try {
        await fetch(`/api/chat/memory/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    } catch (ignored) {
    }
    sessionId = 'session-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
    localStorage.setItem('docchat_session_id', sessionId);

    chatMessages.innerHTML = '';
    appendMessage(
        'ai',
        'Đã bắt đầu **phiên hội thoại mới**! Bộ nhớ ngữ cảnh trước đó đã được làm sạch. Bạn muốn hỏi gì về tài liệu?'
    );
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
