import { Events, Interaction, MessageFlags } from "discord.js";
import { ExtendedClient } from "../../types/ExtendedClient.js";
import {  } from "fs";
import config from "../../config.json" with { type: "json" };

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute (interaction: Interaction, client: ExtendedClient) {
        if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isAutocomplete() && !interaction.isButton() && !interaction.isModalSubmit()) return;

        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd) return;

            try {
                await cmd.execute(interaction, client);
            } catch (err) {
                console.error(`Error executing command ${interaction.commandName}:`, err);
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
                await client.users.cache.get(config.owner)?.send({ content: `Something wrong with ur code, error \n\`\`\`cmd\n${err}\n\`\`\`` });
            }
        } else if (interaction.isStringSelectMenu()) {
            // pre handle if needed
        } else if (interaction.isAutocomplete()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd || !cmd.autocomplete) return;

            try {
                await cmd.autocomplete(interaction, client);
            } catch (err) {
                console.error(`Error executing autocomplete for ${interaction.commandName}:`, err);
                await client.users.cache.get(config.owner)?.send({ content: `Something wrong with ur code, error \n\`\`\`autocomplete\n${err}\n\`\`\`` });
            }
        } else if (interaction.isButton()) {
            const buttonId = interaction.customId;

            // same.. for later use
        } else if (interaction.isModalSubmit()) {
            const modal_cmds = Array.from(client.commands.values()).find(cmd =>
                interaction.customId.startsWith(cmd.name) && cmd.modalSubmit
            );

            if (!modal_cmds) {
                console.warn(`No modal handler found for customId: ${interaction.customId}`);
                await interaction.reply({ content: 'This modal is not recognized. Report to admin.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (modal_cmds && modal_cmds.modalSubmit) {
                try {
                    await modal_cmds.modalSubmit(interaction, client);
                } catch (err) {
                    console.error(`Error executing modalSubmit for ${interaction.customId}:`, err);
                    await interaction.reply({ content: 'There was an error while processing this modal!', flags: MessageFlags.Ephemeral });
                    await client.users.cache.get(config.owner)?.send({ content: `Something wrong with ur code, error \n\`\`\`modal\n${err}\n\`\`\`` });
                }
            }
        }
    }
}