package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusRequest(
        @NotNull OrderStatus status,
        String serverComment
) {
}

