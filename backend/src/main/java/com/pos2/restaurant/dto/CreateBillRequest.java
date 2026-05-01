package com.pos2.restaurant.dto;

import jakarta.validation.constraints.NotNull;

public record CreateBillRequest(
        @NotNull Long orderId
) {
}

