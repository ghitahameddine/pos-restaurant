package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.MenuItem;
import com.pos2.restaurant.dto.MenuItemRequest;
import com.pos2.restaurant.dto.MenuItemResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.MenuItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class MenuService {

    private final MenuItemRepository menuItemRepository;

    public MenuService(MenuItemRepository menuItemRepository) {
        this.menuItemRepository = menuItemRepository;
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getAvailableMenu() {
        return menuItemRepository.findByAvailableTrueOrderByCategoryAscNameAsc()
                .stream()
                .map(MenuItemResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getAllMenuItems() {
        return menuItemRepository.findAll().stream()
                .map(MenuItemResponse::fromEntity)
                .toList();
    }

    @Transactional
    public MenuItemResponse createMenuItem(MenuItemRequest request) {
        MenuItem item = new MenuItem(
                requireText(request.name(), "Nom du produit obligatoire."),
                requireText(request.category(), "Categorie obligatoire."),
                requirePrice(request.price()),
                request.points() == null ? 0 : Math.max(0, request.points()),
                requireText(request.station(), "Poste cuisine obligatoire."),
                requireText(request.description(), "Description obligatoire."),
                request.details(),
                request.imageUrl()
        );
        item.setAvailable(request.available() == null || request.available());
        return MenuItemResponse.fromEntity(menuItemRepository.save(item));
    }

    @Transactional
    public MenuItemResponse updateMenuItem(Long id, MenuItemRequest request) {
        MenuItem item = findById(id);
        item.setName(requireText(request.name(), "Nom du produit obligatoire."));
        item.setCategory(requireText(request.category(), "Categorie obligatoire."));
        item.setPrice(requirePrice(request.price()));
        item.setPoints(request.points() == null ? 0 : Math.max(0, request.points()));
        item.setStation(requireText(request.station(), "Poste cuisine obligatoire."));
        item.setDescription(requireText(request.description(), "Description obligatoire."));
        item.setDetails(request.details());
        item.setImageUrl(request.imageUrl());
        item.setAvailable(request.available() == null || request.available());
        return MenuItemResponse.fromEntity(menuItemRepository.save(item));
    }

    @Transactional
    public MenuItemResponse setMenuItemAvailability(Long id, boolean available) {
        MenuItem item = findById(id);
        item.setAvailable(available);
        return MenuItemResponse.fromEntity(menuItemRepository.save(item));
    }

    @Transactional
    public void deleteMenuItem(Long id) {
        MenuItem item = findById(id);
        item.setAvailable(false);
        menuItemRepository.save(item);
    }

    private MenuItem findById(Long id) {
        return menuItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable: " + id));
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    private BigDecimal requirePrice(BigDecimal price) {
        if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Prix invalide.");
        }
        return price;
    }
}
