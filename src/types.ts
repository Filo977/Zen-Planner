export interface Sphere {
  id: string;
  label: string;
  color: string;
}

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  sphere: string;     // Sphere ID
  day_index: number;  // 0-6
}
