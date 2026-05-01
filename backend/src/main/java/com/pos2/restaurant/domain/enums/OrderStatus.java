package com.pos2.restaurant.domain.enums;

public enum OrderStatus {
    PENDING_SERVER_VALIDATION,
    CONFIRMED,
    IN_KITCHEN,
    READY,
    SERVED,
    PAID,
    CANCELLED
}

