const DEFAULT_CHANGELOG_ENTRIES = [
  {
    version: 'v1.2.0', date: 'September 4, 2026', title: 'A clearer path from signal to action',
    description: 'The operational experience now separates measured recommendations from automations that can execute them.',
    categories: ['NEW', 'IMPROVED'],
    sections: [
      { title: 'What’s new', items: ['Dedicated Smart Actions workspace with real enablement and execution paths.', 'Action Center recommendations now explain evidence and link to the right next step.', 'Smart Action notifications can be reviewed, marked read, and resolved in one place.'] },
      { title: 'Improvements', items: ['Text-room selection now uses the server’s authorized Discord channels instead of manual IDs.', 'Sidebar labels make new and plan-specific capabilities easier to discover.'] },
    ],
  },
  {
    version: 'v1.1.0', date: 'September 3, 2026', title: 'Unified server connection setup',
    description: 'Connect a Minecraft server with less guesswork and keep both supported connection methods together.',
    categories: ['NEW', 'IMPROVED'],
    sections: [
      { title: 'What’s new', items: ['Intelligence is now a free setup hub for every managed server.', 'IP and port status checks and Plugin telemetry setup are presented as one guided flow.'] },
      { title: 'Improvements', items: ['Settings now directs Minecraft connection setup to the Intelligence hub.', 'Activation steps show measured heartbeat and telemetry readiness.'] },
    ],
  },
  {
    version: 'v1.0.1', date: 'September 2, 2026', title: 'A steadier dashboard foundation',
    description: 'Responsive dashboard surfaces received a focused reliability pass across navigation, setup, and operational views.',
    categories: ['FIXED', 'SECURITY'],
    sections: [
      { title: 'Fixes', items: ['Removed duplicate page markup that could cause broken mobile rendering.', 'Improved empty, loading, and unavailable states across server views.'] },
      { title: 'Security', items: ['Server-scoped requests continue to enforce authenticated manager access before returning operational data.'] },
    ],
  },
];
module.exports = { DEFAULT_CHANGELOG_ENTRIES };
