const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadedDocsList = document.getElementById('uploadedDocsList');
const clearDocsBtn = document.getElementById('clearDocsBtn');

const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');

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
            addDocToList(file.name, data.chunks);
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

// 3. Xóa toàn bộ tài liệu trong bộ nhớ
clearDocsBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/documents', { method: 'DELETE' });
        const data = await response.json();
        uploadedDocsList.innerHTML = '<li class="empty-item">Chưa có tài liệu nào được nạp.</li>';
        uploadStatus.textContent = data.message || 'Đã xóa bộ nhớ tài liệu.';
        uploadStatus.className = 'status-box success';
    } catch (error) {
        uploadStatus.textContent = 'Lỗi khi xóa bộ nhớ: ' + error.message;
        uploadStatus.className = 'status-box error';
    }
});

function addDocToList(filename, chunks) {
    const emptyItem = uploadedDocsList.querySelector('.empty-item');
    if (emptyItem) emptyItem.remove();

    // Không thêm trùng tên file trên danh sách giao diện
    const existing = Array.from(uploadedDocsList.querySelectorAll('li'))
        .find(li => li.dataset.filename === filename);
    if (existing) {
        existing.textContent = `✅ ${filename} (${chunks} đoạn)`;
        return;
    }

    const li = document.createElement('li');
    li.dataset.filename = filename;
    li.textContent = `✅ ${filename} (${chunks} đoạn)`;
    uploadedDocsList.appendChild(li);
}

// 4. Hàm chuyển đổi Markdown cơ bản sang HTML an toàn, đẹp mắt
function renderMarkdown(rawText) {
    // Escape HTML để tránh XSS
    const escaped = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    let html = '';
    let inList = false;

    for (let rawLine of lines) {
        let line = rawLine.trim();
        // Chuyển **bold** thành <strong>bold</strong>
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

// 5. Xử lý sự kiện gửi câu hỏi Chat
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;

    appendMessage('user', question);
    questionInput.value = '';
    sendBtn.disabled = true;

    const loadingBubble = appendMessage('ai', 'Đang tìm kiếm trong tài liệu và suy nghĩ...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await response.json();
        loadingBubble.innerHTML = renderMarkdown(data.answer || 'Không nhận được phản hồi.');
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
    avatar.className = 'avatar';
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
