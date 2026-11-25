package io.github.lynceus.pipeline.controller;

import io.github.lynceus.pipeline.security.JwtUtil;
import io.github.lynceus.pipeline.security.LoginRateLimiter;
import io.github.lynceus.pipeline.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService authService, JwtUtil jwtUtil, LoginRateLimiter rateLimiter) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        String role = auth.getAuthorities().iterator().next()
                          .getAuthority().replace("ROLE_", "").toLowerCase();
        return ResponseEntity.ok(Map.of("username", auth.getName(), "role", role));
    }

    @GetMapping("/users")
    public ResponseEntity<?> listUsers() {
        return ResponseEntity.ok(authService.listUsers());
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || username.isBlank() || password == null || password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username required and password must be at least 8 characters"));
        }
        String role = body.get("role");
        if (role == null || (!role.equals("admin") && !role.equals("viewer"))) role = "viewer";
        try {
            authService.registerWithRole(username, password, role);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<?> deleteUser(@PathVariable String username, Authentication auth) {
        if (auth.getName().equalsIgnoreCase(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete your own account"));
        }
        try {
            authService.deleteUser(username);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/users/{username}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String username,
                                           @RequestBody Map<String, String> body) {
        String newPassword = body.get("password");
        if (newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters"));
        }
        try {
            authService.adminResetPassword(username, newPassword);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PatchMapping("/users/{username}/role")
    public ResponseEntity<?> changeRole(@PathVariable String username,
                                        @RequestBody Map<String, String> body,
                                        Authentication auth) {
        if (auth.getName().equalsIgnoreCase(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot change your own role"));
        }
        String role = body.get("role");
        if (role == null || (!role.equals("admin") && !role.equals("viewer"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role must be 'admin' or 'viewer'"));
        }
        try {
            authService.changeRole(username, role);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String ip = getClientIp(request);
        if (rateLimiter.isBlocked(ip)) {
            return ResponseEntity.status(429).body(Map.of("error", "Too many failed login attempts. Try again in 15 minutes."));
        }
        var user = authService.login(body.get("username"), body.get("password"));
        if (user.isEmpty()) {
            rateLimiter.recordFailure(ip);
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
        rateLimiter.recordSuccess(ip);
        String username = (String) user.get().get("username");
        String role = (String) user.get().get("role");
        String token = jwtUtil.generate(username, role);
        return ResponseEntity.ok(Map.of("token", token, "expiresIn", 3600));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(Authentication auth) {
        String username = auth.getName();
        String role = auth.getAuthorities().iterator().next()
                          .getAuthority().replace("ROLE_", "").toLowerCase();
        return ResponseEntity.ok(Map.of("token", jwtUtil.generate(username, role)));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body, Authentication auth) {
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        if (oldPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "oldPassword and newPassword are required"));
        }
        try {
            authService.changePassword(auth.getName(), oldPassword, newPassword);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
