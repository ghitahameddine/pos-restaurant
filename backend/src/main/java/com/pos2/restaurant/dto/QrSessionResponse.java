package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.QrSession;
import com.pos2.restaurant.domain.enums.QrSessionStatus;

import java.time.Instant;

public record QrSessionResponse(
        Long id,
        String token,
        Integer tableNumber,
        QrSessionStatus status,
        Instant createdAt,
        Instant expiresAt,
        Instant closedAt,
        String menuPath
) {
    public static QrSessionResponse fromEntity(QrSession session) {
        return new QrSessionResponse(
                session.getId(),
                session.getToken(),
                session.getTableNumber(),
                session.getStatus(),
                session.getCreatedAt(),
                session.getExpiresAt(),
                session.getClosedAt(),
                "/menu?table=" + session.getTableNumber() + "&token=" + session.getToken()
        );
    }
}

