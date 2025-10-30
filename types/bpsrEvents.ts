export interface Events {
    count: number;
    events: Event[];
}

export interface Event {
    id: string;
    name: string;
    description: string;
    recurring_times: Times[];
}

export interface Times {
    day: number;
    timestamp: number;
    end_timestamp: number;
}