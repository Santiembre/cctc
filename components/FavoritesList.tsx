'use client';
import { useEffect, useState } from 'react';
import { ActivityCard } from '@/components/ActivityCard';
import { Loader2, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types/activity';

export function FavoritesList() {
  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          // Fetch full activity details for each favorite
          Promise.all(data.data.map((f: any) => 
            fetch(`/api/activities/${f.actividadId}`).then(r => r.json())
          )).then(results => {
            setFavorites(results.map(r => r.data).filter(Boolean));
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-4">No tienes actividades guardadas</p>
        <a href="/" className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">Explorar catálogo</a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favorites.map(activity => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onFavorite={(id) => setFavorites(prev => prev.filter(a => a.id !== id))}
          isFavorite={true}
        />
      ))}
    </div>
  );
}