import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";

import { HomeScreen } from "../screens/HomeScreen";
import { MapScreen } from "../screens/MapScreen";
import { DevicesScreen } from "../screens/DevicesScreen";
import { DeviceDetailScreen } from "../screens/DeviceDetailScreen";
import { GeofencesScreen } from "../screens/GeofencesScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { TrackingScreen } from "../screens/TrackingScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useDashboard } from "../context/DashboardContext";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();
const DevicesStack = createNativeStackNavigator();
const ThisDeviceStack = createNativeStackNavigator();

// React Navigation's dark theme is close but not ours; overriding the palette
// stops the navigator painting its own greys behind our screens.
export const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.void,
    card: colors.base,
    text: colors.ink,
    border: colors.line,
    notification: colors.accent,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.base },
  headerTitleStyle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  headerTintColor: colors.accent,
  contentStyle: { backgroundColor: colors.void },
};

const DevicesNavigator = () => (
  <DevicesStack.Navigator screenOptions={screenOptions}>
    <DevicesStack.Screen
      name="DevicesList"
      component={DevicesScreen}
      options={{ title: "Devices" }}
    />
    <DevicesStack.Screen
      name="DeviceDetail"
      component={DeviceDetailScreen}
      options={{ title: "Device" }}
    />
    <DevicesStack.Screen
      name="Geofences"
      component={GeofencesScreen}
      options={{ title: "Geofences" }}
    />
  </DevicesStack.Navigator>
);

export const ThisDeviceNavigator = () => (
  <ThisDeviceStack.Navigator screenOptions={screenOptions}>
    <ThisDeviceStack.Screen
      name="Tracking"
      component={TrackingScreen}
      options={{ headerShown: false }}
    />
    <ThisDeviceStack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
  </ThisDeviceStack.Navigator>
);

const ICONS = {
  Home: ["home", "home-outline"],
  Map: ["map", "map-outline"],
  Devices: ["phone-portrait", "phone-portrait-outline"],
  People: ["people", "people-outline"],
  Alerts: ["notifications", "notifications-outline"],
  Device: ["radio", "radio-outline"],
};

export const RootNavigator = () => {
  const { unreadCount, incoming } = useDashboard();

  // Both badges count something the user has not dealt with yet.
  const pendingRequests = incoming.filter(
    (entry) => entry.status === "pending"
  ).length;

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...screenOptions,
          tabBarStyle: {
            backgroundColor: colors.base,
            borderTopColor: colors.line,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarLabelStyle: { fontSize: 11 },
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = ICONS[route.name] || ICONS.Map;

            return (
              <Ionicons
                name={focused ? active : inactive}
                size={size - 2}
                color={color}
              />
            );
          },
        })}
      >
        {/* Home first: the dashboard is what you want on opening the app, not
            a full-screen map with no context around it. */}
        <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
        <Tab.Screen
          name="Devices"
          component={DevicesNavigator}
          options={{ headerShown: false }}
        />
        <Tab.Screen
          name="People"
          component={PeopleScreen}
          options={{
            title: "People",
            tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.void },
          }}
        />
        <Tab.Screen
          name="Alerts"
          component={AlertsScreen}
          options={{
            // The badge is the reason the tab bar is worth having: an alert
            // that only exists inside a screen you have to open is not an alert.
            tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.void },
          }}
        />
        <Tab.Screen
          name="Device"
          component={ThisDeviceNavigator}
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
