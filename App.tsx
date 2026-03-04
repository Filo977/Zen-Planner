import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Plus, 
  X, 
  Trash2, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Send
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { CalendarEvent, Sphere } from './types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [spheres, setSpheres] = useState<Sphere[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSphereModalOpen, setIsSphereModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    sphere: '',
    day_index: 0,
    start_time: '09:00',
    end_time: '10:00'
  });

  const [sphereFormData, setSphereFormData] = useState<Partial<Sphere>>({
    id: '',
    label: '',
    color: '#D4E1F5'
  });

  useEffect(() => {
    fetchEvents();
    fetchSpheres();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events');
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchSpheres = async () => {
    try {
      const response = await fetch('/api/spheres');
      const data = await response.json();
      setSpheres(data);
      if (data.length > 0 && !formData.sphere) {
        setFormData(prev => ({ ...prev, sphere: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching spheres:', error);
    }
  };

  const handleSaveSphere = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = spheres.some(s => s.id === sphereFormData.id);
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/spheres/${sphereFormData.id}` : '/api/spheres';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sphereFormData),
      });

      if (response.ok) {
        fetchSpheres();
        setSphereFormData({ id: '', label: '', color: '#D4E1F5' });
      }
    } catch (error) {
      console.error('Error saving sphere:', error);
    }
  };

  const handleDeleteSphere = async (id: string) => {
    try {
      const response = await fetch(`/api/spheres/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSpheres();
      }
    } catch (error) {
      console.error('Error deleting sphere:', error);
    }
  };

  const handleSaveEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const method = selectedEvent?.id ? 'PUT' : 'POST';
    const url = selectedEvent?.id ? `/api/events/${selectedEvent.id}` : '/api/events';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchEvents();
      }
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent?.id) return;
    try {
      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchEvents();
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleAIScheduler = async () => {
    if (!aiPrompt.trim()) return;
    setIsProcessingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this text and extract calendar events: "${aiPrompt}". 
        Categorize each into one of these spheres: ${spheres.map(s => s.id).join(', ')}.
        Assign a day_index from 0 (Monday) to 6 (Sunday).
        Return a JSON array of events.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                sphere: { type: Type.STRING, enum: spheres.map(s => s.id) },
                day_index: { type: Type.INTEGER, description: "0 for Mon, 6 for Sun" },
                start_time: { type: Type.STRING, description: "HH:mm format" },
                end_time: { type: Type.STRING, description: "HH:mm format" }
              },
              required: ['title', 'sphere', 'day_index', 'start_time', 'end_time']
            }
          }
        }
      });

      const newEvents = JSON.parse(response.text);
      for (const event of newEvents) {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      }
      setIsAIModalOpen(false);
      setAiPrompt('');
      fetchEvents();
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const moveEvent = async (eventId: number, newDayIndex: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, day_index: newDayIndex }),
      });
      fetchEvents();
    } catch (error) {
      console.error('Error moving event:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6 wave-bg overflow-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between px-2 gap-4">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-800">Zen Planner</h1>
          <p className="text-sm text-zinc-500 font-medium">Flow through your week with intention.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSphereModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-md border border-white rounded-full font-semibold text-sm text-zinc-700 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 text-zinc-400" />
            Spheres
          </button>
          <button 
            onClick={() => setIsAIModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-md border border-white rounded-full font-semibold text-sm text-zinc-700 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            AI Scheduler
          </button>
          <button 
            onClick={() => {
              setSelectedEvent(null);
              setFormData({ title: '', sphere: 'Professional', day_index: 0, start_time: '09:00', end_time: '10:00' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-white rounded-full font-semibold text-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            New Bubble
          </button>
        </div>
      </header>

      {/* Main Content: Wavy Timeline */}
      <main className="flex-1 flex gap-2 md:gap-3 overflow-hidden px-2">
        {DAYS.map((day, idx) => (
          <div 
            key={day} 
            className="flex-1 min-w-0 flex flex-col gap-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const eventId = parseInt(e.dataTransfer.getData('eventId'));
              moveEvent(eventId, idx);
            }}
          >
            <div className="text-center py-2">
              <span className="text-xs md:text-sm font-black uppercase tracking-[0.15em] text-zinc-800">{day}</span>
            </div>
            
            <div className="flex-1 bg-white/30 backdrop-blur-sm border border-white/50 rounded-[32px] md:rounded-[40px] p-2 md:p-3 flex flex-col gap-2 md:gap-3 shadow-inner overflow-y-auto no-scrollbar">
              <AnimatePresence mode="popLayout">
                {events
                  .filter(e => e.day_index === idx)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((event) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      key={event.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('eventId', event.id!.toString())}
                      onClick={() => {
                        setSelectedEvent(event);
                        setFormData(event);
                        setIsModalOpen(true);
                      }}
                      style={{ backgroundColor: spheres.find(s => s.id === event.sphere)?.color || '#eee' }}
                      className="p-4 rounded-[24px] sphere-shadow cursor-grab active:cursor-grabbing border border-white/40 transition-transform hover:scale-[1.02]"
                    >
                      <h3 className="font-bold text-sm text-zinc-800 mb-0.5 truncate">{event.title}</h3>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500/80 uppercase tracking-wider">
                        <Clock className="w-2.5 h-2.5" />
                        {event.start_time} - {event.end_time}
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
              
              <button 
                onClick={() => {
                  setSelectedEvent(null);
                  setFormData({ title: '', sphere: spheres[0]?.id || '', day_index: idx, start_time: '09:00', end_time: '10:00' });
                  setIsModalOpen(true);
                }}
                className="mt-auto w-full py-3 border-2 border-dashed border-zinc-200/50 rounded-[30px] text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-all flex items-center justify-center flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Sphere Legend */}
      <footer className="flex flex-wrap justify-center gap-x-6 gap-y-2 py-2">
        {spheres.map(sphere => (
          <div key={sphere.id} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: sphere.color }} />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{sphere.label}</span>
          </div>
        ))}
      </footer>

      {/* AI Scheduler Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAIModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/20 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl relative z-10 p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-800">AI Scheduler</h3>
                    <p className="text-sm text-zinc-500">Describe your week, I'll handle the rest.</p>
                  </div>
                </div>
                <button onClick={() => setIsAIModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X /></button>
              </div>

              <textarea 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="E.g., I have a meeting on Monday at 10am, gym on Wednesday at 6pm, and a dinner with friends on Friday night..."
                className="w-full h-40 p-6 rounded-[30px] bg-zinc-50 border-none focus:ring-2 focus:ring-amber-200 outline-none text-zinc-700 resize-none mb-6"
              />

              <button 
                onClick={handleAIScheduler}
                disabled={isProcessingAI || !aiPrompt.trim()}
                className="w-full py-4 bg-zinc-800 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 disabled:opacity-50 transition-all"
              >
                {isProcessingAI ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Sparkles /></motion.div>
                ) : (
                  <>Manifest My Week <Send className="w-4 h-4" /></>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/20 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md relative z-10 p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-zinc-800">{selectedEvent ? 'Edit Bubble' : 'New Bubble'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X /></button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-6">
                <input 
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="What's happening?"
                  className="w-full text-xl font-bold border-none focus:ring-0 outline-none placeholder:text-zinc-300"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Start</label>
                    <input 
                      type="time" 
                      value={formData.start_time}
                      onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full p-3 rounded-2xl bg-zinc-50 border-none outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">End</label>
                    <input 
                      type="time" 
                      value={formData.end_time}
                      onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full p-3 rounded-2xl bg-zinc-50 border-none outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sphere of Life</label>
                  <div className="grid grid-cols-2 gap-2">
                    {spheres.map(sphere => (
                      <button
                        key={sphere.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, sphere: sphere.id })}
                        style={{ backgroundColor: formData.sphere === sphere.id ? sphere.color : '#f4f4f5' }}
                        className={`p-3 rounded-2xl text-xs font-bold transition-all ${formData.sphere === sphere.id ? 'shadow-md scale-105' : 'text-zinc-400'}`}
                      >
                        {sphere.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  {selectedEvent && (
                    <button 
                      type="button" 
                      onClick={handleDeleteEvent}
                      className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all"
                    >
                      <Trash2 />
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all"
                  >
                    {selectedEvent ? 'Update Bubble' : 'Create Bubble'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sphere Management Modal */}
      <AnimatePresence>
        {isSphereModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSphereModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/20 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg relative z-10 p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-800">Manage Spheres</h3>
                <button onClick={() => setIsSphereModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X /></button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                {spheres.map(sphere => (
                  <div key={sphere.id} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-3xl">
                    <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: sphere.color }} />
                    <div className="flex-1">
                      <div className="font-bold text-zinc-800">{sphere.label}</div>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-widest">{sphere.id}</div>
                    </div>
                    <button 
                      onClick={() => setSphereFormData(sphere)}
                      className="p-2 text-zinc-400 hover:text-zinc-600"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteSphere(sphere.id)}
                      className="p-2 text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveSphere} className="mt-8 pt-6 border-t border-zinc-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    required
                    placeholder="ID (e.g. Work)"
                    value={sphereFormData.id}
                    onChange={e => setSphereFormData({ ...sphereFormData, id: e.target.value })}
                    className="p-3 rounded-2xl bg-zinc-50 border-none outline-none text-sm font-bold"
                  />
                  <input 
                    required
                    placeholder="Label (e.g. Professional)"
                    value={sphereFormData.label}
                    onChange={e => setSphereFormData({ ...sphereFormData, label: e.target.value })}
                    className="p-3 rounded-2xl bg-zinc-50 border-none outline-none text-sm font-bold"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="color"
                    value={sphereFormData.color}
                    onChange={e => setSphereFormData({ ...sphereFormData, color: e.target.value })}
                    className="w-12 h-12 rounded-xl border-none p-0 bg-transparent cursor-pointer"
                  />
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-zinc-800 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all"
                  >
                    {spheres.some(s => s.id === sphereFormData.id) ? 'Update Sphere' : 'Add Sphere'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
