package com.pos2.restaurant.dto;

import java.math.BigDecimal;

public record AdminDashboardResponse(
        long activeOrders,
        long ordersToValidate,
        long kitchenOrders,
        long readyOrders,
        long occupiedTables,
        long paidStillSeatedTables,
        long billRequests,
        long kitchenDelayedOrders,
        BigDecimal salesToday,
        RestaurantStateResponse restaurantState
) {
}
