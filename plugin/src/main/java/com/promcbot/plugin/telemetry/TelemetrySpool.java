package com.promcbot.plugin.telemetry;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Small durable local spool for telemetry which has left the in-memory queue.
 * The format is intentionally dependency-free and Java 8 compatible: one
 * base64-encoded event per line. The spool never contains access tokens or
 * signing secrets; it only persists telemetry payloads needed for retry.
 */
public final class TelemetrySpool {
    private static final String VERSION = "v1";
    private final File file;
    private final long maxBytes;

    public TelemetrySpool(File file, long maxBytes) {
        if (file == null) throw new IllegalArgumentException("spool file is required");
        if (maxBytes < 64 * 1024L) throw new IllegalArgumentException("spool maxBytes must be at least 64KB");
        this.file = file;
        this.maxBytes = maxBytes;
    }

    public synchronized void append(TelemetryEvent event) throws IOException {
        if (event == null) return;
        ensureParent();
        byte[] encoded = encode(event).getBytes(StandardCharsets.UTF_8);
        long current = file.isFile() ? file.length() : 0L;
        if (current + encoded.length + 1L > maxBytes) throw new IOException("telemetry spool is full");
        FileOutputStream output = new FileOutputStream(file, true);
        try {
            output.write(encoded);
            output.write('\n');
            output.flush();
            output.getFD().sync();
        } finally {
            output.close();
        }
    }

    public synchronized List<TelemetryEvent> load(int limit) throws IOException {
        return readPending(new HashSet<String>(), limit);
    }

    public synchronized int pendingCount() throws IOException {
        int count = 0;
        if (!file.isFile()) return 0;
        BufferedReader reader = reader();
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.trim().isEmpty()) count++;
            }
        } finally {
            reader.close();
        }
        return count;
    }

    /** Remove acknowledged IDs while preserving every unacknowledged line. */
    public synchronized void acknowledge(Set<String> eventIds) throws IOException {
        if (eventIds == null || eventIds.isEmpty() || !file.isFile()) return;
        List<String> keep = new ArrayList<String>();
        BufferedReader reader = reader();
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                try {
                    TelemetryEvent event = decode(line);
                    if (!eventIds.contains(event.eventId())) keep.add(line);
                } catch (IllegalArgumentException malformed) {
                    // Preserve malformed records for operator inspection rather than silently dropping data.
                    keep.add(line);
                }
            }
        } finally {
            reader.close();
        }
        rewrite(keep);
    }

    private List<TelemetryEvent> readPending(Set<String> excluded, int limit) throws IOException {
        List<TelemetryEvent> events = new ArrayList<TelemetryEvent>();
        if (limit <= 0 || !file.isFile()) return events;
        BufferedReader reader = reader();
        try {
            String line;
            while (events.size() < limit && (line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                try {
                    TelemetryEvent event = decode(line);
                    if (!excluded.contains(event.eventId())) events.add(event);
                } catch (IllegalArgumentException malformed) {
                    // Skip a malformed record for delivery; acknowledge() keeps it for diagnosis.
                }
            }
        } finally {
            reader.close();
        }
        return events;
    }

    private void rewrite(List<String> lines) throws IOException {
        ensureParent();
        if (lines.isEmpty()) {
            if (file.exists() && !file.delete()) throw new IOException("unable to clear telemetry spool");
            return;
        }
        File temp = new File(file.getPath() + ".tmp-" + UUID.randomUUID().toString());
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(temp), StandardCharsets.UTF_8));
        try {
            for (String line : lines) {
                writer.write(line);
                writer.newLine();
            }
            writer.flush();
        } finally {
            writer.close();
        }
        try {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (java.nio.file.AtomicMoveNotSupportedException unsupported) {
            Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private BufferedReader reader() throws IOException {
        return new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8));
    }

    private void ensureParent() throws IOException {
        File parent = file.getAbsoluteFile().getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs() && !parent.isDirectory()) {
            throw new IOException("unable to create telemetry spool directory");
        }
    }

    static String encode(TelemetryEvent event) {
        StringBuilder line = new StringBuilder(VERSION);
        append(line, event.eventId());
        append(line, event.type());
        append(line, event.occurredAt().toString());
        append(line, event.serverId());
        append(line, event.instanceId());
        line.append('\t').append(encodeData(event.data()));
        return line.toString();
    }

    static TelemetryEvent decode(String line) {
        String[] fields = line.split("\\t", -1);
        if (fields.length != 7 || !VERSION.equals(fields[0])) throw new IllegalArgumentException("invalid telemetry spool record");
        try {
            return new TelemetryEvent(unquote(fields[1]), unquote(fields[2]), Instant.parse(unquote(fields[3])),
                    unquote(fields[4]), unquote(fields[5]), decodeData(fields[6]));
        } catch (RuntimeException error) {
            throw new IllegalArgumentException("invalid telemetry spool event", error);
        }
    }

    private static void append(StringBuilder line, String value) {
        line.append('\t').append(b64(value));
    }

    private static String encodeData(Map<String, Object> data) {
        StringBuilder result = new StringBuilder();
        List<String> keys = new ArrayList<String>(data.keySet());
        java.util.Collections.sort(keys);
        for (String key : keys) {
            if (result.length() > 0) result.append(';');
            Object value = data.get(key);
            String kind = value instanceof Boolean ? "b" : value instanceof Number ? "n" : "s";
            result.append(b64(key)).append(':').append(kind).append(':').append(b64(String.valueOf(value)));
        }
        return result.toString();
    }

    private static Map<String, Object> decodeData(String encoded) {
        Map<String, Object> data = new HashMap<String, Object>();
        if (encoded == null || encoded.isEmpty()) return data;
        String[] entries = encoded.split(";", -1);
        for (String entry : entries) {
            String[] parts = entry.split(":", 3);
            if (parts.length != 3) throw new IllegalArgumentException("invalid spool data");
            String key = unb64(parts[0]);
            String kind = parts[1];
            String value = unb64(parts[2]);
            if ("b".equals(kind)) data.put(key, Boolean.valueOf(value));
            else if ("n".equals(kind)) {
                if (value.indexOf('.') >= 0) data.put(key, Double.valueOf(value));
                else data.put(key, Long.valueOf(value));
            }
            else if ("s".equals(kind)) data.put(key, value);
            else throw new IllegalArgumentException("invalid spool data type");
        }
        return data;
    }

    private static String b64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String unb64(String value) {
        return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
    }

    private static String unquote(String value) {
        return unb64(value);
    }
}
