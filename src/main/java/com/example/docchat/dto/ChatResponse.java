package com.example.docchat.dto;

import java.util.List;

public record ChatResponse(
        String answer,
        List<SourceCitation> sources
) {
    public ChatResponse(String answer) {
        this(answer, List.of());
    }
}
