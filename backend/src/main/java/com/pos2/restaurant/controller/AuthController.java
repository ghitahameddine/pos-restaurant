package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.auth.AuthMessageResponse;
import com.pos2.restaurant.dto.auth.AuthResponse;
import com.pos2.restaurant.dto.auth.ForgotPasswordRequest;
import com.pos2.restaurant.dto.auth.LoginRequest;
import com.pos2.restaurant.dto.auth.RegisterRequest;
import com.pos2.restaurant.dto.auth.ResetPasswordRequest;
import com.pos2.restaurant.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.registerClient(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/forgot-password")
    public AuthMessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return new AuthMessageResponse(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public AuthMessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return new AuthMessageResponse(authService.resetPassword(request));
    }
}

