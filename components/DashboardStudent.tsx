'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ActivityGrid } from '@/components/ActivityGrid';
import { FavoritesList } from '@/components/FavoritesList';
import { RemindersList } from '@/components/RemindersList';

export function DashboardStudent() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi panel</h1>
        <p className="text-muted-foreground">Gestiona tus actividades guardadas y recordatorios</p>
      </div>

      <Tabs defaultValue="favoritos" className="w-full">
        <TabsList>
          <TabsTrigger value="favoritos">Mis favoritos</TabsTrigger>
          <TabsTrigger value="recordatorios">Recordatorios</TabsTrigger>
          <TabsTrigger value="explorar">Explorar catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="favoritos">
          <FavoritesList />
        </TabsContent>

        <TabsContent value="recordatorios">
          <RemindersList />
        </TabsContent>

        <TabsContent value="explorar">
          <ActivityGrid activities={[]} showFavorites={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}