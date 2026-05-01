package com.pos2.restaurant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ClientUpdateOrderRequest(
        @NotBlank String qrToken,
        String comment,
        @NotEmpty List<@Valid OrderLineRequest> items
) {
}
