package com.example.docchat.controller;

import com.example.docchat.dto.ChatRequest;
import com.example.docchat.dto.ChatResponse;
import com.example.docchat.service.DocumentAssistant;
import com.example.docchat.service.DocumentIngestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final DocumentIngestionService ingestionService;
    private final DocumentAssistant documentAssistant;

    public ChatController(DocumentIngestionService ingestionService,
                          DocumentAssistant documentAssistant) {
        this.ingestionService = ingestionService;
        this.documentAssistant = documentAssistant;
    }

    /**
     * API 1: Tải lên tài liệu (PDF hoặc TXT)
     */
    @PostMapping("/documents/upload")
    public ResponseEntity<Map<String, Object>> uploadDocument(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Vui lòng chọn một file hợp lệ!"
            ));
        }

        try {
            int chunksCount = ingestionService.ingestDocument(file);
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", String.format("Đã đọc và ghi nhớ tài liệu '%s' (%d đoạn văn).",
                            file.getOriginalFilename(), chunksCount),
                    "chunks", chunksCount
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", "Lỗi khi xử lý tài liệu: " + e.getMessage()
            ));
        }
    }

    /**
     * API 2: Xóa toàn bộ tài liệu khỏi bộ nhớ AI
     */
    @DeleteMapping("/documents")
    public ResponseEntity<Map<String, String>> clearDocuments() {
        ingestionService.clearAllDocuments();
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Đã xóa toàn bộ tài liệu khỏi bộ nhớ AI."
        ));
    }

    /**
     * API 3: Đặt câu hỏi với AI về nội dung tài liệu
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        if (request == null || request.question() == null || request.question().isBlank()) {
            return ResponseEntity.badRequest().body(new ChatResponse("Vui lòng nhập câu hỏi của bạn."));
        }

        try {
            String answer = documentAssistant.chat(request.question());
            return ResponseEntity.ok(new ChatResponse(answer));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ChatResponse(
                    "Lỗi kết nối tới LLM API (Kiểm tra lại GEMINI_API_KEY của bạn): " + e.getMessage()
            ));
        }
    }
}
