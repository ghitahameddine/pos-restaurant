package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.TableStatus;

public record TableRequest(
        Integer number,
        Boolean active,
        TableStatus status,
        String qrUrl
) {
}
