package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.BillRequest;
import com.pos2.restaurant.domain.enums.BillRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillRequestRepository extends JpaRepository<BillRequest, Long> {
    List<BillRequest> findByStatusOrderByCreatedAtDesc(BillRequestStatus status);

    boolean existsByOrder_IdAndStatus(Long orderId, BillRequestStatus status);
}
