package com.example.docchat;

import com.example.docchat.config.AiConfig;
import com.example.docchat.dto.AiSettingsRequest;
import com.example.docchat.dto.AiSettingsResponse;
import com.example.docchat.dto.DocumentInfo;
import com.example.docchat.service.DocumentIngestionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DocChatApplicationTests {

    @Autowired
    private AiConfig aiConfig;

    @Autowired
    private DocumentIngestionService ingestionService;

    @Test
    void contextLoads() {
        assertNotNull(aiConfig);
        assertNotNull(ingestionService);
    }

    @Test
    void testAiSettingsUpdateAndMasking() {
        AiSettingsResponse initial = aiConfig.getSettings();
        assertNotNull(initial);

        AiSettingsRequest updateReq = new AiSettingsRequest(
                "AIzaSyTestKey1234567890",
                "gemini-3.5-flash",
                0.4,
                8,
                0.35
        );
        AiSettingsResponse updated = aiConfig.updateSettings(updateReq);
        assertTrue(updated.apiKeyConfigured());
        assertEquals("AIza••••••••7890", updated.maskedApiKey());
        assertEquals("gemini-3.5-flash", updated.modelName());
        assertEquals(0.4, updated.temperature(), 0.001);
        assertEquals(8, updated.maxResults());
        assertEquals(0.35, updated.minScore(), 0.001);
    }

    @Test
    void testIngestAndRetrieveDocumentChunks() throws Exception {
        String fileName = "test-temp-upgrade-doc.txt";
        String content = "Đoạn văn kiểm thử số 1 cho hệ thống RAG DocChat AI.\n\nĐoạn văn kiểm thử số 2.";
        MockMultipartFile mockFile = new MockMultipartFile(
                "files",
                fileName,
                "text/plain",
                content.getBytes(StandardCharsets.UTF_8)
        );

        try {
            DocumentInfo info = ingestionService.ingestDocument(mockFile);
            assertEquals(fileName, info.fileName());
            assertTrue(info.chunks() >= 1);

            List<String> chunks = ingestionService.getDocumentChunks(fileName);
            assertFalse(chunks.isEmpty());
            assertTrue(chunks.get(0).contains("DocChat AI"));
        } finally {
            ingestionService.deleteDocument(fileName);
        }
    }
}
