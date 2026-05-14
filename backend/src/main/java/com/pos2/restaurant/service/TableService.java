package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.RestaurantTable;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.TableStatus;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.TableRequest;
import com.pos2.restaurant.dto.TableResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TableService {

    private final RestaurantTableRepository tableRepository;
    private final RealtimeService realtimeService;
    private final CustomerOrderRepository orderRepository;
    private final KitchenService kitchenService;

    public TableService(
            RestaurantTableRepository tableRepository,
            RealtimeService realtimeService,
            CustomerOrderRepository orderRepository,
            KitchenService kitchenService
    ) {
        this.tableRepository = tableRepository;
        this.realtimeService = realtimeService;
        this.orderRepository = orderRepository;
        this.kitchenService = kitchenService;
    }

    @Transactional(readOnly = true)
    public List<TableResponse> getTables() {
        return tableRepository.findByActiveTrueOrderByNumberAsc()
                .stream()
                .map(TableResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TableResponse> getAllTables() {
        return tableRepository.findAll().stream()
                .map(TableResponse::fromEntity)
                .toList();
    }

    @Transactional
    public TableResponse createTable(TableRequest request) {
        Integer number = requireTableNumber(request.number());
        tableRepository.findByNumber(number).ifPresent(table -> {
            throw new BadRequestException("Cette table existe deja.");
        });

        RestaurantTable table = new RestaurantTable(number);
        table.setActive(request.active() == null || request.active());
        table.setQrUrl(cleanOptionalText(request.qrUrl()));
        if (request.status() != null) {
            table.setStatus(request.status());
        }
        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
        return TableResponse.fromEntity(saved);
    }

    @Transactional
    public TableResponse updateTable(Long id, TableRequest request) {
        RestaurantTable table = tableRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + id));
        Integer number = requireTableNumber(request.number());

        tableRepository.findByNumber(number)
                .filter(existingTable -> !existingTable.getId().equals(id))
                .ifPresent(existingTable -> {
                    throw new BadRequestException("Une autre table utilise deja ce numero.");
                });

        table.setNumber(number);
        table.setActive(request.active() == null || request.active());
        table.setQrUrl(cleanOptionalText(request.qrUrl()));
        if (request.status() != null) {
            table.setStatus(request.status());
        }

        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
        return TableResponse.fromEntity(saved);
    }

    @Transactional
    public void deactivateTable(Long id) {
        RestaurantTable table = tableRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + id));
        if (orderRepository.existsByTableNumberAndStatusIn(table.getNumber(), List.of(
                OrderStatus.PENDING_SERVER_VALIDATION,
                OrderStatus.CONFIRMED,
                OrderStatus.IN_KITCHEN,
                OrderStatus.READY,
                OrderStatus.SERVED
        ))) {
            throw new BadRequestException("Impossible de supprimer une table avec commande active.");
        }
        table.setActive(false);
        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
    }

    @Transactional
    public void deleteTable(Long id) {
        RestaurantTable table = tableRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + id));
        if (orderRepository.existsByTableNumberAndStatusIn(table.getNumber(), List.of(
                OrderStatus.PENDING_SERVER_VALIDATION,
                OrderStatus.CONFIRMED,
                OrderStatus.IN_KITCHEN,
                OrderStatus.READY,
                OrderStatus.SERVED
        ))) {
            throw new BadRequestException("Impossible de supprimer definitivement une table avec commande active.");
        }
        Integer tableNumber = table.getNumber();
        tableRepository.delete(table);
        realtimeService.publishTable(tableNumber);
    }

    @Transactional
    public TableResponse releaseTable(Integer tableNumber) {
        RestaurantTable table = findByNumber(tableNumber);

        if (table.getStatus() != TableStatus.PAID_STILL_SEATED) {
            throw new BadRequestException("La table n'est pas encore payee ou deja liberee.");
        }

        table.setStatus(TableStatus.CLEANING);
        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
        return TableResponse.fromEntity(saved);
    }

    @Transactional
    public TableResponse markTableAvailable(Integer tableNumber) {
        RestaurantTable table = findByNumber(tableNumber);
        table.setStatus(TableStatus.AVAILABLE);
        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
        return TableResponse.fromEntity(saved);
    }

    @Transactional
    public TableResponse forceAvailable(Integer tableNumber) {
        RestaurantTable table = findByNumber(tableNumber);
        List<OrderStatus> activeStatuses = List.of(
                OrderStatus.PENDING_SERVER_VALIDATION,
                OrderStatus.CONFIRMED,
                OrderStatus.IN_KITCHEN,
                OrderStatus.READY,
                OrderStatus.SERVED
        );

        List<CustomerOrder> activeOrders = orderRepository.findByTableNumberOrderByCreatedAtDesc(tableNumber)
                .stream()
                .filter(order -> activeStatuses.contains(order.getStatus()))
                .toList();

        for (CustomerOrder order : activeOrders) {
            order.setStatus(OrderStatus.CANCELLED);
            kitchenService.releaseAllKitchenResources(order.getId(), true);
            CustomerOrder savedOrder = orderRepository.save(order);
            realtimeService.publishOrder(OrderResponse.fromEntity(savedOrder));
        }

        table.setStatus(TableStatus.AVAILABLE);
        RestaurantTable saved = tableRepository.save(table);
        realtimeService.publishTable(saved.getNumber());
        return TableResponse.fromEntity(saved);
    }

    private RestaurantTable findByNumber(Integer tableNumber) {
        return tableRepository.findByNumber(tableNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Table introuvable: " + tableNumber));
    }

    private Integer requireTableNumber(Integer tableNumber) {
        if (tableNumber == null || tableNumber < 1) {
            throw new BadRequestException("Numero de table invalide.");
        }
        return tableNumber;
    }

    private String cleanOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
