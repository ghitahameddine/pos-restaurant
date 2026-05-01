package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.CustomerOrder;
import com.pos2.restaurant.domain.enums.UserRole;
import com.pos2.restaurant.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RewardService {

    private static final Logger LOGGER = LoggerFactory.getLogger(RewardService.class);

    private final UserRepository userRepository;

    public RewardService(UserRepository userRepository) {
        this.userRepository = userRepository;
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
                    order.markRewardPointsApplied();
                    LOGGER.info(
                            "{} point(s) ajoutes au client {} pour la commande {}.",
                            order.getPoints(),
                            clientPhone,
                            order.getOrderNumber()
                    );
                });
    }
}
