package com.promcbot.plugin.telemetry;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class TelemetryEvent {
    private final String eventId;
    private final String type;
    private final Instant occurredAt;
    private final String serverId;
    private final String instanceId;
    private final Map<String, Object> data;

    public TelemetryEvent(String type, Instant occurredAt, String serverId, String instanceId, Map<String, Object> data) {
        this(UUID.randomUUID().toString(), type, occurredAt, serverId, instanceId, data);
    }

    public TelemetryEvent(String eventId, String type, Instant occurredAt, String serverId, String instanceId, Map<String, Object> data) {
        if (eventId == null || eventId.trim().isEmpty()) throw new IllegalArgumentException("eventId is required");
        if (type == null || type.trim().isEmpty()) throw new IllegalArgumentException("event type is required");
        if (serverId == null || serverId.trim().isEmpty()) throw new IllegalArgumentException("serverId is required");
        if (instanceId == null || instanceId.trim().isEmpty()) throw new IllegalArgumentException("instanceId is required");
        this.eventId = eventId.trim();
        this.type = type;
        this.occurredAt = occurredAt == null ? Instant.now() : occurredAt;
        this.serverId = serverId;
        this.instanceId = instanceId;
        this.data = data == null ? Collections.<String, Object>emptyMap() : Collections.unmodifiableMap(new HashMap<String, Object>(data));
    }

    public String eventId() { return eventId; }
    public String type() { return type; }
    public Instant occurredAt() { return occurredAt; }
    public String serverId() { return serverId; }
    public String instanceId() { return instanceId; }
    public Map<String, Object> data() { return data; }
}
