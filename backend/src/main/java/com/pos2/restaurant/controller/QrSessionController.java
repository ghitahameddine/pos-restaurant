package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.CreateQrSessionRequest;
import com.pos2.restaurant.dto.QrSessionResponse;
import com.pos2.restaurant.service.QrSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/qr-sessions")
public class QrSessionController {

    private final QrSessionService qrSessionService;

    public QrSessionController(QrSessionService qrSessionService) {
        this.qrSessionService = qrSessionService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QrSessionResponse createSession(@Valid @RequestBody CreateQrSessionRequest request) {
        return qrSessionService.createSession(request);
    }

    @GetMapping("/{token}")
    public QrSessionResponse getSession(@PathVariable String token) {
        return qrSessionService.getSession(token);
    }
}

