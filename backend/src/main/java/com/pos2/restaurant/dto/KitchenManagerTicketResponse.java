package com.pos2.restaurant.dto;

public record KitchenManagerTicketResponse(
        Long orderId,
        String orderNumber,
        Integer tableNumber,
        Integer slotNumber,
        String slotColor,
        String slotLabel,
        String customerComment,
        long elapsedMinutes,
        KitchenStationProgressResponse plats,
        KitchenStationProgressResponse boissons,
        KitchenStationProgressResponse desserts,
        boolean completeReady,
        boolean allCancelled
) {
}
