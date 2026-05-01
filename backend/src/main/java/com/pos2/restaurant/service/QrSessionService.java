package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.QrSession;
import com.pos2.restaurant.domain.enums.QrSessionStatus;
import com.pos2.restaurant.dto.CreateQrSessionRequest;
import com.pos2.restaurant.dto.QrSessionResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.QrSessionRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class QrSessionService {

    private final QrSessionRepository qrSessionRepository;
    private final RestaurantTableRepository tableRepository;
    private final RealtimeService realtimeService;

    public QrSessionService(QrSessionRepository qrSessionRepository, RestaurantTableRepository tableRepository, RealtimeService realtimeService) {
        this.qrSessionRepository = qrSessionRepository;
        this.tableRepository = tableRepository;
        this.realtimeService = realtimeService;
    }

    @Transactional
    public QrSessionResponse createSession(CreateQrSessionRequest request) {
        tableRepository.findByNumber(request.tableNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + request.tableNumber()));

        QrSession session = new QrSession(
                generateToken(),
                request.tableNumber(),
                Instant.now().plus(90, ChronoUnit.MINUTES)
        );

        QrSessionResponse response = QrSessionResponse.fromEntity(qrSessionRepository.save(session));
        realtimeService.publishTable(response);
        return response;
    }

    @Transactional(readOnly = true)
    public QrSessionResponse getSession(String token) {
        QrSession session = qrSessionRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Session QR introuvable."));
        if (!session.isUsable()) {
            throw new BadRequestException("Session QR expiree ou fermee.");
        }
        return QrSessionResponse.fromEntity(session);
    }

    @Transactional
    public void closeActiveSessionsForTable(Integer tableNumber) {
        qrSessionRepository.findByTableNumberAndStatus(tableNumber, QrSessionStatus.ACTIVE)
                .forEach(session -> {
                    session.close();
                    qrSessionRepository.save(session);
                    realtimeService.publishTable(QrSessionResponse.fromEntity(session));
                });
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expireOldSessions() {
        qrSessionRepository.findByStatusAndExpiresAtBefore(QrSessionStatus.ACTIVE, Instant.now())
                .forEach(session -> {
                    session.expire();
                    qrSessionRepository.save(session);
                    realtimeService.publishTable(QrSessionResponse.fromEntity(session));
                });
    }

    private String generateToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
