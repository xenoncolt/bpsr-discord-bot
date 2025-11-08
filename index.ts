import { Client, Collection, Events, GatewayIntentBits } from "discord.js";

import "dotenv/config";
import { ExtendedClient } from "./types/ExtendedClient.js";
import { Command } from "./types/Command.js";
import { loadCommands, registerSlashCommands } from "./handler/slashCommandHandler.js";
import { loadEvents } from "./handler/eventHandler.js";
import { stReminder } from "./utils/eventApi.js";
import { initBossTracker, stopBossTracking } from "./utils/bossTracker.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
    ]
}) as ExtendedClient;

client.commands = new Collection<string, Command>();

loadCommands(client);
loadEvents(client);
stReminder(client);

client.once(Events.ClientReady, async () => {
    console.log(`Loading slash cmds for ${client.user?.tag}`);
    await registerSlashCommands(client);
    await initBossTracker();
});

client.on(Events.Debug, (info) => {
    console.log(info);
});

client.on(Events.Error, (err) => {
    console.error(err);
});

process.on('SIGINT', () => {
    stopBossTracking();
    process.exit();
})

client.login(process.env.TOKEN);