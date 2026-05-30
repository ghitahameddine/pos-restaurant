package com.pos2.restaurant.dto;

import jakarta.validation.constraints.NotBlank;

public record CancelKitchenItemRequest(
        @NotBlank String reason
) {
}
