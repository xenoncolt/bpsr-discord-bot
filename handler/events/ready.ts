import { Client, Events } from "discord.js";
import {  } from "fs";
import {  } from "child_process";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        console.log(`Ready! Logged in as ${client.user?.tag}`);

        let status_index = 0;
        setInterval(() => {
            const sts = [
                { name: `custom`, type: 4, state: `Too slow! Or maybe… I’m just too awesome.` as const},
                { name: `custom`, type: 4, state: `Don’t thank me. Well… you can, if you really must.` as const},
                { name: `custom`, type: 4, state: `Every corner hides a secret… or just another way to fall face-first.` as const},
            ];
            client.user?.setPresence({
                activities: [sts[status_index]],
                status: 'idle'
            });

            status_index = (status_index + 1) % sts.length;
        }, 1 * 60 * 1000);
    }
}