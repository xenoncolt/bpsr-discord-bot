import { Client, Collection, Events, GatewayIntentBits } from "discord.js";

import "dotenv/config";
import { ExtendedClient } from "./types/ExtendedClient.js";
import { Command } from "./types/Command.js";
import { loadCommands, registerSlashCommands } from "./handler/slashCommandHandler.js";
import { loadEvents } from "./handler/eventHandler.js";

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

client.once(Events.ClientReady, async () => {
    console.log(`Loading slash cmds for ${client.user?.tag}`);
    await registerSlashCommands(client);
});

client.on(Events.Debug, (info) => {
    console.log(info);
});

client.on(Events.Error, (err) => {
    console.error(err);
});

client.login(process.env.TOKEN);