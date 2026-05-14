package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.enums.UserRole;

public record StaffRequest(
        String phone,
        String password,
        String name,
        UserRole role,
        String assignedTables,
        Boolean active
) {
}
