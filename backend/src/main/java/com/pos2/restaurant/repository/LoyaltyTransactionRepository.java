package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.LoyaltyTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {
    List<LoyaltyTransaction> findByUser_PhoneOrderByCreatedAtDesc(String phone);

    boolean existsByUser_Id(Long userId);
}
