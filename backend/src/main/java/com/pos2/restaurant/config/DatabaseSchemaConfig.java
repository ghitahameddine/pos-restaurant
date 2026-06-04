package com.pos2.restaurant.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class DatabaseSchemaConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaConfig.class);

    @Bean
    ApplicationRunner widenKitchenItemStatusColumn(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                jdbcTemplate.execute("ALTER TABLE kitchen_items MODIFY status VARCHAR(20) NOT NULL");
            } catch (Exception error) {
                log.debug("Kitchen item status column already compatible or not ready yet.", error);
            }
        };
    }
}
