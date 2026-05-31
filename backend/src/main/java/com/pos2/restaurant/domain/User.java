package com.pos2.restaurant.domain;

import com.pos2.restaurant.domain.enums.UserRole;
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
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(nullable = false)
    private String passwordHash;   //MOT DE PASSE HACHE UNIQUEMENT

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Column(nullable = false)
    private int points = 0;

    private Boolean active = true;

    @Column(length = 255)
    private String assignedTables;

    @Column(nullable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(String phone, String passwordHash, String name, UserRole role) {
        this.phone = phone;
        this.passwordHash = passwordHash;
        this.name = name;
        this.role = role;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public int getPoints() {
        return points;
    }

    public void setPoints(int points) {
        this.points = points;
    }

    public void addPoints(int earnedPoints) {
        if (earnedPoints > 0) {
            this.points += earnedPoints;
        }
    }

    public void removePoints(int redeemedPoints) {
        if (redeemedPoints > 0) {
            this.points = Math.max(0, this.points - redeemedPoints);
        }
    }

    public boolean isActive() {
        return active == null || active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getAssignedTables() {
        return assignedTables;
    }

    public void setAssignedTables(String assignedTables) {
        this.assignedTables = assignedTables;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
