package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.LoyaltySummaryResponse;
import com.pos2.restaurant.service.RewardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/loyalty")
public class LoyaltyController {

    private final RewardService rewardService;

    public LoyaltyController(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @GetMapping("/me")
    public LoyaltySummaryResponse getMyLoyalty(@RequestHeader(value = "X-Client-Phone", required = false) String clientPhone) {
        return rewardService.getLoyaltyForClient(clientPhone);
    }
}
