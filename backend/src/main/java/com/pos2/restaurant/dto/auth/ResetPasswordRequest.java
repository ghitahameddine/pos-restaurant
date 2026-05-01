package com.pos2.restaurant.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank String phone,
        @NotBlank String otp,
        @NotBlank @Size(min = 4) String newPassword
) {
}

