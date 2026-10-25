export interface User {
  id: string;
  nickname: string;
  username: string; // e.g. 'bublik' (without @)
  avatar: string;
  statusEmoji: string; // VIP status badge
  statusText?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen?: string;
  isVip?: boolean;
  hideLastSeen?: boolean;
  isBot?: boolean;
}

export interface StoryViewer {
  id: string;
  name: string;
  avatar: string;
  statusEmoji?: string;
  viewedAt?: string;
}

export interface StoryLike {
  id: string;
  name: string;
  avatar: string;
  statusEmoji?: string;
  likedAt?: string;
}

export interface Story {
  id: string;
  userId: string;
  author: User;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  createdAt: string;
  createdAtTimestamp?: number;
  caption?: string;
  isViewed?: boolean;
  viewsCount?: number;
  viewers?: StoryViewer[];
  likes?: StoryLike[];
}

export interface TrackInfo {
  title: string;
  artist: string;
  duration: string;
  coverUrl?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderEmoji?: string;
  senderAvatar?: string;
  type: 'text' | 'voice' | 'video_note' | 'audio' | 'sticker' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  audioDuration?: number; // seconds
  audioWaveform?: number[]; // amplitude values 0-100
  trackInfo?: TrackInfo;
  stickerUrl?: string;
  reactions?: Record<string, string[]>; // e.g. { '❤️': ['user-1'], '🔥': ['user-me'] }
  isEdited?: boolean;
  createdAt: string;
  isOutgoing: boolean;
  status: 'sent' | 'delivered' | 'read';
  botButtons?: { label: string; action: string; style?: 'primary' | 'secondary' | 'danger' }[];
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatar: string;
  statusEmoji?: string;
  isPinned: boolean;
  unreadCount: number;
  lastMessage?: {
    text: string;
    createdAt: string;
    type: Message['type'];
    isOutgoing: boolean;
  };
  members?: User[];
  isOnline?: boolean;
  lastSeen?: string;
  isSavedMessages?: boolean;
  isBot?: boolean;
}

export interface CatSticker {
  id: string;
  title: string;
  url: string;
  category: 'funny' | 'chill' | 'love' | 'rage';
}

export interface CustomSticker {
  id: string;
  packId: string;
  packName: string;
  emoji: string;
  title: string;
  url: string;
  createdAt: number;
}

export interface StickerPack {
  id: string;
  name: string;
  authorId: string;
  authorName?: string;
  createdAt: number;
  stickers: CustomSticker[];
}
