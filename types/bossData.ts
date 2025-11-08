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
    id : string;
    last_hp: number;
    last_update: string;
    mob: string;
}