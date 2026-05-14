package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.RestaurantState;
import com.pos2.restaurant.domain.RestaurantTable;
import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.BillRequestStatus;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.TableStatus;
import com.pos2.restaurant.domain.enums.UserRole;
import com.pos2.restaurant.dto.AdminDashboardResponse;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.RestaurantStateRequest;
import com.pos2.restaurant.dto.RestaurantStateResponse;
import com.pos2.restaurant.dto.StaffRequest;
import com.pos2.restaurant.dto.StaffResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.BillRequestRepository;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.RestaurantStateRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import com.pos2.restaurant.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class AdminService {

    private static final List<OrderStatus> ACTIVE_ORDER_STATUSES = List.of(
            OrderStatus.PENDING_SERVER_VALIDATION,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_KITCHEN,
            OrderStatus.READY,
            OrderStatus.SERVED
    );

    private final CustomerOrderRepository orderRepository;
    private final RestaurantTableRepository tableRepository;
    private final BillRequestRepository billRequestRepository;
    private final UserRepository userRepository;
    private final RestaurantStateRepository restaurantStateRepository;
    private final PasswordEncoder passwordEncoder;
    private final KitchenService kitchenService;
    private final RealtimeService realtimeService;

    public AdminService(
            CustomerOrderRepository orderRepository,
            RestaurantTableRepository tableRepository,
            BillRequestRepository billRequestRepository,
            UserRepository userRepository,
            RestaurantStateRepository restaurantStateRepository,
            PasswordEncoder passwordEncoder,
            KitchenService kitchenService,
            RealtimeService realtimeService
    ) {
        this.orderRepository = orderRepository;
        this.tableRepository = tableRepository;
        this.billRequestRepository = billRequestRepository;
        this.userRepository = userRepository;
        this.restaurantStateRepository = restaurantStateRepository;
        this.passwordEncoder = passwordEncoder;
        this.kitchenService = kitchenService;
        this.realtimeService = realtimeService;
    }

    @Transactional
    public AdminDashboardResponse getDashboard() {
        List<CustomerOrder> orders = orderRepository.findAll();
        List<RestaurantTable> tables = tableRepository.findAll();
        Instant kitchenDelayLimit = Instant.now().minus(Duration.ofMinutes(15));
        Instant startOfDay = LocalDate.now()
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant();

        long activeOrders = orders.stream()
                .filter(order -> ACTIVE_ORDER_STATUSES.contains(order.getStatus()))
                .count();
        long ordersToValidate = orders.stream()
                .filter(order -> order.getStatus() == OrderStatus.PENDING_SERVER_VALIDATION)
                .count();
        long kitchenOrders = orders.stream()
                .filter(order -> order.getStatus() == OrderStatus.IN_KITCHEN || order.getStatus() == OrderStatus.CONFIRMED)
                .count();
        long readyOrders = orders.stream()
                .filter(order -> order.getStatus() == OrderStatus.READY)
                .count();
        long kitchenDelayedOrders = orders.stream()
                .filter(order -> (order.getStatus() == OrderStatus.IN_KITCHEN || order.getStatus() == OrderStatus.CONFIRMED)
                        && order.getUpdatedAt().isBefore(kitchenDelayLimit))
                .count();
        long occupiedTables = tables.stream()
                .filter(table -> table.getStatus() == TableStatus.IN_SERVICE || table.getStatus() == TableStatus.BILL_REQUESTED)
                .count();
        long paidStillSeatedTables = tables.stream()
                .filter(table -> table.getStatus() == TableStatus.PAID_STILL_SEATED)
                .count();
        long billRequests = billRequestRepository.findByStatusOrderByCreatedAtDesc(BillRequestStatus.PENDING).size();
        BigDecimal salesToday = orders.stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID)
                .filter(order -> order.getUpdatedAt().isAfter(startOfDay))
                .map(CustomerOrder::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new AdminDashboardResponse(
                activeOrders,
                ordersToValidate,
                kitchenOrders,
                readyOrders,
                occupiedTables,
                paidStillSeatedTables,
                billRequests,
                kitchenDelayedOrders,
                salesToday,
                RestaurantStateResponse.fromEntity(getOrCreateRestaurantState())
        );
    }

    @Transactional(readOnly = true)
    public List<StaffResponse> getStaff() {
        return userRepository.findAll().stream()
                .filter(user -> user.getRole() != UserRole.CLIENT)
                .map(StaffResponse::fromEntity)
                .toList();
    }

    @Transactional
    public StaffResponse createStaff(StaffRequest request) {
        if (userRepository.existsByPhone(requireText(request.phone(), "Telephone obligatoire."))) {
            throw new BadRequestException("Ce telephone existe deja.");
        }
        if (request.password() == null || request.password().isBlank()) {
            throw new BadRequestException("Mot de passe obligatoire.");
        }

        User user = new User(
                request.phone().trim(),
                passwordEncoder.encode(request.password()),
                requireText(request.name(), "Nom obligatoire."),
                normalizeStaffRole(request.role())
        );
        user.setAssignedTables(cleanAssignedTables(request.assignedTables()));
        user.setActive(request.active() == null || request.active());
        return StaffResponse.fromEntity(userRepository.save(user));
    }

    @Transactional
    public StaffResponse updateStaff(Long id, StaffRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff introuvable: " + id));

        String nextPhone = requireText(request.phone(), "Telephone obligatoire.");
        userRepository.findByPhone(nextPhone)
                .filter(existingUser -> !existingUser.getId().equals(id))
                .ifPresent(existingUser -> {
                    throw new BadRequestException("Ce telephone est deja utilise.");
                });

        user.setPhone(nextPhone);
        user.setName(requireText(request.name(), "Nom obligatoire."));
        user.setRole(normalizeStaffRole(request.role()));
        user.setAssignedTables(cleanAssignedTables(request.assignedTables()));
        user.setActive(request.active() == null || request.active());

        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }

        return StaffResponse.fromEntity(userRepository.save(user));
    }

    @Transactional
    public void deactivateStaff(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff introuvable: " + id));
        user.setActive(false);
        userRepository.save(user);
    }

    @Transactional
    public RestaurantStateResponse getRestaurantState() {
        return RestaurantStateResponse.fromEntity(getOrCreateRestaurantState());
    }

    @Transactional
    public RestaurantStateResponse updateRestaurantState(RestaurantStateRequest request) {
        RestaurantState state = getOrCreateRestaurantState();
        if (request.open() != null) {
            state.setOpen(request.open());
        }
        if (request.orderingPaused() != null) {
            state.setOrderingPaused(request.orderingPaused());
        }
        if (request.qrOrderingPaused() != null) {
            state.setQrOrderingPaused(request.qrOrderingPaused());
        }
        if (request.message() != null) {
            state.setMessage(request.message());
        }
        return RestaurantStateResponse.fromEntity(restaurantStateRepository.save(state));
    }

    @Transactional
    public OrderResponse cancelOrder(Long orderId) {
        CustomerOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable: " + orderId));
        order.setStatus(OrderStatus.CANCELLED);
        kitchenService.releaseAllKitchenResources(order.getId(), true);
        CustomerOrder savedOrder = orderRepository.save(order);

        if (!orderRepository.existsByTableNumberAndStatusIn(savedOrder.getTableNumber(), ACTIVE_ORDER_STATUSES)) {
            tableRepository.findByNumber(savedOrder.getTableNumber()).ifPresent(table -> {
                table.setStatus(TableStatus.AVAILABLE);
                tableRepository.save(table);
                realtimeService.publishTable(table.getNumber());
            });
        }

        OrderResponse response = OrderResponse.fromEntity(savedOrder);
        realtimeService.publishOrder(response);
        return response;
    }

    @Transactional
    public OrderResponse reopenPayment(Long orderId) {
        CustomerOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable: " + orderId));
        order.setStatus(OrderStatus.SERVED);
        order.setPaymentMethod(null);
        CustomerOrder savedOrder = orderRepository.save(order);

        tableRepository.findByNumber(savedOrder.getTableNumber()).ifPresent(table -> {
            table.setStatus(TableStatus.IN_SERVICE);
            tableRepository.save(table);
            realtimeService.publishTable(table.getNumber());
        });

        OrderResponse response = OrderResponse.fromEntity(savedOrder);
        realtimeService.publishOrder(response);
        return response;
    }

    private RestaurantState getOrCreateRestaurantState() {
        return restaurantStateRepository.findById(1L)
                .orElseGet(() -> restaurantStateRepository.save(RestaurantState.defaultState()));
    }

    private UserRole normalizeStaffRole(UserRole role) {
        if (role == null || role == UserRole.CLIENT) {
            return UserRole.WAITER;
        }
        return role;
    }

    private String cleanAssignedTables(String assignedTables) {
        if (assignedTables == null || assignedTables.isBlank()) {
            return "";
        }
        return assignedTables.replaceAll("[^0-9,]", "").trim();
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }
}
