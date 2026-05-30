package com.pos2.restaurant.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "order_lines")
public class OrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private MenuItem menuItem;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal lineTotal;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean cancelled = false;

    @Column(length = 300)
    private String cancellationReason;

    private Instant cancelledAt;

    protected OrderLine() {
    }

    public OrderLine(MenuItem menuItem, int quantity) {
        this.menuItem = menuItem;
        this.itemName = menuItem.getName();
        this.unitPrice = menuItem.getPrice();
        this.points = menuItem.getPoints();
        this.quantity = quantity;
        this.lineTotal = menuItem.getPrice().multiply(BigDecimal.valueOf(quantity));
    }

    public Long getId() {
        return id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public void setOrder(CustomerOrder order) {
        this.order = order;
    }

    public Long getMenuItemId() {
        return menuItem.getId();
    }

    public String getStation() {
        return menuItem.getStation();
    }

    public String getItemName() {
        return itemName;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public int getQuantity() {
        return quantity;
    }

    public int getPoints() {
        return points;
    }

    public BigDecimal getLineTotal() {
        return lineTotal;
    }

    public boolean isCancelled() {
        return cancelled;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void cancel(String reason) {
        this.cancelled = true;
        this.cancellationReason = reason;
        this.cancelledAt = Instant.now();
    }
}
