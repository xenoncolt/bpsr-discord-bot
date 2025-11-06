import { EmbedBuilder, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { Command } from "../types/Command";
import config from "../config.json" with { type: "json" };

export default {
    name : 'report',
    description : 'Report a bug or issue with the bot',
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('report')
            .setTitle('Report a Bug or Issue')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Select a category: ')
                    .setDescription('Choose the category that best fits your report.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('report_cat')
                            .setRequired(true)
                            .setPlaceholder('Select a option...')
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Bug Report')
                                    .setValue('bug_report')
                                    .setDescription('Report a bug or issue you encountered while using the bot.'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Feature Request')
                                    .setValue('feature_request')
                                    .setDescription('Suggest a new feature or improvement for the bot.'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Other')
                                    .setValue('other')
                                    .setDescription('Any other type of report.')
                            )
                    ),
                new LabelBuilder()
                    .setLabel('Describe your issue or suggestion:')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('report_desc')
                            .setPlaceholder('Enter the details of your report here...')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(2000)
                            .setMinLength(10)
                    )
            )
        
        await interaction.showModal(modal);
    },
    async modalSubmit(interaction, client) {
        const category = interaction.fields.getStringSelectValues('report_cat') [0];
        const desc = interaction.fields.getTextInputValue('report_desc');
        const owner = client.users.cache.get(config.owner);

        if (!owner) throw new Error('Owner not found in user cache.');

        const embed = new EmbedBuilder()
            .setTitle(category === 'bug_report' ? "Bug Report" : category === 'feature_request' ? "Feature Request" : "Other Report")
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setDescription(desc)
            .setColor('Random')
            .setFooter({
                text: interaction.user.id
            })
            .setTimestamp();

        await owner.send({ embeds: [embed]});
        await interaction.reply(`Report message sent to the developer.\nYou can also create an issue [here](https://github.com/xenoncolt/bpsr-discord-bot/issues/new) Or Join [support server](${config.support_server})`);
    }
} as Command;