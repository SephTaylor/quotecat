// app/(main)/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { theme } from "@/constants/theme";
import React from "react";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <DashboardIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: "Quotes",
          tabBarIcon: ({ color }) => <QuotesIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="assemblies"
        options={{
          title: "Assemblies",
          tabBarIcon: ({ color }) => <AssembliesIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

// Simple icon components using text emojis for now
function DashboardIcon({ color }: { color: string }) {
  return <Text style={{ fontSize: 24, color }}>📊</Text>;
}

function QuotesIcon({ color }: { color: string }) {
  return <Text style={{ fontSize: 24, color }}>📝</Text>;
}

function AssembliesIcon({ color }: { color: string }) {
  return <Text style={{ fontSize: 24, color }}>📚</Text>;
}
