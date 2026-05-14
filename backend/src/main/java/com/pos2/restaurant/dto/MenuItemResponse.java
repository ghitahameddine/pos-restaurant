package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.MenuItem;

import java.math.BigDecimal;

public record MenuItemResponse(
        Long id,
        String name,
        String category,
        BigDecimal price,
        int points,
        String station,
        String description,
        String details,
        String imageUrl,
        boolean available
) {
    public static MenuItemResponse fromEntity(MenuItem item) {
        return new MenuItemResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getPrice(),
                item.getPoints(),
                item.getStation(),
                item.getDescription(),
                item.getDetails(),
                item.getImageUrl(),
                item.isAvailable()
        );
    }
}
