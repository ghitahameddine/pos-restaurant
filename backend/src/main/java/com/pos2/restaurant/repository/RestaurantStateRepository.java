package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.RestaurantState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RestaurantStateRepository extends JpaRepository<RestaurantState, Long> {
}
