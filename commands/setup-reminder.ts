import { ApplicationCommandOptionType, AutocompleteInteraction, ChannelSelectMenuBuilder, ChannelType, ChatInputCommandInteraction, GuildMember, LabelBuilder, MessageFlags, ModalBuilder, NewsChannel, PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle } from "discord.js";
import axios, {  } from "axios";
import config from "../config.json" with { type: "json" };
import { Event } from "../types/bpsrEvents.js";
import { Command } from "../types/Command.js";
import { createReminderDB } from "../schema/reminderDB.js";

const reminderDB = await createReminderDB();

let eventId: string;

export default {
    name: "setup-reminder",
    description: "Setup a reminder for an in game event",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "event_id",
            description: "The ID of the event to set a reminder for",
            required: true,
            autocomplete: true,
        },
    //     {
    //         type: ApplicationCommandOptionType.Channel,
    //         name: "channel",
    //         description: "The channel to send the reminder in",
    //         required: true,
    //         channel_types: ChannelType.GuildText | ChannelType.GuildAnnouncement,
    //     },
    //     {
    //         type: ApplicationCommandOptionType.Role,
    //         name: "role",
    //         description: "The role to mention when sending the reminder",
    //         required: false,
    //     },
    //     {
    //         type: ApplicationCommandOptionType.Boolean,
    //         name: "custom_description",
    //         description: "Whether to use a custom description for the reminder",
    //         required: false,
    //     }
    ],
    async execute(interaction: ChatInputCommandInteraction) : Promise<void> {
        eventId = interaction.options.getString('event_id') as string;
        const member = interaction.member as GuildMember;

        const guild_id = interaction.guild?.id;

        if (!guild_id) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral});
            return;
        }

        if (!member.permissions.has([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageChannels])) {
            await interaction.reply("You don't have enough permission to use this command. You need to have 'Administrator' or 'Manage Channels' permission.");
            return;
        }
        // const channel = interaction.options.getChannel('channel');
        // const role = interaction.options.getRole('role');
        // const isDesc = interaction.options.getBoolean('custom_description');

        // if (isDesc) {
        //     const modal = new ModalBuilder()
        //     .setCustomId('event_desc')
        //     .setTitle('Custom Event Description')
        //     .addLabelComponents(
        //         new LabelBuilder()
        //             .setLabel('Write your custom description for the event reminder:')
        //             .setTextInputComponent(
        //                 new TextInputBuilder()
        //                     .setCustomId(`cus_desc`)
        //                     .setPlaceholder('Enter your custom description here')
        //                     .setRequired(isDesc ? true : false)
        //                     .setStyle(TextInputStyle.Paragraph)
        //             )
        //     );

        //     await interaction.showModal(modal);
        // }

        // const response = await axios.get(config.api_url);
        // const events_list: Event[] = response.data.events;

        // const DB_event_id = await reminderDB.get(`SELECT * FROM reminder_list WHERE event_id = ?`, eventId);
        // if (DB_event_id) {
        //     await interaction.reply({ content: ``})
        // }

        const modal = new ModalBuilder()
            .setCustomId('setup-reminder')
            .setTitle('Setup Reminder')
            // .addLabelComponents(
            //     new LabelBuilder()
            //         .setLabel('Select a Event:')
            //         .setDescription('You can type to search for event. Here only 25 results are shown')
            //         .setStringSelectMenuComponent(
            //             new StringSelectMenuBuilder()
            //                 .setCustomId('event_id')
            //                 .setPlaceholder('Select an event...')
            //                 .setRequired(true)
            //                 .setMinValues(1)
            //                 .setMaxValues(2)
            //                 .addOptions(
            //                     events_list.slice(0, 25).map( ev =>
            //                         new StringSelectMenuOptionBuilder()
            //                             .setLabel(ev.name)
            //                             .setValue(ev.id)
            //                             .setDescription(ev.description.length > 50 ? ev.description.substring(0, 47) + '...' : ev.description)
            //                     )
            //                 )
            //         )
            // )
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Select a channel to send notice:')
                    .setChannelSelectMenuComponent(
                        new ChannelSelectMenuBuilder()
                            .setCustomId('rem_channel')
                            // .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                            .setPlaceholder('Select a channel...')
                            .setRequired(true)
                    )
            )
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Select roles:')
                    .setDescription('Select roles to mention them when sending the reminder (optional)')
                    .setRoleSelectMenuComponent(
                        new RoleSelectMenuBuilder()
                            .setCustomId('rem_role')
                            .setRequired(false)
                            .setPlaceholder('Select roles...')
                    )
            )
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Custom Message:')
                    .setDescription('Write your custom Message for the event reminder (optional)')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('cus_desc')
                            .setPlaceholder('Enter your custom Message here')
                            .setRequired(false)
                            .setStyle(TextInputStyle.Paragraph)
                    )
            )

            await interaction.showModal(modal);
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        const focused_option = interaction.options.getFocused(true);
        const response = await axios.get(config.api_url);
        const events_list: Event[] = response.data.events;

        const focused_value = focused_option.value.toLowerCase();

        let filtered_events: Event[] = events_list.filter( ev => {
            const id = ev.id;
            return id && id.trim().toLowerCase().includes(focused_value);
        })

        await interaction.respond(
            filtered_events.slice(0, 25).map( ev => ({
                name: ev.name,
                value: ev.id
            }))
        );
    },
    async modalSubmit(interaction) {
        const rem_channel = interaction.fields.getSelectedChannels('rem_channel')?.first();
        const rem_roles = interaction.fields.getSelectedRoles('rem_role');
        const custom_desc = interaction.fields.getTextInputValue('cus_desc');

        // bot user member.self
        const bot = interaction.guild?.members.me;

        if (bot && !bot.permissionsIn(rem_channel as TextChannel | NewsChannel).has([[PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.UseExternalEmojis]])) {
            await interaction.reply({ content: `I don't have enough permission to send messages in ${rem_channel}. Please make sure I have 'View Channel', 'Send Messages', 'Embed Links', 'Attach Files' and 'Use External Emojis' permissions in that channel.`, flags: MessageFlags.Ephemeral});
            return;
        }
        
        let filtered_roles;
        if (rem_roles && rem_roles.size > 1) {
            filtered_roles = Array.from(rem_roles.values()).map(role => `<@&${role?.id}>`).join(',');
        } else {
            filtered_roles = rem_roles?.first() ? `<@&${rem_roles?.first()?.id}>` : null;
        }

        await reminderDB.run(`
            INSERT INTO reminder_list (event_id, guild_id, channel_id, role_id, custom_description) VALUES (?, ?, ?, ?, ?)`, 
            eventId, interaction.guild?.id, rem_channel?.id, filtered_roles, custom_desc ? custom_desc : null
        );

        await interaction.reply({ content: `Reminder has been set up for event **${eventId}** in channel ${rem_channel} ${filtered_roles ? `mentioning roles: ${filtered_roles}` : ``} ${custom_desc ? `with custom description: ${custom_desc}` : ``}`, flags: MessageFlags.Ephemeral});
    }
} as Command;