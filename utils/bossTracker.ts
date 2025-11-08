import PocketBase from 'pocketbase';
import { EventSource } from 'eventsource';
import config from "../config.json" with { type: "json" };
import { Mob, MobChannel } from '../types/bossData.js';

global.EventSource = EventSource;

const pb = new PocketBase(config.bptimer_api_url);

let mobs_cache: Map<string, Mob> = new Map();
let mob_channel_cache: Map<string, MobChannel> = new Map();

export async function initBossTracker() {
    console.log("Started Tracker...");
    
    try {
        const mobs = await pb.collection('mobs').getFullList<Mob>();
        mobs.forEach(mob => mobs_cache.set(mob.id, mob));

        console.log(`Cached ${mobs_cache.size} mobs.`);

        const mobChannels = await pb.collection('mob_channel_status').getFullList<MobChannel>();
        mobChannels.forEach( mc => mob_channel_cache.set(mc.id, mc));
        console.log(`Cached ${mob_channel_cache.size} mob channels.`);
        
        await subsToApi();
    } catch (err) {
        console.error("Error initializing Boss Tracker:", err);
        throw err;
    }
}

async function subsToApi() {
    pb.collection('mob_channel_status').subscribe('*', (e) => {
        const mobChannel = e.record as MobChannel;

        if (e.action === 'create' || e.action === 'update') {
            mob_channel_cache.set(mobChannel.id, mobChannel);
            console.log(`Mob Channel updated: ${mobChannel.collectionName} (${mobChannel.id})`);
        } else if (e.action === 'delete') {
            mob_channel_cache.delete(mobChannel.id);
        }
    });

    pb.collection('mobs').subscribe('*', (e) => {
        const mob = e.record as Mob;

        if (e.action === 'create' || e.action === 'update') {
            mobs_cache.set(mob.id, mob);
            console.log(`Mob updated: ${mob.name} (${mob.id})`);
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
}