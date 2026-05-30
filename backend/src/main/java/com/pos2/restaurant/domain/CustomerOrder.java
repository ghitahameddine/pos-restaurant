package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.OrderSource;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.PaymentMethod;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "customer_orders")
public class CustomerOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @Column(nullable = false)
    private Integer tableNumber;

    private String clientPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(length = 800)
    private String comment;

    @Column(length = 800)
    private String serverComment;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private boolean rewardPointsApplied = false;

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @ManyToOne
    @JoinColumn(name = "redeemed_reward_id")
    private Reward redeemedReward;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderLine> items = new ArrayList<>();

    protected CustomerOrder() {
    }

    public CustomerOrder(String orderNumber, Integer tableNumber, String clientPhone, OrderSource source, OrderStatus status, String comment) {
        this.orderNumber = orderNumber;
        this.tableNumber = tableNumber;
        this.clientPhone = clientPhone;
        this.source = source;
        this.status = status;
        this.comment = comment;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void addLine(OrderLine line) {
        items.add(line);
        line.setOrder(this);
        recalculateTotals();
    }

    public void recalculateTotals() {
        this.subtotal = items.stream()
                .filter(line -> !line.isCancelled())
                .map(OrderLine::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.total = applyRewardToSubtotal(this.subtotal);
        this.points = this.total
                .divide(BigDecimal.TEN, 0, RoundingMode.DOWN)
                .intValue();
        this.updatedAt = Instant.now();
    }

    private BigDecimal applyRewardToSubtotal(BigDecimal baseSubtotal) {
        if (redeemedReward == null || redeemedReward.getType() != com.pos2.restaurant.domain.enums.RewardType.DISCOUNT
                || redeemedReward.getDiscountPercent() == null
                || redeemedReward.getDiscountPercent().compareTo(BigDecimal.ZERO) <= 0) {
            return baseSubtotal;
        }

        BigDecimal discountAmount = baseSubtotal
                .multiply(redeemedReward.getDiscountPercent())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        return baseSubtotal.subtract(discountAmount).max(BigDecimal.ZERO);
    }

    public Long getId() {
        return id;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public Integer getTableNumber() {
        return tableNumber;
    }

    public String getClientPhone() {
        return clientPhone;
    }

    public void attachClientPhone(String clientPhone) {
        if ((this.clientPhone == null || this.clientPhone.isBlank()) && clientPhone != null && !clientPhone.isBlank()) {
            this.clientPhone = clientPhone.trim();
            this.updatedAt = Instant.now();
        }
    }

    public OrderSource getSource() {
        return source;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
        this.updatedAt = Instant.now();
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
        this.updatedAt = Instant.now();
    }

    public String getServerComment() {
        return serverComment;
    }

    public void setServerComment(String serverComment) {
        this.serverComment = serverComment;
        this.updatedAt = Instant.now();
    }

    public BigDecimal getTotal() {
        return total;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public int getPoints() {
        return points;
    }

    public boolean isRewardPointsApplied() {
        return rewardPointsApplied;
    }

    public void markRewardPointsApplied() {
        this.rewardPointsApplied = true;
        this.updatedAt = Instant.now();
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
        this.updatedAt = Instant.now();
    }

    public Reward getRedeemedReward() {
        return redeemedReward;
    }

    public void applyReward(Reward reward) {
        this.redeemedReward = reward;
        recalculateTotals();
    }

    public boolean hasRedeemedReward() {
        return redeemedReward != null;
    }

    public String getRewardNote() {
        if (redeemedReward == null) {
            return null;
        }

        if (redeemedReward.getType() == com.pos2.restaurant.domain.enums.RewardType.FREE_ITEM) {
            String rewardText = ((redeemedReward.getDescription() == null ? "" : redeemedReward.getDescription())
                    + " "
                    + (redeemedReward.getName() == null ? "" : redeemedReward.getName()))
                    .toLowerCase();

            if (rewardText.contains("orange")) {
                return "Article offert : Jus Orange Frais";
            }

            if (rewardText.contains("dessert")) {
                return "Article offert : Tiramisu";
            }

            return "Article offert : " + redeemedReward.getName();
        }

        if (redeemedReward.getDiscountPercent() != null) {
            return "Reduction fidelite appliquee : " + redeemedReward.getDiscountPercent().stripTrailingZeros().toPlainString() + "%";
        }

        return redeemedReward.getDescription();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<OrderLine> getItems() {
        return items;
    }
}
