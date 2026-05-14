package com.pos2.restaurant.dto;

import java.math.BigDecimal;

public record MenuItemRequest(
        String name,
        String category,
        BigDecimal price,
        Integer points,
        String station,
        String description,
        String details,
        String imageUrl,
        Boolean available
) {
}
