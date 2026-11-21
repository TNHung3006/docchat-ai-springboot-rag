package com.example.docchat.dto;

public record AiSettingsResponse(
        String maskedApiKey,
        boolean apiKeyConfigured,
        String modelName,
        double temperature,
        int maxResults,
        double minScore
) {
}

