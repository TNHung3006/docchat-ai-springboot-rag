# 📚 DocChat AI - Hỏi Đáp Tài Liệu Với Java Spring Boot & Google Gemini API (RAG)

Một ứng dụng **RAG (Retrieval-Augmented Generation)** hoàn chỉnh được viết bằng **Java 17+**, **Spring Boot 3**, và **LangChain4j** kết hợp cùng **Google Gemini LLM API**.

Ứng dụng cho phép người dùng kéo thả hoặc tải lên nhiều tài liệu cá nhân (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`, `.csv`) và trò chuyện, đặt câu hỏi trực tiếp về nội dung bên trong tài liệu đó.

![Giao diện DocChat AI](./docs/screenshot.png)

---

## ✨ Tính năng nổi bật
* **Kéo & Thả (Drag-and-Drop) và Nạp nhiều file cùng lúc (Multi-file Upload):** Hỗ trợ PDF, Word, Excel, PowerPoint, TXT, Markdown, CSV. Tự động trích xuất văn bản bằng Apache PDFBox & Apache POI, hiển thị dung lượng file và cắt nhỏ thành các đoạn (Chunking).
* **Xem chi tiết các đoạn văn (👁️ Document Chunks Preview):** Bấm trực tiếp vào từng tài liệu đã nạp để xem toàn bộ các đoạn văn (chunks) mà AI đã băm nhỏ, hỗ trợ lọc tìm kiếm từ khóa ngay bên trong các đoạn văn.
* **Trích dẫn nguồn tài liệu (Source Citations):** Hiển thị rõ câu trả lời được trích từ file nào và đoạn văn bản gốc nào trong tài liệu.
* **Lọc phạm vi tìm kiếm & Quản lý từng file:** Xem danh sách tài liệu đã nạp, xóa riêng từng file hoặc chọn chỉ hỏi đáp trên một tài liệu cụ thể.
* **Lưu trữ Vector & Lịch sử trò chuyện bền vững (Persistent Local Store):** Tự động lưu trữ Vector (`data/vector-store.json`), metadata (`data/documents-meta.json`), danh sách đoạn cắt (`data/document-chunks.json`) và toàn bộ lịch sử hội thoại (`data/chat-history.json`) xuống ổ đĩa.
* **Quản lý & Tìm kiếm đa phiên hội thoại (`@MemoryId`):** Tạo nhiều cuộc trò chuyện theo từng chủ đề, tìm kiếm nhanh cuộc trò chuyện theo từ khóa, tự động đặt tiêu đề, đổi tên (`✏️`) hoặc xóa từng phiên bất kỳ lúc nào.
* **Tiện ích khung Chat & Xuất báo cáo Markdown:** Sao chép nhanh từng câu trả lời (`📋 Sao chép`), xuất toàn bộ nội dung cuộc trò chuyện kèm trích dẫn nguồn ra file `.md` (`📥 Xuất .md`), và hỗ trợ hiển thị Markdown nâng cao (Code blocks, tiêu đề, danh sách đánh số).
* **Bảng Cài đặt AI trực tiếp trên Giao diện (`⚙️ Cài đặt`):** Thay đổi `GEMINI_API_KEY`, chọn dòng model Gemini, chỉnh độ sáng tạo (`temperature`), số đoạn trích dẫn tối đa (`maxResults`) và ngưỡng điểm tương đồng (`minScore`) ngay trên Web mà không cần khởi động lại Server.

---

## 🚀 Hướng dẫn cài đặt và chạy dự án

### Bước 1: Lấy Google Gemini API Key (Miễn phí)
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Đăng nhập tài khoản Google và nhấn **Create API Key**.
3. Copy mã API Key vừa tạo.

### Bước 2: Cấu hình API Key và Chạy ứng dụng
Đặt biến môi trường trên Terminal (PowerShell) hoặc nhập trực tiếp trong mục **⚙️ Cài đặt** trên giao diện Web sau khi khởi động:

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
| `POST` | `/api/documents/upload` | Tải lên 1 file tài liệu, cắt đoạn và lưu vào Vector Store |
| `POST` | `/api/documents/upload-batch` | Tải lên nhiều file tài liệu cùng lúc (Multi-file & Drag-and-Drop) |
| `GET` | `/api/documents/{fileName}/chunks` | Xem danh sách toàn bộ các đoạn văn (chunks) đã cắt của một tài liệu |
| `DELETE` | `/api/documents/{fileName}` | Xóa riêng một tài liệu cụ thể khỏi bộ nhớ |
| `DELETE` | `/api/documents` | Xóa toàn bộ tài liệu đã nạp trong bộ nhớ AI |
| `POST` | `/api/chat` | Gửi câu hỏi (`question`, `sessionId`, `fileFilter`), tự động lưu lịch sử và nhận câu trả lời kèm trích dẫn nguồn (`sources`) |
| `GET` | `/api/chat/sessions` | Lấy danh sách toàn bộ các phiên hội thoại đã lưu |
| `POST` | `/api/chat/sessions` | Tạo một phiên hội thoại mới |
| `GET` | `/api/chat/sessions/{sessionId}` | Xem toàn bộ lịch sử tin nhắn và trích dẫn nguồn của một phiên hội thoại |
| `PUT` | `/api/chat/sessions/{sessionId}` | Đổi tên tiêu đề của một phiên hội thoại |
| `DELETE` | `/api/chat/sessions/{sessionId}` | Xóa một phiên hội thoại cụ thể và giải phóng bộ nhớ ngữ cảnh của phiên đó |
| `DELETE` | `/api/chat/sessions` | Xóa toàn bộ lịch sử các phiên hội thoại |
| `GET` | `/api/settings` | Lấy thông số cài đặt AI & RAG hiện tại (API Key đã che, Model, Temperature, MaxResults, MinScore) |
| `PUT` | `/api/settings` | Cập nhật trực tiếp API Key, Model Gemini và tham số RAG lúc Runtime |

---

## 🏗️ Kiến trúc hệ thống
Xem chi tiết luồng hoạt động (Mermaid Diagram) và cấu trúc thư mục tại file [ARCHITECTURE.md](./ARCHITECTURE.md).
