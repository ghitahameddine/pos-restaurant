package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.LoyaltyTransactionType;
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
@Table(name = "loyalty_transactions")
public class LoyaltyTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reward_id")
    private Reward reward;

    @Column(nullable = false)
    private int points;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LoyaltyTransactionType type;

    @Column(nullable = false)
    private Instant createdAt;

    protected LoyaltyTransaction() {
    }

    public LoyaltyTransaction(User user, CustomerOrder order, Reward reward, int points, LoyaltyTransactionType type) {
        this.user = user;
        this.order = order;
        this.reward = reward;
        this.points = points;
        this.type = type;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public Reward getReward() {
        return reward;
    }

    public int getPoints() {
        return points;
    }

    public LoyaltyTransactionType getType() {
        return type;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
