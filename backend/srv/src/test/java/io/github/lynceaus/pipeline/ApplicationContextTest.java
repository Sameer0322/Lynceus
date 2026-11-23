package io.github.lynceaus.pipeline;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    "app.github-token=test-token",
    "app.jwt-secret=test-secret-that-is-at-least-32-characters-long",
    "app.admin.password=TestPass1",
    "app.allowed-origin=http://localhost:5173"
})
class ApplicationContextTest {

    @Test
    void contextLoads() {
    }
}
