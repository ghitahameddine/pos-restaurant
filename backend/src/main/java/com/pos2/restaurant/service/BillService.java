package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.BillRequest;
import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.enums.BillRequestStatus;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.TableStatus;
import com.pos2.restaurant.dto.BillRequestResponse;
import com.pos2.restaurant.dto.CreateBillRequest;
import com.pos2.restaurant.dto.PrintBillRequest;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.BillRequestRepository;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class BillService {

    private static final DateTimeFormatter BILL_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final BillRequestRepository billRequestRepository;
    private final CustomerOrderRepository orderRepository;
    private final RestaurantTableRepository tableRepository;
    private final OrderService orderService;
    private final RealtimeService realtimeService;
    private final QrSessionService qrSessionService;
    private final RewardService rewardService;

    public BillService(BillRequestRepository billRequestRepository, CustomerOrderRepository orderRepository, RestaurantTableRepository tableRepository, OrderService orderService, RealtimeService realtimeService, QrSessionService qrSessionService, RewardService rewardService) {
        this.billRequestRepository = billRequestRepository;
        this.orderRepository = orderRepository;
        this.tableRepository = tableRepository;
        this.orderService = orderService;
        this.realtimeService = realtimeService;
        this.qrSessionService = qrSessionService;
        this.rewardService = rewardService;
    }

    @Transactional(readOnly = true)
    public List<BillRequestResponse> getBillRequests(BillRequestStatus status) {
        if (status != null) {
            return billRequestRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                    .map(BillRequestResponse::fromEntity)
                    .toList();
        }
        return billRequestRepository.findAll().stream()
                .map(BillRequestResponse::fromEntity)
                .toList();
    }

    @Transactional
    public BillRequestResponse requestBill(CreateBillRequest request) {
        CustomerOrder order = orderService.findOrder(request.orderId());

        if (order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("Cette commande est deja cloturee.");
        }
        if (billRequestRepository.existsByOrder_IdAndStatus(order.getId(), BillRequestStatus.PENDING)) {
            throw new BadRequestException("Une demande d'addition existe deja pour cette commande.");
        }

        BillRequest billRequest = new BillRequest(generateBillNumber(), order);
        tableRepository.findByNumber(order.getTableNumber()).ifPresent(table -> {
            table.setStatus(TableStatus.IN_SERVICE);
            tableRepository.save(table);
        });

        BillRequestResponse response = BillRequestResponse.fromEntity(billRequestRepository.save(billRequest));
        realtimeService.publishBillRequest(response);
        realtimeService.publishTable(response.tableNumber());
        return response;
    }

    @Transactional
    public BillRequestResponse printBill(Long id, PrintBillRequest request) {
        BillRequest billRequest = billRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Demande d'addition introuvable: " + id));
        if (billRequest.getStatus() == BillRequestStatus.PRINTED) {
            throw new BadRequestException("Cette addition est deja imprimee.");
        }

        CustomerOrder order = billRequest.getOrder();
        OrderStatus previousStatus = order.getStatus();
        order.setPaymentMethod(request.paymentMethod());
        order.setStatus(OrderStatus.PAID);
        if (previousStatus != OrderStatus.PAID) {
            rewardService.awardPaidOrderPoints(order);
        }
        orderRepository.save(order);

        billRequest.markPrinted();
        tableRepository.findByNumber(order.getTableNumber()).ifPresent(table -> {
            table.setStatus(TableStatus.PAID_STILL_SEATED);
            tableRepository.save(table);
        });
        qrSessionService.closeActiveSessionsForTable(order.getTableNumber());

        BillRequestResponse response = BillRequestResponse.fromEntity(billRequestRepository.save(billRequest));
        realtimeService.publishBillRequest(response);
        realtimeService.publishOrder(response.order());
        realtimeService.publishTable(response.tableNumber());
        return response;
    }

    private String generateBillNumber() {
        return "BILL-" + LocalDateTime.now().format(BILL_FORMAT);
    }
}
