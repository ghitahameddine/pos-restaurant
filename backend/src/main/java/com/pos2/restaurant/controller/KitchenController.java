package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.KitchenManagerTicketResponse;
import com.pos2.restaurant.dto.KitchenStationTicketResponse;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.service.KitchenService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/kitchen")
public class KitchenController {

    private final KitchenService kitchenService;

    public KitchenController(KitchenService kitchenService) {
        this.kitchenService = kitchenService;
    }

    @GetMapping("/stations/{station}")
    public List<KitchenStationTicketResponse> getStationBoard(@PathVariable String station) {
        return kitchenService.getStationBoard(station);
    }

    @PatchMapping("/stations/{station}/orders/{orderId}/start")
    public KitchenStationTicketResponse startStationOrder(@PathVariable String station, @PathVariable Long orderId) {
        return kitchenService.startStationOrder(station, orderId);
    }

    @PatchMapping("/stations/{station}/orders/{orderId}/ready")
    public KitchenStationTicketResponse markStationReady(@PathVariable String station, @PathVariable Long orderId) {
        return kitchenService.markStationReady(station, orderId);
    }

    @GetMapping("/manager")
    public List<KitchenManagerTicketResponse> getManagerBoard() {
        return kitchenService.getManagerBoard();
    }

    @PostMapping("/orders/{orderId}/complete")
    public OrderResponse completeKitchenOrder(@PathVariable Long orderId) {
        return kitchenService.completeKitchenOrder(orderId);
    }
}
