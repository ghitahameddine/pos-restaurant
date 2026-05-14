package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.KitchenItem;
import com.pos2.restaurant.domain.OrderLine;
import com.pos2.restaurant.domain.Reward;
import com.pos2.restaurant.domain.Slot;
import com.pos2.restaurant.domain.enums.KitchenItemStatus;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.RewardType;
import com.pos2.restaurant.domain.enums.SlotStatus;
import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.dto.KitchenItemEntryResponse;
import com.pos2.restaurant.dto.KitchenManagerTicketResponse;
import com.pos2.restaurant.dto.KitchenStationProgressResponse;
import com.pos2.restaurant.dto.KitchenStationTicketResponse;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.KitchenItemRepository;
import com.pos2.restaurant.repository.SlotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class KitchenService {

    private static final String STATION_PLATS = "Plats";
    private static final String STATION_BOISSONS = "Boissons";
    private static final String STATION_DESSERTS = "Desserts";

    private final KitchenItemRepository kitchenItemRepository;
    private final CustomerOrderRepository orderRepository;
    private final SlotRepository slotRepository;
    private final RealtimeService realtimeService;

    public KitchenService(
            KitchenItemRepository kitchenItemRepository,
            CustomerOrderRepository orderRepository,
            SlotRepository slotRepository,
            RealtimeService realtimeService
    ) {
        this.kitchenItemRepository = kitchenItemRepository;
        this.orderRepository = orderRepository;
        this.slotRepository = slotRepository;
        this.realtimeService = realtimeService;
    }

    @Transactional
    public void prepareOrderForKitchen(CustomerOrder order) {
        if (order.getStatus() != OrderStatus.CONFIRMED && order.getStatus() != OrderStatus.IN_KITCHEN) {
            return;
        }

        ensureKitchenSlot(order);
        syncOrderKitchenItems(order);
    }

    @Transactional
    public List<KitchenStationTicketResponse> getStationBoard(String stationKey) {
        repairKitchenState();
        String station = normalizeStation(stationKey);
        Map<Long, List<KitchenItem>> grouped = new LinkedHashMap<>();

        for (KitchenItem item : kitchenItemRepository.findByStationOrderByCreatedAtAsc(station)) {
            if (!isKitchenActive(item.getOrder().getStatus())) {
                continue;
            }
            grouped.computeIfAbsent(item.getOrder().getId(), ignored -> new ArrayList<>()).add(item);
        }

        return grouped.values().stream()
                .map(this::toStationTicket)
                .toList();
    }

    @Transactional
    public List<KitchenManagerTicketResponse> getManagerBoard() {
        repairKitchenState();
        return orderRepository.findByStatusInOrderByCreatedAtDesc(List.of(OrderStatus.CONFIRMED, OrderStatus.IN_KITCHEN)).stream()
                .map(this::toManagerTicket)
                .filter(ticket -> ticket != null)
                .toList();
    }

    @Transactional
    public KitchenStationTicketResponse startStationOrder(String stationKey, Long orderId) {
        CustomerOrder order = findKitchenOrder(orderId);
        List<KitchenItem> items = kitchenItemRepository.findByOrder_IdAndStationOrderByCreatedAtAsc(orderId, normalizeStation(stationKey));
        if (items.isEmpty()) {
            throw new BadRequestException("Aucun article pour ce poste.");
        }

        items.stream()
                .filter(item -> item.getStatus() != KitchenItemStatus.DONE)
                .forEach(item -> item.setStatus(KitchenItemStatus.IN_PROGRESS));

        if (order.getStatus() == OrderStatus.CONFIRMED) {
            order.setStatus(OrderStatus.IN_KITCHEN);
        }

        kitchenItemRepository.saveAll(items);
        orderRepository.save(order);
        publishOrder(order);
        return toStationTicket(items);
    }

    @Transactional
    public KitchenStationTicketResponse markStationReady(String stationKey, Long orderId) {
        CustomerOrder order = findKitchenOrder(orderId);
        List<KitchenItem> items = kitchenItemRepository.findByOrder_IdAndStationOrderByCreatedAtAsc(orderId, normalizeStation(stationKey));
        if (items.isEmpty()) {
            throw new BadRequestException("Aucun article pour ce poste.");
        }

        items.forEach(item -> item.setStatus(KitchenItemStatus.DONE));
        kitchenItemRepository.saveAll(items);
        publishOrder(order);
        return toStationTicket(items);
    }

    @Transactional
    public OrderResponse completeKitchenOrder(Long orderId) {
        CustomerOrder order = findKitchenOrder(orderId);
        List<KitchenItem> items = kitchenItemRepository.findByOrder_IdOrderByCreatedAtAsc(orderId);
        if (items.isEmpty()) {
            throw new BadRequestException("Aucun article cuisine pour cette commande.");
        }

        boolean allDone = items.stream().allMatch(item -> item.getStatus() == KitchenItemStatus.DONE);
        if (!allDone) {
            throw new BadRequestException("Toutes les parties ne sont pas encore pretes.");
        }

        Slot kitchenSlot = slotRepository.findByCurrentOrderIdAndZone(orderId, SlotZone.KITCHEN)
                .orElseThrow(() -> new BadRequestException("Slot cuisine introuvable pour cette commande."));

        Slot counterSlot = slotRepository.findByZoneAndNumber(SlotZone.COUNTER, kitchenSlot.getNumber())
                .filter(slot -> slot.getStatus() == SlotStatus.FREE)
                .or(() -> slotRepository.findFirstByZoneAndStatusOrderByNumberAsc(SlotZone.COUNTER, SlotStatus.FREE))
                .orElseThrow(() -> new BadRequestException("Aucun slot comptoir libre."));

        kitchenSlot.free();
        counterSlot.reserveForOrder(orderId);
        slotRepository.save(kitchenSlot);
        slotRepository.save(counterSlot);

        order.setStatus(OrderStatus.READY);
        orderRepository.save(order);
        publishOrder(order);
        return OrderResponse.fromEntity(order);
    }

    @Transactional
    public void releaseCounterSlotForOrder(Long orderId) {
        slotRepository.findByCurrentOrderIdAndZone(orderId, SlotZone.COUNTER)
                .ifPresent(slot -> {
                    slot.free();
                    slotRepository.save(slot);
                });
    }

    @Transactional
    public void releaseAllKitchenResources(Long orderId, boolean removeKitchenItems) {
        slotRepository.findByCurrentOrderIdAndZone(orderId, SlotZone.KITCHEN)
                .ifPresent(slot -> {
                    slot.free();
                    slotRepository.save(slot);
                });

        slotRepository.findByCurrentOrderIdAndZone(orderId, SlotZone.COUNTER)
                .ifPresent(slot -> {
                    slot.free();
                    slotRepository.save(slot);
                });

        if (removeKitchenItems) {
            List<KitchenItem> items = kitchenItemRepository.findByOrder_IdOrderByCreatedAtAsc(orderId);
            if (!items.isEmpty()) {
                kitchenItemRepository.deleteAll(items);
            }
        }
    }

    private void ensureKitchenSlot(CustomerOrder order) {
        if (slotRepository.findByCurrentOrderIdAndZone(order.getId(), SlotZone.KITCHEN).isPresent()) {
            return;
        }

        Slot slot = slotRepository.findFirstByZoneAndStatusOrderByNumberAsc(SlotZone.KITCHEN, SlotStatus.FREE)
                .orElseThrow(() -> new BadRequestException("Aucun slot cuisine libre pour la commande " + order.getOrderNumber() + "."));
        slot.reserveForOrder(order.getId());
        slotRepository.save(slot);
    }

    private void repairKitchenState() {
        releaseStaleSlots();
        orderRepository.findByStatusInOrderByCreatedAtDesc(List.of(OrderStatus.CONFIRMED, OrderStatus.IN_KITCHEN))
                .forEach(this::prepareOrderForKitchen);
    }

    private void releaseStaleSlots() {
        List<Slot> staleSlots = slotRepository.findAll().stream()
                .filter(slot -> slot.getCurrentOrderId() != null)
                .filter(this::isStaleSlot)
                .toList();

        staleSlots.forEach(Slot::free);
        if (!staleSlots.isEmpty()) {
            slotRepository.saveAll(staleSlots);
        }
    }

    private boolean isStaleSlot(Slot slot) {
        return orderRepository.findById(slot.getCurrentOrderId())
                .map(order -> {
                    if (slot.getZone() == SlotZone.KITCHEN) {
                        return !isKitchenActive(order.getStatus());
                    }
                    if (slot.getZone() == SlotZone.COUNTER) {
                        return order.getStatus() != OrderStatus.READY;
                    }
                    return false;
                })
                .orElse(true);
    }

    private void syncOrderKitchenItems(CustomerOrder order) {
        List<KitchenItem> existingItems = kitchenItemRepository.findByOrder_IdOrderByCreatedAtAsc(order.getId());

        for (OrderLine line : order.getItems()) {
            boolean alreadyExists = existingItems.stream()
                    .anyMatch(item -> item.getOrderLine() != null && item.getOrderLine().getId().equals(line.getId()));
            if (!alreadyExists) {
                kitchenItemRepository.save(new KitchenItem(order, line, normalizeStation(line.getStation())));
            }
        }

        createRewardKitchenItemIfNeeded(order, existingItems);
    }

    private void createRewardKitchenItemIfNeeded(CustomerOrder order, List<KitchenItem> existingItems) {
        Reward reward = order.getRedeemedReward();
        if (reward == null || reward.getType() != RewardType.FREE_ITEM) {
            return;
        }

        RewardKitchenInfo rewardInfo = resolveRewardKitchenInfo(reward);
        boolean alreadyExists = existingItems.stream()
                .anyMatch(item -> item.isRewardItem() && item.getItemName().equalsIgnoreCase(rewardInfo.itemName()));
        if (alreadyExists) {
            return;
        }

        kitchenItemRepository.save(new KitchenItem(order, rewardInfo.itemName(), 1, rewardInfo.station(), true));
    }

    private RewardKitchenInfo resolveRewardKitchenInfo(Reward reward) {
        String rewardText = ((reward.getDescription() == null ? "" : reward.getDescription()) + " " + reward.getName())
                .toLowerCase(Locale.ROOT);

        if (rewardText.contains("orange")) {
            return new RewardKitchenInfo("Jus Orange Frais", STATION_BOISSONS);
        }

        if (rewardText.contains("dessert")) {
            return new RewardKitchenInfo("Tiramisu", STATION_DESSERTS);
        }

        return new RewardKitchenInfo(reward.getName(), STATION_PLATS);
    }

    private KitchenStationTicketResponse toStationTicket(List<KitchenItem> items) {
        if (items.isEmpty()) {
            throw new BadRequestException("Aucun ticket poste a afficher.");
        }

        CustomerOrder order = items.get(0).getOrder();
        Slot slot = slotRepository.findByCurrentOrderIdAndZone(order.getId(), SlotZone.KITCHEN).orElse(null);
        KitchenItemStatus status = resolveStationStatus(items);

        return new KitchenStationTicketResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getTableNumber(),
                toStationKey(items.get(0).getStation()),
                items.get(0).getStation(),
                slot != null ? slot.getNumber() : null,
                slot != null ? slot.getColor() : null,
                slot != null ? buildSlotLabel(slot) : "Slot non attribue",
                order.getComment(),
                elapsedMinutes(order.getCreatedAt()),
                status,
                items.stream()
                        .map(item -> new KitchenItemEntryResponse(item.getId(), item.getItemName(), item.getQuantity(), item.isRewardItem()))
                        .toList()
        );
    }

    private KitchenManagerTicketResponse toManagerTicket(CustomerOrder order) {
        List<KitchenItem> items = kitchenItemRepository.findByOrder_IdOrderByCreatedAtAsc(order.getId());
        if (items.isEmpty()) {
            return null;
        }

        Slot slot = slotRepository.findByCurrentOrderIdAndZone(order.getId(), SlotZone.KITCHEN).orElse(null);
        KitchenStationProgressResponse plats = buildProgress(items, STATION_PLATS);
        KitchenStationProgressResponse boissons = buildProgress(items, STATION_BOISSONS);
        KitchenStationProgressResponse desserts = buildProgress(items, STATION_DESSERTS);

        boolean completeReady = isStationReady(plats) && isStationReady(boissons) && isStationReady(desserts);

        return new KitchenManagerTicketResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getTableNumber(),
                slot != null ? slot.getNumber() : null,
                slot != null ? slot.getColor() : null,
                slot != null ? buildSlotLabel(slot) : "Slot non attribue",
                order.getComment(),
                elapsedMinutes(order.getCreatedAt()),
                plats,
                boissons,
                desserts,
                completeReady
        );
    }

    private KitchenStationProgressResponse buildProgress(List<KitchenItem> items, String station) {
        List<KitchenItem> stationItems = items.stream()
                .filter(item -> station.equals(item.getStation()))
                .toList();

        if (stationItems.isEmpty()) {
            return new KitchenStationProgressResponse(toStationKey(station), station, false, null);
        }

        return new KitchenStationProgressResponse(
                toStationKey(station),
                station,
                true,
                resolveStationStatus(stationItems)
        );
    }

    private boolean isStationReady(KitchenStationProgressResponse progress) {
        return !progress.required() || progress.status() == KitchenItemStatus.DONE;
    }

    private KitchenItemStatus resolveStationStatus(List<KitchenItem> items) {
        boolean hasInProgress = items.stream().anyMatch(item -> item.getStatus() == KitchenItemStatus.IN_PROGRESS);
        boolean allDone = items.stream().allMatch(item -> item.getStatus() == KitchenItemStatus.DONE);
        if (allDone) {
            return KitchenItemStatus.DONE;
        }
        if (hasInProgress) {
            return KitchenItemStatus.IN_PROGRESS;
        }
        return KitchenItemStatus.WAITING;
    }

    private CustomerOrder findKitchenOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable: " + orderId));
    }

    private boolean isKitchenActive(OrderStatus status) {
        return status == OrderStatus.CONFIRMED || status == OrderStatus.IN_KITCHEN;
    }

    private long elapsedMinutes(Instant createdAt) {
        return Math.max(0, Duration.between(createdAt, Instant.now()).toMinutes());
    }

    private void publishOrder(CustomerOrder order) {
        OrderResponse response = OrderResponse.fromEntity(orderRepository.save(order));
        realtimeService.publishOrder(response);
        realtimeService.publishTable(order.getTableNumber());
    }

    private String normalizeStation(String stationKey) {
        String key = stationKey == null ? "" : stationKey.trim().toLowerCase(Locale.ROOT);
        return switch (key) {
            case "plats", "plat", "mains", "main" -> STATION_PLATS;
            case "boissons", "boisson", "drinks", "drink" -> STATION_BOISSONS;
            case "desserts", "dessert" -> STATION_DESSERTS;
            default -> throw new BadRequestException("Poste cuisine inconnu: " + stationKey);
        };
    }

    private String toStationKey(String station) {
        return switch (station) {
            case STATION_PLATS -> "plats";
            case STATION_BOISSONS -> "boissons";
            case STATION_DESSERTS -> "desserts";
            default -> station.toLowerCase(Locale.ROOT);
        };
    }

    private String buildSlotLabel(Slot slot) {
        return "Slot " + slot.getColorName();
    }

    private record RewardKitchenInfo(String itemName, String station) {
    }
}
