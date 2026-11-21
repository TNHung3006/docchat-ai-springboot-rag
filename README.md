# 📚 DocChat AI - Hỏi Đáp Tài Liệu Với Java Spring Boot & Google Gemini API (RAG)

Một ứng dụng **RAG (Retrieval-Augmented Generation)** hoàn chỉnh được viết bằng **Java 17+**, **Spring Boot 3**, và **LangChain4j** kết hợp cùng **Google Gemini LLM API**.

Ứng dụng cho phép người dùng tải lên các tài liệu cá nhân (`.pdf`, `.txt`) và trò chuyện, đặt câu hỏi trực tiếp về nội dung bên trong tài liệu đó.

![Giao diện DocChat AI](./docs/screenshot.png)

---

## ✨ Tính năng nổi bật
* **Hỗ trợ đa định dạng tài liệu (PDF, Word, Excel, PowerPoint, TXT):** Tự động trích xuất văn bản bằng Apache PDFBox & Apache POI, sau đó cắt nhỏ thành các đoạn (Chunking).
* **Trích dẫn nguồn tài liệu (Source Citations):** Hiển thị rõ câu trả lời được trích từ file nào và đoạn văn bản gốc nào trong tài liệu.
* **Lọc phạm vi tìm kiếm & Quản lý từng file:** Xem danh sách tài liệu đã nạp, xóa riêng từng file hoặc chọn chỉ hỏi đáp trên một tài liệu cụ thể.
* **Lưu trữ Vector & Lịch sử trò chuyện bền vững (Persistent Local Store):** Tự động lưu trữ Vector (`data/vector-store.json`), metadata (`data/documents-meta.json`) và toàn bộ lịch sử các cuộc hội thoại (`data/chat-history.json`) xuống ổ đĩa. Khởi động lại Server hay tải lại trang (F5) vẫn giữ nguyên tài liệu, tin nhắn, trích dẫn nguồn và trí nhớ ngữ cảnh của AI.
* **Quản lý đa phiên hội thoại (`@MemoryId`):** Tạo nhiều cuộc trò chuyện theo từng chủ đề, tự động đặt tiêu đề theo câu hỏi đầu tiên, hỗ trợ chuyển đổi, đổi tên (`✏️`) hoặc xóa từng cuộc trò chuyện bất kỳ lúc nào.
* **Local Embedding miễn phí & Google Gemini API (Auto-Fallback):** Chuyển văn bản thành Vector ngay trên máy bằng `All-MiniLM-L6-v2` và sinh câu trả lời chuẩn xác qua Gemini API.

---

## 🚀 Hướng dẫn cài đặt và chạy dự án

### Bước 1: Lấy Google Gemini API Key (Miễn phí)
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Đăng nhập tài khoản Google và nhấn **Create API Key**.
3. Copy mã API Key vừa tạo.

### Bước 2: Cấu hình API Key và Chạy ứng dụng
Đặt biến môi trường trên Terminal (PowerShell) và chạy trực tiếp bằng Maven Wrapper đi kèm:

```powershell
$env:GEMINI_API_KEY="DÁN_API_KEY_CỦA_BẠN_VÀO_ĐÂY"
.\mvnw.cmd spring-boot:run
```

Sau khi ứng dụng khởi động, mở trình duyệt tại địa chỉ: **`http://localhost:8080`**

---

## 🔌 REST API Endpoints

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/documents` | Lấy danh sách toàn bộ tài liệu đang được lưu trong bộ nhớ AI |
| `POST` | `/api/documents/upload` | Tải lên file (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`), cắt đoạn và lưu vào Vector Store |
| `DELETE` | `/api/documents/{fileName}` | Xóa riêng một tài liệu cụ thể khỏi bộ nhớ |
| `DELETE` | `/api/documents` | Xóa toàn bộ tài liệu đã nạp trong bộ nhớ AI |
| `POST` | `/api/chat` | Gửi câu hỏi (`question`, `sessionId`, `fileFilter`), tự động lưu lịch sử và nhận câu trả lời kèm trích dẫn nguồn (`sources`) |
| `GET` | `/api/chat/sessions` | Lấy danh sách toàn bộ các phiên hội thoại đã lưu |
| `POST` | `/api/chat/sessions` | Tạo một phiên hội thoại mới |
| `GET` | `/api/chat/sessions/{sessionId}` | Xem toàn bộ lịch sử tin nhắn và trích dẫn nguồn của một phiên hội thoại |
| `PUT` | `/api/chat/sessions/{sessionId}` | Đổi tên tiêu đề của một phiên hội thoại |
| `DELETE` | `/api/chat/sessions/{sessionId}` | Xóa một phiên hội thoại cụ thể và giải phóng bộ nhớ ngữ cảnh của phiên đó |
| `DELETE` | `/api/chat/sessions` | Xóa toàn bộ lịch sử các phiên hội thoại |

---

## 🏗️ Kiến trúc hệ thống
Xem chi tiết luồng hoạt động (Mermaid Diagram) và cấu trúc thư mục tại file [ARCHITECTURE.md](./ARCHITECTURE.md).