import PocketBase from 'pocketbase';
import { EventSource } from 'eventsource';
import config from "../config.json" with { type: "json" };
import { BossHpReminder, Mob, MobChannel } from '../types/bossData.js';
import { createBossReminderDB } from '../schema/reminderDB.js';
import { Client, ContainerBuilder, GuildMember, Message, MessageFlags, NewsChannel, SeparatorBuilder, SeparatorSpacingSize, TextChannel, TextDisplayBuilder } from 'discord.js';

global.EventSource = EventSource;

const pb = new PocketBase(config.bptimer_api_url);

let client: Client;

const boss_hp_reminder_db = await createBossReminderDB();
const sentNuke = new Set<string>();
const hp_msg = new Map<string, Message>();

const msg_timestamp = new Map<string, number>();
const cleanup_timeouts = new Map<string, NodeJS.Timeout>();

let mobs_cache: Map<string, Mob> = new Map();
let mob_channel_cache: Map<string, MobChannel> = new Map();

export async function initBossTracker(_client: Client) {
    console.log("Started Tracker...");
    
    client = _client;

    try {
        const mobs = await pb.collection('mobs').getFullList<Mob>();
        mobs.forEach(mob => mobs_cache.set(mob.id, mob));

        console.log(`Cached ${mobs_cache.size} mobs.`);

        const mobChannels = await pb.collection('mob_channel_status').getFullList<MobChannel>();
        mobChannels.forEach( mc => mob_channel_cache.set(mc.id, mc));
        console.log(`Cached ${mob_channel_cache.size} mob channels.`);
        
        await subsToApi();

        startMsgCleanup();
    } catch (err) {
        console.error("Error initializing Boss Tracker:", err);
        throw err;
    }
}

async function subsToApi() {
    pb.collection('mob_channel_status').subscribe('*', async (e) => {
        const mobChannel = e.record as MobChannel;

        if (e.action === 'create' || e.action === 'update') {
            const old_status = mob_channel_cache.get(mobChannel.id);
            mob_channel_cache.set(mobChannel.id, mobChannel);
            // console.log(`Mob Channel updated: ${mobChannel.collectionName} (${mobChannel.id})`);

            if (old_status && old_status.last_hp !== mobChannel.last_hp) {
                await checkHpReminder(mobChannel, old_status);
                // console.log(`Mob Channel HP changed: ${mobChannel.collectionName} (${mobChannel.id}) from ${old_status.last_hp}% to ${mobChannel.last_hp}%`);
            }
        } else if (e.action === 'delete') {
            mob_channel_cache.delete(mobChannel.id);
        }
    });

    pb.collection('mobs').subscribe('*', (e) => {
        const mob = e.record as Mob;

        if (e.action === 'create' || e.action === 'update') {
            mobs_cache.set(mob.id, mob);
            // console.log(`Mob updated: ${mob.name} (${mob.id})`);
        } else if (e.action === 'delete') {
            mobs_cache.delete(mob.id);
        }
    });

    console.log("subscribed to PocketBase collections.");
}

export function getAllBoss(): Mob[] {
    return Array.from(mobs_cache.values()).filter(mob => mob.type === 'boss');
}

export function getBossNameId(): {name: string, value: string}[] {
    return Array.from(mobs_cache.values()).filter(
        mob => mob.type === 'boss'
    ).map(mob => ({
        name: mob.name,
        value: mob.id
    }));
}

export function getBossById(mob_id: string): Mob | undefined {
    return mobs_cache.get(mob_id);
}

// all mob name and id

// export function getBossAliveChannels(mob_id: string): MobChannel[] {
//     return Array.from(mob_channel_cache.values()).filter(
//         mc => mc.mob === mob_id && mc.last_hp > 0
//     );
// }

// export function getBossDeadLines(mob_id: string): MobChannel[] {
//     return Array.from(mob_channel_cache.values()).filter(
//         mc => mc.mob === mob_id && mc.last_hp === 0
//     );
// }

