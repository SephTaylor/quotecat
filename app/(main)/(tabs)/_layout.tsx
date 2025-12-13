// app/(main)/(tabs)/_layout.tsx
import { Drawer } from "expo-router/drawer";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer";
import { View, Text, StyleSheet, Pressable, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { createNewQuote } from "@/lib/quotes";
import { signOut as authSignOut, getCurrentUserEmail, isAuthenticated } from "@/lib/auth";
import { HeaderIconButton } from "@/components/HeaderIconButton";

type IconProps = { color: string; size: number };

export default function DrawerLayout() {
  const { theme } = useTheme();
  const router = useRouter();

  const handleCreateNewQuote = React.useCallback(async () => {
    const newQuote = await createNewQuote("", "");
    router.push(`/quote/${newQuote.id}/edit`);
  }, [router]);

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitleAlign: 'center', // Center titles on all platforms (Android defaults to left)
        headerStyle: {
          backgroundColor: theme.colors.bg,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: "700",
        },
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 16, padding: 4 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={28} color={theme.colors.text} />
          </Pressable>
        ),
        drawerActiveTintColor: theme.colors.accent,
        drawerInactiveTintColor: theme.colors.muted,
        drawerStyle: {
          backgroundColor: theme.colors.bg,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: "600",
        },
        drawerItemStyle: {
          borderRadius: theme.radius.md,
          marginHorizontal: 8,
          marginVertical: 4,
        },
        drawerActiveBackgroundColor: `${theme.colors.accent}15`,
      })}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          drawerLabel: "Dashboard",
          drawerIcon: ({ color, size }: IconProps) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={handleCreateNewQuote}
              icon="+"
              side="right"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="quotes"
        options={{
          title: "Quotes",
          drawerLabel: "Quotes",
          drawerIcon: ({ color, size }: IconProps) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={handleCreateNewQuote}
              icon="+"
              side="right"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="invoices"
        options={({ navigation }) => ({
          title: "Invoices",
          drawerLabel: "Invoices",
          drawerIcon: ({ color, size }: IconProps) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={() => {
                // Navigate with trigger param to show quote picker
                navigation.navigate("invoices", { trigger: "create" });
              }}
              icon="+"
              side="right"
            />
          ),
        })}
      />
      <Drawer.Screen
        name="pro-tools"
        options={{
          title: "Pro Tools",
          drawerLabel: "Pro Tools",
          drawerIcon: ({ color, size }: IconProps) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="assemblies"
        options={{
          title: "Assemblies",
          drawerLabel: "Assemblies",
          drawerItemStyle: { display: "none" }, // Hidden - accessed via Pro Tools
          drawerIcon: ({ color, size }: IconProps) => (
            <Ionicons name="layers-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}

// Custom drawer content with app branding
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const styles = React.useMemo(() => createDrawerStyles(theme), [theme]);
  const [userEmail, setUserEmail] = React.useState<string | undefined>();
  const [isSignedIn, setIsSignedIn] = React.useState(false);

  // Load user state
  React.useEffect(() => {
    const load = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        const email = await getCurrentUserEmail();
        setUserEmail(email || undefined);
        setIsSignedIn(true);
      } else {
        setUserEmail(undefined);
        setIsSignedIn(false);
      }
    };
    load();
  }, []);

  const handleSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await authSignOut();
          setIsSignedIn(false);
          setUserEmail(undefined);
        },
      },
    ]);
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <View style={styles.appTitleContainer}>
          <Image
            source={require("@/assets/images/drew.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>QuoteCat</Text>
        </View>
        <Text style={styles.appSubtitle}>Quote Faster, Zero BS.</Text>
        {isSignedIn && userEmail && (
          <Text style={styles.userEmail}>{userEmail}</Text>
        )}
      </View>
      <DrawerItemList {...props} />
      <View style={styles.drawerFooter}>
        {isSignedIn ? (
          <Pressable
            style={styles.settingsItem}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.colors.muted} />
            <Text style={styles.settingsText}>Sign Out</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.settingsItem}
            onPress={handleSignIn}
          >
            <Ionicons name="log-in-outline" size={24} color={theme.colors.muted} />
            <Text style={styles.settingsText}>Sign In</Text>
          </Pressable>
        )}
        <View style={styles.footerDivider} />
        <Pressable
          style={styles.settingsItem}
          onPress={() => router.push("/(main)/settings")}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.muted} />
          <Text style={styles.settingsText}>Settings</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

function createDrawerStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    drawerContent: {
      flex: 1,
    },
    drawerHeader: {
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginBottom: 8,
    },
    appTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
    },
    logo: {
      width: 40,
      height: 40,
    },
    appTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    appSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      fontWeight: "500",
    },
    userEmail: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 8,
      fontWeight: "500",
    },
    drawerFooter: {
      marginTop: "auto",
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: 8,
    },
    footerDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 8,
      marginHorizontal: 8,
    },
    settingsItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 16,
      borderRadius: theme.radius.md,
    },
    settingsText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.muted,
    },
  });
}
