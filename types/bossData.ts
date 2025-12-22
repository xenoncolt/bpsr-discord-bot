export interface Mob {
    collectionId: string;
    collectionName: string;
    id : string;
    map: string;
    name: string;
    respawn_time: number; // 0 | 30
    type: string;
    uid: number; 
}

export interface MobChannel {
    channel_number: number;
    collectionId: string;
    collectionName: string;
    id: string;
    last_hp: number;
    last_update: string;
    mob: string;
    region: 'NA' | 'SEA';
    location_image?: number | null;
}

// New realtime update format: [mob_id, channel_number, hp_percentage, location_image]
export type MobHpUpdate = [string, number, number, number | null];

export type Region = 'NA' | 'SEA';

export interface BossHpReminder {
    id: number;
    mob_id: string;
    mob_name: string;
    guild_id: string;
    channel_id: string;
    role_id?: string;
    hp_percent: number;
    region: 'NA' | 'SEA';
}