package com.pos2.restaurant.dto;

public record RestaurantStateRequest(
        Boolean open,
        Boolean orderingPaused,
        Boolean qrOrderingPaused,
        String message
) {
}