export function getBossLines(mob_id: string): MobChannel[] {
    return Array.from(mob_channel_cache.values()).filter(
        mc => mc.mob === mob_id
    );
}



// which boss spawn time has 0 they will be spawn in 12:00, 1:00, 2:00 etc (every hour)
// which boss spawn time has 30 they will be spawn in 12:30, 1:30, 2:30 etc (every hour)
// return unix timestamp
export function getNextSpawnTime(mob: Mob): number {
    const now = new Date();
    const spawn_time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), mob.respawn_time, 0, 0);

    if (spawn_time.getTime() > now.getTime()) {
        return Math.floor(spawn_time.getTime() / 1000);
    } else {
        spawn_time.setHours(spawn_time.getHours() + 1);
        return Math.floor(spawn_time.getTime() / 1000);
    }
} 



export async function stopBossTracking() {
    pb.collection('mob_channel_status').unsubscribe();
    pb.collection('mobs').unsubscribe();
    console.log("Unsubscribed from PocketBase collections.");

    cleanup_timeouts.forEach(timeout => clearTimeout(timeout));
    cleanup_timeouts.clear();
}



async function checkHpReminder(mob_line: MobChannel, old_status: MobChannel) {
    try {
        const boss_reminders = await boss_hp_reminder_db.all<BossHpReminder[]>(`
            SELECT * FROM boss_hp_reminder WHERE mob_id = ?`, mob_line.mob
        );

        const mob = mobs_cache.get(mob_line.mob);

        if (!mob) return;

        for (const reminder of boss_reminders) {
            const hp_threshold = reminder.hp_percent;
            const current_hp = mob_line.last_hp;
            const pre_hp = old_status.last_hp;

            // console.log(reminder);

            // target is:
            // Current hp is below threshold
            // Previous hp is above threshold
            // new update look for hp drop and boom send nuke 
            const nuke = current_hp < hp_threshold && current_hp > 0;

            const msg_key = `${reminder.id}_${mob_line.channel_number}`;
            const nuke_key =  `${reminder.id}_${mob_line.channel_number}_${Math.floor(current_hp / 10)}`;

            if (nuke) {
                const exist_msg = hp_msg.get(msg_key);

                if (exist_msg) {
                    try {
                        await updateMsg(exist_msg, reminder, mob, mob_line);

                        msg_timestamp.set(msg_key, Date.now());
                    } catch (err) {
                        try {
                            if (exist_msg.deletable) {
                                await exist_msg.delete();
                            }
                        } catch (e) {
                            console.log("Error while deleting failed msg update:", e);
                        }

                        hp_msg.delete(msg_key);
                        msg_timestamp.delete(msg_key);
                        const timeout = cleanup_timeouts.get(msg_key);
                        if (timeout) {
                            clearTimeout(timeout);
                            cleanup_timeouts.delete(msg_key);
                        }
                        console.error("Failed to update the msg and removing from cache", err);
                    }
                    // console.log(`Updated HP reminder message for ${mob.name} in Line ${mob_line.channel_number} at ${current_hp}% HP.`);
                } else if (!sentNuke.has(nuke_key)) {
                    const sent_msg = await sendHpReminder(reminder, mob, mob_line);
                    if (sent_msg) {
                        hp_msg.set(msg_key, sent_msg);
                        msg_timestamp.set(msg_key, Date.now());
                        scheduleMsgExpire(msg_key, sent_msg);
                        sentNuke.add(nuke_key);
                    }
                    // console.log(`Sent HP reminder for ${mob.name} in Line ${mob_line.channel_number} at ${current_hp}% HP.`);
                    

                    setTimeout(async () => {
                        sentNuke.delete(nuke_key);
                    }, 10 * 60 * 1000)
                }
            }
            
            if ((current_hp === 100 && pre_hp < 100 ) || current_hp === 0) {
                const exist_msg = hp_msg.get(msg_key);

                if (exist_msg ) {
                    if (current_hp === 0) {
                        try {
                            await updateMsg(exist_msg, reminder, mob, mob_line, true);
                            // wait 5 min then delete that msg if dead
                            setTimeout(async () => {
                                try {
                                    if (hp_msg.get(msg_key) === exist_msg && exist_msg.deletable) {
                                        await exist_msg.delete();
                                    }
                                } catch (err) {
                                    console.error("Error deleting dead message:", err);
                                }

                                hp_msg.delete(msg_key);
                                msg_timestamp.delete(msg_key);
                                const timeout = cleanup_timeouts.get(msg_key);
                                if (timeout) {
                                    clearTimeout(timeout);
                                    cleanup_timeouts.delete(msg_key);
                                }
                            }, 2 * 60 * 1000);
                        } catch (err) {
                            console.error("Error updating dead HP reminder message:", err);
                            try {
                                if (exist_msg.deletable) {
                                    await exist_msg.delete();
                                }
                                hp_msg.delete(msg_key);
                                msg_timestamp.delete(msg_key);
                                const timeout = cleanup_timeouts.get(msg_key);
                                if (timeout) {
                                    clearTimeout(timeout);
                                    cleanup_timeouts.delete(msg_key);
                                }
                            } catch (e) {
                                console.error("Error deleting dead HP reminder message after failed update:", e);
                            }
                        }
                    } else {
                        try {
                            if (exist_msg.deletable) {
                                await exist_msg.delete();
                            }
                            hp_msg.delete(msg_key);
                            msg_timestamp.delete(msg_key);
                            const timeout = cleanup_timeouts.get(msg_key);
                            if (timeout) {
                                clearTimeout(timeout);
                                cleanup_timeouts.delete(msg_key);
                            }
                        }catch (err) {
                            console.error("Error deleting full HP reminder message:", err);
                        }
                    }
                }

                hp_msg.delete(msg_key);
                msg_timestamp.delete(msg_key);
                const timeout = cleanup_timeouts.get(msg_key);
                if (timeout) {
                    clearTimeout(timeout);
                    cleanup_timeouts.delete(msg_key);
                }

                Array.from(sentNuke).forEach( key => {
                    if (key.startsWith(`${reminder.id}_${mob_line.channel_number}_`)) {
                        sentNuke.delete(key);
                    }
                });
            }
        }
    } catch (err) {
        console.error("Error checking HP reminder:", err);
        await client.users.cache.get(config.owner)?.send(`Error checking HP reminder for mob channel ${mob_line.collectionName} (${mob_line.id}): ${err}`);
    }
}

