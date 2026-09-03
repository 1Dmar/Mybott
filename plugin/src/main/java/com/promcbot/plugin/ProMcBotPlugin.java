package dev.promcbot.plugin;

import com.promcbot.plugin.backend.BackendClient;
import com.promcbot.plugin.telemetry.TelemetryEvent;
import com.promcbot.plugin.telemetry.TelemetryQueue;
import com.promcbot.plugin.telemetry.TelemetrySpool;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public final class ProMcBotPlugin extends JavaPlugin implements Listener, CommandExecutor {
    private final Map<UUID, Instant> sessions = new ConcurrentHashMap<UUID, Instant>();
    private TelemetryQueue telemetryQueue;
    private TelemetrySpool telemetrySpool;
    private com.promcbot.plugin.telemetry.TelemetrySpoolWriter telemetrySpoolWriter;
    private BackendClient backend;
    private int snapshotTask = -1;
    private BukkitTask flushTask;
    private BukkitTask heartbeatTask;
    private volatile CompletableFuture<Boolean> flushInFlight;
    private volatile int lastOnlineCount;
    private volatile boolean entitlementAvailable;
    private volatile long lastSpoolWarningAt;
    private volatile int lastKnownSpoolCount;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        String serverId = getConfig().getString("backend.server-id", "");
        String instanceId = getConfig().getString("backend.instance-id", "");
        String networkId = getConfig().getString("backend.network-id", "");
        String minecraftServerId = getConfig().getString("backend.minecraft-server-id", instanceId);
        String serverName = getConfig().getString("backend.server-name", "");
        String baseUrl = getConfig().getString("backend.base-url", "");
        String accessToken = getConfig().getString("backend.access-token", "");
        String signingSecret = getConfig().getString("backend.signing-secret", "");
        String protocolVersion = getConfig().getString("backend.protocol-version", "1");
        int maxQueue = Math.max(100, getConfig().getInt("telemetry.max-queue-size", 5000));
        int batchSize = Math.max(1, Math.min(250, getConfig().getInt("telemetry.batch-size", 100)));
        long snapshotSeconds = Math.max(30, getConfig().getLong("telemetry.snapshot-seconds", 60));
        long heartbeatSeconds = Math.max(30, getConfig().getLong("backend.heartbeat-seconds", 60));
        telemetryQueue = new TelemetryQueue(maxQueue);
        if (getConfig().getBoolean("telemetry.spool-enabled", true)) {
            long spoolMaxBytes = Math.max(64 * 1024L, getConfig().getLong("telemetry.spool-max-bytes", 8 * 1024 * 1024L));
            try {
                telemetrySpool = new TelemetrySpool(new File(getDataFolder(), "telemetry.spool"), spoolMaxBytes);
                telemetrySpoolWriter = new com.promcbot.plugin.telemetry.TelemetrySpoolWriter(telemetrySpool, maxQueue,
                        "promcbot-telemetry-spool-writer");
                CompletableFuture.runAsync(() -> recoverSpool(maxQueue));
            } catch (RuntimeException error) {
                getLogger().warning("Durable telemetry spool is unavailable; in-memory fallback is active: " + error.getMessage());
            }
        } else {
            getLogger().warning("Durable telemetry spool is disabled; telemetry may be lost on restart or crash.");
        }

        try {
            backend = new BackendClient(baseUrl, serverId, instanceId, networkId, minecraftServerId,
                    serverName, accessToken, signingSecret, protocolVersion, telemetryQueue);
        } catch (IllegalArgumentException error) {
            getLogger().severe("Backend configuration is incomplete or unsafe: " + error.getMessage());
            getLogger().severe("The server remains playable; telemetry will stay offline until config.yml is completed.");
        }

        // Send an initial measured snapshot immediately after startup; do not make
        // the dashboard wait for the first scheduled minute before showing evidence.
        captureSnapshot();
        if (backend != null) {
            backend.refreshCapabilities().thenAccept(ok -> {
                entitlementAvailable = ok;
                if (!ok) getLogger().warning("Backend capability check failed: " + backend.lastError());
            });
            backend.sendHeartbeat(lastOnlineCount).thenAccept(ok -> {
                if (!ok) getLogger().warning("Backend heartbeat failed: " + backend.lastError());
            });
        }
        Bukkit.getPluginManager().registerEvents(this, this);
        if (getCommand("promcbot") != null) getCommand("promcbot").setExecutor(this);

        // Bukkit API reads stay on the primary thread; only queue operations run here.
        snapshotTask = Bukkit.getScheduler().scheduleSyncRepeatingTask(this, this::captureSnapshot,
                20L * snapshotSeconds, 20L * snapshotSeconds);
        // Network calls are always asynchronous and never block the Minecraft thread.
        flushTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> flush(batchSize),
                20L * 5, 20L * 5);
        heartbeatTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::heartbeat,
                20L * heartbeatSeconds, 20L * heartbeatSeconds);
        getLogger().info("ProMcBot plugin enabled. Queue=" + maxQueue + ", batch=" + batchSize + ", protocol=v" + protocolVersion);
    }

    @Override
    public void onDisable() {
        if (snapshotTask != -1) Bukkit.getScheduler().cancelTask(snapshotTask);
        if (flushTask != null) flushTask.cancel();
        if (heartbeatTask != null) heartbeatTask.cancel();
        CompletableFuture<Void> finalShutdown;
        if (backend != null && telemetryQueue != null) {
            finalShutdown = CompletableFuture.supplyAsync(() -> flush(250))
                    .thenCompose(flushFuture -> flushFuture)
                    .handle((delivered, error) -> {
                        if (error != null || !Boolean.TRUE.equals(delivered)) {
                            getLogger().warning("Final telemetry flush was not acknowledged; durable retry remains enabled.");
                        }
                        return (Void) null;
                    })
                    .thenCompose(ignored -> telemetrySpoolWriter == null
                            ? CompletableFuture.completedFuture(null) : telemetrySpoolWriter.shutdownAsync());
        } else if (telemetrySpoolWriter != null) {
            finalShutdown = telemetrySpoolWriter.shutdownAsync();
        } else {
            finalShutdown = CompletableFuture.completedFuture(null);
        }
        finalShutdown.whenComplete((ignored, error) -> {
            if (error != null) getLogger().warning("Final telemetry flush/spool drain was not completed: " + error.getMessage());
            else if (pendingCount() > 0) getLogger().warning("Final telemetry flush was not acknowledged; pending events remain for a later retry.");
        });
        getLogger().info("ProMcBot plugin disabled. Final flush and durable spool drain are asynchronous and best-effort; Bukkit callbacks never perform disk I/O.");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        sessions.put(player.getUniqueId(), Instant.now());
        enqueue("player_join", data("uuid", player.getUniqueId().toString(), "username", player.getName()));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        Instant started = sessions.remove(player.getUniqueId());
        long duration = started == null ? 0 : Math.max(0, Duration.between(started, Instant.now()).getSeconds());
        enqueue("player_leave", data("uuid", player.getUniqueId().toString(), "username", player.getName(), "sessionSeconds", duration));
    }

    private void captureSnapshot() {
        // Identity is collected on join/leave; periodic snapshots contain only the aggregate count.
        lastOnlineCount = Bukkit.getOnlinePlayers().size();
        enqueue("player_count", data("onlinePlayers", lastOnlineCount));
    }

    private void enqueue(String type, Map<String, Object> eventData) {
        if (telemetryQueue == null) return;
        String serverId = getConfig().getString("backend.server-id", "unconfigured");
        String instanceId = getConfig().getString("backend.instance-id", "unconfigured");
        TelemetryEvent event = new TelemetryEvent(type, Instant.now(), serverId, instanceId, eventData);
        if (telemetrySpoolWriter != null) {
            telemetrySpoolWriter.enqueue(event).whenComplete((ignored, error) -> {
                if (error != null) warnSpoolFailure(error);
            });
        }
        telemetryQueue.offer(event);
    }

    private synchronized CompletableFuture<Boolean> flush(int batchSize) {
        if (flushInFlight != null && !flushInFlight.isDone()) return flushInFlight;
        if (backend == null || telemetryQueue == null) return CompletableFuture.completedFuture(true);
        List<TelemetryEvent> batch = telemetryQueue.drain(batchSize);
        Set<String> selected = new HashSet<String>();
        for (TelemetryEvent event : batch) selected.add(event.eventId());
        if (batch.size() < batchSize && telemetrySpool != null) {
            try {
                List<TelemetryEvent> durable = telemetrySpool.load(batchSize);
                for (TelemetryEvent event : durable) {
                    if (batch.size() >= batchSize) break;
                    if (selected.add(event.eventId())) batch.add(event);
                }
            } catch (IOException error) {
                getLogger().warning("Could not read durable telemetry spool: " + error.getMessage());
            }
        }
        if (batch.isEmpty()) return CompletableFuture.completedFuture(true);
        CompletableFuture<Void> persisted = telemetrySpoolWriter == null
                ? CompletableFuture.completedFuture(null)
                : telemetrySpoolWriter.awaitPersisted(selected);
        flushInFlight = persisted.handle((ignored, persistenceError) -> {
            if (persistenceError != null) warnSpoolFailure(persistenceError);
            return null;
        }).thenCompose(ignored -> backend.sendBatchWithRetry(batch)).handle((ok, error) -> {
            if (error == null && Boolean.TRUE.equals(ok)) {
                try {
                    if (telemetrySpool != null) telemetrySpool.acknowledge(selected);
                    refreshSpoolCountAsync();
                } catch (IOException spoolError) {
                    getLogger().warning("Telemetry was acknowledged by backend but local spool cleanup failed; retry will be idempotent: " + spoolError.getMessage());
                }
                return true;
            }
            telemetryQueue.requeue(batch);
            refreshSpoolCountAsync();
            return false;
        });
        return flushInFlight;
    }

    private int pendingCount() {
        int memory = telemetryQueue == null ? 0 : telemetryQueue.size();
        int staged = telemetrySpoolWriter == null ? 0 : telemetrySpoolWriter.stagedCount();
        return Math.max(memory + staged, lastKnownSpoolCount);
    }

    private void recoverSpool(int maxQueue) {
        if (telemetrySpool == null || telemetryQueue == null) return;
        try {
            List<TelemetryEvent> recovered = telemetrySpool.load(maxQueue);
            telemetryQueue.requeue(recovered);
            lastKnownSpoolCount = telemetrySpool.pendingCount();
            if (!recovered.isEmpty()) getLogger().info("Recovered " + recovered.size() + " durable telemetry event(s) from local spool.");
        } catch (IOException error) {
            warnSpoolFailure(error);
        }
    }

    private void refreshSpoolCountAsync() {
        if (telemetrySpool == null) return;
        CompletableFuture.runAsync(() -> {
            try {
                lastKnownSpoolCount = telemetrySpool.pendingCount();
            } catch (IOException error) {
                warnSpoolFailure(error);
            }
        });
    }

    private void warnSpoolFailure(Throwable error) {
        long now = System.currentTimeMillis();
        if (now - lastSpoolWarningAt > 60_000L) {
            lastSpoolWarningAt = now;
            getLogger().warning("Could not persist or read telemetry locally; in-memory fallback is active: " + error.getMessage());
        }
    }

    private void heartbeat() {
        if (backend == null) return;
        backend.sendHeartbeat(lastOnlineCount);
    }

    private static Map<String, Object> data(Object... values) {
        Map<String, Object> result = new HashMap<String, Object>();
        for (int i = 0; i + 1 < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("promcbot")) return false;
        if (args.length == 0 || args[0].equalsIgnoreCase("status")) {
            sender.sendMessage("ProMcBot: queue=" + (telemetryQueue == null ? 0 : telemetryQueue.size())
                    + ", staged=" + (telemetrySpoolWriter == null ? 0 : telemetrySpoolWriter.stagedCount())
                    + ", durable=" + lastKnownSpoolCount
                    + ", dropped=" + (telemetryQueue == null ? 0 : telemetryQueue.dropped())
                    + ", backend=" + (backend != null && backend.isOnline() ? "online" : "offline")
                    + (backend == null ? "" : ", backend-error=" + (backend.lastError().isEmpty() ? "none" : backend.lastError()))
                    + ", capabilities=" + (entitlementAvailable ? "available" : "degraded"));
            return true;
        }
        sender.sendMessage("Usage: /promcbot status");
        return true;
    }
}
