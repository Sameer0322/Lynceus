package io.github.lynceus.pipeline.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "app.github-token=test-token",
    "app.jwt-secret=test-secret-that-is-at-least-32-characters-long",
    "app.admin.password=TestPass1",
    "app.allowed-origin=http://localhost:5173"
})
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String randomUsername() {
        return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private String getAdminToken() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"TestPass1\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Map<?, ?> response = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        return (String) response.get("token");
    }

    @Test
    void login_validCredentials_returnsToken() throws Exception {
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"TestPass1\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.token").isNotEmpty())
           .andExpect(jsonPath("$.expiresIn").value(3600));
    }

    @Test
    void login_invalidCredentials_returns401() throws Exception {
        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"wrongpassword\"}"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void listUsers_withoutAuth_returns401or403() throws Exception {
        mvc.perform(get("/api/auth/users"))
           .andExpect(status().is(anyOf(equalTo(401), equalTo(403))));
    }

    @Test
    void listUsers_withAdminAuth_returnsList() throws Exception {
        String token = getAdminToken();
        mvc.perform(get("/api/auth/users")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$").isArray())
           .andExpect(jsonPath("$[0].username").exists());
    }

    @Test
    @Transactional
    void register_withAdminAuth_succeeds() throws Exception {
        String token = getAdminToken();
        String username = randomUsername();
        mvc.perform(post("/api/auth/register")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"password123\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.ok").value(true));
    }

    @Test
    void register_withoutAuth_returns401or403() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"hacker\",\"password\":\"password123\"}"))
           .andExpect(status().is(anyOf(equalTo(401), equalTo(403))));
    }

    @Test
    @Transactional
    void changeRole_withAdminAuth_succeeds() throws Exception {
        String token = getAdminToken();
        String username = randomUsername();
        mvc.perform(post("/api/auth/register")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"password123\"}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/auth/users/" + username + "/role")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"admin\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.ok").value(true));
    }

    @Test
    void changeRole_selfChange_returns400() throws Exception {
        String token = getAdminToken();
        mvc.perform(patch("/api/auth/users/admin/role")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"viewer\"}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void deleteUser_withAdminAuth_succeeds() throws Exception {
        String token = getAdminToken();
        String username = randomUsername();
        mvc.perform(post("/api/auth/register")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"password123\"}"))
           .andExpect(status().isOk());
        mvc.perform(delete("/api/auth/users/" + username)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());
    }
}
