package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.LoyaltyTransaction;
import com.pos2.restaurant.domain.enums.LoyaltyTransactionType;

import java.time.Instant;

public record LoyaltyTransactionResponse(
        Long id,
        int points,
        LoyaltyTransactionType type,
        String orderNumber,
        String rewardName,
        Instant createdAt
) {
    public static LoyaltyTransactionResponse fromEntity(LoyaltyTransaction transaction) {
        return new LoyaltyTransactionResponse(
                transaction.getId(),
                transaction.getPoints(),
                transaction.getType(),
                transaction.getOrder() != null ? transaction.getOrder().getOrderNumber() : null,
                transaction.getReward() != null ? transaction.getReward().getName() : null,
                transaction.getCreatedAt()
        );
    }
}
