package com.pos2.restaurant.dto;

import java.time.Instant;

public record RealtimeEvent(
        String type,
        Object payload,
        Instant createdAt
) {
    public static RealtimeEvent of(String type, Object payload) {
        return new RealtimeEvent(type, payload, Instant.now());
    }
}

