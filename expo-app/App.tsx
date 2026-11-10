import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  Habit,
  Entry,
  addDays,
  computeHistory,
  day,
  entriesFor,
  entryId,
  newHabit,
  schedule,
  formatTime,
} from "../shared/domain";
import {
  initialize,
  useStore,
  saveEntry,
  saveRecords,
  reportError,
  clearError,
  sync,
} from "./src/store";
import {
  Button,
  Choices,
  Icon,
  Input,
  Label,
  Mark,
  ReducedMotion,
  Sheet,
  Theme,
  dark,
  light,
} from "./src/ui";
import { HabitEditor } from "./src/HabitEditor";
import { EntryEditor } from "./src/EntryEditor";
import { HabitDetail, Ring } from "./src/HabitDetail";
import { Settings } from "./src/Settings";
import { Account } from "./src/Account";
import {
  applyAppearance,
  installOffline,
  watchConnectivity,
  resetToken,
  useTouchDevice,
} from "./src/platform";
import { useDateNavigation } from "./src/useDateNavigation";
import { face, mono, webClass } from "./src/design";

export default function App() {
  const store = useStore(),
    scheme = useColorScheme(),
    { width, height } = useWindowDimensions();
  const touchDevice = useTouchDevice();
  const [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<{ habit: Habit; isNew: boolean } | null>(
      null,
    );
  const [entry, setEntry] = useState<{ habit: Habit; date: string } | null>(
      null,
    ),
    [settings, setSettings] = useState(false),
    [account, setAccount] = useState(false);
  const [filters, setFilters] = useState(false),
    [query, setQuery] = useState(""),
    [archive, setArchive] = useState("active"),
    [type, setType] = useState("all"),
    [completion, setCompletion] = useState("all"),
    [sort, setSort] = useState("manual");
  const [offset, setOffset] = useState(0),
    [reordering, setReordering] = useState(false),
    [now, setNow] = useState(new Date()),
    [token] = useState(() => resetToken());
  const [category, setCategory] = useState("");
  const t =
    store.preferences.theme === "dark" ||
    store.preferences.theme === "black" ||
    (store.preferences.theme === "system" && scheme === "dark")
      ? {
          ...dark,
          ...(store.preferences.theme === "black"
            ? { bg: "#000000", card: "#111111", header: "#111111" }
            : {}),
        }
      : light;
  const today = day(now, store.preferences.dayOffset),
    mobile = width < 700,
    compact = mobile || touchDevice,
    sidebar = width >= 1000 && !compact,
    cellWidth = mobile ? 44 : 56;
  const gutter = mobile ? 16 : width < 1200 ? 24 : 48,
    canvasWidth = Math.min(width - (sidebar ? 216 : 0), 1320) - gutter * 2;
  const count = Math.max(
    3,
    Math.min(
      7,
      Math.floor(
        (canvasWidth - (mobile ? 144 : 280) - (reordering ? 44 : 0)) /
          cellWidth,
      ),
    ),
  );
  const navigation = useDateNavigation({
    offset,
    cellWidth,
    reverse: store.preferences.reverse,
    onOffsetChange: setOffset,
  });
  const todayStyle: ViewStyle = {
    backgroundColor: t.accent + "1a",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.accent + "44",
  };
  const dates = Array.from({ length: count }, (_, i) =>
    addDays(today, -(offset + i)),
  );
  if (store.preferences.reverse) dates.reverse();
  useEffect(() => {
    initialize();
    installOffline();
    const stop = watchConnectivity(() => {
      setNow(new Date());
      void sync();
    });
    const timer = setInterval(() => {
      setNow(new Date());
      void sync();
    }, 30000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (token) setAccount(true);
  }, [token]);
  const habits = useMemo(
    () =>
      store.records.filter((r): r is Habit => r.kind === "habit" && !r.deleted),
    [store.records],
  );
  const computed = useMemo(
    () =>
      new Map(
        habits.map((h) => [
          h.id,
          computeHistory(
            h,
            entriesFor(store.records, h.id),
            today,
            store.preferences.firstWeekday,
          ),
        ]),
      ),
    [habits, store.records, today, store.preferences.firstWeekday],
  );
  const list = habits
    .filter(
      (h) =>
        (!category || h.category === category) &&
        (archive === "all" || h.archived === (archive === "archived")) &&
        (type === "all" || h.type === type) &&
        h.name.toLowerCase().includes(query.toLowerCase()) &&
        (completion === "all" ||
          Boolean(
            computed.get(h.id)?.find((e) => e.date === today)?.completed,
          ) ===
            (completion === "done")),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "color"
          ? a.color.localeCompare(b.color) || a.order - b.order
          : sort === "score"
            ? (computed.get(b.id)?.at(-1)?.score ?? 0) -
              (computed.get(a.id)?.at(-1)?.score ?? 0)
            : a.order - b.order || a.id.localeCompare(b.id),
    );
  const selectedHabit = habits.find((h) => h.id === selected);
  function toggle(h: Habit, date: string) {
    if (h.type !== "boolean" || !store.preferences.tapToToggle) {
      setEntry({ habit: h, date });
      return;
    }
    const prev = store.records.find(
      (r): r is Entry =>
        r.kind === "entry" && r.id === entryId(h.id, date) && !r.deleted,
    );
    const state =
      prev?.state === "yes"
        ? store.preferences.skip
          ? "skip"
          : "no"
        : prev?.state === "skip"
          ? "no"
          : prev?.state === "no" && store.preferences.unknown
            ? "unknown"
            : "yes";
    saveEntry(h.id, date, {
      state,
      value: null,
      notes: prev?.notes ?? "",
    }).catch(reportError);
  }
  async function move(h: Habit, delta: number) {
    const all = [...habits].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    const i = all.findIndex((v) => v.id === h.id),
      other = all[i + delta];
    if (!other) return;
    [all[i], all[i + delta]] = [all[i + delta], all[i]];
    // Normalize positions in one write so repeated moves remain deterministic across sync.
    const { version } = await import("../shared/domain");
    await saveRecords(
      all.map((habit, order) => ({
        ...habit,
        order,
        version: version(habit.version),
      })),
    );
  }
  const active = habits.filter((h) => !h.archived);
  const done = active.filter(
    (h) => computed.get(h.id)?.at(-1)?.completed,
  ).length;
  const [systemMotion, setSystemMotion] = useState(false);
  useEffect(() => {
    applyAppearance(
      t,
      systemMotion || store.preferences.reducedMotion,
      store.ready,
    );
  }, [t, systemMotion, store.preferences.reducedMotion, store.ready]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setSystemMotion(value);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystemMotion,
    );
    return () => {
      mounted = false;
      listener?.remove();
    };
  }, []);
  const newEditor = () =>
    setEditor({
      habit: newHabit(Math.max(0, ...habits.map((h) => h.order + 1))),
      isNew: true,
    });
  const filtered = !!(
    query ||
    category ||
    archive === "all" ||
    type !== "all" ||
    completion !== "all"
  );
  const dateControls = (
    <View
      style={{
        flexDirection: compact ? "column" : "row",
        alignItems: compact ? "stretch" : "center",
        gap: 8,
      }}
    >
      <Label
        style={{
          flex: compact ? undefined : 1,
          fontSize: 16,
          fontWeight: "500",
        }}
      >
        {new Date(addDays(today, -offset) + "T12:00:00Z").toLocaleDateString(
          undefined,
          { month: "long", year: "numeric", timeZone: "UTC" },
        )}
      </Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label="Show earlier dates"
          onPress={() => setOffset((v) => v + count)}
          style={{ paddingHorizontal: 10 }}
        >
          <Icon name="back" />
        </Button>
        <Button
          disabled={offset === 0}
          onPress={() => setOffset(0)}
          style={{ paddingHorizontal: 12 }}
        >
          Today
        </Button>
        <Button
          label="Show later dates"
          disabled={offset === 0}
          onPress={() => setOffset((v) => Math.max(0, v - count))}
          style={{ paddingHorizontal: 10 }}
        >
          <Icon name="next" />
        </Button>
      </View>
    </View>
  );
  function showList(mode: string) {
    setSelected(null);
    setArchive(mode);
    setQuery("");
    setCategory("");
    setType("all");
    setCompletion("all");
  }
  const accountButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account and sync status"
      onPress={() => setAccount(true)}
      style={({
        hovered,
        pressed,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => ({
        minHeight: sidebar ? 60 : 44,
        padding: sidebar ? 16 : 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: hovered ? t.card : "transparent",
        opacity: pressed ? 0.65 : 1,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      })}
    >
      <Icon name="cloud" />
      <View style={{ flex: 1 }}>
        <Label style={{ fontSize: 14, fontWeight: "500" }}>
          {sidebar
            ? store.account
              ? "Sync account"
              : "Local workspace"
            : store.account
              ? store.syncStatus
              : "Saved locally"}
        </Label>
        {sidebar && (
          <Label muted style={{ fontSize: 13, lineHeight: 20 }}>
            {store.account ? store.syncStatus : "Connect sync"}
          </Label>
        )}
      </View>
      {!sidebar && (
        <Label style={{ fontSize: 14 }}>
          {store.account ? "Account" : "Connect sync"}
        </Label>
      )}
    </Pressable>
  );
  return (
    <Theme.Provider value={t}>
      <ReducedMotion.Provider
        value={systemMotion || store.preferences.reducedMotion}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            backgroundColor: t.bg,
            paddingTop: Platform.OS === "ios" ? 50 : 0,
          }}
        >
          <StatusBar style={t === light ? "dark" : "light"} />
          {sidebar && (
            <View
              role="navigation"
              accessibilityLabel="Workspace"
              style={{
                width: 216,
                backgroundColor: t.card,
                padding: 16,
                borderRightWidth: 1,
                borderColor: t.line,
                gap: 24,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 16,
                  paddingHorizontal: 8,
                }}
              >
                <Mark />
                <Label
                  style={{ fontSize: 24, fontWeight: "500", letterSpacing: -1 }}
                >
                  Habits
                </Label>
              </View>
              <View style={{ gap: 8 }}>
                {(
                  [
                    ["active", "Habit log", "calendar"],
                    ["archived", "Archived habits", "archive"],
                  ] as const
                ).map(([mode, label, icon]) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    aria-pressed={archive === mode && !selectedHabit}
                    onPress={() => showList(mode)}
                    style={({
                      hovered,
                    }: {
                      pressed: boolean;
                      hovered?: boolean;
                    }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 12,
                      minHeight: 48,
                      borderRadius: 10,
                      backgroundColor:
                        archive === mode && !selectedHabit
                          ? t.paper
                          : hovered
                            ? t.line
                            : "transparent",
                    })}
                  >
                    <Icon name={icon} />
                    <Label style={{ flex: 1, fontSize: 14, fontWeight: "500" }}>
                      {label}
                    </Label>
                    <Label muted style={{ fontSize: 13 }}>
                      {
                        habits.filter(
                          (h) => h.archived === (mode === "archived"),
                        ).length
                      }
                    </Label>
                  </Pressable>
                ))}
              </View>
              <View style={{ flex: 1 }} />
              {!!active.length && (
                <View
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    backgroundColor: t.mint,
                    gap: 16,
                  }}
                >
                  <Label style={{ color: t.mintInk, fontSize: 14 }}>
                    Today's progress
                  </Label>
                  <Label
                    style={{
                      color: t.mintInk,
                      fontSize: 40,
                      lineHeight: 44,
                      fontWeight: "500",
                      letterSpacing: -2,
                    }}
                  >
                    {done}
                    <Text style={{ fontSize: 22, letterSpacing: -0.5 }}>
                      {" "}
                      / {active.length}
                    </Text>
                  </Label>
                  <Label
                    style={{ color: t.mintInk, fontSize: 14, lineHeight: 21 }}
                  >
                    {done === active.length
                      ? "All active habits complete."
                      : `${active.length - done} ${active.length - done === 1 ? "habit" : "habits"} remaining today.`}
                  </Label>
                </View>
              )}
              <Button
                label="Settings"
                onPress={() => setSettings(true)}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  justifyContent: "flex-start",
                  borderWidth: 0,
                  backgroundColor: "transparent",
                }}
              >
                <Icon name="settings" />
                <Label style={{ fontSize: 14 }}>Settings</Label>
              </Button>
              {accountButton}
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              role="banner"
              style={{
                minHeight: sidebar ? 72 : 64,
                flexDirection: "row",
                alignItems: "center",
                gap: compact ? 8 : 12,
                paddingHorizontal: compact ? gutter + Math.max(0, (width - 1320) / 2) : gutter,
                borderBottomWidth: 1,
                borderColor: t.line,
              }}
            >
              {compact && selectedHabit ? (
                <Button
                  label="Back to habits"
                  onPress={() => setSelected(null)}
                  style={{ borderWidth: 0, paddingHorizontal: 10 }}
                >
                  <Icon name="back" />
                </Button>
              ) : (
                !sidebar && <Mark size={28} />
              )}
              {!sidebar && (
                <Label
                  accessibilityRole={compact ? "header" : undefined}
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 20,
                    fontWeight: "500",
                    letterSpacing: -0.7,
                  }}
                >
                  {compact
                    ? (selectedHabit?.name ??
                      (archive === "archived"
                        ? "Archived habits"
                        : archive === "all"
                          ? "All habits"
                          : "Habits"))
                    : "Habits"}
                </Label>
              )}
              {sidebar && (
                <>
                  <Label muted style={{ fontSize: 14 }}>
                    Personal workspace
                  </Label>
                  <Label muted style={{ fontSize: 14 }}>
                    /
                  </Label>
                  <Label style={{ fontSize: 14 }}>
                    {selectedHabit
                      ? "Habit details"
                      : archive === "archived"
                        ? "Archive"
                        : "Habit log"}
                  </Label>
                  <View style={{ flex: 1 }} />
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: t.accent,
                    }}
                  />
                  <Label muted style={{ fontSize: 13 }}>
                    {store.account ? store.syncStatus : "Saved on this device"}
                  </Label>
                </>
              )}
              {(compact || height < 480) && (
                <Button
                  primary
                  label="Add habit"
                  disabled={!store.ready}
                  onPress={newEditor}
                  style={{ paddingHorizontal: 10 }}
                >
                  <Icon name="plus" color={t.onAccent} />
                </Button>
              )}
              {compact && !selectedHabit && (
                <Button
                  label="Filter and sort habits"
                  onPress={() => setFilters(true)}
                  style={{ borderWidth: 0, paddingHorizontal: 10 }}
                >
                  <Icon name="filter" />
                  {filtered && (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: t.accent,
                      }}
                    />
                  )}
                </Button>
              )}
              {!sidebar && (
                <Button
                  label="Settings"
                  onPress={() => setSettings(true)}
                  style={{ borderWidth: 0, paddingHorizontal: 10 }}
                >
                  <Icon name="settings" />
                </Button>
              )}
              {!compact && height < 480 && selectedHabit && (
                <Button
                  label="Back to habits"
                  onPress={() => setSelected(null)}
                >
                  <Icon name="back" />
                </Button>
              )}
            </View>
            {store.error && (
              <View
                accessibilityRole="alert"
                style={{
                  padding: 16,
                  backgroundColor: t.card,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <Label style={{ color: t.danger, flex: 1 }}>
                  {store.error}
                </Label>
                <Button onPress={clearError}>Dismiss</Button>
              </View>
            )}
            <View
              role="main"
              nativeID="habit-content"
              tabIndex={-1}
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                maxWidth: 1320,
                alignSelf: "center",
                paddingHorizontal: gutter,
                paddingVertical: compact ? 12 : 0,
              }}
            >
              {!compact && height >= 480 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: height < 600 ? 16 : mobile ? 24 : 40,
                    paddingBottom: height < 600 ? 16 : 24,
                  }}
                >
                  {selectedHabit && (
                    <Button
                      label="Back to habits"
                      onPress={() => setSelected(null)}
                    >
                      <Icon name="back" />
                    </Button>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label
                      accessibilityRole="header"
                      style={{
                        fontSize:
                          height < 600
                            ? 28
                            : width < 360
                              ? 32
                              : mobile
                                ? 36
                                : 52,
                        lineHeight: height < 600 ? 36 : mobile ? 44 : 60,
                        letterSpacing: mobile ? -1.4 : -2.4,
                        fontWeight: "500",
                      }}
                    >
                      {selectedHabit
                        ? "Habit details"
                        : archive === "archived"
                          ? "Your archive"
                          : "Habit log"}
                    </Label>
                    {height >= 600 && (
                      <Label muted style={{ fontSize: 14, marginTop: 8 }}>
                        {new Date(today + "T12:00:00Z").toLocaleDateString(
                          undefined,
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                          },
                        )}
                      </Label>
                    )}
                  </View>
                  <Button
                    primary
                    label="Add habit"
                    disabled={!store.ready}
                    onPress={newEditor}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Icon name="plus" color={t.onAccent} />
                      <Label
                        style={{
                          color: t.onAccent,
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        Add habit
                      </Label>
                    </View>
                  </Button>
                </View>
              )}
              {!store.ready ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {store.error ? (
                    <Label>
                      Saved data could not be loaded. Check browser storage
                      permissions and reload.
                    </Label>
                  ) : (
                    <ActivityIndicator color={t.accent} />
                  )}
                </View>
              ) : selectedHabit ? (
                <ScrollView>
                  <HabitDetail
                    habit={selectedHabit}
                    onEdit={() =>
                      setEditor({ habit: selectedHabit, isNew: false })
                    }
                    onEntry={(date) => setEntry({ habit: selectedHabit, date })}
                    onClose={() => setSelected(null)}
                  />
                </ScrollView>
              ) : (
                <>
                  {!compact && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: 8,
                        paddingBottom: height < 480 ? 8 : 16,
                      }}
                    >
                      <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                        {!sidebar ? (
                          <>
                            {(["active", "archived"] as const).map((mode) => (
                              <Button
                                key={mode}
                                onPress={() => showList(mode)}
                                label={
                                  mode === "active"
                                    ? "Active habits"
                                    : "Archived habits"
                                }
                                style={{
                                  backgroundColor:
                                    archive === mode ? t.card : t.bg,
                                  borderColor:
                                    archive === mode ? t.line : "transparent",
                                  paddingHorizontal: mobile ? 12 : 16,
                                }}
                              >
                                {mode === "active" ? "Active" : "Archived"}
                              </Button>
                            ))}
                          </>
                        ) : (
                          <Label
                            muted
                            style={{ fontSize: 14, paddingBottom: 10 }}
                          >
                            {list.length}{" "}
                            {list.length === 1 ? "habit" : "habits"}
                            {archive === "archived"
                              ? " archived"
                              : " in your log"}
                          </Label>
                        )}
                      </View>
                      {!mobile && height >= 600 && (
                        <View style={{ width: 220 }}>
                          <Input
                            label="Search habits"
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Find a habit"
                          />
                        </View>
                      )}
                      <Button
                        label="Filter and sort habits"
                        onPress={() => setFilters(true)}
                        style={{ paddingHorizontal: mobile ? 12 : 16 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <Icon name="filter" />
                          {!mobile && (
                            <Label style={{ fontSize: 14 }}>
                              Filter & sort
                            </Label>
                          )}
                        </View>
                      </Button>
                    </View>
                  )}
                  {!compact && filtered && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingBottom: 12,
                        gap: 8,
                      }}
                    >
                      <Label muted style={{ flex: 1, fontSize: 14 }}>
                        {list.length} matching habits
                        {query ? ` for “${query}”` : ""}
                        {category ? ` · ${category}` : ""}
                      </Label>
                      <Button onPress={() => showList("active")}>
                        Reset filters
                      </Button>
                    </View>
                  )}
                  {!compact &&
                    !sidebar &&
                    active.length > 0 &&
                    height > 650 && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingBottom: 16,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: t.accent,
                          }}
                        />
                        <Label muted style={{ fontSize: 14 }}>
                          {done} of {active.length} complete today
                        </Label>
                      </View>
                    )}
                  {!compact && (
                    <View style={{ paddingBottom: height < 480 ? 8 : 16 }}>
                      {dateControls}
                    </View>
                  )}
                  <View
                    {...navigation.panHandlers}
                    testID="date-grid"
                    style={[
                      {
                        flex: 1,
                        minHeight: 0,
                        borderWidth: 1,
                        borderColor: t.line,
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: t.paper,
                      },
                      Platform.OS === "web" &&
                        ({
                          touchAction: "pan-y pinch-zoom",
                          userSelect: "none",
                          cursor: navigation.isDragging ? "grabbing" : "grab",
                        } as unknown as ViewStyle),
                    ]}
                  >
                    {/* Share the scrollbar gutter so header and entry columns stay aligned. */}
                    <ScrollView
                      testID="habit-list"
                      stickyHeaderIndices={list.length > 0 ? [0] : undefined}
                      contentContainerStyle={{ paddingBottom: 16 }}
                    >
                    {list.length > 0 && (
                      <View
                        style={{
                          flexDirection: "row",
                          borderBottomWidth: 1,
                          borderColor: t.line,
                          minHeight: 64,
                          backgroundColor: t.paper,
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            paddingLeft: mobile ? 16 : 24,
                          }}
                        >
                          <Label muted style={{ fontSize: 13 }}>
                            {reordering ? "Reorder habits" : "Habit"}
                          </Label>
                        </View>
                        {dates.map((date, column) => (
                          <View
                            key={column}
                            testID={`date-header-${date}`}
                            accessibilityLabel={
                              date === today ? `${date}, today` : date
                            }
                            style={[
                              {
                                width: cellWidth,
                                paddingVertical: 10,
                                alignItems: "center",
                                gap: 2,
                              },
                              date === today && todayStyle,
                            ]}
                          >
                            <Label
                              muted
                              style={{ fontSize: 13, lineHeight: 20 }}
                            >
                              {new Date(date + "T12:00:00Z").toLocaleDateString(
                                undefined,
                                { weekday: "short", timeZone: "UTC" },
                              )}
                            </Label>
                            <Label
                              style={{
                                fontFamily: mono,
                                fontSize: 14,
                                lineHeight: 22,
                                fontWeight: date === today ? "500" : "400",
                              }}
                            >
                              {Number(date.slice(8))}
                            </Label>
                          </View>
                        ))}
                      </View>
                    )}
                      {list.map((h) => {
                        const history = computed.get(h.id)!,
                          byDate = new Map(history.map((e) => [e.date, e]));
                        return (
                          <View
                            key={h.id}
                            style={{
                              flexDirection: "row",
                              minHeight: mobile ? 84 : 88,
                              borderBottomWidth: 1,
                              borderColor: t.line,
                              alignItems: "stretch",
                            }}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`View ${h.name}`}
                              onPress={() => {
                                if (!navigation.suppressPress())
                                  setSelected(h.id);
                              }}
                              style={({
                                hovered,
                                pressed,
                              }: {
                                pressed: boolean;
                                hovered?: boolean;
                              }) => ({
                                flex: 1,
                                minWidth: 0,
                                flexDirection: "row",
                                gap: mobile ? 10 : 16,
                                alignItems: "center",
                                paddingLeft: mobile ? 16 : 24,
                                paddingRight: 8,
                                backgroundColor:
                                  hovered || pressed ? t.card : "transparent",
                              })}
                            >
                              <Ring
                                color={h.color}
                                value={history.at(-1)?.score ?? 0}
                                size={mobile ? 22 : 32}
                              />
                              <View style={{ flex: 1 }}>
                                <Label
                                  numberOfLines={2}
                                  style={{
                                    fontSize: mobile ? 14 : 16,
                                    lineHeight: mobile ? 20 : 24,
                                    fontWeight: "500",
                                    letterSpacing: -0.2,
                                  }}
                                >
                                  {h.name}
                                </Label>
                                {!mobile && (
                                  <Label
                                    muted
                                    style={{
                                      fontSize: 13,
                                      lineHeight: 20,
                                      marginTop: 2,
                                    }}
                                  >
                                    {h.archived
                                      ? "Archived"
                                      : h.category || schedule(h)}
                                  </Label>
                                )}
                              </View>
                            </Pressable>
                            {reordering && (
                              <View style={{ width: 44 }}>
                                <Button
                                  label={`Move ${h.name} up`}
                                  onPress={() => move(h, -1).catch(reportError)}
                                  style={{
                                    paddingHorizontal: 8,
                                    borderWidth: 0,
                                  }}
                                >
                                  <Icon name="up" size={16} />
                                </Button>
                                <Button
                                  label={`Move ${h.name} down`}
                                  onPress={() => move(h, 1).catch(reportError)}
                                  style={{
                                    paddingHorizontal: 8,
                                    borderWidth: 0,
                                  }}
                                >
                                  <Icon name="down" size={16} />
                                </Button>
                              </View>
                            )}
                            {dates.map((date, column) => {
                              const e = byDate.get(date),
                                state = e?.state ?? "unknown",
                                number = e?.value;
                              const clock = h.type === "time" && e?.time ? formatTime(e.time, h.timeFormat).split(' ') : null;
                              return (
                                <Pressable
                                  key={column}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${h.name}, ${date}, ${clock ? clock.join(' ') : h.type === "number" && number !== null && number !== undefined ? `${number} ${h.unit}` : state}`}
                                  onPress={() => {
                                    if (!navigation.suppressPress())
                                      toggle(h, date);
                                  }}
                                  onLongPress={() => {
                                    if (!navigation.suppressPress())
                                      setEntry({ habit: h, date });
                                  }}
                                  style={({
                                    hovered,
                                    pressed,
                                  }: {
                                    pressed: boolean;
                                    hovered?: boolean;
                                  }) => [
                                    {
                                      width: cellWidth,
                                      justifyContent: "center",
                                      alignItems: "center",
                                    },
                                    date === today && todayStyle,
                                    (hovered || pressed) &&
                                      !navigation.isDragging && {
                                        opacity: 0.65,
                                      },
                                  ]}
                                >
                                  {clock ? <>
                                    <Label numberOfLines={1} style={{ fontFamily: mono, fontSize: mobile ? 13 : 14, fontWeight: '500' }}>{clock[0]}</Label>
                                    {clock[1] && <Label muted style={{ fontSize: 13, lineHeight: 18 }}>{clock[1]}</Label>}
                                  </> : h.type === "number" && state !== "skip" ? (
                                    <>
                                      <Label
                                        numberOfLines={1}
                                        style={{
                                          fontFamily: mono,
                                          fontSize: 15,
                                          fontWeight: e?.completed
                                            ? "500"
                                            : "400",
                                        }}
                                      >
                                        {number === null || number === undefined
                                          ? store.preferences.unknown
                                            ? "?"
                                            : "–"
                                          : Number(number.toFixed(3))}
                                      </Label>
                                      <Label
                                        muted
                                        numberOfLines={1}
                                        style={{ fontSize: 13, lineHeight: 18 }}
                                      >
                                        {h.unit}
                                      </Label>
                                    </>
                                  ) : (
                                    <View
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: e?.completed
                                          ? t.mint
                                          : t.line,
                                        backgroundColor: e?.completed
                                          ? state === "auto"
                                            ? t.soft
                                            : t.mint
                                          : state === "skip"
                                            ? t.card
                                            : t.paper,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {state === "yes" || state === "auto" ? (
                                        <Icon
                                          name="check"
                                          color={
                                            state === "auto"
                                              ? t.text
                                              : t.mintInk
                                          }
                                          size={18}
                                        />
                                      ) : (
                                        <Label muted style={{ fontSize: 16 }}>
                                          {state === "skip"
                                            ? "–"
                                            : state === "no"
                                              ? "×"
                                              : store.preferences.unknown
                                                ? "?"
                                                : "·"}
                                        </Label>
                                      )}
                                    </View>
                                  )}
                                  {!!e?.notes && (
                                    <View
                                      style={{
                                        position: "absolute",
                                        bottom: 12,
                                        width: 4,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: t.muted,
                                      }}
                                    />
                                  )}
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      })}
                      {!list.length && (
                        <View
                          style={{
                            alignItems: "center",
                            paddingHorizontal: 24,
                            paddingVertical: 24,
                            gap: 12,
                          }}
                        >
                          {height >= 800 && (
                            <View
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 24,
                                backgroundColor: t.card,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Mark size={40} />
                            </View>
                          )}
                          <Label
                            style={{
                              fontSize: mobile ? 24 : 32,
                              lineHeight: mobile ? 32 : 40,
                              letterSpacing: -0.8,
                              textAlign: "center",
                              fontWeight: "500",
                            }}
                          >
                            {habits.length
                              ? archive === "archived"
                                ? "No archived habits"
                                : "No matching habits"
                              : "No habits yet."}
                          </Label>
                          <Label
                            muted
                            style={{
                              maxWidth: 360,
                              textAlign: "center",
                              fontSize: 16,
                            }}
                          >
                            {habits.length
                              ? "Change your filters to see more habits."
                              : "Track a yes/no habit or a daily target. No account required."}
                          </Label>
                          {!habits.length && (
                            <Button primary onPress={newEditor}>
                              Add your first habit
                            </Button>
                          )}
                        </View>
                      )}
                    </ScrollView>
                  </View>
                  {!compact && height > 600 && list.length > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        gap: 8,
                      }}
                    >
                      <Icon name="note" size={16} color={t.muted} />
                      <Label muted style={{ fontSize: 13, lineHeight: 20 }}>
                        Select a day to record an entry. Hold a day to add notes
                        or change its value.
                      </Label>
                    </View>
                  )}
                </>
              )}
            </View>
            {!compact && !sidebar && (
              <View
                style={{
                  paddingHorizontal: gutter,
                  paddingVertical: 8,
                  marginTop: 8,
                  borderTopWidth: 1,
                  borderColor: t.line,
                }}
              >
                {accountButton}
              </View>
            )}
          </View>
          {filters && (
            <Sheet title="Filter & sort" onClose={() => setFilters(false)}>
              {compact && (
                <View style={{ gap: 12 }}>
                  <Label muted>Dates</Label>
                  {dateControls}
                </View>
              )}
              <Input
                label="Search habits"
                value={query}
                onChangeText={setQuery}
                placeholder="Habit name"
              />
              <Label muted>Show</Label>
              <Choices
                value={archive}
                options={[
                  ["active", "Active"],
                  ["archived", "Archived"],
                  ["all", "All"],
                ]}
                onChange={setArchive}
              />
              <Choices
                value={type}
                options={[
                  ["all", "All types"],
                  ["boolean", "Yes / no"],
                  ["number", "Measurable"],
                  ["time", "Time of day"],
                ]}
                onChange={setType}
              />
              <Choices
                value={completion}
                options={[
                  ["all", "All progress"],
                  ["done", "Completed today"],
                  ["pending", "Not completed"],
                ]}
                onChange={setCompletion}
              />
              <Label muted>Sort by</Label>
              <Choices
                value={sort}
                options={[
                  ["manual", "My order"],
                  ["name", "Name"],
                  ["color", "Colour"],
                  ["score", "Strength"],
                ]}
                onChange={(v) => {
                  setSort(v);
                  if (v !== "manual") setReordering(false);
                }}
              />
              {habits.some((h) => h.category) && (
                <>
                  <Label muted>Category</Label>
                  <Choices
                    value={category}
                    options={[
                      ["", "All categories"],
                      ...[
                        ...new Set(
                          habits.map((h) => h.category).filter(Boolean),
                        ),
                      ].map((c) => [c, c] as [string, string]),
                    ]}
                    onChange={setCategory}
                  />
                </>
              )}
              {filtered && (
                <Button onPress={() => showList("active")}>
                  Reset filters
                </Button>
              )}
              <Button
                onPress={() => {
                  setSort("manual");
                  setReordering((v) => !v);
                  setFilters(false);
                }}
              >
                {reordering ? "Finish reordering" : "Reorder habits"}
              </Button>
              <Button primary onPress={() => setFilters(false)}>
                Done
              </Button>
            </Sheet>
          )}
          {settings && (
            <Settings
              onClose={() => setSettings(false)}
              onAccount={() => {
                setSettings(false);
                setAccount(true);
              }}
            />
          )}
          {account && (
            <Account onClose={() => setAccount(false)} token={token} />
          )}
          {editor && (
            <HabitEditor
              habit={editor.habit}
              isNew={editor.isNew}
              onClose={() => setEditor(null)}
            />
          )}
          {entry && (
            <EntryEditor
              habit={entry.habit}
              date={entry.date}
              onClose={() => setEntry(null)}
            />
          )}
        </View>
      </ReducedMotion.Provider>
    </Theme.Provider>
  );
}
