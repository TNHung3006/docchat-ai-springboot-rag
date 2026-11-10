package com.example.docchat.config;

import com.example.docchat.service.DocumentAssistant;
import com.fasterxml.jackson.databind.JsonNode;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2.AllMiniLmL6V2EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Configuration
public class AiConfig {

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    @Value("${ai.gemini.model-name:gemini-3.5-flash-lite}")
    private String geminiModelName;

    /**
     * 1. Kho lưu trữ Vector trên RAM (In-Memory Vector Store)
     * Lưu các đoạn văn bản từ tài liệu sau khi đã chuyển thành Vector.
     */
    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        return new InMemoryEmbeddingStore<>();
    }

    /**
     * 2. Mô hình Embedding chạy trực tiếp trên máy (Local In-Process)
     * Chuyển đổi đoạn văn bản và câu hỏi thành mảng số học (Vector) hoàn toàn miễn phí.
     */
    @Bean
    public EmbeddingModel embeddingModel() {
        return new AllMiniLmL6V2EmbeddingModel();
    }

    /**
     * 3. Kết nối trực tiếp tới Google Gemini REST API (Hỗ trợ các dòng Gemini 3.5+ mới nhất)
     * Tự động chuyển đổi sang model dự phòng nếu model chính bị quá tải (503).
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
     * 4. Bộ truy xuất nội dung (Content Retriever)
     * Tìm ra tối đa 8 đoạn văn trong tài liệu có độ tương đồng cao nhất với câu hỏi.
     */
    @Bean
    public ContentRetriever contentRetriever(EmbeddingStore<TextSegment> embeddingStore,
                                             EmbeddingModel embeddingModel) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(embeddingStore)
                .embeddingModel(embeddingModel)
                .maxResults(8)
                .minScore(0.3)
                .build();
    }

    /**
     * 5. Khởi tạo trợ lý AI (DocumentAssistant) kết hợp LLM + Bộ nhớ hội thoại + RAG Retriever
     */
    @Bean
    public DocumentAssistant documentAssistant(ChatLanguageModel chatLanguageModel,
                                               ContentRetriever contentRetriever) {
        return AiServices.builder(DocumentAssistant.class)
                .chatLanguageModel(chatLanguageModel)
                .chatMemory(MessageWindowChatMemory.withMaxMessages(10))
                .contentRetriever(contentRetriever)
                .build();
    }
}
