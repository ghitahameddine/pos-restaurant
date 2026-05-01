package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.MenuItem;
import com.pos2.restaurant.domain.OrderLine;
import com.pos2.restaurant.domain.QrSession;
import com.pos2.restaurant.domain.RestaurantTable;
import com.pos2.restaurant.domain.enums.OrderSource;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.TableStatus;
import com.pos2.restaurant.dto.ClientCancelOrderRequest;
import com.pos2.restaurant.dto.ClientUpdateOrderRequest;
import com.pos2.restaurant.dto.CreateOrderRequest;
import com.pos2.restaurant.dto.OrderLineRequest;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.UpdateOrderStatusRequest;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.MenuItemRepository;
import com.pos2.restaurant.repository.QrSessionRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class OrderService {

    private static final DateTimeFormatter ORDER_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final CustomerOrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantTableRepository tableRepository;
    private final QrSessionRepository qrSessionRepository;
    private final RealtimeService realtimeService;
    private final RewardService rewardService;

    public OrderService(CustomerOrderRepository orderRepository, MenuItemRepository menuItemRepository, RestaurantTableRepository tableRepository, QrSessionRepository qrSessionRepository, RealtimeService realtimeService, RewardService rewardService) {
        this.orderRepository = orderRepository;
        this.menuItemRepository = menuItemRepository;
        this.tableRepository = tableRepository;
        this.qrSessionRepository = qrSessionRepository;
        this.realtimeService = realtimeService;
        this.rewardService = rewardService;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrders(OrderStatus status, Integer tableNumber) {
        if (status != null) {
            return orderRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                    .map(OrderResponse::fromEntity)
                    .toList();
        }
        if (tableNumber != null) {
            return orderRepository.findByTableNumberOrderByCreatedAtDesc(tableNumber).stream()
                    .map(OrderResponse::fromEntity)
                    .toList();
        }
        return orderRepository.findAll().stream()
                .map(OrderResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long id) {
        return OrderResponse.fromEntity(findOrder(id));
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        RestaurantTable table = tableRepository.findByNumber(request.tableNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + request.tableNumber()));

        OrderSource source = request.source() == null ? OrderSource.CLIENT_QR : request.source();
        OrderStatus initialStatus = source == OrderSource.SERVER_ASSISTED
                ? OrderStatus.CONFIRMED
                : OrderStatus.PENDING_SERVER_VALIDATION;
        String clientPhone = source == OrderSource.SERVER_ASSISTED ? null : resolveClientPhone(request.clientPhone());

        CustomerOrder order = new CustomerOrder(
                generateOrderNumber(),
                request.tableNumber(),
                clientPhone,
                source,
                initialStatus,
                request.comment()
        );

        for (OrderLineRequest lineRequest : request.items()) {
            MenuItem item = menuItemRepository.findById(lineRequest.menuItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable: " + lineRequest.menuItemId()));
            if (!item.isAvailable()) {
                throw new BadRequestException("Produit non disponible: " + item.getName());
            }
            order.addLine(new OrderLine(item, lineRequest.quantity()));
        }

        table.setStatus(TableStatus.IN_SERVICE);
        tableRepository.save(table);

        OrderResponse response = OrderResponse.fromEntity(orderRepository.save(order));
        realtimeService.publishOrder(response);
        realtimeService.publishTable(response.tableNumber());
        return response;
    }

    @Transactional
    public OrderResponse updateStatus(Long id, UpdateOrderStatusRequest request) {
        CustomerOrder order = findOrder(id);
        OrderStatus previousStatus = order.getStatus();
        order.setStatus(request.status());
        if (request.serverComment() != null && !request.serverComment().isBlank()) {
            order.setServerComment(request.serverComment());
        }

        if (request.status() == OrderStatus.PAID && previousStatus != OrderStatus.PAID) {
            rewardService.awardPaidOrderPoints(order);
        }

        tableRepository.findByNumber(order.getTableNumber()).ifPresent(table -> {
            if (request.status() == OrderStatus.PAID || request.status() == OrderStatus.CANCELLED) {
                table.setStatus(TableStatus.AVAILABLE);
            } else {
                table.setStatus(TableStatus.IN_SERVICE);
            }
            tableRepository.save(table);
        });

        OrderResponse response = OrderResponse.fromEntity(orderRepository.save(order));
        realtimeService.publishOrder(response);
        realtimeService.publishTable(response.tableNumber());
        return response;
    }

    @Transactional
    public OrderResponse clientUpdatePendingOrder(Long id, ClientUpdateOrderRequest request) {
        CustomerOrder order = findOrder(id);
        ensureClientCanChangeOrder(order, request.qrToken());

        order.setComment(request.comment());
        order.getItems().clear();
        order.recalculateTotals();

        for (OrderLineRequest lineRequest : request.items()) {
            MenuItem item = menuItemRepository.findById(lineRequest.menuItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable: " + lineRequest.menuItemId()));
            if (!item.isAvailable()) {
                throw new BadRequestException("Produit non disponible: " + item.getName());
            }
            order.addLine(new OrderLine(item, lineRequest.quantity()));
        }

        OrderResponse response = OrderResponse.fromEntity(orderRepository.save(order));
        realtimeService.publishOrder(response);
        return response;
    }

    @Transactional
    public OrderResponse clientCancelPendingOrder(Long id, ClientCancelOrderRequest request) {
        CustomerOrder order = findOrder(id);
        ensureClientCanChangeOrder(order, request.qrToken());
        order.setStatus(OrderStatus.CANCELLED);

        OrderResponse response = OrderResponse.fromEntity(orderRepository.save(order));

        tableRepository.findByNumber(order.getTableNumber()).ifPresent(table -> {
            List<OrderStatus> activeStatuses = List.of(
                    OrderStatus.PENDING_SERVER_VALIDATION,
                    OrderStatus.CONFIRMED,
                    OrderStatus.IN_KITCHEN,
                    OrderStatus.READY,
                    OrderStatus.SERVED
            );
            if (!orderRepository.existsByTableNumberAndStatusIn(order.getTableNumber(), activeStatuses)) {
                table.setStatus(TableStatus.AVAILABLE);
                tableRepository.save(table);
            }
        });

        realtimeService.publishOrder(response);
        realtimeService.publishTable(response.tableNumber());
        return response;
    }

    @Transactional(readOnly = true)
    public CustomerOrder findOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable: " + id));
    }

    private void ensureClientCanChangeOrder(CustomerOrder order, String qrToken) {
        if (order.getStatus() != OrderStatus.PENDING_SERVER_VALIDATION) {
            throw new BadRequestException("La commande est deja traitee par le serveur.");
        }

        QrSession session = qrSessionRepository.findByToken(qrToken)
                .orElseThrow(() -> new BadRequestException("Session QR introuvable."));
        if (!session.isUsable() || !session.getTableNumber().equals(order.getTableNumber())) {
            throw new BadRequestException("Session QR invalide pour cette commande.");
        }
    }

    private String generateOrderNumber() {
        return "ORD-" + LocalDateTime.now().format(ORDER_FORMAT);
    }

    private String resolveClientPhone(String requestedPhone) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_CLIENT".equals(authority.getAuthority()))) {
            return authentication.getName();
        }

        if (requestedPhone == null || requestedPhone.isBlank()) {
            return null;
        }
        return requestedPhone.trim();
    }
}
