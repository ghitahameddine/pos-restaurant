package com.pos2.restaurant.config;

import com.pos2.restaurant.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {
                })
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/api/realtime").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/menu").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/qr-sessions/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/qr-sessions").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/orders").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/orders/*/client-update").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/orders/*/client-cancel").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/bill-requests").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/**").hasRole("WAITER")
                        .requestMatchers(HttpMethod.GET, "/api/bill-requests/**").hasRole("WAITER")
                        .requestMatchers(HttpMethod.PATCH, "/api/orders/**").hasRole("WAITER")
                        .requestMatchers(HttpMethod.POST, "/api/bill-requests/*/print").hasRole("WAITER")
                        .requestMatchers("/api/slots/**").hasRole("WAITER")
                        .requestMatchers("/api/tables/**").hasRole("WAITER")
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
