package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.QrSessionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "qr_sessions")
public class QrSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QrSessionStatus status = QrSessionStatus.ACTIVE;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant closedAt;

    protected QrSession() {
    }

    public QrSession(String token, Integer tableNumber, Instant expiresAt) {
        this.token = token;
        this.tableNumber = tableNumber;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return id;
    }

    public String getToken() {
        return token;
    }

    public Integer getTableNumber() {
        return tableNumber;
    }

    public QrSessionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public boolean isUsable() {
        return status == QrSessionStatus.ACTIVE && expiresAt.isAfter(Instant.now());
    }

    public void close() {
        this.status = QrSessionStatus.CLOSED;
        this.closedAt = Instant.now();
    }

    public void expire() {
        this.status = QrSessionStatus.EXPIRED;
    }
}

