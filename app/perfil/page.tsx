"use client";
import { useState } from "react";
import { FavoritesList } from "@/components/FavoritesList";
import { RemindersList } from "@/components/RemindersList";
import { UserProfileForm } from "@/components/UserProfileForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PerfilPage() {
  const [activeTab, setActiveTab] = useState<
    "perfil" | "favoritos" | "recordatorios"
  >("perfil");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">
          Gestiona tu información, favoritos y recordatorios
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="perfil">Información</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
          <TabsTrigger value="recordatorios">Recordatorios</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <UserProfileForm />
        </TabsContent>

        <TabsContent value="favoritos">
          <FavoritesList />
        </TabsContent>

        <TabsContent value="recordatorios">
          <RemindersList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
