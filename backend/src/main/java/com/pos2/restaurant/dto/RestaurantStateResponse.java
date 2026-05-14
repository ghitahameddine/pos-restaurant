package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.RestaurantState;

import java.time.Instant;

public record RestaurantStateResponse(
        boolean open,
        boolean orderingPaused,
        boolean qrOrderingPaused,
        String message,
        Instant updatedAt
) {
    public static RestaurantStateResponse fromEntity(RestaurantState state) {
        return new RestaurantStateResponse(
                state.isOpen(),
                state.isOrderingPaused(),
                state.isQrOrderingPaused(),
                state.getMessage(),
                state.getUpdatedAt()
        );
    }
}
