package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.RestaurantTable;
import com.pos2.restaurant.domain.enums.TableStatus;

public record TableResponse(
        Long id,
        Integer number,
        TableStatus status,
        boolean active
) {
    public static TableResponse fromEntity(RestaurantTable table) {
        return new TableResponse(table.getId(), table.getNumber(), table.getStatus(), table.isActive());
    }
}

