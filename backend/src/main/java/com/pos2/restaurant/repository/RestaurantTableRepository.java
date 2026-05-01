package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {
    Optional<RestaurantTable> findByNumber(Integer number);

    List<RestaurantTable> findByActiveTrueOrderByNumberAsc();
}

