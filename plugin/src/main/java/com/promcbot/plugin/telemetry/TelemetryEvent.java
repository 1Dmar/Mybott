package com.promcbot.plugin.telemetry;

import java.time.Instant;
import java.util.Map;

public record TelemetryEvent(
        String type,
        Instant occurredAt,
        String serverId,
        String instanceId,
        Map<String, Object> data
) {
    public TelemetryEvent {
        if (type == null || type.isBlank()) throw new IllegalArgumentException("event type is required");
        if (occurredAt == null) occurredAt = Instant.now();
        if (serverId == null || serverId.isBlank()) throw new IllegalArgumentException("serverId is required");
        if (instanceId == null || instanceId.isBlank()) throw new IllegalArgumentException("instanceId is required");
        data = data == null ? Map.of() : Map.copyOf(data);
    }
}
