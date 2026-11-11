package io.github.lynceaus.pipeline.controller;

import io.github.lynceaus.pipeline.service.ReleaseGroupService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/releases")
public class ReleaseGroupController {

    private final ReleaseGroupService releaseGroupService;

    public ReleaseGroupController(ReleaseGroupService releaseGroupService) {
        this.releaseGroupService = releaseGroupService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(releaseGroupService.getAll());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body, Authentication auth) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "name is required"));
        }
        String createdBy = body.getOrDefault("createdBy", "");
        if (createdBy == null || createdBy.isBlank()) createdBy = auth.getName();
        return ResponseEntity.ok(releaseGroupService.create(name, createdBy));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") String id, Authentication auth) {
        String role = auth.getAuthorities().iterator().next()
                          .getAuthority().replace("ROLE_", "").toLowerCase();
        releaseGroupService.delete(id, auth.getName(), role);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/{id}/pipelines")
    public ResponseEntity<?> getPipelines(@PathVariable("id") String id) {
        return ResponseEntity.ok(releaseGroupService.getPipelines(id));
    }

    @PostMapping("/{id}/pipelines")
    public ResponseEntity<?> addPipeline(@PathVariable("id") String id,
                                         @RequestBody Map<String, Object> body,
                                         Authentication auth) {
        String addedBy = auth.getName();
        return ResponseEntity.ok(releaseGroupService.addPipeline(id, body, addedBy));
    }

    @DeleteMapping("/{id}/pipelines/{pipelineId}")
    public ResponseEntity<?> removePipeline(@PathVariable("id") String id,
                                            @PathVariable("pipelineId") String pipelineId) {
        releaseGroupService.removePipeline(id, pipelineId);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PatchMapping("/{id}/pipelines/order")
    public ResponseEntity<?> reorderPipelines(@PathVariable("id") String id,
                                              @RequestBody Map<String, Object> body,
                                              Authentication auth) {
        String role = auth.getAuthorities().iterator().next()
                          .getAuthority().replace("ROLE_", "").toLowerCase();
        if (!"admin".equalsIgnoreCase(role)) {
            return ResponseEntity.status(403).body(Map.of("error", "Admin role required"));
        }
        @SuppressWarnings("unchecked")
        List<String> orderedIds = (List<String>) body.get("order");
        if (orderedIds == null || orderedIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "order is required"));
        }
        releaseGroupService.reorderPipelines(id, orderedIds);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
