package com.example.docchat.service;

import com.example.docchat.config.AiConfig;
import com.example.docchat.dto.ChatMessageRecord;
import com.example.docchat.dto.ChatSession;
import com.example.docchat.dto.ChatSessionSummary;
import com.example.docchat.dto.SourceCitation;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ChatHistoryService {

    public static final Path CHAT_HISTORY_FILE = Paths.get("data", "chat-history.json");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    private static final String DEFAULT_TITLE = "Cuộc trò chuyện mới";
    private static final int MAX_MESSAGES_PER_SESSION = 100;

    private final ObjectMapper objectMapper;
    private final AiConfig aiConfig;
    private final Map<String, ChatSession> sessionMap = new LinkedHashMap<>();

    public ChatHistoryService(ObjectMapper objectMapper, AiConfig aiConfig) {
        this.objectMapper = objectMapper;
        this.aiConfig = aiConfig;
    }

    @PostConstruct
    public synchronized void init() {
        try {
            Files.createDirectories(CHAT_HISTORY_FILE.getParent());
            if (Files.exists(CHAT_HISTORY_FILE)) {
                List<ChatSession> savedSessions = objectMapper.readValue(
                        CHAT_HISTORY_FILE.toFile(),
                        new TypeReference<List<ChatSession>>() {}
                );
                for (ChatSession session : savedSessions) {
                    if (session != null && session.id() != null) {
                        List<ChatMessageRecord> msgs = session.messages() != null
                                ? new ArrayList<>(session.messages())
                                : new ArrayList<>();
                        ChatSession normalized = new ChatSession(
                                session.id(),
                                (session.title() != null && !session.title().isBlank()) ? session.title() : DEFAULT_TITLE,
                                session.createdAt(),
                                session.updatedAt(),
                                msgs
                        );
                        sessionMap.put(session.id(), normalized);
                        aiConfig.restoreSessionMemory(session.id(), msgs);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Không thể đọc file lịch sử trò chuyện, khởi tạo mới: " + e.getMessage());
        }
    }

    /**
     * Lấy danh sách tóm tắt các phiên trò chuyện (phiên mới cập nhật nhất lên đầu)
     */
    public synchronized List<ChatSessionSummary> listSessions() {
        List<ChatSession> all = new ArrayList<>(sessionMap.values());
        Collections.reverse(all);
        List<ChatSessionSummary> summaries = new ArrayList<>(all.size());
        for (ChatSession s : all) {
            int count = s.messages() != null ? s.messages().size() : 0;
            summaries.add(new ChatSessionSummary(s.id(), s.title(), s.updatedAt(), count));
        }
        return summaries;
    }

    /**
     * Lấy chi tiết 1 phiên trò chuyện theo ID (bao gồm toàn bộ tin nhắn và nguồn trích dẫn)
     */
    public synchronized ChatSession getSession(String sessionId) {
        return sessionMap.get(sessionId);
    }

    /**
     * Tạo một phiên trò chuyện mới
     */
    public synchronized ChatSession createSession(String customTitle) {
        String id = "session-" + UUID.randomUUID().toString().substring(0, 8) + "-" + System.currentTimeMillis();
        String now = LocalDateTime.now().format(TIME_FMT);
        String title = (customTitle != null && !customTitle.isBlank()) ? customTitle.trim() : DEFAULT_TITLE;
        ChatSession session = new ChatSession(id, title, now, now, new ArrayList<>());
        sessionMap.put(id, session);
        persistState();
        return session;
    }

    /**
     * Lưu cặp câu hỏi của người dùng và câu trả lời của AI (kèm trích dẫn nguồn) vào phiên chat
     */
    public synchronized ChatSession appendExchange(String sessionId,
                                                   String userQuestion,
                                                   String aiAnswer,
                                                   List<SourceCitation> sources) {
        String now = LocalDateTime.now().format(TIME_FMT);
        ChatSession existing = sessionMap.remove(sessionId);

        List<ChatMessageRecord> messages;
        String createdAt;
        String title;

        if (existing == null) {
            messages = new ArrayList<>();
            createdAt = now;
            title = buildAutoTitle(userQuestion);
        } else {
            messages = new ArrayList<>(existing.messages() != null ? existing.messages() : List.of());
            createdAt = existing.createdAt() != null ? existing.createdAt() : now;
            if (messages.isEmpty() || DEFAULT_TITLE.equalsIgnoreCase(existing.title())) {
                title = buildAutoTitle(userQuestion);
            } else {
                title = existing.title();
            }
        }

        messages.add(new ChatMessageRecord("user", userQuestion, List.of(), now));
        messages.add(new ChatMessageRecord(
                "ai",
                aiAnswer,
                sources != null ? List.copyOf(sources) : List.of(),
                now
        ));

        while (messages.size() > MAX_MESSAGES_PER_SESSION) {
            messages.remove(0);
        }

        ChatSession updated = new ChatSession(sessionId, title, createdAt, now, messages);
        // Đưa phiên vừa cập nhật lên cuối LinkedHashMap (để khi đảo ngược sẽ nằm trên cùng)
        sessionMap.put(sessionId, updated);
        persistState();
        return updated;
    }

    /**
     * Đổi tên tiêu đề của một phiên trò chuyện
     */
    public synchronized ChatSession renameSession(String sessionId, String newTitle) {
        ChatSession existing = sessionMap.get(sessionId);
        if (existing == null) {
            return null;
        }
        String cleanTitle = (newTitle != null && !newTitle.isBlank()) ? newTitle.trim() : existing.title();
        ChatSession updated = new ChatSession(
                existing.id(),
                cleanTitle,
                existing.createdAt(),
                existing.updatedAt(),
                existing.messages()
        );
        sessionMap.put(sessionId, updated);
        persistState();
        return updated;
    }

    /**
     * Xóa 1 phiên trò chuyện cụ thể và giải phóng bộ nhớ ngữ cảnh của phiên đó
     */
    public synchronized boolean deleteSession(String sessionId) {
        ChatSession removed = sessionMap.remove(sessionId);
        aiConfig.clearSessionMemory(sessionId);
        persistState();
        return removed != null;
    }

    /**
     * Xóa toàn bộ lịch sử trò chuyện
     */
    public synchronized void clearAllSessions() {
        sessionMap.clear();
        aiConfig.clearAllSessionMemories();
        persistState();
    }

    private String buildAutoTitle(String question) {
        if (question == null || question.isBlank()) {
            return DEFAULT_TITLE;
        }
        String cleaned = question.replaceAll("\\s+", " ").trim();
        if (cleaned.length() > 42) {
            return cleaned.substring(0, 42) + "...";
        }
        return cleaned;
    }

    private void persistState() {
        try {
            Files.createDirectories(CHAT_HISTORY_FILE.getParent());
            objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValue(CHAT_HISTORY_FILE.toFile(), new ArrayList<>(sessionMap.values()));
        } catch (Exception e) {
            System.err.println("Không thể lưu lịch sử trò chuyện xuống đĩa: " + e.getMessage());
        }
    }
}
