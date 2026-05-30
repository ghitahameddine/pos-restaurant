package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.OrderLine;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderLineRepository extends JpaRepository<OrderLine, Long> {
    boolean existsByMenuItem_Id(Long menuItemId);
}
