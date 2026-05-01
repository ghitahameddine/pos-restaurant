package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record PrintBillRequest(
        @NotNull PaymentMethod paymentMethod
) {
}

