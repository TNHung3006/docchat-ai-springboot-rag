package com.example.docchat.config;

import com.example.docchat.dto.ChatMessageRecord;
import com.example.docchat.service.DocumentAssistant;
import com.fasterxml.jackson.databind.JsonNode;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2.AllMiniLmL6V2EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class AiConfig {

    public static final Path VECTOR_STORE_FILE = Paths.get("data", "vector-store.json");
    private static final ThreadLocal<String> ACTIVE_FILE_FILTER = new ThreadLocal<>();

    private final Map<Object, ChatMemory> memoryMap = new ConcurrentHashMap<>();

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    @Value("${ai.gemini.model-name:gemini-3.5-flash-lite}")
    private String geminiModelName;

    public static void setFileFilter(String fileName) {
        if (fileName == null || fileName.isBlank() || "ALL".equalsIgnoreCase(fileName)) {
            ACTIVE_FILE_FILTER.remove();
        } else {
            ACTIVE_FILE_FILTER.set(fileName);
        }
    }

    public static void clearFileFilter() {
        ACTIVE_FILE_FILTER.remove();
    }

    public void clearSessionMemory(String sessionId) {
        if (sessionId != null) {
            ChatMemory memory = memoryMap.remove(sessionId);
            if (memory != null) {
                memory.clear();
            }
        }
    }

    public void clearAllSessionMemories() {
        memoryMap.values().forEach(ChatMemory::clear);
        memoryMap.clear();
    }

    /**
     * Khôi phục bộ nhớ ngữ cảnh của AI từ lịch sử tin nhắn đã lưu trên đĩa khi khởi động lại Server
     */
    public void restoreSessionMemory(String sessionId, List<ChatMessageRecord> messages) {
        if (sessionId == null || messages == null || messages.isEmpty()) {
            return;
        }
        ChatMemory memory = MessageWindowChatMemory.withMaxMessages(12);
        int startIdx = Math.max(0, messages.size() - 12);
        for (int i = startIdx; i < messages.size(); i++) {
            ChatMessageRecord msg = messages.get(i);
            if (msg.content() == null || msg.content().isBlank()) {
                continue;
            }
            if ("user".equalsIgnoreCase(msg.role())) {
                memory.add(UserMessage.from(msg.content()));
            } else if ("ai".equalsIgnoreCase(msg.role())) {
                memory.add(AiMessage.from(msg.content()));
            }
        }
        memoryMap.put(sessionId, memory);
    }

    /**
     * 1. Kho lưu trữ Vector (In-Memory kết hợp lưu trữ bền vững xuống file JSON)
     * Tự động khôi phục dữ liệu Vector đã nạp từ lần chạy trước nếu có.
     */
    @Bean
    public InMemoryEmbeddingStore<TextSegment> embeddingStore() {
        try {
            if (Files.exists(VECTOR_STORE_FILE)) {
                return InMemoryEmbeddingStore.fromFile(VECTOR_STORE_FILE);
            }
        } catch (Exception e) {
            System.err.println("Không thể đọc vector store cũ, khởi tạo mới: " + e.getMessage());
        }
        return new InMemoryEmbeddingStore<>();
    }

    /**
     * 2. Mô hình Embedding chạy trực tiếp trên máy (Local In-Process)
     */
    @Bean
    public EmbeddingModel embeddingModel() {
        return new AllMiniLmL6V2EmbeddingModel();
    }

    /**
     * 3. Kết nối trực tiếp tới Google Gemini REST API (Hỗ trợ các dòng Gemini mới nhất & Auto-Fallback)
     */
    @Bean
    public ChatLanguageModel chatLanguageModel() {
        RestClient restClient = RestClient.create();

        return (List<ChatMessage> messages) -> {
            StringBuilder fullPrompt = new StringBuilder();
            for (ChatMessage msg : messages) {
                if (msg instanceof SystemMessage sys) {
                    fullPrompt.append("[Hướng dẫn hệ thống]:\n").append(sys.text()).append("\n\n");
                } else if (msg instanceof UserMessage usr) {
                    fullPrompt.append("[Người dùng]:\n").append(usr.singleText()).append("\n\n");
                } else if (msg instanceof AiMessage ai) {
                    fullPrompt.append("[Trợ lý AI]:\n").append(ai.text()).append("\n\n");
                }
            }

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(Map.of("text", fullPrompt.toString())))
                    ),
                    "generationConfig", Map.of("temperature", 0.2)
            );

            List<String> candidateModels = new ArrayList<>();
            candidateModels.add(geminiModelName);
            if (!candidateModels.contains("gemini-3.5-flash-lite")) {
                candidateModels.add("gemini-3.5-flash-lite");
            }
            if (!candidateModels.contains("gemini-3.5-flash")) {
                candidateModels.add("gemini-3.5-flash");
            }

            Exception lastError = null;
            for (String model : candidateModels) {
                try {
                    String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                            + model + ":generateContent?key=" + geminiApiKey;

                    JsonNode responseNode = restClient.post()
                            .uri(url)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(requestBody)
                            .retrieve()
                            .body(JsonNode.class);

                    if (responseNode != null && responseNode.has("candidates")) {
                        JsonNode parts = responseNode.path("candidates").get(0)
                                .path("content").path("parts");
                        StringBuilder answer = new StringBuilder();
                        for (JsonNode part : parts) {
                            if (part.has("text")) {
                                answer.append(part.get("text").asText());
                            }
                        }
                        return Response.from(AiMessage.from(answer.toString()));
                    }
                } catch (Exception e) {
                    lastError = e;
                }
            }

            throw new RuntimeException("Không thể gọi Gemini API: "
                    + (lastError != null ? lastError.getMessage() : "Unknown error"), lastError);
        };
    }

    /**
     * 4. Bộ truy xuất nội dung (Content Retriever) có hỗ trợ lọc theo tên tài liệu (Dynamic Filter)
     */
    @Bean
    public ContentRetriever contentRetriever(InMemoryEmbeddingStore<TextSegment> embeddingStore,
                                             EmbeddingModel embeddingModel) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(embeddingStore)
                .embeddingModel(embeddingModel)
                .maxResults(6)
                .minScore(0.3)
                .dynamicFilter(query -> {
                    String selectedFile = ACTIVE_FILE_FILTER.get();
                    if (selectedFile != null && !selectedFile.isBlank()) {
                        return MetadataFilterBuilder.metadataKey("file_name").isEqualTo(selectedFile);
                    }
                    return null;
                })
                .build();
    }

    /**
     * 5. Quản lý bộ nhớ hội thoại độc lập cho từng phiên chat (Session ID)
     */
    @Bean
    public ChatMemoryProvider chatMemoryProvider() {
        return memoryId -> memoryMap.computeIfAbsent(
                memoryId,
                id -> MessageWindowChatMemory.withMaxMessages(12)
        );
    }

    /**
     * 6. Khởi tạo trợ lý AI (DocumentAssistant) kết hợp LLM + Multi-session Memory + RAG Retriever
     */
    @Bean
    public DocumentAssistant documentAssistant(ChatLanguageModel chatLanguageModel,
                                               ContentRetriever contentRetriever,
                                               ChatMemoryProvider chatMemoryProvider) {
        return AiServices.builder(DocumentAssistant.class)
                .chatLanguageModel(chatLanguageModel)
                .chatMemoryProvider(chatMemoryProvider)
                .contentRetriever(contentRetriever)
                .build();
    }
}