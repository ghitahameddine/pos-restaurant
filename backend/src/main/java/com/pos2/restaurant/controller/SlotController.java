package com.pos2.restaurant.controller;

import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.dto.SlotResponse;
import com.pos2.restaurant.service.SlotService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/slots")
public class SlotController {

    private final SlotService slotService;

    public SlotController(SlotService slotService) {
        this.slotService = slotService;
    }

    @GetMapping
    public List<SlotResponse> getSlots(@RequestParam(required = false) SlotZone zone) {
        return slotService.getSlots(zone);
    }
}

