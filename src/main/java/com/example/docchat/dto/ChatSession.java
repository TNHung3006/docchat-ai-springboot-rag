package com.example.docchat.dto;

import java.util.List;

public record ChatSession(
        String id,
        String title,
        String createdAt,
        String updatedAt,
        List<ChatMessageRecord> messages
) {
}
