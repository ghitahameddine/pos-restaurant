package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.BillRequestStatus;
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

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "bill_requests")
public class BillRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String requestNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    @Column(nullable = false)
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BillRequestStatus status = BillRequestStatus.PENDING;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant printedAt;

    protected BillRequest() {
    }

    public BillRequest(String requestNumber, CustomerOrder order) {
        this.requestNumber = requestNumber;
        this.order = order;
        this.tableNumber = order.getTableNumber();
        this.total = order.getTotal();
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public Integer getTableNumber() {
        return tableNumber;
    }

    public BillRequestStatus getStatus() {
        return status;
    }

    public void markPrinted() {
        this.status = BillRequestStatus.PRINTED;
        this.printedAt = Instant.now();
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void syncTotalFromOrder() {
        this.total = order.getTotal();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getPrintedAt() {
        return printedAt;
    }
}
