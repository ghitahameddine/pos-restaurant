package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.KitchenItemStatus;

import java.util.List;

public record KitchenStationTicketResponse(
        Long orderId,
        String orderNumber,
        Integer tableNumber,
        String stationKey,
        String stationLabel,
        Integer slotNumber,
        String slotColor,
        String slotLabel,
        String customerComment,
        long elapsedMinutes,
        KitchenItemStatus status,
        List<KitchenItemEntryResponse> items
) {
}
