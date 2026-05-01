package com.pos2.restaurant.service;

import com.pos2.restaurant.dto.TableResponse;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TableService {

    private final RestaurantTableRepository tableRepository;

    public TableService(RestaurantTableRepository tableRepository) {
        this.tableRepository = tableRepository;
    }

    @Transactional(readOnly = true)
    public List<TableResponse> getTables() {
        return tableRepository.findByActiveTrueOrderByNumberAsc()
                .stream()
                .map(TableResponse::fromEntity)
                .toList();
    }
}

