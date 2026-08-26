package com.promcbot.plugin.backend;

import com.promcbot.plugin.telemetry.TelemetryEvent;
import com.promcbot.plugin.telemetry.TelemetryQueue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.TimeUnit;

public final class BackendClient {
    private final HttpClient http;
    private final TelemetryQueue queue;
    private final String baseUrl;
    private final String serverId;
    private final String instanceId;
    private final String networkId;
    private final String minecraftServerId;
    private final String serverName;
    private final String accessToken;
    private final String signingSecret;
    private final String protocolVersion;
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private volatile boolean online;

    public BackendClient(String baseUrl, String serverId, String instanceId, String accessToken,
                         String signingSecret, String protocolVersion, TelemetryQueue queue) {
        this(baseUrl, serverId, instanceId, "", "", "", accessToken, signingSecret, protocolVersion, queue);
    }

    public BackendClient(String baseUrl, String serverId, String instanceId, String networkId,
                         String minecraftServerId, String serverName, String accessToken,
                         String signingSecret, String protocolVersion, TelemetryQueue queue) {
        this.baseUrl = trimBaseUrl(baseUrl);
        this.serverId = require(serverId, "serverId");
        this.instanceId = require(instanceId, "instanceId");
        this.networkId = networkId == null ? "" : networkId;
        this.minecraftServerId = minecraftServerId == null ? "" : minecraftServerId;
        this.serverName = serverName == null ? "" : serverName;
        this.accessToken = require(accessToken, "accessToken");
        this.signingSecret = require(signingSecret, "signingSecret");
        this.protocolVersion = require(protocolVersion, "protocolVersion");
        this.queue = queue;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public CompletableFuture<Boolean> sendBatch(List<TelemetryEvent> events) {
        if (events == null || events.isEmpty()) return CompletableFuture.completedFuture(true);
        String body = batchJson(events);
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        String nonce = UUID.randomUUID().toString();
        String signature = HmacSigner.sign(signingSecret, timestamp, nonce, body);
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/telemetry/events"))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + accessToken)
                .header("X-ProMcBot-Server", serverId)
                .header("X-ProMcBot-Instance", instanceId)
                .header("X-ProMcBot-Version", protocolVersion)
                .header("X-ProMcBot-Network", networkId)
                .header("X-ProMcBot-Minecraft-Server", minecraftServerId)
                .header("X-ProMcBot-Server-Name", serverName)
                .header("X-ProMcBot-Timestamp", timestamp)
                .header("X-ProMcBot-Nonce", nonce)
                .header("X-ProMcBot-Signature", signature)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        return http.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    boolean ok = response.statusCode() >= 200 && response.statusCode() < 300;
                    if (ok) {
                        online = true;
                        consecutiveFailures.set(0);
                    } else {
                        online = false;
                        consecutiveFailures.incrementAndGet();
                    }
                    return ok;
                })
                .exceptionally(error -> {
                    online = false;
                    consecutiveFailures.incrementAndGet();
                    return false;
                });
    }

    public CompletableFuture<Boolean> sendBatchWithRetry(List<TelemetryEvent> events) {
        return sendBatchWithRetry(events, 3);
    }

    private CompletableFuture<Boolean> sendBatchWithRetry(List<TelemetryEvent> events, int attemptsLeft) {
        return sendBatch(events).thenCompose(ok -> {
            if (ok || attemptsLeft <= 1) return CompletableFuture.completedFuture(ok);
            long delaySeconds = (long) Math.pow(2, 3 - attemptsLeft);
            return CompletableFuture.supplyAsync(() -> true, CompletableFuture.delayedExecutor(delaySeconds, TimeUnit.SECONDS))
                    .thenCompose(ignored -> sendBatchWithRetry(events, attemptsLeft - 1));
        });
    }

    public CompletableFuture<Boolean> refreshCapabilities() {
        String body = "";
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        String nonce = UUID.randomUUID().toString();
        String signature = HmacSigner.sign(signingSecret, timestamp, nonce, body);
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/plugin/capabilities"))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + accessToken)
                .header("X-ProMcBot-Server", serverId)
                .header("X-ProMcBot-Instance", instanceId)
                .header("X-ProMcBot-Version", protocolVersion)
                .header("X-ProMcBot-Network", networkId)
                .header("X-ProMcBot-Minecraft-Server", minecraftServerId)
                .header("X-ProMcBot-Server-Name", serverName)
                .header("X-ProMcBot-Timestamp", timestamp)
                .header("X-ProMcBot-Nonce", nonce)
                .header("X-ProMcBot-Signature", signature)
                .build();
        return http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).thenApply(response -> response.statusCode() >= 200 && response.statusCode() < 300).exceptionally(error -> false);
    }

    public CompletableFuture<Boolean> sendHeartbeat(int onlinePlayers) {
        TelemetryEvent heartbeat = new TelemetryEvent("heartbeat", Instant.now(), serverId, instanceId,
                Map.of("onlinePlayers", onlinePlayers, "queueSize", queue.size(), "droppedEvents", queue.dropped()));
        return sendBatch(List.of(heartbeat));
    }

    public boolean isOnline() { return online; }
    public int consecutiveFailures() { return consecutiveFailures.get(); }

    private static String trimBaseUrl(String value) {
        String url = require(value, "baseUrl").trim();
        if (!(url.startsWith("https://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1"))) {
            throw new IllegalArgumentException("baseUrl must use HTTPS outside local development");
        }
        return url.replaceAll("/+$", "");
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }

    private static String batchJson(List<TelemetryEvent> events) {
        StringBuilder json = new StringBuilder("{\"events\":[");
        for (int i = 0; i < events.size(); i++) {
            if (i > 0) json.append(',');
            TelemetryEvent event = events.get(i);
            json.append("{\"type\":").append(q(event.type()))
                    .append(",\"occurredAt\":").append(q(event.occurredAt().toString()))
                    .append(",\"serverId\":").append(q(event.serverId()))
                    .append(",\"instanceId\":").append(q(event.instanceId()))
                    .append(",\"data\":").append(mapJson(event.data())).append('}');
        }
        return json.append("]}").toString();
    }

    private static String mapJson(Map<String, Object> values) {
        StringBuilder json = new StringBuilder("{");
        int i = 0;
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (i++ > 0) json.append(',');
            json.append(q(entry.getKey())).append(':');
            Object value = entry.getValue();
            if (value instanceof Number || value instanceof Boolean) json.append(value);
            else json.append(q(String.valueOf(value)));
        }
        return json.append('}').toString();
    }

    private static String q(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }
}
