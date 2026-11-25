package io.github.lynceus.pipeline.config;

import io.github.lynceus.pipeline.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AuthService authService;
    private final JdbcTemplate jdbc;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password}")
    private String adminPassword;

    public AdminBootstrap(AuthService authService, JdbcTemplate jdbc) {
        this.authService = authService;
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_APPUSERS", Integer.class);
        boolean hasUsers = count != null && count > 0;
        if (!hasUsers) {
            authService.registerWithRole(adminUsername, adminPassword, "admin");
            log.warn("=================================================================");
            log.warn("  Admin account created: username='{}'", adminUsername);
            log.warn("  Change the password immediately via Admin Panel -> Account -> Change Password");
            log.warn("=================================================================");
        }
    }
}
