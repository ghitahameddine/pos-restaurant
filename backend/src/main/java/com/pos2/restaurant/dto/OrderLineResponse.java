package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.OrderLine;

import java.math.BigDecimal;

public record OrderLineResponse(
        Long id,
        Long menuItemId,
        String itemName,
        BigDecimal unitPrice,
        int quantity,
        int points,
        BigDecimal lineTotal,
        boolean cancelled,
        String cancellationReason
) {
    public static OrderLineResponse fromEntity(OrderLine line) {
        return new OrderLineResponse(
                line.getId(),
                line.getMenuItemId(),
                line.getItemName(),
                line.getUnitPrice(),
                line.getQuantity(),
                line.getPoints(),
                line.getLineTotal(),
                line.isCancelled(),
                line.getCancellationReason()
        );
    }
}
