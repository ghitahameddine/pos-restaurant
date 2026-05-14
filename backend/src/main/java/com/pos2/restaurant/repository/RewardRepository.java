package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.Reward;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RewardRepository extends JpaRepository<Reward, Long> {
    List<Reward> findByActiveTrueOrderByPointsCostAsc();
}
