import { APITextInputComponent, ApplicationCommandOptionType, ChannelSelectMenuBuilder, ChannelType, GuildMember, LabelBuilder, MessageFlags, ModalBuilder, NewsChannel, PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder } from "discord.js";
import { Command } from "../types/Command.js";
import { getBossById, getBossNameId } from "../utils/bossTracker.js";
import { createBossReminderDB } from "../schema/reminderDB.js";
import { Region } from "../types/bossData.js";

let boss_id: string;
const hp_boss_reminder_db = await createBossReminderDB();

export default {
    name: "low-hp-reminder",
    description: "Set up low HP reminders for bosses.",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: 'boss_name',
            description: 'Name of the boss to set a low HP reminder for',
            required: true,
            autocomplete: true,
        }
    ],
    async execute(interaction) {
        boss_id = interaction.options.getString('boss_name') as string;

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

        const modal = new ModalBuilder()
            .setCustomId('low-hp-reminder')
            .setTitle(`Low HP Reminder Setup For ${getBossById(boss_id)?.name}`)
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Select the region: ')
                    .setDescription('Choose which region (NA or SEA) you want to receive reminders for.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('region')
                            .setPlaceholder('Select Region...')
                            .setRequired(true)
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("NA (North America)")
                                    .setValue('NA')
                                    .setDefault(true)
                                    .setDescription('Get reminders for NA server')
                                    .setEmoji('🌎'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("SEA (Southeast Asia)")
                                    .setValue('SEA')
                                    .setDefault(false)
                                    .setDescription('Get reminders for SEA server')
                                    .setEmoji('🌏')
                            )
                    ),
                new LabelBuilder()
                    .setLabel('Select the HP percentage: ')
                    .setDescription('Set the HP percentage at which you want to receive a reminder for the boss.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('hp_percent')
                            .setPlaceholder('Select HP Percentage...')
                            .setRequired(true)
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Less than 100%")
                                    .setValue('100')
                                    .setDefault(true)
                                    .setDescription('Get reminder when boss HP is between 0 to less than 100% (recommended)')
                                    .setEmoji('🐻'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Less than 75%")
                                    .setValue('75')
                                    .setDefault(false)
                                    .setDescription('Get reminder when boss HP is between 0 to less than 75%')
                                    .setEmoji('🐻'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel("Less than 50%")
                                    .setValue('50')
                                    .setDefault(false)
                                    .setDescription('Get reminder when boss HP is between 0 to less than 50% (not recommended)')
                                    .setEmoji('🐻')
                            )
                    ),
                new LabelBuilder()
                    .setLabel('Select a channel: ')
                    .setDescription('Select the channel where you want to receive the low HP reminders.')
                    .setChannelSelectMenuComponent(
                        new ChannelSelectMenuBuilder()
                            .setCustomId('boss_hp_channel')
                            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                            .setPlaceholder('Select a channel...')
                            .setRequired(true)
                    ),
                new LabelBuilder()
                    .setLabel('Select roles: ')
                    .setDescription('Select roles to mention them when sending the low HP reminder (optional)')
                    .setRoleSelectMenuComponent(
                        new RoleSelectMenuBuilder()
                            .setCustomId('boss_hp_role')
                            .setRequired(false)
                            .setPlaceholder('Select roles...')
                    )
            )

            await interaction.showModal(modal);
    },
    async autocomplete(interaction) {
        const focused_option = interaction.options.getFocused(true);
        const focused_value = focused_option.value.toLowerCase();

        let filtered_boss = getBossNameId().filter( boss => {
            return boss.name.toLowerCase().includes(focused_value);
        });

        await interaction.respond(
            filtered_boss.slice(0, 25)
        );
    },
    async modalSubmit(interaction) {
        const region = interaction.fields.getStringSelectValues('region')[0] as Region;
        const hp_percent = interaction.fields.getStringSelectValues('hp_percent')[0];
        const channel = interaction.fields.getSelectedChannels('boss_hp_channel')?.first();
        const roles = interaction.fields.getSelectedRoles('boss_hp_role');

        const bot = interaction.guild?.members.me;

        const boss = getBossById(boss_id);

        if (bot && !bot.permissionsIn(channel as TextChannel | NewsChannel).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.UseExternalEmojis])) {
            await interaction.reply({ content: `I don't have enough permission to send messages in ${channel}. Please make sure I have 'View Channel', 'Send Messages', 'Embed Links', 'Attach Files' and 'Use External Emojis' permissions in that channel.`, flags: MessageFlags.Ephemeral});
            return;
        }

        let filtered_roles;
        if (roles && roles.size > 1) {
            filtered_roles = Array.from(roles.values()).map(role => `<@&${role?.id}>`).join(',');
        } else {
            filtered_roles = roles?.first() ? `<@&${roles?.first()?.id}>` : null;
        }

        await hp_boss_reminder_db.run(`
            INSERT INTO boss_hp_reminder (mob_id, mob_name, guild_id, channel_id, role_id, hp_percent, region) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            boss_id, boss?.name, interaction.guild?.id, channel?.id, filtered_roles, hp_percent, region
        );

        await interaction.reply({ content: `Low HP reminder for boss **${boss?.name}** (${region}) has been set up successfully! You will receive a reminder in ${channel} when the boss's HP drops below ${hp_percent}%.`, flags: MessageFlags.Ephemeral});
    }
} as Command;