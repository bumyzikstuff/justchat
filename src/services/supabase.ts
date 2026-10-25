import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '../types';

// Read config from env, user custom storage or baked-in defaults
export const getSupabaseConfig = () => {
  const defaultUrl = 'https://qceozwmesqvmiwhdblov.supabase.co';
  const defaultKey = 'sb_publishable_O0MQgsGOjVTa5njVYDJvmw_PCJwcdqD';

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const customUrl = localStorage.getItem('just_supabase_url') || '';
  const customKey = localStorage.getItem('just_supabase_anon_key') || '';

  const url = customUrl || envUrl || defaultUrl;
  const anonKey = customKey || envKey || defaultKey;

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
  onStickersUpdated?: (packs: any[]) => void;
  onProfileUpdated?: (user: any) => void;
  onNewStory?: (story: any) => void;
  onDeleteStory?: (payload: { storyId: string }) => void;
  onStoryLike?: (payload: { storyId: string; likes: any[] }) => void;
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

  // Listen to sticker packs sync across devices
  realtimeChannel.on('broadcast', { event: 'stickers-updated' }, (payload) => {
    if (payload.payload && callbacks.onStickersUpdated) {
      callbacks.onStickersUpdated(payload.payload as any[]);
    }
  });

  // Listen to profile updates (avatar, nickname, status, bio)
  realtimeChannel.on('broadcast', { event: 'profile-updated' }, (payload) => {
    if (payload.payload && callbacks.onProfileUpdated) {
      callbacks.onProfileUpdated(payload.payload);
    }
  });

  // Listen to new story
  realtimeChannel.on('broadcast', { event: 'new-story' }, (payload) => {
    if (payload.payload && callbacks.onNewStory) {
      callbacks.onNewStory(payload.payload);
    }
  });

  // Listen to story deletion
  realtimeChannel.on('broadcast', { event: 'delete-story' }, (payload) => {
    if (payload.payload && callbacks.onDeleteStory) {
      callbacks.onDeleteStory(payload.payload as { storyId: string });
    }
  });

  // Listen to story like
  realtimeChannel.on('broadcast', { event: 'story-like' }, (payload) => {
    if (payload.payload && callbacks.onStoryLike) {
      callbacks.onStoryLike(payload.payload as { storyId: string; likes: any[] });
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

export const broadcastStickersUpdated = async (packs: any[]) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'stickers-updated',
      payload: packs
    });
  } catch (e) {
    console.warn('Broadcast stickers updated failed:', e);
  }
};

export const broadcastProfileUpdated = async (user: any) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'profile-updated',
      payload: user
    });
  } catch (e) {
    console.warn('Broadcast profile updated failed:', e);
  }
};

export const broadcastNewStory = async (story: any) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'new-story',
      payload: story
    });
  } catch (e) {
    console.warn('Broadcast new story failed:', e);
  }
};

export const broadcastDeleteStory = async (storyId: string) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'delete-story',
      payload: { storyId }
    });
  } catch (e) {
    console.warn('Broadcast delete story failed:', e);
  }
};

export const broadcastStoryLike = async (storyId: string, likes: any[]) => {
  if (!realtimeChannel) return;
  try {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'story-like',
      payload: { storyId, likes }
    });
  } catch (e) {
    console.warn('Broadcast story like failed:', e);
  }
};

// ==========================================
// Cloud Persistence Helpers
// ==========================================

