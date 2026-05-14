package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.RedeemRewardResponse;
import com.pos2.restaurant.dto.RewardRequest;
import com.pos2.restaurant.dto.RewardResponse;
import com.pos2.restaurant.service.RewardService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rewards")
public class RewardController {

    private final RewardService rewardService;

    public RewardController(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @GetMapping
    public List<RewardResponse> getRewards() {
        return rewardService.getActiveRewards();
    }

    @GetMapping("/admin")
    public List<RewardResponse> getAdminRewards() {
        return rewardService.getAllRewards();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RewardResponse createReward(@RequestBody RewardRequest request) {
        return rewardService.createReward(request);
    }

    @PatchMapping("/{rewardId}")
    public RewardResponse updateReward(@PathVariable Long rewardId, @RequestBody RewardRequest request) {
        return rewardService.updateReward(rewardId, request);
    }

    @DeleteMapping("/{rewardId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReward(@PathVariable Long rewardId) {
        rewardService.deleteReward(rewardId);
    }

    @PostMapping("/{rewardId}/redeem")
    public RedeemRewardResponse redeemReward(
            @PathVariable Long rewardId,
            @RequestHeader(value = "X-Client-Phone", required = false) String clientPhone
    ) {
        return rewardService.redeemReward(rewardId, clientPhone);
    }
}
