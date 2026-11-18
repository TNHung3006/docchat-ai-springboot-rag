package com.example.docchat.dto;

public record DocumentInfo(
        String fileName,
        int chunks,
        long fileSize,
        String uploadedAt
) {
}
