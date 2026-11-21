package com.example.docchat.dto;

public record AiSettingsRequest(
        String apiKey,
        String modelName,
        Double temperature,
        Integer maxResults,
        Double minScore
) {
}

