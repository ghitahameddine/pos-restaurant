package com.pos2.restaurant.controller;

import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.dto.SlotRequest;
import com.pos2.restaurant.dto.SlotResponse;
import com.pos2.restaurant.service.SlotService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SlotResponse createSlot(@RequestBody SlotRequest request) {
        return slotService.createSlot(request);
    }

    @PatchMapping("/{id}")
    public SlotResponse updateSlot(@PathVariable Long id, @RequestBody SlotRequest request) {
        return slotService.updateSlot(id, request);
    }

    @PatchMapping("/{id}/force-free")
    public SlotResponse forceFree(@PathVariable Long id) {
        return slotService.forceFree(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSlot(@PathVariable Long id) {
        slotService.deleteSlot(id);
    }
}
