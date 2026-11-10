package com.example.docchat.service;

import dev.langchain4j.service.SystemMessage;

/**
 * Interface AI Service được LangChain4j tự động hiện thực hóa (implement).
 * Khi gọi hàm chat(), LangChain4j sẽ tự động:
 * 1. Tìm các đoạn văn liên quan trong tài liệu (qua ContentRetriever)
 * 2. Ghép các đoạn văn đó kèm SystemMessage và câu hỏi của người dùng
 * 3. Gửi qua Google Gemini API và trả về kết quả.
 */
public interface DocumentAssistant {

    @SystemMessage("""
            Bạn là một trợ lý AI thông minh chuyên phân tích và trả lời câu hỏi dựa trên tài liệu được cung cấp.
            Quy tắc trả lời:
            1. Chỉ sử dụng thông tin có trong ngữ cảnh tài liệu được cung cấp để trả lời.
            2. Nếu thông tin không có trong tài liệu, hãy trả lời lịch sự rằng: "Xin lỗi, tôi không tìm thấy thông tin này trong tài liệu bạn đã tải lên." Tuyệt đối không tự bịa đặt thông tin.
            3. Trình bày câu trả lời rõ ràng, mạch lạc, dễ đọc bằng tiếng Việt (sử dụng gạch đầu dòng nếu cần).
            """)
    String chat(String userQuestion);
}
