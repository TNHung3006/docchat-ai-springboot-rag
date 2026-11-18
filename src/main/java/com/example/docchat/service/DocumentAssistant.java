package com.example.docchat.service;

import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Interface AI Service được LangChain4j tự động hiện thực hóa (implement).
 * Hỗ trợ:
 * 1. Tách biệt bộ nhớ hội thoại theo từng phiên (@MemoryId)
 * 2. Trả về Result<String> bao gồm cả câu trả lời và danh sách nguồn trích dẫn (Source Citations)
 */
public interface DocumentAssistant {

    @SystemMessage("""
            Bạn là một trợ lý AI thông minh chuyên phân tích và trả lời câu hỏi dựa trên tài liệu được cung cấp.
            Quy tắc trả lời:
            1. Chỉ sử dụng thông tin có trong ngữ cảnh tài liệu được cung cấp để trả lời.
            2. Nếu thông tin không có trong tài liệu, hãy trả lời lịch sự rằng: "Xin lỗi, tôi không tìm thấy thông tin này trong tài liệu bạn đã tải lên." Tuyệt đối không tự bịa đặt thông tin.
            3. Trình bày câu trả lời rõ ràng, mạch lạc, dễ đọc bằng tiếng Việt (sử dụng in đậm **...** và gạch đầu dòng nếu cần).
            """)
    Result<String> chat(@MemoryId String sessionId, @UserMessage String userQuestion);
}
