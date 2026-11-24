package io.github.lynceus.pipeline.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private static final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    private final JdbcTemplate jdbc;

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void register(String username, String password) {
        registerWithRole(username, password, "viewer");
    }

    public List<Map<String, Object>> listUsers() {
        return jdbc.queryForList(
                "SELECT USERNAME, ROLE, CREATEDAT, LASTLOGIN FROM PIPELINE_DB_APPUSERS ORDER BY USERNAME"
        ).stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("username", row.get("USERNAME"));
            m.put("role", row.get("ROLE"));
            m.put("createdAt", row.get("CREATEDAT"));
            m.put("lastLogin", row.get("LASTLOGIN"));
            return m;
        }).toList();
    }

    public void registerWithRole(String username, String password, String role) {
        validatePassword(password);
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?",
                Integer.class, username);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Username already taken");
        }
        jdbc.update(
                "INSERT INTO PIPELINE_DB_APPUSERS (USERNAME, PASSWORDHASH, ROLE, CREATEDAT) VALUES (?, ?, ?, ?)",
                username, encoder.encode(password), role, Instant.now());
        audit("REGISTER", username, username);
    }

    public void changePassword(String username, String oldPassword, String newPassword) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT PASSWORDHASH FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?", username);
        if (rows.isEmpty() || !encoder.matches(oldPassword, (String) rows.get(0).get("PASSWORDHASH"))) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        validatePassword(newPassword);
        jdbc.update("UPDATE PIPELINE_DB_APPUSERS SET PASSWORDHASH = ? WHERE USERNAME = ?",
                encoder.encode(newPassword), username);
        audit("PASSWORD_CHANGE", username, username);
    }

    public void adminResetPassword(String username, String newPassword) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?",
                Integer.class, username);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("User not found: " + username);
        }
        validatePassword(newPassword);
        jdbc.update("UPDATE PIPELINE_DB_APPUSERS SET PASSWORDHASH = ? WHERE USERNAME = ?",
                encoder.encode(newPassword), username);
        audit("ADMIN_PASSWORD_RESET", "admin", username);
    }

    private static void validatePassword(String password) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
    }

    public void deleteUser(String username) {
        jdbc.update("DELETE FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?", username);
        audit("DELETE_USER", "admin", username);
    }

    public Optional<Map<String, Object>> login(String username, String password) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT USERNAME, ROLE, PASSWORDHASH FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?", username);
        if (rows.isEmpty() || !encoder.matches(password, (String) rows.get(0).get("PASSWORDHASH"))) {
            return Optional.empty();
        }
        jdbc.update("UPDATE PIPELINE_DB_APPUSERS SET LASTLOGIN = ? WHERE USERNAME = ?",
                Instant.now(), username);
        audit("LOGIN", username, username);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", rows.get(0).get("USERNAME"));
        result.put("role", rows.get(0).get("ROLE"));
        return Optional.of(result);
    }

    public void changeRole(String username, String newRole) {
        if (!"admin".equals(newRole) && !"viewer".equals(newRole)) {
            throw new IllegalArgumentException("Role must be 'admin' or 'viewer'");
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_APPUSERS WHERE USERNAME = ?",
                Integer.class, username);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("User not found: " + username);
        }
        jdbc.update("UPDATE PIPELINE_DB_APPUSERS SET ROLE = ? WHERE USERNAME = ?", newRole, username);
        audit("ROLE_CHANGE", "admin", username);
    }

    private void audit(String action, String username, String target) {
        jdbc.update(
                "INSERT INTO PIPELINE_DB_AUDITLOG (ID, ACTION, USERNAME, TARGET, TIMESTAMP) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(), action, username, target, Instant.now());
    }
}
