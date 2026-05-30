package com.pos2.restaurant.dto;

import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.UserRole;

import java.time.Instant;

public record UserAccountResponse(
        Long id,
        String phone,
        String name,
        UserRole role,
        int points,
        String assignedTables,
        boolean active,
        Instant createdAt
) {
    public static UserAccountResponse fromEntity(User user) {
        return new UserAccountResponse(
                user.getId(),
                user.getPhone(),
                user.getName(),
                user.getRole(),
                user.getPoints(),
                user.getAssignedTables(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
