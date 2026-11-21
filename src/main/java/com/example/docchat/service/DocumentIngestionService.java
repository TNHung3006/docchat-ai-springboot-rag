package com.example.docchat.service;

import com.example.docchat.config.AiConfig;
import com.example.docchat.dto.DocumentInfo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.DocumentParser;
import dev.langchain4j.data.document.parser.TextDocumentParser;
import dev.langchain4j.data.document.parser.apache.pdfbox.ApachePdfBoxDocumentParser;
import dev.langchain4j.data.document.parser.apache.poi.ApachePoiDocumentParser;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DocumentIngestionService {

    private static final Path META_FILE = Paths.get("data", "documents-meta.json");
    private static final Path CHUNKS_FILE = Paths.get("data", "document-chunks.json");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final InMemoryEmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;
    private final ObjectMapper objectMapper;
    private final Map<String, DocumentInfo> documentRegistry = new LinkedHashMap<>();
    private final Map<String, List<String>> documentChunksMap = new LinkedHashMap<>();

    public DocumentIngestionService(InMemoryEmbeddingStore<TextSegment> embeddingStore,
                                    EmbeddingModel embeddingModel,
                                    ObjectMapper objectMapper) {
        this.embeddingStore = embeddingStore;
        this.embeddingModel = embeddingModel;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(META_FILE.getParent());
            if (Files.exists(META_FILE)) {
                List<DocumentInfo> savedDocs = objectMapper.readValue(
                        META_FILE.toFile(),
                        new TypeReference<List<DocumentInfo>>() {}
                );
                for (DocumentInfo info : savedDocs) {
                    documentRegistry.put(info.fileName(), info);
                }
            }
            if (Files.exists(CHUNKS_FILE)) {
                Map<String, List<String>> savedChunks = objectMapper.readValue(
                        CHUNKS_FILE.toFile(),
                        new TypeReference<Map<String, List<String>>>() {}
                );
                if (savedChunks != null) {
                    documentChunksMap.putAll(savedChunks);
                }
            }
            recoverChunksFromVectorStoreIfNeeded();
        } catch (Exception e) {
            System.err.println("Không thể đọc metadata tài liệu: " + e.getMessage());
        }
    }

    /**
     * Khôi phục danh sách đoạn văn từ vector-store.json cho các tài liệu cũ đã nạp trước khi có document-chunks.json
     */
    private void recoverChunksFromVectorStoreIfNeeded() {
        try {
            if (!Files.exists(AiConfig.VECTOR_STORE_FILE)) {
                return;
            }
            JsonNode root = objectMapper.readTree(AiConfig.VECTOR_STORE_FILE.toFile());
            JsonNode entries = root.path("entries");
            if (!entries.isArray()) {
                return;
            }
            Map<String, List<String>> extracted = new LinkedHashMap<>();
            for (JsonNode entry : entries) {
                JsonNode segment = entry.path("embedded");
                if (segment.isMissingNode()) {
                    segment = entry.path("textSegment");
                }
                String text = segment.path("text").asText(null);
                JsonNode metaNode = segment.path("metadata");
                if (metaNode.has("metadata")) {
                    metaNode = metaNode.path("metadata");
                }
                String fileName = metaNode.path("file_name").asText(null);
                if (fileName != null && text != null && !text.isBlank()) {
                    extracted.computeIfAbsent(fileName, k -> new ArrayList<>()).add(text);
                }
            }
            boolean updated = false;
            for (Map.Entry<String, List<String>> e : extracted.entrySet()) {
                if (!documentChunksMap.containsKey(e.getKey()) || documentChunksMap.get(e.getKey()).isEmpty()) {
                    documentChunksMap.put(e.getKey(), e.getValue());
                    updated = true;
                }
            }
            if (updated) {
                objectMapper.writerWithDefaultPrettyPrinter()
                        .writeValue(CHUNKS_FILE.toFile(), documentChunksMap);
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * Đọc file PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) hoặc TXT/MD/CSV,
     * xóa bản cũ nếu trùng tên file, cắt nhỏ thành các đoạn văn (Chunks),
     * chuyển thành Vector và lưu bền vững xuống ổ đĩa.
     */
    public synchronized DocumentInfo ingestDocument(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.txt";
        String lowerName = filename.toLowerCase();

        // Xóa các đoạn văn cũ của cùng tên file (chống trùng lặp khi người dùng upload lại file đó)
        removeFromVectorStore(filename);

        DocumentParser parser;
        if (lowerName.endsWith(".pdf")) {
            parser = new ApachePdfBoxDocumentParser();
        } else if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")
                || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")
                || lowerName.endsWith(".pptx") || lowerName.endsWith(".ppt")) {
            parser = new ApachePoiDocumentParser();
        } else {
            parser = new TextDocumentParser();
        }

        try (InputStream inputStream = file.getInputStream()) {
            Document document = parser.parse(inputStream);
            document.metadata().put("file_name", filename);

            // Cắt tài liệu thành các đoạn tối đa 500 ký tự, gối nhau (overlap) 50 ký tự để giữ mạch văn
            var splitter = DocumentSplitters.recursive(500, 50);
            List<TextSegment> segments = splitter.split(document);

            EmbeddingStoreIngestor ingestor = EmbeddingStoreIngestor.builder()
                    .documentSplitter(splitter)
                    .embeddingModel(embeddingModel)
                    .embeddingStore(embeddingStore)
                    .build();

            ingestor.ingest(document);

            List<String> chunkTexts = new ArrayList<>(segments.size());
            for (TextSegment seg : segments) {
                chunkTexts.add(seg.text());
            }
            documentChunksMap.put(filename, chunkTexts);

            DocumentInfo docInfo = new DocumentInfo(
                    filename,
                    segments.size(),
                    file.getSize(),
                    LocalDateTime.now().format(TIME_FMT)
            );
            documentRegistry.put(filename, docInfo);
            persistState();

            return docInfo;
        }
    }

    /**
     * Lấy danh sách toàn bộ tài liệu đang có trong bộ nhớ
     */
    public synchronized List<DocumentInfo> listDocuments() {
        return new ArrayList<>(documentRegistry.values());
    }

    /**
     * Lấy danh sách các đoạn văn (chunks) của một tài liệu cụ thể
     */
    public synchronized List<String> getDocumentChunks(String filename) {
        List<String> chunks = documentChunksMap.get(filename);
        return chunks != null ? new ArrayList<>(chunks) : List.of();
    }

    /**
     * Xóa 1 tài liệu cụ thể theo tên file
     */
    public synchronized boolean deleteDocument(String filename) {
        removeFromVectorStore(filename);
        DocumentInfo removed = documentRegistry.remove(filename);
        documentChunksMap.remove(filename);
        persistState();
        return removed != null;
    }

    /**
     * Xóa toàn bộ tài liệu đã nạp trong bộ nhớ Vector Store
     */
    public synchronized void clearAllDocuments() {
        embeddingStore.removeAll();
        documentRegistry.clear();
        documentChunksMap.clear();
        persistState();
    }

    private void removeFromVectorStore(String filename) {
        try {
            embeddingStore.removeAll(MetadataFilterBuilder.metadataKey("file_name").isEqualTo(filename));
        } catch (Exception ignored) {
        }
    }

    private void persistState() {
        try {
            Files.createDirectories(AiConfig.VECTOR_STORE_FILE.getParent());
            embeddingStore.serializeToFile(AiConfig.VECTOR_STORE_FILE);
            objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValue(META_FILE.toFile(), new ArrayList<>(documentRegistry.values()));
            objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValue(CHUNKS_FILE.toFile(), documentChunksMap);
        } catch (Exception e) {
            System.err.println("Không thể lưu trạng thái Vector Store xuống đĩa: " + e.getMessage());
        }
    }
}
