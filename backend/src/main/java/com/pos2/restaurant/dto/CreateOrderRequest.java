package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.OrderSource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateOrderRequest(
        @NotNull Integer tableNumber,
        String clientPhone,
        OrderSource source,
        String comment,
        @NotEmpty List<@Valid OrderLineRequest> items
) {
}

