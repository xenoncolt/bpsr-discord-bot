export interface ReminderDbStruct {
    id: number;
    event_id: string;
    guild_id: string;
    channel_id: string;
    role_id?: string;
    custom_description?: string;
}