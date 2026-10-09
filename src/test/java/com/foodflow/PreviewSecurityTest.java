package com.foodflow;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Map;
import org.springframework.core.env.MapPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PreviewSecurityTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    static class WebSecurity {}

    @RestController
    static class LoginPage {
        @GetMapping("/login") String login() { return "Login"; }
    }

    private AnnotationConfigWebApplicationContext context(boolean preview) {
        var context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                "test", Map.of("ADMIN_PASSWORD", "test-only-password")));
        if (preview) context.getEnvironment().setActiveProfiles("mobile-preview");
        context.register(WebSecurity.class, SecurityConfig.class);
        context.refresh();
        return context;
    }

    private MockMvc mvc(AnnotationConfigWebApplicationContext context) {
        return MockMvcBuilders.standaloneSetup(new LoginPage())
                .addFilters(context.getBean("springSecurityFilterChain", Filter.class)).build();
    }

    @Test void defaultModeBlocksFrames() throws Exception {
        try (var context = context(false)) {
            mvc(context).perform(get("/login"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Frame-Options", "DENY"))
                    .andExpect(header().doesNotExist("Content-Security-Policy"));
        }
    }

    @Test void previewAllowsOnlyStudioAndKeepsAdminAuthentication() throws Exception {
        try (var context = context(true)) {
            var mvc = mvc(context);
            mvc.perform(get("/login"))
                    .andExpect(status().isOk())
                    .andExpect(header().doesNotExist("X-Frame-Options"))
                    .andExpect(header().string("Content-Security-Policy",
                            "frame-ancestors 'self' http://127.0.0.1:3000"));
            mvc.perform(get("/admin/bills"))
                    .andExpect(status().is3xxRedirection())
                    .andExpect(redirectedUrl("http://localhost/login"));
        }
    }
}
