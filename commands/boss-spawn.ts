import { ApplicationCommandOptionType, AttachmentBuilder, ContainerBuilder, ContainerComponent, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, TextDisplayComponent, ThumbnailBuilder } from "discord.js";
import { Command } from "../types/Command";
import { getBossById, getBossLines, getBossNameId, getNextSpawnTime } from "../utils/bossTracker.js";
import { Mob } from "../types/bossData";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import config from "../config.json" with { type: "json" };

const BOSS_IMG_FOLDER = join(process.cwd(), 'img', 'boss');
const MAP_IMG_FOLDER = join(process.cwd(), 'img', 'maps');

export default {
    name: "boss-spawn",
    description:"Get boss spawn location and time",
    cooldown: 60,
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
        const bossName = interaction.options.getString('boss_name') as string;

        const owner = interaction.client.users.cache.get(config.owner);

        const bossData = getBossById(bossName);
        if (!bossData) {
            await interaction.reply({ content: 'Boss not found.', flags: MessageFlags.Ephemeral });
            return;
        }

        const container = new ContainerBuilder();

        // title
        // container.addTextDisplayComponents(
        //     new TextDisplayBuilder()
        //         .setContent(`# ${bossData.name}`)
        // );

        // container.addSeparatorComponents(
        //     new SeparatorBuilder()
        //         .setDivider(true)
        //         .setSpacing(SeparatorSpacingSize.Small)
        // );

        const boss_img = findBossImg(bossData.name);
        if (!boss_img) {
            owner?.send({ content: `Boss image not found for ${bossData.name}` });
        }
        const boss_img_name = `boss-${bossData.name.replace(/\s+/g, '_').toLowerCase()}.png`;
        const boss_img_path = join(BOSS_IMG_FOLDER, boss_img as string);
        const boss_attachment: AttachmentBuilder[] = [new AttachmentBuilder(boss_img_path, { name: boss_img_name })];

        // time
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`# ${bossData.name}`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`### Spawn Time: <t:${getNextSpawnTime(bossData)}:R>`)
                ).setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(`attachment://${boss_img_name}`)
                )
        );

        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        );

        // line
        const boss_lines = getBossLines(bossData.id);
        // const alive_line_txt = alive_lines.map( line => 
        //     `\`${line.channel_number}\``
        // ).join(' ') || "No alive spawn detected.";

        let alive_line_txt = "```ansi\n";

        const formatted_lines: string[] = [];

        for (let i = 0; i < boss_lines.length; i+=7) {
            const row_items = boss_lines.slice(i, i+7).map( line => {
                const line_num = line.channel_number.toString().padStart(3, ' ');
                const ansi_code = line.last_hp > 0 ? '[2;32m' : '[2;31m'; // 32 = green, 31 = red
                return `${ansi_code}${line_num}[0m`
            });

            formatted_lines.push(row_items.join('   '));
        }

        alive_line_txt += formatted_lines.join('\n') + '```';

        // if (alive_lines.length === 0) {
        //     alive_line_txt = "No alive spawn detected.";
        // } 
        //else {
        //     const line_txt = alive_lines.map ( line => `\`${line.channel_number}\``);

        //     const formatted_txt: string[] = [];
        //     for (let i = 0; i < alive_lines.length; i += 20) {
        //         formatted_txt.push(line_txt.slice(i, i + 20).join(' '));
        //     }

        //     alive_line_txt = formatted_txt.join('\n');
        // }
