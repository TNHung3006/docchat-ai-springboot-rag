package com.example.docchat.controller;

import com.example.docchat.config.AiConfig;
import com.example.docchat.dto.AiSettingsRequest;
import com.example.docchat.dto.AiSettingsResponse;
import com.example.docchat.dto.ChatRequest;
import com.example.docchat.dto.ChatResponse;
import com.example.docchat.dto.ChatSession;
import com.example.docchat.dto.ChatSessionSummary;
import com.example.docchat.dto.DocumentInfo;
import com.example.docchat.dto.SourceCitation;
import com.example.docchat.service.ChatHistoryService;
import com.example.docchat.service.DocumentAssistant;
import com.example.docchat.service.DocumentIngestionService;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.service.Result;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final DocumentIngestionService ingestionService;
    private final DocumentAssistant documentAssistant;
    private final AiConfig aiConfig;
    private final ChatHistoryService chatHistoryService;

    public ChatController(DocumentIngestionService ingestionService,
                          DocumentAssistant documentAssistant,
                          AiConfig aiConfig,
                          ChatHistoryService chatHistoryService) {
        this.ingestionService = ingestionService;
        this.documentAssistant = documentAssistant;
        this.aiConfig = aiConfig;
        this.chatHistoryService = chatHistoryService;
    }

    /**
     * API 1: Lấy danh sách các tài liệu đã nạp
     */
    @GetMapping("/documents")
    public ResponseEntity<List<DocumentInfo>> listDocuments() {
        return ResponseEntity.ok(ingestionService.listDocuments());
    }

    /**
     * API 2: Tải lên 1 tài liệu (PDF, DOCX, XLSX, PPTX, TXT)
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
            DocumentInfo docInfo = ingestionService.ingestDocument(file);
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", String.format("Đã đọc và lưu trữ tài liệu '%s' (%d đoạn văn).",
                            docInfo.fileName(), docInfo.chunks()),
                    "chunks", docInfo.chunks(),
                    "document", docInfo
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", "Lỗi khi xử lý tài liệu: " + e.getMessage()
            ));
        }
    }

    /**
     * API 2b: Tải lên nhiều tài liệu cùng lúc (Multi-file Upload & Drag-and-Drop)
     */
    @PostMapping("/documents/upload-batch")
    public ResponseEntity<Map<String, Object>> uploadBatchDocuments(@RequestParam("files") MultipartFile[] files) {
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Vui lòng chọn ít nhất một file hợp lệ!"
            ));
        }

        List<DocumentInfo> uploaded = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int totalChunks = 0;

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            try {
                DocumentInfo info = ingestionService.ingestDocument(file);
                uploaded.add(info);
                totalChunks += info.chunks();
            } catch (Exception e) {
                errors.add((file.getOriginalFilename() != null ? file.getOriginalFilename() : "file")
                        + ": " + e.getMessage());
            }
        }

        if (uploaded.isEmpty()) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", "Không thể xử lý tài liệu: " + String.join("; ", errors)
            ));
        }

        String msg = String.format("Đã nạp thành công %d tài liệu (tổng cộng %d đoạn văn).",
                uploaded.size(), totalChunks);
        if (!errors.isEmpty()) {
            msg += " Lỗi một số file: " + String.join("; ", errors);
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", msg,
                "totalChunks", totalChunks,
                "documents", uploaded
        ));
    }

    /**
     * API 2c: Xem danh sách các đoạn văn (chunks) đã cắt của một tài liệu
     */
    @GetMapping("/documents/{fileName}/chunks")
    public ResponseEntity<Map<String, Object>> getDocumentChunks(@PathVariable("fileName") String fileName) {
        List<String> chunks = ingestionService.getDocumentChunks(fileName);
        return ResponseEntity.ok(Map.of(
                "fileName", fileName,
                "totalChunks", chunks.size(),
                "chunks", chunks
        ));
    }

    /**
     * API 3: Xóa 1 tài liệu cụ thể theo tên file
     */
    @DeleteMapping("/documents/{fileName}")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable("fileName") String fileName) {
        ingestionService.deleteDocument(fileName);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Đã xóa tài liệu: " + fileName
        ));
    }

    /**
     * API 4: Xóa toàn bộ tài liệu khỏi bộ nhớ AI
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
     * API 5: Đặt câu hỏi với AI về nội dung tài liệu (hỗ trợ Session Memory, Lọc file & Trích dẫn nguồn)
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        if (request == null || request.question() == null || request.question().isBlank()) {
            return ResponseEntity.badRequest().body(new ChatResponse("Vui lòng nhập câu hỏi của bạn."));
        }

        String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId()
                : "default-session";

        try {
            AiConfig.setFileFilter(request.fileFilter());
            Result<String> result = documentAssistant.chat(sessionId, request.question());

            List<SourceCitation> citations = new ArrayList<>();
            Set<String> seenSnippets = new LinkedHashSet<>();

            if (result.sources() != null) {
                for (Content content : result.sources()) {
                    TextSegment segment = content.textSegment();
                    if (segment != null) {
                        String fileName = segment.metadata().getString("file_name");
                        if (fileName == null || fileName.isBlank()) {
                            fileName = "Tài liệu đã tải lên";
                        }
                        String snippet = segment.text().trim();
                        if (snippet.length() > 220) {
                            snippet = snippet.substring(0, 220) + "...";
                        }
                        String key = fileName + "::" + snippet;
                        if (seenSnippets.add(key)) {
                            citations.add(new SourceCitation(fileName, snippet));
                        }
                    }
                }
            }

            chatHistoryService.appendExchange(sessionId, request.question(), result.content(), citations);
            return ResponseEntity.ok(new ChatResponse(result.content(), citations));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ChatResponse(
                    "Lỗi kết nối tới LLM API (Kiểm tra lại GEMINI_API_KEY trong mục ⚙️ Cài đặt): " + e.getMessage()
            ));
        } finally {
            AiConfig.clearFileFilter();
        }
    }

    /**
     * API 6: Lấy danh sách các phiên hội thoại đã lưu
     */
    @GetMapping("/chat/sessions")
    public ResponseEntity<List<ChatSessionSummary>> listChatSessions() {
        return ResponseEntity.ok(chatHistoryService.listSessions());
    }

    /**
     * API 7: Tạo một phiên hội thoại mới
     */
    @PostMapping("/chat/sessions")
    public ResponseEntity<ChatSession> createChatSession(
            @RequestBody(required = false) Map<String, String> payload) {
        String title = payload != null ? payload.get("title") : null;
        return ResponseEntity.ok(chatHistoryService.createSession(title));
    }

    /**
     * API 8: Lấy chi tiết toàn bộ tin nhắn và trích dẫn nguồn của 1 phiên hội thoại
     */
    @GetMapping("/chat/sessions/{sessionId}")
    public ResponseEntity<ChatSession> getChatSession(@PathVariable("sessionId") String sessionId) {
        ChatSession session = chatHistoryService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    /**
     * API 9: Đổi tên tiêu đề của một phiên hội thoại
     */
    @PutMapping("/chat/sessions/{sessionId}")
    public ResponseEntity<ChatSession> renameChatSession(
            @PathVariable("sessionId") String sessionId,
            @RequestBody Map<String, String> payload) {
        String newTitle = payload != null ? payload.get("title") : null;
        ChatSession updated = chatHistoryService.renameSession(sessionId, newTitle);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    /**
     * API 10: Xóa 1 phiên hội thoại cụ thể
     */
    @DeleteMapping("/chat/sessions/{sessionId}")
    public ResponseEntity<Map<String, String>> deleteChatSession(@PathVariable("sessionId") String sessionId) {
        chatHistoryService.deleteSession(sessionId);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Đã xóa cuộc trò chuyện."
        ));
    }

    /**
     * API 11: Xóa toàn bộ lịch sử các phiên hội thoại
     */
    @DeleteMapping("/chat/sessions")
    public ResponseEntity<Map<String, String>> clearAllChatSessions() {
        chatHistoryService.clearAllSessions();
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Đã xóa toàn bộ lịch sử trò chuyện."
        ));
    }

    /**
     * API 12: Xóa lịch sử hội thoại của một phiên chat (Tương thích ngược)
     */
    @DeleteMapping("/chat/memory/{sessionId}")
    public ResponseEntity<Map<String, String>> clearChatMemory(@PathVariable("sessionId") String sessionId) {
        chatHistoryService.deleteSession(sessionId);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Đã làm mới phiên hội thoại."
        ));
    }

    /**
     * API 13: Lấy thông tin cài đặt AI hiện tại
     */
    @GetMapping("/settings")
    public ResponseEntity<AiSettingsResponse> getAiSettings() {
        return ResponseEntity.ok(aiConfig.getSettings());
    }

    /**
     * API 14: Cập nhật cài đặt AI trực tiếp lúc Runtime (API Key, Model, Temperature, MaxResults, MinScore)
     */
    @PutMapping("/settings")
    public ResponseEntity<AiSettingsResponse> updateAiSettings(@RequestBody AiSettingsRequest request) {
        return ResponseEntity.ok(aiConfig.updateSettings(request));
    }
}