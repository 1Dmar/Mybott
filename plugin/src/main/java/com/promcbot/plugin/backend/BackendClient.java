package com.promcbot.plugin.backend;

import com.promcbot.plugin.telemetry.TelemetryEvent;
import com.promcbot.plugin.telemetry.TelemetryQueue;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class BackendClient {
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
    }

    public CompletableFuture<Boolean> sendBatch(List<TelemetryEvent> events) {
        if (events == null || events.isEmpty()) return CompletableFuture.completedFuture(true);
        final String body = batchJson(events);
        return sendAsync("/api/v1/telemetry/events", "POST", body);
    }

    public CompletableFuture<Boolean> sendBatchWithRetry(List<TelemetryEvent> events) {
        return sendBatchWithRetry(events, 3);
    }

    private CompletableFuture<Boolean> sendBatchWithRetry(final List<TelemetryEvent> events, final int attemptsLeft) {
        return sendBatch(events).thenCompose(ok -> {
            if (ok || attemptsLeft <= 1) return CompletableFuture.completedFuture(ok);
            final long delaySeconds = (long) Math.pow(2, 3 - attemptsLeft);
            return CompletableFuture.supplyAsync(() -> {
                try {
                    TimeUnit.SECONDS.sleep(delaySeconds);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
                return true;
            }).thenCompose(ignored -> sendBatchWithRetry(events, attemptsLeft - 1));
        });
    }

    public CompletableFuture<Boolean> refreshCapabilities() {
        return sendAsync("/api/v1/plugin/capabilities", "GET", "");
    }

    public CompletableFuture<Boolean> sendHeartbeat(int onlinePlayers) {
        Map<String, Object> data = new HashMap<String, Object>();
        data.put("onlinePlayers", onlinePlayers);
        data.put("queueSize", queue == null ? 0 : queue.size());
        data.put("droppedEvents", queue == null ? 0 : queue.dropped());
        TelemetryEvent heartbeat = new TelemetryEvent("heartbeat", Instant.now(), serverId, instanceId, data);
        return sendBatch(Collections.singletonList(heartbeat));
    }

    public boolean isOnline() { return online; }
    public int consecutiveFailures() { return consecutiveFailures.get(); }

    private CompletableFuture<Boolean> sendAsync(final String path, final String method, final String body) {
        return CompletableFuture.supplyAsync(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = URI.create(baseUrl + path).toURL();
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod(method);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(8000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Authorization", "Bearer " + accessToken);
                connection.setRequestProperty("X-ProMcBot-Server", serverId);
                connection.setRequestProperty("X-ProMcBot-Instance", instanceId);
                connection.setRequestProperty("X-ProMcBot-Version", protocolVersion);
                connection.setRequestProperty("X-ProMcBot-Network", networkId);
                connection.setRequestProperty("X-ProMcBot-Minecraft-Server", minecraftServerId);
                connection.setRequestProperty("X-ProMcBot-Server-Name", serverName);
                String timestamp = Long.toString(Instant.now().getEpochSecond());
                String nonce = UUID.randomUUID().toString();
                connection.setRequestProperty("X-ProMcBot-Timestamp", timestamp);
                connection.setRequestProperty("X-ProMcBot-Nonce", nonce);
                connection.setRequestProperty("X-ProMcBot-Signature", HmacSigner.sign(signingSecret, timestamp, nonce, body));
                if ("POST".equals(method)) {
                    byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setFixedLengthStreamingMode(payload.length);
                    connection.getOutputStream().write(payload);
                }
                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (stream != null) stream.close();
                boolean ok = status >= 200 && status < 300;
                online = ok;
                if (ok) consecutiveFailures.set(0); else consecutiveFailures.incrementAndGet();
                return ok;
            } catch (Exception error) {
                online = false;
                consecutiveFailures.incrementAndGet();
                return false;
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static String trimBaseUrl(String value) {
        String url = require(value, "baseUrl").trim();
        if (!(url.startsWith("https://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1"))) {
            throw new IllegalArgumentException("baseUrl must use HTTPS outside local development");
        }
        return url.replaceAll("/+$", "");
    }

    private static String require(String value, String field) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(field + " is required");
        return value;
    }

    private static String batchJson(List<TelemetryEvent> events) {
        StringBuilder json = new StringBuilder("{\"events\":[");
        for (int i = 0; i < events.size(); i++) {
            if (i > 0) json.append(',');
            TelemetryEvent event = events.get(i);
            json.append("{\"eventId\":").append(q(event.eventId()))
                    .append(",\"type\":").append(q(event.type()))
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
