package com.pos2.restaurant.dto;

import java.util.List;

public record LoyaltySummaryResponse(
        int points,
        List<LoyaltyTransactionResponse> transactions,
        List<RewardResponse> rewards
) {
}
