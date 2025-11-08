import { Events, Interaction, MessageFlags } from "discord.js";
import { ExtendedClient } from "../../types/ExtendedClient.js";
import {  } from "fs";
import config from "../../config.json" with { type: "json" };

const cooldowns: Map<string, Map<string, number>> = new Map();

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute (interaction: Interaction, client: ExtendedClient) {
        if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isAutocomplete() && !interaction.isButton() && !interaction.isModalSubmit()) return;

        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd) return;

            if (cmd.cooldown) {
                if (!cooldowns.has(cmd.name)) {
                    cooldowns.set(cmd.name, new Map());
                }

                const now = Date.now();
                const cd = cooldowns.get(cmd.name)!;
                const cd_amount = cmd.cooldown * 1000;

                if (cd.has(interaction.user.id)) {
                    const expire_time = cd.get(interaction.user.id)! + cd_amount;

                    if (now < expire_time) {
                        const time_left = (expire_time - now) / 1000;
                        await interaction.reply({ content: `Hold on! You are way too fast! Though I am bot still need time to catch up. Please give me ${time_left.toFixed(1)}s break.`, flags: MessageFlags.Ephemeral });
                        return;
                    }
                }
                
                cd.set(interaction.user.id, now);
                setTimeout(() => cd.delete(interaction.user.id), cd_amount);
            }

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