package io.github.lynceaus.pipeline.controller;

import io.github.lynceaus.pipeline.service.TeamsConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
public class TeamsController {

    private final TeamsConfigService teamsService;

    public TeamsController(TeamsConfigService teamsService) {
        this.teamsService = teamsService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(teamsService.getAll());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        List<String> repos = (List<String>) body.getOrDefault("repos", List.of());
        return ResponseEntity.ok(teamsService.create(name, repos));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        List<String> repos = (List<String>) body.get("repos");
        return ResponseEntity.ok(teamsService.update(id, name, repos));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") String id) {
        teamsService.delete(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/{id}/repos")
    public ResponseEntity<?> addRepo(@PathVariable("id") String id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(teamsService.addRepo(id, body.get("repo")));
    }

    @DeleteMapping("/{id}/repos")
    public ResponseEntity<?> removeRepo(@PathVariable("id") String id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(teamsService.removeRepo(id, body.get("repo")));
    }
}
