import { ChatInputCommandInteraction, Client, Events, MessageFlags } from "discord.js";
import config from "../config.json" with { type: "json" };
import { loadCommands, registerSlashCommands } from "../handler/slashCommandHandler.js";
import { ExtendedClient } from "../types/ExtendedClient.js";

export default {
    name: 'load-cmd',
    description: 'Owner can only load cmds',
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        if (interaction.user.id !== config.owner) {
            await interaction.reply({ content: 'Dont try to be smart!', flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            loadCommands(client as ExtendedClient);
            
            await registerSlashCommands(client as ExtendedClient);
            await interaction.editReply({ content: 'Commands reloaded successfully!' });
        } catch (error) {
            await interaction.editReply({ content: 'Error reloading commands!' });
            console.error(error);
        }
    }
}