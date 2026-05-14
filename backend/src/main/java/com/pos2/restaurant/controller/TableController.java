package com.pos2.restaurant.controller;

import com.pos2.restaurant.dto.TableRequest;
import com.pos2.restaurant.dto.TableResponse;
import com.pos2.restaurant.service.TableService;
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
@RequestMapping("/api/tables")
public class TableController {

    private final TableService tableService;

    public TableController(TableService tableService) {

        this.tableService = tableService;
    }

    @GetMapping
    public List<TableResponse> getTables() {

        return tableService.getTables();
    }

    @GetMapping("/admin")
    public List<TableResponse> getAdminTables() {
        return tableService.getAllTables();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TableResponse createTable(@RequestBody TableRequest request) {
        return tableService.createTable(request);
    }

    @PatchMapping("/admin/{id}")
    public TableResponse updateTable(@PathVariable Long id, @RequestBody TableRequest request) {
        return tableService.updateTable(id, request);
    }

    @DeleteMapping("/admin/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateTable(@PathVariable Long id) {
        tableService.deactivateTable(id);
    }

    @DeleteMapping("/admin/{id}/permanent")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTable(@PathVariable Long id) {
        tableService.deleteTable(id);
    }

    @PatchMapping("/{number}/release")
    public TableResponse releaseTable(@PathVariable Integer number) {
        return tableService.releaseTable(number);
    }

    @PatchMapping("/{number}/mark-available")
    public TableResponse markTableAvailable(@PathVariable Integer number) {
        return tableService.markTableAvailable(number);
    }

    @PatchMapping("/{number}/force-available")
    public TableResponse forceAvailable(@PathVariable Integer number) {
        return tableService.forceAvailable(number);
    }
}
