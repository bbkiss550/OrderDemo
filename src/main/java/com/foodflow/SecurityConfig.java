package com.foodflow;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwords(){return PasswordEncoderFactories.createDelegatingPasswordEncoder();}
    @Bean UserDetailsService users(JdbcTemplate db) {
        return username->{
            var rows=db.queryForList("SELECT * FROM staff_users WHERE lower(username)=lower(?)",username);
            if(rows.isEmpty())throw new UsernameNotFoundException("ไม่พบบัญชี");var user=rows.getFirst();
            return new StaffPrincipal(((Number)user.get("id")).longValue(),(String)user.get("username"),(String)user.get("password_hash"),(String)user.get("role"),(Boolean)user.get("active"),((Number)user.get("auth_version")).longValue());
        };
    }
    @Bean SecurityFilterChain security(HttpSecurity http, Environment environment,JdbcTemplate db) throws Exception {
        if (environment.acceptsProfiles(Profiles.of("mobile-preview"))) {
            http.headers(headers -> headers
                    .frameOptions(frame -> frame.disable())
                    .contentSecurityPolicy(csp -> csp.policyDirectives(
                            "frame-ancestors 'self' http://127.0.0.1:3000")));
        }
        return http.authorizeHttpRequests(a -> a
                .requestMatchers("/login", "/login/**", "/assets/**", "/css/**", "/js/**", "/order/**", "/media/menu/**", "/actuator/health", "/error").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/admin/state").hasAnyRole("ADMIN","CASHIER","KITCHEN")
                .requestMatchers(HttpMethod.GET,"/admin/kds").hasAnyRole("ADMIN","KITCHEN")
                .requestMatchers(HttpMethod.GET,"/admin/orders/*/print").hasAnyRole("ADMIN","CASHIER","KITCHEN")
                .requestMatchers(HttpMethod.GET,"/admin/orders","/api/admin/orders","/api/admin/orders/*").hasAnyRole("ADMIN","CASHIER","KITCHEN")
                .requestMatchers(HttpMethod.POST,"/api/admin/orders/*/status").hasAnyRole("ADMIN","CASHIER","KITCHEN")
                .requestMatchers(HttpMethod.GET,"/admin/kitchen").hasAnyRole("ADMIN","KITCHEN")
                .requestMatchers(HttpMethod.POST,"/api/admin/menu/*/status").hasAnyRole("ADMIN","KITCHEN")
                .requestMatchers(HttpMethod.GET,"/admin/reception","/admin/tables","/admin/bills","/admin/bills/**","/api/admin/bills","/api/admin/bills/**","/api/admin/floors/*/layout").hasAnyRole("ADMIN","CASHIER")
                .requestMatchers(HttpMethod.POST,"/api/admin/bills","/api/admin/bills/*/checkout","/api/admin/bills/*/move","/api/admin/tables/*/availability").hasAnyRole("ADMIN","CASHIER")
                .requestMatchers("/").authenticated()
                .anyRequest().hasRole("ADMIN"))
            .addFilterBefore(new StaffSessionFilter(db),AuthorizationFilter.class)
            .formLogin(f -> f.loginPage("/login").successHandler((request,response,auth)->response.sendRedirect(auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_KITCHEN"))?"/admin/kds":"/admin/reception")).failureUrl("/login/failed").permitAll())
            .logout(l -> l.logoutSuccessUrl("/login"))
            .build();
    }
}
