package com.example.docchat.service;

import com.example.docchat.config.AiConfig;
import com.example.docchat.dto.DocumentInfo;
import com.fasterxml.jackson.core.type.TypeReference;
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
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final InMemoryEmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;
    private final ObjectMapper objectMapper;
    private final Map<String, DocumentInfo> documentRegistry = new LinkedHashMap<>();

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
        } catch (Exception e) {
            System.err.println("Không thể đọc metadata tài liệu: " + e.getMessage());
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
     * Xóa 1 tài liệu cụ thể theo tên file
     */
    public synchronized boolean deleteDocument(String filename) {
        removeFromVectorStore(filename);
        DocumentInfo removed = documentRegistry.remove(filename);
        persistState();
        return removed != null;
    }

    /**
     * Xóa toàn bộ tài liệu đã nạp trong bộ nhớ Vector Store
     */
    public synchronized void clearAllDocuments() {
        embeddingStore.removeAll();
        documentRegistry.clear();
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
        } catch (Exception e) {
            System.err.println("Không thể lưu trạng thái Vector Store xuống đĩa: " + e.getMessage());
        }
    }
}
