import { GuildMember, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { Command } from "../types/Command.js";
import { createReminderDB } from "../schema/reminderDB.js";
import { ReminderDbStruct } from "../types/dbStruct.js";
import config from "../config.json" with { type: "json" };

const db = await createReminderDB();

export default {
    name: "remove-reminder",
    description: "Remove a reminder for an in game event",
    async execute(interaction) {
        const member = interaction.member as GuildMember;

        if (!member.permissions.has([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageChannels])) {
            await interaction.reply("You don't have enough permission to use this command. You need to have 'Administrator' or 'Manage Channels' permission.");
            return;
        }

        const guild_id = interaction.guild?.id;

        if (!guild_id) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral});
            return;
        }

        const reminderList: ReminderDbStruct[] = await db.all(
            `SELECT * FROM reminder_list WHERE guild_id = ?`,
            guild_id
        );

        if (reminderList.length === 0) {
            await interaction.reply({content: "There are no reminders set up for this server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('remove-reminder')
            .setTitle('Unsubscribe from Event Reminders')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Select events: ')
                    .setDescription('Select the events you want to remove reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('rm_event_id')
                            .setMaxValues(reminderList.length)
                            .setRequired(true)
                            .setPlaceholder('Select events...')
                            .addOptions(
                                reminderList.map(rem => ({
                                    label: rem.event_id,
                                    value: rem.event_id
                                }))
                            )
                    )
            )
        
        await interaction.showModal(modal);
    },
    async modalSubmit(interaction) {
        const guild_id = interaction.guild?.id;
        const selected_events = interaction.fields.getStringSelectValues('rm_event_id');

        const is_deleted = await Promise.all(selected_events.map(async (ev) => {
            try {
                const results = await db.run(
                `DELETE FROM reminder_list WHERE guild_id = ? AND event_id = ?`,
                guild_id, ev
            )

            return (results?.changes ?? 0) > 0;
            
            } catch (err) {
                console.error(`Error deleting reminder for event ID ${ev}:`, err);
                return false;
            }
        }))

        if (is_deleted.every(del => del)) {
            await interaction.reply({content: `Successfully removed reminders for selected events.`, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({content: `Some reminders could not be removed. Please report it to [support server](${config.support_server}). `, flags: MessageFlags.Ephemeral });
        }
    },
} as Command;