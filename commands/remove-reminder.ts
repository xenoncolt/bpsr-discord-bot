import { GuildMember, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { Command } from "../types/Command.js";
import { createBossReminderDB, createReminderDB } from "../schema/reminderDB.js";
import { ReminderDbStruct } from "../types/dbStruct.js";
import config from "../config.json" with { type: "json" };
import { BossHpReminder } from "../types/bossData.js";

const db = await createReminderDB();
const boss_db = await createBossReminderDB();

let event_rem: boolean = false;
let boss_rem: boolean = false;

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

        const low_hp_reminderList: BossHpReminder[]  = await boss_db.all(`
            SELECT * FROM boss_hp_reminder WHERE guild_id = ?`, 
            guild_id
        )

        if (reminderList.length === 0 && low_hp_reminderList.length === 0) {
            await interaction.reply({content: "There are no reminders set up for this server.", flags: MessageFlags.Ephemeral });
            return;
        }

        let modal = new ModalBuilder();
            if (reminderList.length !== 0 && low_hp_reminderList.length === 0) {
                modal.setCustomId('remove-reminder')
                .setTitle('Unsubscribe from Event Reminders')
                .addLabelComponents(
                    new LabelBuilder()
                    .setLabel('Select Events: ')
                    .setDescription('Select the events you want to remove reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('rm_event_id')
                            .setMaxValues(reminderList.length)
                            .setRequired(false)
                            .setPlaceholder('Select events...')
                            .addOptions(
                                reminderList.map((rem, index) => ({
                                    label: `${rem.event_id} ${interaction.guild?.channels.cache.get(rem.channel_id)?.name}`,
                                    value: `${rem.event_id}:${rem.channel_id}${''.padEnd(index, '+')}`
                                }))
                            )
                    )
                )
                event_rem = true;
                boss_rem = false;
            }
            if (low_hp_reminderList.length !== 0 && reminderList.length === 0) {
                modal.setCustomId('remove-reminder')
                .setTitle('Unsubscribe from Event Reminders')
                .addLabelComponents(
                    new LabelBuilder()
                    .setLabel('Select Boss: ')
                    .setDescription('Select the bosses you want to remove HP reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('rm_boss_id')
                            .setMaxValues(low_hp_reminderList.length)
                            .setRequired(false)
                            .setPlaceholder('Select bosses...')
                            .addOptions(
                                low_hp_reminderList.map((rem, index )=> ({
                                    label: `${rem.mob_name} ${interaction.guild?.channels.cache.get(rem.channel_id)?.name}`,
                                    value: `${rem.mob_id}:${rem.channel_id}${''.padEnd(index, '+')}`
                                })).slice(0, 25)
                            )
                    )
                )
                boss_rem = true;
                event_rem = false;
            }

            if (reminderList.length !== 0 && low_hp_reminderList.length !== 0) {
                modal.setCustomId('remove-reminder')
                .setTitle('Unsubscribe from Reminders')
                .addLabelComponents(
                    new LabelBuilder()
                    .setLabel('Select Events: ')
                    .setDescription('Select the events you want to remove reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('rm_event_id')
                            .setMaxValues(reminderList.length)
                            .setRequired(false)
                            .setPlaceholder('Select events...')
                            .addOptions(
                                reminderList.map((rem, index) => ({
                                    label: `${rem.event_id} ${interaction.guild?.channels.cache.get(rem.channel_id)?.name}`,
                                    value: `${rem.event_id}:${rem.channel_id}${''.padEnd(index, '+')}`
                                }))
                            )
                    ),
                    new LabelBuilder()
                    .setLabel('Select Boss: ')
                    .setDescription('Select the bosses you want to remove HP reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('rm_boss_id')
                            .setMaxValues(low_hp_reminderList.length)
                            .setRequired(false)
                            .setPlaceholder('Select bosses...')
                            .addOptions(
                                low_hp_reminderList.map((rem, index) => ({
                                    label: `${rem.mob_name} ${interaction.guild?.channels.cache.get(rem.channel_id)?.name}`,
                                    value: `${rem.mob_id}:${rem.channel_id}${''.padEnd(index, '+')}`
                                })).slice(0, 25)
                            )
                    )
                )
                boss_rem = true;
                event_rem = true;
            } 
        
        await interaction.showModal(modal);
    },
    async modalSubmit(interaction) {
        const guild_id = interaction.guild?.id;
        let selected_events: string[] | null = null;
        let selected_bosses: string[] | null = null;

        if (event_rem) {
            selected_events = interaction.fields.getStringSelectValues('rm_event_id') as string[] | null;
        }

        if (boss_rem) {
            selected_bosses = interaction.fields.getStringSelectValues('rm_boss_id') as string[] | null;
        }

        let is_deleted_event: boolean[] = [];
        let is_deleted_boss: boolean[] = [];

        if (!selected_events && !selected_bosses) {
            await interaction.reply({content: `No events or bosses were selected for removal.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (selected_events) {
            is_deleted_event = await Promise.all(selected_events.map(async (ev) => {
                try {
                    const results = await db.run(
                        `DELETE FROM reminder_list WHERE guild_id = ? AND event_id = ?`,
                        guild_id, ev.split(':')[0]
                    )

                    return (results?.changes ?? 0) > 0;

                } catch (err) {
                    console.error(`Error deleting reminder for event ID ${ev}:`, err);
                    return false;
                }
            }))
        }

        if (selected_bosses) {
            is_deleted_boss = await Promise.all(selected_bosses.map(async (boss) => {
                try {
                    const results = await boss_db.run(
                        `DELETE FROM boss_hp_reminder WHERE guild_id = ? AND mob_id = ?`,
                        guild_id, boss.split(':')[0]
                    )
                    return (results.changes ?? 0) > 0;
                } catch (err) {
                    console.error(`Error deleting boss HP reminder for boss ID ${boss}:`, err);
                    return false;
                }
            }))
        }


        if (is_deleted_event.every(del => del) || is_deleted_boss.every(del => del)) {
            await interaction.reply({content: `Successfully removed reminders for selected events.`, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({content: `Some reminders could not be removed. Please report it to [support server](${config.support_server}). `, flags: MessageFlags.Ephemeral });
        }
    },
} as Command;