package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.UserRole;

import java.time.Instant;

public record StaffResponse(
        Long id,
        String phone,
        String name,
        UserRole role,
        String assignedTables,
        boolean active,
        Instant createdAt
) {
    public static StaffResponse fromEntity(User user) {
        return new StaffResponse(
                user.getId(),
                user.getPhone(),
                user.getName(),
                user.getRole(),
                user.getAssignedTables(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
