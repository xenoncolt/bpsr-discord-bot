import { AttachmentBuilder, Client, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, NewsChannel, SeparatorBuilder, SeparatorSpacingSize, TextChannel, TextDisplayBuilder } from "discord.js";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createReminderDB } from "../schema/reminderDB.js";
import { Event, Events } from "../types/bpsrEvents.js";
import axios from "axios";
import config from "../config.json" with { type: "json" };

const CHECK_INTERVAL = 60 * 1000;
const EVENT_WINDOW = 50 * 60;
const CACHE_FILE = join(process.cwd(), 'database', 'reminder_cache.json');
const IMG_FOLDER = join(process.cwd(), 'img');

interface ReminderDbStruct {
    id: number;
    event_id: string;
    guild_id: string;
    channel_id: string;
    role_id?: string;
    custom_description?: string;
}

let sentNotice = new Set<string>();

function loadCache() {
    try {
        if (existsSync(CACHE_FILE)) {
            const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
            const now = Math.floor(Date.now()/1000);

            sentNotice = new Set(
                data.filter((key: string) => {
                    const timestamp = parseInt(key.split('_').pop() || '0');
                    return now - timestamp < 60 * 60;
                })
            );

            console.log(`Loaded ${sentNotice.size} cached reminders.`);
        }
    } catch (e) {
        console.error('Error loading reminder cache:', e);
        sentNotice = new Set();
    }
}

function saveCache() {
    try {
        const dir = dirname(CACHE_FILE);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(CACHE_FILE, JSON.stringify([...sentNotice]), 'utf-8');
    } catch (e) {
        console.error('Error saving reminder cache:', e);
    }
}

export async function stReminder(client: Client) {
    console.log("Starting reminder scheduler...");
    loadCache();

    setInterval(() => {
        const now = Math.floor(Date.now()/1000);
        let cleaned = false;

        for (const key of sentNotice) {
            const timestamp = parseInt(key.toString().split('_').pop()|| '0');
            if (now - timestamp > 60 * 60) {
                sentNotice.delete(key);
                cleaned = true;
            }
        }

        if (cleaned) {
            saveCache();
            console.log(`Cleaned up reminder cache, ${sentNotice.size} entries remain.`);
        }
    }, 60 * 60 * 1000);

    // run immediately
    await sendReminder(client);

    // this for looping 
    setInterval(async () => {
        try {
            await sendReminder(client);
        } catch (e) {
            console.error('Error in sendReminder interval:', e);
        }
    }, CHECK_INTERVAL);
}

async function sendReminder(client: Client) {
    console.log("Checking for event reminders to send...");
    const db = await createReminderDB();

    const reminders: ReminderDbStruct[] = await db.all(`SELECT * FROM reminder_list`);
    console.log(`Fetched ${reminders.length} reminders from database.`);

    if (reminders.length === 0) return;

    const events = await fetchEvents();
    const currentTime = Math.floor(Date.now() / 1000);

    for (const remind of reminders) {
        const event = events.events.find(ev => ev.id === remind.event_id);
        console.log(`Processing reminder for event ID: ${remind.event_id}`);
        if (!event) continue;

        for (const time of event.recurring_times) {
            const timeDiff = time.timestamp - currentTime;

            const isEventActive = timeDiff <= 0 && timeDiff > -EVENT_WINDOW;

            if (isEventActive) {
                const notifyKey = `${remind.id}_${event.id}_${time.timestamp}`;

                if (sentNotice.has(notifyKey)){
                    continue;
                }

                const success = await sendEventNotice(client, remind, event, time.timestamp, time.day, time.end_timestamp);

                if (success) {
                    sentNotice.add(notifyKey);
                    saveCache();
                }
            }
        }
    }
}

async function sendEventNotice(client: Client, reminder: ReminderDbStruct, event: Event, eventTime: number, eventDay: number, eventEnd: number): Promise<boolean> {
    try {
        const channel = await client.channels.cache.get(reminder.channel_id) as TextChannel | NewsChannel;

        const day: { [key: number]: string } = {
            0: 'Sunday',
            1: 'Monday',
            2: 'Tuesday',
            3: 'Wednesday',
            4: 'Thursday',
            5: 'Friday',
            6: 'Saturday'
        }


        if (!channel) {
            console.error(`Channel not found: ${reminder.channel_id}`);
            (await createReminderDB()).run(`DELETE FROM reminder_list WHERE id = ?`, reminder.id);
        }

        const container = new ContainerBuilder();

        const title: string[] = [
            `# 😼 ${event.name} Time! :3😼`,
            `# 🌸 Its ${event.name} Time 🌟`,
            `# 🐱 ${event.name} Mrr... Lets Go...`,
            `# 😽 ${event.name} time... come.. play.. nya.. 🎀`
        ]

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(title[Math.floor(Math.random() * title.length)])
        );
        
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`**📅 Day:** ${day[eventDay]}  \n**⏰ Time:** <t:${eventTime}:t>  \n**🕒 Ends:** <t:${eventEnd}:R>`)
        )

        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        );

        if (event.description) {
            container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(event.description)
        );
        }

        const event_img = findEventImg(event.id);
        let attachment: AttachmentBuilder[] = [];

        if (event_img) {
            const img_name = `${event.id}.png`;
            const img_path = join(IMG_FOLDER, event_img);
            attachment = [new AttachmentBuilder(img_path, { name: img_name })];

            container.addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(`attachment://${img_name}`)
                    )
            );
        }

        if (attachment) {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                files: attachment
            })
        } else {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            })
        }
        console.log(`Sent notice for event ${event.id} (${event.name}) in channel ${reminder.channel_id}`);
        return true;
    } catch (e) {
        console.error(`Error sending event notice: ${event.id} -> ${e}`);
        return false;
    }
}

async function fetchEvents(): Promise<Events> {
    try {
        const res = await axios.get(config.api_url);
        return res.data;
    } catch (e) {
        console.error('Error fetching events from API:', e);
        throw e;
    }
}

function findEventImg(eventId: string) {
    try {
        if (!existsSync(IMG_FOLDER)) {
            console.warn(`Image folder does not exist: ${IMG_FOLDER}`);
            return null;
        }

        const files = readdirSync(IMG_FOLDER);
        const img_ext = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

        const matchImg = files.find(file => {
            const valid_ext = img_ext.some(ext => file.toLowerCase().endsWith(ext));
            const match_event_id = file.toLowerCase().startsWith(eventId.toLowerCase());
            return valid_ext && match_event_id;
        });

        return matchImg || null;
    } catch (e) {
        console.error(`Error finding event image: ${eventId} -> ${e}`);
        return null;
    }
}