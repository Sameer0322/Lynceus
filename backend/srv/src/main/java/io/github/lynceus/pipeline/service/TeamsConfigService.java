package io.github.lynceus.pipeline.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TeamsConfigService {

    private final JdbcTemplate jdbc;

    public TeamsConfigService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> getAll() {
        List<Map<String, Object>> teams = jdbc.queryForList(
                "SELECT ID, NAME FROM PIPELINE_DB_TEAMS ORDER BY NAME");
        List<Map<String, Object>> allRepos = jdbc.queryForList(
                "SELECT ID, TEAMID, REPO FROM PIPELINE_DB_TEAMREPOS ORDER BY REPO");

        return teams.stream().map(t -> {
            String id = (String) t.get("ID");
            List<String> repos = allRepos.stream()
                    .filter(r -> id.equals(r.get("TEAMID")))
                    .map(r -> (String) r.get("REPO"))
                    .collect(Collectors.toList());
            return buildMap(id, (String) t.get("NAME"), repos);
        }).collect(Collectors.toList());
    }

    public Map<String, Object> create(String name, List<String> repos) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Team name is required");
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_TEAMS WHERE NAME = ?", Integer.class, name.trim());
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Team name already exists");
        }
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO PIPELINE_DB_TEAMS (ID, NAME) VALUES (?, ?)", id, name.trim());
        insertRepos(id, repos);
        return buildMap(id, name.trim(), repos);
    }

    public Map<String, Object> update(String id, String name, List<String> repos) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT ID, NAME FROM PIPELINE_DB_TEAMS WHERE ID = ?", id);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Team not found: " + id);
        }
        String currentName = (String) existing.get(0).get("NAME");
        if (name != null && !name.isBlank() && !name.trim().equals(currentName)) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM PIPELINE_DB_TEAMS WHERE NAME = ?", Integer.class, name.trim());
            if (count != null && count > 0) {
                throw new IllegalArgumentException("Team name already exists");
            }
            jdbc.update("UPDATE PIPELINE_DB_TEAMS SET NAME = ? WHERE ID = ?", name.trim(), id);
        }
        if (repos != null) {
            jdbc.update("DELETE FROM PIPELINE_DB_TEAMREPOS WHERE TEAMID = ?", id);
            insertRepos(id, repos);
        }
        String finalName = (name != null && !name.isBlank()) ? name.trim() : currentName;
        List<String> finalRepos = repos != null ? repos : getCurrentRepos(id);
        return buildMap(id, finalName, finalRepos);
    }

    public void delete(String id) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT ID FROM PIPELINE_DB_TEAMS WHERE ID = ?", id);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Team not found: " + id);
        }
        jdbc.update("DELETE FROM PIPELINE_DB_TEAMREPOS WHERE TEAMID = ?", id);
        jdbc.update("DELETE FROM PIPELINE_DB_TEAMS WHERE ID = ?", id);
    }

    public Map<String, Object> addRepo(String teamId, String repo) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT ID, NAME FROM PIPELINE_DB_TEAMS WHERE ID = ?", teamId);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Team not found: " + teamId);
        }
        if (repo == null || repo.isBlank()) {
            throw new IllegalArgumentException("Repo is required");
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_TEAMREPOS WHERE TEAMID = ? AND REPO = ?",
                Integer.class, teamId, repo.trim());
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Repo already exists in this team");
        }
        jdbc.update("INSERT INTO PIPELINE_DB_TEAMREPOS (ID, TEAMID, REPO) VALUES (?, ?, ?)",
                UUID.randomUUID().toString(), teamId, repo.trim());
        return buildMap(teamId, (String) existing.get(0).get("NAME"), getCurrentRepos(teamId));
    }

    public Map<String, Object> removeRepo(String teamId, String repo) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT ID, NAME FROM PIPELINE_DB_TEAMS WHERE ID = ?", teamId);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Team not found: " + teamId);
        }
        if (repo == null || repo.isBlank()) {
            throw new IllegalArgumentException("Repo is required");
        }
        jdbc.update("DELETE FROM PIPELINE_DB_TEAMREPOS WHERE TEAMID = ? AND REPO = ?", teamId, repo.trim());
        return buildMap(teamId, (String) existing.get(0).get("NAME"), getCurrentRepos(teamId));
    }

    public boolean isEmpty() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM PIPELINE_DB_TEAMS", Integer.class);
        return count == null || count == 0;
    }

    private void insertRepos(String teamId, List<String> repos) {
        if (repos == null) return;
        for (String repo : repos) {
            if (repo == null || repo.isBlank()) continue;
            jdbc.update("INSERT INTO PIPELINE_DB_TEAMREPOS (ID, TEAMID, REPO) VALUES (?, ?, ?)",
                    UUID.randomUUID().toString(), teamId, repo.trim());
        }
    }

    private List<String> getCurrentRepos(String teamId) {
        return jdbc.queryForList(
                "SELECT REPO FROM PIPELINE_DB_TEAMREPOS WHERE TEAMID = ? ORDER BY REPO", teamId)
                .stream().map(r -> (String) r.get("REPO")).collect(Collectors.toList());
    }

    private Map<String, Object> buildMap(String id, String name, List<String> repos) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        m.put("repos", repos != null ? repos : List.of());
        return m;
    }
}
