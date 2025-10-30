import { ApplicationCommandOptionType, AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import axios, {  } from "axios";
import config from "../config.json" with { type: "json" };
import { Event } from "../types/bpsrEvents.js";
import { Command } from "../types/Command.js";
import { createReminderDB } from "../schema/reminderDB.js";

const reminderDB = await createReminderDB();

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
        {
            type: ApplicationCommandOptionType.Channel,
            name: "channel",
            description: "The channel to send the reminder in",
            required: true,
            channel_types: ChannelType.GuildText | ChannelType.GuildAnnouncement,
        },
        {
            type: ApplicationCommandOptionType.Role,
            name: "role",
            description: "The role to mention when sending the reminder",
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Boolean,
            name: "custom_description",
            description: "Whether to use a custom description for the reminder",
            required: false,
        }
    ],
    async execute(interaction: ChatInputCommandInteraction) : Promise<void> {
        const eventId = interaction.options.getString('event_id');
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const isDesc = interaction.options.getBoolean('custom_description');

        if (isDesc) {
            const modal = new ModalBuilder()
            .setCustomId('event_desc')
            .setTitle('Custom Event Description')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Write your custom description for the event reminder:')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId(`cus_desc`)
                            .setPlaceholder('Enter your custom description here')
                            .setRequired(isDesc ? true : false)
                            .setStyle(TextInputStyle.Paragraph)
                    )
            );

            await interaction.showModal(modal);
        }
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
    async modalSubmit(interaction){
        const custom_desc = interaction.fields.getTextInputValue('cus_desc');


    }
} as Command;