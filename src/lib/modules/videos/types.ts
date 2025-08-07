export type YoutubeVideo = {
  youtubeId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  durationInMinutes?: number;
  channelHandle: string;
  playlistId?: string;
  playlistTitle?: string;
  thumbnailUrl?: string;
};
