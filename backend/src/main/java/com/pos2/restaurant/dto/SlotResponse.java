package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.Slot;
import com.pos2.restaurant.domain.enums.SlotStatus;
import com.pos2.restaurant.domain.enums.SlotZone;

public record SlotResponse(
        Long id,
        Integer number,
        String color,
        SlotZone zone,
        SlotStatus status,
        Long currentOrderId
) {
    public static SlotResponse fromEntity(Slot slot) {
        return new SlotResponse(
                slot.getId(),
                slot.getNumber(),
                slot.getColor(),
                slot.getZone(),
                slot.getStatus(),
                slot.getCurrentOrderId()
        );
    }
}

