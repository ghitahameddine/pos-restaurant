package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.dto.SlotResponse;
import com.pos2.restaurant.repository.SlotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SlotService {

    private final SlotRepository slotRepository;

    public SlotService(SlotRepository slotRepository) {
        this.slotRepository = slotRepository;
    }

    @Transactional(readOnly = true)
    public List<SlotResponse> getSlots(SlotZone zone) {
        if (zone != null) {
            return slotRepository.findByZoneOrderByNumberAsc(zone).stream()
                    .map(SlotResponse::fromEntity)
                    .toList();
        }
        return slotRepository.findAll().stream()
                .map(SlotResponse::fromEntity)
                .toList();
    }
}

