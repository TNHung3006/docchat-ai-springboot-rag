package com.example.docchat.dto;

import java.util.List;

public record ChatMessageRecord(
        String role,
        String content,
        List<SourceCitation> sources,
        String timestamp
) {
}
