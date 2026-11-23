package io.github.lynceaus.pipeline.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestPropertySource(properties = {
    "app.github-token=test-token",
    "app.jwt-secret=test-secret-that-is-at-least-32-characters-long",
    "app.admin.password=TestPass1",
    "app.allowed-origin=http://localhost:5173"
})
class AuthServiceTest {

    @Autowired
    private AuthService authService;

    private String randomUsername() {
        return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    @Test
    void adminUserIsBootstrapped() {
        Optional<Map<String, Object>> result = authService.login("admin", "TestPass1");
        assertTrue(result.isPresent());
        assertEquals("admin", result.get().get("username"));
        assertEquals("admin", result.get().get("role"));
    }

    @Test
    @Transactional
    void registerAndLoginSucceeds() {
        String username = randomUsername();
        authService.register(username, "password123");
        Optional<Map<String, Object>> result = authService.login(username, "password123");
        assertTrue(result.isPresent());
        assertEquals(username, result.get().get("username"));
        assertEquals("viewer", result.get().get("role"));
    }

    @Test
    @Transactional
    void registerDuplicateUsernameThrows() {
        String username = randomUsername();
        authService.register(username, "password123");
        assertThrows(IllegalArgumentException.class, () -> authService.register(username, "other123"));
    }

    @Test
    void loginWithWrongPasswordReturnsEmpty() {
        Optional<Map<String, Object>> result = authService.login("admin", "wrongpassword");
        assertTrue(result.isEmpty());
    }

    @Test
    @Transactional
    void changePasswordSucceeds() {
        String username = randomUsername();
        authService.register(username, "oldpassword");
        authService.changePassword(username, "oldpassword", "newpassword");
        assertTrue(authService.login(username, "newpassword").isPresent());
        assertTrue(authService.login(username, "oldpassword").isEmpty());
    }

    @Test
    @Transactional
    void changePasswordFailsWithWrongOldPassword() {
        String username = randomUsername();
        authService.register(username, "realpassword");
        assertThrows(IllegalArgumentException.class,
                () -> authService.changePassword(username, "wrongpassword", "newpassword"));
    }

    @Test
    @Transactional
    void changeRoleSucceeds() {
        String username = randomUsername();
        authService.register(username, "password123");
        authService.changeRole(username, "admin");
        Optional<Map<String, Object>> result = authService.login(username, "password123");
        assertTrue(result.isPresent());
        assertEquals("admin", result.get().get("role"));
    }

    @Test
    @Transactional
    void changeRoleInvalidValueThrows() {
        String username = randomUsername();
        authService.register(username, "password123");
        assertThrows(IllegalArgumentException.class, () -> authService.changeRole(username, "superuser"));
    }

    @Test
    @Transactional
    void deleteUserSucceeds() {
        String username = randomUsername();
        authService.register(username, "password123");
        authService.deleteUser(username);
        assertTrue(authService.login(username, "password123").isEmpty());
    }

    @Test
    @Transactional
    void adminResetPasswordSucceeds() {
        String username = randomUsername();
        authService.register(username, "oldpassword");
        authService.adminResetPassword(username, "newpassword");
        assertTrue(authService.login(username, "newpassword").isPresent());
    }
}
