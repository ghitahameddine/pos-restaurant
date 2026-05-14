package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.KitchenItemStatus;

public record KitchenStationProgressResponse(
        String stationKey,
        String stationLabel,
        boolean required,
        KitchenItemStatus status
) {
}
