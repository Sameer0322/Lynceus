package io.github.lynceus.pipeline.controller;

import io.github.lynceus.pipeline.service.GithubCacheService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping(value = "/api/github", produces = MediaType.APPLICATION_JSON_VALUE)
public class GitHubProxyController {

    private final RestTemplate restTemplate;
    private final String githubToken;
    private final String githubTokenSecondary;
    private final String githubApiUrl;
    private final String workflowName;
    private final GithubCacheService cache;

    public GitHubProxyController(@Value("${app.github-token:}") String githubToken,
                                 @Value("${app.github-token-secondary:}") String githubTokenSecondary,
                                 @Value("${app.github-api-url:https://api.github.com}") String githubApiUrl,
                                 @Value("${app.workflow-name:}") String workflowName,
                                 GithubCacheService cache) {
        this.githubToken = githubToken;
        this.githubTokenSecondary = githubTokenSecondary;
        this.githubApiUrl = githubApiUrl.endsWith("/") ? githubApiUrl.substring(0, githubApiUrl.length() - 1) : githubApiUrl;
        this.workflowName = workflowName;
        this.cache = cache;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
    }

    private ResponseEntity<String> proxy(String path, Map<String, String> params) {
        if (githubToken == null || githubToken.isBlank()) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"GITHUB_TOKEN not configured on this server\"}");
        }
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(githubApiUrl + path);
        if (params != null && !params.isEmpty()) {
            params.forEach(builder::queryParam);
        }
        String cacheKey = builder.build(true).toUriString();

        GithubCacheService.CachedResponse cached = cache.get(cacheKey);
        if (cached != null) {
            return ResponseEntity.status(cached.status()).body(cached.body());
        }

        try {
            ResponseEntity<String> response = callGitHub(githubToken, builder.build(true).toUri());
            if (response.getStatusCode().is2xxSuccessful()) {
                cache.put(cacheKey, response.getBody(), response.getStatusCode().value());
            }
            return response;
        } catch (HttpStatusCodeException e) {
            if (isRateLimitError(e) && githubTokenSecondary != null && !githubTokenSecondary.isBlank()) {
                try {
                    ResponseEntity<String> fallback = callGitHub(githubTokenSecondary, builder.build(true).toUri());
                    if (fallback.getStatusCode().is2xxSuccessful()) {
                        cache.put(cacheKey, fallback.getBody(), fallback.getStatusCode().value());
                    }
                    return fallback;
                } catch (HttpStatusCodeException e2) {
                    return ResponseEntity.status(e2.getStatusCode())
                            .body(e2.getResponseBodyAsString());
                }
            }
            return ResponseEntity.status(e.getStatusCode())
                    .body(e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(504)
                    .body("{\"error\":\"GitHub API timed out\"}");
        }
    }

    private ResponseEntity<String> callGitHub(String token, java.net.URI uri) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");
        return restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private boolean isRateLimitError(HttpStatusCodeException e) {
        int status = e.getStatusCode().value();
        return (status == 403 || status == 429)
                && e.getResponseBodyAsString().toLowerCase().contains("rate limit");
    }

    @GetMapping("/{org}/{repo}/workflows")
    public ResponseEntity<String> workflows(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo + "/actions/workflows", params);
    }

    @GetMapping("/{org}/{repo}/workflows/{wfId}/runs")
    public ResponseEntity<String> runs(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @PathVariable("wfId") String wfId,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo + "/actions/workflows/" + wfId + "/runs", params);
    }

    @GetMapping("/{org}/{repo}/runs/{runId}")
    public ResponseEntity<String> run(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @PathVariable("runId") String runId,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo + "/actions/runs/" + runId, params);
    }

    @GetMapping("/{org}/{repo}/runs/{runId}/jobs")
    public ResponseEntity<String> jobs(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @PathVariable("runId") String runId,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo + "/actions/runs/" + runId + "/jobs", params);
    }

    @GetMapping("/{org}/{repo}/branches")
    public ResponseEntity<String> branches(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo + "/branches", params);
    }

    @GetMapping("/{org}/{repo}/info")
    public ResponseEntity<String> repoInfo(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo,
            @RequestParam(required = false) Map<String, String> params) {
        return proxy("/repos/" + org + "/" + repo, params);
    }

    @GetMapping("/rate-limit-all")
    public ResponseEntity<String> rateLimitAll() {
        if (githubToken == null || githubToken.isBlank()) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"GITHUB_TOKEN not configured on this server\"}");
        }
        String primaryBody;
        try {
            primaryBody = callGitHub(githubToken, java.net.URI.create(githubApiUrl + "/rate_limit")).getBody();
        } catch (HttpStatusCodeException e) {
            primaryBody = "{\"rate\":null}";
        }
        String secondaryBody = null;
        if (githubTokenSecondary != null && !githubTokenSecondary.isBlank()) {
            try {
                secondaryBody = callGitHub(githubTokenSecondary, java.net.URI.create(githubApiUrl + "/rate_limit")).getBody();
            } catch (HttpStatusCodeException e) {
                secondaryBody = "{\"rate\":null}";
            }
        }
        String combined = "{\"primary\":" + primaryBody
                + ",\"secondary\":" + (secondaryBody != null ? secondaryBody : "null") + "}";
        return ResponseEntity.ok(combined);
    }

    @GetMapping("/{org}/{repo}/pipeline-summary")
    public ResponseEntity<String> pipelineSummary(
            @PathVariable("org") String org,
            @PathVariable("repo") String repo) {
        if (githubToken == null || githubToken.isBlank()) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"GITHUB_TOKEN not configured on this server\"}");
        }
        try {
            return buildPipelineSummary(githubToken, org, repo);
        } catch (HttpStatusCodeException e) {
            if (isRateLimitError(e) && githubTokenSecondary != null && !githubTokenSecondary.isBlank()) {
                try {
                    return buildPipelineSummary(githubTokenSecondary, org, repo);
                } catch (HttpStatusCodeException e2) {
                    return ResponseEntity.status(e2.getStatusCode())
                            .body(e2.getResponseBodyAsString());
                }
            }
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(504).body("{\"error\":\"GitHub API timed out\"}");
        }
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<String> buildPipelineSummary(String token, String org, String repo) {
        String base = githubApiUrl + "/repos/" + org + "/" + repo;

        Map<String, Object> repoInfo = callGitHubMap(token, java.net.URI.create(base));
        String defaultBranch = (String) repoInfo.getOrDefault("default_branch", "master");

        Map<String, Object> workflowsData = callGitHubMap(token, java.net.URI.create(base + "/actions/workflows"));
        List<Map<String, Object>> allWfs = (List<Map<String, Object>>) workflowsData.getOrDefault("workflows", List.of());
        List<Map<String, Object>> filteredWfs = workflowName == null || workflowName.isBlank()
                ? allWfs
                : allWfs.stream().filter(wf -> workflowName.equals(wf.get("name"))).collect(Collectors.toList());

        StringBuilder wfsJson = new StringBuilder("[");
        for (int i = 0; i < filteredWfs.size(); i++) {
            Map<String, Object> wf = filteredWfs.get(i);
            long wfId = ((Number) wf.get("id")).longValue();
            String wfDisplayName = (String) wf.get("name");
            String runsBody = callGitHub(token,
                    java.net.URI.create(base + "/actions/workflows/" + wfId + "/runs?per_page=100"))
                    .getBody();
            if (i > 0) wfsJson.append(",");
            wfsJson.append("{\"id\":").append(wfId)
                    .append(",\"name\":\"").append(wfDisplayName.replace("\"", "\\\"")).append("\",\"runsRaw\":").append(runsBody).append("}");
        }
        wfsJson.append("]");

        String branchesBody = callGitHub(token,
                java.net.URI.create(base + "/branches?per_page=100")).getBody();

        return ResponseEntity.ok("{\"defaultBranch\":\"" + defaultBranch.replace("\"", "\\\"") + "\","
                + "\"branches\":" + branchesBody + ","
                + "\"workflows\":" + wfsJson + "}");
    }

    private Map<String, Object> callGitHubMap(String token, java.net.URI uri) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");
        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                uri, HttpMethod.GET, new HttpEntity<>(headers),
                new ParameterizedTypeReference<Map<String, Object>>() {});
        return resp.getBody() != null ? resp.getBody() : Map.of();
    }
}

