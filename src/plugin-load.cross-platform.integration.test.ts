import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Isolation: `npx vitest run --project integration-tests:desktop src/plugin-load.cross-platform.integration.test.ts`,
// Or `--project integration-tests:android`.
//
// Obsidian's plugin guidelines ask for no console output in the default configuration, where the plugin's debug
// Messages are disabled: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Avoid+unnecessary+logging+to+console

type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn';

const PLUGIN_ID = 'sibling-notes';

describe('plugin load', () => {
  it('writes nothing to the console when the plugin is reloaded with its debug messages disabled', async () => {
    const messages = await evalInObsidian({
      async callback({ app, pluginId }): Promise<string[]> {
        const methods: ConsoleMethod[] = ['debug', 'error', 'info', 'log', 'warn'];
        const consoleMethods: Record<ConsoleMethod, (...data: unknown[]) => void> = console;
        const originals = methods.map((method) => [method, consoleMethods[method]] as const);
        const recorded: string[] = [];
        for (const [method, original] of originals) {
          consoleMethods[method] = (...data: unknown[]): void => {
            recorded.push(`${method}: ${data.map(String).join(' ')}`);
            original.apply(console, data);
          };
        }
        try {
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
        } finally {
          for (const [method, original] of originals) {
            consoleMethods[method] = original;
          }
        }
        return recorded.filter((message) => message.includes(pluginId));
      },
      input: { pluginId: PLUGIN_ID },
      vaultPath: getTemporaryVault().path
    });

    expect(messages).toEqual([]);
  });
});
