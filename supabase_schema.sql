-- ========================================================
-- JustChat: Supabase Schema & Realtime Setup
-- Execute this script in your Supabase SQL Editor
-- ========================================================

-- 1. Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar TEXT,
  status_emoji TEXT DEFAULT '🔥',
  status_text TEXT,
  bio TEXT,
  is_online BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct', -- 'direct' or 'group'
  name TEXT NOT NULL,
  avatar TEXT,
  status_emoji TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_emoji TEXT,
  sender_avatar TEXT,
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'voice', 'video_note', 'audio', 'sticker', 'image', 'video'
  text TEXT,
  media_url TEXT,
  audio_duration INTEGER,
  audio_waveform JSONB,
  track_info JSONB,
  sticker_url TEXT,
  reactions JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  author JSONB NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  created_at_timestamp BIGINT NOT NULL,
  views_count INTEGER DEFAULT 0,
  viewers JSONB DEFAULT '[]'::jsonb,
  likes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) but allow anonymous access for private group
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for chats" ON public.chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for stories" ON public.stories FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Realtime on messages, chats & stories
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;

-- 7. Storage Bucket setup for attachments, voice notes, video circles, and tracks
INSERT INTO storage.buckets (id, name, public) 
VALUES ('justchat-media', 'justchat-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public uploads to justchat-media"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'justchat-media');

CREATE POLICY "Allow public reads from justchat-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'justchat-media');
