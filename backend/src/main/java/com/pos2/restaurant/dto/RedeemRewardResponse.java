package com.pos2.restaurant.dto;

public record RedeemRewardResponse(
        String message,
        int points,
        RewardResponse reward,
        OrderResponse order
) {
}
