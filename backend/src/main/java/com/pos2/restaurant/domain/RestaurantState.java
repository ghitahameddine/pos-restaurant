package com.pos2.restaurant.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "restaurant_state")
public class RestaurantState {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private boolean open = true;

    @Column(nullable = false)
    private boolean orderingPaused = false;

    @Column(nullable = false)
    private boolean qrOrderingPaused = false;

    @Column(length = 500)
    private String message = "Restaurant ouvert";

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected RestaurantState() {
    }

    public static RestaurantState defaultState() {
        return new RestaurantState();
    }

    public Long getId() {
        return id;
    }

    public boolean isOpen() {
        return open;
    }

    public void setOpen(boolean open) {
        this.open = open;
        touch();
    }

    public boolean isOrderingPaused() {
        return orderingPaused;
    }

    public void setOrderingPaused(boolean orderingPaused) {
        this.orderingPaused = orderingPaused;
        touch();
    }

    public boolean isQrOrderingPaused() {
        return qrOrderingPaused;
    }

    public void setQrOrderingPaused(boolean qrOrderingPaused) {
        this.qrOrderingPaused = qrOrderingPaused;
        touch();
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
        touch();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    private void touch() {
        this.updatedAt = Instant.now();
    }
}
