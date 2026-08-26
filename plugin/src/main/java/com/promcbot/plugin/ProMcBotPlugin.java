package dev.promcbot.plugin;

import com.promcbot.plugin.backend.BackendClient;
import com.promcbot.plugin.telemetry.TelemetryEvent;
import com.promcbot.plugin.telemetry.TelemetryQueue;
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

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public final class ProMcBotPlugin extends JavaPlugin implements Listener, CommandExecutor {
    private final Map<UUID, Instant> sessions = new ConcurrentHashMap<>();
    private TelemetryQueue telemetryQueue;
    private BackendClient backend;
    private int flushTask = -1;
    private int snapshotTask = -1;
    private int heartbeatTask = -1;
    private volatile int lastOnlineCount;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        String serverId = getConfig().getString("backend.server-id", "");
        String instanceId = getConfig().getString("backend.instance-id", "");
        String baseUrl = getConfig().getString("backend.base-url", "");
        String accessToken = getConfig().getString("backend.access-token", "");
        String signingSecret = getConfig().getString("backend.signing-secret", "");
        String protocolVersion = getConfig().getString("backend.protocol-version", "1");
        int maxQueue = Math.max(100, getConfig().getInt("telemetry.max-queue-size", 5000));
        int batchSize = Math.max(1, Math.min(250, getConfig().getInt("telemetry.batch-size", 100)));
        long snapshotSeconds = Math.max(30, getConfig().getLong("telemetry.snapshot-seconds", 60));
        long heartbeatSeconds = Math.max(30, getConfig().getLong("backend.heartbeat-seconds", 60));
        telemetryQueue = new TelemetryQueue(maxQueue);

        try {
            backend = new BackendClient(baseUrl, serverId, instanceId, accessToken, signingSecret,
                    protocolVersion, telemetryQueue);
        } catch (IllegalArgumentException error) {
            getLogger().severe("Backend configuration is incomplete or unsafe: " + error.getMessage());
            getLogger().severe("The server remains playable; telemetry will stay offline until config.yml is completed.");
        }

        Bukkit.getPluginManager().registerEvents(this, this);
        if (getCommand("promcbot") != null) getCommand("promcbot").setExecutor(this);

        // Bukkit API reads stay on the primary thread; only queue operations run here.
        snapshotTask = Bukkit.getScheduler().scheduleSyncRepeatingTask(this, this::captureSnapshot,
                20L * snapshotSeconds, 20L * snapshotSeconds);
        // Network calls are always asynchronous and never block the Minecraft thread.
        flushTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> flush(batchSize),
                20L * 5, 20L * 5).getTaskId();
        heartbeatTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::heartbeat,
                20L * heartbeatSeconds, 20L * heartbeatSeconds).getTaskId();
        getLogger().info("ProMcBot plugin enabled. Queue=" + maxQueue + ", batch=" + batchSize + ", protocol=v" + protocolVersion);
    }

    @Override
    public void onDisable() {
        if (snapshotTask != -1) Bukkit.getScheduler().cancelTask(snapshotTask);
        if (flushTask != -1) Bukkit.getScheduler().cancelTask(flushTask);
        if (heartbeatTask != -1) Bukkit.getScheduler().cancelTask(heartbeatTask);
        if (backend != null && telemetryQueue != null) flush(250);
        getLogger().info("ProMcBot plugin disabled. Pending telemetry is discarded safely after the local queue limit.");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        sessions.put(player.getUniqueId(), Instant.now());
        enqueue("player_join", Map.of("uuid", player.getUniqueId().toString(), "username", player.getName()));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        Instant started = sessions.remove(player.getUniqueId());
        long duration = started == null ? 0 : Math.max(0, java.time.Duration.between(started, Instant.now()).getSeconds());
        enqueue("player_leave", Map.of("uuid", player.getUniqueId().toString(), "username", player.getName(), "sessionSeconds", duration));
    }

    private void captureSnapshot() {
        // Identity is collected on join/leave; periodic snapshots contain only the aggregate count.
        lastOnlineCount = Bukkit.getOnlinePlayers().size();
        enqueue("player_count", Map.of("onlinePlayers", lastOnlineCount));
    }

    private void enqueue(String type, Map<String, Object> data) {
        if (telemetryQueue == null) return;
        String serverId = getConfig().getString("backend.server-id", "unconfigured");
        String instanceId = getConfig().getString("backend.instance-id", "unconfigured");
        telemetryQueue.offer(new TelemetryEvent(type, Instant.now(), serverId, instanceId, data));
    }

    private void flush(int batchSize) {
        if (backend == null || telemetryQueue == null || telemetryQueue.size() == 0) return;
        var batch = telemetryQueue.drain(batchSize);
        backend.sendBatchWithRetry(batch).thenAccept(ok -> {
            if (!ok) telemetryQueue.requeue(batch);
        });
    }

    private void heartbeat() {
        if (backend == null) return;
        backend.sendHeartbeat(lastOnlineCount);
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("promcbot")) return false;
        if (args.length == 0 || args[0].equalsIgnoreCase("status")) {
            sender.sendMessage("ProMcBot: queue=" + (telemetryQueue == null ? 0 : telemetryQueue.size())
                    + ", dropped=" + (telemetryQueue == null ? 0 : telemetryQueue.dropped())
                    + ", backend=" + (backend != null && backend.isOnline() ? "online" : "offline"));
            return true;
        }
        sender.sendMessage("Usage: /promcbot status");
        return true;
    }
}
