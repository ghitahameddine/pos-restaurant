package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.SlotZone;

public record SlotRequest(
        Integer number,
        String color,
        String colorName,
        SlotZone zone
) {
}
