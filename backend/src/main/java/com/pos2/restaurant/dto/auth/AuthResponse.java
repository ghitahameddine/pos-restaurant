package com.pos2.restaurant.dto.auth;

import com.pos2.restaurant.domain.enums.UserRole;

public record AuthResponse(
        Long userId,
        String phone,
        String name,
        UserRole role,
        int points,
        String assignedTables
) {
}
