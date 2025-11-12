import React from 'react';
import { User } from 'lucide-react';

interface Props {
  position: string;
  name: string;
  profilePic?: string | null;
  isActive?: boolean;
  isCurrentUser?: boolean;
}

export const PlayerProfile: React.FC<Props> = ({ position, name, profilePic, isActive = false, isCurrentUser = false }) => {
  return (
    <div 
      className={`pointer-events-auto flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
        isActive 
          ? 'bg-amber-500/90 border-2 border-amber-300 shadow-lg shadow-amber-500/50 scale-110' 
          : isCurrentUser
          ? 'bg-blue-900/80 border-2 border-blue-500/50'
          : 'bg-slate-800/80 border-2 border-slate-600/50'
      }`}
    >
      {/* Avatar with Profile Picture */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
        isActive 
          ? 'bg-amber-400 border-2 border-white' 
          : isCurrentUser
          ? 'bg-blue-600 border-2 border-blue-400'
          : 'bg-slate-700 border-2 border-slate-500'
      }`}>
        {profilePic ? (
          <img src={profilePic} alt={name} className="w-full h-full object-cover" />
        ) : (
          <User className={`w-6 h-6 ${
            isActive ? 'text-white' : isCurrentUser ? 'text-blue-200' : 'text-slate-300'
          }`} />
        )}
      </div>
      
      {/* Name */}
      <div className="text-center">
        <p className={`text-xs font-bold ${
          isActive ? 'text-amber-100' : isCurrentUser ? 'text-blue-100' : 'text-slate-200'
        }`}>
          {name}
        </p>
        <p className={`text-[10px] ${
          isActive ? 'text-amber-200' : isCurrentUser ? 'text-blue-300' : 'text-slate-400'
        }`}>
          {position}
        </p>
      </div>
      
      {/* Active Turn Indicator */}
      {isActive && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 border-2 border-white rounded-full animate-pulse" />
      )}
    </div>
  );
};