// Save chat and message to Supabase
export const saveMessageToCloud = async (
  msg: Message,
  chatInfo?: { name?: string; type?: 'direct' | 'group'; avatar?: string; statusEmoji?: string }
) => {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    // 1. Ensure chat row exists in chats table
    await client.from('chats').upsert({
      id: msg.chatId,
      name: chatInfo?.name || (msg.chatId === 'chat-general' ? 'Общий чат' : 'Чат'),
      type: chatInfo?.type || (msg.chatId === 'chat-general' ? 'group' : 'direct'),
      avatar: chatInfo?.avatar || null,
      status_emoji: chatInfo?.statusEmoji || null
    }, { onConflict: 'id' });

    // 2. Insert or upsert message
    await client.from('messages').upsert({
      id: msg.id,
      chat_id: msg.chatId,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      sender_emoji: msg.senderEmoji || null,
      sender_avatar: msg.senderAvatar || null,
      type: msg.type,
      text: msg.text || null,
      media_url: msg.mediaUrl || null,
      audio_duration: msg.audioDuration || null,
      audio_waveform: msg.audioWaveform ? msg.audioWaveform : null,
      track_info: msg.trackInfo ? msg.trackInfo : null,
      sticker_url: msg.stickerUrl || null,
      reactions: msg.reactions || {},
      status: msg.status || 'sent',
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Error saving message to Supabase cloud:', e);
  }
};

// Fetch messages for a chat from Supabase
export const fetchMessagesFromCloud = async (chatId: string, currentUserId: string): Promise<Message[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any): Message => {
      let createdTime = 'Недавно';
      try {
        const d = new Date(row.created_at);
        createdTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}

      return {
        id: row.id,
        chatId: row.chat_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderEmoji: row.sender_emoji || undefined,
        senderAvatar: row.sender_avatar || undefined,
        type: row.type || 'text',
        text: row.text || undefined,
        mediaUrl: row.media_url || undefined,
        audioDuration: row.audio_duration || undefined,
        audioWaveform: row.audio_waveform || undefined,
        trackInfo: row.track_info || undefined,
        stickerUrl: row.sticker_url || undefined,
        reactions: row.reactions || {},
        isOutgoing: row.sender_id === currentUserId,
        status: row.status || 'sent',
        createdAt: createdTime
      };
    });
  } catch (e) {
    console.warn('Error fetching messages from cloud:', e);
    return [];
  }
};

// Delete message in cloud
export const deleteMessageInCloud = async (messageId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('messages').delete().eq('id', messageId);
  } catch (e) {
    console.warn('Delete message error in cloud:', e);
  }
};

// Edit message in cloud
export const editMessageInCloud = async (messageId: string, text: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('messages').update({ text }).eq('id', messageId);
  } catch (e) {
    console.warn('Edit message error in cloud:', e);
  }
};

// Update reactions in cloud
export const updateReactionsInCloud = async (messageId: string, reactions: Record<string, string[]>) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('messages').update({ reactions }).eq('id', messageId);
  } catch (e) {
    console.warn('Update reactions error in cloud:', e);
  }
};

// Stories Cloud Persistence
export const saveStoryToCloud = async (story: any) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('stories').upsert({
      id: story.id,
      user_id: story.userId,
      author: story.author,
      media_url: story.mediaUrl,
      media_type: story.mediaType || 'image',
      caption: story.caption || '',
      created_at_timestamp: story.createdAtTimestamp || Date.now(),
      views_count: story.viewsCount || 0,
      viewers: story.viewers || [],
      likes: story.likes || []
    });
  } catch (e) {
    console.warn('Error saving story to cloud:', e);
  }
};

export const fetchStoriesFromCloud = async (): Promise<any[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const { data, error } = await client
      .from('stories')
      .select('*')
      .gte('created_at_timestamp', cutoff)
      .order('created_at_timestamp', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      author: row.author,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      caption: row.caption,
      createdAtTimestamp: Number(row.created_at_timestamp),
      createdAt: 'Недавно',
      viewsCount: row.views_count,
      viewers: row.viewers || [],
      likes: row.likes || []
    }));
  } catch (e) {
    console.warn('Error fetching stories from cloud:', e);
    return [];
  }
};

export const deleteStoryFromCloud = async (storyId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('stories').delete().eq('id', storyId);
  } catch (e) {
    console.warn('Delete story error in cloud:', e);
  }
};

export const updateStoryLikesInCloud = async (storyId: string, likes: any[]) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('stories').update({ likes }).eq('id', storyId);
  } catch (e) {
    console.warn('Update story likes in cloud:', e);
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
