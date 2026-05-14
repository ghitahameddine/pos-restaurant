package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.enums.OrderSource;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.PaymentMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderResponse(
        Long id,
        String orderNumber,
        Integer tableNumber,
        String clientPhone,
        OrderSource source,
        OrderStatus status,
        String comment,
        String serverComment,
        BigDecimal subtotal,
        BigDecimal total,
        int points,
        PaymentMethod paymentMethod,
        RewardResponse reward,
        String rewardNote,
        Instant createdAt,
        Instant updatedAt,
        List<OrderLineResponse> items
) {
    public static OrderResponse fromEntity(CustomerOrder order) {
        return new OrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getTableNumber(),
                order.getClientPhone(),
                order.getSource(),
                order.getStatus(),
                order.getComment(),
                order.getServerComment(),
                order.getSubtotal(),
                order.getTotal(),
                order.getPoints(),
                order.getPaymentMethod(),
                order.getRedeemedReward() != null ? RewardResponse.fromEntity(order.getRedeemedReward()) : null,
                order.getRewardNote(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getItems().stream().map(OrderLineResponse::fromEntity).toList()
        );
    }
}
