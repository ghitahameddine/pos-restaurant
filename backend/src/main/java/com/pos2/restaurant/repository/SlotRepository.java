package com.pos2.restaurant.repository;

import com.pos2.restaurant.domain.Slot;
import com.pos2.restaurant.domain.enums.SlotZone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SlotRepository extends JpaRepository<Slot, Long> {
    List<Slot> findByZoneOrderByNumberAsc(SlotZone zone);

    List<Slot> findByNumberGreaterThan(Integer number);
}
