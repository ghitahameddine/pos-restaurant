package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.KitchenItemStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "kitchen_items")
public class KitchenItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_line_id")
    private OrderLine orderLine;

    @Column(nullable = false)
    private String station;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private KitchenItemStatus status = KitchenItemStatus.WAITING;

    @Column(nullable = false)
    private boolean rewardItem = false;

    @Column(length = 300)
    private String cancellationReason;

    private Instant cancelledAt;

    @Column(nullable = false)
    private Instant createdAt;

    protected KitchenItem() {
    }

    public KitchenItem(CustomerOrder order, OrderLine orderLine, String station) {
        this.order = order;
        this.orderLine = orderLine;
        this.station = station;
        this.itemName = orderLine.getItemName();
        this.quantity = orderLine.getQuantity();
        this.createdAt = Instant.now();
    }

    public KitchenItem(CustomerOrder order, String itemName, int quantity, String station, boolean rewardItem) {
        this.order = order;
        this.orderLine = null;
        this.station = station;
        this.itemName = itemName;
        this.quantity = quantity;
        this.rewardItem = rewardItem;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public OrderLine getOrderLine() {
        return orderLine;
    }

    public String getStation() {
        return station;
    }

    public String getItemName() {
        return itemName;
    }

    public int getQuantity() {
        return quantity;
    }

    public KitchenItemStatus getStatus() {
        return status;
    }

    public boolean isRewardItem() {
        return rewardItem;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setStatus(KitchenItemStatus status) {
        this.status = status;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void cancel(String reason) {
        this.status = KitchenItemStatus.CANCELLED;
        this.cancellationReason = reason;
        this.cancelledAt = Instant.now();
    }
}
