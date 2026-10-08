package com.foodflow;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean UserDetailsService users(@Value("${ADMIN_USERNAME:admin}") String username,
                                  @Value("${ADMIN_PASSWORD}") String password) {
        if (password.isBlank()) throw new IllegalArgumentException("ADMIN_PASSWORD must not be blank");
        return new InMemoryUserDetailsManager(User.withUsername(username)
                .password("{bcrypt}"+new BCryptPasswordEncoder().encode(password)).roles("ADMIN").build());
    }
    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(a -> a
                .requestMatchers("/login", "/login/**", "/assets/**", "/css/**", "/js/**", "/order/**", "/media/menu/**", "/actuator/health", "/error").permitAll()
                .anyRequest().hasRole("ADMIN"))
            .formLogin(f -> f.loginPage("/login").defaultSuccessUrl("/admin", true).failureUrl("/login/failed").permitAll())
            .logout(l -> l.logoutSuccessUrl("/login"))
            .build();
    }
}
