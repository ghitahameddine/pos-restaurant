package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.Slot;
import com.pos2.restaurant.domain.enums.SlotStatus;
import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.dto.SlotRequest;
import com.pos2.restaurant.dto.SlotResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
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

    @Transactional
    public SlotResponse createSlot(SlotRequest request) {
        Integer number = requireNumber(request.number());
        SlotZone zone = request.zone() == null ? SlotZone.KITCHEN : request.zone();

        if (slotRepository.findByZoneAndNumber(zone, number).isPresent()) {
            throw new BadRequestException("Un slot avec ce numero existe deja dans cette zone.");
        }

        Slot slot = new Slot(
                number,
                requireText(request.color(), "Couleur obligatoire."),
                requireText(request.colorName(), "Nom de couleur obligatoire."),
                zone
        );
        return SlotResponse.fromEntity(slotRepository.save(slot));
    }

    @Transactional
    public SlotResponse updateSlot(Long id, SlotRequest request) {
        Slot slot = findById(id);
        Integer number = requireNumber(request.number());
        SlotZone zone = request.zone() == null ? slot.getZone() : request.zone();

        slotRepository.findByZoneAndNumber(zone, number)
                .filter(existingSlot -> !existingSlot.getId().equals(id))
                .ifPresent(existingSlot -> {
                    throw new BadRequestException("Un autre slot utilise deja ce numero dans cette zone.");
                });

        slot.setNumber(number);
        slot.setColor(requireText(request.color(), "Couleur obligatoire."));
        slot.setColorName(requireText(request.colorName(), "Nom de couleur obligatoire."));
        slot.setZone(zone);
        return SlotResponse.fromEntity(slotRepository.save(slot));
    }

    @Transactional
    public SlotResponse forceFree(Long id) {
        Slot slot = findById(id);
        slot.free();
        return SlotResponse.fromEntity(slotRepository.save(slot));
    }

    @Transactional
    public void deleteSlot(Long id) {
        Slot slot = findById(id);
        if (slot.getStatus() != SlotStatus.FREE) {
            throw new BadRequestException("Impossible de supprimer un slot occupe. Libere-le d'abord.");
        }
        slotRepository.delete(slot);
    }

    private Slot findById(Long id) {
        return slotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Slot introuvable: " + id));
    }

    private Integer requireNumber(Integer number) {
        if (number == null || number < 1) {
            throw new BadRequestException("Numero de slot invalide.");
        }
        return number;
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }
}