//         let txt = `\`\`\`ansi
// [2;32m1[0m    [2;32m2[0m    [2;32m3[0m    [2;32m4[0m    [2;32m5[0m    [2;32m6[0m    [2;32m7[0m    [2;32m8[0m    [2;32m9[0m
// [2;31m10[0m   [2;31m11[0m   [2;31m12[0m   [2;31m13[0m   [2;31m14[0m   [2;31m15[0m   [2;32m16[0m   [2;31m17[0m   [2;32m18[0m
// [2;32m19[0m   [2;32m20[0m   [2;32m21[0m   [2;32m22[0m   [2;32m23[0m   [2;32m24[0m   [2;31m25[0m   [2;31m26[0m   [2;31m27[0m
// [2;31m28[0m   [2;31m29[0m   [2;31m30[0m   [2;32m31[0m   [2;31m32[0m   [2;32m33[0m   [2;32m34[0m   [2;32m35[0m   [2;32m36[0m
// [2;32m37[0m   [2;32m38[0m   [2;32m39[0m   [2;31m40[0m   [2;31m41[0m   [2;31m42[0m   [2;31m43[0m   [2;31m44[0m   [2;31m45[0m
// [2;32m46[0m   [2;31m47[0m   [2;32m48[0m   [2;32m49[0m   [2;32m50[0m   [2;32m51[0m   [2;32m52[0m   [2;32m53[0m   [2;32m54[0m
// [2;31m55[0m   [2;31m56[0m   [2;31m57[0m   [2;31m58[0m   [2;31m59[0m   [2;31m60[0m   [2;32m61[0m   [2;31m62[0m   [2;32m63[0m
// [2;32m64[0m   [2;32m65[0m   [2;32m66[0m   [2;32m67[0m   [2;32m68[0m   [2;32m69[0m   [2;31m70[0m   [2;31m71[0m   [2;31m72[0m
// [2;31m73[0m   [2;31m74[0m   [2;31m75[0m   [2;32m76[0m   [2;31m77[0m   [2;32m78[0m   [2;32m79[0m   [2;32m80[0m   [2;32m81[0m
// [2;32m82[0m   [2;32m83[0m   [2;32m84[0m   [2;31m85[0m   [2;31m86[0m   [2;31m87[0m   [2;31m88[0m   [2;31m89[0m   [2;31m90[0m
// [2;32m91[0m   [2;31m92[0m   [2;32m93[0m   [2;32m94[0m   [2;32m95[0m   [2;32m96[0m   [2;32m97[0m   [2;32m98[0m   [2;32m99[0m
// [2;31m100[0m  [2;31m101[0m  [2;31m102[0m  [2;31m103[0m  [2;31m104[0m  [2;31m105[0m  [2;32m106[0m  [2;31m107[0m  [2;32m108[0m
// [2;32m109[0m  [2;32m110[0m  [2;32m111[0m  [2;32m112[0m  [2;32m113[0m  [2;32m114[0m  [2;31m115[0m  [2;31m116[0m  [2;31m117[0m
// [2;31m118[0m  [2;31m119[0m  [2;31m120[0m  [2;32m121[0m  [2;31m122[0m  [2;32m123[0m  [2;32m124[0m  [2;32m125[0m  [2;32m126[0m
// [2;32m127[0m  [2;32m128[0m  [2;32m129[0m  [2;31m130[0m  [2;31m131[0m  [2;31m132[0m  [2;31m133[0m  [2;31m134[0m  [2;31m135[0m
// [2;32m136[0m  [2;31m137[0m  [2;32m138[0m  [2;32m139[0m  [2;32m140[0m  [2;32m141[0m  [2;32m142[0m  [2;32m143[0m  [2;32m144[0m
// [2;31m145[0m  [2;31m146[0m  [2;31m147[0m  [2;31m148[0m  [2;31m149[0m  [2;31m150[0m
// \`\`\``;

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`${alive_line_txt}\n\nLast Update: <t:${Math.floor(((new Date(boss_lines[boss_lines.length - 1].last_update).getTime()) / 1000))}:R>\n\n-# Note: Boss spawn line may not accurate if no one report the boss\n-# spawn/death. Information Collected from BPTimer.com`)
            );
        const map_img = findMapImg(bossData.name);
        if (!map_img) {
            owner?.send({ content: `Map image not found for ${bossData.name}` });
        }
        const map_img_name = `map-${bossData.name.replace(/\s+/g, '_').toLowerCase()}.png`;
        const map_img_path = join(MAP_IMG_FOLDER, map_img as string);
        const map_attachment: AttachmentBuilder[] = [new AttachmentBuilder(map_img_path, { name: map_img_name })];

        container.addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(`attachment://${map_img_name}`)
                )
        );

        // container.addSectionComponents(title_section).addSeparatorComponents(
        //     new SeparatorBuilder()
        //         .setDivider(true)
        //         .setSpacing(SeparatorSpacingSize.Small)
        // ).addSectionComponents(time_section).addSeparatorComponents(
        //     new SeparatorBuilder()
        //         .setDivider(true)
        //         .setSpacing(SeparatorSpacingSize.Small)
        // ).addSectionComponents(line_section).addMediaGalleryComponents(
        //     new MediaGalleryBuilder()
        //         .addItems(
        //             new MediaGalleryItemBuilder()
        //                 .setURL(`attachment://${map_img_name}`)
        //         )
        // );

        // Not gonna use ephemeral .... if annoying and report then i will :3 bussiness logic :)
        await interaction.reply({
            components: [container],
            flags: [MessageFlags.IsComponentsV2],
            files: [...boss_attachment, ...map_attachment]
        })
       
    },
    async autocomplete(interaction) {
        const focused_option = interaction.options.getFocused(true);
        const focused_value = focused_option.value.toLowerCase();

        let filtered_boss = getBossNameId().filter( boss => {
            return boss.name.toLowerCase().includes(focused_value);
        });

        await interaction.respond(
            filtered_boss.slice(0, 25)
            // .map( boss => (
            //     {
            //         name: boss.name,
            //         value: boss.value
            //     }
            // ))
        );
    }
} as Command;

function findBossImg(boss_name: string) {
    try {
        if (!existsSync(BOSS_IMG_FOLDER)) {
            console.warn(`Boss image folder not found: ${BOSS_IMG_FOLDER}`);
            return null;
        }

        const files = readdirSync(BOSS_IMG_FOLDER);
        const img_ext = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

        const match_img = files.find( file => {
            const valid_ext = img_ext.some( ext => file.toLowerCase().endsWith(ext));
            const match_boss_name = file.toLowerCase().startsWith(boss_name.toLowerCase().trim().replace(/\s+/g, '_'));
            return valid_ext && match_boss_name;
        });

        return match_img || null;
    } catch (e) {
        console.error(`Error finding boss image: ${boss_name} -> ${e}`);
        return null;
    }
}

function findMapImg(map_name: string) {
    try {
        if (!existsSync(MAP_IMG_FOLDER)) {
            console.warn(`Map image folder not found: ${MAP_IMG_FOLDER}`);
            return null;
        }
        const files = readdirSync(MAP_IMG_FOLDER);
        const img_ext = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

        const match_img = files.find( file => {
            const valid_ext = img_ext.some( ext => file.toLowerCase().endsWith(ext));
            const match_map_name = file.toLowerCase().startsWith(map_name.toLowerCase().trim().replace(/\s+/g, '_'));
            return valid_ext && match_map_name;
        });

        return match_img || null;
    } catch (e) {
        console.error(`Error finding map image: ${map_name} -> ${e}`);
        return null;
    }
}