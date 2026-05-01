package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.SlotStatus;
import com.pos2.restaurant.domain.enums.SlotZone;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "slots")
public class Slot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer number;

    @Column(nullable = false)
    private String color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SlotZone zone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SlotStatus status = SlotStatus.FREE;

    private Long currentOrderId;

    protected Slot() {
    }

    public Slot(Integer number, String color, SlotZone zone) {
        this.number = number;
        this.color = color;
        this.zone = zone;
    }

    public Long getId() {
        return id;
    }

    public Integer getNumber() {
        return number;
    }

    public String getColor() {
        return color;
    }

    public SlotZone getZone() {
        return zone;
    }

    public SlotStatus getStatus() {
        return status;
    }

    public Long getCurrentOrderId() {
        return currentOrderId;
    }

    public void reserveForOrder(Long orderId) {
        this.status = SlotStatus.RESERVED;
        this.currentOrderId = orderId;
    }

    public void free() {
        this.status = SlotStatus.FREE;
        this.currentOrderId = null;
    }
}

