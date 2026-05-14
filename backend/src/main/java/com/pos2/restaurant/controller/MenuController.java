package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.MenuItemRequest;
import com.pos2.restaurant.dto.MenuItemResponse;
import com.pos2.restaurant.service.MenuService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/menu")
public class MenuController {

    private final MenuService menuService;

    public MenuController(MenuService menuService) {
        this.menuService = menuService;
    }

    @GetMapping
    public List<MenuItemResponse> getMenu() {
        return menuService.getAvailableMenu();
    }

    @GetMapping("/admin")
    public List<MenuItemResponse> getAdminMenu() {
        return menuService.getAllMenuItems();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MenuItemResponse createMenuItem(@RequestBody MenuItemRequest request) {
        return menuService.createMenuItem(request);
    }

    @PatchMapping("/{id}")
    public MenuItemResponse updateMenuItem(@PathVariable Long id, @RequestBody MenuItemRequest request) {
        return menuService.updateMenuItem(id, request);
    }

    @PatchMapping("/{id}/availability")
    public MenuItemResponse setMenuItemAvailability(@PathVariable Long id, @RequestBody MenuItemRequest request) {
        return menuService.setMenuItemAvailability(id, request.available() == null || request.available());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenuItem(@PathVariable Long id) {
        menuService.deleteMenuItem(id);
    }
}
