const PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    name: 'Free',
    priceUsdMonthly: 0,
    promise: 'Help small servers become better.',
    capabilities: Object.freeze(['core_discord_minecraft_connection', 'basic_server_visibility', 'basic_player_information', 'basic_alerts', 'basic_server_health', 'basic_activity_insights', 'basic_community_tools', 'basic_setup', 'essential_protection', 'useful_notifications']),
  }),
  pro: Object.freeze({
    id: 'pro',
    name: 'Pro',
    priceUsdMonthly: 4.99,
    promise: 'Deeper automation, analytics, growth, and operational control.',
    capabilities: Object.freeze(['advanced_server_intelligence', 'advanced_player_analytics', 'player_journey_analytics', 'retention_analysis', 'advanced_engagement_automation', 'smart_events', 'advanced_notifications']),
  }),
});

function getPlan(plan) {
  return plan === 'pro' || plan === 'premium' ? PLANS.pro : PLANS.free;
}

module.exports = { PLANS, getPlan };
