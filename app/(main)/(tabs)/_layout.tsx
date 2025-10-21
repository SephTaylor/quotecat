// app/(main)/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  const { theme } = useTheme();

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
        name="pro-tools"
        options={{
          title: "Pro Tools",
          tabBarIcon: ({ color }) => <ProToolsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="assemblies"
        options={{
          href: null, // Hidden - accessed via Pro Tools
        }}
      />
    </Tabs>
  );
}

// Clean, modern icon components
function DashboardIcon({ color }: { color: string }) {
  return <Ionicons name="grid-outline" size={24} color={color} />;
}

function QuotesIcon({ color }: { color: string }) {
  return <Ionicons name="document-text-outline" size={24} color={color} />;
}

function ProToolsIcon({ color }: { color: string }) {
  return <Ionicons name="sparkles-outline" size={24} color={color} />;
}
