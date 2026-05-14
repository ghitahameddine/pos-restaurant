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

    @Column
    private String colorName;

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
        this.colorName = color;
        this.zone = zone;
    }

    public Slot(Integer number, String color, String colorName, SlotZone zone) {
        this.number = number;
        this.color = color;
        this.colorName = colorName;
        this.zone = zone;
    }

    public Long getId() {
        return id;
    }

    public Integer getNumber() {
        return number;
    }

    public void setNumber(Integer number) {
        this.number = number;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getColorName() {
        return colorName == null || colorName.isBlank() ? color : colorName;
    }

    public void setColorName(String colorName) {
        this.colorName = colorName;
    }

    public SlotZone getZone() {
        return zone;
    }

    public void setZone(SlotZone zone) {
        this.zone = zone;
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
