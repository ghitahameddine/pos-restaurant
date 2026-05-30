package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.KitchenItemStatus;

public record KitchenItemEntryResponse(
        Long id,
        String itemName,
        int quantity,
        boolean rewardItem,
        KitchenItemStatus status,
        String cancellationReason
) {
}
