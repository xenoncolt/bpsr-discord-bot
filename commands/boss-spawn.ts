import { ApplicationCommandOptionType } from "discord.js";
import { Command } from "../types/Command";

export default {
    name: "boss-spawn",
    description:"Get boss spawn location and time",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "boss_name",
            description: "Name of the boss to get spawn info",
            required: true,
            autocomplete: true
        }
    ],
    async execute(interaction) {
        const bossName = interaction.options.getString('boss_name');
        
    },
    async autocomplete(interaction) {

    }
} as Command;