import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '../types';

// Read config from env or user custom storage
export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const customUrl = localStorage.getItem('just_supabase_url') || '';
  const customKey = localStorage.getItem('just_supabase_anon_key') || '';

  const url = customUrl || envUrl;
  const anonKey = customKey || envKey;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith('http'))
  };
};

let clientInstance: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
    } catch (e) {
      console.warn('Error creating Supabase client:', e);
      return null;
    }
  }
  return clientInstance;
};

export const resetSupabaseClient = () => {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  clientInstance = null;
};

// Interface for Realtime events
export interface RealtimeCallbacks {
  onNewMessage?: (msg: Message) => void;
  onReactionToggle?: (payload: { messageId: string; emoji: string; userId: string; chatId: string }) => void;
  onTypingStatus?: (payload: { chatId: string; userId: string; userName: string; isTyping: boolean }) => void;
  onDeleteMessage?: (payload: { chatId: string; messageId: string }) => void;
  onEditMessage?: (payload: { chatId: string; messageId: string; text: string }) => void;
  onDeleteChat?: (payload: { chatId: string }) => void;
  onConnectionChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void;
}

// Subscribe to JustChat live broadcast channel
export const subscribeToJustChat = (callbacks: RealtimeCallbacks): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
  }

  realtimeChannel = client.channel('justchat-live-room', {
    config: {
      broadcast: { ack: true }
    }
  });

  // Listen to live new message broadcasts
  realtimeChannel.on('broadcast', { event: 'new-message' }, (payload) => {
    if (payload.payload && callbacks.onNewMessage) {
      callbacks.onNewMessage(payload.payload as Message);
    }
  });

  // Listen to live reaction toggles
  realtimeChannel.on('broadcast', { event: 'reaction-toggle' }, (payload) => {
    if (payload.payload && callbacks.onReactionToggle) {
      callbacks.onReactionToggle(payload.payload as {
        messageId: string;
        emoji: string;
        userId: string;
        chatId: string;
      });
    }
  });

  // Listen to typing status
  realtimeChannel.on('broadcast', { event: 'typing-status' }, (payload) => {
    if (payload.payload && callbacks.onTypingStatus) {
      callbacks.onTypingStatus(payload.payload as {
        chatId: string;
        userId: string;
        userName: string;
        isTyping: boolean;
      });
    }
  });

  // Listen to message deletion
  realtimeChannel.on('broadcast', { event: 'delete-message' }, (payload) => {
    if (payload.payload && callbacks.onDeleteMessage) {
      callbacks.onDeleteMessage(payload.payload as { chatId: string; messageId: string });
    }
  });

  // Listen to message editing
  realtimeChannel.on('broadcast', { event: 'edit-message' }, (payload) => {
    if (payload.payload && callbacks.onEditMessage) {
      callbacks.onEditMessage(payload.payload as { chatId: string; messageId: string; text: string });
    }
  });

  // Listen to chat deletion
  realtimeChannel.on('broadcast', { event: 'delete-chat' }, (payload) => {
    if (payload.payload && callbacks.onDeleteChat) {
      callbacks.onDeleteChat(payload.payload as { chatId: string });
    }
  });

  realtimeChannel.subscribe((status) => {
    if (callbacks.onConnectionChange) {
      callbacks.onConnectionChange(status as 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR');
    }
  });

  return () => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
  };
};

// Broadcast functions
export const broadcastNewMessage = async (msg: Message) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'new-message',
      payload: msg
    });
  } catch (e) {
    console.warn('Broadcast message failed:', e);
  }
};

export const broadcastReaction = async (messageId: string, emoji: string, userId: string, chatId: string) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'reaction-toggle',
      payload: { messageId, emoji, userId, chatId }
    });
  } catch (e) {
    console.warn('Broadcast reaction failed:', e);
  }
};

export const broadcastTyping = async (chatId: string, userId: string, userName: string, isTyping: boolean) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'typing-status',
      payload: { chatId, userId, userName, isTyping }
    });
  } catch (e) {
    console.warn('Broadcast typing failed:', e);
  }
};

export const broadcastDeleteMessage = async (chatId: string, messageId: string) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'delete-message',
      payload: { chatId, messageId }
    });
  } catch (e) {
    console.warn('Broadcast delete message failed:', e);
  }
};

export const broadcastEditMessage = async (chatId: string, messageId: string, text: string) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'edit-message',
      payload: { chatId, messageId, text }
    });
  } catch (e) {
    console.warn('Broadcast edit message failed:', e);
  }
};

export const broadcastDeleteChat = async (chatId: string) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'delete-chat',
      payload: { chatId }
    });
  } catch (e) {
    console.warn('Broadcast delete chat failed:', e);
  }
};

// Upload media file to Supabase storage bucket
export const uploadMediaToSupabase = async (
  file: File | Blob,
  fileName: string,
  bucket = 'justchat-media'
): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const filePath = `uploads/${Date.now()}_${fileName}`;
    const { error } = await client.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

    if (error) {
      console.warn('Storage upload error:', error);
      return null;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (e) {
    console.warn('Storage error:', e);
    return null;
  }
};