async function sendHpReminder(reminder: BossHpReminder, mob: Mob, mob_line: MobChannel) {
    // try {
        const channel = client.channels.cache.get(reminder.channel_id) as TextChannel | NewsChannel;

        if (!channel || !channel.isTextBased()) {
            console.error(`Channel not found or is not text-based: ${reminder.channel_id}`);
            await boss_hp_reminder_db.run('DELETE FROM boss_hp_reminder WHERE id = ?', reminder.id);
            return;
        }

        const role_mention = reminder.role_id ? ` ${reminder.role_id} - ` : '';
        const hp_bar = generateHpBar(mob_line.last_hp);

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`${role_mention}${mob.name} - Line ${mob_line.channel_number} - ${mob_line.last_hp}% HP`)
        )
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`HP: ${hp_bar}`)
        )
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )

        const msg = await channel.send(
            {
                components: [container],
                flags: [MessageFlags.IsComponentsV2]
            }
        )

        return msg;

        // await channel.send(`**${mob.name}** in **Line ${mob_line.channel_number}** is now at **${mob_line.last_hp}% HP**!${role_mention}`);
        // console.log(`Sent HP reminder for ${mob.name} in channel ${channel.id} at ${mob_line.last_hp}% HP.`);
    // } catch (err) {
    //     console.error("Error sending HP reminder:", err);
    //     await client.users.cache.get(config.owner)?.send(`Error sending HP reminder for mob ${mob.name} in channel ${reminder.channel_id}: ${err}`);
    // }
}



