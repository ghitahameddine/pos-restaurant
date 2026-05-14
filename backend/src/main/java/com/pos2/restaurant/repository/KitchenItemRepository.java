package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.KitchenItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KitchenItemRepository extends JpaRepository<KitchenItem, Long> {
    List<KitchenItem> findByStationOrderByCreatedAtAsc(String station);

    List<KitchenItem> findByOrder_IdOrderByCreatedAtAsc(Long orderId);

    List<KitchenItem> findByOrder_IdAndStationOrderByCreatedAtAsc(Long orderId, String station);
}
