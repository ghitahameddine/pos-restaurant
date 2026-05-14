package com.pos2.restaurant.dto;

public record KitchenItemEntryResponse(
        Long id,
        String itemName,
        int quantity,
        boolean rewardItem
) {
}
