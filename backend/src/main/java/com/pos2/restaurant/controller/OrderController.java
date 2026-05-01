package com.pos2.restaurant.controller;

import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.dto.ClientCancelOrderRequest;
import com.pos2.restaurant.dto.ClientUpdateOrderRequest;
import com.pos2.restaurant.dto.CreateOrderRequest;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.UpdateOrderStatusRequest;
import com.pos2.restaurant.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public List<OrderResponse> getOrders(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) Integer tableNumber
    ) {
        return orderService.getOrders(status, tableNumber);
    }

    @GetMapping("/{id}")
    public OrderResponse getOrder(@PathVariable Long id) {
        return orderService.getOrder(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return orderService.createOrder(request);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateOrderStatusRequest request) {
        return orderService.updateStatus(id, request);
    }

    @PatchMapping("/{id}/client-update")
    public OrderResponse clientUpdateOrder(@PathVariable Long id, @Valid @RequestBody ClientUpdateOrderRequest request) {
        return orderService.clientUpdatePendingOrder(id, request);
    }

    @PatchMapping("/{id}/client-cancel")
    public OrderResponse clientCancelOrder(@PathVariable Long id, @Valid @RequestBody ClientCancelOrderRequest request) {
        return orderService.clientCancelPendingOrder(id, request);
    }
}
