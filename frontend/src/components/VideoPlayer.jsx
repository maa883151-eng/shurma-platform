import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, poster, autoPlay = false, className = '' }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);

  const isYT = src?.includes('youtube.com') || src?.includes('youtu.be');
  const isExternal = isYT || src?.includes('vimeo.com');

  // Convert YouTube URL to embed
  const embedSrc = (() => {
    if (!src) return '';
    if (src.includes('youtu.be/')) {
      const id = src.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
    }
    if (src.includes('youtube.com/watch')) {
      const id = new URL(src).searchParams.get('v');
      return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
    }
    if (src.includes('vimeo.com')) {
      const id = src.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return src;
  })();

  useEffect(() => {
    const v = ref.current;
    if (!v || isExternal) return;
    const onTime = () => { setCurrent(v.currentTime); setProgress((v.currentTime / v.duration) * 100 || 0); };
    const onLoaded = () => { setDuration(v.duration); setLoading(false); };
    const onEnded = () => { setPlaying(false); setEnded(true); };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('ended', onEnded);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onLoaded); v.removeEventListener('ended', onEnded); };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (ended) { v.currentTime = 0; setEnded(false); }
    if (playing) { v.pause(); setPlaying(false); } else { v.play(); setPlaying(true); }
  };

  const seek = (e) => {
    const v = ref.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const toggleFS = () => {
    const el = ref.current?.parentElement;
    if (!el) return;
    if (!fullscreen) { el.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  };

  if (isExternal) {
    return (
      <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={embedSrc}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="video"
        />
      </div>
    );
  }

  return (
    <div className={`relative group bg-black rounded-xl overflow-hidden ${className}`}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted={muted}
        playsInline
        autoPlay={autoPlay}
        className="w-full aspect-video object-contain"
        onCanPlay={() => setLoading(false)}
        onClick={toggle}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Big play button overlay */}
      {!playing && !loading && (
        <button onClick={toggle} className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/80 transition-colors">
            {ended ? <RotateCcw size={24} className="text-white" /> : <Play size={24} className="text-white ml-1" />}
          </div>
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress */}
        <div
          className="w-full h-1 bg-white/30 rounded-full mb-2 cursor-pointer"
          onClick={seek}
        >
          <div className="h-full bg-primary-400 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="text-white hover:text-primary-300">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-primary-300">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <span className="text-white/70 text-xs">{fmt(current)} / {fmt(duration)}</span>
          </div>
          <button onClick={toggleFS} className="text-white hover:text-primary-300">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
