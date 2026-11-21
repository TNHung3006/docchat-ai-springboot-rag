package com.example.docchat.dto;

public record ChatSessionSummary(
        String id,
        String title,
        String updatedAt,
        int messageCount
) {
}
