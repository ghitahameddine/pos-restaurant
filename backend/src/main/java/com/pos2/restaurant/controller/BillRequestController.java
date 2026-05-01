package com.pos2.restaurant.controller;

import com.pos2.restaurant.domain.enums.BillRequestStatus;
import com.pos2.restaurant.dto.BillRequestResponse;
import com.pos2.restaurant.dto.CreateBillRequest;
import com.pos2.restaurant.dto.PrintBillRequest;
import com.pos2.restaurant.service.BillService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/bill-requests")
public class BillRequestController {

    private final BillService billService;

    public BillRequestController(BillService billService) {
        this.billService = billService;
    }

    @GetMapping
    public List<BillRequestResponse> getBillRequests(@RequestParam(required = false) BillRequestStatus status) {
        return billService.getBillRequests(status);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BillRequestResponse requestBill(@Valid @RequestBody CreateBillRequest request) {
        return billService.requestBill(request);
    }

    @PostMapping("/{id}/print")
    public BillRequestResponse printBill(@PathVariable Long id, @Valid @RequestBody PrintBillRequest request) {
        return billService.printBill(id, request);
    }
}