async function updateMsg(msg: Message, reminder: BossHpReminder, mob: Mob, mob_line: MobChannel, dead: boolean = false) {
    try {
        const role_mention = reminder.role_id ? ` ${reminder.role_id} - ` : '';
        const hp_bar = generateHpBar(mob_line.last_hp);
        
        let header_content: string;
        let hp_bar_content : string;

        if (dead) {
            header_content = `${role_mention}${mob.name} - Line ${mob_line.channel_number} - Dead`
            hp_bar_content = `HP: ${hp_bar}`;
        } else {
            header_content = `${role_mention}${mob.name} - Line ${mob_line.channel_number} - ${mob_line.last_hp}% HP`;
            hp_bar_content = `HP: ${hp_bar}`;
        }
        
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(header_content)
        )

        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(hp_bar_content)
        )

        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )

        await msg.edit({
            components: [container],
            flags: [MessageFlags.IsComponentsV2]
        })
        // // wait 5 min then delete that msg if dead
        // if (dead) {
        //     if (msg.deletable) {
        //         setTimeout(async () => {
        //             try {
        //                 await msg.delete();
        //             } catch (err) {
        //                 console.error("Error deleting HP reminder message:", err);
        //             }
        //         }, 2 * 60 * 1000);
        //     } else {
        //         msg.edit({ content: `${msg.content}\n(Note: I don't have permission to delete this message.) Please add me again to server or give me \`Manage Messages\` permission` });
        //     }
        // }
    } catch (err) {
        console.error("Error updating HP reminder message:", err);
        // await client.users.cache.get(config.owner)?.send(`Error updating HP reminder message for mob ${mob.name} in channel ${reminder.channel_id}: ${err}`);
    }
}

function generateHpBar(hp: number): string {
    const filled_blocks = Math.ceil((hp / 100) * 12);
    const empty_blocks = 12 - filled_blocks;
    let color = '🟩';
    if (hp < 50 && hp >= 25) color = '🟨';
    if (hp < 25) color = '🟧';
    if (hp === 0) return '🟥'.repeat(12);
    return color.repeat(filled_blocks) + '⬛'.repeat(empty_blocks);
}

function startMsgCleanup() {
    setInterval(async () => {
        const now = Date.now();
        const stale_msg: string[] = [];

        msg_timestamp.forEach((time, msg_key) => {
            if (now - time > 30 * 60 * 1000) {
                stale_msg.push(msg_key);
            }
        });

        for (const msg_key of stale_msg) {
            const msg = hp_msg.get(msg_key);
            if (msg) {
                try {
                    if (msg.deletable) {
                        await msg.delete();
                    }
                } catch (err) {
                    console.error("Error deleting HP reminder message:", err);
                }
            }

            hp_msg.delete(msg_key);
            msg_timestamp.delete(msg_key);
            
            const timeout = cleanup_timeouts.get(msg_key);
            if (timeout) {
                clearTimeout(timeout);
                cleanup_timeouts.delete(msg_key);
            }
        }

        if (stale_msg.length > 0) {
            console.log(`cleaned up ${stale_msg.length} msgs`);
        }
    }, 5 * 60 * 1000);
}

function scheduleMsgExpire(msg_key: string, msg: Message) {
    const existing_timeout = cleanup_timeouts.get(msg_key);
    if (existing_timeout) {
        clearTimeout(existing_timeout);
    }

    const timeout = setTimeout(async () => {
        try {
            if (msg.deletable) {
                await msg.delete();
            }
        } catch (err) {
            console.error("Error deleting HP reminder message:", err);
        }

        hp_msg.delete(msg_key);
        msg_timestamp.delete(msg_key);
        cleanup_timeouts.delete(msg_key);
    }, 30 * 60 * 1000);

    cleanup_timeouts.set(msg_key, timeout);
}