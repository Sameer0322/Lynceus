package io.github.lynceaus.pipeline.config;

import io.github.lynceaus.pipeline.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/github/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/teams").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/releases").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/releases/*/pipelines").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/releases/*/pipelines").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/releases").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/releases/*/pipelines/*").authenticated()
                .requestMatchers(HttpMethod.PATCH, "/api/releases/*/pipelines/order").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/releases/**").hasRole("ADMIN")
                .requestMatchers("/api/auth/register").hasRole("ADMIN")
                .requestMatchers("/api/auth/users").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/auth/users/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/auth/users/*/reset-password").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/auth/users/*/role").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/teams", "/api/teams/*/repos").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/teams/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/teams/**").hasRole("ADMIN")
                .requestMatchers("/api/**").authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
