package com.example.docchat.dto;

public record ChatRequest(
        String question,
        String sessionId,
        String fileFilter
) {
}
