import React from 'react';
import { Story, User } from '../types';
import { Plus } from 'lucide-react';

interface StoriesBarProps {
  stories: Story[];
  currentUser: User;
  onOpenStory: (story: Story) => void;
  onAddStory: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  currentUser,
  onOpenStory,
  onAddStory
}) => {
  return (
    <div className="bg-[#17212b]/80 border-b border-[#242f3d]/60 px-3 py-2.5 overflow-x-auto no-scrollbar select-none">
      <div className="flex items-center space-x-3.5 min-w-max">
        {/* User's own add story button */}
        <div 
          onClick={onAddStory}
          className="flex flex-col items-center cursor-pointer group space-y-1"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-full p-0.5 border-2 border-dashed border-gray-500 group-hover:border-[#2AABEE] transition">
              <img
                src={currentUser.avatar}
                alt="Твоя история"
                className="w-full h-full rounded-full object-cover group-hover:scale-105 transition"
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-[#2AABEE] text-white rounded-full p-1 shadow-md border-2 border-[#17212b] group-hover:scale-110 transition">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-gray-300 group-hover:text-white truncate max-w-[64px] text-center">
            История
          </span>
        </div>

        {/* Stories list */}
        {stories.map((story) => {
          const isViewed = story.isViewed;
          return (
            <div
              key={story.id}
              onClick={() => onOpenStory(story)}
              className="flex flex-col items-center cursor-pointer group space-y-1 active:scale-95 transition"
            >
              <div className="relative">
                {/* Glowing rainbow gradient ring for unviewed stories */}
                <div 
                  className={`w-14 h-14 rounded-full p-[2px] transition ${
                    isViewed
                      ? 'border-2 border-gray-600/70'
                      : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-sky-400 p-[2.5px] shadow-sm shadow-rose-500/20'
                  }`}
                >
                  <img
                    src={story.author.avatar}
                    alt={story.author.nickname}
                    className="w-full h-full rounded-full object-cover border-2 border-[#17212b] group-hover:scale-105 transition"
                  />
                </div>
                {/* Author's status emoji */}
                <span 
                  className="absolute -bottom-1 -right-0.5 text-xs bg-[#17212b] rounded-full px-0.5 shadow border border-[#242f3d]"
                  title={`Статус: ${story.author.statusEmoji}`}
                >
                  {story.author.statusEmoji}
                </span>
              </div>
              <span className="text-[11px] font-medium text-gray-200 group-hover:text-[#2AABEE] truncate max-w-[64px] text-center">
                {story.author.nickname}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
