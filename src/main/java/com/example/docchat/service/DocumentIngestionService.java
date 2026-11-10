package com.example.docchat.service;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.DocumentParser;
import dev.langchain4j.data.document.parser.TextDocumentParser;
import dev.langchain4j.data.document.parser.apache.pdfbox.ApachePdfBoxDocumentParser;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Service
public class DocumentIngestionService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;

    public DocumentIngestionService(EmbeddingStore<TextSegment> embeddingStore,
                                    EmbeddingModel embeddingModel) {
        this.embeddingStore = embeddingStore;
        this.embeddingModel = embeddingModel;
    }

    /**
     * Đọc file PDF hoặc TXT, xóa bản cũ nếu trùng tên file, cắt nhỏ thành các đoạn văn (Chunks),
     * chuyển thành Vector và lưu vào bộ nhớ In-Memory Vector Store.
     *
     * @param file File người dùng tải lên
     * @return Số lượng đoạn văn (chunks) đã được tách và lưu trữ
     */
    public int ingestDocument(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.txt";

        // Xóa các đoạn văn cũ của cùng tên file (chống trùng lặp khi người dùng upload lại file đó)
        try {
            embeddingStore.removeAll(MetadataFilterBuilder.metadataKey("file_name").isEqualTo(filename));
        } catch (Exception ignored) {
        }

        DocumentParser parser;
        if (filename.toLowerCase().endsWith(".pdf")) {
            parser = new ApachePdfBoxDocumentParser();
        } else {
            parser = new TextDocumentParser();
        }

        try (InputStream inputStream = file.getInputStream()) {
            Document document = parser.parse(inputStream);
            document.metadata().put("file_name", filename);

            // Cắt tài liệu thành các đoạn tối đa 500 ký tự, gối nhau (overlap) 50 ký tự để giữ mạch văn
            var splitter = DocumentSplitters.recursive(500, 50);
            List<TextSegment> segments = splitter.split(document);

            // Nạp vào Vector Store
            EmbeddingStoreIngestor ingestor = EmbeddingStoreIngestor.builder()
                    .documentSplitter(splitter)
                    .embeddingModel(embeddingModel)
                    .embeddingStore(embeddingStore)
                    .build();

            ingestor.ingest(document);
            return segments.size();
        }
    }

    /**
     * Xóa toàn bộ tài liệu đã nạp trong bộ nhớ Vector Store
     */
    public void clearAllDocuments() {
        embeddingStore.removeAll();
    }
}
