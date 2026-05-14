package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.Reward;
import com.pos2.restaurant.domain.enums.RewardType;

import java.math.BigDecimal;

public record RewardResponse(
        Long id,
        String name,
        String description,
        int pointsCost,
        RewardType type,
        boolean active,
        BigDecimal discountPercent
) {
    public static RewardResponse fromEntity(Reward reward) {
        return new RewardResponse(
                reward.getId(),
                reward.getName(),
                reward.getDescription(),
                reward.getPointsCost(),
                reward.getType(),
                reward.isActive(),
                reward.getDiscountPercent()
        );
    }
}
