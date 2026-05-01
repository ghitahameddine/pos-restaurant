package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.BillRequest;
import com.pos2.restaurant.domain.enums.BillRequestStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record BillRequestResponse(
        Long id,
        String requestNumber,
        Long orderId,
        String orderNumber,
        Integer tableNumber,
        BillRequestStatus status,
        BigDecimal total,
        Instant createdAt,
        Instant printedAt,
        OrderResponse order
) {
    public static BillRequestResponse fromEntity(BillRequest request) {
        return new BillRequestResponse(
                request.getId(),
                request.getRequestNumber(),
                request.getOrder().getId(),
                request.getOrder().getOrderNumber(),
                request.getTableNumber(),
                request.getStatus(),
                request.getTotal(),
                request.getCreatedAt(),
                request.getPrintedAt(),
                OrderResponse.fromEntity(request.getOrder())
        );
    }
}

