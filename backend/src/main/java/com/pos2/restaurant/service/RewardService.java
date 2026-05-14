package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.BillRequest;
import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.LoyaltyTransaction;
import com.pos2.restaurant.domain.Reward;
import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.BillRequestStatus;
import com.pos2.restaurant.domain.enums.LoyaltyTransactionType;
import com.pos2.restaurant.domain.enums.OrderStatus;
import com.pos2.restaurant.domain.enums.UserRole;
import com.pos2.restaurant.dto.LoyaltySummaryResponse;
import com.pos2.restaurant.dto.LoyaltyTransactionResponse;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.RedeemRewardResponse;
import com.pos2.restaurant.dto.RewardRequest;
import com.pos2.restaurant.dto.RewardResponse;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.BillRequestRepository;
import com.pos2.restaurant.repository.CustomerOrderRepository;
import com.pos2.restaurant.repository.LoyaltyTransactionRepository;
import com.pos2.restaurant.repository.RewardRepository;
import com.pos2.restaurant.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RewardService {

    private static final Logger LOGGER = LoggerFactory.getLogger(RewardService.class);

    private static final List<OrderStatus> REDEEMABLE_STATUSES = List.of(
            OrderStatus.PENDING_SERVER_VALIDATION,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_KITCHEN,
            OrderStatus.READY,
            OrderStatus.SERVED
    );

    private final UserRepository userRepository;
    private final RewardRepository rewardRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final CustomerOrderRepository orderRepository;
    private final BillRequestRepository billRequestRepository;
    private final RealtimeService realtimeService;
    private final KitchenService kitchenService;

    public RewardService(
            UserRepository userRepository,
            RewardRepository rewardRepository,
            LoyaltyTransactionRepository loyaltyTransactionRepository,
            CustomerOrderRepository orderRepository,
            BillRequestRepository billRequestRepository,
            RealtimeService realtimeService,
            KitchenService kitchenService
    ) {
        this.userRepository = userRepository;
        this.rewardRepository = rewardRepository;
        this.loyaltyTransactionRepository = loyaltyTransactionRepository;
        this.orderRepository = orderRepository;
        this.billRequestRepository = billRequestRepository;
        this.realtimeService = realtimeService;
        this.kitchenService = kitchenService;
    }

    @Transactional(readOnly = true)
    public List<RewardResponse> getActiveRewards() {
        return rewardRepository.findByActiveTrueOrderByPointsCostAsc().stream()
                .map(RewardResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RewardResponse> getAllRewards() {
        return rewardRepository.findAll().stream()
                .map(RewardResponse::fromEntity)
                .toList();
    }

    @Transactional
    public RewardResponse createReward(RewardRequest request) {
        Reward reward = new Reward(
                requireText(request.name(), "Nom de recompense obligatoire."),
                requireText(request.description(), "Description obligatoire."),
                request.pointsCost() == null ? 0 : Math.max(0, request.pointsCost()),
                request.type() == null ? com.pos2.restaurant.domain.enums.RewardType.FREE_ITEM : request.type(),
                request.discountPercent()
        );
        reward.setActive(request.active() == null || request.active());
        return RewardResponse.fromEntity(rewardRepository.save(reward));
    }

    @Transactional
    public RewardResponse updateReward(Long id, RewardRequest request) {
        Reward reward = rewardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recompense introuvable: " + id));
        reward.setName(requireText(request.name(), "Nom de recompense obligatoire."));
        reward.setDescription(requireText(request.description(), "Description obligatoire."));
        reward.setPointsCost(request.pointsCost() == null ? 0 : Math.max(0, request.pointsCost()));
        reward.setType(request.type() == null ? reward.getType() : request.type());
        reward.setDiscountPercent(request.discountPercent());
        reward.setActive(request.active() == null || request.active());
        return RewardResponse.fromEntity(rewardRepository.save(reward));
    }

    @Transactional
    public void deleteReward(Long id) {
        Reward reward = rewardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recompense introuvable: " + id));
        reward.setActive(false);
        rewardRepository.save(reward);
    }

    @Transactional(readOnly = true)
    public LoyaltySummaryResponse getLoyaltyForClient(String clientPhone) {
        User user = getClientByPhone(clientPhone);
        return new LoyaltySummaryResponse(
                user.getPoints(),
                loyaltyTransactionRepository.findByUser_PhoneOrderByCreatedAtDesc(user.getPhone()).stream()
                        .map(LoyaltyTransactionResponse::fromEntity)
                        .toList(),
                getActiveRewards()
        );
    }

    @Transactional
    public RedeemRewardResponse redeemReward(Long rewardId, String clientPhone) {
        User user = getClientByPhone(clientPhone);
        Reward reward = rewardRepository.findById(rewardId)
                .filter(Reward::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Recompense introuvable: " + rewardId));

        if (user.getPoints() < reward.getPointsCost()) {
            throw new BadRequestException("Points insuffisants pour cette recompense.");
        }

        CustomerOrder order = orderRepository.findFirstByClientPhoneAndStatusInOrderByCreatedAtDesc(
                        user.getPhone(),
                        REDEEMABLE_STATUSES
                )
                .orElseThrow(() -> new BadRequestException("Aucune commande active a laquelle appliquer cette recompense."));

        if (order.hasRedeemedReward()) {
            throw new BadRequestException("Une recompense est deja appliquee sur cette commande.");
        }

        user.removePoints(reward.getPointsCost());
        order.applyReward(reward);

        loyaltyTransactionRepository.save(new LoyaltyTransaction(
                user,
                order,
                reward,
                reward.getPointsCost(),
                LoyaltyTransactionType.REDEEMED
        ));

        userRepository.save(user);
        orderRepository.save(order);
        kitchenService.prepareOrderForKitchen(order);

        billRequestRepository.findByOrder_IdAndStatus(order.getId(), BillRequestStatus.PENDING)
                .ifPresent(billRequest -> {
                    billRequest.syncTotalFromOrder();
                    realtimeService.publishBillRequest(com.pos2.restaurant.dto.BillRequestResponse.fromEntity(billRequest));
                });

        OrderResponse updatedOrder = OrderResponse.fromEntity(order);
        realtimeService.publishOrder(updatedOrder);
        realtimeService.publishTable(order.getTableNumber());

        return new RedeemRewardResponse(
                "Recompense appliquee avec succes sur la commande " + order.getOrderNumber() + ".",
                user.getPoints(),
                RewardResponse.fromEntity(reward),
                updatedOrder
        );
    }

    @Transactional
    public void awardPaidOrderPoints(CustomerOrder order) {
        if (order.isRewardPointsApplied() || order.getPoints() <= 0 || order.getClientPhone() == null || order.getClientPhone().isBlank()) {
            LOGGER.debug(
                    "Points non appliques pour la commande {}. dejaAppliques={}, points={}, clientPhone={}",
                    order.getOrderNumber(),
                    order.isRewardPointsApplied(),
                    order.getPoints(),
                    order.getClientPhone()
            );
            return;
        }

        String clientPhone = order.getClientPhone().trim();
        userRepository.findByPhone(clientPhone)
                .filter(user -> user.getRole() == UserRole.CLIENT)
                .ifPresent(user -> {
                    user.addPoints(order.getPoints());
                    userRepository.save(user);
                    loyaltyTransactionRepository.save(new LoyaltyTransaction(
                            user,
                            order,
                            null,
                            order.getPoints(),
                            LoyaltyTransactionType.EARNED
                    ));
                    order.markRewardPointsApplied();
                    LOGGER.info(
                            "{} point(s) ajoutes au client {} pour la commande {}.",
                            order.getPoints(),
                            clientPhone,
                            order.getOrderNumber()
                    );
                });
    }

    private User getClientByPhone(String clientPhone) {
        if (clientPhone == null || clientPhone.isBlank()) {
            throw new BadRequestException("Client non identifie.");
        }

        return userRepository.findByPhone(clientPhone.trim())
                .filter(user -> user.getRole() == UserRole.CLIENT)
                .orElseThrow(() -> new BadRequestException("Compte client introuvable."));
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }
}
