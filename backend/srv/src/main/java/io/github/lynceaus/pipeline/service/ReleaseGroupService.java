package io.github.lynceus.pipeline.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReleaseGroupService {

    private final JdbcTemplate jdbc;

    public ReleaseGroupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> getAll() {
        List<Map<String, Object>> groups = jdbc.queryForList(
                "SELECT ID, NAME, CREATEDBY, CREATEDAT FROM PIPELINE_DB_RELEASEGROUPS ORDER BY CREATEDAT DESC");
        List<Map<String, Object>> allPipelines = jdbc.queryForList(
                "SELECT GROUPID FROM PIPELINE_DB_RELEASEPIPELINES");

        return groups.stream().map(g -> {
            String id = (String) g.get("ID");
            long count = allPipelines.stream().filter(p -> id.equals(p.get("GROUPID"))).count();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("name", g.get("NAME"));
            m.put("createdBy", g.get("CREATEDBY"));
            m.put("createdAt", g.get("CREATEDAT"));
            m.put("pipelineCount", count);
            return m;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> create(String name, String createdBy) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Release group name is required");
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEGROUPS WHERE NAME = ?", Integer.class, name.trim());
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Release group name already exists");
        }
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO PIPELINE_DB_RELEASEGROUPS (ID, NAME, CREATEDBY, CREATEDAT) VALUES (?, ?, ?, ?)",
                id, name.trim(), createdBy, now);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name.trim());
        m.put("createdBy", createdBy);
        m.put("createdAt", now);
        m.put("pipelineCount", 0);
        return m;
    }

    public void delete(String id, String callerUsername, String callerRole) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT ID, CREATEDBY FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", id);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Release group not found: " + id);
        }
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        boolean isCreator = callerUsername.equals(existing.get(0).get("CREATEDBY"));
        if (!isAdmin && !isCreator) {
            throw new SecurityException("Only the creator or an admin can delete this release group");
        }
        jdbc.update("DELETE FROM PIPELINE_DB_RELEASEPIPELINES WHERE GROUPID = ?", id);
        jdbc.update("DELETE FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", id);
    }

    public List<Map<String, Object>> getPipelines(String groupId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", Integer.class, groupId);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Release group not found: " + groupId);
        }
        return jdbc.queryForList(
                "SELECT * FROM PIPELINE_DB_RELEASEPIPELINES WHERE GROUPID = ? ORDER BY DISPLAYORDER ASC",
                groupId).stream().map(this::rowToMap).collect(Collectors.toList());
    }

    public Map<String, Object> addPipeline(String groupId, Map<String, Object> body, String addedBy) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", Integer.class, groupId);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Release group not found: " + groupId);
        }
        String runId = (String) body.get("runId");
        if (runId == null || runId.isBlank()) {
            throw new IllegalArgumentException("runId is required");
        }
        Integer dupCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEPIPELINES WHERE GROUPID = ? AND RUNID = ?",
                Integer.class, groupId, runId.trim());
        if (dupCount != null && dupCount > 0) {
            throw new IllegalArgumentException("Pipeline run already added to this group");
        }
        Integer maxOrder = jdbc.queryForObject(
                "SELECT MAX(DISPLAYORDER) FROM PIPELINE_DB_RELEASEPIPELINES WHERE GROUPID = ?",
                Integer.class, groupId);
        int nextOrder = (maxOrder != null ? maxOrder : 0) + 1;

        String id = UUID.randomUUID().toString();
        String repo = (String) body.getOrDefault("repo", "");
        String branch = (String) body.getOrDefault("branch", "");
        Object runNumberObj = body.get("runNumber");
        Integer runNumber = runNumberObj instanceof Number ? ((Number) runNumberObj).intValue() : null;
        String message = (String) body.getOrDefault("message", "");
        String note = (String) body.getOrDefault("note", "");
        Instant addedAt = Instant.now();

        jdbc.update(
                "INSERT INTO PIPELINE_DB_RELEASEPIPELINES "
                + "(ID, GROUPID, RUNID, REPO, BRANCH, RUNNUMBER, MESSAGE, NOTE, ADDEDBY, ADDEDAT, DISPLAYORDER) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, groupId, runId.trim(), repo, branch, runNumber, message, note, addedBy, addedAt, nextOrder);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("groupId", groupId);
        m.put("runId", runId.trim());
        m.put("repo", repo);
        m.put("branch", branch);
        m.put("runNumber", runNumber);
        m.put("message", message);
        m.put("note", note);
        m.put("addedBy", addedBy);
        m.put("addedAt", addedAt);
        m.put("displayOrder", nextOrder);
        return m;
    }

    public void removePipeline(String groupId, String pipelineId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", Integer.class, groupId);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Release group not found: " + groupId);
        }
        jdbc.update("DELETE FROM PIPELINE_DB_RELEASEPIPELINES WHERE ID = ? AND GROUPID = ?",
                pipelineId, groupId);
    }

    public void reorderPipelines(String groupId, List<String> orderedIds) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM PIPELINE_DB_RELEASEGROUPS WHERE ID = ?", Integer.class, groupId);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Release group not found: " + groupId);
        }
        for (int i = 0; i < orderedIds.size(); i++) {
            jdbc.update(
                    "UPDATE PIPELINE_DB_RELEASEPIPELINES SET DISPLAYORDER = ? WHERE ID = ? AND GROUPID = ?",
                    i + 1, orderedIds.get(i), groupId);
        }
    }

    private Map<String, Object> rowToMap(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", row.get("ID"));
        m.put("groupId", row.get("GROUPID"));
        m.put("runId", row.get("RUNID"));
        m.put("repo", row.get("REPO"));
        m.put("branch", row.get("BRANCH"));
        m.put("runNumber", row.get("RUNNUMBER"));
        m.put("message", row.get("MESSAGE"));
        m.put("note", row.get("NOTE"));
        m.put("addedBy", row.get("ADDEDBY"));
        m.put("addedAt", row.get("ADDEDAT"));
        m.put("displayOrder", row.get("DISPLAYORDER"));
        return m;
    }
}
