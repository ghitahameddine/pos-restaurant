package com.pos2.restaurant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class Pos2RestaurantApplication {

    public static void main(String[] args) {
        SpringApplication.run(Pos2RestaurantApplication.class, args);
    }
}
