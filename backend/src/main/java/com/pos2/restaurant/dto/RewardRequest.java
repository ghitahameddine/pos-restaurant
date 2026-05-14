package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.RewardType;

import java.math.BigDecimal;

public record RewardRequest(
        String name,
        String description,
        Integer pointsCost,
        RewardType type,
        Boolean active,
        BigDecimal discountPercent
) {
}
