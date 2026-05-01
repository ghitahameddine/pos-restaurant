package com.pos2.restaurant.dto;

import jakarta.validation.constraints.NotNull;

public record CreateQrSessionRequest(
        @NotNull Integer tableNumber
) {
}

