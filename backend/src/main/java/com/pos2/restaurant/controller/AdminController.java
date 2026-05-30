package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.AdminDashboardResponse;
import com.pos2.restaurant.dto.OrderResponse;
import com.pos2.restaurant.dto.RestaurantStateRequest;
import com.pos2.restaurant.dto.RestaurantStateResponse;
import com.pos2.restaurant.dto.StaffRequest;
import com.pos2.restaurant.dto.StaffResponse;
import com.pos2.restaurant.dto.UserAccountResponse;
import com.pos2.restaurant.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/dashboard")
    public AdminDashboardResponse getDashboard() {
        return adminService.getDashboard();
    }

    @GetMapping("/staff")
    public List<StaffResponse> getStaff() {
        return adminService.getStaff();
    }

    @GetMapping("/users")
    public List<UserAccountResponse> getUsers() {
        return adminService.getUsers();
    }

    @PostMapping("/staff")
    @ResponseStatus(HttpStatus.CREATED)
    public StaffResponse createStaff(@RequestBody StaffRequest request) {
        return adminService.createStaff(request);
    }

    @PatchMapping("/staff/{id}")
    public StaffResponse updateStaff(@PathVariable Long id, @RequestBody StaffRequest request) {
        return adminService.updateStaff(id, request);
    }

    @DeleteMapping("/staff/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateStaff(@PathVariable Long id) {
        adminService.deactivateStaff(id);
    }

    @DeleteMapping("/staff/{id}/permanent")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStaffPermanently(@PathVariable Long id) {
        adminService.deleteUserPermanently(id);
    }

    @PatchMapping("/users/{id}/deactivate")
    public UserAccountResponse deactivateUser(@PathVariable Long id) {
        return adminService.deactivateUser(id);
    }

    @DeleteMapping("/users/{id}/permanent")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUserPermanently(@PathVariable Long id) {
        adminService.deleteUserPermanently(id);
    }

    @GetMapping("/restaurant-state")
    public RestaurantStateResponse getRestaurantState() {
        return adminService.getRestaurantState();
    }

    @PatchMapping("/restaurant-state")
    public RestaurantStateResponse updateRestaurantState(@RequestBody RestaurantStateRequest request) {
        return adminService.updateRestaurantState(request);
    }

    @PatchMapping("/orders/{id}/cancel")
    public OrderResponse cancelOrder(@PathVariable Long id) {
        return adminService.cancelOrder(id);
    }

    @PatchMapping("/orders/{id}/reopen-payment")
    public OrderResponse reopenPayment(@PathVariable Long id) {
        return adminService.reopenPayment(id);
    }
}
