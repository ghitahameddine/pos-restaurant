package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.QrSession;
import com.pos2.restaurant.domain.enums.QrSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface QrSessionRepository extends JpaRepository<QrSession, Long> {
    Optional<QrSession> findByToken(String token);

    List<QrSession> findByStatusAndExpiresAtBefore(QrSessionStatus status, Instant expiresAt);

    List<QrSession> findByTableNumberAndStatus(Integer tableNumber, QrSessionStatus status);
}
