package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {
    Optional<CustomerOrder> findByOrderNumber(String orderNumber);

    List<CustomerOrder> findByStatusOrderByCreatedAtDesc(OrderStatus status);

    List<CustomerOrder> findByTableNumberOrderByCreatedAtDesc(Integer tableNumber);

    List<CustomerOrder> findByStatusInOrderByCreatedAtDesc(Collection<OrderStatus> statuses);

    boolean existsByTableNumberAndStatusIn(Integer tableNumber, Collection<OrderStatus> statuses);
}
